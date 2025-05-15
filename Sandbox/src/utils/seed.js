const mongoose = require('mongoose');
const User = require('../models/user.model');
const TrialService = require('../models/trial-service.model');
const config = require('../config/config');

const sampleServices = [
    {
        name: 'Netflix Premium',
        description: 'Stream your favorite movies and TV shows in 4K quality',
        category: 'streaming',
        websiteUrl: 'https://netflix.com',
        trialDuration: {
            value: 30,
            unit: 'days'
        },
        price: {
            amount: 5,
            currency: 'MONK'
        },
        requirements: {
            email: true,
            phoneNumber: false,
            creditCard: true,
            captcha: true
        },
        automationConfig: {
            selectors: {
                loginForm: '#loginForm',
                emailField: '#id_userLoginId',
                passwordField: '#id_password',
                submitButton: '.login-button',
                captchaElement: '#captcha-container'
            },
            steps: [
                { action: 'type', target: '#id_userLoginId', value: '{email}' },
                { action: 'type', target: '#id_password', value: '{password}' },
                { action: 'wait', target: '#captcha-container', delay: 2000 },
                { action: 'submit', target: '.login-button' }
            ]
        },
        status: 'active',
        popularity: 98,
        successRate: 95
    },
    {
        name: 'Adobe Creative Cloud',
        description: 'Access all Adobe creative apps including Photoshop and Illustrator',
        category: 'software',
        websiteUrl: 'https://adobe.com',
        trialDuration: {
            value: 7,
            unit: 'days'
        },
        price: {
            amount: 0.2,
            currency: 'SOL'
        },
        requirements: {
            email: true,
            phoneNumber: true,
            creditCard: false,
            captcha: true
        },
        status: 'active'
    },
    {
        name: 'Spotify Premium',
        description: 'Ad-free music streaming with offline playback',
        category: 'streaming',
        websiteUrl: 'https://spotify.com',
        trialDuration: {
            value: 14,
            unit: 'days'
        },
        price: {
            amount: 0.05,
            currency: 'SOL'
        },
        requirements: {
            email: true,
            phoneNumber: false,
            creditCard: false,
            captcha: true
        },
        status: 'active'
    }
];

const sampleUsers = [
    {
        username: 'demo_user',
        email: 'demo@trialmonkeys.com',
        walletAddress: '8xyt9RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ',
        subscription: {
            tier: 'power',
            trialCount: 2,
            maxTrials: 5,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        discord: {
            id: '123456789',
            username: 'demo_monkey'
        },
        preferences: {
            theme: 'dark',
            notifications: {
                email: true,
                discord: true
            }
        },
        stats: {
            trialsGenerated: 15,
            successfulTrials: 14,
            savedAmount: 299.99
        }
    },
    {
        username: 'enterprise_demo',
        email: 'enterprise@trialmonkeys.com',
        walletAddress: '9zyt8RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ',
        subscription: {
            tier: 'enterprise',
            trialCount: 3,
            maxTrials: 10,
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        },
        discord: {
            id: '987654321',
            username: 'power_monkey'
        },
        preferences: {
            theme: 'dark',
            notifications: {
                email: true,
                discord: true
            }
        },
        stats: {
            trialsGenerated: 45,
            successfulTrials: 42,
            savedAmount: 899.99
        }
    }
];

async function seedDatabase() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || config.database.uri);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Promise.all([
            User.deleteMany({}),
            TrialService.deleteMany({})
        ]);
        console.log('Cleared existing data');

        // Seed services
        const services = await TrialService.insertMany(sampleServices);
        console.log('Seeded services:', services.length);

        // Seed users
        const users = await User.insertMany(sampleUsers);
        console.log('Seeded users:', users.length);

        // Add some trial accounts to demo user
        const demoUser = users[0];
        const demoTrials = [
            {
                serviceName: services[0].name,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                status: 'active',
                credentials: {
                    email: `trial_${Date.now()}@tempmail.com`,
                    username: `trial_user_${Date.now()}`
                }
            }
        ];

        demoUser.trialAccounts = demoTrials;
        await demoUser.save();
        console.log('Added trial accounts to demo user');

        console.log('Database seeding completed successfully');
    } catch (error) {
        console.error('Database seeding failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run seeder if called directly
if (require.main === module) {
    seedDatabase().then(() => process.exit());
}

module.exports = seedDatabase;
