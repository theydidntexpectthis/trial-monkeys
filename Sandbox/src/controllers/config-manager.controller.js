const ConfigManagerService = require('../services/config-manager.service');
const NotificationService = require('../services/notification.service');

class ConfigManagerController {
    // Get configuration for environment
    async getConfig(req, res) {
        try {
            const env = req.query.env || process.env.NODE_ENV;
            const config = await ConfigManagerService.getConfig(env);

            res.json({
                success: true,
                config
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to get configuration',
                error: error.message
            });
        }
    }

    // Update configuration
    async updateConfig(req, res) {
        try {
            const { env, updates } = req.body;

            // Validate environment
            if (!['development', 'staging', 'production'].includes(env)) {
                throw new Error('Invalid environment');
            }

            // Validate config updates
            this.validateConfigUpdates(updates);

            const updatedConfig = await ConfigManagerService.updateConfig(env, updates);

            // Notify administrators
            await NotificationService.notifyAdmins({
                type: 'config_update',
                title: 'Configuration Updated',
                message: `Configuration updated for ${env} environment`,
                details: updates
            });

            res.json({
                success: true,
                config: updatedConfig
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update configuration',
                error: error.message
            });
        }
    }

    // Get all feature flags
    async getFeatureFlags(req, res) {
        try {
            const flags = await ConfigManagerService.getAllFeatureFlags();
            
            res.json({
                success: true,
                flags
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to get feature flags',
                error: error.message
            });
        }
    }

    // Get specific feature flag
    async getFeatureFlag(req, res) {
        try {
            const { featureName } = req.params;
            const flag = await ConfigManagerService.getFeatureFlag(featureName);

            if (!flag) {
                return res.status(404).json({
                    success: false,
                    message: 'Feature flag not found'
                });
            }

            res.json({
                success: true,
                flag
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to get feature flag',
                error: error.message
            });
        }
    }

    // Create feature flag
    async createFeatureFlag(req, res) {
        try {
            const { featureName, config } = req.body;

            // Validate feature flag configuration
            this.validateFeatureFlagConfig(config);

            const flag = await ConfigManagerService.createFeatureFlag(featureName, config);

            // Notify administrators
            await NotificationService.notifyAdmins({
                type: 'feature_flag_created',
                title: 'Feature Flag Created',
                message: `New feature flag created: ${featureName}`,
                details: config
            });

            res.json({
                success: true,
                flag
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to create feature flag',
                error: error.message
            });
        }
    }

    // Update feature flag
    async updateFeatureFlag(req, res) {
        try {
            const { featureName } = req.params;
            const updates = req.body;

            // Validate feature flag updates
            this.validateFeatureFlagConfig(updates);

            const flag = await ConfigManagerService.updateFeatureFlag(featureName, updates);

            // Notify administrators
            await NotificationService.notifyAdmins({
                type: 'feature_flag_updated',
                title: 'Feature Flag Updated',
                message: `Feature flag updated: ${featureName}`,
                details: updates
            });

            res.json({
                success: true,
                flag
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update feature flag',
                error: error.message
            });
        }
    }

    // Delete feature flag
    async deleteFeatureFlag(req, res) {
        try {
            const { featureName } = req.params;
            
            await ConfigManagerService.deleteFeatureFlag(featureName);

            // Notify administrators
            await NotificationService.notifyAdmins({
                type: 'feature_flag_deleted',
                title: 'Feature Flag Deleted',
                message: `Feature flag deleted: ${featureName}`
            });

            res.json({
                success: true,
                message: 'Feature flag deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to delete feature flag',
                error: error.message
            });
        }
    }

    // Check feature flag status
    async checkFeatureFlag(req, res) {
        try {
            const { featureName } = req.params;
            const userId = req.query.userId;

            const isEnabled = await ConfigManagerService.isFeatureEnabled(featureName, userId);

            res.json({
                success: true,
                featureName,
                enabled: isEnabled
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to check feature flag',
                error: error.message
            });
        }
    }

    // Validate configuration updates
    validateConfigUpdates(updates) {
        const allowedFields = ['debugMode', 'logLevel', 'mockServices', 'timeouts'];
        const invalidFields = Object.keys(updates).filter(key => !allowedFields.includes(key));

        if (invalidFields.length > 0) {
            throw new Error(`Invalid configuration fields: ${invalidFields.join(', ')}`);
        }

        if (updates.timeouts) {
            const allowedTimeouts = ['api', 'bot', 'proxy'];
            const invalidTimeouts = Object.keys(updates.timeouts).filter(key => !allowedTimeouts.includes(key));

            if (invalidTimeouts.length > 0) {
                throw new Error(`Invalid timeout fields: ${invalidTimeouts.join(', ')}`);
            }
        }
    }

    // Validate feature flag configuration
    validateFeatureFlagConfig(config) {
        const requiredFields = ['enabled', 'environments', 'rolloutPercentage'];
        const missingFields = requiredFields.filter(field => !(field in config));

        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        if (!Array.isArray(config.environments)) {
            throw new Error('Environments must be an array');
        }

        if (typeof config.rolloutPercentage !== 'number' || 
            config.rolloutPercentage < 0 || 
            config.rolloutPercentage > 100) {
            throw new Error('Invalid rollout percentage');
        }

        const validEnvironments = ['development', 'staging', 'production'];
        const invalidEnvironments = config.environments.filter(env => !validEnvironments.includes(env));

        if (invalidEnvironments.length > 0) {
            throw new Error(`Invalid environments: ${invalidEnvironments.join(', ')}`);
        }
    }
}

module.exports = new ConfigManagerController();
