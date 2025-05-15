const axios = require('axios');
const config = require('../config/config');

class ProxyService {
    constructor() {
        this.proxyPool = new Map();
        this.proxyStats = new Map();
        this.brightDataConfig = config.brightData;
        this.initializeProxyPool();
    }

    // Initialize proxy pool
    async initializeProxyPool() {
        try {
            // Initialize different proxy types
            await Promise.all([
                this.initializeProxyType('browser'),
                this.initializeProxyType('datacenter'),
                this.initializeProxyType('residential')
            ]);

            // Start proxy rotation and health checks
            setInterval(() => this.rotateProxies(), 300000); // every 5 minutes
            setInterval(() => this.checkProxyHealth(), 600000); // every 10 minutes
        } catch (error) {
            console.error('Failed to initialize proxy pool:', error);
        }
    }

    // Initialize specific proxy type
    async initializeProxyType(type) {
        const proxyList = [];
        const count = this.getProxyCountForType(type);

        for (let i = 0; i < count; i++) {
            const proxy = await this.createBrightDataProxy(type);
            proxyList.push(proxy);
        }

        this.proxyPool.set(type, proxyList);
    }

    // Create Bright Data proxy
    async createBrightDataProxy(type) {
        const sessionId = this.generateSessionId();
        
        return {
            id: sessionId,
            type,
            host: this.brightDataConfig.host,
            port: this.brightDataConfig.port,
            auth: {
                username: `${this.brightDataConfig.username}-session-${sessionId}`,
                password: this.brightDataConfig.password
            },
            created: new Date(),
            lastUsed: null,
            status: 'active',
            failCount: 0
        };
    }

    // Get proxy for specific use case
    async getProxy(options = {}) {
        try {
            const {
                type = 'browser',
                country = null,
                session = null,
                forceNew = false
            } = options;

            // Get proxy pool for type
            const proxyPool = this.proxyPool.get(type);
            if (!proxyPool || proxyPool.length === 0) {
                throw new Error(`No proxies available for type: ${type}`);
            }

            let proxy;

            if (session && !forceNew) {
                // Try to find existing session proxy
                proxy = this.findSessionProxy(type, session);
            }

            if (!proxy) {
                // Get least used proxy or create new one
                proxy = this.getLeastUsedProxy(type);
                
                if (!proxy || forceNew) {
                    proxy = await this.createBrightDataProxy(type);
                    proxyPool.push(proxy);
                }
            }

            // Update proxy stats
            this.updateProxyStats(proxy.id);
            proxy.lastUsed = new Date();

            return this.formatProxyConfig(proxy, country);
        } catch (error) {
            console.error('Failed to get proxy:', error);
            throw error;
        }
    }

    // Format proxy configuration
    formatProxyConfig(proxy, country = null) {
        let username = proxy.auth.username;
        
        if (country) {
            username += `-country-${country}`;
        }

        return {
            host: proxy.host,
            port: proxy.port,
            auth: {
                username,
                password: proxy.auth.password
            },
            type: proxy.type,
            sessionId: proxy.id
        };
    }

    // Find proxy by session ID
    findSessionProxy(type, sessionId) {
        const proxyPool = this.proxyPool.get(type);
        return proxyPool.find(proxy => proxy.id === sessionId);
    }

    // Get least used proxy
    getLeastUsedProxy(type) {
        const proxyPool = this.proxyPool.get(type);
        return proxyPool.reduce((least, current) => {
            const leastUsage = this.getProxyUsage(least.id);
            const currentUsage = this.getProxyUsage(current.id);
            return currentUsage < leastUsage ? current : least;
        });
    }

    // Update proxy usage statistics
    updateProxyStats(proxyId) {
        const stats = this.proxyStats.get(proxyId) || {
            totalUsage: 0,
            successCount: 0,
            failureCount: 0,
            lastUsed: null
        };

        stats.totalUsage++;
        stats.lastUsed = new Date();
        this.proxyStats.set(proxyId, stats);
    }

    // Record proxy success/failure
    async recordProxyResult(proxyId, success) {
        const stats = this.proxyStats.get(proxyId);
        if (stats) {
            if (success) {
                stats.successCount++;
            } else {
                stats.failureCount++;
                
                // Check if proxy needs to be rotated
                const proxy = this.findProxyById(proxyId);
                if (proxy) {
                    proxy.failCount++;
                    if (proxy.failCount >= 3) {
                        await this.rotateProxy(proxy);
                    }
                }
            }
        }
    }

    // Rotate proxies
    async rotateProxies() {
        for (const [type, proxyPool] of this.proxyPool.entries()) {
            const rotationNeeded = proxyPool.filter(proxy => 
                this.shouldRotateProxy(proxy)
            );

            for (const proxy of rotationNeeded) {
                await this.rotateProxy(proxy);
            }
        }
    }

    // Check if proxy should be rotated
    shouldRotateProxy(proxy) {
        const stats = this.proxyStats.get(proxy.id);
        if (!stats) return false;

        const hoursSinceCreation = (Date.now() - proxy.created) / (1000 * 60 * 60);
        const failureRate = stats.failureCount / (stats.totalUsage || 1);

        return (
            hoursSinceCreation > 24 || // Rotate after 24 hours
            failureRate > 0.3 || // Rotate if failure rate > 30%
            proxy.failCount >= 3 // Rotate after 3 consecutive failures
        );
    }

    // Rotate specific proxy
    async rotateProxy(proxy) {
        try {
            const type = proxy.type;
            const proxyPool = this.proxyPool.get(type);
            
            // Remove old proxy
            const index = proxyPool.findIndex(p => p.id === proxy.id);
            if (index !== -1) {
                proxyPool.splice(index, 1);
            }

            // Create new proxy
            const newProxy = await this.createBrightDataProxy(type);
            proxyPool.push(newProxy);

            // Clean up stats
            this.proxyStats.delete(proxy.id);

            return newProxy;
        } catch (error) {
            console.error('Failed to rotate proxy:', error);
            throw error;
        }
    }

    // Check proxy health
    async checkProxyHealth() {
        const testUrl = 'https://api.ipify.org?format=json';

        for (const [type, proxyPool] of this.proxyPool.entries()) {
            for (const proxy of proxyPool) {
                try {
                    const proxyConfig = this.formatProxyConfig(proxy);
                    await this.testProxy(testUrl, proxyConfig);
                    
                    proxy.status = 'active';
                    proxy.failCount = 0;
                } catch (error) {
                    console.error(`Proxy health check failed for ${proxy.id}:`, error);
                    proxy.failCount++;

                    if (proxy.failCount >= 3) {
                        await this.rotateProxy(proxy);
                    }
                }
            }
        }
    }

    // Test proxy connection
    async testProxy(url, proxyConfig) {
        try {
            const response = await axios.get(url, {
                proxy: {
                    host: proxyConfig.host,
                    port: proxyConfig.port,
                    auth: {
                        username: proxyConfig.auth.username,
                        password: proxyConfig.auth.password
                    }
                },
                timeout: 10000
            });

            return response.status === 200;
        } catch (error) {
            throw new Error(`Proxy test failed: ${error.message}`);
        }
    }

    // Get proxy pool statistics
    getProxyPoolStats() {
        const stats = {};
        
        for (const [type, proxyPool] of this.proxyPool.entries()) {
            stats[type] = {
                total: proxyPool.length,
                active: proxyPool.filter(p => p.status === 'active').length,
                rotated: proxyPool.filter(p => this.shouldRotateProxy(p)).length
            };
        }

        return stats;
    }

    // Helper methods
    generateSessionId() {
        return `s${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    }

    getProxyCountForType(type) {
        const counts = {
            browser: 10,
            datacenter: 20,
            residential: 5
        };
        return counts[type] || 5;
    }

    getProxyUsage(proxyId) {
        const stats = this.proxyStats.get(proxyId);
        return stats ? stats.totalUsage : 0;
    }

    findProxyById(proxyId) {
        for (const proxyPool of this.proxyPool.values()) {
            const proxy = proxyPool.find(p => p.id === proxyId);
            if (proxy) return proxy;
        }
        return null;
    }
}

module.exports = new ProxyService();
