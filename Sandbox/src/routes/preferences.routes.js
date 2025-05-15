const express = require('express');
const router = express.Router();
const UserPreferencesService = require('../services/user-preferences.service');
const authMiddleware = require('../middleware/auth.middleware');
const { body, param } = require('express-validator');

// Apply authentication middleware to all routes
router.use(authMiddleware.verifyToken);

// Get user preferences
router.get('/', async (req, res) => {
    try {
        const preferences = await UserPreferencesService.getUserPreferences(req.user.userId);
        res.json({
            success: true,
            preferences
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch preferences',
            error: error.message
        });
    }
});

// Update user preferences
router.put('/', [
    body('preferences').isObject().withMessage('Preferences must be an object'),
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const updatedPreferences = await UserPreferencesService.updatePreferences(
            req.user.userId,
            req.body.preferences
        );

        res.json({
            success: true,
            message: 'Preferences updated successfully',
            preferences: updatedPreferences
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update preferences',
            error: error.message
        });
    }
});

// Update specific preference
router.put('/:path', [
    param('path').isString().notEmpty().withMessage('Preference path is required'),
    body('value').exists().withMessage('Preference value is required'),
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const updatedPreferences = await UserPreferencesService.updatePreference(
            req.user.userId,
            req.params.path,
            req.body.value
        );

        res.json({
            success: true,
            message: 'Preference updated successfully',
            preferences: updatedPreferences
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update preference',
            error: error.message
        });
    }
});

// Reset preferences to default
router.post('/reset', async (req, res) => {
    try {
        const defaultPreferences = await UserPreferencesService.resetPreferences(req.user.userId);
        res.json({
            success: true,
            message: 'Preferences reset to default',
            preferences: defaultPreferences
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to reset preferences',
            error: error.message
        });
    }
});

// Import preferences
router.post('/import', [
    body('preferences').isObject().withMessage('Invalid preferences format'),
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const importedPreferences = await UserPreferencesService.importPreferences(
            req.user.userId,
            req.body.preferences
        );

        res.json({
            success: true,
            message: 'Preferences imported successfully',
            preferences: importedPreferences
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to import preferences',
            error: error.message
        });
    }
});

// Export preferences
router.get('/export', async (req, res) => {
    try {
        const exportData = await UserPreferencesService.exportPreferences(req.user.userId);
        res.json({
            success: true,
            data: exportData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to export preferences',
            error: error.message
        });
    }
});

// Get theme preferences
router.get('/theme', async (req, res) => {
    try {
        const preferences = await UserPreferencesService.getUserPreferences(req.user.userId);
        res.json({
            success: true,
            theme: preferences.theme
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch theme preferences',
            error: error.message
        });
    }
});

// Get notification preferences
router.get('/notifications', async (req, res) => {
    try {
        const preferences = await UserPreferencesService.getUserPreferences(req.user.userId);
        res.json({
            success: true,
            notifications: preferences.notifications
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification preferences',
            error: error.message
        });
    }
});

// Get bot settings preferences
router.get('/bot-settings', async (req, res) => {
    try {
        const preferences = await UserPreferencesService.getUserPreferences(req.user.userId);
        res.json({
            success: true,
            botSettings: preferences.botSettings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bot settings preferences',
            error: error.message
        });
    }
});

// Get monitoring preferences
router.get('/monitoring', async (req, res) => {
    try {
        const preferences = await UserPreferencesService.getUserPreferences(req.user.userId);
        res.json({
            success: true,
            monitoring: preferences.monitoring
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch monitoring preferences',
            error: error.message
        });
    }
});

// Get preference schema
router.get('/schema', async (req, res) => {
    try {
        const schema = UserPreferencesService.getPreferenceSchema();
        res.json({
            success: true,
            schema
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch preference schema',
            error: error.message
        });
    }
});

module.exports = router;
