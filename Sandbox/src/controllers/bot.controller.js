const User = require('../models/user.model');
const TrialService = require('../models/trial-service.model');
const ApiUtils = require('../utils/api.utils');
const config = require('../config/config');
const puppeteer = require('puppeteer');

class BotController {
    constructor() {
        this.activeBots = new Map();
        this.initializeBotTemplates();
    }

    // Initialize predefined bot templates
    async initializeBotTemplates() {
        this.botTemplates = {
            streaming: [
                {
                    name: 'Netflix Premium Bot',
                    description: 'Automated Netflix trial account creation with premium features',
                    category: 'streaming',
                    icon: '/assets/netflix-icon.png',
                    successRate: 98,
                    trialDuration: '30 days',
                    status: 'active',
                    config: {
                        url: 'https://netflix.com/signup',
                        selectors: {
                            email: '#id_email',
                            password: '#id_password',
                            submit: '.submit-button'
                        },
                        proxyRequired: true,
                        captchaType: 'recaptcha'
                    }
                },
                {
                    name: 'Disney+ Bot',
                    description: 'Automated Disney+ trial creation with region switching',
                    category: 'streaming',
                    icon: '/assets/disney-icon.png',
                    successRate: 95,
                    trialDuration: '7 days',
                    status: 'active',
                    config: {
                        url: 'https://disneyplus.com/sign-up',
                        selectors: {
                            email: '#email',
                            password: '#password',
                            submit: '#submit-button'
                        },
                        proxyRequired: true,
                        captchaType: 'hcaptcha'
                    }
                }
            ],
            development: [
                {
                    name: 'GitHub Pro Bot',
                    description: 'GitHub Pro trial account automation',
                    category: 'development',
                    icon: '/assets/github-icon.png',
                    successRate: 96,
                    trialDuration: '14 days',
                    status: 'active',
                    config: {
                        url: 'https://github.com/join',
                        selectors: {
                            username: '#user_login',
                            email: '#user_email',
                            password: '#user_password',
                            submit: '#signup_button'
                        },
                        proxyRequired: false,
                        captchaType: 'recaptcha'
                    }
                }
            ]
            // Add more categories and bots as needed
        };
    }

    // Get available bots
    async getAvailableBots(req, res) {
        try {
            const { category, status } = req.query;
            let bots = [];

            // Flatten bot templates into array
            Object.values(this.botTemplates).forEach(categoryBots => {
                bots = bots.concat(categoryBots);
            });

            // Apply filters
            if (category) {
                bots = bots.filter(bot => bot.category === category);
            }
            if (status) {
                bots = bots.filter(bot => bot.status === status);
            }

            res.json({
                success: true,
                bots
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch bots',
                error: error.message
            });
        }
    }

    // Launch bot instance
    async launchBot(req, res) {
        try {
            const { botName } = req.body;
            const userId = req.user.userId;

            // Find bot template
            let botTemplate = null;
            for (const categoryBots of Object.values(this.botTemplates)) {
                botTemplate = categoryBots.find(bot => bot.name === botName);
                if (botTemplate) break;
            }

            if (!botTemplate) {
                return res.status(404).json({
                    success: false,
                    message: 'Bot not found'
                });
            }

            // Check user limits
            const user = await User.findById(userId);
            const activeTrials = user.getActiveTrials();
            
            if (activeTrials.length >= config.service.maxTrialsPerUser[user.subscription.plan]) {
                return res.status(403).json({
                    success: false,
                    message: 'Trial limit reached for your subscription plan'
                });
            }

            // Initialize bot instance
            const botInstance = {
                id: `${userId}_${Date.now()}`,
                template: botTemplate,
                status: 'initializing',
                startTime: new Date(),
                logs: []
            };

            this.activeBots.set(botInstance.id, botInstance);

            // Start bot process
            this.runBot(botInstance, user).catch(error => {
                console.error(`Bot ${botInstance.id} failed:`, error);
                botInstance.status = 'failed';
                botInstance.error = error.message;
            });

            res.json({
                success: true,
                botInstanceId: botInstance.id,
                message: 'Bot launched successfully'
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to launch bot',
                error: error.message
            });
        }
    }

    // Run bot automation
    async runBot(botInstance, user) {
        const { template } = botInstance;
        let browser = null;

        try {
            // Initialize browser with proxy if required
            if (template.config.proxyRequired) {
                const proxyConfig = await ApiUtils.getBrightDataProxy();
                browser = await puppeteer.connect({
                    browserWSEndpoint: `wss://${proxyConfig.auth.username}:${proxyConfig.auth.password}@${proxyConfig.host}`
                });
            } else {
                browser = await puppeteer.launch(config.automation.puppeteer);
            }

            const page = await browser.newPage();
            botInstance.status = 'running';
            this.logBotActivity(botInstance, 'Bot started successfully');

            // Handle captcha if required
            if (template.config.captchaType) {
                await this.solveCaptcha(page, template.config.captchaType);
            }

            // Generate credentials
            const credentials = await ApiUtils.generateTrialCredentials();

            // Execute automation steps
            await page.goto(template.config.url);
            
            // Fill form fields
            for (const [field, selector] of Object.entries(template.config.selectors)) {
                await page.waitForSelector(selector);
                await page.type(selector, credentials[field]);
            }

            // Submit form
            await page.click(template.config.selectors.submit);
            await page.waitForNavigation();

            // Verify success
            const success = await this.verifyTrialCreation(page, template);
            if (success) {
                botInstance.status = 'completed';
                this.logBotActivity(botInstance, 'Trial account created successfully');

                // Save trial account to user
                await this.saveTrialAccount(user, template, credentials);
            } else {
                throw new Error('Failed to verify trial creation');
            }

        } catch (error) {
            botInstance.status = 'failed';
            this.logBotActivity(botInstance, `Error: ${error.message}`);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    // Verify trial creation
    async verifyTrialCreation(page, template) {
        // Implement verification logic based on template
        return true; // Placeholder
    }

    // Save trial account
    async saveTrialAccount(user, template, credentials) {
        const trialAccount = {
            serviceName: template.name,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.parseTrialDuration(template.trialDuration)),
            status: 'active',
            credentials: {
                email: credentials.email,
                username: credentials.username
            }
        };

        user.trialAccounts.push(trialAccount);
        await user.save();
    }

    // Get bot status
    async getBotStatus(req, res) {
        try {
            const { botInstanceId } = req.params;
            const botInstance = this.activeBots.get(botInstanceId);

            if (!botInstance) {
                return res.status(404).json({
                    success: false,
                    message: 'Bot instance not found'
                });
            }

            res.json({
                success: true,
                status: botInstance.status,
                logs: botInstance.logs
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to get bot status',
                error: error.message
            });
        }
    }

    // Stop bot
    async stopBot(req, res) {
        try {
            const { botInstanceId } = req.params;
            const botInstance = this.activeBots.get(botInstanceId);

            if (!botInstance) {
                return res.status(404).json({
                    success: false,
                    message: 'Bot instance not found'
                });
            }

            botInstance.status = 'stopped';
            this.logBotActivity(botInstance, 'Bot stopped by user');

            res.json({
                success: true,
                message: 'Bot stopped successfully'
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to stop bot',
                error: error.message
            });
        }
    }

    // Log bot activity
    logBotActivity(botInstance, message) {
        const logEntry = {
            timestamp: new Date(),
            message
        };
        botInstance.logs.push(logEntry);
    }

    // Parse trial duration to milliseconds
    parseTrialDuration(duration) {
        const [amount, unit] = duration.split(' ');
        const days = unit === 'days' ? parseInt(amount) : 
                    unit === 'weeks' ? parseInt(amount) * 7 : 
                    unit === 'months' ? parseInt(amount) * 30 : 1;
        
        return days * 24 * 60 * 60 * 1000;
    }
}

module.exports = new BotController();
