const Bot = require('../models/bot.model');
const BotService = require('./bot.service');
const StatsService = require('./stats.service');
const config = require('../config/config');
const axios = require('axios');

class MonitorService {
    constructor() {
        this.healthChecks = new Map();
        this.maintenanceSchedule = new Map();
        this.alertThresholds = {
            successRate: 90,
            responseTime: 5000,
            errorRate: 10
        };
        this.initializeMonitoring();
    }

    // Initialize monitoring systems
    async initializeMonitoring() {
        try {
            const bots = await Bot.find({ status: 'active' });
            bots.forEach(bot => {
                this.setupBotMonitoring(bot._id);
            });

            // Start periodic health checks
            setInterval(() => this.runHealthChecks(), 300000); // Every 5 minutes
            setInterval(() => this.checkMaintenanceSchedule(), 3600000); // Every hour
        } catch (error) {
            console.error('Failed to initialize monitoring:', error);
        }
    }

    // Setup monitoring for a specific bot
    setupBotMonitoring(botId) {
        this.healthChecks.set(botId, {
            lastCheck: null,
            status: 'pending',
            issues: [],
            metrics: {
                successRate: 100,
                responseTime: 0,
                errorCount: 0
            }
        });
    }

    // Run health checks for all bots
    async runHealthChecks() {
        try {
            const bots = await Bot.find({ status: 'active' });
            
            for (const bot of bots) {
                await this.checkBotHealth(bot);
            }

            this.analyzeHealthMetrics();
        } catch (error) {
            console.error('Health check failed:', error);
        }
    }

    // Check individual bot health
    async checkBotHealth(bot) {
        const healthData = this.healthChecks.get(bot._id);
        if (!healthData) return;

        try {
            // Check bot configuration
            await this.validateBotConfig(bot);

            // Test bot functionality
            const testResult = await this.runBotTest(bot);

            // Update health metrics
            healthData.lastCheck = new Date();
            healthData.status = testResult.success ? 'healthy' : 'unhealthy';
            healthData.metrics = {
                ...healthData.metrics,
                ...testResult.metrics
            };

            // Check for issues
            const issues = await this.detectIssues(bot, testResult);
            if (issues.length > 0) {
                await this.handleIssues(bot, issues);
            }

            this.healthChecks.set(bot._id, healthData);
        } catch (error) {
            console.error(`Health check failed for bot ${bot.name}:`, error);
            healthData.status = 'error';
            healthData.issues.push({
                type: 'error',
                message: error.message,
                timestamp: new Date()
            });
        }
    }

    // Validate bot configuration
    async validateBotConfig(bot) {
        const validationErrors = [];

        // Check required fields
        if (!bot.config.url) validationErrors.push('Missing URL configuration');
        if (!bot.config.selectors) validationErrors.push('Missing selectors configuration');

        // Validate URL accessibility
        try {
            await axios.head(bot.config.url);
        } catch (error) {
            validationErrors.push(`URL not accessible: ${error.message}`);
        }

        if (validationErrors.length > 0) {
            throw new Error(`Configuration validation failed: ${validationErrors.join(', ')}`);
        }
    }

    // Run bot test
    async runBotTest(bot) {
        const startTime = Date.now();
        const metrics = {
            responseTime: 0,
            successRate: 0,
            errorCount: 0
        };

        try {
            // Initialize test instance
            const instance = await BotService.initializeBotInstance(bot._id, 'system_test');
            
            // Run minimal test sequence
            await BotService.runBot(instance.id);

            metrics.responseTime = Date.now() - startTime;
            metrics.successRate = 100;

            return {
                success: true,
                metrics
            };
        } catch (error) {
            metrics.responseTime = Date.now() - startTime;
            metrics.successRate = 0;
            metrics.errorCount = 1;

            return {
                success: false,
                metrics,
                error
            };
        }
    }

    // Detect bot issues
    async detectIssues(bot, testResult) {
        const issues = [];
        const healthData = this.healthChecks.get(bot._id);

        // Check success rate
        if (testResult.metrics.successRate < this.alertThresholds.successRate) {
            issues.push({
                type: 'performance',
                severity: 'high',
                message: `Success rate below threshold: ${testResult.metrics.successRate}%`
            });
        }

        // Check response time
        if (testResult.metrics.responseTime > this.alertThresholds.responseTime) {
            issues.push({
                type: 'performance',
                severity: 'medium',
                message: `High response time: ${testResult.metrics.responseTime}ms`
            });
        }

        // Check error rate
        const recentErrors = healthData.issues.filter(issue => 
            issue.timestamp > new Date(Date.now() - 3600000)
        ).length;

        if (recentErrors > this.alertThresholds.errorRate) {
            issues.push({
                type: 'reliability',
                severity: 'high',
                message: `High error rate: ${recentErrors} errors in last hour`
            });
        }

        return issues;
    }

    // Handle detected issues
    async handleIssues(bot, issues) {
        for (const issue of issues) {
            // Log issue
            await bot.reportIssue(issue.type, issue.message);

            // Take automated action based on severity
            switch (issue.severity) {
                case 'high':
                    await this.handleHighSeverityIssue(bot, issue);
                    break;
                case 'medium':
                    await this.handleMediumSeverityIssue(bot, issue);
                    break;
                default:
                    await this.handleLowSeverityIssue(bot, issue);
            }
        }
    }

    // Handle high severity issues
    async handleHighSeverityIssue(bot, issue) {
        // Update bot status
        bot.status = 'maintenance';
        await bot.save();

        // Schedule immediate maintenance
        this.scheduleMaintenanceCheck(bot._id, 0);

        // Send alert
        await this.sendAlert({
            level: 'critical',
            botId: bot._id,
            botName: bot.name,
            issue: issue
        });
    }

    // Handle medium severity issues
    async handleMediumSeverityIssue(bot, issue) {
        // Schedule maintenance if multiple medium issues
        const healthData = this.healthChecks.get(bot._id);
        const recentMediumIssues = healthData.issues.filter(i => 
            i.severity === 'medium' && 
            i.timestamp > new Date(Date.now() - 86400000)
        ).length;

        if (recentMediumIssues >= 3) {
            this.scheduleMaintenanceCheck(bot._id, 3600000); // 1 hour
        }

        // Send alert
        await this.sendAlert({
            level: 'warning',
            botId: bot._id,
            botName: bot.name,
            issue: issue
        });
    }

    // Handle low severity issues
    async handleLowSeverityIssue(bot, issue) {
        // Log for monitoring
        console.log(`Low severity issue detected for bot ${bot.name}:`, issue);
    }

    // Schedule maintenance check
    scheduleMaintenanceCheck(botId, delay) {
        this.maintenanceSchedule.set(botId, {
            scheduledTime: Date.now() + delay,
            completed: false
        });
    }

    // Check maintenance schedule
    async checkMaintenanceSchedule() {
        const now = Date.now();

        for (const [botId, schedule] of this.maintenanceSchedule) {
            if (!schedule.completed && schedule.scheduledTime <= now) {
                await this.performMaintenance(botId);
            }
        }
    }

    // Perform maintenance
    async performMaintenance(botId) {
        try {
            const bot = await Bot.findById(botId);
            if (!bot) return;

            // Perform maintenance checks
            await this.validateBotConfig(bot);
            const testResult = await this.runBotTest(bot);

            if (testResult.success) {
                // Restore bot to active status
                bot.status = 'active';
                await bot.save();

                // Clear maintenance schedule
                this.maintenanceSchedule.delete(botId);
            } else {
                // Schedule another check
                this.scheduleMaintenanceCheck(botId, 3600000); // 1 hour
            }
        } catch (error) {
            console.error(`Maintenance failed for bot ${botId}:`, error);
        }
    }

    // Send alert
    async sendAlert(alert) {
        // Implementation would depend on your alert system
        console.log('Alert:', alert);
        // You could integrate with services like PagerDuty, Slack, etc.
    }

    // Get monitoring status
    async getMonitoringStatus(botId) {
        const healthData = this.healthChecks.get(botId);
        if (!healthData) return null;

        return {
            lastCheck: healthData.lastCheck,
            status: healthData.status,
            metrics: healthData.metrics,
            issues: healthData.issues.slice(-10), // Last 10 issues
            maintenance: this.maintenanceSchedule.get(botId)
        };
    }
}

module.exports = new MonitorService();
