const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const ReferralService = require('./referral.service');
const PaymentVerificationService = require('./payment-verification.service');
const authConfig = require('../config/auth-integration.config');

class DiscordIntegrationService {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages
            ]
        });

        this.referralService = ReferralService;
        this.paymentService = PaymentVerificationService;
        this.commands = this.initializeCommands();

        this.setupEventHandlers();
    }

    initializeCommands() {
        return {
            referral: {
                name: 'referral',
                description: 'Manage referrals and rewards',
                subcommands: {
                    create: this.handleCreateReferral.bind(this),
                    stats: this.handleReferralStats.bind(this),
                    withdraw: this.handleWithdrawal.bind(this)
                }
            },
            subscription: {
                name: 'subscription',
                description: 'Manage your subscription',
                subcommands: {
                    status: this.handleSubscriptionStatus.bind(this),
                    verify: this.handleSubscriptionVerify.bind(this)
                }
            },
            help: {
                name: 'help',
                description: 'Show available commands',
                handler: this.handleHelp.bind(this)
            }
        };
    }

    setupEventHandlers() {
        this.client.on('ready', () => {
            console.log(`Discord bot logged in as ${this.client.user.tag}`);
            this.registerCommands();
        });

        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;
            await this.handleCommand(interaction);
        });

        this.client.on('error', error => {
            console.error('Discord bot error:', error);
        });
    }

    async start() {
        await this.client.login(process.env.DISCORD_BOT_TOKEN);
    }

    async registerCommands() {
        const commands = Object.values(this.commands).map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            options: this.generateCommandOptions(cmd)
        }));

        await this.client.application.commands.set(commands);
    }

    generateCommandOptions(command) {
        if (!command.subcommands) return [];

        return Object.entries(command.subcommands).map(([name, handler]) => ({
            name,
            description: handler.description || `${name} subcommand`,
            type: 1 // Subcommand type
        }));
    }

    async handleCommand(interaction) {
        const command = this.commands[interaction.commandName];
        if (!command) return;

        try {
            if (interaction.options.getSubcommand(false)) {
                const subcommand = command.subcommands[interaction.options.getSubcommand()];
                await subcommand(interaction);
            } else if (command.handler) {
                await command.handler(interaction);
            }
        } catch (error) {
            console.error('Command handling error:', error);
            await this.sendErrorResponse(interaction, error);
        }
    }

    // Referral Commands
    async handleCreateReferral(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const userId = await this.getUserId(interaction.user.id);
            const referral = await this.referralService.createReferralCode(userId);

            const embed = new EmbedBuilder()
                .setTitle('🎉 Referral Code Generated!')
                .setDescription('Share this code with friends to earn rewards!')
                .addFields(
                    { name: 'Your Code', value: `\`${referral.code}\`` },
                    { name: 'Share Link', value: referral.url }
                )
                .setColor('#7aa2f7');

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await this.sendErrorResponse(interaction, error);
        }
    }

    async handleReferralStats(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const userId = await this.getUserId(interaction.user.id);
            const stats = await this.referralService.getReferralStats(userId);

            const embed = new EmbedBuilder()
                .setTitle('📊 Your Referral Stats')
                .addFields(
                    { name: 'Total Referrals', value: stats.totalReferrals.toString(), inline: true },
                    { name: 'Active Referrals', value: stats.activeReferrals.toString(), inline: true },
                    { name: 'Total Earnings', value: `$${stats.totalEarnings}`, inline: true },
                    { name: 'Available Balance', value: `$${stats.availableBalance}`, inline: true }
                )
                .setColor('#9ece6a');

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await this.sendErrorResponse(interaction, error);
        }
    }

    async handleWithdrawal(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const userId = await this.getUserId(interaction.user.id);
            const amount = interaction.options.getNumber('amount');

            const withdrawal = await this.referralService.processWithdrawal(userId, amount);

            const embed = new EmbedBuilder()
                .setTitle('💰 Withdrawal Processed')
                .addFields(
                    { name: 'Amount', value: `$${withdrawal.amount}`, inline: true },
                    { name: 'Transaction ID', value: withdrawal.transactionId, inline: true },
                    { name: 'Remaining Balance', value: `$${withdrawal.remainingBalance}`, inline: true }
                )
                .setColor('#f7768e');

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await this.sendErrorResponse(interaction, error);
        }
    }

    // Subscription Commands
    async handleSubscriptionStatus(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const userId = await this.getUserId(interaction.user.id);
            const status = await this.paymentService.verifySubscriptionStatus(userId);

            const embed = new EmbedBuilder()
                .setTitle('📱 Subscription Status')
                .addFields(
                    { name: 'Status', value: status.active ? '✅ Active' : '❌ Inactive', inline: true },
                    { name: 'Plan', value: status.subscription?.plan || 'N/A', inline: true },
                    { name: 'Next Payment', value: status.subscription?.currentPeriodEnd || 'N/A', inline: true }
                )
                .setColor(status.active ? '#9ece6a' : '#f7768e');

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await this.sendErrorResponse(interaction, error);
        }
    }

    async handleSubscriptionVerify(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const userId = await this.getUserId(interaction.user.id);
            const verification = await this.paymentService.verifyPayment({
                userId,
                transactionId: interaction.options.getString('transaction_id')
            });

            const embed = new EmbedBuilder()
                .setTitle('🔍 Payment Verification')
                .setDescription(verification.success ? 'Payment verified successfully!' : 'Payment verification failed')
                .addFields(
                    { name: 'Transaction ID', value: verification.transactionId, inline: true },
                    { name: 'Status', value: verification.success ? '✅ Valid' : '❌ Invalid', inline: true }
                )
                .setColor(verification.success ? '#9ece6a' : '#f7768e');

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await this.sendErrorResponse(interaction, error);
        }
    }

    async handleHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Available Commands')
            .setDescription('Here are all the commands you can use:')
            .addFields(
                Object.values(this.commands).map(cmd => ({
                    name: `/${cmd.name}`,
                    value: cmd.description
                }))
            )
            .setColor('#7aa2f7');

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Helper Methods
    async sendErrorResponse(interaction, error) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(error.message)
            .setColor('#f7768e');

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    // This method would be implemented based on your user management system
    async getUserId(discordId) {}
}

module.exports = new DiscordIntegrationService();
