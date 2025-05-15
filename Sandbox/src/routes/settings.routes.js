const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { body, validationResult } = require('express-validator');

// Apply authentication middleware to all settings routes
router.use(authMiddleware.verifyToken);

// Validation middleware
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

// Get user settings
router.get('/', settingsController.getUserSettings);

// Update user settings
router.put('/', [
    body('settings').isObject().withMessage('Settings must be an object'),
    body('settings.theme').optional().isIn(['light', 'dark']).withMessage('Invalid theme'),
    body('settings.language').optional().isIn(['en', 'es', 'fr', 'de']).withMessage('Invalid language'),
    validateRequest
], settingsController.updateSettings);

// Update notification settings
router.put('/notifications', [
    body('notifications').isObject().withMessage('Notifications must be an object'),
    body('notifications.email').isBoolean().withMessage('Email notification must be boolean'),
    body('notifications.browser').isBoolean().withMessage('Browser notification must be boolean'),
    validateRequest
], settingsController.updateNotificationSettings);

// Update bot settings
router.put('/bot', [
    body('botSettings').isObject().withMessage('Bot settings must be an object'),
    body('botSettings.autoRetry').optional().isBoolean(),
    body('botSettings.proxyEnabled').optional().isBoolean(),
    body('botSettings.captchaSolving').optional().isBoolean(),
    validateRequest
], settingsController.updateBotSettings);

// Reset settings to default
router.post('/reset', settingsController.resetSettings);

// Export settings
router.get('/export', settingsController.exportSettings);

// Import settings
router.post('/import', [
    body('settings').isObject().withMessage('Settings must be an object'),
    body('settings.version').isString().withMessage('Settings version is required'),
    validateRequest
], settingsController.importSettings);

// Get theme preferences
router.get('/theme', (req, res) => {
    try {
        const themes = {
            light: {
                name: 'Light',
                colors: {
                    primary: '#4f46e5',
                    secondary: '#64748b',
                    background: '#f8fafc',
                    text: '#1e293b'
                }
            },
            dark: {
                name: 'Dark',
                colors: {
                    primary: '#818cf8',
                    secondary: '#94a3b8',
                    background: '#1e293b',
                    text: '#f8fafc'
                }
            }
        };

        res.json({
            success: true,
            themes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch theme preferences',
            error: error.message
        });
    }
});

// Get language preferences
router.get('/languages', (req, res) => {
    try {
        const languages = {
            en: {
                name: 'English',
                code: 'en',
                flag: '🇺🇸'
            },
            es: {
                name: 'Español',
                code: 'es',
                flag: '🇪🇸'
            },
            fr: {
                name: 'Français',
                code: 'fr',
                flag: '🇫🇷'
            },
            de: {
                name: 'Deutsch',
                code: 'de',
                flag: '🇩🇪'
            }
        };

        res.json({
            success: true,
            languages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch language preferences',
            error: error.message
        });
    }
});

// Get bot configuration options
router.get('/bot/options', async (req, res) => {
    try {
        const subscription = await require('../services/subscription.service')
            .getUserSubscription(req.user.userId);

        const options = {
            autoRetry: {
                name: 'Auto Retry',
                description: 'Automatically retry failed trial attempts',
                available: true
            },
            proxyEnabled: {
                name: 'Proxy Support',
                description: 'Use proxy rotation for trial creation',
                available: subscription.features.proxySupport
            },
            captchaSolving: {
                name: 'CAPTCHA Solving',
                description: 'Automatic CAPTCHA solving support',
                available: subscription.features.captchaSolving
            }
        };

        res.json({
            success: true,
            options
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bot configuration options',
            error: error.message
        });
    }
});

// Test notification settings
router.post('/notifications/test', [
    body('type').isIn(['email', 'browser']).withMessage('Invalid notification type'),
    validateRequest
], async (req, res) => {
    try {
        const { type } = req.body;
        const notificationService = require('../services/notification.service');

        await notificationService.sendToUser(req.user.userId, {
            type: 'test',
            title: 'Test Notification',
            message: `This is a test ${type} notification`,
            channel: type
        });

        res.json({
            success: true,
            message: `Test ${type} notification sent`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to send test notification',
            error: error.message
        });
    }
});

// Get settings history
router.get('/history', async (req, res) => {
    try {
        const user = await require('../models/user.model').findById(req.user.userId);
        const history = user.settingsHistory || [];

        res.json({
            success: true,
            history: history.slice(-10) // Get last 10 changes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch settings history',
            error: error.message
        });
    }
});

module.exports = router;
