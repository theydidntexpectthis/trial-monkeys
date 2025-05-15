const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const botSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: [true, 'Bot name is required'],
        trim: true,
        minlength: [3, 'Bot name must be at least 3 characters'],
        maxlength: [50, 'Bot name cannot exceed 50 characters']
    },
    serviceType: {
        type: String,
        required: [true, 'Service type is required'],
        enum: {
            values: ['netflix', 'spotify', 'github', 'adobe', 'custom'],
            message: 'Invalid service type'
        }
    },
    description: {
        type: String,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },
    icon: {
        type: String,
        default: '/assets/default-bot-icon.png'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'failed', 'paused', 'maintenance'],
        default: 'inactive',
        index: true
    },
    config: {
        autoRetry: {
            type: Boolean,
            default: false
        },
        retryAttempts: {
            type: Number,
            min: [0, 'Retry attempts cannot be negative'],
            max: [10, 'Maximum retry attempts exceeded'],
            default: 0
        },
        useProxy: {
            type: Boolean,
            default: false
        },
        proxyConfig: {
            type: {
                type: String,
                enum: ['browser', 'datacenter', 'residential', null],
                default: null
            },
            region: String,
            sessionDuration: Number
        },
        notifications: {
            success: {
                type: Boolean,
                default: true
            },
            failure: {
                type: Boolean,
                default: true
            },
            retry: {
                type: Boolean,
                default: true
            }
        },
        customConfig: {
            serviceUrl: {
                type: String,
                validate: {
                    validator: function(v) {
                        return !v || /^https?:\/\/.+/.test(v);
                    },
                    message: 'Invalid service URL'
                }
            },
            trialDuration: {
                type: Number,
                min: [1, 'Trial duration must be at least 1 day'],
                max: [90, 'Trial duration cannot exceed 90 days']
            },
            fields: [{
                name: String,
                selector: String,
                value: String,
                required: Boolean
            }]
        }
    },
    statistics: {
        totalRuns: {
            type: Number,
            default: 0,
            min: [0, 'Total runs cannot be negative']
        },
        successfulRuns: {
            type: Number,
            default: 0,
            min: [0, 'Successful runs cannot be negative']
        },
        failedRuns: {
            type: Number,
            default: 0,
            min: [0, 'Failed runs cannot be negative']
        },
        averageSuccessRate: {
            type: Number,
            default: 100,
            min: [0, 'Success rate cannot be negative'],
            max: [100, 'Success rate cannot exceed 100%']
        },
        averageRunTime: {
            type: Number,
            default: 0,
            min: [0, 'Average run time cannot be negative']
        },
        lastRun: {
            timestamp: Date,
            status: {
                type: String,
                enum: ['success', 'failure', 'aborted']
            },
            duration: Number
        }
    },
    monitoring: {
        health: {
            status: {
                type: String,
                enum: ['healthy', 'warning', 'error'],
                default: 'healthy'
            },
            lastCheck: Date,
            issues: [{
                type: String,
                description: String,
                severity: {
                    type: String,
                    enum: ['low', 'medium', 'high']
                },
                timestamp: Date,
                resolved: Boolean
            }]
        },
        alerts: [{
            type: String,
            message: String,
            timestamp: Date,
            acknowledged: Boolean
        }]
    },
    logs: [{
        timestamp: {
            type: Date,
            default: Date.now
        },
        level: {
            type: String,
            enum: ['info', 'warning', 'error'],
            default: 'info'
        },
        message: String,
        details: Schema.Types.Mixed
    }],
    lastUsed: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
botSchema.index({ userId: 1, serviceType: 1 });
botSchema.index({ status: 1, lastUsed: -1 });
botSchema.index({ 'statistics.averageSuccessRate': -1 });
botSchema.index({ createdAt: -1 });

// Virtual for success rate
botSchema.virtual('successRate').get(function() {
    if (this.statistics.totalRuns === 0) return 100;
    return (this.statistics.successfulRuns / this.statistics.totalRuns) * 100;
});

// Pre-save middleware
botSchema.pre('save', function(next) {
    // Update success rate before saving
    if (this.isModified('statistics.successfulRuns') || this.isModified('statistics.totalRuns')) {
        this.statistics.averageSuccessRate = this.successRate;
    }
    next();
});

// Instance methods
botSchema.methods.addLog = async function(level, message, details = {}) {
    this.logs.push({
        level,
        message,
        details,
        timestamp: new Date()
    });

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
        this.logs = this.logs.slice(-1000);
    }

    return this.save();
};

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

    this.statistics.lastRun = {
        timestamp: new Date(),
        status: success ? 'success' : 'failure',
        duration: runTime
    };

    return this.save();
};

botSchema.methods.addMonitoringIssue = async function(type, description, severity) {
    this.monitoring.health.issues.push({
        type,
        description,
        severity,
        timestamp: new Date(),
        resolved: false
    });

    // Update health status based on highest severity
    if (severity === 'high') {
        this.monitoring.health.status = 'error';
    } else if (severity === 'medium' && this.monitoring.health.status !== 'error') {
        this.monitoring.health.status = 'warning';
    }

    return this.save();
};

// Static methods
botSchema.statics.getActiveBots = function() {
    return this.find({ status: 'active' })
        .sort({ 'statistics.averageSuccessRate': -1 });
};

botSchema.statics.getUserBotStats = async function(userId) {
    const stats = await this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalBots: { $sum: 1 },
                activeBots: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                totalRuns: { $sum: '$statistics.totalRuns' },
                successfulRuns: { $sum: '$statistics.successfulRuns' },
                averageSuccessRate: { $avg: '$statistics.averageSuccessRate' }
            }
        }
    ]);

    return stats[0] || {
        totalBots: 0,
        activeBots: 0,
        totalRuns: 0,
        successfulRuns: 0,
        averageSuccessRate: 0
    };
};

const Bot = mongoose.model('Bot', botSchema);

module.exports = Bot;
