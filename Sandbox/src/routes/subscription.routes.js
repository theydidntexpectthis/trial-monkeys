const express = require('express');
const router = express.Router();
const subscriptionService = require('../services/subscription.service');
const authMiddleware = require('../middleware/auth.middleware');
const { body } = require('express-validator');

// Apply authentication middleware to all subscription routes
router.use(authMiddleware.verifyToken);

// Get subscription details
router.get('/details', async (req, res) => {
    try {
        const subscription = await subscriptionService.getUserSubscription(req.user.userId);
        res.json({
            success: true,
            subscription
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription details',
            error: error.message
        });
    }
});

// Upgrade subscription
router.post('/upgrade', [
    body('plan')
        .isString()
        .isIn(['basic', 'premium', 'enterprise'])
        .withMessage('Invalid subscription plan')
], async (req, res) => {
    try {
        const result = await subscriptionService.upgradeSubscription(
            req.user.userId,
            req.body.plan
        );

        res.json({
            success: true,
            message: 'Subscription upgraded successfully',
            subscription: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to upgrade subscription',
            error: error.message
        });
    }
});

// Check feature access
router.get('/feature/:feature', async (req, res) => {
    try {
        const access = await subscriptionService.checkFeatureAccess(
            req.user.userId,
            req.params.feature
        );

        res.json({
            success: true,
            access
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to check feature access',
            error: error.message
        });
    }
});

// Get usage limits
router.get('/limits', async (req, res) => {
    try {
        const usage = await subscriptionService.getCurrentUsage(req.user.userId);
        const metrics = await subscriptionService.getMetrics(req.user.userId);

        res.json({
            success: true,
            usage,
            metrics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch usage limits',
            error: error.message
        });
    }
});

// Get upgrade recommendations
router.get('/recommendations', async (req, res) => {
    try {
        const recommendations = await subscriptionService.getUpgradeRecommendations(
            req.user.userId
        );

        res.json({
            success: true,
            recommendations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch upgrade recommendations',
            error: error.message
        });
    }
});

// Start subscription session
router.post('/session/start', async (req, res) => {
    try {
        const session = await subscriptionService.startSession(req.user.userId);
        res.json({
            success: true,
            session
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to start session',
            error: error.message
        });
    }
});

// End subscription session
router.post('/session/end', async (req, res) => {
    try {
        const session = await subscriptionService.endSession(req.user.userId);
        res.json({
            success: true,
            session
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to end session',
            error: error.message
        });
    }
});

// Get subscription comparison
router.get('/compare', [
    body('plans')
        .isArray()
        .withMessage('Plans must be an array')
], async (req, res) => {
    try {
        const { plans: plansToCompare } = req.query;
        const comparison = {};

        plansToCompare.forEach(plan => {
            comparison[plan] = {
                features: require('../config/subscription.config').plans[plan].features,
                limits: require('../config/subscription.config').plans[plan].limits,
                price: require('../config/subscription.config').plans[plan].price
            };
        });

        res.json({
            success: true,
            comparison
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to compare plans',
            error: error.message
        });
    }
});

// Get subscription history
router.get('/history', async (req, res) => {
    try {
        const user = await require('../models/user.model').findById(req.user.userId);
        const history = user.subscriptionHistory || [];

        res.json({
            success: true,
            history
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription history',
            error: error.message
        });
    }
});

// Request enterprise quote
router.post('/enterprise/quote', [
    body('company').isString().notEmpty(),
    body('requirements').isString().notEmpty(),
    body('contactEmail').isEmail(),
    body('usersCount').isInt({ min: 1 })
], async (req, res) => {
    try {
        // Implementation for enterprise quote request
        res.json({
            success: true,
            message: 'Enterprise quote request received',
            estimatedResponse: '24 hours'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to submit enterprise quote request',
            error: error.message
        });
    }
});

// Cancel subscription
router.post('/cancel', [
    body('reason').isString().notEmpty(),
    body('feedback').optional().isString()
], async (req, res) => {
    try {
        // Implementation for subscription cancellation
        res.json({
            success: true,
            message: 'Subscription cancellation processed',
            effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to cancel subscription',
            error: error.message
        });
    }
});

module.exports = router;
