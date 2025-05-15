const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const Redis = require('ioredis');
const apiConfig = require('../config/api-integrations.config');

class PaymentSubscriptionService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.connection = new Connection(apiConfig.auth.phantom.cluster);
        this.monkTokenAddress = new PublicKey(apiConfig.payments.solana.tokenAddress);
        
        // Subscription Tiers
        this.tiers = {
            basic: {
                name: 'Basic',
                price: 5,
                maxTrials: 1,
                duration: 14,
                features: ['Single Trial', 'Basic Support']
            },
            power: {
                name: 'Power User',
                price: 20,
                maxTrials: 5,
                duration: 30,
                features: ['Multiple Trials', 'Priority Support', 'Custom Email']
            },
            enterprise: {
                name: 'Enterprise',
                price: 50,
                maxTrials: 10,
                duration: 60,
                features: ['Unlimited Trials', '24/7 Support', 'API Access']
            }
        };
    }

    async processPayment(userId, tier, walletAddress) {
        try {
            const subscription = this.tiers[tier];
            if (!subscription) throw new Error('Invalid subscription tier');

            // Verify wallet connection
            const isValid = await this.verifyWalletConnection(walletAddress);
            if (!isValid) throw new Error('Invalid wallet connection');

            // Process MONK token payment
            const payment = await this.processMonkPayment(
                walletAddress,
                subscription.price
            );

            if (payment.success) {
                // Create subscription
                const subscriptionData = await this.createSubscription(
                    userId,
                    tier,
                    payment.transaction
                );

                // Store payment record
                await this.storePaymentRecord(userId, payment, subscriptionData);

                return {
                    success: true,
                    subscription: subscriptionData,
                    payment: payment.transaction
                };
            }

            throw new Error('Payment processing failed');
        } catch (error) {
            console.error('Payment processing error:', error);
            throw error;
        }
    }

    async processMonkPayment(walletAddress, amount) {
        try {
            // Create transaction for MONK token transfer
            const transaction = new Transaction();
            
            // Add token transfer instruction
            // Note: Actual token transfer logic would go here
            
            return {
                success: true,
                transaction: {
                    id: `tx_${Date.now()}`,
                    amount,
                    timestamp: new Date()
                }
            };
        } catch (error) {
            console.error('MONK payment error:', error);
            throw error;
        }
    }

    async createSubscription(userId, tier, payment) {
        const subscription = {
            userId,
            tier,
            status: 'active',
            features: this.tiers[tier].features,
            maxTrials: this.tiers[tier].maxTrials,
            trialsUsed: 0,
            startDate: new Date(),
            endDate: this.calculateEndDate(this.tiers[tier].duration),
            paymentId: payment.id
        };

        await this.redis.hset(
            `subscription:${userId}`,
            'data',
            JSON.stringify(subscription)
        );

        return subscription;
    }

    async getSubscription(userId) {
        const data = await this.redis.hget(`subscription:${userId}`, 'data');
        return data ? JSON.parse(data) : null;
    }

    async updateSubscription(userId, updates) {
        const subscription = await this.getSubscription(userId);
        if (!subscription) throw new Error('Subscription not found');

        const updated = {
            ...subscription,
            ...updates,
            lastUpdated: new Date()
        };

        await this.redis.hset(
            `subscription:${userId}`,
            'data',
            JSON.stringify(updated)
        );

        return updated;
    }

    async verifyTrialEligibility(userId, serviceType) {
        const subscription = await this.getSubscription(userId);
        if (!subscription) throw new Error('No active subscription');

        if (subscription.trialsUsed >= subscription.maxTrials) {
            throw new Error('Trial limit reached for current subscription');
        }

        // Check service-specific limitations
        await this.checkServiceLimitations(userId, serviceType);

        return true;
    }

    async incrementTrialCount(userId) {
        const subscription = await this.getSubscription(userId);
        if (!subscription) throw new Error('No active subscription');

        return await this.updateSubscription(userId, {
            trialsUsed: subscription.trialsUsed + 1
        });
    }

    async checkServiceLimitations(userId, serviceType) {
        const key = `trials:${userId}:${serviceType}`;
        const serviceTrials = await this.redis.get(key);

        if (serviceTrials && parseInt(serviceTrials) > 0) {
            throw new Error('Service trial already used');
        }

        return true;
    }

    async recordServiceTrial(userId, serviceType) {
        const key = `trials:${userId}:${serviceType}`;
        await this.redis.setex(key, 30 * 24 * 60 * 60, '1'); // 30 days
    }

    async getTrialStats(userId) {
        const subscription = await this.getSubscription(userId);
        if (!subscription) return null;

        return {
            tier: subscription.tier,
            used: subscription.trialsUsed,
            remaining: subscription.maxTrials - subscription.trialsUsed,
            active: await this.getActiveTrials(userId),
            history: await this.getTrialHistory(userId)
        };
    }

    async storePaymentRecord(userId, payment, subscription) {
        const record = {
            userId,
            paymentId: payment.transaction.id,
            amount: payment.transaction.amount,
            tier: subscription.tier,
            timestamp: new Date(),
            status: 'completed'
        };

        await this.redis.lpush(
            `payments:${userId}`,
            JSON.stringify(record)
        );
    }

    async getPaymentHistory(userId) {
        const payments = await this.redis.lrange(`payments:${userId}`, 0, -1);
        return payments.map(p => JSON.parse(p));
    }

    async verifyWalletConnection(walletAddress) {
        try {
            const publicKey = new PublicKey(walletAddress);
            const balance = await this.connection.getBalance(publicKey);
            return balance > 0;
        } catch {
            return false;
        }
    }

    calculateEndDate(duration) {
        const date = new Date();
        date.setDate(date.getDate() + duration);
        return date;
    }

    async getActiveTrials(userId) {
        // Implementation to get active trials
        return [];
    }

    async getTrialHistory(userId) {
        // Implementation to get trial history
        return [];
    }
}

module.exports = new PaymentSubscriptionService();
