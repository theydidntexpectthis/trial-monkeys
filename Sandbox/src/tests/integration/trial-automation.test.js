const request = require('supertest');
const app = require('../../server');
const AutomationProfilesService = require('../../services/automation-profiles.service');
const ProxyManagerService = require('../../services/proxy-manager.service');
const EmailVerificationService = require('../../services/email-verification.service');
const VirtualPaymentService = require('../../services/virtual-payment.service');
const serviceConfig = require('../../config/service-endpoints.config');

describe('Trial Automation Integration Tests', () => {
    let automationProfile;
    let proxy;
    let email;
    let virtualCard;

    beforeAll(async () => {
        // Initialize services
        await Promise.all([
            AutomationProfilesService.init(),
            ProxyManagerService.init(),
            EmailVerificationService.init()
        ]);
    });

    afterAll(async () => {
        // Cleanup resources
        await Promise.all([
            AutomationProfilesService.cleanup(),
            ProxyManagerService.cleanup()
        ]);
    });

    describe('Service Setup', () => {
        test('should create automation profile', async () => {
            const service = serviceConfig.streaming.netflix;
            automationProfile = await AutomationProfilesService.createProfile(service);

            expect(automationProfile).toBeDefined();
            expect(automationProfile.userAgent).toBeDefined();
            expect(automationProfile.fingerprint).toBeDefined();
        });

        test('should obtain working proxy', async () => {
            const service = serviceConfig.streaming.netflix;
            proxy = await ProxyManagerService.getProxy(service);

            expect(proxy).toBeDefined();
            expect(proxy.host).toBeDefined();
            expect(proxy.port).toBeDefined();
            expect(await ProxyManagerService.testProxy(proxy)).toBe(true);
        });

        test('should generate valid trial email', async () => {
            const service = serviceConfig.streaming.netflix;
            email = await EmailVerificationService.generateTrialEmail(service);

            expect(email).toBeDefined();
            expect(await EmailVerificationService.validateEmailFormat(email)).toBe(true);
            expect(await EmailVerificationService.isDisposableEmail(email)).toBe(false);
        });

        test('should generate virtual payment card', async () => {
            const service = serviceConfig.streaming.netflix;
            virtualCard = await VirtualPaymentService.generateVirtualCard({
                service,
                amount: 1.00,
                duration: 30
            });

            expect(virtualCard).toBeDefined();
            expect(virtualCard.id).toBeDefined();
            expect(virtualCard.last4).toBeDefined();
        });
    });

    describe('Trial Generation Flow', () => {
        const testCases = [
            {
                category: 'streaming',
                service: 'netflix',
                expectedDuration: 30
            },
            {
                category: 'productivity',
                service: 'adobe',
                expectedDuration: 7
            }
        ];

        test.each(testCases)(
            'should generate trial for $service',
            async ({ category, service, expectedDuration }) => {
                const response = await request(app)
                    .post('/api/trials/generate')
                    .send({
                        service: serviceConfig[category][service].name,
                        profile: automationProfile.id,
                        proxy: proxy.id,
                        email,
                        paymentMethod: virtualCard.id
                    });

                expect(response.status).toBe(200);
                expect(response.body.trial).toBeDefined();
                expect(response.body.trial.duration).toBe(expectedDuration);
                expect(response.body.trial.status).toBe('active');
            }
        );

        test('should handle concurrent trial requests', async () => {
            const service = serviceConfig.streaming.netflix;
            const requests = Array(3).fill().map(() => 
                request(app)
                    .post('/api/trials/generate')
                    .send({
                        service: service.name,
                        profile: automationProfile.id,
                        proxy: proxy.id,
                        email,
                        paymentMethod: virtualCard.id
                    })
            );

            const responses = await Promise.all(requests);
            const successCount = responses.filter(r => r.status === 200).length;
            expect(successCount).toBe(1); // Only one should succeed
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid service', async () => {
            const response = await request(app)
                .post('/api/trials/generate')
                .send({
                    service: 'invalid-service',
                    profile: automationProfile.id,
                    proxy: proxy.id,
                    email,
                    paymentMethod: virtualCard.id
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });

        test('should handle proxy failure', async () => {
            const invalidProxy = { ...proxy, host: 'invalid-host' };
            const response = await request(app)
                .post('/api/trials/generate')
                .send({
                    service: serviceConfig.streaming.netflix.name,
                    profile: automationProfile.id,
                    proxy: invalidProxy,
                    email,
                    paymentMethod: virtualCard.id
                });

            expect(response.status).toBe(500);
            expect(response.body.error).toMatch(/proxy/i);
        });

        test('should handle payment failure', async () => {
            const invalidCard = { ...virtualCard, id: 'invalid-card' };
            const response = await request(app)
                .post('/api/trials/generate')
                .send({
                    service: serviceConfig.streaming.netflix.name,
                    profile: automationProfile.id,
                    proxy: proxy.id,
                    email,
                    paymentMethod: invalidCard
                });

            expect(response.status).toBe(500);
            expect(response.body.error).toMatch(/payment/i);
        });
    });

    describe('Performance Monitoring', () => {
        test('should track trial generation success rate', async () => {
            const service = serviceConfig.streaming.netflix;
            const result = {
                success: true,
                duration: 5000,
                errors: []
            };

            await AutomationProfilesService.updateProfile(automationProfile, result.success);
            await ProxyManagerService.updateProxyStatus(proxy.id, result.success);

            const updatedProfile = await AutomationProfilesService.getProfileMetrics(automationProfile);
            expect(updatedProfile.successRate).toBeGreaterThan(0);
        });

        test('should monitor resource usage', async () => {
            const proxyUsage = await ProxyManagerService.getProxyDetails(proxy.id);
            expect(proxyUsage.lastUsed).toBeDefined();

            const cardStatus = await VirtualPaymentService.checkCardStatus(virtualCard.id);
            expect(cardStatus.status).toBe('active');
        });
    });

    describe('Cleanup Process', () => {
        test('should cleanup resources after trial completion', async () => {
            await ProxyManagerService.removeProxy(proxy.id);
            await VirtualPaymentService.deactivateCard(virtualCard.id);

            const proxyExists = await ProxyManagerService.getProxyDetails(proxy.id);
            expect(proxyExists).toBeNull();

            const cardStatus = await VirtualPaymentService.checkCardStatus(virtualCard.id);
            expect(cardStatus.status).toBe('deactivated');
        });
    });
});
