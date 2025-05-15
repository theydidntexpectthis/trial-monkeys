const request = require('supertest');
const app = require('../server');
const User = require('../models/user.model');
const { generateJWT } = require('../utils/api.utils');

describe('Authentication Tests', () => {
    beforeAll(async () => {
        // Clear test users
        await User.deleteMany({});
    });

    describe('Wallet Authentication', () => {
        const mockWallet = {
            publicKey: '8xyt9RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ'
        };

        test('Should authenticate with valid Phantom wallet', async () => {
            const response = await request(app)
                .post('/api/auth/wallet')
                .send(mockWallet);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.walletAddress).toBe(mockWallet.publicKey);
        });

        test('Should reject invalid wallet format', async () => {
            const response = await request(app)
                .post('/api/auth/wallet')
                .send({ publicKey: 'invalid-key' });

            expect(response.status).toBe(400);
        });
    });

    describe('Discord Authentication', () => {
        const mockDiscordCode = 'mock_discord_auth_code';
        const mockDiscordUser = {
            id: '123456789',
            username: 'TestUser',
            email: 'test@discord.com'
        };

        test('Should authenticate with Discord OAuth', async () => {
            // Mock Discord OAuth flow
            const response = await request(app)
                .post('/api/auth/discord')
                .send({ code: mockDiscordCode });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user.discordId).toBe(mockDiscordUser.id);
        });

        test('Should handle Discord auth failures', async () => {
            const response = await request(app)
                .post('/api/auth/discord')
                .send({ code: 'invalid-code' });

            expect(response.status).toBe(401);
        });
    });

    describe('Session Management', () => {
        let authToken;

        beforeAll(async () => {
            // Create test user and token
            const user = await User.create({
                username: 'testuser',
                walletAddress: '8xyt9RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ'
            });
            authToken = generateJWT(user);
        });

        test('Should validate valid session token', async () => {
            const response = await request(app)
                .get('/api/auth/validate')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('valid', true);
        });

        test('Should reject expired token', async () => {
            const expiredToken = generateJWT({ id: 'test' }, '0s');
            const response = await request(app)
                .get('/api/auth/validate')
                .set('Authorization', `Bearer ${expiredToken}`);

            expect(response.status).toBe(401);
        });

        test('Should handle logout', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            
            // Verify token is now invalid
            const validateResponse = await request(app)
                .get('/api/auth/validate')
                .set('Authorization', `Bearer ${authToken}`);

            expect(validateResponse.status).toBe(401);
        });
    });

    describe('Rate Limiting', () => {
        test('Should enforce rate limits', async () => {
            // Make multiple rapid requests
            const requests = Array(10).fill().map(() => 
                request(app)
                    .post('/api/auth/wallet')
                    .send({ publicKey: '8xyt9RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ' })
            );

            const responses = await Promise.all(requests);
            const tooManyRequests = responses.some(r => r.status === 429);
            expect(tooManyRequests).toBe(true);
        });
    });
});
