const Bot = require('../models/bot.model');
const User = require('../models/user.model');
const BotService = require('../services/bot.service');
const ProxyService = require('../services/proxy.service');
const MonitorService = require('../services/monitor.service');
const NotificationService = require('../services/notification.service');
const SubscriptionService = require('../services/subscription.service');

class BotManagementController {
    // Get user's bots
    async getUserBots(req, res) {
        try {
            const userId = req.user.userId;
            const bots = await Bot.find({ userId }).sort({ createdAt: -1 });

            // Enrich bot data with monitoring status
            const enrichedBots = await Promise.all(bots.map(async (bot) => {
                const monitoring = await MonitorService.getMonitoringStatus(bot._id);
                const stats = await BotService.getBotStats(bot._id);
                
                return {
                    ...bot.toJSON(),
                    monitoring,
                    stats
                };
            }));

            res.json({
                success: true,
                bots: enrichedBots
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch bots',
                error: error.message
            });
        }
    }

    // Create new bot
    async createBot(req, res) {
        try {
            const userId = req.user.userId;
            const { serviceType, name, config } = req.body;

            // Check user's subscription limits
            const subscription = await SubscriptionService.getUserSubscription(userId);
            const currentBots = await Bot.countDocuments({ userId });

            if (currentBots >= subscription.features.maxBots) {
                throw new Error('Bot limit reached for your subscription plan');
            }

            // Validate service type and configuration
            await this.validateBotConfiguration(serviceType, config, subscription);

            // Create bot
            const bot = new Bot({
                userId,
                name,
                serviceType,
                config: {
                    ...config,
                    proxyEnabled: config.useProxy && subscription.features.proxySupport,
                    retryAttempts: subscription.limits.retryAttempts
                },
                status: 'inactive',
                createdAt: new Date()
            });

            await bot.save();

            // Initialize monitoring
            await MonitorService.setupBotMonitoring(bot._id);

            // Send notification
            await NotificationService.sendToUser(userId, {
                type: 'bot_created',
                title: 'New Bot Created',
                message: `Bot "${name}" has been created successfully`
            });

            res.json({
                success: true,
                bot: bot.toJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to create bot',
                error: error.message
            });
        }
    }

    // Update bot configuration
    async updateBot(req, res) {
        try {
            const { botId } = req.params;
            const userId = req.user.userId;
            const updates = req.body;

            const bot = await Bot.findOne({ _id: botId, userId });
            if (!bot) {
                return res.status(404).json({
                    success: false,
                    message: 'Bot not found'
                });
            }

            // Validate updates
            const subscription = await SubscriptionService.getUserSubscription(userId);
            await this.validateBotConfiguration(bot.serviceType, updates.config, subscription);

            // Apply updates
            Object.assign(bot, updates);
            await bot.save();

            // Update monitoring configuration
            await MonitorService.updateBotConfiguration(botId, updates.config);

            res.json({
                success: true,
                bot: bot.toJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update bot',
                error: error.message
            });
        }
    }

    // Launch bot
    async launchBot(req, res) {
        try {
            const { botId } = req.params;
            const userId = req.user.userId;

            const bot = await Bot.findOne({ _id: botId, userId });
            if (!bot) {
                return res.status(404).json({
                    success: false,
                    message: 'Bot not found'
                });
            }

            // Check if bot can be launched
            const monitoring = await MonitorService.getMonitoringStatus(botId);
            if (monitoring.status !== 'healthy') {
                throw new Error('Bot is not in a healthy state to launch');
            }

            // Get proxy if enabled
            let proxy = null;
            if (bot.config.proxyEnabled) {
                proxy = await ProxyService.getProxy({ type: 'browser' });
            }

            // Launch bot
            const instance = await BotService.launchBot(botId, {
                proxy,
                retryAttempts: bot.config.retryAttempts
            });

            // Update bot status
            bot.status = 'active';
            bot.lastUsed = new Date();
            await bot.save();

            res.json({
                success: true,
                instanceId: instance.id
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to launch bot',
                error: error.message
            });
        }
    }

    // Stop bot
    async stopBot(req, res) {
        try {
            const { botId } = req.params;
            const userId = req.user.userId;

            const bot = await Bot.findOne({ _id: botId, userId });
            if (!bot) {
                return res.status(404).json({
                    success: false,
                    message: 'Bot not found'
                });
            }

            // Stop bot instance
            await BotService.stopBot(botId);

            // Update bot status
            bot.status = 'inactive';
            await bot.save();

            res.json({
                success: true,
                message: 'Bot stopped successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to stop bot',
                error: error.message
            });
        }
    }

    // Delete bot
    async deleteBot(req, res) {
        try {
            const { botId } = req.params;
            const userId = req.user.userId;

            const bot = await Bot.findOne({ _id: botId, userId });
            if (!bot) {
                return res.status(404).json({
                    success: false,
                    message: 'Bot not found'
                });
            }

            // Stop monitoring
            await MonitorService.stopBotMonitoring(botId);

            // Delete bot
            await bot.remove();

            res.json({
                success: true,
                message: 'Bot deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to delete bot',
                error: error.message
            });
        }
    }

    // Reset bot statistics
    async resetBotStats(req, res) {
        try {
            const { botId } = req.params;
            const userId = req.user.userId;

            const bot = await Bot.findOne({ _id: botId, userId });
            if (!bot) {
                return res.status(404).json({
                    success: false,
                    message: 'Bot not found'
                });
            }

            // Reset statistics
            bot.statistics = {
                totalRuns: 0,
                successfulRuns: 0,
                failedRuns: 0,
                averageSuccessRate: 100,
                averageRunTime: 0
            };

            await bot.save();

            res.json({
                success: true,
                message: 'Bot statistics reset successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to reset bot statistics',
                error: error.message
            });
        }
    }

    // Get bot logs
    async getBotLogs(req, res) {
        try {
            const { botId } = req.params;
            const userId = req.user.userId;

            const bot = await Bot.findOne({ _id: botId, userId });
            if (!bot) {
                return res.status(404).json({
                    success: false,
                    message: 'Bot not found'
                });
            }

            const logs = await BotService.getBotLogs(botId);

            res.json({
                success: true,
                logs
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch bot logs',
                error: error.message
            });
        }
    }

    // Helper method to validate bot configuration
    async validateBotConfiguration(serviceType, config, subscription) {
        // Validate service type
        if (serviceType === 'custom' && !subscription.features.customBots) {
            throw new Error('Custom bots are not available in your subscription plan');
        }

        // Validate proxy usage
        if (config.useProxy && !subscription.features.proxySupport) {
            throw new Error('Proxy support is not available in your subscription plan');
        }

        // Validate retry attempts
        if (config.retryAttempts > subscription.limits.retryAttempts) {
            throw new Error(`Maximum retry attempts exceeded for your plan (max: ${subscription.limits.retryAttempts})`);
        }

        // Additional validations can be added here
    }
}

module.exports = new BotManagementController();
