const puppeteer = require('puppeteer');
const Bot = require('../models/bot.model');
const ApiUtils = require('../utils/api.utils');
const config = require('../config/config');

class BotService {
    constructor() {
        this.activeInstances = new Map();
    }

    // Initialize bot instance
    async initializeBotInstance(botId, userId) {
        try {
            const bot = await Bot.findById(botId);
            if (!bot) throw new Error('Bot not found');

            const instanceId = `${botId}_${userId}_${Date.now()}`;
            const instance = {
                id: instanceId,
                bot,
                userId,
                status: 'initializing',
                startTime: new Date(),
                logs: [],
                retryCount: 0
            };

            this.activeInstances.set(instanceId, instance);
            return instance;
        } catch (error) {
            throw new Error(`Failed to initialize bot: ${error.message}`);
        }
    }

    // Run bot automation
    async runBot(instanceId) {
        const instance = this.activeInstances.get(instanceId);
        if (!instance) throw new Error('Bot instance not found');

        let browser = null;
        const startTime = Date.now();

        try {
            this.logActivity(instanceId, 'Starting bot automation');
            instance.status = 'running';

            // Initialize browser with appropriate configuration
            browser = await this.initializeBrowser(instance.bot.config);
            const page = await browser.newPage();

            // Set default navigation timeout
            page.setDefaultNavigationTimeout(instance.bot.config.timeout || 30000);

            // Execute automation steps
            await this.executeAutomationSteps(page, instance);

            // Update statistics
            const runTime = Date.now() - startTime;
            await instance.bot.updateStatistics(true, runTime);

            instance.status = 'completed';
            this.logActivity(instanceId, 'Bot automation completed successfully');

            return {
                success: true,
                instanceId,
                runtime: runTime
            };

        } catch (error) {
            const runTime = Date.now() - startTime;
            await instance.bot.updateStatistics(false, runTime);
            
            instance.status = 'failed';
            this.logActivity(instanceId, `Bot automation failed: ${error.message}`);

            // Handle retry logic
            if (instance.retryCount < instance.bot.automation.errorHandling.retryAttempts) {
                return this.handleRetry(instanceId);
            }

            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    // Initialize browser with appropriate configuration
    async initializeBrowser(botConfig) {
        if (botConfig.proxyRequired) {
            const proxyConfig = await ApiUtils.getBrightDataProxy();
            return puppeteer.connect({
                browserWSEndpoint: `wss://${proxyConfig.auth.username}:${proxyConfig.auth.password}@${proxyConfig.host}`,
                ...config.automation.puppeteer
            });
        }
        return puppeteer.launch(config.automation.puppeteer);
    }

    // Execute automation steps
    async executeAutomationSteps(page, instance) {
        const { automation } = instance.bot;

        for (const step of automation.steps) {
            try {
                await this.executeStep(page, step);
                this.logActivity(instance.id, `Completed step: ${step.action}`);
            } catch (error) {
                if (!step.optional) {
                    throw error;
                }
                this.logActivity(instance.id, `Skipped optional step: ${step.action}`);
            }
        }
    }

    // Execute individual automation step
    async executeStep(page, step) {
        switch (step.action) {
            case 'navigate':
                await page.goto(step.value);
                break;

            case 'click':
                await page.waitForSelector(step.selector);
                await page.click(step.selector);
                break;

            case 'type':
                await page.waitForSelector(step.selector);
                await page.type(step.selector, step.value);
                break;

            case 'wait':
                if (step.selector) {
                    await page.waitForSelector(step.selector, {
                        timeout: step.timeout || 30000
                    });
                } else {
                    await page.waitForTimeout(step.timeout || 1000);
                }
                break;

            case 'submit':
                await page.waitForSelector(step.selector);
                await Promise.all([
                    page.click(step.selector),
                    page.waitForNavigation()
                ]);
                break;

            case 'verify':
                await this.verifyStep(page, step);
                break;

            default:
                throw new Error(`Unknown action type: ${step.action}`);
        }
    }

    // Verify step success
    async verifyStep(page, step) {
        const element = await page.$(step.selector);
        if (!element) {
            throw new Error(`Verification failed: Element not found (${step.selector})`);
        }

        if (step.value) {
            const text = await page.evaluate(el => el.textContent, element);
            if (!text.includes(step.value)) {
                throw new Error(`Verification failed: Text mismatch (${step.value})`);
            }
        }
    }

    // Handle retry logic
    async handleRetry(instanceId) {
        const instance = this.activeInstances.get(instanceId);
        instance.retryCount++;

        const delay = instance.bot.automation.errorHandling.retryDelay;
        this.logActivity(instanceId, `Retrying attempt ${instance.retryCount} after ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.runBot(instanceId);
    }

    // Log activity
    logActivity(instanceId, message) {
        const instance = this.activeInstances.get(instanceId);
        if (instance) {
            instance.logs.push({
                timestamp: new Date(),
                message
            });
        }
    }

    // Get bot instance status
    getBotStatus(instanceId) {
        const instance = this.activeInstances.get(instanceId);
        if (!instance) throw new Error('Bot instance not found');

        return {
            id: instance.id,
            status: instance.status,
            startTime: instance.startTime,
            logs: instance.logs,
            retryCount: instance.retryCount
        };
    }

    // Stop bot instance
    async stopBot(instanceId) {
        const instance = this.activeInstances.get(instanceId);
        if (!instance) throw new Error('Bot instance not found');

        instance.status = 'stopped';
        this.logActivity(instanceId, 'Bot stopped by user');

        // Clean up after some time
        setTimeout(() => {
            this.activeInstances.delete(instanceId);
        }, 3600000); // Clean up after 1 hour

        return {
            success: true,
            message: 'Bot stopped successfully'
        };
    }

    // Clean up old instances
    cleanupOldInstances() {
        const oneHourAgo = Date.now() - 3600000;
        for (const [instanceId, instance] of this.activeInstances) {
            if (instance.startTime < oneHourAgo && ['completed', 'failed', 'stopped'].includes(instance.status)) {
                this.activeInstances.delete(instanceId);
            }
        }
    }

    // Get active instances count
    getActiveInstancesCount() {
        let count = 0;
        for (const instance of this.activeInstances.values()) {
            if (instance.status === 'running') count++;
        }
        return count;
    }
}

module.exports = new BotService();
