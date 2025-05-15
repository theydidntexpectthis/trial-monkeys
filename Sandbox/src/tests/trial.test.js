const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const TrialService = require('../models/trial-service.model');

describe('Trial Service API', () => {
    let authToken;
    let testUser;
    let testService;

    beforeAll(async () => {
        // Connect to test database
        await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/trial-junkies-test');

        // Create test user
        testUser = await User.create({
            username: 'testuser',
            email: 'test@example.com',
            phantomWalletAddress: '0x123456789',
            subscription: {
                plan: 'premium',
                status: 'active'
            }
        });

        // Create test service
        testService = await TrialService.create({
            name: 'Test Service',
            description: 'Test service description',
            category: 'software',
            websiteUrl: 'https://test-service.com',
            trialDuration: {
                value: 7,
                unit: 'days'
            },
            price: {
                amount: 0.1,
                currency: 'SOL'
            }
        });

        // Get auth token
        const response = await request(app)
            .post('/api/auth/wallet/authenticate')
            .send({
                publicKey: '0x123456789',
                signature: 'test-signature',
                message: 'test-message'
            });

        authToken = response.body.token;
    });

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({});
        await TrialService.deleteMany({});
        await mongoose.connection.close();
    });

    describe('GET /api/trials/services', () => {
        it('should return available services', async () => {
            const response = await request(app)
                .get('/api/trials/services')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.services)).toBe(true);
            expect(response.body.services.length).toBeGreaterThan(0);
        });

        it('should filter services by category', async () => {
            const response = await request(app)
                .get('/api/trials/services?category=software')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.services.every(s => s.category === 'software')).toBe(true);
        });
    });

    describe('POST /api/trials/create', () => {
        it('should create a new trial account', async () => {
            const response = await request(app)
                .post('/api/trials/create')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    serviceId: testService._id
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.trial).toHaveProperty('serviceName', 'Test Service');
            expect(response.body.trial).toHaveProperty('status', 'active');
        });

        it('should prevent duplicate trial creation', async () => {
            const response = await request(app)
                .post('/api/trials/create')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    serviceId: testService._id
                });

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/trials/user-trials', () => {
        it('should return user\'s active trials', async () => {
            const response = await request(app)
                .get('/api/trials/user-trials')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.trials)).toBe(true);
            expect(response.body.trials.length).toBeGreaterThan(0);
        });
    });

    describe('PUT /api/trials/cancel/:trialId', () => {
        it('should cancel an active trial', async () => {
            const trials = await request(app)
                .get('/api/trials/user-trials')
                .set('Authorization', `Bearer ${authToken}`);

            const trialId = trials.body.trials[0]._id;

            const response = await request(app)
                .put(`/api/trials/cancel/${trialId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Trial cancelled successfully');
        });
    });
});
