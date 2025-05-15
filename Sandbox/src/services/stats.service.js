const Bot = require('../models/bot.model');
const User = require('../models/user.model');
const Redis = require('ioredis');
const config = require('../config/config');

class StatsService {
    constructor() {
        this.redis = new Redis(config.redis.url);
        this.STATS_CACHE_TTL = 300; // 5 minutes
        this.initializePeriodicUpdate();
    }

    // Initialize periodic stats update
    initializePeriodicUpdate() {
        setInterval(() => {
            this.updateGlobalStats();
        }, 300000); // Update every 5 minutes
    }

    // Update global statistics
    async updateGlobalStats() {
        try {
            const stats = await this.calculateGlobalStats();
            await this.redis.setex('global_stats', this.STATS_CACHE_TTL, JSON.stringify(stats));
            return stats;
        } catch (error) {
            console.error('Failed to update global stats:', error);
            throw error;
        }
    }

    // Calculate global statistics
    async calculateGlobalStats() {
        try {
            const [bots, users] = await Promise.all([
                Bot.find({ status: 'active' }),
                User.find({ isActive: true })
            ]);

            const totalTrials = users.reduce((sum, user) => 
                sum + user.trialAccounts.length, 0);

            const activeTrials = users.reduce((sum, user) => 
                sum + user.trialAccounts.filter(trial => 
                    trial.status === 'active' && 
                    trial.expiresAt > new Date()
                ).length, 0);

            const successfulTrials = users.reduce((sum, user) => 
                sum + user.trialAccounts.filter(trial => 
                    trial.status === 'completed'
                ).length, 0);

            const categoryStats = this.calculateCategoryStats(bots);
            const botSuccessRates = this.calculateBotSuccessRates(bots);

            return {
                overview: {
                    totalBots: bots.length,
                    totalUsers: users.length,
                    totalTrials,
                    activeTrials,
                    successRate: (successfulTrials / totalTrials * 100) || 0
                },
                categories: categoryStats,
                botPerformance: botSuccessRates,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Failed to calculate global stats:', error);
            throw error;
        }
    }

    // Calculate category statistics
    calculateCategoryStats(bots) {
        const categories = {};
        bots.forEach(bot => {
            if (!categories[bot.category]) {
                categories[bot.category] = {
                    total: 0,
                    active: 0,
                    averageSuccess: 0
                };
            }
            
            categories[bot.category].total++;
            if (bot.status === 'active') {
                categories[bot.category].active++;
                categories[bot.category].averageSuccess += bot.statistics.averageSuccessRate;
            }
        });

        // Calculate averages
        Object.values(categories).forEach(category => {
            if (category.active > 0) {
                category.averageSuccess = category.averageSuccess / category.active;
            }
        });

        return categories;
    }

    // Calculate bot success rates
    calculateBotSuccessRates(bots) {
        return bots
            .filter(bot => bot.statistics.totalRuns > 0)
            .map(bot => ({
                id: bot._id,
                name: bot.name,
                category: bot.category,
                successRate: bot.statistics.averageSuccessRate,
                totalRuns: bot.statistics.totalRuns,
                averageRunTime: bot.statistics.averageRunTime
            }))
            .sort((a, b) => b.successRate - a.successRate);
    }

    // Get global statistics
    async getGlobalStats() {
        try {
            const cachedStats = await this.redis.get('global_stats');
            if (cachedStats) {
                return JSON.parse(cachedStats);
            }
            return this.updateGlobalStats();
        } catch (error) {
            console.error('Failed to get global stats:', error);
            throw error;
        }
    }

    // Get user statistics
    async getUserStats(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const trials = user.trialAccounts;
            const activeTrials = trials.filter(trial => 
                trial.status === 'active' && 
                trial.expiresAt > new Date()
            );

            return {
                totalTrials: trials.length,
                activeTrials: activeTrials.length,
                completedTrials: trials.filter(trial => trial.status === 'completed').length,
                failedTrials: trials.filter(trial => trial.status === 'failed').length,
                trialsByCategory: this.calculateUserTrialsByCategory(trials),
                recentActivity: this.getRecentActivity(trials),
                subscriptionStatus: user.subscription
            };
        } catch (error) {
            console.error('Failed to get user stats:', error);
            throw error;
        }
    }

    // Calculate user trials by category
    calculateUserTrialsByCategory(trials) {
        const categories = {};
        trials.forEach(trial => {
            const category = trial.serviceName.split(' ')[0].toLowerCase();
            if (!categories[category]) {
                categories[category] = {
                    total: 0,
                    active: 0,
                    completed: 0
                };
            }
            
            categories[category].total++;
            if (trial.status === 'active' && trial.expiresAt > new Date()) {
                categories[category].active++;
            } else if (trial.status === 'completed') {
                categories[category].completed++;
            }
        });
        return categories;
    }

    // Get recent activity
    getRecentActivity(trials) {
        return trials
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 10)
            .map(trial => ({
                serviceName: trial.serviceName,
                status: trial.status,
                createdAt: trial.createdAt,
                expiresAt: trial.expiresAt
            }));
    }

    // Get bot-specific statistics
    async getBotStats(botId) {
        try {
            const bot = await Bot.findById(botId);
            if (!bot) throw new Error('Bot not found');

            return {
                general: {
                    name: bot.name,
                    category: bot.category,
                    status: bot.status,
                    version: bot.version
                },
                performance: {
                    totalRuns: bot.statistics.totalRuns,
                    successfulRuns: bot.statistics.successfulRuns,
                    failedRuns: bot.statistics.failedRuns,
                    averageSuccessRate: bot.statistics.averageSuccessRate,
                    averageRunTime: bot.statistics.averageRunTime
                },
                maintenance: {
                    lastCheck: bot.maintenance.lastCheck,
                    nextCheck: bot.maintenance.nextCheck,
                    openIssues: bot.maintenance.issues.filter(issue => 
                        issue.status === 'open'
                    ).length
                },
                usage: await this.getBotUsageStats(botId)
            };
        } catch (error) {
            console.error('Failed to get bot stats:', error);
            throw error;
        }
    }

    // Get bot usage statistics
    async getBotUsageStats(botId) {
        const users = await User.find({
            'trialAccounts.serviceName': botId
        });

        const usage = {
            totalUsers: users.length,
            successRate: 0,
            averageTrialDuration: 0,
            userSubscriptions: {
                free: 0,
                basic: 0,
                premium: 0
            }
        };

        let totalDuration = 0;
        let successfulTrials = 0;
        let totalTrials = 0;

        users.forEach(user => {
            usage.userSubscriptions[user.subscription.plan]++;
            
            const trials = user.trialAccounts.filter(trial => 
                trial.serviceName === botId
            );

            trials.forEach(trial => {
                totalTrials++;
                if (trial.status === 'completed') {
                    successfulTrials++;
                    totalDuration += (trial.expiresAt - trial.createdAt);
                }
            });
        });

        usage.successRate = (successfulTrials / totalTrials * 100) || 0;
        usage.averageTrialDuration = totalTrials ? totalDuration / totalTrials : 0;

        return usage;
    }
}

module.exports = new StatsService();
