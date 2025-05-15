const DiscordBotService = require('../services/discord-bot.service');
const TelegramBotService = require('../services/telegram-bot.service');
const UserSubscriptionService = require('../services/user-subscription.service');
const TrialGenerationController = require('./trial-generation.controller');
const IndustryBundlesService = require('../services/industry-bundles.service');
const serviceEndpoints = require('../config/service-endpoints.config');

class BotCommandsController {
    constructor() {
        this.commands = {
            trial: this.handleTrialCommand.bind(this),
            bundle: this.handleBundleCommand.bind(this),
            status: this.handleStatusCommand.bind(this),
            list: this.handleListCommand.bind(this),
            extend: this.handleExtendCommand.bind(this),
            help: this.handleHelpCommand.bind(this)
        };

        this.trialGenerator = new TrialGenerationController();
    }

    async handleCommand(platform, command, args, user) {
        try {
            if (!this.commands[command]) {
                return this.sendResponse(platform, user, {
                    type: 'error',
                    message: 'Unknown command'
                });
            }

            const response = await this.commands[command](args, user, platform);
            await this.sendResponse(platform, user, response);
        } catch (error) {
            console.error(`Bot command error (${platform}):`, error);
            await this.sendResponse(platform, user, {
                type: 'error',
                message: error.message
            });
        }
    }

    async handleTrialCommand(args, user, platform) {
        const [serviceName, ...options] = args;
        
        // Verify user subscription
        const subscription = await UserSubscriptionService.getSubscriptionDetails(user.id);
        if (!subscription || subscription.status !== 'active') {
            throw new Error('Active subscription required');
        }

        // Get service configuration
        const service = this.findService(serviceName);
        if (!service) {
            throw new Error('Service not found');
        }

        // Generate trial
        const trial = await this.trialGenerator.generateTrial({
            body: { service, options: this.parseOptions(options) },
            user: { id: user.id }
        });

        return {
            type: 'trial_generated',
            data: trial.trial,
            message: 'Trial generated successfully! 🎉'
        };
    }

    async handleBundleCommand(args, user, platform) {
        const [bundleType] = args;
        
        // Get bundle configuration
        const bundle = await IndustryBundlesService.getBundlesByIndustry(bundleType);
        if (!bundle) {
            throw new Error('Bundle not found');
        }

        // Generate trials for bundle
        const trials = await Promise.all(
            bundle.services.map(service =>
                this.trialGenerator.generateTrial({
                    body: { service, options: {} },
                    user: { id: user.id }
                })
            )
        );

        return {
            type: 'bundle_generated',
            data: {
                bundle,
                trials: trials.map(t => t.trial)
            },
            message: `Bundle generated successfully! Generated ${trials.length} trials 🎉`
        };
    }

    async handleStatusCommand(args, user, platform) {
        const [trialId] = args;
        
        const subscription = await UserSubscriptionService.getSubscriptionDetails(user.id);
        const activeTrials = await UserSubscriptionService.getActiveTrials(user.id);
        
        return {
            type: 'status',
            data: {
                subscription,
                trials: activeTrials,
                remaining: subscription.maxTrials - subscription.trialsUsed
            },
            message: 'Here\'s your current status 📊'
        };
    }

    async handleListCommand(args, user, platform) {
        const [category] = args;
        
        const services = this.filterServices(category);
        return {
            type: 'service_list',
            data: {
                category,
                services: services.map(s => ({
                    name: s.name,
                    duration: s.duration,
                    features: s.features
                }))
            },
            message: `Available services in ${category || 'all'} category 📋`
        };
    }

    async handleExtendCommand(args, user, platform) {
        const [trialId, duration] = args;
        
        // Verify trial ownership and eligibility
        const trial = await UserSubscriptionService.getActiveTrial(user.id, trialId);
        if (!trial) {
            throw new Error('Trial not found or expired');
        }

        // Extend trial
        const extended = await this.trialGenerator.extendTrial(trialId, parseInt(duration));

        return {
            type: 'trial_extended',
            data: extended,
            message: 'Trial extended successfully! ⏰'
        };
    }

    async handleHelpCommand(args, user, platform) {
        return {
            type: 'help',
            data: {
                commands: [
                    { command: 'trial <service>', description: 'Generate new trial' },
                    { command: 'bundle <type>', description: 'Generate service bundle' },
                    { command: 'status', description: 'Check your subscription status' },
                    { command: 'list [category]', description: 'List available services' },
                    { command: 'extend <trial_id> <days>', description: 'Extend trial duration' },
                    { command: 'help', description: 'Show this help message' }
                ]
            },
            message: 'Available Commands 🐒'
        };
    }

    async sendResponse(platform, user, response) {
        switch (platform) {
            case 'discord':
                await DiscordBotService.sendUserNotification(user.id, response);
                break;
            case 'telegram':
                await TelegramBotService.sendMessage(user.id, this.formatTelegramMessage(response));
                break;
        }
    }

    formatTelegramMessage(response) {
        switch (response.type) {
            case 'trial_generated':
                return `
🎉 *Trial Generated Successfully!*

Service: ${response.data.serviceName}
Duration: ${response.data.duration} days
Status: ${response.data.status}

*Login Details:*
Email: \`${response.data.credentials.email}\`
Password: \`${response.data.credentials.password}\`

_Expires: ${new Date(response.data.expiryDate).toLocaleDateString()}_
`;
            case 'error':
                return `❌ *Error:* ${response.message}`;
            default:
                return response.message;
        }
    }

    findService(name) {
        const normalizedName = name.toLowerCase();
        for (const category of Object.values(serviceEndpoints)) {
            const service = Object.values(category).find(
                s => s.name.toLowerCase() === normalizedName
            );
            if (service) return service;
        }
        return null;
    }

    filterServices(category) {
        if (!category) {
            return Object.values(serviceEndpoints)
                .flatMap(cat => Object.values(cat));
        }
        return Object.values(serviceEndpoints[category] || {});
    }

    parseOptions(options) {
        return options.reduce((acc, opt) => {
            const [key, value] = opt.split('=');
            if (key && value) acc[key] = value;
            return acc;
        }, {});
    }
}

module.exports = new BotCommandsController();
