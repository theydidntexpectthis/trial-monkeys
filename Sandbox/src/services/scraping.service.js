const axios = require('axios');
const config = require('../config/services.config');

class ScrapingService {
    constructor() {
        this.rapidApiKey = config.rapidApi.key;
        this.services = {
            scrapingAnt: {
                baseUrl: 'https://scraping-ant.p.rapidapi.com',
                headers: {
                    'X-RapidAPI-Key': this.rapidApiKey,
                    'X-RapidAPI-Host': 'scraping-ant.p.rapidapi.com'
                }
            },
            scrapeNinja: {
                baseUrl: 'https://scrape-ninja.p.rapidapi.com',
                headers: {
                    'X-RapidAPI-Key': this.rapidApiKey,
                    'X-RapidAPI-Host': 'scrape-ninja.p.rapidapi.com'
                }
            },
            scrappey: {
                baseUrl: 'https://scrappey.com/api/v1',
                headers: {
                    'Authorization': process.env.SCRAPPEY_API_KEY
                }
            }
        };
    }

    async scrapeTrialPage(url, options = {}) {
        // Select optimal scraping service based on URL and requirements
        const service = await this.selectScrapingService(url);
        
        try {
            const data = await this.executeScrape(service, url, options);
            await this.validateScrapedData(data);
            return this.extractTrialInfo(data);
        } catch (error) {
            console.error(`Scraping error (${service}):`, error);
            // Fallback to alternative service if primary fails
            return this.fallbackScrape(url, options, service);
        }
    }

    async selectScrapingService(url) {
        const urlPatterns = {
            cloudflare: /cloudflare|cf-/i,
            akamai: /akamai|akam/i,
            javascript: /<script>|document\.getElementById/i
        };

        // Check URL protection patterns
        const pageContent = await this.getInitialContent(url);
        
        if (urlPatterns.cloudflare.test(pageContent)) {
            return 'scrapeNinja'; // Best for Cloudflare
        } else if (urlPatterns.akamai.test(pageContent)) {
            return 'scrapingAnt'; // Best for Akamai
        } else if (urlPatterns.javascript.test(pageContent)) {
            return 'scrappey'; // Best for JavaScript rendering
        }

        return 'scrapingAnt'; // Default service
    }

    async executeScrape(service, url, options) {
        const serviceConfig = this.services[service];
        const defaultOptions = {
            javascript: true,
            proxy: true,
            cookies: true
        };

        const requestOptions = {
            ...defaultOptions,
            ...options
        };

        const response = await axios.post(`${serviceConfig.baseUrl}/scrape`, {
            url,
            ...requestOptions
        }, {
            headers: serviceConfig.headers
        });

        return response.data;
    }

    async validateScrapedData(data) {
        const requiredFields = ['content', 'status', 'url'];
        const missingFields = requiredFields.filter(field => !data[field]);

        if (missingFields.length > 0) {
            throw new Error(`Invalid scrape data. Missing fields: ${missingFields.join(', ')}`);
        }

        return true;
    }

    extractTrialInfo(data) {
        const trialPatterns = {
            signupForm: {
                selectors: [
                    'form[action*="sign-up"]',
                    'form[action*="register"]',
                    'form[action*="trial"]'
                ]
            },
            trialButtons: {
                selectors: [
                    'a[href*="trial"]',
                    'button:contains("Try")',
                    'button:contains("Start Trial")'
                ]
            },
            pricingInfo: {
                selectors: [
                    '.pricing',
                    '#pricing',
                    '[data-testid*="price"]'
                ]
            }
        };

        return {
            signupUrl: this.findSignupUrl(data.content, trialPatterns),
            formFields: this.extractFormFields(data.content),
            trialDuration: this.extractTrialDuration(data.content),
            requirements: this.extractRequirements(data.content)
        };
    }

    findSignupUrl(content, patterns) {
        // Implementation to find the signup URL from content
        const signupUrls = [];
        patterns.signupForm.selectors.forEach(selector => {
            const match = content.match(new RegExp(`action=["'](.*?)["']`));
            if (match) signupUrls.push(match[1]);
        });

        return signupUrls[0] || null;
    }

    extractFormFields(content) {
        const formFields = [];
        const fieldPatterns = [
            { type: 'email', pattern: /<input[^>]*type=["']email["'][^>]*>/g },
            { type: 'password', pattern: /<input[^>]*type=["']password["'][^>]*>/g },
            { type: 'text', pattern: /<input[^>]*type=["']text["'][^>]*>/g }
        ];

        fieldPatterns.forEach(({ type, pattern }) => {
            const matches = content.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const name = match.match(/name=["'](.*?)["']/);
                    formFields.push({
                        type,
                        name: name ? name[1] : null,
                        required: match.includes('required')
                    });
                });
            }
        });

        return formFields;
    }

    extractTrialDuration(content) {
        const durationPatterns = [
            /(\d+)[-\s]?day trial/i,
            /free for (\d+) days/i,
            /trial period: (\d+) days/i
        ];

        for (const pattern of durationPatterns) {
            const match = content.match(pattern);
            if (match) {
                return parseInt(match[1]);
            }
        }

        return null;
    }

    extractRequirements(content) {
        return {
            creditCard: this.hasRequirement(content, ['credit card', 'payment method']),
            phoneNumber: this.hasRequirement(content, ['phone', 'mobile number']),
            emailVerification: this.hasRequirement(content, ['verify email', 'confirmation link']),
            captcha: this.hasRequirement(content, ['captcha', 'recaptcha', 'verify you are human'])
        };
    }

    hasRequirement(content, keywords) {
        return keywords.some(keyword => 
            new RegExp(keyword, 'i').test(content)
        );
    }

    async fallbackScrape(url, options, failedService) {
        const services = Object.keys(this.services)
            .filter(s => s !== failedService);

        for (const service of services) {
            try {
                return await this.executeScrape(service, url, options);
            } catch (error) {
                console.error(`Fallback scraping error (${service}):`, error);
            }
        }

        throw new Error('All scraping services failed');
    }

    async getInitialContent(url) {
        try {
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            return '';
        }
    }
}

module.exports = new ScrapingService();
