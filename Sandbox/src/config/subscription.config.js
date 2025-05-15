const subscriptionPlans = {
    // Free tier
    free: {
        name: 'Free',
        price: 0,
        billing: 'monthly',
        features: {
            maxTrials: 5,
            concurrentTrials: 1,
            categories: ['streaming', 'gaming'],
            proxySupport: false,
            captchaSolving: false,
            successRate: 85,
            support: 'community',
            analytics: 'basic',
            retention: '7d'
        },
        limits: {
            dailyTrials: 3,
            monthlyTrials: 20,
            retryAttempts: 1,
            historyDuration: 7, // days
            maxDevices: 1
        },
        bots: {
            access: ['basic'],
            customization: false,
            scheduling: false
        },
        support: {
            type: 'community',
            response: '48h',
            channels: ['forum']
        }
    },

    // Basic tier
    basic: {
        name: 'Basic',
        price: 9.99,
        billing: 'monthly',
        features: {
            maxTrials: 20,
            concurrentTrials: 3,
            categories: ['streaming', 'gaming', 'development', 'productivity'],
            proxySupport: true,
            captchaSolving: true,
            successRate: 92,
            support: 'email',
            analytics: 'advanced',
            retention: '30d'
        },
        limits: {
            dailyTrials: 10,
            monthlyTrials: 100,
            retryAttempts: 3,
            historyDuration: 30, // days
            maxDevices: 2
        },
        bots: {
            access: ['basic', 'premium'],
            customization: true,
            scheduling: true
        },
        support: {
            type: 'priority',
            response: '24h',
            channels: ['email', 'chat']
        }
    },

    // Premium tier
    premium: {
        name: 'Premium',
        price: 29.99,
        billing: 'monthly',
        features: {
            maxTrials: 100,
            concurrentTrials: 10,
            categories: ['streaming', 'gaming', 'development', 'productivity', 'education', 'enterprise'],
            proxySupport: true,
            captchaSolving: true,
            successRate: 98,
            support: '24/7',
            analytics: 'premium',
            retention: '90d'
        },
        limits: {
            dailyTrials: 50,
            monthlyTrials: 500,
            retryAttempts: 5,
            historyDuration: 90, // days
            maxDevices: 5
        },
        bots: {
            access: ['basic', 'premium', 'enterprise'],
            customization: true,
            scheduling: true,
            priorityQueue: true
        },
        support: {
            type: 'dedicated',
            response: '1h',
            channels: ['email', 'chat', 'phone']
        }
    },

    // Enterprise tier
    enterprise: {
        name: 'Enterprise',
        price: 'custom',
        billing: 'custom',
        features: {
            maxTrials: 'unlimited',
            concurrentTrials: 'unlimited',
            categories: 'all',
            proxySupport: true,
            captchaSolving: true,
            successRate: 99,
            support: '24/7 dedicated',
            analytics: 'enterprise',
            retention: '365d'
        },
        limits: {
            dailyTrials: 'unlimited',
            monthlyTrials: 'unlimited',
            retryAttempts: 10,
            historyDuration: 365, // days
            maxDevices: 'unlimited'
        },
        bots: {
            access: 'all',
            customization: true,
            scheduling: true,
            priorityQueue: true,
            customBots: true
        },
        support: {
            type: 'dedicated',
            response: '15m',
            channels: ['all']
        }
    }
};

const featureDefinitions = {
    maxTrials: 'Maximum number of trial accounts that can be created',
    concurrentTrials: 'Number of trials that can be running simultaneously',
    categories: 'Available service categories for trial creation',
    proxySupport: 'Access to proxy rotation and management',
    captchaSolving: 'Automated CAPTCHA solving support',
    successRate: 'Expected success rate for trial creation',
    support: 'Level of customer support provided',
    analytics: 'Depth and detail of analytics provided',
    retention: 'Duration of data and history retention'
};

const subscriptionUtils = {
    // Check if user has access to feature
    hasFeatureAccess: (plan, feature) => {
        const planConfig = subscriptionPlans[plan];
        return planConfig && planConfig.features[feature];
    },

    // Get plan limits
    getPlanLimits: (plan) => {
        return subscriptionPlans[plan]?.limits || subscriptionPlans.free.limits;
    },

    // Check if user has reached limit
    hasReachedLimit: (plan, limit, currentValue) => {
        const planLimits = subscriptionPlans[plan]?.limits;
        if (!planLimits) return true;
        
        const limitValue = planLimits[limit];
        if (limitValue === 'unlimited') return false;
        
        return currentValue >= limitValue;
    },

    // Get available bots for plan
    getAvailableBots: (plan) => {
        return subscriptionPlans[plan]?.bots.access || ['basic'];
    },

    // Compare plans
    comparePlans: (planA, planB) => {
        const plans = ['free', 'basic', 'premium', 'enterprise'];
        const planAIndex = plans.indexOf(planA);
        const planBIndex = plans.indexOf(planB);
        
        return planAIndex - planBIndex;
    },

    // Get plan upgrade recommendations
    getUpgradeRecommendations: (currentPlan) => {
        const plans = ['free', 'basic', 'premium', 'enterprise'];
        const currentIndex = plans.indexOf(currentPlan);
        
        return plans
            .slice(currentIndex + 1)
            .map(plan => ({
                name: subscriptionPlans[plan].name,
                price: subscriptionPlans[plan].price,
                additionalFeatures: Object.entries(subscriptionPlans[plan].features)
                    .filter(([feature, value]) => 
                        value !== subscriptionPlans[currentPlan].features[feature]
                    )
            }));
    }
};

module.exports = {
    plans: subscriptionPlans,
    features: featureDefinitions,
    utils: subscriptionUtils
};
