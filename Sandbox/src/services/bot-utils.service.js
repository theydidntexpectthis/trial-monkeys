const axios = require('axios');
const UserAgent = require('user-agents');
const config = require('../config/config');
const ProxyService = require('./proxy.service');

class BotUtilsService {
    constructor() {
        this.userAgents = new Map(); // botId -> UserAgent
        this.captchaSolvers = new Map(); // botId -> CaptchaSolver
        this.cookieJars = new Map(); // botId -> CookieJar
        this.browserProfiles = new Map(); // botId -> BrowserProfile
    }

    // Get configured browser instance
    async getBrowserInstance(botId, options = {}) {
        try {
            const profile = await this.getBrowserProfile(botId);
            const proxy = options.useProxy ? await ProxyService.getProxy() : null;
            
            const browserConfig = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920,1080'
                ]
            };

            // Add proxy if available
            if (proxy) {
                browserConfig.args.push(`--proxy-server=${proxy.host}:${proxy.port}`);
            }

            // Add user agent
            const userAgent = this.getUserAgent(botId);
            browserConfig.args.push(`--user-agent=${userAgent}`);

            const browser = await require('puppeteer').launch(browserConfig);
            const page = await browser.newPage();

            // Set up proxy authentication if needed
            if (proxy?.auth) {
                await page.authenticate({
                    username: proxy.auth.username,
                    password: proxy.auth.password
                });
            }

            // Load cookies
            const cookies = this.getCookies(botId);
            if (cookies.length > 0) {
                await page.setCookie(...cookies);
            }

            // Set up request interception
            await page.setRequestInterception(true);
            page.on('request', request => {
                // Block unnecessary resources
                if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            return { browser, page };
        } catch (error) {
            console.error('Failed to get browser instance:', error);
            throw error;
        }
    }

    // Get or generate user agent
    getUserAgent(botId) {
        if (!this.userAgents.has(botId)) {
            this.userAgents.set(botId, new UserAgent().toString());
        }
        return this.userAgents.get(botId);
    }

    // Rotate user agent
    rotateUserAgent(botId) {
        const newUserAgent = new UserAgent().toString();
        this.userAgents.set(botId, newUserAgent);
        return newUserAgent;
    }

    // Solve CAPTCHA
    async solveCaptcha(botId, type, siteKey, url) {
        try {
            let solver;
            if (!this.captchaSolvers.has(botId)) {
                solver = await this.initializeCaptchaSolver(type);
                this.captchaSolvers.set(botId, solver);
            } else {
                solver = this.captchaSolvers.get(botId);
            }

            const solution = await solver.solve(siteKey, url);
            return solution;
        } catch (error) {
            console.error('Failed to solve CAPTCHA:', error);
            throw error;
        }
    }

    // Initialize CAPTCHA solver
    async initializeCaptchaSolver(type) {
        switch (type.toLowerCase()) {
            case 'recaptcha':
                return new RecaptchaSolver(config.captcha.apiKey);
            case 'hcaptcha':
                return new HCaptchaSolver(config.captcha.apiKey);
            default:
                throw new Error(`Unsupported CAPTCHA type: ${type}`);
        }
    }

    // Manage cookies
    getCookies(botId) {
        return this.cookieJars.get(botId) || [];
    }

    setCookies(botId, cookies) {
        this.cookieJars.set(botId, cookies);
    }

    // Get or create browser profile
    async getBrowserProfile(botId) {
        if (!this.browserProfiles.has(botId)) {
            const profile = await this.createBrowserProfile();
            this.browserProfiles.set(botId, profile);
        }
        return this.browserProfiles.get(botId);
    }

    // Create new browser profile
    async createBrowserProfile() {
        return {
            userAgent: new UserAgent().toString(),
            viewport: {
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
                isMobile: false,
                hasTouch: false,
                isLandscape: true
            },
            geolocation: await this.getRandomGeolocation(),
            language: 'en-US,en;q=0.9',
            timezone: this.getRandomTimezone(),
            platform: 'Win32'
        };
    }

    // Get random geolocation
    async getRandomGeolocation() {
        const locations = [
            { latitude: 40.7128, longitude: -74.0060 }, // New York
            { latitude: 34.0522, longitude: -118.2437 }, // Los Angeles
            { latitude: 51.5074, longitude: -0.1278 }, // London
            { latitude: 48.8566, longitude: 2.3522 }, // Paris
            { latitude: 35.6762, longitude: 139.6503 } // Tokyo
        ];
        return locations[Math.floor(Math.random() * locations.length)];
    }

    // Get random timezone
    getRandomTimezone() {
        const timezones = [
            'America/New_York',
            'America/Los_Angeles',
            'Europe/London',
            'Europe/Paris',
            'Asia/Tokyo'
        ];
        return timezones[Math.floor(Math.random() * timezones.length)];
    }

    // Handle rate limiting
    async handleRateLimit(response) {
        if (response.status === 429) {
            const retryAfter = parseInt(response.headers['retry-after']) || 60;
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            return true;
        }
        return false;
    }

    // Detect and handle anti-bot measures
    async detectAntiBot(page) {
        const antiBotIndicators = [
            'captcha',
            'security check',
            'verify human',
            'automated access',
            'bot detected'
        ];

        const pageContent = await page.content();
        const detected = antiBotIndicators.some(indicator => 
            pageContent.toLowerCase().includes(indicator)
        );

        if (detected) {
            throw new Error('Anti-bot measures detected');
        }
    }

    // Clean up resources
    async cleanup(botId) {
        this.userAgents.delete(botId);
        this.captchaSolvers.delete(botId);
        this.cookieJars.delete(botId);
        this.browserProfiles.delete(botId);
    }

    // Utility method to delay execution
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Add random delays between actions
    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await this.delay(delay);
    }

    // Simulate human-like behavior
    async simulateHumanBehavior(page) {
        // Random mouse movements
        await page.mouse.move(
            Math.random() * 1920,
            Math.random() * 1080,
            { steps: 10 }
        );

        // Random scrolling
        await page.evaluate(() => {
            window.scrollTo({
                top: Math.random() * document.body.scrollHeight,
                behavior: 'smooth'
            });
        });

        await this.randomDelay();
    }

    // Generate random form data
    generateRandomFormData() {
        return {
            firstName: this.getRandomName(),
            lastName: this.getRandomName(),
            email: this.generateRandomEmail(),
            password: this.generateStrongPassword()
        };
    }

    // Helper methods for generating random data
    getRandomName() {
        const names = ['John', 'Jane', 'Michael', 'Emma', 'William', 'Olivia'];
        return names[Math.floor(Math.random() * names.length)];
    }

    generateRandomEmail() {
        const domains = ['gmail.com', 'yahoo.com', 'outlook.com'];
        const username = `user${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const domain = domains[Math.floor(Math.random() * domains.length)];
        return `${username}@${domain}`;
    }

    generateStrongPassword() {
        const length = 12;
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    }
}

module.exports = new BotUtilsService();
