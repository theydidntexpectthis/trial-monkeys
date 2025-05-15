const axios = require('axios');
const Redis = require('ioredis');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const authConfig = require('../config/auth-integration.config');

class PaymentVerificationService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.rapidApiKey = authConfig.rapidApi.key;
        this.verificationEndpoint = authConfig.rapidApi.endpoints.paymentVerification;
    }

    async verifyPayment(paymentData) {
        try {
            // First verify with payment provider
            const providerVerification = await this.verifyWithProvider(paymentData);
            if (!providerVerification.success) {
                throw new Error(providerVerification.error);
            }

            // Additional verification through RapidAPI
            const rapidApiVerification = await this.verifyWithRapidApi(paymentData);
            if (!rapidApiVerification.success) {
                throw new Error(rapidApiVerification.error);
            }

            // Store verification result
            await this.storeVerificationResult(paymentData.userId, {
                success: true,
                transaction: paymentData.transactionId,
                timestamp: Date.now()
            });

            return {
                success: true,
                transactionId: paymentData.transactionId,
                verificationId: rapidApiVerification.verificationId
            };
        } catch (error) {
            console.error('Payment verification error:', error);
            throw error;
        }
    }

    async verifyWithProvider(paymentData) {
        try {
            switch (paymentData.provider) {
                case 'stripe':
                    return await this.verifyStripePayment(paymentData);
                case 'paypal':
                    return await this.verifyPayPalPayment(paymentData);
                default:
                    throw new Error('Unsupported payment provider');
            }
        } catch (error) {
            console.error('Provider verification error:', error);
            return { success: false, error: error.message };
        }
    }

    async verifyStripePayment(paymentData) {
        try {
            const payment = await stripe.paymentIntents.retrieve(
                paymentData.transactionId
            );

            if (payment.status !== 'succeeded') {
                return {
                    success: false,
                    error: 'Payment has not been completed'
                };
            }

            // Verify amount matches
            if (payment.amount !== paymentData.amount * 100) { // Stripe uses cents
                return {
                    success: false,
                    error: 'Payment amount mismatch'
                };
            }

            return {
                success: true,
                paymentId: payment.id
            };
        } catch (error) {
            console.error('Stripe verification error:', error);
            return { success: false, error: error.message };
        }
    }

    async verifyPayPalPayment(paymentData) {
        // Implementation for PayPal verification
        return { success: true, paymentId: paymentData.transactionId };
    }

    async verifyWithRapidApi(paymentData) {
        try {
            const response = await axios.post(
                this.verificationEndpoint.url,
                {
                    transactionId: paymentData.transactionId,
                    amount: paymentData.amount,
                    currency: paymentData.currency,
                    provider: paymentData.provider
                },
                {
                    headers: this.verificationEndpoint.headers
                }
            );

            return {
                success: response.data.verified,
                verificationId: response.data.verificationId,
                error: response.data.error
            };
        } catch (error) {
            console.error('RapidAPI verification error:', error);
            return { success: false, error: error.message };
        }
    }

    async verifySubscriptionStatus(userId) {
        try {
            const subscription = await this.getSubscription(userId);
            if (!subscription) {
                return { active: false, error: 'No subscription found' };
            }

            // Check if subscription is active and payment is valid
            const isValid = await this.validateSubscriptionPayment(subscription);
            if (!isValid) {
                await this.deactivateSubscription(userId);
                return { active: false, error: 'Invalid subscription payment' };
            }

            return {
                active: true,
                subscription: this.formatSubscriptionResponse(subscription)
            };
        } catch (error) {
            console.error('Subscription verification error:', error);
            throw error;
        }
    }

    async validateSubscriptionPayment(subscription) {
        // Verify with subscription provider
        const response = await axios.post(
            authConfig.rapidApi.endpoints.subscriptionVerification.url,
            {
                subscriptionId: subscription.id,
                userId: subscription.userId
            },
            {
                headers: authConfig.rapidApi.endpoints.subscriptionVerification.headers
            }
        );

        return response.data.valid;
    }

    async storeVerificationResult(userId, result) {
        const key = `payment:verification:${userId}`;
        await this.redis.lpush(key, JSON.stringify(result));
        await this.redis.ltrim(key, 0, 99); // Keep last 100 verifications
    }

    async getVerificationHistory(userId) {
        const key = `payment:verification:${userId}`;
        const history = await this.redis.lrange(key, 0, -1);
        return history.map(h => JSON.parse(h));
    }

    async trackPaymentAttempt(userId, success, details) {
        const attempt = {
            timestamp: Date.now(),
            success,
            details
        };

        await this.redis.lpush(
            `payment:attempts:${userId}`,
            JSON.stringify(attempt)
        );
    }

    async getPaymentAttempts(userId) {
        const attempts = await this.redis.lrange(
            `payment:attempts:${userId}`,
            0,
            -1
        );
        return attempts.map(a => JSON.parse(a));
    }

    formatSubscriptionResponse(subscription) {
        return {
            id: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            plan: subscription.plan
        };
    }

    // Subscription Management Methods
    async createSubscription(userId, planId) {
        try {
            const customer = await this.getOrCreateCustomer(userId);
            
            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{ price: planId }],
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent']
            });

            await this.storeSubscription(userId, subscription);

            return {
                subscriptionId: subscription.id,
                clientSecret: subscription.latest_invoice.payment_intent.client_secret
            };
        } catch (error) {
            console.error('Subscription creation error:', error);
            throw error;
        }
    }

    async cancelSubscription(userId) {
        try {
            const subscription = await this.getSubscription(userId);
            if (!subscription) {
                throw new Error('No active subscription found');
            }

            const canceledSubscription = await stripe.subscriptions.del(
                subscription.id
            );

            await this.updateSubscription(userId, canceledSubscription);

            return {
                success: true,
                message: 'Subscription cancelled successfully'
            };
        } catch (error) {
            console.error('Subscription cancellation error:', error);
            throw error;
        }
    }

    // Helper Methods
    async getOrCreateCustomer(userId) {
        const customer = await this.getCustomer(userId);
        if (customer) return customer;

        const user = await this.getUserDetails(userId);
        return await stripe.customers.create({
            email: user.email,
            metadata: {
                userId: userId
            }
        });
    }

    // These methods would be implemented based on your database choice
    async getSubscription(userId) {}
    async storeSubscription(userId, subscription) {}
    async updateSubscription(userId, subscription) {}
    async deactivateSubscription(userId) {}
    async getCustomer(userId) {}
    async getUserDetails(userId) {}
}

module.exports = new PaymentVerificationService();
