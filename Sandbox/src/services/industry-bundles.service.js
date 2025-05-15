const Redis = require('ioredis');
const apiConfig = require('../config/api-integrations.config');

class IndustryBundlesService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.bundles = {
            enterprise: {
                name: "Enterprise Suite",
                icon: "🏢",
                services: [
                    { name: "Microsoft 365", category: "productivity", duration: 30 },
                    { name: "Slack Premium", category: "communication", duration: 30 },
                    { name: "Zoom Pro", category: "communication", duration: 14 },
                    { name: "Adobe Creative Cloud", category: "creativity", duration: 14 }
                ],
                price: { amount: 50, currency: "MONK" },
                features: ["Priority Support", "Extended Duration", "Auto-Renewal Protection"]
            },
            creative: {
                name: "Creative Pro Pack",
                icon: "🎨",
                services: [
                    { name: "Adobe Creative Cloud", category: "creativity", duration: 30 },
                    { name: "Figma Pro", category: "design", duration: 30 },
                    { name: "Canva Pro", category: "design", duration: 30 },
                    { name: "Sketch", category: "design", duration: 14 }
                ],
                price: { amount: 40, currency: "MONK" },
                features: ["Design Tools", "Asset Libraries", "Collaboration Features"]
            },
            developer: {
                name: "Developer Bundle",
                icon: "👨‍💻",
                services: [
                    { name: "JetBrains All Products", category: "development", duration: 30 },
                    { name: "GitHub Pro", category: "development", duration: 30 },
                    { name: "AWS Credits", category: "cloud", duration: 30 },
                    { name: "MongoDB Atlas", category: "database", duration: 30 }
                ],
                price: { amount: 45, currency: "MONK" },
                features: ["IDE Suite", "Cloud Credits", "Repository Access"]
            },
            education: {
                name: "Learning Bundle",
                icon: "📚",
                services: [
                    { name: "Coursera Plus", category: "education", duration: 30 },
                    { name: "Udemy Pro", category: "education", duration: 30 },
                    { name: "LinkedIn Learning", category: "education", duration: 30 },
                    { name: "Grammarly Premium", category: "writing", duration: 14 }
                ],
                price: { amount: 35, currency: "MONK" },
                features: ["Unlimited Courses", "Certificates", "Practice Tests"]
            }
        };
    }

    async getBundlesByIndustry(industry) {
        const bundleKey = `bundle:${industry}`;
        let bundle = await this.redis.get(bundleKey);

        if (!bundle) {
            bundle = this.bundles[industry];
            if (bundle) {
                await this.redis.setex(bundleKey, 3600, JSON.stringify(bundle));
            }
        } else {
            bundle = JSON.parse(bundle);
        }

        return bundle;
    }

    async generateIndustryBundle(industry, userId) {
        const bundle = await this.getBundlesByIndustry(industry);
        if (!bundle) throw new Error('Invalid industry bundle');

        const trials = [];
        for (const service of bundle.services) {
            try {
                const trial = await this.generateServiceTrial(service, userId);
                trials.push(trial);
            } catch (error) {
                console.error(`Failed to generate trial for ${service.name}:`, error);
            }
        }

        const bundleResult = {
            id: `bundle_${Date.now()}`,
            industry,
            userId,
            trials,
            status: this.calculateBundleStatus(trials),
            created: new Date(),
            expires: this.calculateBundleExpiry(trials)
        };

        await this.saveBundleResult(bundleResult);
        return bundleResult;
    }

    async getFilteredServices(filters) {
        const {
            category,
            duration,
            price,
            features
        } = filters;

        let services = await this.getAllServices();

        if (category) {
            services = services.filter(s => s.category === category);
        }

        if (duration) {
            services = services.filter(s => s.duration <= duration);
        }

        if (price) {
            services = services.filter(s => s.price.amount <= price);
        }

        if (features && features.length) {
            services = services.filter(s => 
                features.every(f => s.features.includes(f))
            );
        }

        return services;
    }

    async generateServiceTrial(service, userId) {
        // Get service configuration
        const serviceConfig = await this.getServiceConfig(service.name);
        if (!serviceConfig) throw new Error(`Service ${service.name} not configured`);

        // Generate trial credentials
        const credentials = await this.generateTrialCredentials(service);

        // Create trial record
        const trial = {
            serviceId: service.name,
            userId,
            credentials,
            status: 'active',
            created: new Date(),
            expires: this.calculateTrialExpiry(service.duration),
            category: service.category
        };

        // Save trial record
        await this.saveTrialRecord(trial);

        return trial;
    }

    async getServiceConfig(serviceName) {
        const categories = apiConfig.categories;
        for (const category of Object.values(categories)) {
            const service = category.services.find(s => s.name === serviceName);
            if (service) return service;
        }
        return null;
    }

    async generateTrialCredentials(service) {
        return {
            email: `trial_${Date.now()}@trialmonkeys.com`,
            password: `Trial${Date.now()}!`,
            username: `TrialUser${Date.now()}`
        };
    }

    calculateTrialExpiry(duration) {
        const date = new Date();
        date.setDate(date.getDate() + duration);
        return date;
    }

    calculateBundleExpiry(trials) {
        return trials.reduce((latest, trial) => {
            return trial.expires > latest ? trial.expires : latest;
        }, new Date());
    }

    calculateBundleStatus(trials) {
        const active = trials.filter(t => t.status === 'active').length;
        const total = trials.length;
        
        if (active === 0) return 'failed';
        if (active === total) return 'success';
        return 'partial';
    }

    async saveBundleResult(bundle) {
        const key = `bundle:result:${bundle.id}`;
        await this.redis.setex(key, 30 * 24 * 60 * 60, JSON.stringify(bundle));
    }

    async saveTrialRecord(trial) {
        const key = `trial:${trial.serviceId}:${trial.userId}`;
        await this.redis.setex(key, 30 * 24 * 60 * 60, JSON.stringify(trial));
    }

    async getAllServices() {
        const services = [];
        const categories = apiConfig.categories;
        
        for (const category of Object.values(categories)) {
            services.push(...category.services.map(s => ({
                ...s,
                category: category.name
            })));
        }

        return services;
    }
}

module.exports = new IndustryBundlesService();
