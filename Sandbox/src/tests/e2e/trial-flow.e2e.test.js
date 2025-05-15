const request = require('supertest');
const app = require('../../server');
const DiscordBotService = require('../../services/discord-bot.service');
const TelegramBotService = require('../../services/telegram-bot.service');
const UserSubscriptionService = require('../../services/user-subscription.service');
const AutomationProfilesService = require('../../services/automation-profiles.service');
const serviceEndpoints = require('../../config/service-endpoints.config');

describe('Trial Generation E2E Tests', () => {
    let testUser;
    let authToken;
    let subscription;

    beforeAll(async () => {
        // Create test user with subscription
        testUser = await UserSubscriptionService.createUser({
            username: 'e2e_test_user',
            email: 'e2e@trialmonkeys.com',
            walletAddress: '8xyt9RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ'
        });

        // Upgrade to premium subscription
        subscription = await UserSubscriptionService.upgradeSubscription(
            testUser.id,
            'power',
            { paymentId: 'test_payment' }
        );

        // Generate auth token
        authToken = generateTestToken(testUser);

        // Initialize services
        await Promise.all([
            AutomationProfilesService.init(),
            DiscordBotService.init(),
            TelegramBotService.init()
        ]);
    });

    describe('Complete Trial Generation Flow', () => {
        const testCases = [
            {
                name: 'Netflix Premium Trial',
                service: serviceEndpoints.streaming.netflix,
                expectedDuration: 30
            },
            {
                name: 'Spotify Premium Trial',
                service: serviceEndpoints.streaming.spotify,
                expectedDuration: 14
            }
        ];

        test.each(testCases)(
            '$name generation flow',
            async ({ service, expectedDuration }) => {
                // Step 1: Generate trial
                const trialResponse = await request(app)
                    .post('/api/trials/generate')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        service: service.name,
                        options: {
                            duration: expectedDuration
                        }
                    });

                expect(trialResponse.status).toBe(200);
                expect(trialResponse.body.trial).toBeDefined();
                const trial = trialResponse.body.trial;

                // Step 2: Verify trial details
                expect(trial.serviceName).toBe(service.name);
                expect(trial.status).toBe('active');
                expect(trial.duration).toBe(expectedDuration);
                expect(trial.credentials).toBeDefined();
                expect(trial.credentials.email).toBeDefined();
                expect(trial.credentials.password).toBeDefined();

                // Step 3: Check subscription update
                const updatedSubscription = await UserSubscriptionService.getSubscriptionDetails(testUser.id);
                expect(updatedSubscription.trialsUsed).toBe(subscription.trialsUsed + 1);

                // Step 4: Verify notifications
                const notifications = await getRecentNotifications(testUser.id);
                expect(notifications).toContainEqual(
                    expect.objectContaining({
                        type: 'trial_created',
                        data: expect.objectContaining({
                            serviceName: service.name
                        })
                    })
                );
            }
        );

        test('should handle concurrent trial requests', async () => {
            const service = serviceEndpoints.streaming.netflix;
            const requests = Array(3).fill().map(() =>
                request(app)
                    .post('/api/trials/generate')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        service: service.name
                    })
            );

            const responses = await Promise.all(requests);
            const successCount = responses.filter(r => r.status === 200).length;
            expect(successCount).toBe(1); // Only one should succeed
        });
    });

    describe('Bot Integration Tests', () => {
        test('should handle Discord trial generation command', async () => {
            const command = {
                platform: 'discord',
                command: 'trial',
                args: ['netflix'],
                user: {
                    id: testUser.id,
                    discordId: '123456789'
                }
            };

            const response = await request(app)
                .post('/api/bot/command')
                .send(command);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.trial).toBeDefined();
        });

        test('should handle Telegram trial generation command', async () => {
            const command = {
                platform: 'telegram',
                command: 'trial',
                args: ['spotify'],
                user: {
                    id: testUser.id,
                    telegramId: '987654321'
                }
            };

            const response = await request(app)
                .post('/api/bot/command')
                .send(command);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.trial).toBeDefined();
        });
    });

    describe('Trial Management Tests', () => {
        let activeTrial;

        beforeEach(async () => {
            // Create a test trial
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service: serviceEndpoints.streaming.netflix.name
                });

            activeTrial = response.body.trial;
        });

        test('should extend trial duration', async () => {
            const response = await request(app)
                .post(`/api/trials/${activeTrial.id}/extend`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    days: 7
                });

            expect(response.status).toBe(200);
            expect(response.body.trial.expiryDate).toBeGreaterThan(activeTrial.expiryDate);
        });

        test('should cancel trial', async () => {
            const response = await request(app)
                .delete(`/api/trials/${activeTrial.id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.trial.status).toBe('cancelled');
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid service', async () => {
            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service: 'invalid-service'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });

        test('should handle trial limit exceeded', async () => {
            // Max out trial limit
            await UserSubscriptionService.updateUserSubscription(testUser.id, {
                ...subscription,
                trialsUsed: subscription.maxTrials
            });

            const response = await request(app)
                .post('/api/trials/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service: serviceEndpoints.streaming.netflix.name
                });

            expect(response.status).toBe(403);
            expect(response.body.error).toMatch(/limit reached/i);
        });
    });
});

// Helper Functions
function generateTestToken(user) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
    );
}

async function getRecentNotifications(userId) {
    return await NotificationsService.getNotificationHistory(userId);
}
