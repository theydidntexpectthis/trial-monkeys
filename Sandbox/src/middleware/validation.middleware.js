const { validationResult, matchedData } = require('express-validator');
const ErrorHandler = require('./error-handler.middleware');

class ValidationMiddleware {
    // Validate request
    validate = (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new ErrorHandler.ValidationError(
                'Validation failed',
                errors.array()
            );
        }

        // Add validated data to request
        req.validatedData = matchedData(req);
        next();
    };

    // Common validation rules
    rules = {
        // User validation rules
        user: {
            create: [
                {
                    field: 'email',
                    rules: {
                        notEmpty: true,
                        isEmail: true,
                        errorMessage: 'Valid email is required'
                    }
                },
                {
                    field: 'password',
                    rules: {
                        notEmpty: true,
                        isLength: { min: 8 },
                        matches: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/,
                        errorMessage: 'Password must be at least 8 characters and contain letters and numbers'
                    }
                },
                {
                    field: 'username',
                    rules: {
                        notEmpty: true,
                        isLength: { min: 3, max: 30 },
                        matches: /^[a-zA-Z0-9_-]+$/,
                        errorMessage: 'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'
                    }
                }
            ]
        },

        // Bot validation rules
        bot: {
            create: [
                {
                    field: 'name',
                    rules: {
                        notEmpty: true,
                        isLength: { min: 3, max: 50 },
                        errorMessage: 'Bot name must be 3-50 characters'
                    }
                },
                {
                    field: 'serviceType',
                    rules: {
                        notEmpty: true,
                        isIn: ['netflix', 'spotify', 'github', 'custom'],
                        errorMessage: 'Invalid service type'
                    }
                },
                {
                    field: 'config',
                    rules: {
                        isObject: true,
                        errorMessage: 'Invalid configuration'
                    }
                }
            ],
            update: [
                {
                    field: 'name',
                    rules: {
                        optional: true,
                        isLength: { min: 3, max: 50 },
                        errorMessage: 'Bot name must be 3-50 characters'
                    }
                },
                {
                    field: 'status',
                    rules: {
                        optional: true,
                        isIn: ['active', 'inactive', 'paused'],
                        errorMessage: 'Invalid status'
                    }
                }
            ]
        },

        // Trial validation rules
        trial: {
            create: [
                {
                    field: 'serviceType',
                    rules: {
                        notEmpty: true,
                        isString: true,
                        errorMessage: 'Service type is required'
                    }
                },
                {
                    field: 'duration',
                    rules: {
                        optional: true,
                        isInt: { min: 1, max: 90 },
                        errorMessage: 'Duration must be between 1 and 90 days'
                    }
                }
            ]
        },

        // Subscription validation rules
        subscription: {
            upgrade: [
                {
                    field: 'plan',
                    rules: {
                        notEmpty: true,
                        isIn: ['basic', 'premium', 'enterprise'],
                        errorMessage: 'Invalid subscription plan'
                    }
                }
            ]
        }
    };

    // Custom validators
    customValidators = {
        // Check if value is an object
        isObject: (value) => {
            return typeof value === 'object' && !Array.isArray(value) && value !== null;
        },

        // Check if value is a valid URL
        isValidUrl: (value) => {
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }
        },

        // Check if value is a valid JSON string
        isValidJson: (value) => {
            try {
                JSON.parse(value);
                return true;
            } catch {
                return false;
            }
        }
    };

    // Build validation chain
    buildValidationChain(field, rules) {
        const chain = [];

        // Add basic validation
        if (!rules.optional) {
            chain.push(
                body(field)
                    .exists()
                    .withMessage(`${field} is required`)
            );
        }

        // Add type validation
        if (rules.isString) {
            chain.push(
                body(field)
                    .isString()
                    .withMessage(`${field} must be a string`)
            );
        }

        // Add specific rules
        Object.entries(rules).forEach(([rule, value]) => {
            switch (rule) {
                case 'notEmpty':
                    chain.push(
                        body(field)
                            .notEmpty()
                            .withMessage(rules.errorMessage || `${field} cannot be empty`)
                    );
                    break;

                case 'isEmail':
                    chain.push(
                        body(field)
                            .isEmail()
                            .withMessage(rules.errorMessage || `${field} must be a valid email`)
                    );
                    break;

                case 'isLength':
                    chain.push(
                        body(field)
                            .isLength(value)
                            .withMessage(rules.errorMessage || `${field} length is invalid`)
                    );
                    break;

                case 'matches':
                    chain.push(
                        body(field)
                            .matches(value)
                            .withMessage(rules.errorMessage || `${field} format is invalid`)
                    );
                    break;

                case 'isIn':
                    chain.push(
                        body(field)
                            .isIn(value)
                            .withMessage(rules.errorMessage || `${field} contains invalid value`)
                    );
                    break;
            }
        });

        return chain;
    }

    // Get validation rules for a specific entity and action
    getValidationRules(entity, action) {
        const rules = this.rules[entity]?.[action];
        if (!rules) {
            throw new Error(`No validation rules found for ${entity}.${action}`);
        }

        return rules.map(rule => this.buildValidationChain(rule.field, rule.rules)).flat();
    }

    // Sanitize request data
    sanitize(data) {
        const sanitized = {};
        
        Object.entries(data).forEach(([key, value]) => {
            // Remove any HTML tags
            if (typeof value === 'string') {
                sanitized[key] = value.replace(/<[^>]*>/g, '');
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitize(value);
            } else {
                sanitized[key] = value;
            }
        });

        return sanitized;
    }
}

module.exports = new ValidationMiddleware();
