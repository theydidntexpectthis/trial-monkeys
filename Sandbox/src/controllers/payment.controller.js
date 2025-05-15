const { Connection, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const User = require('../models/user.model');
const TrialService = require('../models/trial-service.model');
const config = require('../config/config');

class PaymentController {
    constructor() {
        this.connection = new Connection(config.solana.network, config.solana.commitment);
    }

    // Generate payment transaction
    async generatePaymentTransaction(req, res) {
        try {
            const { serviceId } = req.body;
            const userId = req.user.userId;

            // Get service and user details
            const [service, user] = await Promise.all([
                TrialService.findById(serviceId),
                User.findById(userId)
            ]);

            if (!service || !user) {
                return res.status(404).json({
                    success: false,
                    message: 'Service or user not found'
                });
            }

            // Create transaction
            const transaction = new Transaction();
            
            // Get merchant wallet (your platform's wallet)
            const merchantWallet = new PublicKey(config.solana.merchantWallet);
            
            // Get user's wallet
            const userWallet = new PublicKey(user.phantomWalletAddress);

            // Add transfer instruction
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: userWallet,
                    toPubkey: merchantWallet,
                    lamports: service.price.amount * 1000000000 // Convert SOL to lamports
                })
            );

            // Get recent blockhash
            const { blockhash } = await this.connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = userWallet;

            // Serialize the transaction
            const serializedTransaction = transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false
            });

            // Create payment record
            const paymentRecord = {
                type: 'payment',
                amount: service.price.amount,
                currency: 'SOL',
                status: 'pending',
                timestamp: new Date(),
                description: `Payment for ${service.name} trial`
            };

            // Add payment to user's transactions
            user.transactions.push(paymentRecord);
            await user.save();

            res.json({
                success: true,
                transaction: serializedTransaction.toString('base64'),
                paymentDetails: {
                    amount: service.price.amount,
                    currency: 'SOL',
                    service: service.name
                }
            });

        } catch (error) {
            console.error('Payment generation failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate payment transaction',
                error: error.message
            });
        }
    }

    // Verify payment transaction
    async verifyPayment(req, res) {
        try {
            const { signature, serviceId } = req.body;
            const userId = req.user.userId;

            // Get transaction details
            const transactionDetails = await this.connection.getTransaction(signature);
            if (!transactionDetails) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }

            // Verify transaction status
            if (!transactionDetails.meta.err) {
                // Update user's transaction status
                const user = await User.findById(userId);
                const lastTransaction = user.transactions[user.transactions.length - 1];
                
                if (lastTransaction && lastTransaction.status === 'pending') {
                    lastTransaction.status = 'completed';
                    await user.save();

                    // Trigger trial account creation
                    res.json({
                        success: true,
                        message: 'Payment verified successfully',
                        nextStep: 'create_trial',
                        serviceId
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        message: 'Invalid transaction state'
                    });
                }
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Transaction failed',
                    error: transactionDetails.meta.err
                });
            }

        } catch (error) {
            console.error('Payment verification failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify payment',
                error: error.message
            });
        }
    }

    // Get user's transaction history
    async getTransactionHistory(req, res) {
        try {
            const userId = req.user.userId;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Get transactions with optional filtering
            const { status, type, startDate, endDate } = req.query;
            let transactions = user.transactions;

            if (status) {
                transactions = transactions.filter(t => t.status === status);
            }
            if (type) {
                transactions = transactions.filter(t => t.type === type);
            }
            if (startDate) {
                transactions = transactions.filter(t => t.timestamp >= new Date(startDate));
            }
            if (endDate) {
                transactions = transactions.filter(t => t.timestamp <= new Date(endDate));
            }

            res.json({
                success: true,
                transactions: transactions.sort((a, b) => b.timestamp - a.timestamp)
            });

        } catch (error) {
            console.error('Transaction history fetch failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch transaction history',
                error: error.message
            });
        }
    }

    // Get payment statistics
    async getPaymentStats(req, res) {
        try {
            const userId = req.user.userId;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const payments = user.transactions.filter(t => t.type === 'payment');
            
            const stats = {
                totalSpent: payments.reduce((sum, p) => sum + p.amount, 0),
                totalTransactions: payments.length,
                successfulTransactions: payments.filter(p => p.status === 'completed').length,
                failedTransactions: payments.filter(p => p.status === 'failed').length,
                averageAmount: payments.length > 0 ? 
                    payments.reduce((sum, p) => sum + p.amount, 0) / payments.length : 0
            };

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            console.error('Payment stats fetch failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch payment statistics',
                error: error.message
            });
        }
    }
}

module.exports = new PaymentController();
