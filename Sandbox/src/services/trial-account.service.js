const Bot = require('../models/bot-management.model');
const BotUtils = require('./bot-utils.service');
const ProxyService = require('./proxy.service');
const NotificationService = require('./notification.service');
const config = require('../config/config');

class TrialAccountService {
    constructor() {
        this.activeTrials = new Map(); // accountId -> TrialInfo
        this.verificationQueue = new Map(); // accountId -> VerificationTask
        this.maxRetries = 3;
    }

    // Create new trial account
    async createTrialAccount(botId, userId, options = {}) {
        try {
            const bot = await Bot.findById(botId);
            if (!bot) throw new Error('Bot not found');

            // Generate unique account ID
            const accountId = this.generateAccountId();

            // Initialize browser instance
            const { browser, page } = await BotUtils.getBrowserInstance(botId, {
                useProxy: bot.config.useProxy
            });

            try {
                // Generate account credentials
                const credentials = BotUtils.generateRandomFormData();

                // Add trial info to tracking
                this.activeTrials.set(accountId, {
                    botId,
                    userId,
                    credentials,
                    createdAt: new Date(),
                    status: 'creating',
                    attempts: 0
                });

                // Execute trial creation steps
                await this.executeTrialCreation(bot, page, credentials);

                // Verify trial account
                const isVerified = await this.verifyTrialAccount(accountId, page);
                if (!isVerified) {
                    throw new Error('Trial account verification failed');
                }

                // Update trial status
                const trialInfo = this.activeTrials.get(accountId);
                trialInfo.status = 'active';
                trialInfo.activatedAt = new Date();

                // Save trial account to bot
                await this.saveTrialAccount(bot, accountId, credentials);

                // Notify user
                await NotificationService.sendToUser(userId, {
                    type: 'trial_created',
                    title: 'Trial Account Created',
                    message: `Successfully created trial account for ${bot.name}`,
                    data: {
                        botId,
                        accountId
                    }
                });

                return {
                    success: true,
                    accountId,
                    credentials: {
                        email: credentials.email,
                        password: credentials.password
                    }
                };

            } finally {
                await browser.close();
            }

        } catch (error) {
            console.error('Failed to create trial account:', error);
            throw error;
        }
    }

    // Execute trial creation steps
    async executeTrialCreation(bot, page, credentials) {
        try {
            // Navigate to service URL
            await page.goto(bot.config.customConfig.serviceUrl);
            await BotUtils.randomDelay();

            // Fill registration form
            for (const [field, value] of Object.entries(credentials)) {
                const selector = bot.config.customConfig.fields.find(f => f.name === field)?.selector;
                if (selector) {
                    await page.waitForSelector(selector);
                    await page.type(selector, value);
                    await BotUtils.randomDelay(500, 1500);
                }
            }

            // Handle CAPTCHA if present
            if (bot.config.customConfig.captchaSelector) {
                await this.handleCaptcha(page, bot);
            }

            // Submit form
            await page.click(bot.config.customConfig.submitSelector);
            await page.waitForNavigation();

            // Check for success indicators
            const success = await this.checkRegistrationSuccess(page, bot);
            if (!success) {
                throw new Error('Registration failed');
            }

        } catch (error) {
            console.error('Trial creation steps failed:', error);
            throw error;
        }
    }

    // Handle CAPTCHA solving
    async handleCaptcha(page, bot) {
        try {
            const captchaType = bot.config.customConfig.captchaType;
            const siteKey = await page.$eval(
                bot.config.customConfig.captchaSelector,
                el => el.getAttribute('data-sitekey')
            );

            const solution = await BotUtils.solveCaptcha(
                bot._id,
                captchaType,
                siteKey,
                page.url()
            );

            await page.evaluate(`document.querySelector('${bot.config.customConfig.captchaResponseSelector}').value = '${solution}'`);
        } catch (error) {
            console.error('CAPTCHA handling failed:', error);
            throw error;
        }
    }

    // Verify trial account
    async verifyTrialAccount(accountId, page) {
        const trialInfo = this.activeTrials.get(accountId);
        if (!trialInfo) return false;

        return new Promise((resolve, reject) => {
            const task = {
                attempts: 0,
                maxAttempts: 3,
                interval: setInterval(async () => {
                    try {
                        const isValid = await this.checkAccountValidity(page);
                        if (isValid) {
                            clearInterval(task.interval);
                            this.verificationQueue.delete(accountId);
                            resolve(true);
                        } else {
                            task.attempts++;
                            if (task.attempts >= task.maxAttempts) {
                                clearInterval(task.interval);
                                this.verificationQueue.delete(accountId);
                                resolve(false);
                            }
                        }
                    } catch (error) {
                        clearInterval(task.interval);
                        this.verificationQueue.delete(accountId);
                        reject(error);
                    }
                }, 30000) // Check every 30 seconds
            };

            this.verificationQueue.set(accountId, task);
        });
    }

    // Check account validity
    async checkAccountValidity(page) {
        try {
            // Check for common error indicators
            const errorIndicators = [
                'account disabled',
                'invalid account',
                'suspended',
                'banned'
            ];

            const pageContent = await page.content();
            return !errorIndicators.some(indicator => 
                pageContent.toLowerCase().includes(indicator)
            );
        } catch (error) {
            console.error('Account validity check failed:', error);
            return false;
        }
    }

    // Save trial account
    async saveTrialAccount(bot, accountId, credentials) {
        const trialAccount = {
            accountId,
            credentials: {
                email: credentials.email,
                password: credentials.password
            },
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + (bot.config.customConfig.trialDuration * 24 * 60 * 60 * 1000)),
            status: 'active'
        };

        bot.trialAccounts.push(trialAccount);
        await bot.save();
    }

    // Check trial account status
    async checkTrialStatus(accountId) {
        const trialInfo = this.activeTrials.get(accountId);
        if (!trialInfo) {
            throw new Error('Trial account not found');
        }

        return {
            status: trialInfo.status,
            createdAt: trialInfo.createdAt,
            activatedAt: trialInfo.activatedAt,
            expiresAt: trialInfo.expiresAt
        };
    }

    // Extend trial duration
    async extendTrial(accountId, days) {
        const trialInfo = this.activeTrials.get(accountId);
        if (!trialInfo) {
            throw new Error('Trial account not found');
        }

        const bot = await Bot.findById(trialInfo.botId);
        if (!bot) {
            throw new Error('Bot not found');
        }

        const trialAccount = bot.trialAccounts.find(t => t.accountId === accountId);
        if (!trialAccount) {
            throw new Error('Trial account not found in bot records');
        }

        trialAccount.expiresAt = new Date(trialAccount.expiresAt.getTime() + (days * 24 * 60 * 60 * 1000));
        await bot.save();

        return {
            success: true,
            newExpiryDate: trialAccount.expiresAt
        };
    }

    // Cancel trial account
    async cancelTrial(accountId) {
        const trialInfo = this.activeTrials.get(accountId);
        if (!trialInfo) {
            throw new Error('Trial account not found');
        }

        const bot = await Bot.findById(trialInfo.botId);
        if (!bot) {
            throw new Error('Bot not found');
        }

        // Update trial status
        trialInfo.status = 'cancelled';
        
        // Update bot records
        const trialAccount = bot.trialAccounts.find(t => t.accountId === accountId);
        if (trialAccount) {
            trialAccount.status = 'cancelled';
            await bot.save();
        }

        // Clean up resources
        this.activeTrials.delete(accountId);
        this.verificationQueue.delete(accountId);

        return {
            success: true,
            message: 'Trial account cancelled successfully'
        };
    }

    // Generate unique account ID
    generateAccountId() {
        return `trial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Clean up expired trials
    async cleanupExpiredTrials() {
        const now = new Date();
        for (const [accountId, trialInfo] of this.activeTrials) {
            if (trialInfo.expiresAt && trialInfo.expiresAt < now) {
                await this.cancelTrial(accountId);
            }
        }
    }
}

module.exports = new TrialAccountService();
