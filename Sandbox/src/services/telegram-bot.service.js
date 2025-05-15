const TelegramBot = require('node-telegram-bot-api');
const config = require('../config/services.config');
const TrialService = require('../models/trial-service.model');
const User = require('../models/user.model');

class TelegramBotService {
    constructor() {
        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
        this.commands = config.bots.telegram.commands;
        this.initializeCommands();
    }

    initializeCommands() {
        // Generate trial command
        this.bot.onText(/\/generate (.+)/, async (msg, match) => {
            try {
                const url = match[1];
                const chatId = msg.chat.id;
                
                await this.bot.sendMessage(chatId, '🔄 Generating trial...');
                const trial = await this.generateTrial(url, chatId);
                
                await this.sendTrialDetails(chatId, trial);
            } catch (error) {
                this.handleError(msg.chat.id, error);
            }
        });

        // List active trials
        this.bot.onText(/\/list/, async (msg) => {
            try {
                const trials = await this.getActiveTrials(msg.chat.id);
                await this.sendTrialsList(msg.chat.id, trials);
            } catch (error) {
                this.handleError(msg.chat.id, error);
            }
        });

        // Check trial status
        this.bot.onText(/\/status (.+)/, async (msg, match) => {
            try {
                const trialId = match[1];
                const status = await this.getTrialStatus(trialId);
                await this.sendStatusUpdate(msg.chat.id, status);
            } catch (error) {
                this.handleError(msg.chat.id, error);
            }
        });

        // Extend trial
        this.bot.onText(/\/extend (.+)/, async (msg, match) => {
            try {
                const [trialId, days] = match[1].split(' ');
                const extended = await this.extendTrial(trialId, parseInt(days));
                await this.sendExtensionConfirmation(msg.chat.id, extended);
            } catch (error) {
                this.handleError(msg.chat.id, error);
            }
        });

        // Help command
        this.bot.onText(/\/help/, async (msg) => {
            const helpText = this.generateHelpText();
            await this.bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
        });
    }

    async generateTrial(url, chatId) {
        const user = await this.getOrCreateUser(chatId);
        const trialService = new TrialService();
        return await trialService.generateTrial(url, user);
    }

    async getActiveTrials(chatId) {
        const user = await this.getOrCreateUser(chatId);
        return await TrialService.find({ userId: user._id, status: 'active' });
    }

    async getTrialStatus(trialId) {
        const trial = await TrialService.findById(trialId);
        if (!trial) throw new Error('Trial not found');
        return {
            service: trial.serviceName,
            status: trial.status,
            expiresAt: trial.expiresAt,
            daysLeft: Math.ceil((trial.expiresAt - new Date()) / (1000 * 60 * 60 * 24))
        };
    }

    async extendTrial(trialId, days) {
        const trial = await TrialService.findById(trialId);
        if (!trial) throw new Error('Trial not found');
        
        trial.expiresAt = new Date(trial.expiresAt.getTime() + days * 24 * 60 * 60 * 1000);
        await trial.save();
        return trial;
    }

    async sendTrialDetails(chatId, trial) {
        const message = `
🎉 *Trial Generated Successfully!*

*Service:* ${trial.serviceName}
*Login URL:* ${trial.loginUrl}
*Expires:* ${trial.expiresAt.toLocaleDateString()}
*Status:* ${trial.status}

*Login Credentials:*
Email: \`${trial.credentials.email}\`
Password: \`${trial.credentials.password}\`

_Use /status ${trial._id} to check trial status_
`;
        await this.bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
    }

    async sendTrialsList(chatId, trials) {
        if (trials.length === 0) {
            await this.bot.sendMessage(chatId, '❌ No active trials found');
            return;
        }

        const message = trials.map(trial => `
*${trial.serviceName}*
ID: \`${trial._id}\`
Status: ${trial.status}
Expires: ${trial.expiresAt.toLocaleDateString()}
`).join('\n');

        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    async sendStatusUpdate(chatId, status) {
        const message = `
*Trial Status Update*

Service: ${status.service}
Status: ${status.status}
Expires: ${status.expiresAt.toLocaleDateString()}
Days Left: ${status.daysLeft}
`;
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    async sendExtensionConfirmation(chatId, trial) {
        const message = `
✅ *Trial Extended Successfully!*

Service: ${trial.serviceName}
New Expiry: ${trial.expiresAt.toLocaleDateString()}
`;
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    generateHelpText() {
        return `
🐒 *Trial Monkeys Bot Commands*

/generate <url> - Generate new trial
/list - Show active trials
/status <trial_id> - Check trial status
/extend <trial_id> <days> - Extend trial duration
/help - Show this help message

*Examples:*
\`/generate https://netflix.com\`
\`/status 5f3e2b1c9d8e7f6a5b4c3d2e\`
\`/extend 5f3e2b1c9d8e7f6a5b4c3d2e 7\`
`;
    }

    async getOrCreateUser(chatId) {
        let user = await User.findOne({ 'telegram.chatId': chatId });
        if (!user) {
            user = await User.create({
                telegram: { chatId },
                subscription: {
                    tier: 'free',
                    trialCount: 0,
                    maxTrials: 1
                }
            });
        }
        return user;
    }

    handleError(chatId, error) {
        console.error('Telegram bot error:', error);
        this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
}

module.exports = new TelegramBotService();
