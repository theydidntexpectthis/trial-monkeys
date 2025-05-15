const DiscordBotService = require('./discord-bot.service');
const telegramBot = require('./telegram-bot.service');
const nodemailer = require('nodemailer');
const Redis = require('ioredis');

class UserNotificationsService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.emailTransport = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        
        this.channels = {
            discord: DiscordBotService,
            telegram: telegramBot,
            email: this.emailTransport
        };

        this.defaultPreferences = {
            channels: {
                discord: true,
                telegram: true,
                email: true
            },
            notifications: {
                trialCreated: true,
                trialExpiring: true,
                trialEnded: true,
                newFeatures: true,
                promotions: false
            },
            frequency: 'instant' // instant, daily, weekly
        };
    }

    async sendNotification(userId, type, data) {
        try {
            const preferences = await this.getUserPreferences(userId);
            const userChannels = await this.getUserChannels(userId);

            if (!this.shouldSendNotification(type, preferences)) {
                return;
            }

            const notification = await this.formatNotification(type, data);
            const sendPromises = [];

            // Send to each enabled channel
            for (const [channel, enabled] of Object.entries(preferences.channels)) {
                if (enabled && userChannels[channel]) {
                    sendPromises.push(
                        this.sendToChannel(channel, userChannels[channel], notification)
                    );
                }
            }

            const results = await Promise.allSettled(sendPromises);
            await this.trackNotification(userId, type, results);

            return results;
        } catch (error) {
            console.error('Notification error:', error);
            throw error;
        }
    }

    async sendToChannel(channel, recipient, notification) {
        switch (channel) {
            case 'discord':
                return this.channels.discord.sendUserNotification(
                    recipient,
                    notification
                );
            case 'telegram':
                return this.channels.telegram.sendMessage(
                    recipient,
                    notification.formatted.telegram
                );
            case 'email':
                return this.sendEmail(
                    recipient,
                    notification.subject,
                    notification.formatted.email
                );
        }
    }

    async formatNotification(type, data) {
        const templates = {
            trialCreated: {
                subject: '🎉 New Trial Generated Successfully!',
                message: `Your trial for ${data.serviceName} has been created.`,
                details: [
                    `Service: ${data.serviceName}`,
                    `Duration: ${data.duration} days`,
                    `Expires: ${new Date(data.expiryDate).toLocaleDateString()}`
                ]
            },
            trialExpiring: {
                subject: '⚠️ Trial Expiring Soon',
                message: `Your ${data.serviceName} trial will expire in ${data.daysLeft} days.`,
                details: [
                    `Service: ${data.serviceName}`,
                    `Expiry Date: ${new Date(data.expiryDate).toLocaleDateString()}`,
                    `Action Required: Renew or cancel your trial`
                ]
            },
            trialEnded: {
                subject: '🔚 Trial Ended',
                message: `Your trial for ${data.serviceName} has ended.`,
                details: [
                    `Service: ${data.serviceName}`,
                    `End Date: ${new Date().toLocaleDateString()}`,
                    `Thank you for using Trial Monkeys!`
                ]
            }
        };

        const template = templates[type];
        return {
            ...template,
            formatted: {
                discord: this.formatForDiscord(template),
                telegram: this.formatForTelegram(template),
                email: this.formatForEmail(template)
            }
        };
    }

    formatForDiscord(template) {
        return {
            embeds: [{
                title: template.subject,
                description: template.message,
                fields: template.details.map(detail => ({
                    name: '▫️',
                    value: detail
                })),
                color: 0x7aa2f7,
                footer: {
                    text: 'Trial Monkeys 🐒'
                },
                timestamp: new Date()
            }]
        };
    }

    formatForTelegram(template) {
        return `
${template.subject}

${template.message}

${template.details.join('\n')}

🐒 Trial Monkeys`;
    }

    formatForEmail(template) {
        return `
<div style="background-color: #1a1b26; color: #ffffff; padding: 20px; border-radius: 10px;">
    <h2 style="color: #7aa2f7;">${template.subject}</h2>
    <p style="font-size: 16px;">${template.message}</p>
    <ul style="list-style: none; padding: 0;">
        ${template.details.map(detail => `
            <li style="margin: 10px 0; padding: 10px; background-color: #24273a; border-radius: 5px;">
                ${detail}
            </li>
        `).join('')}
    </ul>
    <p style="color: #9ece6a; margin-top: 20px;">
        Trial Monkeys - Your Smart Trial Manager 🐒
    </p>
</div>`;
    }

    async getUserPreferences(userId) {
        const preferences = await this.redis.hget(`user:${userId}`, 'notifications');
        return preferences ? JSON.parse(preferences) : this.defaultPreferences;
    }

    async updatePreferences(userId, preferences) {
        const updated = {
            ...await this.getUserPreferences(userId),
            ...preferences
        };

        await this.redis.hset(
            `user:${userId}`,
            'notifications',
            JSON.stringify(updated)
        );

        return updated;
    }

    async getUserChannels(userId) {
        const channels = await this.redis.hgetall(`user:${userId}:channels`);
        return {
            discord: channels.discordId,
            telegram: channels.telegramId,
            email: channels.email
        };
    }

    shouldSendNotification(type, preferences) {
        return preferences.notifications[type] || false;
    }

    async sendEmail(to, subject, html) {
        return this.emailTransport.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject,
            html
        });
    }

    async trackNotification(userId, type, results) {
        const tracking = {
            type,
            timestamp: Date.now(),
            success: results.filter(r => r.status === 'fulfilled').length,
            total: results.length
        };

        await this.redis.lpush(
            `notifications:${userId}:history`,
            JSON.stringify(tracking)
        );
    }

    async getNotificationHistory(userId) {
        const history = await this.redis.lrange(
            `notifications:${userId}:history`,
            0,
            -1
        );
        return history.map(h => JSON.parse(h));
    }
}

module.exports = new UserNotificationsService();
