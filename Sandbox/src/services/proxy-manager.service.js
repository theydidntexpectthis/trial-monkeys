const Redis = require('ioredis');
const axios = require('axios');
const apiConfig = require('../config/api-integrations.config');

class ProxyManagerService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.providers = {
            brightData: {
                baseUrl: 'https://bright-data.p.rapidapi.com',
                headers: {
                    'X-RapidAPI-Key': apiConfig.rapidApiKey,
                    'X-RapidAPI-Host': 'bright-data.p.rapidapi.com'
                }
            },
            scrapeNinja: {
                baseUrl: 'https://scrape-ninja.p.rapidapi.com',
                headers: {
                    'X-RapidAPI-Key': apiConfig.rapidApiKey,
                    'X-RapidAPI-Host': 'scrape-ninja.p.rapidapi.com'
                }
            }
        };
        
        // Proxy types and their configs
        this.proxyTypes = {
            residential: {
                rotationInterval: 300, // 5 minutes
                countryPriority: ['US', 'GB', 'CA', 'AU'],
                maxRetries: 3
            },
            datacenter: {
                rotationInterval: 600, // 10 minutes
                countryPriority: ['US', 'GB', 'DE', 'FR'],
                maxRetries: 5
            }
        };
    }

    async getProxy(service, options = {}) {
        try {
            // Determine best proxy type for service
            const proxyType = await this.determineProxyType(service);
            
            // Get proxy from pool or generate new one
            const proxy = await this.getOptimalProxy(proxyType, service);
            
            // Track proxy usage
            await this.trackProxyUsage(proxy.id, service);

            return proxy;
        } catch (error) {
            console.error('Proxy acquisition error:', error);
            throw error;
        }
    }

    async determineProxyType(service) {
        const servicePatterns = {
            streaming: 'residential',
            banking: 'residential',
            social: 'residential',
            default: 'datacenter'
        };

        return servicePatterns[service.category] || servicePatterns.default;
    }

    async getOptimalProxy(type, service) {
        // Check proxy pool first
        const pooledProxy = await this.getFromPool(type, service);
        if (pooledProxy) return pooledProxy;

        // Generate new proxy if none available
        return await this.generateNewProxy(type, service);
    }

    async getFromPool(type, service) {
        const poolKey = `proxy:pool:${type}`;
        const proxyId = await this.redis.srandmember(poolKey);

        if (proxyId) {
            const proxy = await this.getProxyDetails(proxyId);
            if (await this.isProxyValid(proxy)) {
                return proxy;
            }
            // Remove invalid proxy from pool
            await this.redis.srem(poolKey, proxyId);
        }

        return null;
    }

    async generateNewProxy(type, service) {
        const config = this.proxyTypes[type];
        const provider = await this.selectProxyProvider(type);

        const proxy = await this.requestNewProxy(provider, {
            type,
            country: this.selectCountry(config.countryPriority),
            session: Date.now().toString()
        });

        // Add to pool
        await this.addToPool(proxy);

        return proxy;
    }

    async requestNewProxy(provider, options) {
        const response = await axios.post(
            `${this.providers[provider].baseUrl}/proxy/generate`,
            options,
            { headers: this.providers[provider].headers }
        );

        return {
            id: `proxy_${Date.now()}`,
            provider,
            host: response.data.host,
            port: response.data.port,
            username: response.data.username,
            password: response.data.password,
            type: options.type,
            country: options.country,
            created: new Date(),
            lastUsed: null,
            successRate: 100
        };
    }

    async addToPool(proxy) {
        const poolKey = `proxy:pool:${proxy.type}`;
        const detailsKey = `proxy:details:${proxy.id}`;

        await this.redis.multi()
            .sadd(poolKey, proxy.id)
            .hmset(detailsKey, {
                ...proxy,
                created: proxy.created.toISOString(),
                lastUsed: proxy.lastUsed?.toISOString() || null
            })
            .exec();
    }

    async getProxyDetails(proxyId) {
        const details = await this.redis.hgetall(`proxy:details:${proxyId}`);
        return details ? {
            ...details,
            created: new Date(details.created),
            lastUsed: details.lastUsed ? new Date(details.lastUsed) : null
        } : null;
    }

    async isProxyValid(proxy) {
        if (!proxy) return false;

        // Check if proxy is too old
        const age = Date.now() - proxy.created.getTime();
        if (age > 24 * 60 * 60 * 1000) return false; // 24 hours

        // Check success rate
        if (parseFloat(proxy.successRate) < 80) return false;

        // Test proxy connectivity
        return await this.testProxy(proxy);
    }

    async testProxy(proxy) {
        try {
            const response = await axios.get('https://api.ipify.org?format=json', {
                proxy: {
                    host: proxy.host,
                    port: proxy.port,
                    auth: {
                        username: proxy.username,
                        password: proxy.password
                    }
                },
                timeout: 5000
            });

            return response.status === 200;
        } catch {
            return false;
        }
    }

    async trackProxyUsage(proxyId, service) {
        const key = `proxy:usage:${proxyId}`;
        const usage = {
            timestamp: Date.now(),
            service: service.name,
            success: true
        };

        await this.redis.multi()
            .hset(`proxy:details:${proxyId}`, 'lastUsed', new Date().toISOString())
            .lpush(key, JSON.stringify(usage))
            .ltrim(key, 0, 99) // Keep last 100 usage records
            .exec();
    }

    async updateProxyStatus(proxyId, success) {
        const details = await this.getProxyDetails(proxyId);
        if (!details) return;

        const newSuccessRate = this.calculateNewSuccessRate(
            parseFloat(details.successRate),
            success
        );

        await this.redis.hset(
            `proxy:details:${proxyId}`,
            'successRate',
            newSuccessRate.toString()
        );

        // Remove proxy if success rate too low
        if (newSuccessRate < 50) {
            await this.removeProxy(proxyId);
        }
    }

    async removeProxy(proxyId) {
        const proxy = await this.getProxyDetails(proxyId);
        if (!proxy) return;

        await this.redis.multi()
            .srem(`proxy:pool:${proxy.type}`, proxyId)
            .del(`proxy:details:${proxyId}`)
            .del(`proxy:usage:${proxyId}`)
            .exec();
    }

    selectCountry(priorities) {
        return priorities[Math.floor(Math.random() * priorities.length)];
    }

    async selectProxyProvider(type) {
        const stats = await this.getProviderStats();
        const available = Object.entries(stats)
            .filter(([_, s]) => s.available && s.types.includes(type))
            .sort((a, b) => b[1].successRate - a[1].successRate);

        return available[0]?.[0] || 'brightData';
    }

    async getProviderStats() {
        const stats = await this.redis.get('proxy:provider:stats');
        return stats ? JSON.parse(stats) : {
            brightData: {
                available: true,
                types: ['residential', 'datacenter'],
                successRate: 95
            },
            scrapeNinja: {
                available: true,
                types: ['datacenter'],
                successRate: 90
            }
        };
    }

    calculateNewSuccessRate(currentRate, success) {
        const weight = 0.9; // Weight for historical data
        return (currentRate * weight) + (success ? (1 - weight) * 100 : 0);
    }
}

module.exports = new ProxyManagerService();
