const axios = require('axios');
const apiConfig = require('../config/api-integrations.config');
const Redis = require('ioredis');

class EmailVerificationService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.apiKey = apiConfig.rapidApiKey;
        this.endpoints = {
            logValid: {
                host: 'log-valid.p.rapidapi.com',
                verify: '/verify',
                check: '/check'
            },
            disposable: {
                host: 'disposable-emails.p.rapidapi.com',
                check: '/check'
            }
        };
        
        // Email domain patterns
        this.patterns = {
            trial: "trial_{service}_{random}@{domain}",
            temp: "temp_{timestamp}_{random}@{domain}",
            custom: "{username}_{service}@{domain}"
        };

        // Trusted domains
        this.trustedDomains = [
            'gmail.com',
            'outlook.com',
            'yahoo.com',
            'protonmail.com'
        ];
    }

    async generateTrialEmail(service, options = {}) {
        try {
            // Generate email based on pattern
            const email = await this.createEmail(service, options);
            
            // Verify email validity
            await this.verifyEmail(email);
            
            // Store email for tracking
            await this.trackEmail(email, service);

            return email;
        } catch (error) {
            console.error('Email generation error:', error);
            throw error;
        }
    }

    async createEmail(service, options) {
        const pattern = options.pattern || this.patterns.trial;
        const domain = options.domain || this.getRandomDomain();
        
        const variables = {
            service: service.name.toLowerCase().replace(/\s+/g, ''),
            random: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
            domain,
            username: options.username
        };

        return this.replacePlaceholders(pattern, variables);
    }

    async verifyEmail(email) {
        try {
            // Check with LogValid API
            const response = await axios.post(
                `https://${this.endpoints.logValid.host}${this.endpoints.logValid.verify}`,
                { email },
                {
                    headers: {
                        'X-RapidAPI-Key': this.apiKey,
                        'X-RapidAPI-Host': this.endpoints.logValid.host
                    }
                }
            );

            if (!response.data.valid) {
                throw new Error('Invalid email format or domain');
            }

            // Check if disposable
            const isDisposable = await this.isDisposableEmail(email);
            if (isDisposable) {
                throw new Error('Disposable email domains not allowed');
            }

            return true;
        } catch (error) {
            console.error('Email verification error:', error);
            throw error;
        }
    }

    async isDisposableEmail(email) {
        const domain = email.split('@')[1];
        
        // Check cache first
        const cached = await this.redis.hget('disposable:domains', domain);
        if (cached) return cached === 'true';

        try {
            const response = await axios.get(
                `https://${this.endpoints.disposable.host}${this.endpoints.disposable.check}`,
                {
                    params: { domain },
                    headers: {
                        'X-RapidAPI-Key': this.apiKey,
                        'X-RapidAPI-Host': this.endpoints.disposable.host
                    }
                }
            );

            const isDisposable = response.data.disposable;
            
            // Cache result
            await this.redis.hset('disposable:domains', domain, isDisposable.toString());
            
            return isDisposable;
        } catch (error) {
            console.error('Disposable check error:', error);
            return true; // Assume disposable on error
        }
    }

    async trackEmail(email, service) {
        const tracking = {
            email,
            service: service.name,
            generated: Date.now(),
            pattern: this.detectPattern(email)
        };

        await this.redis.multi()
            .lpush('emails:history', JSON.stringify(tracking))
            .ltrim('emails:history', 0, 999) // Keep last 1000 emails
            .sadd(`service:${service.name}:emails`, email)
            .exec();
    }

    detectPattern(email) {
        const patterns = Object.entries(this.patterns);
        for (const [name, pattern] of patterns) {
            const regex = this.patternToRegex(pattern);
            if (regex.test(email)) return name;
        }
        return 'custom';
    }

    patternToRegex(pattern) {
        return new RegExp(
            pattern
                .replace(/\./g, '\\.')
                .replace(/{service}/g, '[a-z0-9]+')
                .replace(/{random}/g, '[a-z0-9]+')
                .replace(/{timestamp}/g, '\\d+')
                .replace(/{domain}/g, '[a-z0-9-.]+')
                .replace(/{username}/g, '[a-z0-9_]+')
        );
    }

    getRandomDomain() {
        return this.trustedDomains[
            Math.floor(Math.random() * this.trustedDomains.length)
        ];
    }

    replacePlaceholders(pattern, variables) {
        return pattern.replace(
            /{(\w+)}/g,
            (match, key) => variables[key] || match
        );
    }

    async validateEmailFormat(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    async checkEmailDomain(domain) {
        try {
            // Check domain MX records
            const response = await axios.post(
                `https://${this.endpoints.logValid.host}${this.endpoints.logValid.check}`,
                { domain },
                {
                    headers: {
                        'X-RapidAPI-Key': this.apiKey,
                        'X-RapidAPI-Host': this.endpoints.logValid.host
                    }
                }
            );

            return {
                valid: response.data.valid,
                hasMX: response.data.hasMX,
                disposable: response.data.disposable
            };
        } catch (error) {
            console.error('Domain check error:', error);
            return { valid: false, hasMX: false, disposable: true };
        }
    }

    async getEmailStats(service) {
        const emails = await this.redis.smembers(`service:${service.name}:emails`);
        const history = await this.redis.lrange('emails:history', 0, -1);
        
        return {
            total: emails.length,
            patterns: this.analyzePatterns(history),
            domains: this.analyzeDomains(emails)
        };
    }

    analyzePatterns(history) {
        return history
            .map(h => JSON.parse(h))
            .reduce((acc, { pattern }) => {
                acc[pattern] = (acc[pattern] || 0) + 1;
                return acc;
            }, {});
    }

    analyzeDomains(emails) {
        return emails
            .map(email => email.split('@')[1])
            .reduce((acc, domain) => {
                acc[domain] = (acc[domain] || 0) + 1;
                return acc;
            }, {});
    }
}

module.exports = new EmailVerificationService();
