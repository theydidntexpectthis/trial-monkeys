const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Initialize Phantom wallet connection
router.get('/wallet/init', authController.initializeWalletConnection.bind(authController));

// Authenticate with Phantom wallet
router.post('/wallet/authenticate', authController.authenticateWallet.bind(authController));

// Protected routes (require authentication)
router.use(authController.verifyToken);

// Update user profile
router.put('/profile', authController.updateProfile);

// Logout
router.post('/logout', authController.logout);

// Get current user session status
router.get('/status', (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

module.exports = router;
