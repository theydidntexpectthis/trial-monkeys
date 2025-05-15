const express = require('express');
const router = express.Router();
const overviewController = require('../controllers/overview.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { query } = require('express-validator');

// Apply authentication middleware to all routes
router.use(authMiddleware.verifyToken);

// Get dashboard overview data
router.get('/overview', async (req, res) => {
    try {
        await overviewController.getDashboardOverview(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get dashboard overview',
            error: error.message
        });
    }
});

// Get user statistics
router.get('/stats', [
    query('timeRange')
        .optional()
        .matches(/^\d+[hdwm]$/)
        .withMessage('Invalid time range format. Use number followed by h(hours), d(days), w(weeks), or m(months)'),
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const stats = await overviewController.getStats(req.user.userId);
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get statistics',
            error: error.message
        });
    }
});

// Get chart data
router.get('/charts', [
    query('timeRange')
        .optional()
        .matches(/^\d+[hdwm]$/)
        .withMessage('Invalid time range format'),
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const charts = await overviewController.getChartData(req.user.userId);
        res.json({
            success: true,
            charts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get chart data',
            error: error.message
        });
    }
});

// Get activity data
router.get('/activity', [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50'),
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const activity = await overviewController.getActivityData(req.user.userId);
        res.json({
            success: true,
            activity
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get activity data',
            error: error.message
        });
    }
});

// Get trials data
router.get('/trials', [
    query('status')
        .optional()
        .isIn(['active', 'completed', 'failed'])
        .withMessage('Invalid status'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50'),
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const trials = await overviewController.getTrialsData(req.user.userId);
        res.json({
            success: true,
            trials
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get trials data',
            error: error.message
        });
    }
});

// Get system status
router.get('/system-status', async (req, res) => {
    try {
        const status = await overviewController.getSystemStatus();
        res.json({
            success: true,
            status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get system status',
            error: error.message
        });
    }
});

// Get performance metrics
router.get('/performance', [
    query('timeRange')
        .optional()
        .matches(/^\d+[hdwm]$/)
        .withMessage('Invalid time range format'),
    authMiddleware.checkSubscription('premium')
], async (req, res) => {
    try {
        const metrics = await require('../services/stats.service').getPerformanceMetrics(
            req.user.userId,
            req.query.timeRange
        );
        res.json({
            success: true,
            metrics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get performance metrics',
            error: error.message
        });
    }
});

// Export dashboard data
router.get('/export', [
    query('format')
        .optional()
        .isIn(['json', 'csv', 'pdf'])
        .withMessage('Invalid export format'),
    query('timeRange')
        .optional()
        .matches(/^\d+[hdwm]$/)
        .withMessage('Invalid time range format'),
    authMiddleware.checkSubscription('premium')
], async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const timeRange = req.query.timeRange || '7d';

        // Get dashboard data
        const data = await overviewController.getDashboardData(req.user.userId, timeRange);

        // Format response based on requested format
        switch (format) {
            case 'csv':
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=dashboard-data.csv');
                // Convert data to CSV format
                // Implementation needed
                break;

            case 'pdf':
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=dashboard-data.pdf');
                // Generate PDF report
                // Implementation needed
                break;

            default:
                res.json({
                    success: true,
                    data
                });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to export dashboard data',
            error: error.message
        });
    }
});

// Get real-time updates configuration
router.get('/realtime-config', async (req, res) => {
    try {
        res.json({
            success: true,
            config: {
                updateInterval: 30000, // 30 seconds
                enabledEvents: ['trial_update', 'bot_status', 'system_status'],
                wsEndpoint: process.env.WS_ENDPOINT || 'ws://localhost:3000'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get real-time configuration',
            error: error.message
        });
    }
});

module.exports = router;
