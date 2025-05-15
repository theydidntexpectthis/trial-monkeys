const Bot = require('../models/bot.model');
const User = require('../models/user.model');
const StatsService = require('./stats.service');
const config = require('../config/config');

class AnalyticsService {
    constructor() {
        this.metrics = new Map();
        this.initializeMetrics();
    }

    // Initialize analytics metrics
    initializeMetrics() {
        this.metrics.set('bot_performance', new Map());
        this.metrics.set('user_activity', new Map());
        this.metrics.set('system_metrics', new Map());
        
        // Start periodic updates
        setInterval(() => this.updateMetrics(), 300000); // Every 5 minutes
        setInterval(() => this.generateReports(), 86400000); // Daily
    }

    // Record bot execution
    async recordBotExecution(botId, data) {
        try {
            const metrics = this.metrics.get('bot_performance');
            const botMetrics = metrics.get(botId) || this.initializeBotMetrics();

            // Update execution metrics
            botMetrics.totalExecutions++;
            botMetrics.successCount += data.success ? 1 : 0;
            botMetrics.failureCount += data.success ? 0 : 1;
            botMetrics.totalDuration += data.duration;
            botMetrics.averageDuration = botMetrics.totalDuration / botMetrics.totalExecutions;
            botMetrics.successRate = (botMetrics.successCount / botMetrics.totalExecutions) * 100;

            // Update error tracking
            if (!data.success && data.error) {
                botMetrics.errors.push({
                    timestamp: new Date(),
                    error: data.error,
                    context: data.context
                });
            }

            metrics.set(botId, botMetrics);

            // Update bot model statistics
            await Bot.findByIdAndUpdate(botId, {
                $inc: {
                    'statistics.totalRuns': 1,
                    'statistics.successfulRuns': data.success ? 1 : 0,
                    'statistics.failedRuns': data.success ? 0 : 1
                },
                $set: {
                    'statistics.averageSuccessRate': botMetrics.successRate,
                    'statistics.averageRunTime': botMetrics.averageDuration
                }
            });

        } catch (error) {
            console.error('Failed to record bot execution:', error);
        }
    }

    // Record user activity
    async recordUserActivity(userId, activity) {
        try {
            const metrics = this.metrics.get('user_activity');
            const userMetrics = metrics.get(userId) || this.initializeUserMetrics();

            // Update activity metrics
            userMetrics.totalActions++;
            userMetrics.lastActivity = new Date();
            userMetrics.activities.push({
                type: activity.type,
                timestamp: new Date(),
                details: activity.details
            });

            // Keep only last 100 activities
            if (userMetrics.activities.length > 100) {
                userMetrics.activities = userMetrics.activities.slice(-100);
            }

            metrics.set(userId, userMetrics);

            // Update user model
            await User.findByIdAndUpdate(userId, {
                $push: {
                    activityLog: {
                        $each: [{ type: activity.type, timestamp: new Date() }],
                        $slice: -100
                    }
                }
            });

        } catch (error) {
            console.error('Failed to record user activity:', error);
        }
    }

    // Record system metrics
    recordSystemMetrics(metrics) {
        try {
            const systemMetrics = this.metrics.get('system_metrics');
            const timestamp = new Date();

            systemMetrics.set(timestamp.getTime(), {
                timestamp,
                metrics: {
                    cpuUsage: metrics.cpu,
                    memoryUsage: metrics.memory,
                    activeConnections: metrics.connections,
                    queueSize: metrics.queueSize,
                    responseTime: metrics.responseTime
                }
            });

            // Keep only last 24 hours of metrics
            const dayAgo = timestamp.getTime() - 86400000;
            for (const [time] of systemMetrics) {
                if (time < dayAgo) {
                    systemMetrics.delete(time);
                }
            }

        } catch (error) {
            console.error('Failed to record system metrics:', error);
        }
    }

    // Get bot analytics
    async getBotAnalytics(botId, timeRange = '24h') {
        try {
            const metrics = this.metrics.get('bot_performance').get(botId);
            if (!metrics) return null;

            const bot = await Bot.findById(botId);
            if (!bot) return null;

            const timeRangeMs = this.parseTimeRange(timeRange);
            const filteredMetrics = this.filterMetricsByTime(metrics, timeRangeMs);

            return {
                general: {
                    name: bot.name,
                    category: bot.category,
                    status: bot.status
                },
                performance: {
                    successRate: filteredMetrics.successRate,
                    averageDuration: filteredMetrics.averageDuration,
                    totalExecutions: filteredMetrics.totalExecutions,
                    errorRate: (filteredMetrics.failureCount / filteredMetrics.totalExecutions) * 100
                },
                errors: filteredMetrics.errors,
                trends: this.calculateTrends(metrics, timeRangeMs)
            };

        } catch (error) {
            console.error('Failed to get bot analytics:', error);
            throw error;
        }
    }

    // Get user analytics
    async getUserAnalytics(userId, timeRange = '24h') {
        try {
            const metrics = this.metrics.get('user_activity').get(userId);
            if (!metrics) return null;

            const user = await User.findById(userId);
            if (!user) return null;

            const timeRangeMs = this.parseTimeRange(timeRange);
            const filteredActivities = this.filterActivitiesByTime(metrics.activities, timeRangeMs);

            return {
                user: {
                    id: user._id,
                    subscription: user.subscription.plan
                },
                activity: {
                    totalActions: filteredActivities.length,
                    lastActivity: metrics.lastActivity,
                    activityBreakdown: this.getActivityBreakdown(filteredActivities)
                },
                trials: {
                    total: user.trialAccounts.length,
                    active: user.trialAccounts.filter(t => t.status === 'active').length,
                    successful: user.trialAccounts.filter(t => t.status === 'completed').length
                },
                timeline: this.generateActivityTimeline(filteredActivities)
            };

        } catch (error) {
            console.error('Failed to get user analytics:', error);
            throw error;
        }
    }

    // Get system analytics
    getSystemAnalytics(timeRange = '24h') {
        try {
            const metrics = Array.from(this.metrics.get('system_metrics').values());
            const timeRangeMs = this.parseTimeRange(timeRange);
            const filteredMetrics = metrics.filter(m => 
                m.timestamp.getTime() > Date.now() - timeRangeMs
            );

            return {
                current: filteredMetrics[filteredMetrics.length - 1]?.metrics,
                averages: this.calculateSystemAverages(filteredMetrics),
                peaks: this.findSystemPeaks(filteredMetrics),
                timeline: this.generateSystemTimeline(filteredMetrics)
            };
        } catch (error) {
            console.error('Failed to get system analytics:', error);
            throw error;
        }
    }

    // Generate analytics report
    async generateAnalyticsReport(type, id, timeRange = '24h') {
        try {
            switch (type) {
                case 'bot':
                    return await this.getBotAnalytics(id, timeRange);
                case 'user':
                    return await this.getUserAnalytics(id, timeRange);
                case 'system':
                    return this.getSystemAnalytics(timeRange);
                default:
                    throw new Error(`Unknown analytics type: ${type}`);
            }
        } catch (error) {
            console.error('Failed to generate analytics report:', error);
            throw error;
        }
    }

    // Helper methods
    initializeBotMetrics() {
        return {
            totalExecutions: 0,
            successCount: 0,
            failureCount: 0,
            totalDuration: 0,
            averageDuration: 0,
            successRate: 100,
            errors: []
        };
    }

    initializeUserMetrics() {
        return {
            totalActions: 0,
            lastActivity: new Date(),
            activities: []
        };
    }

    parseTimeRange(timeRange) {
        const units = {
            h: 3600000,
            d: 86400000,
            w: 604800000,
            m: 2592000000
        };

        const value = parseInt(timeRange);
        const unit = timeRange.slice(-1);

        return value * (units[unit] || units.h);
    }

    filterMetricsByTime(metrics, timeRange) {
        const filteredMetrics = { ...metrics };
        const cutoff = Date.now() - timeRange;

        filteredMetrics.errors = metrics.errors.filter(error => 
            error.timestamp.getTime() > cutoff
        );

        return filteredMetrics;
    }

    filterActivitiesByTime(activities, timeRange) {
        const cutoff = Date.now() - timeRange;
        return activities.filter(activity => 
            activity.timestamp.getTime() > cutoff
        );
    }

    calculateTrends(metrics, timeRange) {
        // Implementation for calculating trends
        return {
            successRate: {
                current: metrics.successRate,
                trend: 'stable'
            },
            executionTime: {
                current: metrics.averageDuration,
                trend: 'improving'
            }
        };
    }

    getActivityBreakdown(activities) {
        const breakdown = {};
        activities.forEach(activity => {
            breakdown[activity.type] = (breakdown[activity.type] || 0) + 1;
        });
        return breakdown;
    }

    generateActivityTimeline(activities) {
        return activities.map(activity => ({
            type: activity.type,
            timestamp: activity.timestamp,
            details: activity.details
        }));
    }

    calculateSystemAverages(metrics) {
        if (metrics.length === 0) return null;

        const sums = metrics.reduce((acc, m) => ({
            cpuUsage: acc.cpuUsage + m.metrics.cpuUsage,
            memoryUsage: acc.memoryUsage + m.metrics.memoryUsage,
            activeConnections: acc.activeConnections + m.metrics.activeConnections,
            responseTime: acc.responseTime + m.metrics.responseTime
        }), { cpuUsage: 0, memoryUsage: 0, activeConnections: 0, responseTime: 0 });

        return {
            cpuUsage: sums.cpuUsage / metrics.length,
            memoryUsage: sums.memoryUsage / metrics.length,
            activeConnections: sums.activeConnections / metrics.length,
            responseTime: sums.responseTime / metrics.length
        };
    }

    findSystemPeaks(metrics) {
        if (metrics.length === 0) return null;

        return metrics.reduce((peaks, m) => ({
            cpuUsage: Math.max(peaks.cpuUsage, m.metrics.cpuUsage),
            memoryUsage: Math.max(peaks.memoryUsage, m.metrics.memoryUsage),
            activeConnections: Math.max(peaks.activeConnections, m.metrics.activeConnections),
            responseTime: Math.max(peaks.responseTime, m.metrics.responseTime)
        }), { cpuUsage: 0, memoryUsage: 0, activeConnections: 0, responseTime: 0 });
    }

    generateSystemTimeline(metrics) {
        return metrics.map(m => ({
            timestamp: m.timestamp,
            metrics: m.metrics
        }));
    }
}

module.exports = new AnalyticsService();
