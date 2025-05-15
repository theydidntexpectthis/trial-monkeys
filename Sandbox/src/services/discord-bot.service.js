const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const IndustryBundlesService = require('./industry-bundles.service');
const apiConfig = require('../config/api-integrations.config');

class DiscordBotService {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages
            ]
        });

        this.commands = apiConfig.notifications.discord.commands;
        this.colors = apiConfig.notifications.discord.embedColors;
        this.bundleService = IndustryBundlesService;

        this.initializeBot();
    }

    async initializeBot() {
        this.client.on('ready', () => {
            console.log(`Discord bot logged in as ${this.client.user.tag}`);
            this.registerCommands();
        });

        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;
            await this.handleCommand(interaction);
        });

        await this.client.login(process.env.DISCORD_BOT_TOKEN);
    }

    async registerCommands() {
        try {
            const commands = this.commands.map(cmd => ({
                name: cmd.name,
                description: cmd.description,
                options: this.generateCommandOptions(cmd.options)
            }));

            await this.client.application.commands.set(commands);
        } catch (error) {
            console.error('Error registering commands:', error);
        }
    }

    generateCommandOptions(options) {
        if (!options) return [];

        return options.map(option => ({
            name: option,
            description: `Specify ${option}`,
            type: 3, // STRING type
            required: true
        }));
    }

    async handleCommand(interaction) {
        const { commandName } = interaction;

        try {
            switch (commandName) {
                case 'trial':
                    await this.handleTrialCommand(interaction);
                    break;
                case 'bundle':
                    await this.handleBundleCommand(interaction);
                    break;
                case 'status':
                    await this.handleStatusCommand(interaction);
                    break;
                case 'extend':
                    await this.handleExtendCommand(interaction);
                    break;
                default:
                    await interaction.reply('Unknown command');
            }
        } catch (error) {
            console.error(`Command error (${commandName}):`, error);
            await this.sendErrorMessage(interaction, error);
        }
    }

    async handleTrialCommand(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const service = interaction.options.getString('service');
        const duration = interaction.options.getString('duration');

        try {
            const trial = await this.bundleService.generateServiceTrial(
                { name: service, duration: parseInt(duration) },
                interaction.user.id
            );

            await this.sendTrialDetails(interaction, trial);
        } catch (error) {
            await this.sendErrorMessage(interaction, error);
        }
    }

    async handleBundleCommand(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const type = interaction.options.getString('type');

        try {
            const bundle = await this.bundleService.generateIndustryBundle(
                type,
                interaction.user.id
            );

            await this.sendBundleDetails(interaction, bundle);
        } catch (error) {
            await this.sendErrorMessage(interaction, error);
        }
    }

    async handleStatusCommand(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const trials = await this.bundleService.getUserTrials(
                interaction.user.id
            );

            await this.sendTrialStatus(interaction, trials);
        } catch (error) {
            await this.sendErrorMessage(interaction, error);
        }
    }

    async handleExtendCommand(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const trialId = interaction.options.getString('trial_id');

        try {
            const extended = await this.bundleService.extendTrial(
                trialId,
                interaction.user.id
            );

            await this.sendExtensionConfirmation(interaction, extended);
        } catch (error) {
            await this.sendErrorMessage(interaction, error);
        }
    }

    async sendTrialDetails(interaction, trial) {
        const embed = new EmbedBuilder()
            .setColor(this.colors.success)
            .setTitle('🎯 Trial Generated Successfully!')
            .addFields(
                { name: 'Service', value: trial.serviceId, inline: true },
                { name: 'Status', value: trial.status, inline: true },
                { name: 'Expires', value: trial.expires.toLocaleDateString(), inline: true },
                { name: 'Login Details', value: '```\n' +
                    `Email: ${trial.credentials.email}\n` +
                    `Password: ${trial.credentials.password}\n` +
                    '```'
                }
            )
            .setFooter({ text: 'Trial Monkeys 🐒' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }

    async sendBundleDetails(interaction, bundle) {
        const embed = new EmbedBuilder()
            .setColor(this.colors.success)
            .setTitle(`📦 ${bundle.industry} Bundle Generated!`)
            .setDescription(`Generated ${bundle.trials.length} trials successfully!`)
            .addFields(
                bundle.trials.map(trial => ({
                    name: trial.serviceId,
                    value: `Status: ${trial.status}\nExpires: ${trial.expires.toLocaleDateString()}`,
                    inline: true
                }))
            )
            .setFooter({ text: 'Trial Monkeys 🐒' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }

    async sendTrialStatus(interaction, trials) {
        const embed = new EmbedBuilder()
            .setColor(this.colors.info)
            .setTitle('📊 Your Active Trials')
            .setDescription(trials.length ? 'Here are your active trials:' : 'No active trials found')
            .addFields(
                trials.map(trial => ({
                    name: trial.serviceId,
                    value: `Status: ${trial.status}\nExpires: ${trial.expires.toLocaleDateString()}`,
                    inline: true
                }))
            )
            .setFooter({ text: 'Trial Monkeys 🐒' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }

    async sendExtensionConfirmation(interaction, trial) {
        const embed = new EmbedBuilder()
            .setColor(this.colors.success)
            .setTitle('⏰ Trial Extended!')
            .addFields(
                { name: 'Service', value: trial.serviceId, inline: true },
                { name: 'New Expiry', value: trial.expires.toLocaleDateString(), inline: true }
            )
            .setFooter({ text: 'Trial Monkeys 🐒' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }

    async sendErrorMessage(interaction, error) {
        const embed = new EmbedBuilder()
            .setColor(this.colors.error)
            .setTitle('❌ Error')
            .setDescription(error.message)
            .setFooter({ text: 'Trial Monkeys 🐒' })
            .setTimestamp();

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    async notifyTrialExpiry(userId, trial) {
        try {
            const user = await this.client.users.fetch(userId);
            const embed = new EmbedBuilder()
                .setColor(this.colors.info)
                .setTitle('⚠️ Trial Expiring Soon')
                .addFields(
                    { name: 'Service', value: trial.serviceId, inline: true },
                    { name: 'Expires', value: trial.expires.toLocaleDateString(), inline: true }
                )
                .setFooter({ text: 'Trial Monkeys 🐒' })
                .setTimestamp();

            await user.send({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to send trial expiry notification:', error);
        }
    }
}

module.exports = new DiscordBotService();
