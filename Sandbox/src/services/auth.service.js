const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Redis = require('ioredis');
const authConfig = require('../config/auth-integration.config');

class AuthService {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        this.tokenBlacklist = 'token:blacklist:';
        this.refreshTokens = 'refresh:tokens:';
    }

    async registerUser(userData) {
        try {
            // Validate user data
            await this.validateRegistrationData(userData);

            // Hash password
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // Generate verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');

            // Create user object
            const user = {
                ...userData,
                password: hashedPassword,
                verificationToken,
                verified: false,
                created: new Date(),
                referralCode: this.generateReferralCode(userData.username)
            };

            // Store user in database
            const savedUser = await this.saveUser(user);

            // Send verification email
            await this.sendVerificationEmail(savedUser);

            return {
                userId: savedUser.id,
                username: savedUser.username,
                email: savedUser.email,
                requiresVerification: true
            };
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    async loginUser(email, password) {
        try {
            // Get user by email
            const user = await this.getUserByEmail(email);
            if (!user) throw new Error(authConfig.errors.auth.invalidCredentials);

            // Check if email is verified
            if (authConfig.registration.email.verification && !user.verified) {
                throw new Error(authConfig.errors.auth.emailNotVerified);
            }

            // Verify password
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) throw new Error(authConfig.errors.auth.invalidCredentials);

            // Generate tokens
            const tokens = await this.generateAuthTokens(user);

            // Track login
            await this.trackUserLogin(user.id);

            return {
                user: this.sanitizeUser(user),
                ...tokens
            };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async handleOAuthLogin(provider, profile) {
        try {
            let user = await this.getUserByOAuth(provider, profile.id);

            if (!user) {
                // Create new user from OAuth profile
                user = await this.createOAuthUser(provider, profile);
            }

            // Generate tokens
            const tokens = await this.generateAuthTokens(user);

            // Track OAuth login
            await this.trackUserLogin(user.id, provider);

            return {
                user: this.sanitizeUser(user),
                ...tokens
            };
        } catch (error) {
            console.error('OAuth login error:', error);
            throw error;
        }
    }

    async verifyEmail(token) {
        try {
            const user = await this.getUserByVerificationToken(token);
            if (!user) throw new Error('Invalid verification token');

            // Update user verification status
            user.verified = true;
            user.verificationToken = null;
            await this.updateUser(user);

            return true;
        } catch (error) {
            console.error('Email verification error:', error);
            throw error;
        }
    }

    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, authConfig.auth.jwt.refreshToken.secret);
            
            // Check if token is blacklisted
            const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
            if (isBlacklisted) throw new Error('Token has been revoked');

            // Get user
            const user = await this.getUserById(decoded.userId);
            if (!user) throw new Error('User not found');

            // Generate new tokens
            const tokens = await this.generateAuthTokens(user);

            // Blacklist old refresh token
            await this.blacklistToken(refreshToken);

            return tokens;
        } catch (error) {
            console.error('Token refresh error:', error);
            throw error;
        }
    }

    async logout(accessToken, refreshToken) {
        try {
            // Blacklist both tokens
            await Promise.all([
                this.blacklistToken(accessToken),
                this.blacklistToken(refreshToken)
            ]);

            return true;
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    }

    // Token Management
    async generateAuthTokens(user) {
        const accessToken = jwt.sign(
            { userId: user.id },
            authConfig.auth.jwt.secret,
            { expiresIn: authConfig.auth.jwt.expiresIn }
        );

        const refreshToken = jwt.sign(
            { userId: user.id },
            authConfig.auth.jwt.refreshToken.secret,
            { expiresIn: authConfig.auth.jwt.refreshToken.expiresIn }
        );

        // Store refresh token
        await this.storeRefreshToken(user.id, refreshToken);

        return { accessToken, refreshToken };
    }

    async blacklistToken(token) {
        const key = `${this.tokenBlacklist}${token}`;
        await this.redis.set(key, '1', 'EX', 24 * 60 * 60); // 24 hours
    }

    async isTokenBlacklisted(token) {
        const key = `${this.tokenBlacklist}${token}`;
        return await this.redis.exists(key);
    }

    async storeRefreshToken(userId, token) {
        const key = `${this.refreshTokens}${userId}`;
        await this.redis.set(key, token, 'EX', 7 * 24 * 60 * 60); // 7 days
    }

    // User Management
    async validateRegistrationData(userData) {
        const { email, password, username } = userData;

        if (!authConfig.validation.email.test(email)) {
            throw new Error('Invalid email format');
        }

        if (!authConfig.validation.password.test(password)) {
            throw new Error('Password does not meet requirements');
        }

        if (!authConfig.validation.username.test(username)) {
            throw new Error('Invalid username format');
        }

        // Check if email or username already exists
        const exists = await this.checkUserExists(email, username);
        if (exists) throw new Error('Email or username already taken');
    }

    generateReferralCode(username) {
        const base = username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const random = crypto.randomBytes(3).toString('hex');
        return `${base}-${random}`;
    }

    sanitizeUser(user) {
        const { password, verificationToken, ...safeUser } = user;
        return safeUser;
    }

    async trackUserLogin(userId, provider = 'email') {
        const loginData = {
            timestamp: Date.now(),
            provider,
            ip: null // Should be passed from request
        };

        await this.redis.lpush(`user:${userId}:logins`, JSON.stringify(loginData));
        await this.redis.ltrim(`user:${userId}:logins`, 0, 99); // Keep last 100 logins
    }

    // Helper Methods
    async sendVerificationEmail(user) {
        // Implementation would depend on your email service
        console.log('Sending verification email to:', user.email);
    }

    async createOAuthUser(provider, profile) {
        // Implementation would depend on your user model
        console.log('Creating OAuth user for:', provider);
    }

    // These methods would be implemented based on your database choice
    async saveUser(user) {}
    async getUserByEmail(email) {}
    async getUserById(id) {}
    async getUserByOAuth(provider, id) {}
    async getUserByVerificationToken(token) {}
    async updateUser(user) {}
    async checkUserExists(email, username) {}
}

module.exports = new AuthService();
