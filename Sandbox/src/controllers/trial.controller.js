const TrialService = require('../models/trial-service.model');
const User = require('../models/user.model');
const axios = require('axios');
const puppeteer = require('puppeteer');

class TrialController {
    constructor() {
        this.brightDataConfig = {
            username: process.env.BRIGHT_DATA_USERNAME,
            password: process.env.BRIGHT_DATA_PASSWORD,
            host: process.env.BRIGHT_DATA_HOST
        };

        this.rapidApiConfig = {
            key: process.env.RAPID_API_KEY,
            host: process.env.RAPID_API_HOST
        };
    }

    // Get available trial services
    async getAvailableServices(req, res) {
        try {
            const { category, subscription } = req.query;
            const query = { status: 'active' };
            
            if (category) {
                query.category = category;
            }

            if (subscription) {
                query['restrictions.requiredSubscriptionLevel'] = { $lte: subscription };
            }

            const services = await TrialService.find(query)
                .select('-automationConfig -brightDataConfig -rapidApiConfig')
                .sort({ 'statistics.successRate': -1 });

            res.json({
                success: true,
                services
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch services',
                error: error.message
            });
        }
    }

    // Create new trial account
    async createTrialAccount(req, res) {
        try {
            const { serviceId } = req.body;
            const userId = req.user.userId;

            // Get service and user
            const [service, user] = await Promise.all([
                TrialService.findById(serviceId),
                User.findById(userId)
            ]);

            if (!service || !user) {
                return res.status(404).json({
                    success: false,
                    message: 'Service or user not found'
                });
            }

            // Check eligibility
            if (!service.isAvailableForUser(user)) {
                return res.status(403).json({
                    success: false,
                    message: 'User is not eligible for this trial'
                });
            }

            // Generate trial credentials
            const credentials = await this.generateTrialCredentials(service);

            // Create trial account using automation
            const trialAccount = await this.automateTrialCreation(service, credentials);

            if (!trialAccount.success) {
                throw new Error(trialAccount.error);
            }

            // Calculate expiration date
            const expiresAt = this.calculateExpirationDate(service.trialDuration);

            // Add trial to user's account
            user.trialAccounts.push({
                serviceName: service.name,
                createdAt: new Date(),
                expiresAt,
                status: 'active',
                credentials: {
                    email: credentials.email,
                    username: credentials.username
                }
            });

            await user.save();

            // Update service statistics
            await service.updateStatistics(true);

            res.json({
                success: true,
                message: 'Trial account created successfully',
                trial: {
                    serviceName: service.name,
                    expiresAt,
                    credentials: {
                        email: credentials.email,
                        username: credentials.username
                    }
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to create trial account',
                error: error.message
            });
        }
    }

    // Generate trial credentials using RapidAPI
    async generateTrialCredentials(service) {
        try {
            // Generate email using RapidAPI
            const emailResponse = await axios.get('https://disposable-email.p.rapidapi.com/generate', {
                headers: {
                    'X-RapidAPI-Key': this.rapidApiConfig.key,
                    'X-RapidAPI-Host': 'disposable-email.p.rapidapi.com'
                }
            });

            // Generate identity using RapidAPI
            const identityResponse = await axios.get('https://fake-identity-generator.p.rapidapi.com/generate', {
                headers: {
                    'X-RapidAPI-Key': this.rapidApiConfig.key,
                    'X-RapidAPI-Host': 'fake-identity-generator.p.rapidapi.com'
                }
            });

            return {
                email: emailResponse.data.email,
                username: identityResponse.data.username,
                password: Math.random().toString(36).slice(-8)
            };
        } catch (error) {
            throw new Error(`Failed to generate credentials: ${error.message}`);
        }
    }

    // Automate trial creation using Puppeteer and Bright Data
    async automateTrialCreation(service, credentials) {
        try {
            const browser = await puppeteer.connect({
                browserWSEndpoint: `wss://${this.brightDataConfig.username}:${this.brightDataConfig.password}@${this.brightDataConfig.host}`
            });

            const page = await browser.newPage();
            
            // Execute automation steps
            for (const step of service.automationConfig.steps) {
                switch (step.action) {
                    case 'click':
                        await page.click(step.target);
                        break;
                    case 'type':
                        await page.type(step.target, credentials[step.value] || step.value);
                        break;
                    case 'wait':
                        await page.waitForSelector(step.target);
                        break;
                    case 'submit':
                        await page.evaluate((selector) => {
                            document.querySelector(selector).submit();
                        }, step.target);
                        break;
                }

                if (step.delay) {
                    await page.waitForTimeout(step.delay);
                }
            }

            await browser.close();

            return {
                success: true
            };
        } catch (error) {
            return {
                success: false,
                error: `Automation failed: ${error.message}`
            };
        }
    }

    // Calculate trial expiration date
    calculateExpirationDate(duration) {
        const now = new Date();
        switch (duration.unit) {
            case 'hours':
                return new Date(now.getTime() + duration.value * 60 * 60 * 1000);
            case 'days':
                return new Date(now.getTime() + duration.value * 24 * 60 * 60 * 1000);
            case 'months':
                return new Date(now.setMonth(now.getMonth() + duration.value));
            default:
                return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default 1 day
        }
    }

    // Get user's trial accounts
    async getUserTrials(req, res) {
        try {
            const userId = req.user.userId;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const activeTrials = user.getActiveTrials();

            res.json({
                success: true,
                trials: activeTrials
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch trials',
                error: error.message
            });
        }
    }

    // Cancel trial account
    async cancelTrial(req, res) {
        try {
            const { trialId } = req.params;
            const userId = req.user.userId;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const trial = user.trialAccounts.id(trialId);
            if (!trial) {
                return res.status(404).json({
                    success: false,
                    message: 'Trial not found'
                });
            }

            trial.status = 'cancelled';
            await user.save();

            res.json({
                success: true,
                message: 'Trial cancelled successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to cancel trial',
                error: error.message
            });
        }
    }
}

module.exports = new TrialController();
