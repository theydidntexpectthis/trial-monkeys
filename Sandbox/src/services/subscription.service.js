const User = require('../models/user.model');
const { plans, utils: subscriptionUtils } = require('../config/subscription.config');
const NotificationService = require('./notification.service');

class SubscriptionService {
    constructor() {
        this.activeSessions = new Map();
        this.trialUsage = new Map();
    }

    // Get user's subscription details
    async getUserSubscription(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const plan = plans[user.subscription.plan];
            const usage = await this.getCurrentUsage(userId);

            return {
                plan: user.subscription.plan,
                features: plan.features,
                limits: plan.limits,
                usage,
                status: user.subscription.status,
                expiresAt: user.subscription.endDate
            };
        } catch (error) {
            console.error('Failed to get subscription details:', error);
            throw error;
        }
    }

    // Upgrade subscription
    async upgradeSubscription(userId, newPlan) {
        try {
            if (!plans[newPlan]) {
                throw new Error('Invalid subscription plan');
            }

            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            // Check if it's a valid upgrade
            const comparison = subscriptionUtils.comparePlans(user.subscription.plan, newPlan);
            if (comparison >= 0) {
                throw new Error('New plan must be an upgrade');
            }

            // Update subscription
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);

            user.subscription = {
                plan: newPlan,
                status: 'active',
                startDate,
                endDate
            };

            await user.save();

            // Send notification
            await NotificationService.sendToUser(userId, {
                type: 'subscription_upgraded',
                title: 'Subscription Upgraded',
                message: `Your subscription has been upgraded to ${plans[newPlan].name}`,
                details: {
                    plan: newPlan,
                    startDate,
                    endDate
                }
            });

            return {
                success: true,
                subscription: user.subscription,
                features: plans[newPlan].features
            };
        } catch (error) {
            console.error('Failed to upgrade subscription:', error);
            throw error;
        }
    }

    // Check feature access
    async checkFeatureAccess(userId, feature) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const hasAccess = subscriptionUtils.hasFeatureAccess(
                user.subscription.plan,
                feature
            );

            return {
                hasAccess,
                reason: hasAccess ? null : 'Feature not available in current plan'
            };
        } catch (error) {
            console.error('Failed to check feature access:', error);
            throw error;
        }
    }

    // Check and update usage limits
    async checkUsageLimit(userId, limitType) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const usage = await this.getCurrentUsage(userId);
            const hasReachedLimit = subscriptionUtils.hasReachedLimit(
                user.subscription.plan,
                limitType,
                usage[limitType]
            );

            return {
                allowed: !hasReachedLimit,
                current: usage[limitType],
                limit: plans[user.subscription.plan].limits[limitType]
            };
        } catch (error) {
            console.error('Failed to check usage limit:', error);
            throw error;
        }
    }

    // Record usage
    async recordUsage(userId, type, amount = 1) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const key = `${userId}_${date}`;
            
            let usage = this.trialUsage.get(key) || {
                dailyTrials: 0,
                monthlyTrials: 0,
                concurrentTrials: 0
            };

            usage[type] += amount;
            this.trialUsage.set(key, usage);

            // Clean up old usage data
            this.cleanupOldUsage();

            return usage;
        } catch (error) {
            console.error('Failed to record usage:', error);
            throw error;
        }
    }

    // Get current usage
    async getCurrentUsage(userId) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const key = `${userId}_${date}`;
            
            return this.trialUsage.get(key) || {
                dailyTrials: 0,
                monthlyTrials: 0,
                concurrentTrials: 0
            };
        } catch (error) {
            console.error('Failed to get current usage:', error);
            throw error;
        }
    }

    // Handle subscription expiration
    async handleExpiration(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            if (user.subscription.endDate <= new Date()) {
                // Downgrade to free plan
                user.subscription = {
                    plan: 'free',
                    status: 'active',
                    startDate: new Date(),
                    endDate: null
                };

                await user.save();

                // Send notification
                await NotificationService.sendToUser(userId, {
                    type: 'subscription_expired',
                    title: 'Subscription Expired',
                    message: 'Your subscription has expired and been downgraded to the free plan',
                    details: {
                        plan: 'free'
                    }
                });
            }
        } catch (error) {
            console.error('Failed to handle subscription expiration:', error);
            throw error;
        }
    }

    // Get upgrade recommendations
    async getUpgradeRecommendations(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            return subscriptionUtils.getUpgradeRecommendations(
                user.subscription.plan
            );
        } catch (error) {
            console.error('Failed to get upgrade recommendations:', error);
            throw error;
        }
    }

    // Start subscription session
    async startSession(userId) {
        try {
            const session = {
                startTime: new Date(),
                activeTrials: 0,
                completedTrials: 0
            };

            this.activeSessions.set(userId, session);
            return session;
        } catch (error) {
            console.error('Failed to start subscription session:', error);
            throw error;
        }
    }

    // End subscription session
    async endSession(userId) {
        try {
            const session = this.activeSessions.get(userId);
            if (session) {
                session.endTime = new Date();
                this.activeSessions.delete(userId);
                return session;
            }
        } catch (error) {
            console.error('Failed to end subscription session:', error);
            throw error;
        }
    }

    // Clean up old usage data
    cleanupOldUsage() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        for (const [key] of this.trialUsage) {
            const [, dateStr] = key.split('_');
            const date = new Date(dateStr);
            
            if (date < thirtyDaysAgo) {
                this.trialUsage.delete(key);
            }
        }
    }

    // Get subscription metrics
    async getMetrics(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const usage = await this.getCurrentUsage(userId);
            const plan = plans[user.subscription.plan];

            return {
                plan: user.subscription.plan,
                usage: {
                    daily: {
                        current: usage.dailyTrials,
                        limit: plan.limits.dailyTrials,
                        percentage: (usage.dailyTrials / plan.limits.dailyTrials) * 100
                    },
                    monthly: {
                        current: usage.monthlyTrials,
                        limit: plan.limits.monthlyTrials,
                        percentage: (usage.monthlyTrials / plan.limits.monthlyTrials) * 100
                    },
                    concurrent: {
                        current: usage.concurrentTrials,
                        limit: plan.features.concurrentTrials,
                        percentage: (usage.concurrentTrials / plan.features.concurrentTrials) * 100
                    }
                },
                status: user.subscription.status,
                daysRemaining: user.subscription.endDate ? 
                    Math.ceil((user.subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)) : 
                    null
            };
        } catch (error) {
            console.error('Failed to get subscription metrics:', error);
            throw error;
        }
    }
}

module.exports = new SubscriptionService();
