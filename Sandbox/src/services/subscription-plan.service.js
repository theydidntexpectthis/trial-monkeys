const Redis = require('ioredis');
const PaymentVerificationService = require('./payment-verification.service');
const VirtualPaymentService = require('./virtual-payment.service');

class SubscriptionPlanService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.paymentService = PaymentVerificationService;
        this.virtualPaymentService = VirtualPaymentService;

        this.plans = {
            basic: {
                id: 'plan_basic',
                name: 'Basic',
                price: 4.99,
                trialDays: 7,
                features: [
                    'Single Trial Generation',
                    'Basic Support',
                    'Manual Renewal'
                ],
                limits: {
                    maxTrials: 1,
                    concurrentTrials: 1
                }
            },
            pro: {
                id: 'plan_pro',
                name: 'Professional',
                price: 14.99,
                trialDays: 14,
                features: [
                    'Multiple Trial Generation',
                    'Priority Support',
                    'Auto-Renewal Protection',
                    'Custom Email Domains'
                ],
                limits: {
                    maxTrials: 5,
                    concurrentTrials: 2
                }
            },
            enterprise: {
                id: 'plan_enterprise',
                name: 'Enterprise',
                price: 49.99,
                trialDays: 30,
                features: [
                    'Unlimited Trial Generation',
                    '24/7 Priority Support',
                    'API Access',
                    'Team Management',
                    'Custom Automation Rules'
                ],
                limits: {
                    maxTrials: -1, // unlimited
                    concurrentTrials: 5
                }
            }
        };
    }

    async createSubscription(userId, planId) {
        try {
            // Verify plan exists
            const plan = this.plans[planId];
            if (!plan) throw new Error('Invalid plan selected');

            // Create payment intent
            const paymentIntent = await this.createPaymentIntent(userId, plan);

            // Create subscription
            const subscription = await this.createSubscriptionRecord(userId, plan, paymentIntent);

            // Setup virtual payment method if needed
            if (subscription.requiresVirtualPayment) {
                await this.setupVirtualPayment(subscription);
            }

            return subscription;
        } catch (error) {
            console.error('Subscription creation error:', error);
            throw error;
        }
    }

    async updateSubscription(userId, updates) {
        try {
            const subscription = await this.getSubscription(userId);
            if (!subscription) throw new Error('No active subscription found');

            // Handle plan upgrade/downgrade
            if (updates.planId && updates.planId !== subscription.planId) {
                await this.handlePlanChange(subscription, updates.planId);
            }

            // Update subscription details
            const updated = await this.updateSubscriptionRecord(subscription.id, updates);

            return updated;
        } catch (error) {
            console.error('Subscription update error:', error);
            throw error;
        }
    }

    async cancelSubscription(userId) {
        try {
            const subscription = await this.getSubscription(userId);
            if (!subscription) throw new Error('No active subscription found');

            // Cancel at period end
            const canceled = await this.cancelSubscriptionRecord(subscription.id);

            // Handle virtual payments
            if (subscription.virtualPaymentId) {
                await this.virtualPaymentService.deactivateCard(subscription.virtualPaymentId);
            }

            return canceled;
        } catch (error) {
            console.error('Subscription cancellation error:', error);
            throw error;
        }
    }

    async getSubscriptionDetails(userId) {
        try {
            const subscription = await this.getSubscription(userId);
            if (!subscription) return null;

            const plan = this.plans[subscription.planId];
            const usage = await this.getUsageMetrics(userId);

            return {
                ...subscription,
                plan,
                usage,
                remainingTrials: this.calculateRemainingTrials(plan, usage)
            };
        } catch (error) {
            console.error('Subscription details error:', error);
            throw error;
        }
    }

    async verifySubscriptionLimits(userId, action) {
        try {
            const subscription = await this.getSubscription(userId);
            if (!subscription) throw new Error('No active subscription found');

            const plan = this.plans[subscription.planId];
            const usage = await this.getUsageMetrics(userId);

            switch (action) {
                case 'create_trial':
                    return this.verifyTrialCreationLimit(plan, usage);
                case 'concurrent_trials':
                    return this.verifyConcurrentTrialsLimit(plan, usage);
                default:
                    throw new Error('Invalid action specified');
            }
        } catch (error) {
            console.error('Subscription limit verification error:', error);
            throw error;
        }
    }

    async handlePlanChange(subscription, newPlanId) {
        const currentPlan = this.plans[subscription.planId];
        const newPlan = this.plans[newPlanId];

        if (!newPlan) throw new Error('Invalid plan selected');

        // Check if upgrade or downgrade
        const isUpgrade = newPlan.price > currentPlan.price;

        if (!isUpgrade) {
            // Verify within new plan limits
            const usage = await this.getUsageMetrics(subscription.userId);
            if (usage.activeTrials > newPlan.limits.maxTrials) {
                throw new Error('Cannot downgrade: Too many active trials');
            }
        }

        // Create prorated payment if needed
        if (isUpgrade) {
            await this.createProratedPayment(subscription, newPlan);
        }

        return newPlan;
    }

    async setupVirtualPayment(subscription) {
        const virtualCard = await this.virtualPaymentService.generateVirtualCard({
            amount: subscription.plan.price,
            duration: subscription.plan.trialDays
        });

        await this.updateSubscriptionRecord(subscription.id, {
            virtualPaymentId: virtualCard.id
        });

        return virtualCard;
    }

    calculateRemainingTrials(plan, usage) {
        if (plan.limits.maxTrials === -1) return Infinity;
        return Math.max(0, plan.limits.maxTrials - usage.totalTrials);
    }

    async verifyTrialCreationLimit(plan, usage) {
        if (plan.limits.maxTrials !== -1 && usage.totalTrials >= plan.limits.maxTrials) {
            throw new Error('Trial creation limit reached');
        }
        return true;
    }

    async verifyConcurrentTrialsLimit(plan, usage) {
        if (usage.activeTrials >= plan.limits.concurrentTrials) {
            throw new Error('Concurrent trials limit reached');
        }
        return true;
    }

    // Storage Methods
    async createSubscriptionRecord(userId, plan, paymentIntent) {
        const subscription = {
            id: `sub_${Date.now()}`,
            userId,
            planId: plan.id,
            status: 'active',
            currentPeriodStart: Date.now(),
            currentPeriodEnd: Date.now() + (plan.trialDays * 24 * 60 * 60 * 1000),
            paymentIntentId: paymentIntent.id,
            created: Date.now()
        };

        await this.redis.hset(
            `subscription:${subscription.id}`,
            subscription
        );

        return subscription;
    }

    async updateSubscriptionRecord(subscriptionId, updates) {
        await this.redis.hset(
            `subscription:${subscriptionId}`,
            updates
        );

        return await this.redis.hgetall(`subscription:${subscriptionId}`);
    }

    async cancelSubscriptionRecord(subscriptionId) {
        const updates = {
            status: 'cancelled',
            cancelledAt: Date.now()
        };

        return await this.updateSubscriptionRecord(subscriptionId, updates);
    }

    async getSubscription(userId) {
        const subscriptionId = await this.redis.get(`user:${userId}:subscription`);
        if (!subscriptionId) return null;

        return await this.redis.hgetall(`subscription:${subscriptionId}`);
    }

    async getUsageMetrics(userId) {
        const [totalTrials, activeTrials] = await Promise.all([
            this.redis.get(`user:${userId}:trials:total`),
            this.redis.scard(`user:${userId}:trials:active`)
        ]);

        return {
            totalTrials: parseInt(totalTrials || 0),
            activeTrials: parseInt(activeTrials || 0)
        };
    }

    // These methods would be implemented based on your payment system
    async createPaymentIntent(userId, plan) {}
    async createProratedPayment(subscription, newPlan) {}
}

module.exports = new SubscriptionPlanService();
