const Bot = require('../models/bot-management.model');
const NotificationService = require('./notification.service');
const config = require('../config/config');

class BotLoggerService {
    constructor() {
        this.logBuffer = new Map(); // Buffer for batch processing
        this.bufferSize = config.logging?.bufferSize || 100;
        this.flushInterval = config.logging?.flushInterval || 60000; // 1 minute
        this.retentionPeriod = config.logging?.retentionPeriod || 30; // 30 days

        this.initializeLogger();
    }

    // Initialize logger
    initializeLogger() {
        // Set up periodic buffer flush
        setInterval(() => this.flushLogBuffer(), this.flushInterval);
        
        // Set up periodic log cleanup
        setInterval(() => this.cleanupOldLogs(), 86400000); // Daily cleanup
    }

    // Log bot activity
    async logActivity(botId, level, message, details = {}) {
        try {
            const logEntry = {
                timestamp: new Date(),
                level,
                message,
                details: this.sanitizeDetails(details)
            };

            // Add to buffer
            if (!this.logBuffer.has(botId)) {
                this.logBuffer.set(botId, []);
            }
            this.logBuffer.get(botId).push(logEntry);

            // Flush buffer if it reaches threshold
            if (this.logBuffer.get(botId).length >= this.bufferSize) {
                await this.flushBotLogs(botId);
            }

            // Handle critical logs immediately
            if (level === 'error') {
                await this.handleCriticalLog(botId, logEntry);
            }

            return logEntry;
        } catch (error) {
            console.error('Failed to log activity:', error);
            throw error;
        }
    }

    // Flush log buffer for specific bot
    async flushBotLogs(botId) {
        try {
            const logs = this.logBuffer.get(botId);
            if (!logs || logs.length === 0) return;

            const bot = await Bot.findById(botId);
            if (!bot) {
                this.logBuffer.delete(botId);
                return;
            }

            // Add logs to bot
            bot.logs.push(...logs);

            // Maintain log size limit
            if (bot.logs.length > 1000) {
                bot.logs = bot.logs.slice(-1000);
            }

            await bot.save();
            this.logBuffer.set(botId, []); // Clear buffer

            // Update performance metrics if needed
            await this.updatePerformanceMetrics(bot, logs);

        } catch (error) {
            console.error(`Failed to flush logs for bot ${botId}:`, error);
        }
    }

    // Flush all log buffers
    async flushLogBuffer() {
        const botIds = Array.from(this.logBuffer.keys());
        await Promise.all(botIds.map(botId => this.flushBotLogs(botId)));
    }

    // Handle critical logs
    async handleCriticalLog(botId, logEntry) {
        try {
            const bot = await Bot.findById(botId);
            if (!bot) return;

            // Send notification
            await NotificationService.sendToUser(bot.userId, {
                type: 'bot_error',
                title: `Bot Error: ${bot.name}`,
                message: logEntry.message,
                severity: 'high',
                details: logEntry.details
            });

            // Update bot status if necessary
            if (this.isCriticalError(logEntry)) {
                bot.status = 'failed';
                await bot.save();
            }

        } catch (error) {
            console.error('Failed to handle critical log:', error);
        }
    }

    // Get logs for specific bot
    async getBotLogs(botId, options = {}) {
        try {
            const {
                startDate,
                endDate,
                level,
                limit = 100,
                skip = 0
            } = options;

            const bot = await Bot.findById(botId);
            if (!bot) throw new Error('Bot not found');

            // Get logs from buffer and database
            let logs = [...(this.logBuffer.get(botId) || []), ...bot.logs];

            // Apply filters
            if (startDate) {
                logs = logs.filter(log => log.timestamp >= new Date(startDate));
            }
            if (endDate) {
                logs = logs.filter(log => log.timestamp <= new Date(endDate));
            }
            if (level) {
                logs = logs.filter(log => log.level === level);
            }

            // Sort by timestamp descending
            logs.sort((a, b) => b.timestamp - a.timestamp);

            // Apply pagination
            return logs.slice(skip, skip + limit);

        } catch (error) {
            console.error('Failed to get bot logs:', error);
            throw error;
        }
    }

    // Get error summary
    async getErrorSummary(botId, timeRange = '24h') {
        try {
            const bot = await Bot.findById(botId);
            if (!bot) throw new Error('Bot not found');

            const startTime = this.getStartTimeFromRange(timeRange);
            const logs = [...(this.logBuffer.get(botId) || []), ...bot.logs]
                .filter(log => log.level === 'error' && log.timestamp >= startTime);

            // Group errors by type
            const errorSummary = logs.reduce((summary, log) => {
                const errorType = log.details.type || 'unknown';
                if (!summary[errorType]) {
                    summary[errorType] = {
                        count: 0,
                        lastOccurrence: null,
                        examples: []
                    };
                }

                summary[errorType].count++;
                summary[errorType].lastOccurrence = log.timestamp;
                if (summary[errorType].examples.length < 3) {
                    summary[errorType].examples.push(log.message);
                }

                return summary;
            }, {});

            return errorSummary;

        } catch (error) {
            console.error('Failed to get error summary:', error);
            throw error;
        }
    }

    // Update performance metrics based on logs
    async updatePerformanceMetrics(bot, logs) {
        const errors = logs.filter(log => log.level === 'error').length;
        const total = logs.length;

        if (total > 0) {
            const successRate = ((total - errors) / total) * 100;
            
            // Update bot statistics
            bot.statistics.averageSuccessRate = 
                (bot.statistics.averageSuccessRate + successRate) / 2;
            
            await bot.save();
        }
    }

    // Clean up old logs
    async cleanupOldLogs() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionPeriod);

            const bots = await Bot.find({});
            for (const bot of bots) {
                bot.logs = bot.logs.filter(log => log.timestamp >= cutoffDate);
                await bot.save();
            }
        } catch (error) {
            console.error('Failed to clean up old logs:', error);
        }
    }

    // Helper methods
    sanitizeDetails(details) {
        // Remove sensitive information
        const sanitized = { ...details };
        const sensitiveFields = ['password', 'token', 'key', 'secret'];
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) sanitized[field] = '[REDACTED]';
        });

        return sanitized;
    }

    isCriticalError(logEntry) {
        const criticalPatterns = [
            'authentication failed',
            'connection refused',
            'access denied',
            'quota exceeded',
            'account blocked'
        ];

        return criticalPatterns.some(pattern => 
            logEntry.message.toLowerCase().includes(pattern)
        );
    }

    getStartTimeFromRange(timeRange) {
        const now = new Date();
        const match = timeRange.match(/^(\d+)([hdwm])$/);
        
        if (!match) return new Date(0);

        const [, amount, unit] = match;
        switch (unit) {
            case 'h':
                now.setHours(now.getHours() - parseInt(amount));
                break;
            case 'd':
                now.setDate(now.getDate() - parseInt(amount));
                break;
            case 'w':
                now.setDate(now.getDate() - (parseInt(amount) * 7));
                break;
            case 'm':
                now.setMonth(now.getMonth() - parseInt(amount));
                break;
        }

        return now;
    }

    // Export logs
    async exportLogs(botId, format = 'json', options = {}) {
        try {
            const logs = await this.getBotLogs(botId, options);

            switch (format.toLowerCase()) {
                case 'json':
                    return JSON.stringify(logs, null, 2);
                
                case 'csv':
                    return this.convertLogsToCSV(logs);
                
                case 'text':
                    return this.convertLogsToText(logs);
                
                default:
                    throw new Error('Unsupported export format');
            }
        } catch (error) {
            console.error('Failed to export logs:', error);
            throw error;
        }
    }

    convertLogsToCSV(logs) {
        const headers = ['Timestamp', 'Level', 'Message', 'Details'];
        const rows = logs.map(log => [
            log.timestamp.toISOString(),
            log.level,
            log.message,
            JSON.stringify(log.details)
        ]);

        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    convertLogsToText(logs) {
        return logs.map(log => 
            `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()}: ${log.message}\n` +
            `Details: ${JSON.stringify(log.details, null, 2)}\n`
        ).join('\n');
    }
}

module.exports = new BotLoggerService();
