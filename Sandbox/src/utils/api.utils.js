const axios = require('axios');
const puppeteer = require('puppeteer');
const config = require('../config/config');

class ApiUtils {
    constructor() {
        this.rapidApiHeaders = {
            'X-RapidAPI-Key': config.rapidApi.key,
            'Content-Type': 'application/json'
        };
    }

    // Bright Data proxy configuration
    getBrightDataProxy(type = 'browser') {
        const proxyType = config.brightData.proxyTypes[type] || 'brd';
        return {
            host: config.brightData.host,
            port: config.brightData.port,
            auth: {
                username: `${config.brightData.username}-session-${Date.now()}`,
                password: config.brightData.password
            },
            type: proxyType
        };
    }

    // Initialize Puppeteer with Bright Data
    async initializePuppeteer(proxyConfig) {
        try {
            const browser = await puppeteer.connect({
                browserWSEndpoint: `wss://${proxyConfig.auth.username}:${proxyConfig.auth.password}@${proxyConfig.host}`,
                ...config.automation.puppeteer
            });

            return browser;
        } catch (error) {
            throw new Error(`Puppeteer initialization failed: ${error.message}`);
        }
    }

    // Email verification using RapidAPI
    async verifyEmail(email) {
        try {
            const response = await axios.get(config.rapidApi.endpoints.emailVerification.url, {
                params: { email },
                headers: {
                    ...this.rapidApiHeaders,
                    'X-RapidAPI-Host': config.rapidApi.endpoints.emailVerification.host
                }
            });

            return response.data;
        } catch (error) {
            throw new Error(`Email verification failed: ${error.message}`);
        }
    }

    // Phone verification using RapidAPI
    async verifyPhone(phoneNumber) {
        try {
            const response = await axios.post(config.rapidApi.endpoints.phoneVerification.url, {
                phone: phoneNumber
            }, {
                headers: {
                    ...this.rapidApiHeaders,
                    'X-RapidAPI-Host': config.rapidApi.endpoints.phoneVerification.host
                }
            });

            return response.data;
        } catch (error) {
            throw new Error(`Phone verification failed: ${error.message}`);
        }
    }

    // Generate fake identity using RapidAPI
    async generateIdentity() {
        try {
            const response = await axios.get(config.rapidApi.endpoints.identityGeneration.url, {
                headers: {
                    ...this.rapidApiHeaders,
                    'X-RapidAPI-Host': config.rapidApi.endpoints.identityGeneration.host
                }
            });

            return response.data;
        } catch (error) {
            throw new Error(`Identity generation failed: ${error.message}`);
        }
    }

    // Solve CAPTCHA using RapidAPI
    async solveCaptcha(captchaData) {
        try {
            const response = await axios.post(config.rapidApi.endpoints.captchaSolver.url, {
                ...captchaData
            }, {
                headers: {
                    ...this.rapidApiHeaders,
                    'X-RapidAPI-Host': config.rapidApi.endpoints.captchaSolver.host
                }
            });

            return response.data;
        } catch (error) {
            throw new Error(`CAPTCHA solving failed: ${error.message}`);
        }
    }

    // Web scraping with Bright Data
    async scrapeWebsite(url, options = {}) {
        const browser = await this.initializePuppeteer(this.getBrightDataProxy());
        try {
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle0' });

            let data;
            if (options.selector) {
                await page.waitForSelector(options.selector);
                data = await page.evaluate((selector) => {
                    return document.querySelector(selector).innerText;
                }, options.selector);
            } else {
                data = await page.content();
            }

            await browser.close();
            return data;
        } catch (error) {
            if (browser) await browser.close();
            throw new Error(`Web scraping failed: ${error.message}`);
        }
    }

    // Automated form filling
    async fillForm(url, formData, selectors) {
        const browser = await this.initializePuppeteer(this.getBrightDataProxy());
        try {
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle0' });

            for (const [field, value] of Object.entries(formData)) {
                const selector = selectors[field];
                if (selector) {
                    await page.waitForSelector(selector);
                    await page.type(selector, value);
                }
            }

            await browser.close();
            return true;
        } catch (error) {
            if (browser) await browser.close();
            throw new Error(`Form automation failed: ${error.message}`);
        }
    }

    // Retry mechanism for API calls
    async retryOperation(operation, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
                }
            }
        }

        throw lastError;
    }

    // Generate random user credentials
    generateCredentials() {
        return {
            username: `user_${Math.random().toString(36).substr(2, 8)}`,
            password: Math.random().toString(36).substr(2, 12),
            email: `${Math.random().toString(36).substr(2, 8)}@tempmail.com`
        };
    }
}

module.exports = new ApiUtils();
