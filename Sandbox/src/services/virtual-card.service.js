const config = require('../config/services.config');
const axios = require('axios');
const Redis = require('ioredis');

class VirtualCardService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.config = config.virtualCards;
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

    async generateCard(options = {}) {
        const provider = await this.selectOptimalProvider(options);
        
        try {
            const cardDetails = await this.createVirtualCard(provider, options);
            await this.setupDeclineProtection(cardDetails);
            await this.saveCardDetails(cardDetails);
            
            return this.formatCardResponse(cardDetails);
        } catch (error) {
            console.error('Virtual card generation error:', error);
            throw new Error('Failed to generate virtual card');
        }
    }

    async selectOptimalProvider(options) {
        const providerStats = await this.getProviderStats();
        
        // Select provider based on success rate and availability
        const optimalProvider = Object.entries(providerStats)
            .filter(([_, stats]) => stats.available && stats.successRate > 0.8)
            .sort(([_, a], [_, b]) => b.successRate - a.successRate)[0];

        return optimalProvider?.[0] || 'privacy'; // Default to Privacy.com
    }

    async createVirtualCard(provider, options) {
        const { amount, merchant, duration } = options;
        
        const cardConfig = {
            type: 'SINGLE_USE',
            spend_limit: amount || 1,
            spend_limit_duration: duration || '30d',
            memo: `Trial Monkeys - ${merchant || 'Service Trial'}`,
            state: 'ACTIVE'
        };

        if (provider === 'privacy') {
            return await this.createPrivacyCard(cardConfig);
        } else if (provider === 'stripe') {
            return await this.createStripeCard(cardConfig);
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
            number: response.data.pan,
            expMonth: response.data.exp_month,
            expYear: response.data.exp_year,
            cvv: response.data.cvv,
            provider: 'privacy'
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
            number: response.data.number,
            expMonth: response.data.exp_month,
            expYear: response.data.exp_year,
            cvv: response.data.cvc,
            provider: 'stripe'
        };
    }

    async setupDeclineProtection(cardDetails) {
        const rules = [
            {
                type: 'amount_threshold',
                value: 1, // $1 threshold
                action: 'decline'
            },
            {
                type: 'merchant_repeat',
                value: 1, // Single use per merchant
                action: 'decline'
            },
            {
                type: 'subscription',
                action: 'decline'
            }
        ];

        for (const rule of rules) {
            await this.addDeclineRule(cardDetails.id, rule);
        }
    }

    async addDeclineRule(cardId, rule) {
        const provider = this.getProviderByCardId(cardId);
        const endpoint = provider === 'privacy' 
            ? '/card/rules' 
            : '/issuing/cards/rules';

        await axios.post(
            `${this.providers[provider].baseUrl}${endpoint}`,
            {
                card_token: cardId,
                ...rule
            },
            { headers: this.providers[provider].headers }
        );
    }

    async saveCardDetails(cardDetails) {
        const key = `card:${cardDetails.id}`;
        await this.redis.hmset(key, {
            'provider': cardDetails.provider,
            'status': 'active',
            'created_at': Date.now(),
            'usage_count': 0
        });

        // Set TTL for card details (30 days)
        await this.redis.expire(key, 30 * 24 * 60 * 60);
    }

    formatCardResponse(cardDetails) {
        return {
            id: cardDetails.id,
            last4: cardDetails.number.slice(-4),
            expMonth: cardDetails.expMonth,
            expYear: cardDetails.expYear,
            provider: cardDetails.provider,
            secure: true
        };
    }

    async getProviderStats() {
        const stats = await this.redis.get('provider_stats');
        return stats ? JSON.parse(stats) : {
            privacy: { available: true, successRate: 0.95 },
            stripe: { available: true, successRate: 0.90 }
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
}

module.exports = new VirtualCardService();
