const Redis = require('ioredis');
const config = require('../config/entertainment-api.config');
const bundles = require('../config/bundles.config');

class EntertainmentProfileService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.prefix = 'entertainment:profile:';
    }

    async createProfile(userId, preferences = {}) {
        const profile = {
            userId,
            preferences: {
                streamingQuality: preferences.quality || 'HD',
                audioQuality: preferences.audio || 'High',
                language: preferences.language || 'en',
                subtitles: preferences.subtitles || true,
                notifications: preferences.notifications || true
            },
            devices: [],
            activeTrials: {},
            history: [],
            stats: {
                trialsGenerated: 0,
                successRate: 100,
                totalSaved: 0
            },
            created: Date.now(),
            lastUpdated: Date.now()
        };

        await this.redis.hset(
            this.getProfileKey(userId),
            'data',
            JSON.stringify(profile)
        );

        return profile;
    }

    async updateProfile(userId, updates) {
        const profile = await this.getProfile(userId);
        if (!profile) throw new Error('Profile not found');

        const updatedProfile = {
            ...profile,
            ...updates,
            lastUpdated: Date.now()
        };

        await this.redis.hset(
            this.getProfileKey(userId),
            'data',
            JSON.stringify(updatedProfile)
        );

        return updatedProfile;
    }

    async addDevice(userId, device) {
        const profile = await this.getProfile(userId);
        if (!profile) throw new Error('Profile not found');

        const deviceInfo = {
            id: `device_${Date.now()}`,
            name: device.name,
            type: device.type,
            userAgent: device.userAgent,
            added: Date.now(),
            lastUsed: null
        };

        profile.devices.push(deviceInfo);
        await this.updateProfile(userId, profile);

        return deviceInfo;
    }

    async trackTrial(userId, trial) {
        const profile = await this.getProfile(userId);
        if (!profile) throw new Error('Profile not found');

        // Update active trials
        profile.activeTrials[trial.serviceName] = {
            trialId: trial.id,
            startDate: trial.startDate,
            expiryDate: trial.expiryDate,
            status: trial.status
        };

        // Update history
        profile.history.push({
            serviceName: trial.serviceName,
            timestamp: Date.now(),
            action: 'trial_generated',
            status: trial.status
        });

        // Update stats
        profile.stats.trialsGenerated++;
        profile.stats.successRate = this.calculateSuccessRate(profile.history);
        profile.stats.totalSaved += this.calculateSavings(trial.serviceName);

        await this.updateProfile(userId, profile);
    }

    async getRecommendations(userId) {
        const profile = await this.getProfile(userId);
        if (!profile) throw new Error('Profile not found');

        const activeServices = Object.keys(profile.activeTrials);
        const recommendations = [];

        // Check bundle opportunities
        for (const [bundleKey, bundle] of Object.entries(bundles)) {
            const missingServices = bundle.services
                .filter(service => !activeServices.includes(service.name));

            if (missingServices.length > 0) {
                recommendations.push({
                    type: 'bundle',
                    name: bundle.name,
                    services: missingServices,
                    savings: bundle.price.savings
                });
            }
        }

        // Check individual services based on usage patterns
        const servicePatterns = await this.analyzeServicePatterns(profile.history);
        for (const [category, score] of Object.entries(servicePatterns)) {
            if (score > 0.7) { // High interest in category
                recommendations.push({
                    type: 'service',
                    category,
                    services: this.getServicesInCategory(category, activeServices)
                });
            }
        }

        return recommendations;
    }

    async getServiceUsage(userId) {
        const profile = await this.getProfile(userId);
        if (!profile) throw new Error('Profile not found');

        return {
            active: Object.keys(profile.activeTrials).length,
            history: profile.history.length,
            successRate: profile.stats.successRate,
            savings: profile.stats.totalSaved,
            categories: await this.analyzeServicePatterns(profile.history)
        };
    }

    async cleanupExpiredTrials(userId) {
        const profile = await this.getProfile(userId);
        if (!profile) return;

        const now = Date.now();
        const activeTrials = { ...profile.activeTrials };

        for (const [service, trial] of Object.entries(activeTrials)) {
            if (new Date(trial.expiryDate) < now) {
                delete activeTrials[service];
                profile.history.push({
                    serviceName: service,
                    timestamp: now,
                    action: 'trial_expired',
                    status: 'expired'
                });
            }
        }

        await this.updateProfile(userId, { ...profile, activeTrials });
    }

    // Helper Methods
    getProfileKey(userId) {
        return `${this.prefix}${userId}`;
    }

    async getProfile(userId) {
        const data = await this.redis.hget(this.getProfileKey(userId), 'data');
        return data ? JSON.parse(data) : null;
    }

    calculateSuccessRate(history) {
        const trials = history.filter(h => h.action === 'trial_generated');
        if (!trials.length) return 100;

        const successful = trials.filter(t => t.status === 'active').length;
        return (successful / trials.length) * 100;
    }

    calculateSavings(serviceName) {
        const serviceConfig = config.services[serviceName];
        return serviceConfig?.price || 0;
    }

    async analyzeServicePatterns(history) {
        const categories = {};
        const decay = 0.1; // Recent activities weight more

        history.forEach((entry, index) => {
            const weight = Math.exp(-decay * (history.length - index));
            const service = entry.serviceName.toLowerCase();
            
            if (service.includes('netflix') || service.includes('disney')) {
                categories.streaming = (categories.streaming || 0) + weight;
            } else if (service.includes('spotify') || service.includes('music')) {
                categories.music = (categories.music || 0) + weight;
            } else if (service.includes('game') || service.includes('xbox')) {
                categories.gaming = (categories.gaming || 0) + weight;
            }
        });

        return categories;
    }

    getServicesInCategory(category, activeServices) {
        const allServices = bundles.entertainmentBundle.services
            .filter(s => s.category === category && !activeServices.includes(s.name));
        
        return allServices.slice(0, 3); // Top 3 recommendations
    }
}

module.exports = new EntertainmentProfileService();
