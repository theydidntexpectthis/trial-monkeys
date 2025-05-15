const Bot = require('../models/bot-management.model');
const User = require('../models/user.model');
const StatsService = require('../services/stats.service');
const MonitorService = require('../services/monitor.service');
const NotificationService = require('../services/notification.service');
const TrialAccountService = require('../services/trial-account.service');

class OverviewController {
    // Get dashboard overview data
    async getDashboardOverview(req, res) {
        try {
            const userId = req.user.userId;
            
            // Fetch all required data concurrently
            const [
                stats,
                charts,
                activity,
                trials,
                systemStatus
            ] = await Promise.all([
                this.getStats(userId),
                this.getChartData(userId),
                this.getActivityData(userId),
                this.getTrialsData(userId),
                this.getSystemStatus()
            ]);

            res.json({
                success: true,
                stats,
                charts,
                activity,
                trials,
                systemStatus
            });
        } catch (error) {
            console.error('Failed to get dashboard overview:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get dashboard overview',
                error: error.message
            });
        }
    }

    // Get user statistics
    async getStats(userId) {
        try {
            const [
                user,
                bots,
                activeTrials
            ] = await Promise.all([
                User.findById(userId),
                Bot.find({ userId }),
                TrialAccountService.getCurrentTrials(userId)
            ]);

            // Calculate success rate
            const totalRuns = bots.reduce((sum, bot) => sum + bot.statistics.totalRuns, 0);
            const successfulRuns = bots.reduce((sum, bot) => sum + bot.statistics.successfulRuns, 0);
            const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

            // Calculate time saved (estimated)
            const averageManualTime = 15; // minutes per trial
            const timeSaved = successfulRuns * averageManualTime;

            // Calculate trends
            const trends = await this.calculateTrends(userId);

            return {
                activeTrials: activeTrials.length,
                activeBots: bots.filter(bot => bot.status === 'active').length,
                timeSaved,
                successRate: Math.round(successRate),
                trends
            };
        } catch (error) {
            console.error('Failed to get stats:', error);
            throw error;
        }
    }

    // Get chart data
    async getChartData(userId) {
        try {
            // Get success rate over time
            const successRateData = await StatsService.getSuccessRateHistory(userId);

            // Get trial distribution
            const trials = await TrialAccountService.getCurrentTrials(userId);
            const distribution = {
                active: trials.filter(t => t.status === 'active').length,
                completed: trials.filter(t => t.status === 'completed').length,
                failed: trials.filter(t => t.status === 'failed').length
            };

            return {
                successRate: {
                    labels: successRateData.map(d => d.date),
                    values: successRateData.map(d => d.rate)
                },
                distribution
            };
        } catch (error) {
            console.error('Failed to get chart data:', error);
            throw error;
        }
    }

    // Get activity data
    async getActivityData(userId) {
        try {
            const user = await User.findById(userId);
            
            // Get recent activity
            const activity = user.activityLog || [];
            
            // Sort by timestamp descending and limit to 10 items
            return activity
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10)
                .map(item => ({
                    type: item.type,
                    message: item.message,
                    timestamp: item.timestamp
                }));
        } catch (error) {
            console.error('Failed to get activity data:', error);
            throw error;
        }
    }

    // Get trials data
    async getTrialsData(userId) {
        try {
            const trials = await TrialAccountService.getCurrentTrials(userId);
            
            // Sort by creation date descending and limit to 5 items
            return trials
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 5)
                .map(trial => ({
                    name: trial.serviceName,
                    status: trial.status,
                    createdAt: trial.createdAt
                }));
        } catch (error) {
            console.error('Failed to get trials data:', error);
            throw error;
        }
    }

    // Get system status
    async getSystemStatus() {
        try {
            const [
                apiStatus,
                botStatus,
                proxyStatus,
                captchaStatus
            ] = await Promise.all([
                this.checkApiStatus(),
                this.checkBotServiceStatus(),
                this.checkProxyStatus(),
                this.checkCaptchaStatus()
            ]);

            return {
                api: apiStatus,
                botService: botStatus,
                proxyNetwork: proxyStatus,
                captchaService: captchaStatus
            };
        } catch (error) {
            console.error('Failed to get system status:', error);
            throw error;
        }
    }

    // Calculate trends
    async calculateTrends(userId) {
        try {
            const now = new Date();
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

            // Get historical data
            const [currentStats, previousStats] = await Promise.all([
                StatsService.getStatsByDateRange(userId, weekAgo, now),
                StatsService.getStatsByDateRange(userId, 
                    new Date(weekAgo - 7 * 24 * 60 * 60 * 1000),
                    weekAgo
                )
            ]);

            // Calculate trends
            return {
                activeTrials: this.calculateTrend(
                    currentStats.activeTrials,
                    previousStats.activeTrials
                ),
                successRate: this.calculateTrend(
                    currentStats.successRate,
                    previousStats.successRate
                ),
                timeSaved: this.calculateTrend(
                    currentStats.timeSaved,
                    previousStats.timeSaved
                )
            };
        } catch (error) {
            console.error('Failed to calculate trends:', error);
            throw error;
        }
    }

    // Calculate individual trend
    calculateTrend(current, previous) {
        const difference = current - previous;
        const percentageChange = previous !== 0 ? (difference / previous) * 100 : 0;

        return {
            direction: difference > 0 ? 'positive' : difference < 0 ? 'negative' : 'neutral',
            value: `${Math.abs(Math.round(percentageChange))}%`,
            raw: percentageChange
        };
    }

    // Service status checks
    async checkApiStatus() {
        try {
            // Implement API health check
            return {
                status: 'healthy',
                message: 'Operational'
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Service Disruption'
            };
        }
    }

    async checkBotServiceStatus() {
        try {
            const status = await MonitorService.getServiceHealth();
            return {
                status: status.healthy ? 'healthy' : 'warning',
                message: status.healthy ? 'Operational' : 'Degraded Performance'
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Service Disruption'
            };
        }
    }

    async checkProxyStatus() {
        try {
            const status = await require('../services/proxy.service').getProxyPoolStats();
            const healthyProxies = status.total - status.failed;
            const healthPercentage = (healthyProxies / status.total) * 100;

            return {
                status: healthPercentage > 90 ? 'healthy' : 'warning',
                message: healthPercentage > 90 ? 'Operational' : 'Degraded Performance'
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Service Disruption'
            };
        }
    }

    async checkCaptchaStatus() {
        try {
            // Implement CAPTCHA service health check
            return {
                status: 'healthy',
                message: 'Operational'
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Service Disruption'
            };
        }
    }

    // Handle real-time updates
    async broadcastUpdate(userId) {
        try {
            const data = await this.getDashboardData(userId);
            NotificationService.sendToUser(userId, {
                type: 'dashboard_update',
                data
            });
        } catch (error) {
            console.error('Failed to broadcast update:', error);
        }
    }
}

module.exports = new OverviewController();
