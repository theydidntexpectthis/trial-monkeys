const request = require('supertest');
const app = require('../server');
const TrialService = require('../models/trial-service.model');
const User = require('../models/user.model');
const { generateJWT } = require('../utils/api.utils');

describe('Trial Service Tests', () => {
    let authToken;
    let testUser;

    beforeAll(async () => {
        // Create test user with subscription
        testUser = await User.create({
            username: 'trialuser',
            walletAddress: '8xyt9RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ',
            subscription: {
                tier: 'power',
                trialCount: 0,
                maxTrials: 5
            }
        });
        authToken = generateJWT(testUser);
    });

    describe('Trial Generation', () => {
        test('Should generate trial from valid URL', async () => {
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    serviceUrl: 'https://validservice.com/trial'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('trialAccount');
            expect(response.body.trialAccount).toHaveProperty('loginUrl');
            expect(response.body.trialAccount).toHaveProperty('expiresAt');
        });

        test('Should handle invalid URLs', async () => {
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    serviceUrl: 'invalid-url'
                });

            expect(response.status).toBe(400);
        });

        test('Should enforce trial limits', async () => {
            // Update user to max trials
            await User.findByIdAndUpdate(testUser._id, {
                'subscription.trialCount': 5
            });

            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    serviceUrl: 'https://validservice.com/trial'
                });

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toMatch(/trial limit/i);
        });
    });

    describe('Trial Management', () => {
        let testTrial;

        beforeEach(async () => {
            // Create a test trial
            testTrial = await TrialService.create({
                userId: testUser._id,
                serviceName: 'Test Service',
                serviceUrl: 'https://test.com',
                loginUrl: 'https://test.com/login',
                credentials: {
                    email: 'test@trialmonkeys.com',
                    password: 'securepass'
                },
                expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
            });
        });

        test('Should list active trials', async () => {
            const response = await request(app)
                .get('/api/trials/list')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.trials)).toBe(true);
            expect(response.body.trials.length).toBeGreaterThan(0);
        });

        test('Should extend trial duration', async () => {
            const response = await request(app)
                .post(`/api/trials/${testTrial._id}/extend`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    days: 7
                });

            expect(response.status).toBe(200);
            expect(response.body.trial.expiresAt).toBeDefined();
            
            const originalExpiry = new Date(testTrial.expiresAt);
            const newExpiry = new Date(response.body.trial.expiresAt);
            expect(newExpiry > originalExpiry).toBe(true);
        });

        test('Should cancel trial', async () => {
            const response = await request(app)
                .delete(`/api/trials/${testTrial._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);

            // Verify trial is cancelled
            const cancelledTrial = await TrialService.findById(testTrial._id);
            expect(cancelledTrial.status).toBe('cancelled');
        });
    });

    describe('Subscription Management', () => {
        test('Should upgrade subscription tier', async () => {
            const response = await request(app)
                .post('/api/subscription/upgrade')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    tier: 'enterprise',
                    paymentId: 'mock_payment_id'
                });

            expect(response.status).toBe(200);
            expect(response.body.subscription.tier).toBe('enterprise');
            expect(response.body.subscription.maxTrials).toBe(10);
        });

        test('Should handle invalid tier upgrades', async () => {
            const response = await request(app)
                .post('/api/subscription/upgrade')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    tier: 'invalid_tier',
                    paymentId: 'mock_payment_id'
                });

            expect(response.status).toBe(400);
        });
    });

    describe('Error Handling', () => {
        test('Should handle service unavailability', async () => {
            // Simulate service being down
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    serviceUrl: 'https://downservice.com/trial'
                });

            expect(response.status).toBe(503);
            expect(response.body).toHaveProperty('error');
        });

        test('Should handle concurrent requests', async () => {
            // Make multiple simultaneous requests
            const requests = Array(3).fill().map(() => 
                request(app)
                    .post('/api/trials/generate')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        serviceUrl: 'https://validservice.com/trial'
                    })
            );

            const responses = await Promise.all(requests);
            const successCount = responses.filter(r => r.status === 200).length;
            expect(successCount).toBeLessThanOrEqual(1);
        });
    });
});
