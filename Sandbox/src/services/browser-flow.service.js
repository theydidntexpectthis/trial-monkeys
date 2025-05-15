const { chromium } = require('playwright');
const AutomationProfilesService = require('./automation-profiles.service');
const ProxyManagerService = require('./proxy-manager.service');
const CaptchaAutomationService = require('./captcha-automation.service');
const serviceEndpoints = require('../config/service-endpoints.config');

class BrowserFlowService {
    constructor() {
        this.retryAttempts = 3;
        this.timeouts = {
            navigation: 30000,
            element: 5000,
            action: 2000
        };
    }

    async executeBrowserFlow(service, resources) {
        const browser = await this.setupBrowser(resources);
        let success = false;
        let result = null;

        try {
            const context = await this.createContext(browser, resources);
            const page = await context.newPage();

            // Execute flow steps
            result = await this.executeFlowSteps(page, service, resources);
            success = true;

        } catch (error) {
            console.error('Browser flow error:', error);
            throw error;
        } finally {
            // Track success/failure
            await this.trackFlowResult(service, success);
            await browser.close();
        }

        return result;
    }

    async setupBrowser(resources) {
        const browser = await chromium.launch({
            headless: true,
            proxy: resources.proxy,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });

        return browser;
    }

    async createContext(browser, resources) {
        const context = await browser.newContext({
            userAgent: resources.profile.userAgent,
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
            locale: 'en-US',
            timezoneId: 'America/New_York',
            permissions: ['geolocation'],
            geolocation: { latitude: 40.7128, longitude: -74.0060 },
            hasTouch: false,
            isMobile: false,
            colorScheme: 'dark'
        });

        // Set evasion scripts
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        return context;
    }

    async executeFlowSteps(page, service, resources) {
        const steps = serviceEndpoints[service.category][service.name].automationSteps;
        const credentials = {
            email: resources.email,
            password: resources.credentials.password
        };

        for (const step of steps) {
            await this.executeStep(page, step, { ...resources, credentials });
            await this.addRandomDelay();
        }

        return await this.verifyTrialCreation(page, service);
    }

    async executeStep(page, step, resources) {
        let attempts = 0;
        while (attempts < this.retryAttempts) {
            try {
                switch (step.type) {
                    case 'navigate':
                        await this.handleNavigation(page, step.url);
                        break;
                    case 'input':
                        await this.handleInput(page, step, resources);
                        break;
                    case 'click':
                        await this.handleClick(page, step.selector);
                        break;
                    case 'select':
                        await this.handleSelect(page, step);
                        break;
                    case 'wait':
                        await this.handleWait(page, step);
                        break;
                    case 'captcha':
                        await this.handleCaptcha(page, step);
                        break;
                    case 'payment':
                        await this.handlePayment(page, step, resources);
                        break;
                }
                break; // Success, exit retry loop
            } catch (error) {
                attempts++;
                if (attempts === this.retryAttempts) throw error;
                await this.addRandomDelay(1000, 2000);
            }
        }
    }

    async handleNavigation(page, url) {
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: this.timeouts.navigation
        });
    }

    async handleInput(page, step, resources) {
        await page.waitForSelector(step.selector, { timeout: this.timeouts.element });
        await page.type(step.selector, this.resolveValue(step.value, resources));
    }

    async handleClick(page, selector) {
        await page.waitForSelector(selector, { timeout: this.timeouts.element });
        await page.click(selector);
    }

    async handleSelect(page, step) {
        await page.waitForSelector(step.selector, { timeout: this.timeouts.element });
        await page.selectOption(step.selector, step.value);
    }

    async handleWait(page, step) {
        if (step.selector) {
            await page.waitForSelector(step.selector, { timeout: this.timeouts.element });
        } else if (step.duration) {
            await page.waitForTimeout(step.duration);
        }
    }

    async handleCaptcha(page, step) {
        const solved = await CaptchaAutomationService.solveCaptcha(page, step.type);
        if (!solved) throw new Error('Captcha solution failed');
    }

    async handlePayment(page, step, resources) {
        const { paymentMethod } = resources;
        const selectors = step.selectors;

        await page.waitForSelector(selectors.number, { timeout: this.timeouts.element });
        await page.type(selectors.number, paymentMethod.number);
        await page.type(selectors.expiry, `${paymentMethod.expMonth}/${paymentMethod.expYear}`);
        await page.type(selectors.cvv, paymentMethod.cvv);
    }

    async verifyTrialCreation(page, service) {
        const config = serviceEndpoints[service.category][service.name];
        
        // Check success indicators
        for (const pattern of config.successPatterns.elements) {
            if (await page.$(pattern)) {
                return true;
            }
        }

        // Check URL patterns
        const currentUrl = page.url();
        for (const pattern of config.successPatterns.urls) {
            if (currentUrl.includes(pattern)) {
                return true;
            }
        }

        return false;
    }

    resolveValue(template, resources) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            if (key === 'email') return resources.email;
            if (key === 'password') return resources.credentials.password;
            if (key.startsWith('card_')) {
                return resources.paymentMethod[key.replace('card_', '')];
            }
            return match;
        });
    }

    async addRandomDelay(min = 500, max = 1500) {
        const delay = Math.floor(Math.random() * (max - min + 1) + min);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async trackFlowResult(service, success) {
        await AutomationProfilesService.updateProfile(service, success);
        // Additional tracking logic here
    }
}

module.exports = new BrowserFlowService();
