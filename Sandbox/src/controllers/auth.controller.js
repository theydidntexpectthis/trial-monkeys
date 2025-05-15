const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const { Connection, PublicKey } = require('@solana/web3.js');
const { Buffer } = require('buffer');

class AuthController {
    constructor() {
        // Initialize Solana connection
        this.connection = new Connection(
            process.env.SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com',
            'confirmed'
        );
    }

    // Generate nonce for wallet signature
    generateNonce() {
        return Buffer.from(Math.random().toString()).toString('base64');
    }

    // Verify Phantom wallet signature
    async verifySignature(message, signature, publicKey) {
        try {
            const encodedMessage = new TextEncoder().encode(message);
            const publicKeyObj = new PublicKey(publicKey);
            const signatureBytes = Buffer.from(signature, 'base64');
            
            const verified = await this.connection.verify(
                publicKeyObj,
                encodedMessage,
                signatureBytes
            );

            return verified;
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    }

    // Initialize wallet connection
    async initializeWalletConnection(req, res) {
        try {
            const nonce = this.generateNonce();
            // Store nonce in session or temporary storage
            req.session.authNonce = nonce;
            
            res.json({
                success: true,
                nonce,
                message: 'Please sign this message to authenticate'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to initialize wallet connection',
                error: error.message
            });
        }
    }

    // Handle wallet authentication
    async authenticateWallet(req, res) {
        try {
            const { signature, publicKey, message } = req.body;

            // Verify the signature
            const isValid = await this.verifySignature(message, signature, publicKey);
            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid signature'
                });
            }

            // Find or create user
            let user = await User.findByPhantomWallet(publicKey);
            if (!user) {
                user = await User.create({
                    phantomWalletAddress: publicKey,
                    username: `user_${publicKey.slice(0, 8)}`,
                    email: `${publicKey.slice(0, 8)}@placeholder.com`,
                    verificationStatus: {
                        wallet: true
                    }
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: user._id,
                    walletAddress: publicKey
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            res.json({
                success: true,
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    walletAddress: user.phantomWalletAddress,
                    subscription: user.subscription,
                    preferences: user.preferences
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Authentication failed',
                error: error.message
            });
        }
    }

    // Verify JWT token middleware
    async verifyToken(req, res, next) {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'No token provided'
                });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            next();
        } catch (error) {
            res.status(401).json({
                success: false,
                message: 'Invalid token',
                error: error.message
            });
        }
    }

    // Update user profile
    async updateProfile(req, res) {
        try {
            const { username, email, preferences } = req.body;
            const userId = req.user.userId;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Update fields if provided
            if (username) user.username = username;
            if (email) {
                user.email = email;
                user.verificationStatus.email = false; // Require re-verification
            }
            if (preferences) user.preferences = { ...user.preferences, ...preferences };

            await user.save();

            res.json({
                success: true,
                message: 'Profile updated successfully',
                user: {
                    username: user.username,
                    email: user.email,
                    preferences: user.preferences
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update profile',
                error: error.message
            });
        }
    }

    // Logout
    async logout(req, res) {
        try {
            // In a real implementation, you might want to blacklist the token
            // or handle any cleanup needed
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Logout failed',
                error: error.message
            });
        }
    }
}

module.exports = new AuthController();
