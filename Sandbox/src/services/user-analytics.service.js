const Redis = require('ioredis');
const authConfig = require('../config/auth-integration.config');

class UserAnalyticsService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.metrics = {
            activity: 'analytics:activity',
            retention: 'analytics:retention',
            conversion: 'analytics:conversion',
            engagement: 'analytics:engagement'
        };
    }

    async trackUserActivity(userId, action, details = {}) {
        try {
            const activity = {
                userId,
                action,
                details,
                timestamp: Date.now()
            };

            // Store activity
            await this.storeActivity(activity);

            // Update metrics
            await this.updateMetrics(activity);

            return activity;
        } catch (error) {
            console.error('Activity tracking error:', error);
            throw error;
        }
    }

    async getUserAnalytics(userId, timeframe = '30d') {
        try {
            const [
                activities,
                metrics,
                engagement
            ] = await Promise.all([
                this.getUserActivities(userId, timeframe),
                this.getUserMetrics(userId, timeframe),
                this.calculateEngagement(userId, timeframe)
            ]);

            return {
                activities,
                metrics,
                engagement,
                timeframe
            };
        } catch (error) {
            console.error('User analytics error:', error);
            throw error;
        }
    }

    async getGlobalAnalytics(timeframe = '30d') {
        try {
            const [
                activeUsers,
                retentionRate,
                conversionRate,
                topActions
            ] = await Promise.all([
                this.getActiveUsers(timeframe),
                this.calculateRetention(timeframe),
                this.calculateConversion(timeframe),
                this.getTopActions(timeframe)
            ]);

            return {
                activeUsers,
                retentionRate,
                conversionRate,
                topActions,
                timeframe
            };
        } catch (error) {
            console.error('Global analytics error:', error);
            throw error;
        }
    }

    async storeActivity(activity) {
        const multi = this.redis.multi();

        // Store in user's activity stream
        multi.lpush(
            `user:${activity.userId}:activities`,
            JSON.stringify(activity)
        );
        multi.ltrim(`user:${activity.userId}:activities`, 0, 999);

        // Store in global activity stream
        multi.lpush(
            'global:activities',
            JSON.stringify(activity)
        );
        multi.ltrim('global:activities', 0, 9999);

        // Track action frequency
        multi.hincrby(
            `${this.metrics.activity}:actions`,
            activity.action,
            1
        );

        await multi.exec();
    }

    async updateMetrics(activity) {
        const now = this.getCurrentPeriod();

        // Update active users
        await this.redis.pfadd(
            `${this.metrics.activity}:active:${now}`,
            activity.userId
        );

        // Update action-specific metrics
        switch (activity.action) {
            case 'login':
                await this.trackLoginMetrics(activity);
                break;
            case 'subscription':
                await this.trackSubscriptionMetrics(activity);
                break;
            case 'referral':
                await this.trackReferralMetrics(activity);
                break;
            case 'payment':
                await this.trackPaymentMetrics(activity);
                break;
        }
    }

    async getUserActivities(userId, timeframe) {
        const activities = await this.redis.lrange(
            `user:${userId}:activities`,
            0,
            -1
        );

        const cutoff = this.getTimeframeCutoff(timeframe);
        return activities
            .map(a => JSON.parse(a))
            .filter(a => a.timestamp >= cutoff);
    }

    async getUserMetrics(userId, timeframe) {
        const cutoff = this.getTimeframeCutoff(timeframe);
        const metrics = {
            logins: 0,
            subscriptions: 0,
            referrals: 0,
            payments: 0
        };

        const activities = await this.getUserActivities(userId, timeframe);
        activities.forEach(activity => {
            if (metrics[activity.action] !== undefined) {
                metrics[activity.action]++;
            }
        });

        return metrics;
    }

    async calculateEngagement(userId, timeframe) {
        const cutoff = this.getTimeframeCutoff(timeframe);
        const activities = await this.getUserActivities(userId, timeframe);

        return {
            activityCount: activities.length,
            activityFrequency: activities.length / this.timeframeInDays(timeframe),
            lastActive: activities[0]?.timestamp || null,
            topActions: this.getTopUserActions(activities)
        };
    }

    async getActiveUsers(timeframe) {
        const periods = this.getPeriodsInTimeframe(timeframe);
        const activeUsers = new Set();

        for (const period of periods) {
            const users = await this.redis.pfcount(
                `${this.metrics.activity}:active:${period}`
            );
            activeUsers.add(users);
        }

        return {
            total: activeUsers.size,
            daily: activeUsers.size / periods.length
        };
    }

    async calculateRetention(timeframe) {
        const periods = this.getPeriodsInTimeframe(timeframe);
        let retained = 0;
        let total = 0;

        for (const period of periods) {
            const users = await this.getRetainedUsers(period);
            retained += users.retained;
            total += users.total;
        }

        return {
            rate: total > 0 ? (retained / total) * 100 : 0,
            retained,
            total
        };
    }

    async calculateConversion(timeframe) {
        const periods = this.getPeriodsInTimeframe(timeframe);
        let conversions = 0;
        let trials = 0;

        for (const period of periods) {
            const stats = await this.getConversionStats(period);
            conversions += stats.conversions;
            trials += stats.trials;
        }

        return {
            rate: trials > 0 ? (conversions / trials) * 100 : 0,
            conversions,
            trials
        };
    }

    async getTopActions(timeframe) {
        const actions = await this.redis.hgetall(
            `${this.metrics.activity}:actions`
        );

        return Object.entries(actions)
            .map(([action, count]) => ({
                action,
                count: parseInt(count)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }

    // Metric Tracking Methods
    async trackLoginMetrics(activity) {
        const period = this.getCurrentPeriod();
        await this.redis.hincrby(
            `${this.metrics.activity}:logins:${period}`,
            activity.userId,
            1
        );
    }

    async trackSubscriptionMetrics(activity) {
        if (activity.details.status === 'active') {
            await this.redis.hincrby(
                `${this.metrics.conversion}:subscriptions`,
                this.getCurrentPeriod(),
                1
            );
        }
    }

    async trackReferralMetrics(activity) {
        const period = this.getCurrentPeriod();
        await this.redis.hincrby(
            `${this.metrics.engagement}:referrals:${period}`,
            activity.userId,
            1
        );
    }

    async trackPaymentMetrics(activity) {
        const period = this.getCurrentPeriod();
        await this.redis.hincrby(
            `${this.metrics.conversion}:payments:${period}`,
            activity.userId,
            activity.details.amount || 0
        );
    }

    // Helper Methods
    getCurrentPeriod() {
        return Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    }

    getTimeframeCutoff(timeframe) {
        const days = parseInt(timeframe);
        return Date.now() - (days * 24 * 60 * 60 * 1000);
    }

    timeframeInDays(timeframe) {
        return parseInt(timeframe);
    }

    getPeriodsInTimeframe(timeframe) {
        const days = this.timeframeInDays(timeframe);
        const currentPeriod = this.getCurrentPeriod();
        return Array.from(
            { length: days },
            (_, i) => currentPeriod - i
        );
    }

    getTopUserActions(activities) {
        const actionCounts = activities.reduce((acc, activity) => {
            acc[activity.action] = (acc[activity.action] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(actionCounts)
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    // These methods would be implemented based on your database choice
    async getRetainedUsers(period) {}
    async getConversionStats(period) {}
}

module.exports = new UserAnalyticsService();
