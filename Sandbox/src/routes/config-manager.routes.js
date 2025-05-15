const express = require('express');
const router = express.Router();
const configManagerController = require('../controllers/config-manager.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { body, param, query } = require('express-validator');

// Apply authentication middleware to all routes
router.use(authMiddleware.verifyToken);

// Get configuration
router.get('/config', [
    query('env')
        .optional()
        .isIn(['development', 'staging', 'production'])
        .withMessage('Invalid environment'),
    authMiddleware.checkRole('admin')
], configManagerController.getConfig);

// Update configuration
router.put('/config', [
    body('env')
        .isIn(['development', 'staging', 'production'])
        .withMessage('Invalid environment'),
    body('updates')
        .isObject()
        .withMessage('Updates must be an object'),
    body('updates.debugMode')
        .optional()
        .isBoolean()
        .withMessage('Debug mode must be a boolean'),
    body('updates.logLevel')
        .optional()
        .isIn(['debug', 'info', 'warn', 'error'])
        .withMessage('Invalid log level'),
    body('updates.mockServices')
        .optional()
        .isBoolean()
        .withMessage('Mock services must be a boolean'),
    body('updates.timeouts')
        .optional()
        .isObject()
        .withMessage('Timeouts must be an object'),
    body('updates.timeouts.*.api')
        .optional()
        .isInt({ min: 1000, max: 60000 })
        .withMessage('API timeout must be between 1000 and 60000 ms'),
    authMiddleware.checkRole('admin')
], configManagerController.updateConfig);

// Get all feature flags
router.get('/features', [
    authMiddleware.checkRole(['admin', 'manager'])
], configManagerController.getFeatureFlags);

// Get specific feature flag
router.get('/features/:featureName', [
    param('featureName')
        .isString()
        .notEmpty()
        .withMessage('Feature name is required'),
    authMiddleware.checkRole(['admin', 'manager'])
], configManagerController.getFeatureFlag);

// Create feature flag
router.post('/features', [
    body('featureName')
        .isString()
        .notEmpty()
        .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
        .withMessage('Invalid feature name format'),
    body('config')
        .isObject()
        .withMessage('Configuration must be an object'),
    body('config.enabled')
        .isBoolean()
        .withMessage('Enabled must be a boolean'),
    body('config.environments')
        .isArray()
        .withMessage('Environments must be an array'),
    body('config.environments.*')
        .isIn(['development', 'staging', 'production'])
        .withMessage('Invalid environment'),
    body('config.rolloutPercentage')
        .isInt({ min: 0, max: 100 })
        .withMessage('Rollout percentage must be between 0 and 100'),
    body('config.description')
        .optional()
        .isString()
        .withMessage('Description must be a string'),
    authMiddleware.checkRole('admin')
], configManagerController.createFeatureFlag);

// Update feature flag
router.put('/features/:featureName', [
    param('featureName')
        .isString()
        .notEmpty()
        .withMessage('Feature name is required'),
    body('enabled')
        .optional()
        .isBoolean()
        .withMessage('Enabled must be a boolean'),
    body('environments')
        .optional()
        .isArray()
        .withMessage('Environments must be an array'),
    body('environments.*')
        .optional()
        .isIn(['development', 'staging', 'production'])
        .withMessage('Invalid environment'),
    body('rolloutPercentage')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Rollout percentage must be between 0 and 100'),
    body('description')
        .optional()
        .isString()
        .withMessage('Description must be a string'),
    authMiddleware.checkRole('admin')
], configManagerController.updateFeatureFlag);

// Delete feature flag
router.delete('/features/:featureName', [
    param('featureName')
        .isString()
        .notEmpty()
        .withMessage('Feature name is required'),
    authMiddleware.checkRole('admin')
], configManagerController.deleteFeatureFlag);

// Check feature flag status
router.get('/features/:featureName/status', [
    param('featureName')
        .isString()
        .notEmpty()
        .withMessage('Feature name is required'),
    query('userId')
        .optional()
        .isString()
        .withMessage('Invalid user ID')
], configManagerController.checkFeatureFlag);

// Get configuration schema
router.get('/schema', (req, res) => {
    res.json({
        success: true,
        schema: {
            config: {
                type: 'object',
                properties: {
                    debugMode: { type: 'boolean' },
                    logLevel: {
                        type: 'string',
                        enum: ['debug', 'info', 'warn', 'error']
                    },
                    mockServices: { type: 'boolean' },
                    timeouts: {
                        type: 'object',
                        properties: {
                            api: { type: 'number', minimum: 1000, maximum: 60000 },
                            bot: { type: 'number', minimum: 1000, maximum: 60000 },
                            proxy: { type: 'number', minimum: 1000, maximum: 60000 }
                        }
                    }
                }
            },
            featureFlag: {
                type: 'object',
                required: ['enabled', 'environments', 'rolloutPercentage'],
                properties: {
                    enabled: { type: 'boolean' },
                    environments: {
                        type: 'array',
                        items: {
                            type: 'string',
                            enum: ['development', 'staging', 'production']
                        }
                    },
                    rolloutPercentage: {
                        type: 'number',
                        minimum: 0,
                        maximum: 100
                    },
                    description: { type: 'string' }
                }
            }
        }
    });
});

// Export configuration
router.get('/export', [
    query('format')
        .optional()
        .isIn(['json', 'yaml'])
        .withMessage('Invalid export format'),
    authMiddleware.checkRole('admin')
], async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const config = await configManagerController.getConfig(req, res);
        const flags = await configManagerController.getFeatureFlags(req, res);

        const exportData = {
            config: config.config,
            featureFlags: flags.flags,
            exportDate: new Date(),
            environment: process.env.NODE_ENV
        };

        if (format === 'yaml') {
            const yaml = require('js-yaml');
            res.setHeader('Content-Type', 'text/yaml');
            res.setHeader('Content-Disposition', 'attachment; filename="config-export.yaml"');
            res.send(yaml.dump(exportData));
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="config-export.json"');
            res.json(exportData);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to export configuration',
            error: error.message
        });
    }
});

module.exports = router;
