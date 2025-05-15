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
            amount: 0.1,
            currency: 'SOL'
        },
        requirements: {
            email: true,
            phoneNumber: false,
            creditCard: false,
            captcha: true
        },
        status: 'active'
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
        email: 'demo@trialjunkies.com',
        phantomWalletAddress: '0xdemo123456789',
        subscription: {
            plan: 'premium',
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        isActive: true,
        verificationStatus: {
            email: true,
            wallet: true
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
