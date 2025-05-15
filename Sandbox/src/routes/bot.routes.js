const express = require('express');
const router = express.Router();
const botController = require('../controllers/bot.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { body, query } = require('express-validator');

// Apply authentication middleware to all bot routes
router.use(authMiddleware.verifyToken);

// Get available bots with optional filters
router.get('/available', [
    query('category')
        .optional()
        .isString()
        .isIn(['streaming', 'development', 'gaming', 'productivity', 'education'])
        .withMessage('Invalid category'),
    query('status')
        .optional()
        .isString()
        .isIn(['active', 'maintenance', 'deprecated'])
        .withMessage('Invalid status')
], botController.getAvailableBots.bind(botController));

// Launch a new bot instance
router.post('/launch', [
    body('botName')
        .isString()
        .notEmpty()
        .withMessage('Bot name is required'),
    authMiddleware.checkSubscription('basic') // Minimum subscription level required
], botController.launchBot.bind(botController));

// Get bot instance status
router.get('/status/:botInstanceId', [
    authMiddleware.checkSubscription('basic')
], botController.getBotStatus.bind(botController));

// Stop a running bot instance
router.post('/stop/:botInstanceId', [
    authMiddleware.checkSubscription('basic')
], botController.stopBot.bind(botController));

// Get bot categories
router.get('/categories', (req, res) => {
    const categories = [
        {
            id: 'streaming',
            name: 'Streaming Services',
            description: 'Trial bots for popular streaming platforms',
            count: 85
        },
        {
            id: 'development',
            name: 'Development Tools',
            description: 'Trial bots for developer tools and services',
            count: 120
        },
        {
            id: 'gaming',
            name: 'Gaming Services',
            description: 'Trial bots for gaming platforms and subscriptions',
            count: 95
        },
        {
            id: 'productivity',
            name: 'Productivity Apps',
            description: 'Trial bots for productivity and office tools',
            count: 110
        },
        {
            id: 'education',
            name: 'Educational Platforms',
            description: 'Trial bots for learning platforms and courses',
            count: 90
        }
    ];

    res.json({
        success: true,
        categories
    });
});

// Get featured bots
router.get('/featured', (req, res) => {
    const featuredBots = [
        {
            id: 'netflix-premium',
            name: 'Netflix Premium Bot',
            description: 'Automated Netflix trial account creation with premium features',
            category: 'streaming',
            icon: '/assets/netflix-icon.png',
            successRate: 98,
            trialDuration: '30 days',
            status: 'active',
            featured: true,
            usageCount: 15000
        },
        {
            id: 'spotify-premium',
            name: 'Spotify Premium Bot',
            description: 'Get Spotify Premium trials automatically with region switching',
            category: 'streaming',
            icon: '/assets/spotify-icon.png',
            successRate: 95,
            trialDuration: '90 days',
            status: 'active',
            featured: true,
            usageCount: 12000
        },
        {
            id: 'github-pro',
            name: 'GitHub Pro Bot',
            description: 'GitHub Pro trial account automation',
            category: 'development',
            icon: '/assets/github-icon.png',
            successRate: 96,
            trialDuration: '14 days',
            status: 'active',
            featured: true,
            usageCount: 8000
        }
    ];

    res.json({
        success: true,
        featuredBots
    });
});

// Get bot statistics
router.get('/stats', 
    authMiddleware.checkSubscription('premium'), // Premium users only
    (req, res) => {
        const stats = {
            totalBots: 500,
            activeTrials: Math.floor(Math.random() * 200),
            totalUsers: 10500,
            successRate: 98.5,
            categoryBreakdown: {
                streaming: 30,
                development: 25,
                gaming: 20,
                productivity: 15,
                education: 10
            },
            popularBots: [
                {
                    name: 'Netflix Premium Bot',
                    usageCount: 15000
                },
                {
                    name: 'Spotify Premium Bot',
                    usageCount: 12000
                },
                {
                    name: 'GitHub Pro Bot',
                    usageCount: 8000
                }
            ]
        };

        res.json({
            success: true,
            stats
        });
    }
);

// Get user's bot history
router.get('/history', 
    authMiddleware.checkSubscription('basic'),
    (req, res) => {
        // Implementation for user's bot usage history
        res.json({
            success: true,
            message: 'History feature coming soon'
        });
    }
);

// Report bot issue
router.post('/report-issue', [
    body('botName')
        .isString()
        .notEmpty()
        .withMessage('Bot name is required'),
    body('issueType')
        .isString()
        .isIn(['error', 'captcha', 'proxy', 'other'])
        .withMessage('Invalid issue type'),
    body('description')
        .isString()
        .notEmpty()
        .withMessage('Issue description is required')
], (req, res) => {
    // Implementation for reporting bot issues
    res.json({
        success: true,
        message: 'Issue reported successfully'
    });
});

module.exports = router;
