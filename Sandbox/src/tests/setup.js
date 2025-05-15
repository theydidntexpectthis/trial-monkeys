const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Redis = require('ioredis');
const { createClient } = require('redis');

let mongoServer;
let redisClient;

// Setup hooks for test environment
beforeAll(async () => {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    // Initialize Redis client
    redisClient = process.env.NODE_ENV === 'test' 
        ? new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6380
          })
        : createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
          });

    // Clear all collections
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
        await collection.deleteMany({});
    }

    // Clear Redis
    await redisClient.flushall();

    // Setup mock data
    await setupMockData();
});

afterAll(async () => {
    // Cleanup MongoDB
    await mongoose.disconnect();
    await mongoServer.stop();

    // Cleanup Redis
    await redisClient.quit();
});

beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
});

// Mock data setup
async function setupMockData() {
    const User = require('../models/user.model');
    const TrialService = require('../models/trial-service.model');

    // Create test users
    await User.create([
        {
            username: 'testuser',
            walletAddress: '8xyt9RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ',
            subscription: {
                tier: 'power',
                trialCount: 0,
                maxTrials: 5
            }
        },
        {
            username: 'enterprise_user',
            walletAddress: '9zyt8RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ',
            subscription: {
                tier: 'enterprise',
                trialCount: 2,
                maxTrials: 10
            }
        }
    ]);

    // Create test services
    await TrialService.create([
        {
            serviceName: 'Netflix',
            serviceUrl: 'https://netflix.com',
            category: 'streaming',
            trialDuration: { value: 30, unit: 'days' },
            requirements: {
                email: true,
                phoneNumber: false,
                creditCard: true
            }
        },
        {
            serviceName: 'Spotify',
            serviceUrl: 'https://spotify.com',
            category: 'streaming',
            trialDuration: { value: 14, unit: 'days' },
            requirements: {
                email: true,
                phoneNumber: false,
                creditCard: false
            }
        }
    ]);
}

// Global test utilities
global.testUtils = {
    clearDatabase: async () => {
        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            await collection.deleteMany({});
        }
        await redisClient.flushall();
    },
    
    createTestUser: async (userData) => {
        const User = require('../models/user.model');
        return await User.create(userData);
    },

    generateAuthToken: (user) => {
        const jwt = require('jsonwebtoken');
        return jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'test_secret',
            { expiresIn: '1h' }
        );
    }
};

// Mock external services
jest.mock('@solana/web3.js', () => ({
    Connection: jest.fn(),
    PublicKey: jest.fn()
}));

jest.mock('discord.js', () => ({
    Client: jest.fn().mockImplementation(() => ({
        login: jest.fn().mockResolvedValue(true),
        users: {
            fetch: jest.fn().mockResolvedValue({
                id: 'mock_discord_id',
                username: 'mock_user',
                email: 'mock@discord.com'
            })
        }
    }))
}));

// Mock environment variables
process.env = {
    ...process.env,
    NODE_ENV: 'test',
    JWT_SECRET: 'test_secret',
    DISCORD_CLIENT_ID: 'test_discord_id',
    SOLANA_NETWORK: 'devnet',
    MONK_TOKEN_ADDRESS: 'test_token_address'
};
