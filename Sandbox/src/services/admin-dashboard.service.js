const Redis = require('ioredis');
const PaymentVerificationService = require('./payment-verification.service');
const ReferralService = require('./referral.service');
const authConfig = require('../config/auth-integration.config');

class AdminDashboardService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.paymentService = PaymentVerificationService;
        this.referralService = ReferralService;
        this.adminRoles = authConfig.admin.roles;
    }

    async getDashboardStats() {
        try {
            const [
                userStats,
                paymentStats,
                referralStats,
                systemStats
            ] = await Promise.all([
                this.getUserStats(),
                this.getPaymentStats(),
                this.getReferralStats(),
                this.getSystemStats()
            ]);

            return {
                users: userStats,
                payments: paymentStats,
                referrals: referralStats,
                system: systemStats,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Dashboard stats error:', error);
            throw error;
        }
    }

    async getUserManagement(filters = {}) {
        try {
            const users = await this.getFilteredUsers(filters);
            const userDetails = await Promise.all(
                users.map(user => this.enrichUserData(user))
            );

            return {
                users: userDetails,
                total: await this.getTotalUsers(),
                filters: this.getCurrentFilters(filters)
            };
        } catch (error) {
            console.error('User management error:', error);
            throw error;
        }
    }

    async getPaymentManagement(filters = {}) {
        try {
            const payments = await this.getFilteredPayments(filters);
            const paymentDetails = await Promise.all(
                payments.map(payment => this.enrichPaymentData(payment))
            );

            return {
                payments: paymentDetails,
                total: await this.getTotalPayments(),
                stats: await this.getPaymentStats(),
                filters: this.getCurrentFilters(filters)
            };
        } catch (error) {
            console.error('Payment management error:', error);
            throw error;
        }
    }

    async getReferralManagement(filters = {}) {
        try {
            const referrals = await this.getFilteredReferrals(filters);
            const referralDetails = await Promise.all(
                referrals.map(referral => this.enrichReferralData(referral))
            );

            return {
                referrals: referralDetails,
                total: await this.getTotalReferrals(),
                stats: await this.getReferralStats(),
                filters: this.getCurrentFilters(filters)
            };
        } catch (error) {
            console.error('Referral management error:', error);
            throw error;
        }
    }

    async getSystemLogs(filters = {}) {
        try {
            const logs = await this.getFilteredLogs(filters);
            return {
                logs,
                total: await this.getTotalLogs(),
                filters: this.getCurrentFilters(filters)
            };
        } catch (error) {
            console.error('System logs error:', error);
            throw error;
        }
    }

    async updateUserStatus(userId, status) {
        try {
            await this.verifyAdminPermission('users.write');
            
            const user = await this.getUserById(userId);
            if (!user) throw new Error('User not found');

            const updated = await this.updateUser(userId, { status });
            await this.logAdminAction('user_status_update', { userId, status });

            return updated;
        } catch (error) {
            console.error('User status update error:', error);
            throw error;
        }
    }

    async verifyPayment(paymentId) {
        try {
            await this.verifyAdminPermission('payments.write');
            
            const payment = await this.paymentService.verifyPayment({
                transactionId: paymentId,
                adminVerification: true
            });

            await this.logAdminAction('payment_verification', { paymentId });

            return payment;
        } catch (error) {
            console.error('Payment verification error:', error);
            throw error;
        }
    }

    async manageReferralProgram(action, data) {
        try {
            await this.verifyAdminPermission('referrals.write');
            
            switch (action) {
                case 'approve_withdrawal':
                    return await this.approveWithdrawal(data);
                case 'adjust_rewards':
                    return await this.adjustRewards(data);
                case 'update_rules':
                    return await this.updateReferralRules(data);
                default:
                    throw new Error('Invalid action');
            }
        } catch (error) {
            console.error('Referral management error:', error);
            throw error;
        }
    }

    // Stats Collection Methods
    async getUserStats() {
        const now = Date.now();
        const dayAgo = now - (24 * 60 * 60 * 1000);

        const [total, active, new24h] = await Promise.all([
            this.getTotalUsers(),
            this.getActiveUsers(),
            this.getNewUsers(dayAgo)
        ]);

        return {
            total,
            active,
            new24h,
            growthRate: (new24h / total) * 100
        };
    }

    async getPaymentStats() {
        const now = Date.now();
        const dayAgo = now - (24 * 60 * 60 * 1000);

        const [total, volume24h, successful, failed] = await Promise.all([
            this.getTotalPayments(),
            this.getPaymentVolume(dayAgo),
            this.getSuccessfulPayments(),
            this.getFailedPayments()
        ]);

        return {
            total,
            volume24h,
            successful,
            failed,
            successRate: (successful / total) * 100
        };
    }

    async getReferralStats() {
        const [total, active, earnings] = await Promise.all([
            this.getTotalReferrals(),
            this.getActiveReferrals(),
            this.getTotalReferralEarnings()
        ]);

        return {
            total,
            active,
            earnings,
            averageEarnings: earnings / total
        };
    }

    async getSystemStats() {
        return {
            apiHealth: await this.checkApiHealth(),
            serverLoad: await this.getServerLoad(),
            errorRate: await this.getErrorRate(),
            responseTime: await this.getAverageResponseTime()
        };
    }

    // Helper Methods
    async verifyAdminPermission(permission) {
        // Implementation depends on your auth system
    }

    async logAdminAction(action, data) {
        const log = {
            action,
            data,
            timestamp: Date.now(),
            adminId: this.currentAdminId
        };

        await this.redis.lpush('admin:logs', JSON.stringify(log));
    }

    async enrichUserData(user) {
        const [payments, referrals, activity] = await Promise.all([
            this.getUserPayments(user.id),
            this.getUserReferrals(user.id),
            this.getUserActivity(user.id)
        ]);

        return {
            ...user,
            payments,
            referrals,
            activity
        };
    }

    async enrichPaymentData(payment) {
        const [user, verification, history] = await Promise.all([
            this.getUserById(payment.userId),
            this.getPaymentVerification(payment.id),
            this.getPaymentHistory(payment.id)
        ]);

        return {
            ...payment,
            user,
            verification,
            history
        };
    }

    async enrichReferralData(referral) {
        const [referrer, referred, earnings] = await Promise.all([
            this.getUserById(referral.referrerId),
            this.getUserById(referral.referredId),
            this.getReferralEarnings(referral.id)
        ]);

        return {
            ...referral,
            referrer,
            referred,
            earnings
        };
    }

    getCurrentFilters(filters) {
        return {
            ...filters,
            timestamp: Date.now()
        };
    }

    // These methods would be implemented based on your database choice
    async getFilteredUsers(filters) {}
    async getFilteredPayments(filters) {}
    async getFilteredReferrals(filters) {}
    async getFilteredLogs(filters) {}
    async getTotalUsers() {}
    async getActiveUsers() {}
    async getNewUsers(since) {}
    async getTotalPayments() {}
    async getPaymentVolume(since) {}
    async getSuccessfulPayments() {}
    async getFailedPayments() {}
    async getTotalReferrals() {}
    async getActiveReferrals() {}
    async getTotalReferralEarnings() {}
    async getTotalLogs() {}
    async getUserById(userId) {}
    async updateUser(userId, data) {}
    async getUserPayments(userId) {}
    async getUserReferrals(userId) {}
    async getUserActivity(userId) {}
    async getPaymentVerification(paymentId) {}
    async getPaymentHistory(paymentId) {}
    async getReferralEarnings(referralId) {}
    async checkApiHealth() {}
    async getServerLoad() {}
    async getErrorRate() {}
    async getAverageResponseTime() {}
}

module.exports = new AdminDashboardService();
