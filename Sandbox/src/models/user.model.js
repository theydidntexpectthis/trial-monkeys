const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phantomWalletAddress: {
        type: String,
        required: [true, 'Phantom wallet address is required'],
        unique: true
    },
    trialAccounts: [{
        serviceName: String,
        createdAt: Date,
        expiresAt: Date,
        status: {
            type: String,
            enum: ['active', 'expired', 'cancelled'],
            default: 'active'
        },
        credentials: {
            email: String,
            username: String,
            // Other credentials stored securely
        }
    }],
    preferences: {
        theme: {
            type: String,
            enum: ['light', 'dark'],
            default: 'light'
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            browser: {
                type: Boolean,
                default: true
            }
        },
        autoRenew: {
            type: Boolean,
            default: false
        }
    },
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'basic', 'premium'],
            default: 'free'
        },
        startDate: Date,
        endDate: Date,
        status: {
            type: String,
            enum: ['active', 'inactive', 'cancelled'],
            default: 'active'
        }
    },
    transactions: [{
        type: {
            type: String,
            enum: ['payment', 'refund'],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'SOL'
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        description: String
    }],
    lastLogin: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    verificationStatus: {
        email: {
            type: Boolean,
            default: false
        },
        wallet: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
    if (this.isModified('trialAccounts')) {
        // Clean up expired trials
        const now = new Date();
        this.trialAccounts = this.trialAccounts.map(trial => {
            if (trial.expiresAt < now) {
                trial.status = 'expired';
            }
            return trial;
        });
    }
    next();
});

// Instance methods
userSchema.methods.hasActiveTrialFor = function(serviceName) {
    const activeTrials = this.trialAccounts.filter(trial => 
        trial.serviceName === serviceName && 
        trial.status === 'active' && 
        trial.expiresAt > new Date()
    );
    return activeTrials.length > 0;
};

userSchema.methods.getActiveTrials = function() {
    const now = new Date();
    return this.trialAccounts.filter(trial => 
        trial.status === 'active' && 
        trial.expiresAt > now
    );
};

// Static methods
userSchema.statics.findByPhantomWallet = function(walletAddress) {
    return this.findOne({ phantomWalletAddress: walletAddress });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
