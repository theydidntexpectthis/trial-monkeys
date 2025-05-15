const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { body, query } = require('express-validator');

// Apply authentication middleware to all payment routes
router.use(authMiddleware.verifyToken);

// Generate payment transaction
router.post('/generate', [
    body('serviceId')
        .isString()
        .notEmpty()
        .withMessage('Service ID is required'),
    authMiddleware.checkSubscription('basic') // Minimum subscription level required
], paymentController.generatePaymentTransaction.bind(paymentController));

// Verify payment transaction
router.post('/verify', [
    body('signature')
        .isString()
        .notEmpty()
        .withMessage('Transaction signature is required'),
    body('serviceId')
        .isString()
        .notEmpty()
        .withMessage('Service ID is required')
], paymentController.verifyPayment.bind(paymentController));

// Get transaction history with optional filters
router.get('/history', [
    query('status')
        .optional()
        .isIn(['pending', 'completed', 'failed'])
        .withMessage('Invalid status value'),
    query('type')
        .optional()
        .isIn(['payment', 'refund'])
        .withMessage('Invalid transaction type'),
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format'),
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format')
], paymentController.getTransactionHistory.bind(paymentController));

// Get payment statistics
router.get('/stats', 
    authMiddleware.checkSubscription('premium'), // Premium users only
    paymentController.getPaymentStats.bind(paymentController)
);

// Webhook for payment notifications (for future use)
router.post('/webhook', 
    express.raw({type: 'application/json'}),
    (req, res) => {
        const signature = req.headers['x-payment-signature'];
        
        // Verify webhook signature (implement your verification logic)
        if (!signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing signature'
            });
        }

        // Process webhook payload
        try {
            const event = JSON.parse(req.body);
            console.log('Payment webhook received:', event);

            // Handle different event types
            switch (event.type) {
                case 'payment.success':
                    // Handle successful payment
                    break;
                case 'payment.failed':
                    // Handle failed payment
                    break;
                case 'refund.processed':
                    // Handle refund
                    break;
                default:
                    console.log('Unhandled event type:', event.type);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Webhook processing failed:', error);
            res.status(400).json({
                success: false,
                message: 'Invalid webhook payload'
            });
        }
    }
);

// Refund endpoint (for future implementation)
router.post('/refund', [
    body('transactionId')
        .isString()
        .notEmpty()
        .withMessage('Transaction ID is required'),
    body('reason')
        .isString()
        .notEmpty()
        .withMessage('Refund reason is required'),
    authMiddleware.checkSubscription('premium') // Premium users only
], (req, res) => {
    // Placeholder for refund implementation
    res.status(501).json({
        success: false,
        message: 'Refund functionality coming soon'
    });
});

module.exports = router;
