const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analytics.service');
const authMiddleware = require('../middleware/auth.middleware');
const { query } = require('express-validator');

// Apply authentication middleware to all analytics routes
router.use(authMiddleware.verifyToken);

// Validate time range parameter
const validateTimeRange = query('timeRange')
    .optional()
    .matches(/^\d+[hdwm]$/)
    .withMessage('Invalid time range format. Use number followed by h(hours), d(days), w(weeks), or m(months)');

// Get bot analytics
router.get('/bot/:botId', [
    validateTimeRange,
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const analytics = await analyticsService.getBotAnalytics(
            req.params.botId,
            req.query.timeRange || '24h'
        );

        if (!analytics) {
            return res.status(404).json({
                success: false,
                message: 'Bot analytics not found'
            });
        }

        res.json({
            success: true,
            analytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bot analytics',
            error: error.message
        });
    }
});

// Get user analytics
router.get('/user/:userId', [
    validateTimeRange,
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const analytics = await analyticsService.getUserAnalytics(
            req.params.userId,
            req.query.timeRange || '24h'
        );

        if (!analytics) {
            return res.status(404).json({
                success: false,
                message: 'User analytics not found'
            });
        }

        res.json({
            success: true,
            analytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user analytics',
            error: error.message
        });
    }
});

// Get system analytics (admin only)
router.get('/system', [
    validateTimeRange,
    authMiddleware.checkSubscription('premium')
], async (req, res) => {
    try {
        const analytics = analyticsService.getSystemAnalytics(
            req.query.timeRange || '24h'
        );

        res.json({
            success: true,
            analytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch system analytics',
            error: error.message
        });
    }
});

// Get analytics dashboard data
router.get('/dashboard', [
    validateTimeRange,
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const userId = req.user.userId;
        const timeRange = req.query.timeRange || '24h';

        const [userAnalytics, systemOverview] = await Promise.all([
            analyticsService.getUserAnalytics(userId, timeRange),
            analyticsService.getSystemAnalytics(timeRange)
        ]);

        res.json({
            success: true,
            dashboard: {
                user: userAnalytics,
                system: {
                    current: systemOverview.current,
                    peaks: systemOverview.peaks
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard analytics',
            error: error.message
        });
    }
});

// Get bot performance comparison
router.get('/compare/bots', [
    query('botIds').isArray().withMessage('botIds must be an array'),
    validateTimeRange,
    authMiddleware.checkSubscription('premium')
], async (req, res) => {
    try {
        const { botIds } = req.query;
        const timeRange = req.query.timeRange || '24h';

        const comparisons = await Promise.all(
            botIds.map(botId => analyticsService.getBotAnalytics(botId, timeRange))
        );

        res.json({
            success: true,
            comparisons
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to compare bots',
            error: error.message
        });
    }
});

// Get category performance analytics
router.get('/categories', [
    validateTimeRange,
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24h';
        const categories = ['streaming', 'development', 'gaming', 'productivity', 'education'];

        const categoryAnalytics = await Promise.all(
            categories.map(async (category) => {
                const report = await analyticsService.generateAnalyticsReport('category', category, timeRange);
                return {
                    category,
                    ...report
                };
            })
        );

        res.json({
            success: true,
            categoryAnalytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch category analytics',
            error: error.message
        });
    }
});

// Get trial success analytics
router.get('/trials/success', [
    validateTimeRange,
    authMiddleware.checkSubscription('basic')
], async (req, res) => {
    try {
        const userId = req.user.userId;
        const timeRange = req.query.timeRange || '24h';

        const trialAnalytics = await analyticsService.generateAnalyticsReport('trials', userId, timeRange);

        res.json({
            success: true,
            trialAnalytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch trial success analytics',
            error: error.message
        });
    }
});

// Export analytics report
router.post('/export', [
    query('type').isIn(['bot', 'user', 'system']).withMessage('Invalid report type'),
    query('format').isIn(['json', 'csv', 'pdf']).withMessage('Invalid export format'),
    validateTimeRange,
    authMiddleware.checkSubscription('premium')
], async (req, res) => {
    try {
        const { type, format, id } = req.query;
        const timeRange = req.query.timeRange || '24h';

        const report = await analyticsService.generateAnalyticsReport(type, id, timeRange);
        
        // Format report based on requested format
        let formattedReport;
        switch (format) {
            case 'csv':
                res.setHeader('Content-Type', 'text/csv');
                formattedReport = 'CSV data'; // Implementation needed
                break;
            case 'pdf':
                res.setHeader('Content-Type', 'application/pdf');
                formattedReport = 'PDF data'; // Implementation needed
                break;
            default:
                res.setHeader('Content-Type', 'application/json');
                formattedReport = JSON.stringify(report, null, 2);
        }

        res.send(formattedReport);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to export analytics report',
            error: error.message
        });
    }
});

module.exports = router;
