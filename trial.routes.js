const express = require('express');
const router = express.Router();
const trialController = require('../controllers/trial.controller');
const authController = require('../controllers/auth.controller');

// Apply authentication middleware to all trial routes
router.use(authController.verifyToken);

// Get available trial services
router.get('/services', trialController.getAvailableServices.bind(trialController));

// Get user's trial accounts
router.get('/user-trials', trialController.getUserTrials.bind(trialController));

// Create new trial account
router.post('/create', trialController.createTrialAccount.bind(trialController));

// Cancel trial account
router.put('/cancel/:trialId', trialController.cancelTrial.bind(trialController));

// Service categories endpoint
router.get('/categories', (req, res) => {
    res.json({
        success: true,
        categories: [
            'streaming',
            'software',
            'gaming',
            'education',
            'other'
        ]
    });
});

// Service statistics endpoint
router.get('/statistics', async (req, res) => {
    try {
        const stats = await trialController.getServiceStatistics();
        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
});

module.exports = router;
