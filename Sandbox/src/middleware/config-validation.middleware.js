const Joi = require('joi');
const ErrorHandler = require('./error-handler.middleware');

class ConfigValidationMiddleware {
    constructor() {
        this.schemas = this.initializeSchemas();
    }

    // Initialize validation schemas
    initializeSchemas() {
        return {
            config: Joi.object({
                debugMode: Joi.boolean().required(),
                logLevel: Joi.string().valid('debug', 'info', 'warn', 'error').required(),
                mockServices: Joi.boolean().required(),
                timeouts: Joi.object({
                    api: Joi.number().integer().min(1000).max(60000).required(),
                    bot: Joi.number().integer().min(1000).max(60000).required(),
                    proxy: Joi.number().integer().min(1000).max(60000).required()
                }).required()
            }),

            featureFlag: Joi.object({
                enabled: Joi.boolean().required(),
                environments: Joi.array()
                    .items(Joi.string().valid('development', 'staging', 'production'))
                    .min(1)
                    .required(),
                rolloutPercentage: Joi.number().integer().min(0).max(100).required(),
                description: Joi.string().max(500).optional()
            }),

            environment: Joi.string()
                .valid('development', 'staging', 'production')
                .required(),

            configUpdate: Joi.object({
                env: Joi.string()
                    .valid('development', 'staging', 'production')
                    .required(),
                updates: Joi.object().required()
            }),

            featureUpdate: Joi.object({
                featureName: Joi.string()
                    .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
                    .required(),
                config: Joi.object().required()
            })
        };
    }

    // Validate configuration
    validateConfig = (req, res, next) => {
        try {
            const { error } = this.schemas.config.validate(req.body.updates);
            if (error) {
                throw new ErrorHandler.ValidationError('Invalid configuration', error.details);
            }
            next();
        } catch (error) {
            next(error);
        }
    };

    // Validate feature flag
    validateFeatureFlag = (req, res, next) => {
        try {
            const { error } = this.schemas.featureFlag.validate(req.body.config);
            if (error) {
                throw new ErrorHandler.ValidationError('Invalid feature flag configuration', error.details);
            }
            next();
        } catch (error) {
            next(error);
        }
    };

    // Validate environment
    validateEnvironment = (req, res, next) => {
        try {
            const env = req.query.env || req.body.env;
            const { error } = this.schemas.environment.validate(env);
            if (error) {
                throw new ErrorHandler.ValidationError('Invalid environment', error.details);
            }
            next();
        } catch (error) {
            next(error);
        }
    };

    // Business rule validations
    validateProductionChanges = (req, res, next) => {
        try {
            const env = req.query.env || req.body.env;
            if (env === 'production') {
                // Check user role
                if (!req.user.roles.includes('admin')) {
                    throw new ErrorHandler.AuthorizationError('Only administrators can modify production configuration');
                }

                // Check deployment window
                if (!this.isWithinDeploymentWindow()) {
                    throw new Error('Production changes are only allowed during deployment windows');
                }
            }
            next();
        } catch (error) {
            next(error);
        }
    };

    validateFeatureFlagRules = (req, res, next) => {
        try {
            const config = req.body.config;
            
            // Validate environment progression
            if (config.environments.includes('production')) {
                if (!config.environments.includes('staging')) {
                    throw new Error('Features must be enabled in staging before production');
                }
            }

            if (config.environments.includes('staging')) {
                if (!config.environments.includes('development')) {
                    throw new Error('Features must be enabled in development before staging');
                }
            }

            // Validate rollout percentage rules
            if (config.environments.includes('production')) {
                if (config.rolloutPercentage === 100 && !this.hasFullTestCoverage(req.body.featureName)) {
                    throw new Error('100% rollout in production requires full test coverage');
                }
            }

            next();
        } catch (error) {
            next(error);
        }
    };

    validateDependencies = async (req, res, next) => {
        try {
            const config = req.body.updates || req.body.config;
            
            // Check feature dependencies
            if (config.dependencies) {
                for (const dep of config.dependencies) {
                    const dependentFeature = await this.getFeatureFlag(dep);
                    if (!dependentFeature || !dependentFeature.enabled) {
                        throw new Error(`Dependent feature ${dep} must be enabled`);
                    }
                }
            }

            next();
        } catch (error) {
            next(error);
        }
    };

    // Helper methods
    isWithinDeploymentWindow() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();

        // Allow deployments Monday-Thursday, 10 PM - 5 AM
        return (day >= 1 && day <= 4) && (hour >= 22 || hour < 5);
    }

    async hasFullTestCoverage(featureName) {
        try {
            const testResults = await this.getTestResults(featureName);
            return testResults.coverage >= 95;
        } catch (error) {
            console.error('Failed to check test coverage:', error);
            return false;
        }
    }

    async getFeatureFlag(name) {
        // Implementation would fetch feature flag from database
        return null;
    }

    async getTestResults(featureName) {
        // Implementation would fetch test results from CI system
        return {
            coverage: 0,
            passed: false
        };
    }

    // Composite validation middleware
    validateConfigUpdate = [
        this.validateEnvironment,
        this.validateConfig,
        this.validateProductionChanges,
        this.validateDependencies
    ];

    validateFeatureFlagUpdate = [
        this.validateFeatureFlag,
        this.validateFeatureFlagRules,
        this.validateDependencies
    ];
}

module.exports = new ConfigValidationMiddleware();
