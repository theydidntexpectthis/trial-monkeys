const Redis = require('ioredis');
const dbConfig = require('../config/database.config');

class LoggingService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.systemLogs = dbConfig.collections.systemLogs;
        this.metrics = dbConfig.redis.metrics;

        // Log levels and their priorities
        this.levels = {
            debug: 0,
            info: 1,
            warning: 2,
            error: 3,
            critical: 4
        };

        // Initialize monitoring
        this.initializeMonitoring();
    }

    async log(level, message, context = {}) {
        try {
            const logEntry = {
                id: `log_${Date.now()}`,
                level,
                message,
                context,
                timestamp: new Date(),
                environment: process.env.NODE_ENV
            };

            // Store log entry
            await this.storeLog(logEntry);

            // Track metrics
            await this.trackLogMetrics(level);

            // Handle critical logs
            if (this.levels[level] >= this.levels.error) {
                await this.handleCriticalLog(logEntry);
            }

            return logEntry;
        } catch (error) {
            console.error('Logging error:', error);
            // Fallback to console in case of logging failure
            console.log(level, message, context);
        }
    }

    async logApiRequest(req, res, duration) {
        const logEntry = {
            type: 'api_request',
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            userId: req.user?.id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: new Date()
        };

        await this.log('info', 'API Request', logEntry);
        await this.trackApiMetrics(logEntry);
    }

    async logError(error, context = {}) {
        const errorLog = {
            message: error.message,
            stack: error.stack,
            code: error.code,
            ...context
        };

        await this.log('error', error.message, errorLog);
    }

    async logSecurity(event, details) {
        const securityLog = {
            event,
            details,
            ip: details.ip,
            userId: details.userId,
            timestamp: new Date()
        };

        await this.log('warning', `Security event: ${event}`, securityLog);
        await this.trackSecurityMetrics(event);
    }

    async logPerformance(metric, value, tags = {}) {
        const performanceLog = {
            metric,
            value,
            tags,
            timestamp: new Date()
        };

        await this.log('info', `Performance metric: ${metric}`, performanceLog);
        await this.trackPerformanceMetrics(metric, value);
    }

    async queryLogs(filters = {}) {
        try {
            const { level, startDate, endDate, search, limit = 100 } = filters;

            // Build query based on filters
            const query = this.buildLogQuery(filters);

            // Get logs from storage
            const logs = await this.fetchLogs(query, limit);

            return {
                logs,
                total: await this.countLogs(query),
                metrics: await this.getLogMetrics(startDate, endDate)
            };
        } catch (error) {
            console.error('Log query error:', error);
            throw error;
        }
    }

    async getErrorSummary(timeframe = '24h') {
        try {
            const errors = await this.fetchErrorLogs(timeframe);
            return this.summarizeErrors(errors);
        } catch (error) {
            console.error('Error summary error:', error);
            throw error;
        }
    }

    async getSystemHealth() {
        try {
            const [errors, performance, security] = await Promise.all([
                this.getRecentErrors(),
                this.getPerformanceMetrics(),
                this.getSecurityEvents()
            ]);

            return {
                status: this.calculateSystemStatus(errors, performance),
                errors,
                performance,
                security
            };
        } catch (error) {
            console.error('System health check error:', error);
            throw error;
        }
    }

    // Monitoring Methods
    initializeMonitoring() {
        // Monitor API health
        setInterval(() => this.monitorApiHealth(), 60000);

        // Monitor error rates
        setInterval(() => this.monitorErrorRates(), 300000);

        // Monitor performance
        setInterval(() => this.monitorPerformance(), 60000);
    }

    async monitorApiHealth() {
        const metrics = await this.getApiMetrics();
        const status = this.calculateApiHealth(metrics);

        if (status.hasIssues) {
            await this.handleApiHealthIssues(status);
        }
    }

    async monitorErrorRates() {
        const errorRates = await this.getErrorRates();
        if (this.isErrorRateHigh(errorRates)) {
            await this.handleHighErrorRate(errorRates);
        }
    }

    async monitorPerformance() {
        const metrics = await this.getPerformanceMetrics();
        if (this.hasPerformanceIssues(metrics)) {
            await this.handlePerformanceIssues(metrics);
        }
    }

    // Metric Tracking Methods
    async trackLogMetrics(level) {
        const key = `${this.metrics.logs}:${level}:${this.getCurrentPeriod()}`;
        await this.redis.incr(key);
    }

    async trackApiMetrics(logEntry) {
        const period = this.getCurrentPeriod();
        const multi = this.redis.multi();

        // Track response status
        multi.hincrby(
            `${this.metrics.api}:status:${period}`,
            logEntry.status,
            1
        );

        // Track response time
        multi.lpush(
            `${this.metrics.api}:duration:${period}`,
            logEntry.duration
        );

        await multi.exec();
    }

    async trackSecurityMetrics(event) {
        const key = `${this.metrics.security}:${event}:${this.getCurrentPeriod()}`;
        await this.redis.incr(key);
    }

    async trackPerformanceMetrics(metric, value) {
        const key = `${this.metrics.performance}:${metric}:${this.getCurrentPeriod()}`;
        await this.redis.lpush(key, value);
    }

    // Helper Methods
    getCurrentPeriod() {
        return Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute periods
    }

    async storeLog(logEntry) {
        await this.redis.lpush(
            `logs:${logEntry.level}`,
            JSON.stringify(logEntry)
        );
    }

    buildLogQuery(filters) {
        // Implementation depends on your storage solution
        return filters;
    }

    async handleCriticalLog(logEntry) {
        // Send notifications for critical logs
        // Implementation depends on your notification system
    }

    calculateSystemStatus(errors, performance) {
        // Implementation for calculating system status
        return 'healthy';
    }

    async handleApiHealthIssues(status) {
        // Implementation for handling API health issues
    }

    async handleHighErrorRate(errorRates) {
        // Implementation for handling high error rates
    }

    async handlePerformanceIssues(metrics) {
        // Implementation for handling performance issues
    }

    // These methods would be implemented based on your storage solution
    async fetchLogs(query, limit) {}
    async countLogs(query) {}
    async getLogMetrics(startDate, endDate) {}
    async fetchErrorLogs(timeframe) {}
    async summarizeErrors(errors) {}
    async getRecentErrors() {}
    async getPerformanceMetrics() {}
    async getSecurityEvents() {}
    async getApiMetrics() {}
    async getErrorRates() {}
    async calculateApiHealth(metrics) {}
    isErrorRateHigh(errorRates) {}
    hasPerformanceIssues(metrics) {}
}

module.exports = new LoggingService();
