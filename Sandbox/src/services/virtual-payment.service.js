const axios = require('axios');
const Redis = require('ioredis');
const apiConfig = require('../config/api-integrations.config');

class VirtualPaymentService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.providers = {
            privacy: {
                baseUrl: 'https://api.privacy.com/v1',
                headers: {
                    'Authorization': `Bearer ${process.env.PRIVACY_API_KEY}`
                }
            },
            stripe: {
                baseUrl: 'https://api.stripe.com/v1',
                headers: {
                    'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
                }
            }
        };
    }

    async generateVirtualCard(options) {
        const { service, amount, duration } = options;

        try {
            // Select optimal provider based on service requirements
            const provider = await this.selectCardProvider(service);
            
            // Generate card with spend limits and auto-decline rules
            const card = await this.createVirtualCard(provider, {
                amount: amount || 1.00,
                merchant: service.name,
                duration: duration || 30
            });

            // Set up decline protection
            await this.setupDeclineProtection(card);

            // Store card details
            await this.storeCardDetails(card);

            return this.formatCardResponse(card);
        } catch (error) {
            console.error('Virtual card generation error:', error);
            throw error;
        }
    }

    async createVirtualCard(provider, options) {
        const cardConfig = {
            type: 'SINGLE_USE',
            spend_limit: options.amount,
            spend_limit_duration: `${options.duration}d`,
            memo: `Trial Monkeys - ${options.merchant}`,
            state: 'ACTIVE'
        };

        if (provider === 'privacy') {
            return this.createPrivacyCard(cardConfig);
        } else {
            return this.createStripeCard(cardConfig);
        }
    }

    async createPrivacyCard(config) {
        const response = await axios.post(
            `${this.providers.privacy.baseUrl}/card`,
            config,
            { headers: this.providers.privacy.headers }
        );

        return {
            id: response.data.token,
            provider: 'privacy',
            number: response.data.pan,
            expMonth: response.data.exp_month,
            expYear: response.data.exp_year,
            cvv: response.data.cvv,
            created: new Date()
        };
    }

    async createStripeCard(config) {
        const response = await axios.post(
            `${this.providers.stripe.baseUrl}/issuing/cards`,
            {
                type: 'virtual',
                currency: 'usd',
                spending_controls: {
                    spending_limits: [{
                        amount: config.spend_limit * 100,
                        interval: 'per_authorization'
                    }]
                },
                metadata: {
                    purpose: config.memo
                }
            },
            { headers: this.providers.stripe.headers }
        );

        return {
            id: response.data.id,
            provider: 'stripe',
            number: response.data.number,
            expMonth: response.data.exp_month,
            expYear: response.data.exp_year,
            cvv: response.data.cvc,
            created: new Date()
        };
    }

    async setupDeclineProtection(card) {
        const rules = [
            {
                type: 'amount_threshold',
                value: 1,
                action: 'decline'
            },
            {
                type: 'merchant_repeat',
                value: 1,
                action: 'decline'
            },
            {
                type: 'subscription',
                action: 'decline'
            }
        ];

        for (const rule of rules) {
            await this.addDeclineRule(card.id, rule);
        }
    }

    async addDeclineRule(cardId, rule) {
        const provider = this.getProviderByCardId(cardId);
        const endpoint = provider === 'privacy' ? '/card/rules' : '/issuing/cards/rules';

        await axios.post(
            `${this.providers[provider].baseUrl}${endpoint}`,
            {
                card_token: cardId,
                ...rule
            },
            { headers: this.providers[provider].headers }
        );
    }

    async storeCardDetails(card) {
        const key = `card:${card.id}`;
        await this.redis.hmset(key, {
            'provider': card.provider,
            'status': 'active',
            'created_at': Date.now(),
            'usage_count': 0
        });

        // Set TTL for card details (30 days)
        await this.redis.expire(key, 30 * 24 * 60 * 60);
    }

    async selectCardProvider(service) {
        // Get provider statistics
        const stats = await this.getProviderStats();
        
        // Select provider based on success rate and service compatibility
        const providers = Object.entries(stats)
            .filter(([_, stats]) => stats.available && stats.successRate > 0.8)
            .sort(([_, a], [_, b]) => b.successRate - a.successRate);

        return providers[0]?.[0] || 'privacy';
    }

    async getProviderStats() {
        const stats = await this.redis.get('provider_stats');
        return stats ? JSON.parse(stats) : {
            privacy: { available: true, successRate: 0.95 },
            stripe: { available: true, successRate: 0.90 }
        };
    }

    formatCardResponse(card) {
        return {
            id: card.id,
            last4: card.number.slice(-4),
            expMonth: card.expMonth,
            expYear: card.expYear,
            provider: card.provider,
            created: card.created
        };
    }

    getProviderByCardId(cardId) {
        return cardId.startsWith('vcard_') ? 'privacy' : 'stripe';
    }

    async monitorTransactions(cardId) {
        const provider = this.getProviderByCardId(cardId);
        const endpoint = provider === 'privacy' 
            ? `/card/${cardId}/transactions`
            : `/issuing/cards/${cardId}/transactions`;

        const response = await axios.get(
            `${this.providers[provider].baseUrl}${endpoint}`,
            { headers: this.providers[provider].headers }
        );

        return response.data.data;
    }

    async deactivateCard(cardId) {
        const provider = this.getProviderByCardId(cardId);
        const endpoint = provider === 'privacy' 
            ? `/card/${cardId}`
            : `/issuing/cards/${cardId}`;

        await axios.post(
            `${this.providers[provider].baseUrl}${endpoint}`,
            { state: 'CLOSED' },
            { headers: this.providers[provider].headers }
        );

        await this.redis.hset(`card:${cardId}`, 'status', 'deactivated');
    }

    async getCardUsage(cardId) {
        const transactions = await this.monitorTransactions(cardId);
        const usage = {
            totalAmount: 0,
            transactionCount: transactions.length,
            lastTransaction: null
        };

        if (transactions.length > 0) {
            usage.totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
            usage.lastTransaction = transactions[0];
        }

        return usage;
    }

    async checkCardStatus(cardId) {
        const status = await this.redis.hget(`card:${cardId}`, 'status');
        const usage = await this.getCardUsage(cardId);

        return {
            id: cardId,
            status,
            usage,
            lastChecked: new Date()
        };
    }
}

module.exports = new VirtualPaymentService();
