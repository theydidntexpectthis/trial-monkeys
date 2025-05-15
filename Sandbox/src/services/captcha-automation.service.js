const axios = require('axios');
const Redis = require('ioredis');
const apiConfig = require('../config/api-integrations.config');

class CaptchaAutomationService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.apiKey = apiConfig.rapidApiKey;
        this.providers = {
            twoCaptcha: {
                host: '2captcha.p.rapidapi.com',
                endpoints: {
                    solve: '/solve',
                    balance: '/balance'
                }
            },
            anticaptcha: {
                host: 'anti-captcha.p.rapidapi.com',
                endpoints: {
                    solve: '/solve',
                    tasks: '/tasks'
                }
            }
        };

        // Captcha types and their selectors
        this.captchaTypes = {
            recaptcha: {
                v2: {
                    frameSelector: "iframe[src*='recaptcha']",
                    checkboxSelector: ".recaptcha-checkbox-border",
                    verifySelector: "#recaptcha-verify-button"
                },
                v3: {
                    tokenKey: "recaptcha-token",
                    actionSelector: "[data-action]"
                }
            },
            hcaptcha: {
                frameSelector: "iframe[src*='hcaptcha']",
                checkboxSelector: "#checkbox",
                challengeSelector: ".challenge-container"
            },
            imageCaptcha: {
                imageSelector: "img[alt*='captcha']",
                inputSelector: "input[name*='captcha']",
                submitSelector: "button[type='submit']"
            }
        };
    }

    async solveCaptcha(page, type, options = {}) {
        try {
            // Detect captcha type if not specified
            const captchaType = type || await this.detectCaptchaType(page);
            if (!captchaType) return null;

            // Select optimal provider
            const provider = await this.selectProvider(captchaType);

            // Get captcha details
            const captchaDetails = await this.getCaptchaDetails(page, captchaType);

            // Solve captcha
            const solution = await this.requestSolution(provider, captchaType, captchaDetails);

            // Apply solution
            await this.applySolution(page, captchaType, solution);

            // Verify solution
            const success = await this.verifySolution(page, captchaType);

            // Track success/failure
            await this.trackAttempt(captchaType, provider, success);

            return success;
        } catch (error) {
            console.error('Captcha solving error:', error);
            throw error;
        }
    }

    async detectCaptchaType(page) {
        const detectors = {
            recaptcha: async () => {
                const v2Frame = await page.$(this.captchaTypes.recaptcha.v2.frameSelector);
                const v3Token = await page.evaluate(() => 
                    document.querySelector(`[name="${this.captchaTypes.recaptcha.v3.tokenKey}"]`)
                );
                return v2Frame ? 'recaptcha_v2' : v3Token ? 'recaptcha_v3' : null;
            },
            hcaptcha: async () => {
                const frame = await page.$(this.captchaTypes.hcaptcha.frameSelector);
                return frame ? 'hcaptcha' : null;
            },
            imageCaptcha: async () => {
                const image = await page.$(this.captchaTypes.imageCaptcha.imageSelector);
                return image ? 'image' : null;
            }
        };

        for (const [type, detector] of Object.entries(detectors)) {
            const result = await detector();
            if (result) return result;
        }

        return null;
    }

    async getCaptchaDetails(page, type) {
        switch (type) {
            case 'recaptcha_v2':
                return this.getRecaptchaV2Details(page);
            case 'recaptcha_v3':
                return this.getRecaptchaV3Details(page);
            case 'hcaptcha':
                return this.getHCaptchaDetails(page);
            case 'image':
                return this.getImageCaptchaDetails(page);
            default:
                throw new Error(`Unsupported captcha type: ${type}`);
        }
    }

    async getRecaptchaV2Details(page) {
        const siteKey = await page.evaluate(() => {
            const frame = document.querySelector("iframe[src*='recaptcha']");
            const url = new URL(frame.src);
            return url.searchParams.get('k');
        });

        return {
            type: 'recaptcha_v2',
            siteKey,
            url: page.url()
        };
    }

    async getRecaptchaV3Details(page) {
        const siteKey = await page.evaluate(() => {
            const script = document.querySelector("script[src*='recaptcha']");
            const url = new URL(script.src);
            return url.searchParams.get('render');
        });

        const action = await page.evaluate(() => {
            const element = document.querySelector("[data-action]");
            return element?.dataset.action;
        });

        return {
            type: 'recaptcha_v3',
            siteKey,
            action,
            url: page.url()
        };
    }

    async getHCaptchaDetails(page) {
        const siteKey = await page.evaluate(() => {
            const frame = document.querySelector("iframe[src*='hcaptcha']");
            const url = new URL(frame.src);
            return url.searchParams.get('sitekey');
        });

        return {
            type: 'hcaptcha',
            siteKey,
            url: page.url()
        };
    }

    async getImageCaptchaDetails(page) {
        const imageUrl = await page.evaluate(() => {
            const img = document.querySelector("img[alt*='captcha']");
            return img?.src;
        });

        return {
            type: 'image',
            imageUrl,
            url: page.url()
        };
    }

    async requestSolution(provider, type, details) {
        const response = await axios.post(
            `https://${this.providers[provider].host}${this.providers[provider].endpoints.solve}`,
            {
                ...details,
                apiKey: this.apiKey
            },
            {
                headers: {
                    'X-RapidAPI-Key': this.apiKey,
                    'X-RapidAPI-Host': this.providers[provider].host
                }
            }
        );

        return response.data;
    }

    async applySolution(page, type, solution) {
        switch (type) {
            case 'recaptcha_v2':
                await this.applyRecaptchaV2Solution(page, solution);
                break;
            case 'recaptcha_v3':
                await this.applyRecaptchaV3Solution(page, solution);
                break;
            case 'hcaptcha':
                await this.applyHCaptchaSolution(page, solution);
                break;
            case 'image':
                await this.applyImageCaptchaSolution(page, solution);
                break;
        }
    }

    async applyRecaptchaV2Solution(page, solution) {
        await page.evaluate((token) => {
            window.grecaptcha.enterprise.callback(token);
        }, solution.token);
    }

    async applyRecaptchaV3Solution(page, solution) {
        await page.evaluate((token) => {
            document.querySelector("[name='recaptcha-token']").value = token;
        }, solution.token);
    }

    async applyHCaptchaSolution(page, solution) {
        await page.evaluate((token) => {
            window.hcaptcha.submit(token);
        }, solution.token);
    }

    async applyImageCaptchaSolution(page, solution) {
        await page.type(
            this.captchaTypes.imageCaptcha.inputSelector,
            solution.text
        );
    }

    async verifySolution(page, type) {
        // Wait for success indicators
        const successIndicators = {
            recaptcha_v2: ".recaptcha-success",
            recaptcha_v3: "[data-token]",
            hcaptcha: ".h-captcha-success",
            image: ".captcha-success"
        };

        try {
            await page.waitForSelector(successIndicators[type], { timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }

    async selectProvider(type) {
        const stats = await this.getProviderStats();
        const available = Object.entries(stats)
            .filter(([_, s]) => s.available && s.types.includes(type))
            .sort((a, b) => b[1].successRate - a[1].successRate);

        return available[0]?.[0] || 'twoCaptcha';
    }

    async getProviderStats() {
        const stats = await this.redis.get('captcha:provider:stats');
        return stats ? JSON.parse(stats) : {
            twoCaptcha: {
                available: true,
                types: ['recaptcha_v2', 'recaptcha_v3', 'hcaptcha', 'image'],
                successRate: 95
            },
            anticaptcha: {
                available: true,
                types: ['recaptcha_v2', 'hcaptcha', 'image'],
                successRate: 90
            }
        };
    }

    async trackAttempt(type, provider, success) {
        const tracking = {
            type,
            provider,
            success,
            timestamp: Date.now()
        };

        await this.redis.multi()
            .hincrby(`captcha:stats:${provider}`, success ? 'success' : 'failure', 1)
            .lpush('captcha:history', JSON.stringify(tracking))
            .ltrim('captcha:history', 0, 999)
            .exec();
    }
}

module.exports = new CaptchaAutomationService();
