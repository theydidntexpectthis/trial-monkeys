const Redis = require('ioredis');
const apiConfig = require('../config/api-integrations.config');

class ApiKeyManagerService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.mainApiKey = 'd42dbed423mshd69f27217e2311bp11bd5cjsnc2b55ca495da';
        
        // Rate limit configurations
        this.limits = {
            default: {
                requests: 100,
                period: 60 // seconds
            },
            critical: {
                requests: 50,
                period: 60
            }
        };

        // Service categories
        this.serviceCategories = {
            critical: ['captcha', 'email', 'payment'],
            default: ['proxy', 'scraping', 'browser']
        };

        // Initialize monitoring
        this.initializeMonitoring();
    }

    async getApiKey(service) {
        try {
            // Check if service has dedicated key
            const dedicatedKey = await this.getDedicatedKey(service);
            if (dedicatedKey) return dedicatedKey;

            // Get optimal key based on usage and limits
            const key = await this.getOptimalKey(service);
            if (!key) throw new Error('No available API keys');

            // Track usage
            await this.trackKeyUsage(key, service);

            return key;
        } catch (error) {
            console.error('API key error:', error);
            throw error;
        }
    }

    async getDedicatedKey(service) {
        const dedicatedKeys = await this.redis.hgetall('api:dedicated_keys');
        return dedicatedKeys[service];
    }

    async getOptimalKey(service) {
        const category = this.getServiceCategory(service);
        const keys = await this.getAvailableKeys(category);

        // Sort by usage and select least used key
        const keyUsage = await Promise.all(
            keys.map(async key => ({
                key,
                usage: await this.getKeyUsage(key)
            }))
        );

        const optimalKey = keyUsage
            .filter(k => k.usage.remaining > 0)
            .sort((a, b) => b.usage.remaining - a.usage.remaining)[0];

        return optimalKey?.key || this.mainApiKey;
    }

    async getKeyUsage(key) {
        const period = this.getPeriod();
        const usage = await this.redis.get(`api:usage:${key}:${period}`);
        const limit = this.getKeyLimit(key);

        return {
            used: parseInt(usage || 0),
            limit: limit.requests,
            remaining: limit.requests - (parseInt(usage || 0)),
            resetIn: this.getResetTime(period)
        };
    }

    async trackKeyUsage(key, service) {
        const period = this.getPeriod();
        const multi = this.redis.multi();

        // Increment usage counter
        multi.incr(`api:usage:${key}:${period}`);

        // Track service usage
        multi.hincrby(`api:service_usage:${service}`, period, 1);

        // Store request timestamp
        multi.lpush(`api:requests:${key}`, Date.now());
        multi.ltrim(`api:requests:${key}`, 0, 999); // Keep last 1000 requests

        await multi.exec();
    }

    async addApiKey(key, category = 'default') {
        await this.redis.hset('api:keys', key, category);
        await this.redis.sadd(`api:category:${category}`, key);
    }

    async removeApiKey(key) {
        const category = await this.redis.hget('api:keys', key);
        if (category) {
            await this.redis.hdel('api:keys', key);
            await this.redis.srem(`api:category:${category}`, key);
        }
    }

    async getAvailableKeys(category) {
        const keys = await this.redis.smembers(`api:category:${category}`);
        return [...keys, this.mainApiKey];
    }

    getServiceCategory(service) {
        return this.serviceCategories.critical.includes(service)
            ? 'critical'
            : 'default';
    }

    getKeyLimit(key) {
        return this.limits[
            key === this.mainApiKey ? 'critical' : 'default'
        ];
    }

    getPeriod() {
        return Math.floor(Date.now() / 1000 / 60); // Current minute
    }

    getResetTime(period) {
        return (period + 1) * 60 * 1000 - Date.now();
    }

    async initializeMonitoring() {
        setInterval(async () => {
            await this.monitorKeyUsage();
        }, 60000); // Check every minute
    }

    async monitorKeyUsage() {
        const keys = await this.redis.hkeys('api:keys');
        const usage = await Promise.all(
            keys.map(async key => ({
                key,
                usage: await this.getKeyUsage(key)
            }))
        );

        // Alert on high usage
        usage.forEach(({ key, usage }) => {
            if (usage.remaining < usage.limit * 0.2) {
                this.alertHighUsage(key, usage);
            }
        });

        // Store metrics
        await this.storeMetrics(usage);
    }

    async alertHighUsage(key, usage) {
        const alert = {
            key,
            timestamp: Date.now(),
            usage,
            severity: usage.remaining < usage.limit * 0.1 ? 'high' : 'medium'
        };

        await this.redis.lpush('api:alerts', JSON.stringify(alert));
    }

    async storeMetrics(usage) {
        const metrics = {
            timestamp: Date.now(),
            usage: usage.reduce((acc, { key, usage }) => {
                acc[key] = usage;
                return acc;
            }, {})
        };

        await this.redis.lpush('api:metrics', JSON.stringify(metrics));
        await this.redis.ltrim('api:metrics', 0, 999); // Keep last 1000 metrics
    }

    async getMetrics(period = '24h') {
        const metrics = await this.redis.lrange('api:metrics', 0, -1);
        const cutoff = Date.now() - this.periodToMs(period);

        return metrics
            .map(m => JSON.parse(m))
            .filter(m => m.timestamp > cutoff);
    }

    async getServiceMetrics(service, period = '24h') {
        const usage = await this.redis.hgetall(`api:service_usage:${service}`);
        const cutoff = this.getPeriod() - this.periodToMinutes(period);

        return Object.entries(usage)
            .filter(([period]) => parseInt(period) > cutoff)
            .reduce((acc, [period, requests]) => {
                acc[period] = parseInt(requests);
                return acc;
            }, {});
    }

    periodToMs(period) {
        const units = {
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000
        };
        const [value, unit] = period.match(/(\d+)([hd])/).slice(1);
        return parseInt(value) * units[unit];
    }

    periodToMinutes(period) {
        const [value, unit] = period.match(/(\d+)([hd])/).slice(1);
        return parseInt(value) * (unit === 'h' ? 60 : 24 * 60);
    }
}

module.exports = new ApiKeyManagerService();
