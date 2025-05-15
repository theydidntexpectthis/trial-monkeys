const crypto = require('crypto');
const Redis = require('ioredis');
const authConfig = require('../config/auth-integration.config');
const PaymentVerificationService = require('./payment-verification.service');

class ReferralService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.config = authConfig.referral;
        this.paymentService = PaymentVerificationService;
    }

    async createReferralCode(userId) {
        try {
            const user = await this.getUserDetails(userId);
            const code = this.generateUniqueCode(user.username);

            await this.storeReferralCode(userId, code);

            return {
                code,
                url: `${process.env.FRONTEND_URL}/ref/${code}`
            };
        } catch (error) {
            console.error('Referral code creation error:', error);
            throw error;
        }
    }

    async processReferral(referralCode, newUserId) {
        try {
            // Validate referral code
            const referrer = await this.validateReferralCode(referralCode);
            if (!referrer) {
                throw new Error(authConfig.errors.referral.invalidCode);
            }

            // Check if already referred
            const alreadyReferred = await this.checkAlreadyReferred(newUserId);
            if (alreadyReferred) {
                throw new Error(authConfig.errors.referral.alreadyUsed);
            }

            // Store referral relationship
            await this.storeReferralRelationship(referrer.id, newUserId);

            // Award signup bonus to new user
            await this.awardSignupBonus(newUserId);

            return {
                success: true,
                referrer: referrer.id,
                bonusAwarded: this.config.rewards.signupBonus
            };
        } catch (error) {
            console.error('Referral processing error:', error);
            throw error;
        }
    }

    async completeReferralReward(userId, referrerId) {
        try {
            // Verify minimum purchase requirement
            const qualified = await this.verifyQualification(userId);
            if (!qualified) {
                return { success: false, reason: 'Minimum purchase requirement not met' };
            }

            // Award referral bonus
            await this.awardReferralBonus(referrerId);

            // Track completion
            await this.trackReferralCompletion(userId, referrerId);

            return {
                success: true,
                bonusAwarded: this.config.rewards.referrerBonus
            };
        } catch (error) {
            console.error('Referral reward error:', error);
            throw error;
        }
    }

    async getReferralStats(userId) {
        try {
            const [referrals, earnings, history] = await Promise.all([
                this.getTotalReferrals(userId),
                this.getTotalEarnings(userId),
                this.getReferralHistory(userId)
            ]);

            return {
                totalReferrals: referrals,
                activeReferrals: history.filter(r => r.status === 'active').length,
                pendingReferrals: history.filter(r => r.status === 'pending').length,
                totalEarnings: earnings,
                availableBalance: await this.getAvailableBalance(userId),
                history: history.slice(0, 10) // Last 10 referrals
            };
        } catch (error) {
            console.error('Referral stats error:', error);
            throw error;
        }
    }

    async processWithdrawal(userId, amount) {
        try {
            // Check minimum withdrawal amount
            if (amount < this.config.rewards.minimumWithdrawal) {
                throw new Error(authConfig.errors.referral.minimumNotMet);
            }

            // Verify available balance
            const balance = await this.getAvailableBalance(userId);
            if (balance < amount) {
                throw new Error('Insufficient balance');
            }

            // Process withdrawal
            const withdrawal = await this.createWithdrawal(userId, amount);

            // Update balance
            await this.updateBalance(userId, -amount);

            return {
                success: true,
                transactionId: withdrawal.id,
                amount,
                remainingBalance: balance - amount
            };
        } catch (error) {
            console.error('Withdrawal processing error:', error);
            throw error;
        }
    }

    // Helper Methods
    generateUniqueCode(username) {
        const base = username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const random = crypto.randomBytes(4).toString('hex');
        return `${base}-${random}`;
    }

    async storeReferralCode(userId, code) {
        const multi = this.redis.multi();
        
        // Store code to user mapping
        multi.hset('referral:codes', code, userId);
        
        // Store user's referral code
        multi.hset(`user:${userId}`, 'referralCode', code);

        await multi.exec();
    }

    async validateReferralCode(code) {
        const userId = await this.redis.hget('referral:codes', code);
        if (!userId) return null;

        return await this.getUserDetails(userId);
    }

    async checkAlreadyReferred(userId) {
        const referral = await this.redis.hget(`user:${userId}`, 'referredBy');
        return !!referral;
    }

    async storeReferralRelationship(referrerId, userId) {
        const multi = this.redis.multi();

        // Store referral relationship
        multi.hset(`user:${userId}`, 'referredBy', referrerId);
        
        // Add to referrer's list
        multi.sadd(`referrals:${referrerId}`, userId);

        // Track referral time
        multi.hset(`referral:timestamps`, `${referrerId}:${userId}`, Date.now());

        await multi.exec();
    }

    async verifyQualification(userId) {
        const purchases = await this.paymentService.getPaymentAttempts(userId);
        const totalSpent = purchases.reduce((sum, p) => 
            sum + (p.success ? p.details.amount : 0), 0
        );

        return totalSpent >= this.config.validation.minimumPurchaseAmount;
    }

    async awardSignupBonus(userId) {
        await this.updateBalance(userId, this.config.rewards.signupBonus);
    }

    async awardReferralBonus(userId) {
        await this.updateBalance(userId, this.config.rewards.referrerBonus);
    }

    async updateBalance(userId, amount) {
        await this.redis.hincrby(`user:${userId}:balance`, 'referral', amount);
    }

    async getAvailableBalance(userId) {
        const balance = await this.redis.hget(`user:${userId}:balance`, 'referral');
        return parseInt(balance || 0);
    }

    async getTotalReferrals(userId) {
        return await this.redis.scard(`referrals:${userId}`);
    }

    async getTotalEarnings(userId) {
        const history = await this.getReferralHistory(userId);
        return history.reduce((sum, ref) => 
            sum + (ref.status === 'completed' ? ref.reward : 0), 0
        );
    }

    async getReferralHistory(userId) {
        const referralIds = await this.redis.smembers(`referrals:${userId}`);
        
        return Promise.all(referralIds.map(async refId => {
            const timestamp = await this.redis.hget(
                'referral:timestamps',
                `${userId}:${refId}`
            );

            const status = await this.getReferralStatus(refId);
            const reward = status === 'completed' ? this.config.rewards.referrerBonus : 0;

            return {
                userId: refId,
                timestamp: parseInt(timestamp),
                status,
                reward
            };
        }));
    }

    async getReferralStatus(userId) {
        const qualified = await this.verifyQualification(userId);
        return qualified ? 'completed' : 'pending';
    }

    async trackReferralCompletion(userId, referrerId) {
        const completion = {
            timestamp: Date.now(),
            userId,
            referrerId,
            reward: this.config.rewards.referrerBonus
        };

        await this.redis.lpush(
            'referral:completions',
            JSON.stringify(completion)
        );
    }

    async createWithdrawal(userId, amount) {
        const withdrawal = {
            id: `w_${crypto.randomBytes(8).toString('hex')}`,
            userId,
            amount,
            timestamp: Date.now(),
            status: 'pending'
        };

        await this.redis.lpush(
            `withdrawals:${userId}`,
            JSON.stringify(withdrawal)
        );

        return withdrawal;
    }

    // This method would be implemented based on your database choice
    async getUserDetails(userId) {}
}

module.exports = new ReferralService();
