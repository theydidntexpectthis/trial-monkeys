const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Bot = require('../models/bot.model');
const User = require('../models/user.model');
const BotService = require('../services/bot.service');
const MonitorService = require('../services/monitor.service');
const { generateToken } = require('../utils/auth.utils');

describe('Bot Management', () => {
    let testUser;
    let authToken;
    let testBot;

    beforeAll(async () => {
        // Connect to test database
        await mongoose.connect(process.env.TEST_MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Create test user
        testUser = await User.create({
            username: 'testuser',
            email: 'test@example.com',
            subscription: {
                plan: 'premium',
                status: 'active',
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        });

        authToken = generateToken(testUser);
    });

    afterAll(async () => {
        // Clean up
        await User.deleteMany({});
        await Bot.deleteMany({});
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Create test bot before each test
        testBot = await Bot.create({
            userId: testUser._id,
            name: 'Test Bot',
            serviceType: 'netflix',
            config: {
                autoRetry: true,
                useProxy: true,
                retryAttempts: 3
            },
            status: 'inactive'
        });
    });

    afterEach(async () => {
        // Clean up test bot after each test
        await Bot.deleteMany({});
    });

    describe('GET /api/bots', () => {
        it('should return user\'s bots', async () => {
            const response = await request(app)
                .get('/api/bots')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.bots)).toBe(true);
            expect(response.body.bots.length).toBe(1);
            expect(response.body.bots[0].name).toBe('Test Bot');
        });

        it('should filter bots by category', async () => {
            const response = await request(app)
                .get('/api/bots?category=streaming')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.bots.length).toBe(1);
        });

        it('should filter bots by status', async () => {
            const response = await request(app)
                .get('/api/bots?status=inactive')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.bots.length).toBe(1);
        });
    });

    describe('POST /api/bots', () => {
        it('should create a new bot', async () => {
            const newBot = {
                serviceType: 'spotify',
                name: 'Spotify Bot',
                config: {
                    autoRetry: true,
                    useProxy: true
                }
            };

            const response = await request(app)
                .post('/api/bots')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newBot);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.bot.name).toBe('Spotify Bot');
        });

        it('should validate bot configuration', async () => {
            const invalidBot = {
                serviceType: 'invalid',
                name: 'Invalid Bot',
                config: {}
            };

            const response = await request(app)
                .post('/api/bots')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidBot);

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /api/bots/:botId', () => {
        it('should update bot configuration', async () => {
            const updates = {
                config: {
                    autoRetry: false,
                    useProxy: true,
                    retryAttempts: 1
                }
            };

            const response = await request(app)
                .put(`/api/bots/${testBot._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.bot.config.autoRetry).toBe(false);
        });
    });

    describe('POST /api/bots/:botId/launch', () => {
        it('should launch bot successfully', async () => {
            // Mock MonitorService
            jest.spyOn(MonitorService, 'getMonitoringStatus').mockResolvedValue({
                status: 'healthy'
            });

            // Mock BotService
            jest.spyOn(BotService, 'launchBot').mockResolvedValue({
                id: 'test-instance'
            });

            const response = await request(app)
                .post(`/api/bots/${testBot._id}/launch`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.instanceId).toBe('test-instance');

            // Verify bot status was updated
            const updatedBot = await Bot.findById(testBot._id);
            expect(updatedBot.status).toBe('active');
        });

        it('should not launch unhealthy bot', async () => {
            jest.spyOn(MonitorService, 'getMonitoringStatus').mockResolvedValue({
                status: 'error'
            });

            const response = await request(app)
                .post(`/api/bots/${testBot._id}/launch`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/bots/:botId/stop', () => {
        it('should stop running bot', async () => {
            // Set bot as active
            testBot.status = 'active';
            await testBot.save();

            const response = await request(app)
                .post(`/api/bots/${testBot._id}/stop`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify bot status was updated
            const updatedBot = await Bot.findById(testBot._id);
            expect(updatedBot.status).toBe('inactive');
        });
    });

    describe('DELETE /api/bots/:botId', () => {
        it('should delete bot', async () => {
            const response = await request(app)
                .delete(`/api/bots/${testBot._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify bot was deleted
            const deletedBot = await Bot.findById(testBot._id);
            expect(deletedBot).toBeNull();
        });
    });

    describe('POST /api/bots/:botId/reset-stats', () => {
        it('should reset bot statistics', async () => {
            // Add some statistics
            testBot.statistics = {
                totalRuns: 10,
                successfulRuns: 8,
                failedRuns: 2,
                averageSuccessRate: 80,
                averageRunTime: 1000
            };
            await testBot.save();

            const response = await request(app)
                .post(`/api/bots/${testBot._id}/reset-stats`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify statistics were reset
            const updatedBot = await Bot.findById(testBot._id);
            expect(updatedBot.statistics.totalRuns).toBe(0);
            expect(updatedBot.statistics.successfulRuns).toBe(0);
            expect(updatedBot.statistics.failedRuns).toBe(0);
        });
    });

    describe('GET /api/bots/:botId/logs', () => {
        it('should get bot logs', async () => {
            const response = await request(app)
                .get(`/api/bots/${testBot._id}/logs`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.logs)).toBe(true);
        });

        it('should filter logs by date range', async () => {
            const response = await request(app)
                .get(`/api/bots/${testBot._id}/logs`)
                .query({
                    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/bots/statistics', () => {
        it('should get bot statistics', async () => {
            const response = await request(app)
                .get('/api/bots/statistics')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.statistics).toBeDefined();
            expect(response.body.statistics.total).toBe(1);
        });
    });

    describe('GET /api/bots/:botId/health', () => {
        it('should get bot health status', async () => {
            const response = await request(app)
                .get(`/api/bots/${testBot._id}/health`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.health).toBeDefined();
        });
    });
});
