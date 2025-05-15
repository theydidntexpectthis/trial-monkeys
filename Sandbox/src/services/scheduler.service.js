const Queue = require('bull');
const BotService = require('./bot.service');
const MonitorService = require('./monitor.service');
const config = require('../config/config');

class SchedulerService {
    constructor() {
        // Initialize queues
        this.trialQueue = new Queue('trial-creation', config.redis.url);
        this.maintenanceQueue = new Queue('bot-maintenance', config.redis.url);
        
        // Queue settings
        this.concurrency = config.scheduler.concurrency || 5;
        this.retryLimit = config.scheduler.retryLimit || 3;
        this.rateLimits = new Map();

        this.initializeQueues();
    }

    // Initialize queue processors
    initializeQueues() {
        // Trial creation queue processor
        this.trialQueue.process(this.concurrency, async (job) => {
            try {
                const { botId, userId, parameters } = job.data;
                
                // Check rate limits
                if (this.isRateLimited(botId)) {
                    throw new Error('Rate limit exceeded');
                }

                // Update rate limit counter
                this.updateRateLimit(botId);

                // Initialize bot instance
                const instance = await BotService.initializeBotInstance(botId, userId);
                
                // Run bot
                const result = await BotService.runBot(instance.id);
                
                return result;
            } catch (error) {
                console.error('Trial creation failed:', error);
                throw error;
            }
        });

        // Maintenance queue processor
        this.maintenanceQueue.process(async (job) => {
            try {
                const { botId } = job.data;
                await MonitorService.performMaintenance(botId);
            } catch (error) {
                console.error('Maintenance job failed:', error);
                throw error;
            }
        });

        // Handle failed jobs
        this.trialQueue.on('failed', this.handleFailedJob.bind(this));
        this.maintenanceQueue.on('failed', this.handleFailedJob.bind(this));

        // Clean completed jobs periodically
        this.trialQueue.clean(86400000, 'completed'); // Clean after 24 hours
        this.maintenanceQueue.clean(86400000, 'completed');
    }

    // Schedule trial creation
    async scheduleTrialCreation(botId, userId, parameters = {}) {
        try {
            // Check if bot is available
            const status = await MonitorService.getMonitoringStatus(botId);
            if (status?.status !== 'healthy') {
                throw new Error('Bot is not available for trial creation');
            }

            // Add job to queue with retry options
            const job = await this.trialQueue.add(
                { botId, userId, parameters },
                {
                    attempts: this.retryLimit,
                    backoff: {
                        type: 'exponential',
                        delay: 1000 // Start with 1 second delay
                    },
                    removeOnComplete: true,
                    removeOnFail: false
                }
            );

            return {
                jobId: job.id,
                status: 'scheduled'
            };
        } catch (error) {
            console.error('Failed to schedule trial creation:', error);
            throw error;
        }
    }

    // Schedule maintenance
    async scheduleMaintenanceCheck(botId, priority = 'normal') {
        try {
            const options = {
                priority: priority === 'high' ? 1 : 2,
                attempts: 3,
                removeOnComplete: true
            };

            const job = await this.maintenanceQueue.add(
                { botId },
                options
            );

            return {
                jobId: job.id,
                status: 'scheduled'
            };
        } catch (error) {
            console.error('Failed to schedule maintenance:', error);
            throw error;
        }
    }

    // Check job status
    async getJobStatus(jobId, type = 'trial') {
        const queue = type === 'trial' ? this.trialQueue : this.maintenanceQueue;
        
        try {
            const job = await queue.getJob(jobId);
            if (!job) {
                return { status: 'not_found' };
            }

            const state = await job.getState();
            const progress = job._progress;
            const result = job.returnvalue;
            const error = job.failedReason;

            return {
                jobId,
                state,
                progress,
                result,
                error
            };
        } catch (error) {
            console.error('Failed to get job status:', error);
            throw error;
        }
    }

    // Handle failed jobs
    async handleFailedJob(job, err) {
        console.error(`Job ${job.id} failed:`, err);

        // If it's a trial job, update bot statistics
        if (job.queue.name === 'trial-creation') {
            const { botId } = job.data;
            await MonitorService.handleFailedTrial(botId, err);
        }

        // Log failure
        await this.logJobFailure(job, err);
    }

    // Rate limiting
    isRateLimited(botId) {
        const limit = this.rateLimits.get(botId);
        if (!limit) return false;

        const { count, timestamp } = limit;
        const timeWindow = 60000; // 1 minute
        
        return (
            Date.now() - timestamp < timeWindow &&
            count >= config.scheduler.rateLimit
        );
    }

    // Update rate limit counter
    updateRateLimit(botId) {
        const now = Date.now();
        const limit = this.rateLimits.get(botId);
        
        if (!limit || now - limit.timestamp >= 60000) {
            this.rateLimits.set(botId, {
                count: 1,
                timestamp: now
            });
        } else {
            limit.count++;
        }
    }

    // Get queue statistics
    async getQueueStats() {
        try {
            const [trialStats, maintenanceStats] = await Promise.all([
                this.trialQueue.getJobCounts(),
                this.maintenanceQueue.getJobCounts()
            ]);

            return {
                trial: {
                    ...trialStats,
                    rateLimits: Array.from(this.rateLimits.entries()).map(([botId, limit]) => ({
                        botId,
                        count: limit.count,
                        timestamp: limit.timestamp
                    }))
                },
                maintenance: maintenanceStats
            };
        } catch (error) {
            console.error('Failed to get queue stats:', error);
            throw error;
        }
    }

    // Log job failure
    async logJobFailure(job, error) {
        const failureLog = {
            jobId: job.id,
            queue: job.queue.name,
            data: job.data,
            error: error.message,
            timestamp: new Date(),
            attempts: job.attemptsMade
        };

        // Implementation would depend on your logging system
        console.error('Job failure:', failureLog);
    }

    // Pause queue
    async pauseQueue(type = 'all') {
        try {
            if (type === 'all' || type === 'trial') {
                await this.trialQueue.pause();
            }
            if (type === 'all' || type === 'maintenance') {
                await this.maintenanceQueue.pause();
            }
        } catch (error) {
            console.error('Failed to pause queue:', error);
            throw error;
        }
    }

    // Resume queue
    async resumeQueue(type = 'all') {
        try {
            if (type === 'all' || type === 'trial') {
                await this.trialQueue.resume();
            }
            if (type === 'all' || type === 'maintenance') {
                await this.maintenanceQueue.resume();
            }
        } catch (error) {
            console.error('Failed to resume queue:', error);
            throw error;
        }
    }

    // Clean up old jobs
    async cleanupOldJobs(age = 86400000) { // Default 24 hours
        try {
            await Promise.all([
                this.trialQueue.clean(age, 'completed'),
                this.trialQueue.clean(age, 'failed'),
                this.maintenanceQueue.clean(age, 'completed'),
                this.maintenanceQueue.clean(age, 'failed')
            ]);
        } catch (error) {
            console.error('Failed to clean up old jobs:', error);
            throw error;
        }
    }
}

module.exports = new SchedulerService();
