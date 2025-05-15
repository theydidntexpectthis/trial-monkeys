const SubscriptionPlanService = require('../services/subscription-plan.service');
const PaymentVerificationService = require('../services/payment-verification.service');
const VirtualPaymentService = require('../services/virtual-payment.service');
const UserAnalyticsService = require('../services/user-analytics.service');

class SubscriptionController {
    constructor() {
        this.subscriptionService = SubscriptionPlanService;
        this.paymentService = PaymentVerificationService;
        this.virtualPaymentService = VirtualPaymentService;
        this.analyticsService = UserAnalyticsService;
    }

    async getAvailablePlans(req, res) {
        try {
            const plans = this.subscriptionService.plans;
            const formattedPlans = Object.entries(plans).map(([id, plan]) => ({
                id,
                ...plan,
                popular: id === 'pro', // Mark pro plan as popular
                bestValue: id === 'enterprise' // Mark enterprise as best value
            }));

            res.json({ success: true, data: formattedPlans });
        } catch (error) {
            console.error('Get plans error:', error);
            res.status(500).json({ error: 'Failed to fetch subscription plans' });
        }
    }

    async createSubscription(req, res) {
        try {
            const { planId, paymentMethod } = req.body;
            const userId = req.user.id;

            // Create subscription
            const subscription = await this.subscriptionService.createSubscription(
                userId,
                planId
            );

            // Track analytics
            await this.analyticsService.trackUserActivity(userId, 'subscription_created', {
                planId,
                subscriptionId: subscription.id
            });

            res.json({
                success: true,
                data: {
                    subscription,
                    clientSecret: subscription.clientSecret
                }
            });
        } catch (error) {
            console.error('Subscription creation error:', error);
            res.status(500).json({ error: 'Failed to create subscription' });
        }
    }

    async updateSubscription(req, res) {
        try {
            const { planId } = req.body;
            const userId = req.user.id;

            // Update subscription
            const updated = await this.subscriptionService.updateSubscription(userId, {
                planId
            });

            // Track analytics
            await this.analyticsService.trackUserActivity(userId, 'subscription_updated', {
                oldPlanId: req.subscription.planId,
                newPlanId: planId
            });

            res.json({ success: true, data: updated });
        } catch (error) {
            console.error('Subscription update error:', error);
            res.status(500).json({ error: 'Failed to update subscription' });
        }
    }

    async cancelSubscription(req, res) {
        try {
            const userId = req.user.id;

            // Cancel subscription
            const canceled = await this.subscriptionService.cancelSubscription(userId);

            // Track analytics
            await this.analyticsService.trackUserActivity(userId, 'subscription_canceled', {
                subscriptionId: canceled.id,
                reason: req.body.reason
            });

            res.json({ success: true, data: canceled });
        } catch (error) {
            console.error('Subscription cancellation error:', error);
            res.status(500).json({ error: 'Failed to cancel subscription' });
        }
    }

    async getSubscriptionDetails(req, res) {
        try {
            const userId = req.user.id;
            const details = await this.subscriptionService.getSubscriptionDetails(userId);

            res.json({ success: true, data: details });
        } catch (error) {
            console.error('Subscription details error:', error);
            res.status(500).json({ error: 'Failed to fetch subscription details' });
        }
    }

    async verifyPayment(req, res) {
        try {
            const { paymentIntentId } = req.body;
            const userId = req.user.id;

            // Verify payment
            const verification = await this.paymentService.verifyPayment({
                userId,
                transactionId: paymentIntentId
            });

            if (verification.success) {
                // Track successful payment
                await this.analyticsService.trackUserActivity(userId, 'payment_success', {
                    paymentIntentId,
                    amount: verification.amount
                });
            }

            res.json({ success: true, data: verification });
        } catch (error) {
            console.error('Payment verification error:', error);
            res.status(500).json({ error: 'Failed to verify payment' });
        }
    }

    async setupVirtualPayment(req, res) {
        try {
            const userId = req.user.id;
            const subscription = await this.subscriptionService.getSubscriptionDetails(userId);

            // Generate virtual card
            const virtualCard = await this.virtualPaymentService.generateVirtualCard({
                amount: subscription.plan.price,
                duration: subscription.plan.trialDays,
                service: 'subscription'
            });

            // Track virtual card creation
            await this.analyticsService.trackUserActivity(userId, 'virtual_card_created', {
                cardId: virtualCard.id
            });

            res.json({
                success: true,
                data: {
                    cardDetails: virtualCard,
                    setupInstructions: this.getSetupInstructions(virtualCard)
                }
            });
        } catch (error) {
            console.error('Virtual payment setup error:', error);
            res.status(500).json({ error: 'Failed to setup virtual payment' });
        }
    }

    async getPaymentHistory(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10 } = req.query;

            const history = await this.paymentService.getPaymentHistory(userId, {
                page: parseInt(page),
                limit: parseInt(limit)
            });

            res.json({ success: true, data: history });
        } catch (error) {
            console.error('Payment history error:', error);
            res.status(500).json({ error: 'Failed to fetch payment history' });
        }
    }

    async getUsageMetrics(req, res) {
        try {
            const userId = req.user.id;
            const { timeframe = '30d' } = req.query;

            const metrics = await this.subscriptionService.getUsageMetrics(userId);
            const analytics = await this.analyticsService.getUserAnalytics(userId, timeframe);

            res.json({
                success: true,
                data: {
                    usage: metrics,
                    analytics
                }
            });
        } catch (error) {
            console.error('Usage metrics error:', error);
            res.status(500).json({ error: 'Failed to fetch usage metrics' });
        }
    }

    getSetupInstructions(virtualCard) {
        return {
            steps: [
                {
                    title: 'Save Card Details',
                    description: 'Keep your virtual card details in a secure location.'
                },
                {
                    title: 'Use for Subscription',
                    description: 'Use this card when setting up your subscription.'
                },
                {
                    title: 'Monitor Usage',
                    description: 'Track your card usage in the dashboard.'
                }
            ],
            notes: [
                'Card is valid only for the specified duration',
                'Auto-renewal protection is enabled',
                'Contact support if you encounter any issues'
            ]
        };
    }
}

module.exports = new SubscriptionController();
