const express = require('express');
const router = express.Router();
const botManagementController = require('../controllers/bot-management.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { body, param, query } = require('express-validator');

// Apply authentication middleware to all routes
router.use(authMiddleware.verifyToken);

// Get user's bots with optional filters
router.get('/', [
    query('category')
        .optional()
        .isString()
        .withMessage('Invalid category'),
    query('status')
        .optional()
        .isIn(['active', 'inactive', 'failed', 'paused'])
        .withMessage('Invalid status'),
    query('sort')
        .optional()
        .isIn(['name', 'success-rate', 'last-used', 'created'])
        .withMessage('Invalid sort parameter')
], botManagementController.getUserBots);

// Create new bot
router.post('/', [
    body('serviceType')
        .isString()
        .notEmpty()
        .withMessage('Service type is required'),
    body('name')
        .isString()
        .notEmpty()
        .withMessage('Bot name is required'),
    body('config')
        .isObject()
        .withMessage('Configuration object is required'),
    body('config.autoRetry')
        .optional()
        .isBoolean(),
    body('config.useProxy')
        .optional()
        .isBoolean(),
    body('config.serviceUrl')
        .optional()
        .isURL()
        .withMessage('Invalid service URL'),
    body('config.trialDuration')
        .optional()
        .isInt({ min: 1, max: 90 })
        .withMessage('Trial duration must be between 1 and 90 days'),
    authMiddleware.checkSubscription('basic')
], botManagementController.createBot);

// Update bot configuration
router.put('/:botId', [
    param('botId')
        .isMongoId()
        .withMessage('Invalid bot ID'),
    body('config')
        .isObject()
        .withMessage('Configuration object is required'),
    authMiddleware.checkSubscription('basic')
], botManagementController.updateBot);

// Launch bot
router.post('/:botId/launch', [
    param('botId')
        .isMongoId()
        .withMessage('Invalid bot ID'),
    authMiddleware.checkSubscription('basic')
], botManagementController.launchBot);

// Stop bot
router.post('/:botId/stop', [
    param('botId')
        .isMongoId()
        .withMessage('Invalid bot ID'),
    authMiddleware.checkSubscription('basic')
], botManagementController.stopBot);

// Delete bot
router.delete('/:botId', [
    param('botId')
        .isMongoId()
        .withMessage('Invalid bot ID'),
    authMiddleware.checkSubscription('basic')
], botManagementController.deleteBot);

// Reset bot statistics
router.post('/:botId/reset-stats', [
    param('botId')
        .isMongoId()
        .withMessage('Invalid bot ID'),
    authMiddleware.checkSubscription('basic')
], botManagementController.resetBotStats);

// Get bot logs
router.get('/:botId/logs', [
    param('botId')
        .isMongoId()
        .withMessage('Invalid bot ID'),
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date'),
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),
    authMiddleware.checkSubscription('basic')
], botManagementController.getBotLogs);

// Get bot templates
router.get('/templates', (req, res) => {
    const templates = {
        streaming: [
            {
                id: 'netflix',
                name: 'Netflix Trial Bot',
                description: 'Automated Netflix trial account creation',
                icon: '/assets/netflix-icon.png',
                defaultConfig: {
                    autoRetry: true,
                    useProxy: true,
                    trialDuration: 30
                }
            },
            {
                id: 'spotify',
                name: 'Spotify Premium Bot',
                description: 'Spotify Premium trial automation',
                icon: '/assets/spotify-icon.png',
                defaultConfig: {
                    autoRetry: true,
                    useProxy: true,
                    trialDuration: 90
                }
            }
        ],
        development: [
            {
                id: 'github',
                name: 'GitHub Pro Bot',
                description: 'GitHub Pro trial account automation',
                icon: '/assets/github-icon.png',
                defaultConfig: {
                    autoRetry: true,
                    useProxy: false,
                    trialDuration: 14
                }
            }
        ],
        productivity: [
            {
                id: 'adobe',
                name: 'Adobe CC Bot',
                description: 'Adobe Creative Cloud trial automation',
                icon: '/assets/adobe-icon.png',
                defaultConfig: {
                    autoRetry: true,
                    useProxy: true,
                    trialDuration: 7
                }
            }
        ]
    };

    res.json({
        success: true,
        templates
    });
});

// Get bot statistics
router.get('/statistics', async (req, res) => {
    try {
        const userId = req.user.userId;
        const bots = await require('../models/bot.model').find({ userId });

        const stats = {
            total: bots.length,
            active: bots.filter(b => b.status === 'active').length,
            successful: bots.reduce((sum, b) => sum + b.statistics.successfulRuns, 0),
            failed: bots.reduce((sum, b) => sum + b.statistics.failedRuns, 0),
            averageSuccessRate: bots.reduce((sum, b) => sum + b.statistics.averageSuccessRate, 0) / bots.length || 0,
            categoryBreakdown: bots.reduce((acc, b) => {
                acc[b.serviceType] = (acc[b.serviceType] || 0) + 1;
                return acc;
            }, {})
        };

        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bot statistics',
            error: error.message
        });
    }
});

// Get bot health check
router.get('/:botId/health', [
    param('botId')
        .isMongoId()
        .withMessage('Invalid bot ID'),
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const health = await require('../services/monitor.service')
            .getBotHealth(req.params.botId);

        res.json({
            success: true,
            health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bot health status',
            error: error.message
        });
    }
});

module.exports = router;
