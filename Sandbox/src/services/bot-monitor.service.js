const Bot = require('../models/bot-management.model');
const ProxyService = require('./proxy.service');
const NotificationService = require('./notification.service');
const config = require('../config/config');

class BotMonitorService {
    constructor() {
        this.monitoringIntervals = new Map();
        this.healthChecks = new Map();
        this.alertThresholds = {
            successRate: 90,
            responseTime: 5000,
            failureStreak: 3,
            proxyErrors: 5
        };
        this.initializeMonitoring();
    }

    // Initialize monitoring system
    async initializeMonitoring() {
        try {
            // Load active bots
            const activeBots = await Bot.getActiveBots();
            
            // Set up monitoring for each active bot
            activeBots.forEach(bot => {
                this.startBotMonitoring(bot._id);
            });

            // Schedule periodic health checks
            setInterval(() => this.runHealthChecks(), 300000); // Every 5 minutes
            setInterval(() => this.cleanupMonitoring(), 3600000); // Every hour
        } catch (error) {
            console.error('Failed to initialize bot monitoring:', error);
        }
    }

    // Start monitoring specific bot
    async startBotMonitoring(botId) {
        try {
            const bot = await Bot.findById(botId);
            if (!bot) throw new Error('Bot not found');

            // Initialize health check data
            this.healthChecks.set(botId, {
                lastCheck: null,
                status: 'healthy',
                metrics: {
                    successRate: 100,
                    responseTime: 0,
                    failureStreak: 0,
                    proxyErrors: 0
                },
                issues: []
            });

            // Set up monitoring interval
            const interval = setInterval(() => this.checkBotHealth(botId), 60000); // Every minute
            this.monitoringIntervals.set(botId, interval);

            // Log monitoring start
            await bot.addLog('info', 'Bot monitoring started');
        } catch (error) {
            console.error(`Failed to start monitoring for bot ${botId}:`, error);
        }
    }

    // Stop monitoring specific bot
    async stopBotMonitoring(botId) {
        try {
            // Clear monitoring interval
            const interval = this.monitoringIntervals.get(botId);
            if (interval) {
                clearInterval(interval);
                this.monitoringIntervals.delete(botId);
            }

            // Clear health check data
            this.healthChecks.delete(botId);

            // Log monitoring stop
            const bot = await Bot.findById(botId);
            if (bot) {
                await bot.addLog('info', 'Bot monitoring stopped');
            }
        } catch (error) {
            console.error(`Failed to stop monitoring for bot ${botId}:`, error);
        }
    }

    // Check bot health
    async checkBotHealth(botId) {
        try {
            const bot = await Bot.findById(botId);
            if (!bot) throw new Error('Bot not found');

            const health = this.healthChecks.get(botId);
            if (!health) return;

            // Run health checks
            const checks = await Promise.all([
                this.checkPerformance(bot),
                this.checkProxyHealth(bot),
                this.checkResourceAvailability(bot)
            ]);

            // Update health metrics
            health.lastCheck = new Date();
            health.metrics = {
                ...health.metrics,
                ...this.aggregateHealthChecks(checks)
            };

            // Detect issues
            const issues = this.detectIssues(bot, health.metrics);
            if (issues.length > 0) {
                await this.handleIssues(bot, issues);
            }

            // Update bot health status
            health.status = this.determineHealthStatus(health.metrics);
            this.healthChecks.set(botId, health);

            // Update bot monitoring status
            bot.monitoring.health.status = health.status;
            bot.monitoring.health.lastCheck = health.lastCheck;
            await bot.save();

        } catch (error) {
            console.error(`Health check failed for bot ${botId}:`, error);
            await this.logHealthCheckError(botId, error);
        }
    }

    // Check bot performance
    async checkPerformance(bot) {
        const { statistics } = bot;
        return {
            successRate: statistics.averageSuccessRate,
            responseTime: statistics.averageRunTime,
            failureStreak: this.calculateFailureStreak(bot.logs)
        };
    }

    // Check proxy health
    async checkProxyHealth(bot) {
        if (!bot.config.useProxy) return { proxyErrors: 0 };

        try {
            const proxy = await ProxyService.getProxy({ type: bot.config.proxyConfig.type });
            const testResult = await ProxyService.testProxy(proxy);
            
            return {
                proxyErrors: testResult.success ? 0 : 1
            };
        } catch (error) {
            return { proxyErrors: 1 };
        }
    }

    // Check resource availability
    async checkResourceAvailability(bot) {
        try {
            const response = await fetch(bot.config.customConfig.serviceUrl, {
                method: 'HEAD',
                timeout: 5000
            });
            
            return {
                resourceAvailable: response.ok,
                responseTime: response.headers.get('x-response-time')
            };
        } catch (error) {
            return {
                resourceAvailable: false,
                responseTime: this.alertThresholds.responseTime
            };
        }
    }

    // Aggregate health checks
    aggregateHealthChecks(checks) {
        return checks.reduce((metrics, check) => ({
            ...metrics,
            ...check
        }), {});
    }

    // Detect issues
    detectIssues(bot, metrics) {
        const issues = [];

        // Check success rate
        if (metrics.successRate < this.alertThresholds.successRate) {
            issues.push({
                type: 'performance',
                description: `Success rate below threshold: ${metrics.successRate}%`,
                severity: metrics.successRate < 70 ? 'high' : 'medium'
            });
        }

        // Check failure streak
        if (metrics.failureStreak >= this.alertThresholds.failureStreak) {
            issues.push({
                type: 'reliability',
                description: `Consecutive failures: ${metrics.failureStreak}`,
                severity: 'high'
            });
        }

        // Check proxy errors
        if (metrics.proxyErrors >= this.alertThresholds.proxyErrors) {
            issues.push({
                type: 'proxy',
                description: 'Multiple proxy errors detected',
                severity: 'medium'
            });
        }

        return issues;
    }

    // Handle detected issues
    async handleIssues(bot, issues) {
        for (const issue of issues) {
            // Add issue to bot monitoring
            await bot.addMonitoringIssue(
                issue.type,
                issue.description,
                issue.severity
            );

            // Send notification
            await NotificationService.sendToUser(bot.userId, {
                type: 'bot_issue',
                title: `Bot Issue: ${bot.name}`,
                message: issue.description,
                severity: issue.severity
            });

            // Take automated action based on severity
            if (issue.severity === 'high') {
                await this.handleHighSeverityIssue(bot, issue);
            }
        }
    }

    // Handle high severity issues
    async handleHighSeverityIssue(bot, issue) {
        // Pause bot
        bot.status = 'paused';
        await bot.save();

        // Log critical issue
        await bot.addLog('error', `Bot paused due to critical issue: ${issue.description}`);

        // Send urgent notification
        await NotificationService.sendToUser(bot.userId, {
            type: 'bot_critical',
            title: 'Critical Bot Issue',
            message: `${bot.name} has been paused due to critical issues`,
            severity: 'high'
        });
    }

    // Determine overall health status
    determineHealthStatus(metrics) {
        if (metrics.failureStreak >= this.alertThresholds.failureStreak ||
            metrics.successRate < 70) {
            return 'error';
        }

        if (metrics.successRate < this.alertThresholds.successRate ||
            metrics.proxyErrors > 0) {
            return 'warning';
        }

        return 'healthy';
    }

    // Calculate failure streak from logs
    calculateFailureStreak(logs) {
        let streak = 0;
        for (const log of logs.reverse()) {
            if (log.level === 'error') {
                streak++;
            } else {
                break;
            }
        }
        return streak;
    }

    // Log health check error
    async logHealthCheckError(botId, error) {
        try {
            const bot = await Bot.findById(botId);
            if (bot) {
                await bot.addLog('error', 'Health check failed', {
                    error: error.message,
                    stack: error.stack
                });
            }
        } catch (logError) {
            console.error('Failed to log health check error:', logError);
        }
    }

    // Clean up monitoring
    async cleanupMonitoring() {
        try {
            // Get all monitored bots
            const monitoredBotIds = Array.from(this.monitoringIntervals.keys());
            
            // Check if bots still exist and are active
            for (const botId of monitoredBotIds) {
                const bot = await Bot.findById(botId);
                if (!bot || bot.status !== 'active') {
                    await this.stopBotMonitoring(botId);
                }
            }
        } catch (error) {
            console.error('Failed to clean up monitoring:', error);
        }
    }

    // Get bot health status
    async getBotHealth(botId) {
        const health = this.healthChecks.get(botId);
        if (!health) return null;

        return {
            status: health.status,
            lastCheck: health.lastCheck,
            metrics: health.metrics,
            issues: await this.getActiveIssues(botId)
        };
    }

    // Get active issues for bot
    async getActiveIssues(botId) {
        const bot = await Bot.findById(botId);
        if (!bot) return [];

        return bot.monitoring.health.issues.filter(issue => !issue.resolved);
    }
}

module.exports = new BotMonitorService();
