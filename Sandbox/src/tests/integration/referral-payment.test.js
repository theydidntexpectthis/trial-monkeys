const request = require('supertest');
const app = require('../../server');
const ReferralService = require('../../services/referral.service');
const PaymentVerificationService = require('../../services/payment-verification.service');
const UserSubscriptionService = require('../../services/user-subscription.service');
const VirtualPaymentService = require('../../services/virtual-payment.service');

describe('Referral and Payment Integration Tests', () => {
    let referrer;
    let referee;
    let referralCode;
    let virtualCard;

    beforeAll(async () => {
        // Create test users
        referrer = await UserSubscriptionService.createUser({
            username: 'referrer_test',
            email: 'referrer@test.com',
            walletAddress: '8xyt9RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ'
        });

        referee = await UserSubscriptionService.createUser({
            username: 'referee_test',
            email: 'referee@test.com',
            walletAddress: '9zyt8RqQpmM2Dw6yCSvGBzwCge4GXXbxqGxKUeNBgvPZ'
        });

        // Generate virtual payment card
        virtualCard = await VirtualPaymentService.generateVirtualCard({
            amount: 50,
            duration: 30
        });
    });

    describe('Referral Flow', () => {
        test('should generate referral code', async () => {
            const response = await request(app)
                .post('/api/referral/generate')
                .set('Authorization', `Bearer ${generateTestToken(referrer)}`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.code).toBeDefined();

            referralCode = response.body.data.code;
        });

        test('should process referral successfully', async () => {
            const response = await request(app)
                .post('/api/referral/process')
                .set('Authorization', `Bearer ${generateTestToken(referee)}`)
                .send({ referralCode });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.bonusAwarded).toBeDefined();
        });

        test('should prevent duplicate referral usage', async () => {
            const response = await request(app)
                .post('/api/referral/process')
                .set('Authorization', `Bearer ${generateTestToken(referee)}`)
                .send({ referralCode });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/already used/i);
        });
    });

    describe('Payment Integration', () => {
        test('should verify payment for subscription', async () => {
            const response = await request(app)
                .post('/api/payment/verify')
                .set('Authorization', `Bearer ${generateTestToken(referee)}`)
                .send({
                    amount: 19.99,
                    currency: 'USD',
                    paymentMethod: virtualCard.id
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.verified).toBe(true);
        });

        test('should handle failed payment verification', async () => {
            const response = await request(app)
                .post('/api/payment/verify')
                .set('Authorization', `Bearer ${generateTestToken(referee)}`)
                .send({
                    amount: 999.99, // Amount exceeds card limit
                    currency: 'USD',
                    paymentMethod: virtualCard.id
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/payment.*failed/i);
        });
    });

    describe('Referral Rewards', () => {
        test('should track referral earnings', async () => {
            const stats = await ReferralService.getReferralStats(referrer.id);
            
            expect(stats.totalReferrals).toBe(1);
            expect(stats.totalEarnings).toBeGreaterThan(0);
        });

        test('should process reward withdrawal', async () => {
            const response = await request(app)
                .post('/api/referral/withdraw')
                .set('Authorization', `Bearer ${generateTestToken(referrer)}`)
                .send({
                    amount: 10,
                    currency: 'USD'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.transactionId).toBeDefined();
        });

        test('should prevent withdrawal below minimum', async () => {
            const response = await request(app)
                .post('/api/referral/withdraw')
                .set('Authorization', `Bearer ${generateTestToken(referrer)}`)
                .send({
                    amount: 1,
                    currency: 'USD'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/minimum.*not met/i);
        });
    });

    describe('Subscription Integration', () => {
        test('should apply referral discount to subscription', async () => {
            const response = await request(app)
                .post('/api/subscription/subscribe')
                .set('Authorization', `Bearer ${generateTestToken(referee)}`)
                .send({
                    planId: 'pro',
                    paymentMethod: virtualCard.id,
                    referralCode
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.discount).toBeDefined();
        });

        test('should verify subscription status', async () => {
            const response = await request(app)
                .get('/api/subscription/status')
                .set('Authorization', `Bearer ${generateTestToken(referee)}`);

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('active');
            expect(response.body.data.plan).toBe('pro');
        });
    });

    describe('Virtual Payment Management', () => {
        test('should track virtual card usage', async () => {
            const usage = await VirtualPaymentService.getCardUsage(virtualCard.id);
            
            expect(usage.transactionCount).toBeGreaterThan(0);
            expect(usage.totalAmount).toBeGreaterThan(0);
        });

        test('should handle card expiration', async () => {
            // Fast forward card expiration
            await VirtualPaymentService.deactivateCard(virtualCard.id);

            const response = await request(app)
                .post('/api/payment/verify')
                .set('Authorization', `Bearer ${generateTestToken(referee)}`)
                .send({
                    amount: 19.99,
                    paymentMethod: virtualCard.id
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/card.*expired/i);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid referral code', async () => {
            const response = await request(app)
                .post('/api/referral/process')
                .set('Authorization', `Bearer ${generateTestToken(referee)}`)
                .send({ referralCode: 'invalid_code' });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/invalid.*code/i);
        });

        test('should handle payment verification timeout', async () => {
            const response = await request(app)
                .post('/api/payment/verify')
                .set('Authorization', `Bearer ${generateTestToken(referee)}`)
                .send({
                    amount: 19.99,
                    paymentMethod: 'timeout_test'
                });

            expect(response.status).toBe(500);
            expect(response.body.error).toMatch(/timeout/i);
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
