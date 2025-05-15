const UserSubscriptionService = require('../services/user-subscription.service');
const IndustryBundlesService = require('../services/industry-bundles.service');
const NotificationsService = require('../services/user-notifications.service');
const apiConfig = require('../config/api-integrations.config');
const serviceEndpoints = require('../config/service-endpoints.config');

class DashboardController {
    async getDashboardData(req, res) {
        try {
            const userId = req.user.id;
            const [
                subscription,
                stats,
                notifications,
                bundles
            ] = await Promise.all([
                UserSubscriptionService.getSubscriptionDetails(userId),
                UserSubscriptionService.getUserStats(userId),
                NotificationsService.getNotificationHistory(userId),
                IndustryBundlesService.getBundlesByIndustry('all')
            ]);

            res.json({
                subscription,
                stats,
                notifications: notifications.slice(0, 5), // Latest 5 notifications
                bundles,
                services: this.getAvailableServices()
            });
        } catch (error) {
            console.error('Dashboard data error:', error);
            res.status(500).json({ error: 'Failed to load dashboard data' });
        }
    }

    async getActiveTrials(req, res) {
        try {
            const userId = req.user.id;
            const activeTrials = await UserSubscriptionService.getActiveTrials(userId);

            const enrichedTrials = await Promise.all(
                activeTrials.map(async trial => ({
                    ...trial,
                    serviceDetails: this.getServiceDetails(trial.serviceName),
                    remainingDays: this.calculateRemainingDays(trial.expiryDate)
                }))
            );

            res.json({ trials: enrichedTrials });
        } catch (error) {
            console.error('Active trials error:', error);
            res.status(500).json({ error: 'Failed to load active trials' });
        }
    }

    async getAvailableServices(req, res) {
        try {
            const category = req.query.category;
            const services = this.filterServicesByCategory(category);

            const enrichedServices = services.map(service => ({
                ...service,
                logo: this.getServiceLogo(service.domain),
                successRate: this.getServiceSuccessRate(service.name)
            }));

            res.json({ services: enrichedServices });
        } catch (error) {
            console.error('Available services error:', error);
            res.status(500).json({ error: 'Failed to load available services' });
        }
    }

    async getServiceBundles(req, res) {
        try {
            const industry = req.params.industry;
            const bundles = await IndustryBundlesService.getBundlesByIndustry(industry);

            const enrichedBundles = bundles.map(bundle => ({
                ...bundle,
                services: bundle.services.map(service => ({
                    ...service,
                    logo: this.getServiceLogo(service.domain)
                }))
            }));

            res.json({ bundles: enrichedBundles });
        } catch (error) {
            console.error('Service bundles error:', error);
            res.status(500).json({ error: 'Failed to load service bundles' });
        }
    }

    async getUserStats(req, res) {
        try {
            const userId = req.user.id;
            const stats = await UserSubscriptionService.getUserStats(userId);

            const enrichedStats = {
                ...stats,
                savingsBreakdown: this.calculateSavingsBreakdown(stats),
                successRate: this.calculateSuccessRate(stats),
                popularServices: this.getPopularServices(stats.trialHistory)
            };

            res.json({ stats: enrichedStats });
        } catch (error) {
            console.error('User stats error:', error);
            res.status(500).json({ error: 'Failed to load user statistics' });
        }
    }

    async updateUserPreferences(req, res) {
        try {
            const userId = req.user.id;
            const preferences = req.body;

            const updatedPreferences = await UserSubscriptionService.updateUserPreferences(
                userId,
                preferences
            );

            res.json({ preferences: updatedPreferences });
        } catch (error) {
            console.error('Preferences update error:', error);
            res.status(500).json({ error: 'Failed to update preferences' });
        }
    }

    // Helper Methods
    getServiceDetails(serviceName) {
        for (const category of Object.values(serviceEndpoints)) {
            if (category[serviceName]) {
                return {
                    ...category[serviceName],
                    logo: this.getServiceLogo(category[serviceName].url)
                };
            }
        }
        return null;
    }

    getServiceLogo(domain) {
        return `${apiConfig.logoBaseUrl}${domain}?token=${apiConfig.logoToken}`;
    }

    filterServicesByCategory(category) {
        if (!category || category === 'all') {
            return Object.values(serviceEndpoints)
                .flatMap(cat => Object.values(cat));
        }
        return Object.values(serviceEndpoints[category] || {});
    }

    getServiceSuccessRate(serviceName) {
        // Implementation would fetch actual success rate from monitoring service
        return 95; // Placeholder
    }

    calculateRemainingDays(expiryDate) {
        const expiry = new Date(expiryDate);
        const now = new Date();
        return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    }

    calculateSavingsBreakdown(stats) {
        return {
            monthly: stats.totalSaved / 3, // Assuming 3 months of data
            byCategory: this.groupSavingsByCategory(stats.trialHistory),
            projected: stats.totalSaved * 4 // Projected annual savings
        };
    }

    calculateSuccessRate(stats) {
        if (!stats.totalTrials) return 100;
        return (stats.successfulTrials / stats.totalTrials) * 100;
    }

    getPopularServices(history) {
        const serviceCounts = history.reduce((acc, trial) => {
            acc[trial.serviceName] = (acc[trial.serviceName] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(serviceCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5) // Top 5 services
            .map(([service, count]) => ({
                name: service,
                count,
                logo: this.getServiceLogo(this.getServiceDetails(service)?.url)
            }));
    }

    groupSavingsByCategory(history) {
        return history.reduce((acc, trial) => {
            const service = this.getServiceDetails(trial.serviceName);
            if (service) {
                const category = service.category || 'other';
                acc[category] = (acc[category] || 0) + (trial.savings || 0);
            }
            return acc;
        }, {});
    }
}

module.exports = new DashboardController();
