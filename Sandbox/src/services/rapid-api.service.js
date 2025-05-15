const axios = require('axios');
const config = require('../config/services.config');

class RapidApiService {
    constructor() {
        this.apiKey = 'd42dbed423mshd69f27217e2311bp11bd5cjsnc2b55ca495da';
        this.services = {
            scrapeNinja: {
                host: 'scrape-ninja.p.rapidapi.com',
                endpoints: {
                    scrape: '/scrape',
                    browser: '/browser'
                }
            },
            scrapingAnt: {
                host: 'scraping-ant.p.rapidapi.com',
                endpoints: {
                    html: '/html',
                    js: '/js'
                }
            },
            twoCaptcha: {
                host: '2captcha.p.rapidapi.com',
                endpoints: {
                    solve: '/solve',
                    balance: '/balance'
                }
            },
            logValid: {
                host: 'log-valid.p.rapidapi.com',
                endpoints: {
                    verify: '/verify',
                    validate: '/validate'
                }
            },
            bypassAkamai: {
                host: 'bypass-akamai.p.rapidapi.com',
                endpoints: {
                    bypass: '/bypass',
                    cookies: '/cookies'
                }
            },
            cloudflareBypass: {
                host: 'cloudflare-bypass.p.rapidapi.com',
                endpoints: {
                    bypass: '/bypass',
                    tokens: '/tokens'
                }
            },
            ephemeralProxies: {
                host: 'ephemeral-proxies.p.rapidapi.com',
                endpoints: {
                    generate: '/generate',
                    status: '/status'
                }
            }
        };
    }

    async makeRequest(service, endpoint, options = {}) {
        const serviceConfig = this.services[service];
        if (!serviceConfig) throw new Error(`Service ${service} not configured`);

        const url = `https://${serviceConfig.host}${serviceConfig.endpoints[endpoint]}`;
        
        try {
            const response = await axios({
                ...options,
                url,
                headers: {
                    ...options.headers,
                    'X-RapidAPI-Key': this.apiKey,
                    'X-RapidAPI-Host': serviceConfig.host
                }
            });

            await this.trackApiUsage(service, endpoint, response.status === 200);
            return response.data;
        } catch (error) {
            await this.handleApiError(service, endpoint, error);
            throw error;
        }
    }

    // Scraping Services
    async scrapePage(url, options = {}) {
        const service = await this.selectOptimalScrapingService(url);
        return this.makeRequest(service, 'scrape', {
            method: 'POST',
            data: { url, ...options }
        });
    }

    async bypassProtection(url, type = 'akamai') {
        const service = type === 'akamai' ? 'bypassAkamai' : 'cloudflareBypass';
        return this.makeRequest(service, 'bypass', {
            method: 'POST',
            data: { url }
        });
    }

    // CAPTCHA Solving
    async solveCaptcha(type, data) {
        return this.makeRequest('twoCaptcha', 'solve', {
            method: 'POST',
            data: { type, ...data }
        });
    }

    // Email Verification
    async verifyEmail(email) {
        return this.makeRequest('logValid', 'verify', {
            method: 'POST',
            data: { email }
        });
    }

    // Proxy Management
    async getEphemeralProxy(options = {}) {
        return this.makeRequest('ephemeralProxies', 'generate', {
            method: 'POST',
            data: options
        });
    }

    // Service Selection Logic
    async selectOptimalScrapingService(url) {
        const testResults = await Promise.allSettled([
            this.testService('scrapeNinja', url),
            this.testService('scrapingAnt', url)
        ]);

        const successfulServices = testResults
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);

        return successfulServices[0]?.service || 'scrapeNinja';
    }

    async testService(service, url) {
        try {
            const startTime = Date.now();
            await this.makeRequest(service, 'scrape', {
                method: 'POST',
                data: { url, test: true }
            });
            const responseTime = Date.now() - startTime;

            return {
                service,
                responseTime,
                success: true
            };
        } catch (error) {
            return {
                service,
                success: false,
                error: error.message
            };
        }
    }

    // Usage Tracking
    async trackApiUsage(service, endpoint, success) {
        const key = `api_usage:${service}:${endpoint}`;
        const now = Date.now();

        try {
            await Promise.all([
                this.redis.hincrby(key, 'total', 1),
                this.redis.hincrby(key, success ? 'success' : 'failed', 1),
                this.redis.zadd('api_calls', now, JSON.stringify({
                    service,
                    endpoint,
                    success,
                    timestamp: now
                }))
            ]);
        } catch (error) {
            console.error('Error tracking API usage:', error);
        }
    }

    // Error Handling
    async handleApiError(service, endpoint, error) {
        const errorData = {
            service,
            endpoint,
            error: error.message,
            timestamp: Date.now()
        };

        // Log error
        console.error('RapidAPI Error:', errorData);

        // Store error for analysis
        await this.redis.lpush('api_errors', JSON.stringify(errorData));

        // Update service status
        await this.updateServiceStatus(service, false);

        // Implement exponential backoff
        await this.implementBackoff(service);
    }

    async updateServiceStatus(service, isOperational) {
        const key = `service_status:${service}`;
        await this.redis.hset(key, {
            operational: isOperational ? 1 : 0,
            lastUpdate: Date.now()
        });
    }

    async implementBackoff(service) {
        const key = `backoff:${service}`;
        const attempts = await this.redis.incr(key);
        const backoffTime = Math.min(Math.pow(2, attempts) * 1000, 30000);
        
        await this.redis.expire(key, 3600); // Reset after 1 hour
        return new Promise(resolve => setTimeout(resolve, backoffTime));
    }

    // Service Health Check
    async checkServicesHealth() {
        const healthChecks = Object.keys(this.services).map(async service => {
            try {
                await this.testService(service, 'https://example.com');
                return { service, status: 'operational' };
            } catch (error) {
                return { service, status: 'down', error: error.message };
            }
        });

        return Promise.all(healthChecks);
    }
}

module.exports = new RapidApiService();
