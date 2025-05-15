const crypto = require('crypto');
const Redis = require('ioredis');
const EmailVerificationService = require('./email-verification.service');

class CredentialsManagerService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.emailService = EmailVerificationService;
        
        // Password generation patterns
        this.patterns = {
            lengths: {
                min: 12,
                max: 16
            },
            components: {
                uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                lowercase: 'abcdefghijklmnopqrstuvwxyz',
                numbers: '0123456789',
                symbols: '!@#$%^&*_-+'
            },
            requirements: {
                uppercase: 1,
                lowercase: 1,
                numbers: 1,
                symbols: 1
            }
        };

        // Username patterns
        this.usernames = {
            prefixes: ['user', 'trial', 'temp', 'guest'],
            patterns: [
                '{prefix}_{random}',
                '{prefix}{year}{random}',
                'tm_{random}_{year}'
            ]
        };
    }

    async generateCredentials(service, options = {}) {
        try {
            // Generate unique email
            const email = await this.generateEmail(service);

            // Generate secure password
            const password = this.generatePassword(service);

            // Generate username if required
            const username = options.requiresUsername 
                ? await this.generateUsername(service)
                : null;

            // Store credentials
            const credentials = { email, password, username };
            await this.storeCredentials(service, credentials);

            return credentials;
        } catch (error) {
            console.error('Credentials generation error:', error);
            throw error;
        }
    }

    async generateEmail(service) {
        const attempts = 3;
        let attempt = 0;

        while (attempt < attempts) {
            const email = await this.createEmail(service);
            
            // Verify email validity
            const isValid = await this.emailService.verifyEmail(email);
            if (isValid) return email;

            attempt++;
        }

        throw new Error('Failed to generate valid email');
    }

    async createEmail(service) {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        
        return `trial_${service.name.toLowerCase()}_${random}_${timestamp}@trialmonkeys.com`;
    }

    generatePassword(service) {
        const length = this.getRandomInt(
            this.patterns.lengths.min,
            this.patterns.lengths.max
        );

        // Ensure minimum requirements
        let password = Object.entries(this.patterns.requirements)
            .map(([type, count]) => {
                return this.getRandomChars(
                    this.patterns.components[type],
                    count
                );
            })
            .join('');

        // Fill remaining length with random characters
        while (password.length < length) {
            const type = this.getRandomType();
            password += this.getRandomChars(
                this.patterns.components[type],
                1
            );
        }

        // Shuffle password
        return this.shuffleString(password);
    }

    async generateUsername(service) {
        const prefix = this.usernames.prefixes[
            Math.floor(Math.random() * this.usernames.prefixes.length)
        ];

        const pattern = this.usernames.patterns[
            Math.floor(Math.random() * this.usernames.patterns.length)
        ];

        const random = crypto.randomBytes(4).toString('hex');
        const year = new Date().getFullYear();

        return pattern
            .replace('{prefix}', prefix)
            .replace('{random}', random)
            .replace('{year}', year);
    }

    async storeCredentials(service, credentials) {
        const key = `credentials:${service.name}:${Date.now()}`;
        await this.redis.setex(
            key,
            30 * 24 * 60 * 60, // 30 days
            JSON.stringify(credentials)
        );

        // Track usage
        await this.trackCredentialsUsage(service.name);
    }

    async trackCredentialsUsage(serviceName) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const key = `credentials:usage:${serviceName}:${year}:${month}`;
        await this.redis.hincrby(key, 'total', 1);
    }

    async getCredentialsHistory(serviceName, limit = 10) {
        const pattern = `credentials:${serviceName}:*`;
        const keys = await this.redis.keys(pattern);
        
        const credentials = await Promise.all(
            keys
                .sort((a, b) => b.split(':')[3] - a.split(':')[3])
                .slice(0, limit)
                .map(key => this.redis.get(key))
        );

        return credentials.map(c => JSON.parse(c));
    }

    async checkCredentialsAvailability(credentials) {
        // Check if email is already in use
        const emailKey = `email:${credentials.email}`;
        const emailExists = await this.redis.exists(emailKey);
        if (emailExists) return false;

        // Check if username is already in use (if provided)
        if (credentials.username) {
            const usernameKey = `username:${credentials.username}`;
            const usernameExists = await this.redis.exists(usernameKey);
            if (usernameExists) return false;
        }

        return true;
    }

    async rotateCredentials(service, oldCredentials) {
        // Generate new credentials
        const newCredentials = await this.generateCredentials(service);

        // Store rotation history
        await this.storeRotation(service, oldCredentials, newCredentials);

        return newCredentials;
    }

    async storeRotation(service, oldCredentials, newCredentials) {
        const rotation = {
            service: service.name,
            timestamp: Date.now(),
            old: oldCredentials,
            new: newCredentials
        };

        await this.redis.lpush(
            `credentials:rotations:${service.name}`,
            JSON.stringify(rotation)
        );
    }

    // Helper Methods
    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    getRandomChars(chars, count) {
        let result = '';
        for (let i = 0; i < count; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    getRandomType() {
        const types = Object.keys(this.patterns.components);
        return types[Math.floor(Math.random() * types.length)];
    }

    shuffleString(string) {
        const array = string.split('');
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array.join('');
    }

    async validatePassword(password) {
        // Check length
        if (password.length < this.patterns.lengths.min ||
            password.length > this.patterns.lengths.max) {
            return false;
        }

        // Check requirements
        for (const [type, count] of Object.entries(this.patterns.requirements)) {
            const pattern = new RegExp(`[${this.patterns.components[type]}]`, 'g');
            const matches = password.match(pattern) || [];
            if (matches.length < count) return false;
        }

        return true;
    }

    async getUsageMetrics(serviceName) {
        const now = new Date();
        const metrics = [];

        // Get last 6 months of usage
        for (let i = 0; i < 6; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `credentials:usage:${serviceName}:${date.getFullYear()}:${date.getMonth() + 1}`;
            const usage = await this.redis.hgetall(key);
            
            metrics.push({
                month: date.toLocaleString('default', { month: 'long' }),
                year: date.getFullYear(),
                total: parseInt(usage.total || 0)
            });
        }

        return metrics;
    }
}

module.exports = new CredentialsManagerService();
