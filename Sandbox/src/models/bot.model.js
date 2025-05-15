const mongoose = require('mongoose');

const botSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Bot name is required'],
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Bot description is required']
    },
    category: {
        type: String,
        required: true,
        enum: ['streaming', 'development', 'gaming', 'productivity', 'education'],
        index: true
    },
    icon: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'maintenance', 'deprecated'],
        default: 'active',
        index: true
    },
    version: {
        type: String,
        default: '1.0.0'
    },
    config: {
        url: {
            type: String,
            required: true
        },
        selectors: {
            type: Map,
            of: String,
            required: true
        },
        proxyRequired: {
            type: Boolean,
            default: true
        },
        captchaType: {
            type: String,
            enum: ['recaptcha', 'hcaptcha', 'custom', null],
            default: null
        },
        regions: [{
            type: String,
            default: ['global']
        }],
        timeout: {
            type: Number,
            default: 30000 // 30 seconds
        }
    },
    automation: {
        steps: [{
            action: {
                type: String,
                enum: ['navigate', 'click', 'type', 'wait', 'submit', 'verify'],
                required: true
            },
            selector: String,
            value: String,
            timeout: Number,
            optional: Boolean
        }],
        errorHandling: {
            retryAttempts: {
                type: Number,
                default: 3
            },
            retryDelay: {
                type: Number,
                default: 1000 // 1 second
            }
        }
    },
    requirements: {
        subscription: {
            type: String,
            enum: ['free', 'basic', 'premium'],
            default: 'basic'
        },
        minVersion: String,
        maxTrialsPerUser: {
            type: Number,
            default: 1
        }
    },
    statistics: {
        totalRuns: {
            type: Number,
            default: 0
        },
        successfulRuns: {
            type: Number,
            default: 0
        },
        failedRuns: {
            type: Number,
            default: 0
        },
        averageSuccessRate: {
            type: Number,
            default: 100
        },
        averageRunTime: {
            type: Number,
            default: 0
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    trialDetails: {
        duration: {
            value: {
                type: Number,
                required: true
            },
            unit: {
                type: String,
                enum: ['hours', 'days', 'months'],
                default: 'days'
            }
        },
        features: [{
            name: String,
            description: String
        }],
        restrictions: [String]
    },
    maintenance: {
        lastCheck: Date,
        nextCheck: Date,
        issues: [{
            type: {
                type: String,
                enum: ['error', 'captcha', 'proxy', 'other']
            },
            description: String,
            reportedAt: Date,
            resolvedAt: Date,
            status: {
                type: String,
                enum: ['open', 'investigating', 'resolved'],
                default: 'open'
            }
        }]
    }
}, {
    timestamps: true
});

// Indexes
botSchema.index({ name: 1 });
botSchema.index({ category: 1, status: 1 });
botSchema.index({ 'statistics.averageSuccessRate': -1 });

// Virtual for success rate
botSchema.virtual('successRate').get(function() {
    if (this.statistics.totalRuns === 0) return 100;
    return (this.statistics.successfulRuns / this.statistics.totalRuns) * 100;
});

// Pre-save middleware
botSchema.pre('save', function(next) {
    if (this.isModified('statistics.successfulRuns') || this.isModified('statistics.totalRuns')) {
        this.statistics.averageSuccessRate = this.successRate;
    }
    next();
});

// Instance methods
botSchema.methods.updateStatistics = async function(success, runTime) {
    this.statistics.totalRuns += 1;
    if (success) {
        this.statistics.successfulRuns += 1;
    } else {
        this.statistics.failedRuns += 1;
    }
    
    // Update average run time
    const totalTime = (this.statistics.averageRunTime * (this.statistics.totalRuns - 1)) + runTime;
    this.statistics.averageRunTime = totalTime / this.statistics.totalRuns;
    
    this.statistics.lastUpdated = new Date();
    return this.save();
};

botSchema.methods.reportIssue = async function(issueType, description) {
    this.maintenance.issues.push({
        type: issueType,
        description,
        reportedAt: new Date()
    });
    return this.save();
};

botSchema.methods.resolveIssue = async function(issueId) {
    const issue = this.maintenance.issues.id(issueId);
    if (issue) {
        issue.status = 'resolved';
        issue.resolvedAt = new Date();
        return this.save();
    }
    throw new Error('Issue not found');
};

// Static methods
botSchema.statics.getActiveBots = function() {
    return this.find({ status: 'active' })
        .sort({ 'statistics.averageSuccessRate': -1 });
};

botSchema.statics.getTopBots = function(limit = 10) {
    return this.find({ 
        status: 'active',
        'statistics.totalRuns': { $gt: 100 }
    })
    .sort({ 'statistics.averageSuccessRate': -1 })
    .limit(limit);
};

botSchema.statics.getBotsByCategory = function(category) {
    return this.find({ 
        category,
        status: 'active'
    });
};

const Bot = mongoose.model('Bot', botSchema);

module.exports = Bot;
