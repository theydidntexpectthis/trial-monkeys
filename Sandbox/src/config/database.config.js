/**
 * Database Configuration and Schema Definitions
 * Defines all collections, schemas, and relationships
 */

module.exports = {
    // Collection Names
    collections: {
        users: 'users',
        trials: 'trials',
        subscriptions: 'subscriptions',
        payments: 'payments',
        referrals: 'referrals',
        activities: 'activities',
        notifications: 'notifications',
        systemLogs: 'system_logs'
    },

    // Redis Key Patterns
    redis: {
        auth: {
            tokens: 'auth:tokens:',
            refresh: 'auth:refresh:',
            blacklist: 'auth:blacklist:'
        },
        cache: {
            users: 'cache:users:',
            trials: 'cache:trials:',
            subscriptions: 'cache:subscriptions:'
        },
        rates: {
            api: 'rates:api:',
            user: 'rates:user:',
            ip: 'rates:ip:'
        },
        metrics: {
            trials: 'metrics:trials:',
            users: 'metrics:users:',
            payments: 'metrics:payments:'
        }
    },

    // Schema Definitions
    schemas: {
        user: {
            id: { type: 'string', required: true },
            username: { type: 'string', required: true },
            email: { type: 'string', required: true },
            password: { type: 'string', required: true },
            verified: { type: 'boolean', default: false },
            verificationToken: { type: 'string' },
            role: { type: 'string', enum: ['user', 'admin', 'superadmin'] },
            status: { type: 'string', enum: ['active', 'suspended', 'banned'] },
            subscription: { type: 'string', ref: 'subscriptions' },
            referralCode: { type: 'string' },
            referredBy: { type: 'string', ref: 'users' },
            walletAddress: { type: 'string' },
            discord: {
                id: { type: 'string' },
                username: { type: 'string' }
            },
            telegram: {
                id: { type: 'string' },
                username: { type: 'string' }
            },
            preferences: {
                theme: { type: 'string', default: 'dark' },
                notifications: {
                    email: { type: 'boolean', default: true },
                    discord: { type: 'boolean', default: true },
                    telegram: { type: 'boolean', default: true }
                }
            },
            created: { type: 'date', required: true },
            lastLogin: { type: 'date' }
        },

        trial: {
            id: { type: 'string', required: true },
            userId: { type: 'string', ref: 'users', required: true },
            serviceName: { type: 'string', required: true },
            status: { type: 'string', enum: ['active', 'expired', 'cancelled'] },
            credentials: {
                email: { type: 'string' },
                password: { type: 'string' }
            },
            paymentMethod: { type: 'string', ref: 'virtual_cards' },
            startDate: { type: 'date', required: true },
            expiryDate: { type: 'date', required: true },
            automationProfile: { type: 'string' },
            proxyUsed: { type: 'string' },
            created: { type: 'date', required: true }
        },

        subscription: {
            id: { type: 'string', required: true },
            userId: { type: 'string', ref: 'users', required: true },
            planId: { type: 'string', required: true },
            status: { type: 'string', enum: ['active', 'cancelled', 'expired'] },
            currentPeriodStart: { type: 'date', required: true },
            currentPeriodEnd: { type: 'date', required: true },
            cancelAtPeriodEnd: { type: 'boolean', default: false },
            paymentMethod: { type: 'string' },
            created: { type: 'date', required: true }
        },

        payment: {
            id: { type: 'string', required: true },
            userId: { type: 'string', ref: 'users', required: true },
            type: { type: 'string', enum: ['subscription', 'trial', 'referral'] },
            amount: { type: 'number', required: true },
            currency: { type: 'string', required: true },
            status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
            provider: { type: 'string', required: true },
            transactionId: { type: 'string' },
            created: { type: 'date', required: true }
        },

        referral: {
            id: { type: 'string', required: true },
            referrerId: { type: 'string', ref: 'users', required: true },
            referredId: { type: 'string', ref: 'users', required: true },
            code: { type: 'string', required: true },
            status: { type: 'string', enum: ['pending', 'completed', 'expired'] },
            reward: { type: 'number' },
            created: { type: 'date', required: true }
        },

        activity: {
            id: { type: 'string', required: true },
            userId: { type: 'string', ref: 'users', required: true },
            type: { type: 'string', required: true },
            details: { type: 'object' },
            ip: { type: 'string' },
            userAgent: { type: 'string' },
            created: { type: 'date', required: true }
        },

        notification: {
            id: { type: 'string', required: true },
            userId: { type: 'string', ref: 'users', required: true },
            type: { type: 'string', required: true },
            title: { type: 'string', required: true },
            message: { type: 'string', required: true },
            read: { type: 'boolean', default: false },
            data: { type: 'object' },
            created: { type: 'date', required: true }
        },

        systemLog: {
            id: { type: 'string', required: true },
            level: { type: 'string', enum: ['info', 'warning', 'error'] },
            message: { type: 'string', required: true },
            context: { type: 'object' },
            stack: { type: 'string' },
            created: { type: 'date', required: true }
        }
    },

    // Index Configurations
    indexes: {
        users: [
            { fields: { email: 1 }, options: { unique: true } },
            { fields: { username: 1 }, options: { unique: true } },
            { fields: { referralCode: 1 }, options: { unique: true } }
        ],
        trials: [
            { fields: { userId: 1 } },
            { fields: { status: 1 } },
            { fields: { expiryDate: 1 } }
        ],
        subscriptions: [
            { fields: { userId: 1 } },
            { fields: { status: 1 } },
            { fields: { currentPeriodEnd: 1 } }
        ],
        payments: [
            { fields: { userId: 1 } },
            { fields: { status: 1 } },
            { fields: { created: -1 } }
        ],
        activities: [
            { fields: { userId: 1 } },
            { fields: { type: 1 } },
            { fields: { created: -1 } }
        ]
    },

    // Database Configuration
    config: {
        poolSize: 10,
        retryWrites: true,
        writeConcern: {
            w: 'majority',
            j: true,
            wtimeout: 1000
        },
        readPreference: 'primaryPreferred',
        readConcern: { level: 'majority' }
    }
};
