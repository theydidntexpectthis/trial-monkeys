const Redis = require('ioredis');
const config = require('../config/config');

class ConfigManagerService {
    constructor() {
        this.redis = new Redis(config.redis.url);
        this.cache = new Map();
        this.featureFlags = new Map();
        this.environments = ['development', 'staging', 'production'];
        
        this.initializeConfigManager();
    }

    // Initialize configuration manager
    async initializeConfigManager() {
        try {
            // Load default configurations
            await this.loadDefaultConfigs();
            
            // Initialize feature flags
            await this.initializeFeatureFlags();
            
            // Start configuration monitoring
            this.startConfigMonitoring();
            
            console.log('Configuration manager initialized');
        } catch (error) {
            console.error('Failed to initialize config manager:', error);
            throw error;
        }
    }

    // Load default configurations
    async loadDefaultConfigs() {
        const defaultConfigs = {
            development: {
                debugMode: true,
                logLevel: 'debug',
                mockServices: true,
                timeouts: {
                    api: 30000,
                    bot: 60000,
                    proxy: 10000
                }
            },
            staging: {
                debugMode: false,
                logLevel: 'info',
                mockServices: false,
                timeouts: {
                    api: 20000,
                    bot: 45000,
                    proxy: 8000
                }
            },
            production: {
                debugMode: false,
                logLevel: 'warn',
                mockServices: false,
                timeouts: {
                    api: 15000,
                    bot: 30000,
                    proxy: 5000
                }
            }
        };

        await this.redis.set('configs', JSON.stringify(defaultConfigs));
        this.cache.set('configs', defaultConfigs);
    }

    // Initialize feature flags
    async initializeFeatureFlags() {
        const defaultFlags = {
            newBotEngine: {
                enabled: false,
                environments: ['development'],
                rolloutPercentage: 0,
                description: 'New bot automation engine'
            },
            enhancedMonitoring: {
                enabled: true,
                environments: ['development', 'staging'],
                rolloutPercentage: 50,
                description: 'Enhanced bot monitoring features'
            },
            proxyRotation: {
                enabled: true,
                environments: ['development', 'staging', 'production'],
                rolloutPercentage: 100,
                description: 'Automatic proxy rotation'
            },
            captchaV2: {
                enabled: false,
                environments: ['development'],
                rolloutPercentage: 0,
                description: 'New CAPTCHA solving system'
            }
        };

        await this.redis.set('featureFlags', JSON.stringify(defaultFlags));
        this.featureFlags = new Map(Object.entries(defaultFlags));
    }

    // Get configuration for environment
    async getConfig(env = process.env.NODE_ENV) {
        try {
            // Check cache first
            if (this.cache.has('configs')) {
                const configs = this.cache.get('configs');
                return configs[env] || configs.development;
            }

            // Load from Redis
            const configs = JSON.parse(await this.redis.get('configs'));
            this.cache.set('configs', configs);
            return configs[env] || configs.development;
        } catch (error) {
            console.error('Failed to get config:', error);
            throw error;
        }
    }

    // Update configuration
    async updateConfig(env, updates) {
        try {
            const configs = JSON.parse(await this.redis.get('configs'));
            configs[env] = {
                ...configs[env],
                ...updates
            };

            await this.redis.set('configs', JSON.stringify(configs));
            this.cache.set('configs', configs);

            // Notify services of config update
            await this.notifyConfigUpdate(env);

            return configs[env];
        } catch (error) {
            console.error('Failed to update config:', error);
            throw error;
        }
    }

    // Check if feature is enabled
    async isFeatureEnabled(featureName, userId = null) {
        try {
            const feature = this.featureFlags.get(featureName);
            if (!feature) return false;

            // Check if feature is enabled for current environment
            if (!feature.enabled) return false;
            if (!feature.environments.includes(process.env.NODE_ENV)) return false;

            // Check rollout percentage
            if (userId && feature.rolloutPercentage < 100) {
                const userHash = this.hashUserId(userId);
                return userHash <= feature.rolloutPercentage;
            }

            return true;
        } catch (error) {
            console.error('Failed to check feature flag:', error);
            return false;
        }
    }

    // Update feature flag
    async updateFeatureFlag(featureName, updates) {
        try {
            const flags = JSON.parse(await this.redis.get('featureFlags'));
            flags[featureName] = {
                ...flags[featureName],
                ...updates
            };

            await this.redis.set('featureFlags', JSON.stringify(flags));
            this.featureFlags = new Map(Object.entries(flags));

            // Notify services of feature flag update
            await this.notifyFeatureFlagUpdate(featureName);

            return flags[featureName];
        } catch (error) {
            console.error('Failed to update feature flag:', error);
            throw error;
        }
    }

    // Start configuration monitoring
    startConfigMonitoring() {
        setInterval(async () => {
            try {
                // Check for configuration updates
                const configs = JSON.parse(await this.redis.get('configs'));
                if (JSON.stringify(configs) !== JSON.stringify(this.cache.get('configs'))) {
                    this.cache.set('configs', configs);
                    await this.notifyConfigUpdate();
                }

                // Check for feature flag updates
                const flags = JSON.parse(await this.redis.get('featureFlags'));
                if (JSON.stringify(flags) !== JSON.stringify(Object.fromEntries(this.featureFlags))) {
                    this.featureFlags = new Map(Object.entries(flags));
                    await this.notifyFeatureFlagUpdate();
                }
            } catch (error) {
                console.error('Config monitoring error:', error);
            }
        }, 60000); // Check every minute
    }

    // Notify services of configuration update
    async notifyConfigUpdate(env = null) {
        try {
            const notification = {
                type: 'config_update',
                environment: env || 'all',
                timestamp: new Date()
            };

            // Publish update notification
            await this.redis.publish('config_updates', JSON.stringify(notification));
        } catch (error) {
            console.error('Failed to notify config update:', error);
        }
    }

    // Notify services of feature flag update
    async notifyFeatureFlagUpdate(featureName = null) {
        try {
            const notification = {
                type: 'feature_flag_update',
                feature: featureName || 'all',
                timestamp: new Date()
            };

            // Publish update notification
            await this.redis.publish('feature_updates', JSON.stringify(notification));
        } catch (error) {
            console.error('Failed to notify feature update:', error);
        }
    }

    // Hash user ID for feature flag rollout
    hashUserId(userId) {
        const hash = userId.split('').reduce((acc, char) => {
            return ((acc << 5) - acc) + char.charCodeAt(0);
        }, 0);
        return Math.abs(hash % 100);
    }

    // Get all feature flags
    async getAllFeatureFlags() {
        return Object.fromEntries(this.featureFlags);
    }

    // Get feature flag details
    async getFeatureFlag(featureName) {
        return this.featureFlags.get(featureName);
    }

    // Create new feature flag
    async createFeatureFlag(featureName, config) {
        try {
            if (this.featureFlags.has(featureName)) {
                throw new Error('Feature flag already exists');
            }

            const flags = JSON.parse(await this.redis.get('featureFlags'));
            flags[featureName] = {
                enabled: false,
                environments: ['development'],
                rolloutPercentage: 0,
                description: '',
                ...config
            };

            await this.redis.set('featureFlags', JSON.stringify(flags));
            this.featureFlags = new Map(Object.entries(flags));

            return flags[featureName];
        } catch (error) {
            console.error('Failed to create feature flag:', error);
            throw error;
        }
    }

    // Delete feature flag
    async deleteFeatureFlag(featureName) {
        try {
            const flags = JSON.parse(await this.redis.get('featureFlags'));
            delete flags[featureName];

            await this.redis.set('featureFlags', JSON.stringify(flags));
            this.featureFlags = new Map(Object.entries(flags));

            await this.notifyFeatureFlagUpdate(featureName);
        } catch (error) {
            console.error('Failed to delete feature flag:', error);
            throw error;
        }
    }

    // Clean up resources
    async cleanup() {
        try {
            await this.redis.quit();
        } catch (error) {
            console.error('Failed to cleanup config manager:', error);
        }
    }
}

module.exports = new ConfigManagerService();
