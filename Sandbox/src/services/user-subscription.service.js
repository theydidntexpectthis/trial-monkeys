const Redis = require('ioredis');
const VirtualPaymentService = require('./virtual-payment.service');
const NotificationsService = require('./user-notifications.service');

class UserSubscriptionService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.tiers = {
            basic: {
                name: 'Basic',
                price: 5,
                currency: 'MONK',
                maxTrials: 1,
                duration: 14,
                features: [
                    'Single Trial Generation',
                    'Basic Support',
                    'Manual Renewal'
                ]
            },
            power: {
                name: 'Power User',
                price: 20,
                currency: 'MONK',
                maxTrials: 5,
                duration: 30,
                features: [
                    'Multiple Trial Generation',
                    'Priority Support',
                    'Custom Email Domains',
                    'Auto-Renewal Protection'
                ]
            },
            enterprise: {
                name: 'Enterprise',
                price: 50,
                currency: 'MONK',
                maxTrials: 10,
                duration: 60,
                features: [
                    'Unlimited Trial Generation',
                    '24/7 Priority Support',
                    'API Access',
                    'Custom Automation Rules',
                    'Team Management'
                ]
            }
        };
    }

    async createUser(userData) {
        const userId = `user_${Date.now()}`;
        const user = {
            id: userId,
            ...userData,
            subscription: {
                tier: 'basic',
                startDate: new Date(),
                endDate: this.calculateEndDate(14),
                trialsUsed: 0,
                maxTrials: 1,
                status: 'active'
            },
            preferences: {
                notifications: {
                    email: true,
                    discord: true,
                    telegram: true
                },
                theme: 'dark',
                language: 'en'
            },
            stats: {
                totalTrials: 0,
                successfulTrials: 0,
                totalSaved: 0
            },
            created: new Date()
        };

        await this.saveUser(user);
        return user;
    }

    async upgradeSubscription(userId, tier, paymentDetails) {
        const user = await this.getUser(userId);
        if (!user) throw new Error('User not found');

        const tierConfig = this.tiers[tier];
        if (!tierConfig) throw new Error('Invalid subscription tier');

        try {
            // Process payment
            const payment = await VirtualPaymentService.processPayment({
                amount: tierConfig.price,
                currency: tierConfig.currency,
                userId,
                tier
            });

            // Update subscription
            const subscription = {
                tier,
                startDate: new Date(),
                endDate: this.calculateEndDate(tierConfig.duration),
                trialsUsed: 0,
                maxTrials: tierConfig.maxTrials,
                status: 'active',
                paymentId: payment.id
            };

            await this.updateUserSubscription(userId, subscription);

            // Send notification
            await NotificationsService.sendNotification(userId, 'subscription_upgraded', {
                tier: tierConfig.name,
                duration: tierConfig.duration,
                features: tierConfig.features
            });

            return subscription;
        } catch (error) {
            console.error('Subscription upgrade error:', error);
            throw error;
        }
    }

    async checkTrialEligibility(userId, serviceType) {
        const user = await this.getUser(userId);
        if (!user) throw new Error('User not found');

        const subscription = user.subscription;
        if (subscription.status !== 'active') {
            throw new Error('Subscription not active');
        }

        if (subscription.trialsUsed >= subscription.maxTrials) {
            throw new Error('Trial limit reached');
        }

        // Check service-specific limitations
        await this.checkServiceLimitations(userId, serviceType);

        return true;
    }

    async incrementTrialCount(userId) {
        const user = await this.getUser(userId);
        if (!user) throw new Error('User not found');

        const subscription = {
            ...user.subscription,
            trialsUsed: user.subscription.trialsUsed + 1
        };

        await this.updateUserSubscription(userId, subscription);
        return subscription;
    }

    async updateTrialStats(userId, trialResult) {
        const user = await this.getUser(userId);
        if (!user) throw new Error('User not found');

        const stats = {
            totalTrials: user.stats.totalTrials + 1,
            successfulTrials: user.stats.successfulTrials + (trialResult.success ? 1 : 0),
            totalSaved: user.stats.totalSaved + (trialResult.savings || 0)
        };

        await this.updateUserStats(userId, stats);
        return stats;
    }

    async updateUserPreferences(userId, preferences) {
        const user = await this.getUser(userId);
        if (!user) throw new Error('User not found');

        const updatedPreferences = {
            ...user.preferences,
            ...preferences
        };

        await this.redis.hset(
            `user:${userId}`,
            'preferences',
            JSON.stringify(updatedPreferences)
        );

        return updatedPreferences;
    }

    async getSubscriptionDetails(userId) {
        const user = await this.getUser(userId);
        if (!user) throw new Error('User not found');

        const tierConfig = this.tiers[user.subscription.tier];
        return {
            ...user.subscription,
            tierDetails: tierConfig,
            remaining: {
                trials: tierConfig.maxTrials - user.subscription.trialsUsed,
                days: this.calculateRemainingDays(user.subscription.endDate)
            }
        };
    }

    async getUserStats(userId) {
        const user = await this.getUser(userId);
        if (!user) throw new Error('User not found');

        return {
            ...user.stats,
            subscriptionTier: user.subscription.tier,
            activeTrials: await this.getActiveTrials(userId),
            trialHistory: await this.getTrialHistory(userId)
        };
    }

    async checkServiceLimitations(userId, serviceType) {
        const key = `trials:${userId}:${serviceType}`;
        const serviceTrials = await this.redis.get(key);

        if (serviceTrials && parseInt(serviceTrials) > 0) {
            throw new Error('Service trial already used');
        }

        return true;
    }

    async saveUser(user) {
        await this.redis.hset(
            `user:${user.id}`,
            {
                'data': JSON.stringify(user),
                'subscription': JSON.stringify(user.subscription),
                'preferences': JSON.stringify(user.preferences),
                'stats': JSON.stringify(user.stats)
            }
        );
    }

    async getUser(userId) {
        const data = await this.redis.hget(`user:${userId}`, 'data');
        return data ? JSON.parse(data) : null;
    }

    async updateUserSubscription(userId, subscription) {
        await this.redis.hset(
            `user:${userId}`,
            'subscription',
            JSON.stringify(subscription)
        );
    }

    async updateUserStats(userId, stats) {
        await this.redis.hset(
            `user:${userId}`,
            'stats',
            JSON.stringify(stats)
        );
    }

    calculateEndDate(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
    }

    calculateRemainingDays(endDate) {
        const end = new Date(endDate);
        const now = new Date();
        return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    }

    async getActiveTrials(userId) {
        const trials = await this.redis.smembers(`user:${userId}:active_trials`);
        return trials.map(t => JSON.parse(t));
    }

    async getTrialHistory(userId) {
        const history = await this.redis.lrange(`user:${userId}:trial_history`, 0, -1);
        return history.map(h => JSON.parse(h));
    }
}

module.exports = new UserSubscriptionService();
