const puppeteer = require('puppeteer');
const BotUtils = require('./bot-utils.service');
const ProxyService = require('./proxy.service');
const config = require('../config/config');

class BrowserAutomationService {
    constructor() {
        this.browserContexts = new Map(); // botId -> BrowserContext
        this.automationPatterns = new Map(); // serviceName -> AutomationPattern
        this.initializePatterns();
    }

    // Initialize automation patterns
    initializePatterns() {
        // Netflix automation pattern
        this.automationPatterns.set('netflix', {
            name: 'Netflix',
            steps: [
                {
                    action: 'navigate',
                    url: 'https://netflix.com/signup',
                    waitFor: '#planGrid'
                },
                {
                    action: 'selectPlan',
                    selector: '.planGrid__planContent--isSelected',
                    validate: async (page) => {
                        const selected = await page.$('.planGrid__planContent--isSelected');
                        return !!selected;
                    }
                },
                {
                    action: 'fillForm',
                    fields: [
                        { selector: '#id_email', type: 'email' },
                        { selector: '#id_password', type: 'password' },
                        { selector: '#id_firstName', type: 'text' }
                    ]
                }
            ],
            verification: {
                success: {
                    selector: '.account-page',
                    text: 'Welcome to Netflix'
                },
                error: {
                    selectors: ['.error-message', '.alert-danger']
                }
            }
        });

        // Spotify automation pattern
        this.automationPatterns.set('spotify', {
            name: 'Spotify',
            steps: [
                {
                    action: 'navigate',
                    url: 'https://spotify.com/signup',
                    waitFor: '#email'
                },
                {
                    action: 'fillForm',
                    fields: [
                        { selector: '#email', type: 'email' },
                        { selector: '#password', type: 'password' },
                        { selector: '#displayname', type: 'text' }
                    ]
                }
            ],
            verification: {
                success: {
                    selector: '.welcome-message',
                    text: 'Welcome to Spotify'
                },
                error: {
                    selectors: ['.alert-warning', '.error-message']
                }
            }
        });

        // Add more patterns as needed
    }

    // Get browser context
    async getBrowserContext(botId, options = {}) {
        try {
            if (this.browserContexts.has(botId)) {
                return this.browserContexts.get(botId);
            }

            const browser = await this.initializeBrowser(options);
            const context = await browser.createIncognitoBrowserContext();
            
            // Configure context
            await this.configureBrowserContext(context, options);
            
            this.browserContexts.set(botId, {
                browser,
                context,
                createdAt: new Date()
            });

            return { browser, context };
        } catch (error) {
            console.error('Failed to get browser context:', error);
            throw error;
        }
    }

    // Initialize browser
    async initializeBrowser(options) {
        const browserConfig = {
            headless: !options.debug,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        };

        if (options.proxy) {
            const proxy = await ProxyService.getProxy(options.proxy);
            browserConfig.args.push(`--proxy-server=${proxy.host}:${proxy.port}`);
        }

        return puppeteer.launch(browserConfig);
    }

    // Configure browser context
    async configureBrowserContext(context, options) {
        // Set user agent
        const userAgent = options.userAgent || BotUtils.getUserAgent();
        await context.setUserAgent(userAgent);

        // Set viewport
        await context.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        });

        // Set geolocation if needed
        if (options.geolocation) {
            await context.setGeolocation(options.geolocation);
        }

        // Set language and timezone
        await context.setExtraHTTPHeaders({
            'Accept-Language': options.language || 'en-US,en;q=0.9'
        });
    }

    // Execute automation pattern
    async executePattern(botId, serviceName, credentials, options = {}) {
        const pattern = this.automationPatterns.get(serviceName);
        if (!pattern) {
            throw new Error(`Automation pattern not found for service: ${serviceName}`);
        }

        const { browser, context } = await this.getBrowserContext(botId, options);
        const page = await context.newPage();

        try {
            // Execute each step in the pattern
            for (const step of pattern.steps) {
                await this.executeStep(page, step, credentials);
                await BotUtils.randomDelay(); // Add random delay between steps
            }

            // Verify success
            const success = await this.verifySuccess(page, pattern.verification);
            if (!success) {
                throw new Error('Verification failed');
            }

            // Extract necessary information
            const accountInfo = await this.extractAccountInfo(page, pattern);

            return {
                success: true,
                accountInfo
            };

        } catch (error) {
            console.error(`Pattern execution failed for ${serviceName}:`, error);
            throw error;
        } finally {
            await page.close();
        }
    }

    // Execute individual step
    async executeStep(page, step, credentials) {
        switch (step.action) {
            case 'navigate':
                await page.goto(step.url);
                if (step.waitFor) {
                    await page.waitForSelector(step.waitFor);
                }
                break;

            case 'selectPlan':
                await page.waitForSelector(step.selector);
                await page.click(step.selector);
                if (step.validate) {
                    const isValid = await step.validate(page);
                    if (!isValid) throw new Error('Plan selection validation failed');
                }
                break;

            case 'fillForm':
                for (const field of step.fields) {
                    await page.waitForSelector(field.selector);
                    await BotUtils.randomDelay(300, 800);
                    await page.type(field.selector, credentials[field.type], { delay: 100 });
                }
                break;

            case 'click':
                await page.waitForSelector(step.selector);
                await page.click(step.selector);
                break;

            case 'wait':
                if (step.selector) {
                    await page.waitForSelector(step.selector);
                } else {
                    await BotUtils.delay(step.duration || 1000);
                }
                break;

            default:
                throw new Error(`Unknown step action: ${step.action}`);
        }
    }

    // Verify success
    async verifySuccess(page, verification) {
        try {
            // Check for success indicator
            if (verification.success) {
                await page.waitForSelector(verification.success.selector);
                if (verification.success.text) {
                    const content = await page.$eval(verification.success.selector, el => el.textContent);
                    if (!content.includes(verification.success.text)) {
                        return false;
                    }
                }
            }

            // Check for error indicators
            if (verification.error) {
                for (const selector of verification.error.selectors) {
                    const error = await page.$(selector);
                    if (error) return false;
                }
            }

            return true;
        } catch (error) {
            console.error('Verification failed:', error);
            return false;
        }
    }

    // Extract account information
    async extractAccountInfo(page, pattern) {
        // Implementation depends on the specific service
        return {};
    }

    // Clean up resources
    async cleanup(botId) {
        const context = this.browserContexts.get(botId);
        if (context) {
            await context.browser.close();
            this.browserContexts.delete(botId);
        }
    }

    // Add new automation pattern
    addAutomationPattern(serviceName, pattern) {
        this.automationPatterns.set(serviceName, pattern);
    }

    // Get available patterns
    getAvailablePatterns() {
        return Array.from(this.automationPatterns.keys());
    }

    // Get pattern details
    getPatternDetails(serviceName) {
        return this.automationPatterns.get(serviceName);
    }
}

module.exports = new BrowserAutomationService();
