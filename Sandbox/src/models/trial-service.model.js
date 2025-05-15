const mongoose = require('mongoose');

const trialServiceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Service name is required'],
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Service description is required']
    },
    category: {
        type: String,
        required: true,
        enum: ['streaming', 'software', 'gaming', 'education', 'other']
    },
    websiteUrl: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(v);
            },
            message: props => `${props.value} is not a valid URL!`
        }
    },
    trialDuration: {
        value: {
            type: Number,
            required: true,
            min: 1
        },
        unit: {
            type: String,
            enum: ['hours', 'days', 'months'],
            default: 'days'
        }
    },
    price: {
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        currency: {
            type: String,
            enum: ['SOL', 'USD'],
            default: 'SOL'
        }
    },
    requirements: {
        email: {
            type: Boolean,
            default: true
        },
        phoneNumber: {
            type: Boolean,
            default: false
        },
        creditCard: {
            type: Boolean,
            default: false
        },
        captcha: {
            type: Boolean,
            default: true
        }
    },
    automationConfig: {
        selectors: {
            loginForm: String,
            emailField: String,
            passwordField: String,
            submitButton: String,
            captchaElement: String
        },
        steps: [{
            action: {
                type: String,
                enum: ['click', 'type', 'wait', 'submit'],
                required: true
            },
            target: String,
            value: String,
            delay: Number
        }]
    },
    brightDataConfig: {
        scraperType: {
            type: String,
            enum: ['browser', 'dataCenterProxy', 'residentialProxy'],
            default: 'browser'
        },
        countryCode: String,
        customHeaders: Map,
        cookies: [{
            name: String,
            value: String,
            domain: String,
            path: String
        }]
    },
    rapidApiConfig: {
        endpoints: [{
            name: String,
            url: String,
            method: {
                type: String,
                enum: ['GET', 'POST', 'PUT', 'DELETE'],
                default: 'GET'
            },
            headers: Map
        }]
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    },
    successRate: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },
    restrictions: {
        maxTrialsPerUser: {
            type: Number,
            default: 1
        },
        requiredSubscriptionLevel: {
            type: String,
            enum: ['free', 'basic', 'premium'],
            default: 'free'
        },
        geographicRestrictions: [String],
        deviceRestrictions: [String]
    },
    statistics: {
        totalTrials: {
            type: Number,
            default: 0
        },
        successfulTrials: {
            type: Number,
            default: 0
        },
        failedTrials: {
            type: Number,
            default: 0
        },
        averageSetupTime: Number
    }
}, {
    timestamps: true
});

// Indexes
trialServiceSchema.index({ name: 1 });
trialServiceSchema.index({ category: 1 });
trialServiceSchema.index({ 'price.amount': 1 });
trialServiceSchema.index({ status: 1 });

// Instance methods
trialServiceSchema.methods.isAvailableForUser = function(user) {
    if (this.status !== 'active') return false;
    
    const userTrials = user.trialAccounts.filter(trial => 
        trial.serviceName === this.name
    ).length;
    
    return userTrials < this.restrictions.maxTrialsPerUser &&
           user.subscription.plan >= this.restrictions.requiredSubscriptionLevel;
};

trialServiceSchema.methods.updateStatistics = function(success) {
    this.statistics.totalTrials += 1;
    if (success) {
        this.statistics.successfulTrials += 1;
    } else {
        this.statistics.failedTrials += 1;
    }
    this.successRate = (this.statistics.successfulTrials / this.statistics.totalTrials) * 100;
    return this.save();
};

// Static methods
trialServiceSchema.statics.findAvailableServices = function(userSubscriptionLevel) {
    return this.find({
        status: 'active',
        'restrictions.requiredSubscriptionLevel': { $lte: userSubscriptionLevel }
    });
};

const TrialService = mongoose.model('TrialService', trialServiceSchema);

module.exports = TrialService;
