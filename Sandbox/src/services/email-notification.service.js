const nodemailer = require('nodemailer');
const Redis = require('ioredis');
const authConfig = require('../config/auth-integration.config');

class EmailNotificationService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        this.templates = {
            verification: {
                subject: 'Verify Your Email - Trial Monkeys',
                template: 'verification'
            },
            welcome: {
                subject: 'Welcome to Trial Monkeys! 🐒',
                template: 'welcome'
            },
            trialCreated: {
                subject: '🎉 Your Trial Has Been Generated',
                template: 'trial-created'
            },
            trialExpiring: {
                subject: '⚠️ Your Trial is Expiring Soon',
                template: 'trial-expiring'
            },
            subscriptionCreated: {
                subject: 'Subscription Confirmation - Trial Monkeys',
                template: 'subscription-created'
            },
            referralBonus: {
                subject: '🎁 You Earned a Referral Bonus!',
                template: 'referral-bonus'
            },
            adminAlert: {
                subject: '🚨 Admin Alert - Trial Monkeys',
                template: 'admin-alert'
            }
        };
    }

    async sendEmail(to, template, data) {
        try {
            const templateConfig = this.templates[template];
            if (!templateConfig) throw new Error('Invalid email template');

            const htmlContent = await this.generateEmailContent(templateConfig.template, data);
            
            const mailOptions = {
                from: process.env.SMTP_FROM,
                to,
                subject: templateConfig.subject,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            await this.trackEmailSent(to, template, result);

            return result;
        } catch (error) {
            console.error('Email sending error:', error);
            throw error;
        }
    }

    async sendVerificationEmail(user, verificationToken) {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify?token=${verificationToken}`;
        
        await this.sendEmail(user.email, 'verification', {
            username: user.username,
            verificationUrl,
            expiresIn: '24 hours'
        });
    }

    async sendWelcomeEmail(user) {
        await this.sendEmail(user.email, 'welcome', {
            username: user.username,
            dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
            supportEmail: process.env.SUPPORT_EMAIL
        });
    }

    async sendTrialCreatedEmail(user, trial) {
        await this.sendEmail(user.email, 'trialCreated', {
            username: user.username,
            serviceName: trial.serviceName,
            credentials: trial.credentials,
            expiryDate: new Date(trial.expiryDate).toLocaleDateString(),
            loginUrl: trial.loginUrl
        });
    }

    async sendTrialExpiringEmail(user, trial) {
        await this.sendEmail(user.email, 'trialExpiring', {
            username: user.username,
            serviceName: trial.serviceName,
            daysLeft: trial.daysLeft,
            expiryDate: new Date(trial.expiryDate).toLocaleDateString(),
            renewalUrl: `${process.env.FRONTEND_URL}/renew/${trial.id}`
        });
    }

    async sendSubscriptionEmail(user, subscription) {
        await this.sendEmail(user.email, 'subscriptionCreated', {
            username: user.username,
            plan: subscription.plan,
            amount: subscription.amount,
            nextBillingDate: new Date(subscription.currentPeriodEnd).toLocaleDateString(),
            managementUrl: `${process.env.FRONTEND_URL}/subscription`
        });
    }

    async sendReferralBonusEmail(user, referral) {
        await this.sendEmail(user.email, 'referralBonus', {
            username: user.username,
            bonusAmount: referral.bonus,
            totalEarnings: referral.totalEarnings,
            referralDashboard: `${process.env.FRONTEND_URL}/referrals`
        });
    }

    async sendAdminAlertEmail(admin, alert) {
        await this.sendEmail(admin.email, 'adminAlert', {
            adminName: admin.username,
            alertType: alert.type,
            alertDetails: alert.details,
            timestamp: new Date(alert.timestamp).toLocaleString(),
            dashboardUrl: `${process.env.FRONTEND_URL}/admin`
        });
    }

    async generateEmailContent(template, data) {
        const templateContent = await this.getEmailTemplate(template);
        return this.replaceTemplateVariables(templateContent, data);
    }

    async getEmailTemplate(templateName) {
        // In a real implementation, these would be HTML files or database entries
        const templates = {
            verification: `
                <div style="background-color: #1a1b26; color: #ffffff; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #7aa2f7;">Verify Your Email</h2>
                    <p>Hi {{username}},</p>
                    <p>Please verify your email address by clicking the button below:</p>
                    <a href="{{verificationUrl}}" style="background: #7aa2f7; color: #ffffff; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block; margin: 20px 0;">
                        Verify Email
                    </a>
                    <p>This link will expire in {{expiresIn}}.</p>
                </div>
            `,
            'trial-created': `
                <div style="background-color: #1a1b26; color: #ffffff; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #7aa2f7;">Trial Generated Successfully! 🎉</h2>
                    <p>Hi {{username}},</p>
                    <p>Your trial for {{serviceName}} has been generated successfully.</p>
                    <div style="background: #24283b; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3>Login Credentials</h3>
                        <p>Email: <code>{{credentials.email}}</code></p>
                        <p>Password: <code>{{credentials.password}}</code></p>
                    </div>
                    <p>Trial expires on: {{expiryDate}}</p>
                    <a href="{{loginUrl}}" style="background: #7aa2f7; color: #ffffff; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block; margin: 20px 0;">
                        Login Now
                    </a>
                </div>
            `
            // Add more templates as needed
        };

        return templates[templateName] || '';
    }

    replaceTemplateVariables(template, data) {
        return template.replace(/\{\{(\w+?)\}\}/g, (match, key) => {
            const value = key.split('.').reduce((obj, k) => obj?.[k], data);
            return value !== undefined ? value : match;
        });
    }

    async trackEmailSent(to, template, result) {
        const tracking = {
            to,
            template,
            messageId: result.messageId,
            timestamp: Date.now(),
            status: 'sent'
        };

        await this.redis.lpush(
            'email:history',
            JSON.stringify(tracking)
        );

        // Update email metrics
        await this.updateEmailMetrics(template);
    }

    async updateEmailMetrics(template) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const key = `email:metrics:${year}:${month}`;
        await this.redis.hincrby(key, template, 1);
    }

    async getEmailMetrics(timeframe = '30d') {
        // Implementation for getting email metrics
    }
}

module.exports = new EmailNotificationService();
