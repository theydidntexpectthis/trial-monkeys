const request = require('supertest');
const app = require('../../server');
const UserSubscriptionService = require('../../services/user-subscription.service');
const AutomationProfilesService = require('../../services/automation-profiles.service');
const VirtualPaymentService = require('../../services/virtual-payment.service');
const serviceRules = require('../../config/service-rules.config');

describe('Critical Entertainment Trial Generation Tests', () => {
    let testUser;
    let authToken;
    let virtualCard;
    let automationProfile;

    beforeAll(async () => {
        // Create premium test user
        testUser = await UserSubscriptionService.createUser({
            username: 'critical_test_user',
            email: 'critical@trialmonkeys.com',
            walletAddress: '8xyt9RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ'
        });

        // Upgrade to enterprise subscription
        await UserSubscriptionService.upgradeSubscription(
            testUser.id,
            'enterprise',
            { paymentId: 'test_payment' }
        );

        // Generate auth token
        authToken = generateTestToken(testUser);

        // Initialize services
        await AutomationProfilesService.init();
    });

    beforeEach(async () => {
        // Create fresh virtual card for each test
        virtualCard = await VirtualPaymentService.generateVirtualCard({
            amount: 1.00,
            duration: 30
        });

        // Create fresh automation profile
        automationProfile = await AutomationProfilesService.createProfile({
            name: 'critical_test'
        });
    });

    describe('Netflix Trial Generation', () => {
        const service = serviceRules.streaming.netflix;

        test('should successfully generate Netflix trial with proper credentials', async () => {
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service: service.name,
                    options: {
                        profile: automationProfile.id,
                        paymentMethod: virtualCard.id
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.trial).toBeDefined();
            expect(response.body.trial.status).toBe('active');
            expect(response.body.trial.serviceName).toBe(service.name);

            // Verify trial details
            const trial = response.body.trial;
            expect(trial.credentials).toBeDefined();
            expect(trial.credentials.email).toMatch(/@trialmonkeys.com$/);
            expect(trial.expiryDate).toBeDefined();

            // Verify automation success
            const automationResult = await AutomationProfilesService.getProfileMetrics(automationProfile);
            expect(automationResult.successRate).toBeGreaterThan(90);
        });

        test('should handle Netflix registration flow with required verifications', async () => {
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service: service.name,
                    options: {
                        profile: automationProfile.id,
                        paymentMethod: virtualCard.id,
                        verifications: {
                            email: true,
                            captcha: true
                        }
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.trial.verifications).toEqual({
                email: true,
                captcha: true
            });
        });

        test('should properly handle payment pre-authorization', async () => {
            const preAuthAmount = service.rules.payment.preAuth;
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service: service.name,
                    options: {
                        profile: automationProfile.id,
                        paymentMethod: virtualCard.id
                    }
                });

            expect(response.status).toBe(200);
            
            // Verify payment handling
            const cardUsage = await VirtualPaymentService.getCardUsage(virtualCard.id);
            expect(cardUsage.totalAmount).toBe(preAuthAmount);
        });
    });

    describe('Disney+ Trial Generation', () => {
        const service = serviceRules.streaming.disney;

        test('should successfully generate Disney+ trial', async () => {
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service: service.name,
                    options: {
                        profile: automationProfile.id,
                        paymentMethod: virtualCard.id
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.trial.status).toBe('active');
            expect(response.body.trial.serviceName).toBe(service.name);
        });

        test('should handle geo-restriction requirements', async () => {
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service: service.name,
                    options: {
                        profile: automationProfile.id,
                        paymentMethod: virtualCard.id,
                        location: 'US'
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.trial.location).toBe('US');
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle payment failure and retry with new card', async () => {
            // Simulate failed card
            const failedCard = await VirtualPaymentService.generateVirtualCard({
                amount: 0,
                duration: 30
            });

            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service: serviceRules.streaming.netflix.name,
                    options: {
                        profile: automationProfile.id,
                        paymentMethod: failedCard.id
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.trial.paymentRetries).toBe(1);
            expect(response.body.trial.status).toBe('active');
        });

        test('should handle automation detection and recover', async () => {
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service: serviceRules.streaming.netflix.name,
                    options: {
                        profile: automationProfile.id,
                        paymentMethod: virtualCard.id,
                        simulateDetection: true
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.trial.recoveryAttempts).toBeGreaterThan(0);
            expect(response.body.trial.status).toBe('active');
        });
    });

    describe('Concurrent Trial Generation', () => {
        test('should handle multiple simultaneous trial generations', async () => {
            const services = ['netflix', 'disney'];
            const requests = services.map(service => 
                request(app)
                    .post('/api/trials/generate')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        service: serviceRules.streaming[service].name,
                        options: {
                            profile: automationProfile.id,
                            paymentMethod: virtualCard.id
                        }
                    })
            );

            const responses = await Promise.all(requests);
            const successCount = responses.filter(r => r.status === 200).length;
            expect(successCount).toBe(services.length);
        });
    });
});

// Helper function
function generateTestToken(user) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
    );
}
