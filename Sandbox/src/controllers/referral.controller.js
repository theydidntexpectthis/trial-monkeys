const ReferralService = require('../services/referral.service');
const UserSubscriptionService = require('../services/user-subscription.service');
const PaymentVerificationService = require('../services/payment-verification.service');
const NotificationService = require('../services/email-notification.service');
const UserAnalyticsService = require('../services/user-analytics.service');

class ReferralController {
    constructor() {
        this.referralService = ReferralService;
        this.subscriptionService = UserSubscriptionService;
        this.paymentService = PaymentVerificationService;
        this.notificationService = NotificationService;
        this.analyticsService = UserAnalyticsService;
    }

    async generateReferralCode(req, res) {
        try {
            const userId = req.user.id;
            
            // Generate referral code
            const referral = await this.referralService.createReferralCode(userId);

            // Track referral code generation
            await this.analyticsService.trackUserActivity(userId, 'referral_code_generated', {
                code: referral.code
            });

            res.json({
                success: true,
                data: {
                    code: referral.code,
                    url: referral.url,
                    rewards: await this.getReferralRewards()
                }
            });
        } catch (error) {
            console.error('Referral code generation error:', error);
            res.status(500).json({ error: 'Failed to generate referral code' });
        }
    }

    async processReferral(req, res) {
        try {
            const { referralCode } = req.body;
            const newUserId = req.user.id;

            // Process referral
            const result = await this.referralService.processReferral(referralCode, newUserId);

            // If successful, send notifications
            if (result.success) {
                await this.sendReferralNotifications(result);
            }

            res.json({
                success: true,
                data: {
                    bonusAwarded: result.bonusAwarded,
                    referrer: result.referrer
                }
            });
        } catch (error) {
            console.error('Referral processing error:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async getReferralStats(req, res) {
        try {
            const userId = req.user.id;
            const stats = await this.referralService.getReferralStats(userId);

            res.json({
                success: true,
                data: {
                    ...stats,
                    projectedEarnings: await this.calculateProjectedEarnings(stats)
                }
            });
        } catch (error) {
            console.error('Referral stats error:', error);
            res.status(500).json({ error: 'Failed to fetch referral statistics' });
        }
    }

    async processWithdrawal(req, res) {
        try {
            const userId = req.user.id;
            const { amount } = req.body;

            // Process withdrawal
            const withdrawal = await this.referralService.processWithdrawal(userId, amount);

            // Send withdrawal confirmation
            await this.notificationService.sendEmail(req.user.email, 'referralWithdrawal', {
                amount: withdrawal.amount,
                transactionId: withdrawal.transactionId
            });

            res.json({
                success: true,
                data: withdrawal
            });
        } catch (error) {
            console.error('Withdrawal processing error:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async getReferralHistory(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10 } = req.query;

            const history = await this.referralService.getReferralHistory(userId);

            res.json({
                success: true,
                data: {
                    history,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: history.length
                    }
                }
            });
        } catch (error) {
            console.error('Referral history error:', error);
            res.status(500).json({ error: 'Failed to fetch referral history' });
        }
    }

    async updateReferralPreferences(req, res) {
        try {
            const userId = req.user.id;
            const { notifications, paymentMethod } = req.body;

            const updated = await this.referralService.updatePreferences(userId, {
                notifications,
                paymentMethod
            });

            res.json({
                success: true,
                data: updated
            });
        } catch (error) {
            console.error('Preferences update error:', error);
            res.status(500).json({ error: 'Failed to update preferences' });
        }
    }

    async getReferralLeaderboard(req, res) {
        try {
            const { timeframe = '30d', limit = 10 } = req.query;

            const leaderboard = await this.referralService.getLeaderboard(timeframe, limit);

            res.json({
                success: true,
                data: {
                    timeframe,
                    leaders: leaderboard
                }
            });
        } catch (error) {
            console.error('Leaderboard error:', error);
            res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }
    }

    // Helper Methods
    async getReferralRewards() {
        return {
            signupBonus: 5, // $5 for new referral
            referrerBonus: 10, // $10 for referrer
            minimumWithdrawal: 25 // Minimum $25 to withdraw
        };
    }

    async sendReferralNotifications(result) {
        // Notify referrer
        await this.notificationService.sendEmail(result.referrer.email, 'referralBonus', {
            bonusAmount: result.bonusAwarded,
            totalEarnings: result.referrer.totalEarnings
        });

        // Notify new user
        await this.notificationService.sendEmail(result.newUser.email, 'referralWelcome', {
            bonusAmount: result.bonusAwarded,
            referrerName: result.referrer.username
        });
    }

    async calculateProjectedEarnings(stats) {
        const conversionRate = stats.activeReferrals / stats.totalReferrals;
        const averageEarnings = stats.totalEarnings / stats.activeReferrals;

        return {
            monthly: Math.round(averageEarnings * conversionRate * 30),
            yearly: Math.round(averageEarnings * conversionRate * 365)
        };
    }
}

module.exports = new ReferralController();
