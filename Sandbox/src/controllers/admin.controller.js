const AdminDashboardService = require('../services/admin-dashboard.service');
const UserAnalyticsService = require('../services/user-analytics.service');
const PaymentVerificationService = require('../services/payment-verification.service');
const ReferralService = require('../services/referral.service');

class AdminController {
    constructor() {
        this.dashboardService = AdminDashboardService;
        this.analyticsService = UserAnalyticsService;
        this.paymentService = PaymentVerificationService;
        this.referralService = ReferralService;
    }

    async getDashboardOverview(req, res) {
        try {
            const stats = await this.dashboardService.getDashboardStats();
            res.json({ success: true, data: stats });
        } catch (error) {
            console.error('Dashboard overview error:', error);
            res.status(500).json({ error: 'Failed to fetch dashboard overview' });
        }
    }

    async getUserManagement(req, res) {
        try {
            const { page = 1, limit = 10, filter, sort } = req.query;
            const users = await this.dashboardService.getUserManagement({
                page: parseInt(page),
                limit: parseInt(limit),
                filter,
                sort
            });

            res.json({ success: true, data: users });
        } catch (error) {
            console.error('User management error:', error);
            res.status(500).json({ error: 'Failed to fetch user management data' });
        }
    }

    async getPaymentAnalytics(req, res) {
        try {
            const { timeframe = '30d' } = req.query;
            const payments = await this.dashboardService.getPaymentManagement({
                timeframe
            });

            res.json({ success: true, data: payments });
        } catch (error) {
            console.error('Payment analytics error:', error);
            res.status(500).json({ error: 'Failed to fetch payment analytics' });
        }
    }

    async getReferralAnalytics(req, res) {
        try {
            const { timeframe = '30d' } = req.query;
            const referrals = await this.dashboardService.getReferralManagement({
                timeframe
            });

            res.json({ success: true, data: referrals });
        } catch (error) {
            console.error('Referral analytics error:', error);
            res.status(500).json({ error: 'Failed to fetch referral analytics' });
        }
    }

    async getSystemLogs(req, res) {
        try {
            const { page = 1, limit = 50, level } = req.query;
            const logs = await this.dashboardService.getSystemLogs({
                page: parseInt(page),
                limit: parseInt(limit),
                level
            });

            res.json({ success: true, data: logs });
        } catch (error) {
            console.error('System logs error:', error);
            res.status(500).json({ error: 'Failed to fetch system logs' });
        }
    }

    async updateUserStatus(req, res) {
        try {
            const { userId } = req.params;
            const { status } = req.body;

            const updated = await this.dashboardService.updateUserStatus(userId, status);
            res.json({ success: true, data: updated });
        } catch (error) {
            console.error('User status update error:', error);
            res.status(500).json({ error: 'Failed to update user status' });
        }
    }

    async verifyPayment(req, res) {
        try {
            const { paymentId } = req.params;
            const verification = await this.dashboardService.verifyPayment(paymentId);
            res.json({ success: true, data: verification });
        } catch (error) {
            console.error('Payment verification error:', error);
            res.status(500).json({ error: 'Failed to verify payment' });
        }
    }

    async manageReferralProgram(req, res) {
        try {
            const { action } = req.params;
            const result = await this.dashboardService.manageReferralProgram(action, req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Referral management error:', error);
            res.status(500).json({ error: 'Failed to manage referral program' });
        }
    }

    async getUserAnalytics(req, res) {
        try {
            const { userId } = req.params;
            const { timeframe = '30d' } = req.query;

            const analytics = await this.analyticsService.getUserAnalytics(userId, timeframe);
            res.json({ success: true, data: analytics });
        } catch (error) {
            console.error('User analytics error:', error);
            res.status(500).json({ error: 'Failed to fetch user analytics' });
        }
    }

    async getGlobalAnalytics(req, res) {
        try {
            const { timeframe = '30d' } = req.query;
            const analytics = await this.analyticsService.getGlobalAnalytics(timeframe);
            res.json({ success: true, data: analytics });
        } catch (error) {
            console.error('Global analytics error:', error);
            res.status(500).json({ error: 'Failed to fetch global analytics' });
        }
    }

    async getRevenueAnalytics(req, res) {
        try {
            const { timeframe = '30d', groupBy = 'day' } = req.query;
            const revenue = await this.paymentService.getRevenueAnalytics(timeframe, groupBy);
            res.json({ success: true, data: revenue });
        } catch (error) {
            console.error('Revenue analytics error:', error);
            res.status(500).json({ error: 'Failed to fetch revenue analytics' });
        }
    }

    async getReferralMetrics(req, res) {
        try {
            const { timeframe = '30d' } = req.query;
            const metrics = await this.referralService.getReferralMetrics(timeframe);
            res.json({ success: true, data: metrics });
        } catch (error) {
            console.error('Referral metrics error:', error);
            res.status(500).json({ error: 'Failed to fetch referral metrics' });
        }
    }

    async exportData(req, res) {
        try {
            const { type, format = 'csv', timeframe = '30d' } = req.query;
            const data = await this.dashboardService.exportData(type, format, timeframe);
            
            res.setHeader('Content-Type', this.getContentType(format));
            res.setHeader('Content-Disposition', `attachment; filename=${type}_export.${format}`);
            res.send(data);
        } catch (error) {
            console.error('Data export error:', error);
            res.status(500).json({ error: 'Failed to export data' });
        }
    }

    getContentType(format) {
        const types = {
            csv: 'text/csv',
            json: 'application/json',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        return types[format] || 'text/plain';
    }
}

module.exports = new AdminController();
