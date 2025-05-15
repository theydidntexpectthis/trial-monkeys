const request = require('supertest');
const app = require('../server');
const User = require('../models/user.model');
const TrialService = require('../models/trial-service.model');

describe('End-to-End Trial Flow Tests', () => {
    let authToken;
    let testUser;

    beforeAll(async () => {
        // Create test user
        testUser = await testUtils.createTestUser({
            username: 'e2euser',
            walletAddress: '8xyt9RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ',
            subscription: {
                tier: 'power',
                trialCount: 0,
                maxTrials: 5
            }
        });
        authToken = testUtils.generateAuthToken(testUser);
    });

    describe('Complete Trial Generation Flow', () => {
        test('Should complete full trial generation process', async () => {
            // Step 1: Authenticate
            const authResponse = await request(app)
                .post('/api/auth/wallet')
                .send({
                    publicKey: testUser.walletAddress
                });

            expect(authResponse.status).toBe(200);
            expect(authResponse.body).toHaveProperty('token');

            const flowToken = authResponse.body.token;

            // Step 2: Check subscription status
            const subscriptionResponse = await request(app)
                .get('/api/subscription/status')
                .set('Authorization', `Bearer ${flowToken}`);

            expect(subscriptionResponse.status).toBe(200);
            expect(subscriptionResponse.body.subscription.tier).toBe('power');

            // Step 3: Generate trial account
            const trialResponse = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${flowToken}`)
                .send({
                    serviceUrl: 'https://netflix.com/signup'
                });

            expect(trialResponse.status).toBe(200);
            expect(trialResponse.body).toHaveProperty('trialAccount');
            const trialId = trialResponse.body.trialAccount.id;

            // Step 4: Verify trial details
            const trialDetailsResponse = await request(app)
                .get(`/api/trials/${trialId}`)
                .set('Authorization', `Bearer ${flowToken}`);

            expect(trialDetailsResponse.status).toBe(200);
            expect(trialDetailsResponse.body.trial).toHaveProperty('loginUrl');
            expect(trialDetailsResponse.body.trial).toHaveProperty('credentials');

            // Step 5: Check trial activation
            const activationResponse = await request(app)
                .post(`/api/trials/${trialId}/activate`)
                .set('Authorization', `Bearer ${flowToken}`);

            expect(activationResponse.status).toBe(200);
            expect(activationResponse.body.trial.status).toBe('active');

            // Step 6: Verify user trial count updated
            const userResponse = await request(app)
                .get('/api/user/profile')
                .set('Authorization', `Bearer ${flowToken}`);

            expect(userResponse.status).toBe(200);
            expect(userResponse.body.user.subscription.trialCount).toBe(1);
        });

        test('Should handle concurrent trial generations', async () => {
            const generateTrials = async () => {
                const promises = Array(3).fill().map(() =>
                    request(app)
                        .post('/api/trials/generate')
                        .set('Authorization', `Bearer ${authToken}`)
                        .send({
                            serviceUrl: 'https://spotify.com/signup'
                        })
                );

                return await Promise.all(promises);
            };

            const responses = await generateTrials();
            
            // Verify rate limiting and concurrency handling
            const successCount = responses.filter(r => r.status === 200).length;
            expect(successCount).toBeLessThanOrEqual(1);
            
            // Check error responses
            const errorResponses = responses.filter(r => r.status !== 200);
            errorResponses.forEach(response => {
                expect(response.status).toBeGreaterThanOrEqual(400);
                expect(response.body).toHaveProperty('error');
            });
        });
    });

    describe('Trial Management Flow', () => {
        let activeTrial;

        beforeEach(async () => {
            // Create an active trial
            activeTrial = await TrialService.create({
                userId: testUser._id,
                serviceName: 'Test Service',
                serviceUrl: 'https://test.com',
                status: 'active',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
        });

        test('Should manage trial lifecycle', async () => {
            // Step 1: Check trial status
            const statusResponse = await request(app)
                .get(`/api/trials/${activeTrial._id}/status`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(statusResponse.status).toBe(200);
            expect(statusResponse.body.trial.status).toBe('active');

            // Step 2: Extend trial duration
            const extendResponse = await request(app)
                .post(`/api/trials/${activeTrial._id}/extend`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ days: 7 });

            expect(extendResponse.status).toBe(200);
            expect(new Date(extendResponse.body.trial.expiresAt)).toBeGreaterThan(new Date(activeTrial.expiresAt));

            // Step 3: Update trial notes
            const updateResponse = await request(app)
                .patch(`/api/trials/${activeTrial._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    notes: 'Test trial note'
                });

            expect(updateResponse.status).toBe(200);
            expect(updateResponse.body.trial.notes).toBe('Test trial note');

            // Step 4: Cancel trial
            const cancelResponse = await request(app)
                .delete(`/api/trials/${activeTrial._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(cancelResponse.status).toBe(200);

            // Step 5: Verify trial cancelled
            const finalStatusResponse = await request(app)
                .get(`/api/trials/${activeTrial._id}/status`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(finalStatusResponse.body.trial.status).toBe('cancelled');
        });
    });
});
