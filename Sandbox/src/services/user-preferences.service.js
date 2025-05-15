const User = require('../models/user.model');
const config = require('../config/config');

class UserPreferencesService {
    constructor() {
        this.defaultPreferences = {
            theme: 'light',
            notifications: {
                email: true,
                browser: true,
                telegram: false,
                discord: false
            },
            botSettings: {
                autoRetry: true,
                retryAttempts: 3,
                proxyEnabled: true,
                captchaSolving: true,
                notifyOnSuccess: true,
                notifyOnFailure: true
            },
            dashboard: {
                defaultView: 'grid',
                refreshInterval: 30,
                showStatistics: true,
                compactMode: false
            },
            monitoring: {
                alertThresholds: {
                    successRate: 90,
                    responseTime: 5000,
                    errorRate: 10
                },
                autoResolution: true,
                notificationPriority: 'high'
            },
            security: {
                twoFactorEnabled: false,
                sessionTimeout: 60,
                allowedIPs: [],
                activityLogging: true
            },
            timezone: 'UTC',
            language: 'en',
            dateFormat: 'MM/DD/YYYY',
            timeFormat: '24h'
        };

        this.preferenceValidators = this.initializeValidators();
    }

    // Initialize preference validators
    initializeValidators() {
        return {
            theme: (value) => ['light', 'dark'].includes(value),
            'notifications.email': (value) => typeof value === 'boolean',
            'notifications.browser': (value) => typeof value === 'boolean',
            'botSettings.retryAttempts': (value) => Number.isInteger(value) && value >= 0 && value <= 10,
            'monitoring.alertThresholds.successRate': (value) => typeof value === 'number' && value >= 0 && value <= 100,
            'security.sessionTimeout': (value) => Number.isInteger(value) && value >= 15 && value <= 1440
        };
    }

    // Get user preferences
    async getUserPreferences(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            // Merge default preferences with user preferences
            return {
                ...this.defaultPreferences,
                ...user.preferences
            };
        } catch (error) {
            console.error('Failed to get user preferences:', error);
            throw error;
        }
    }

    // Update user preferences
    async updatePreferences(userId, updates) {
        try {
            // Validate updates
            this.validatePreferences(updates);

            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            // Apply updates to existing preferences
            const updatedPreferences = this.mergePreferences(
                user.preferences || {},
                updates
            );

            // Save updated preferences
            user.preferences = updatedPreferences;
            await user.save();

            return updatedPreferences;
        } catch (error) {
            console.error('Failed to update preferences:', error);
            throw error;
        }
    }

    // Reset preferences to default
    async resetPreferences(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            user.preferences = this.defaultPreferences;
            await user.save();

            return this.defaultPreferences;
        } catch (error) {
            console.error('Failed to reset preferences:', error);
            throw error;
        }
    }

    // Update specific preference
    async updatePreference(userId, path, value) {
        try {
            // Validate single preference
            this.validateSinglePreference(path, value);

            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            // Update specific preference path
            const preferences = user.preferences || {};
            this.setNestedValue(preferences, path, value);

            user.preferences = preferences;
            await user.save();

            return preferences;
        } catch (error) {
            console.error('Failed to update preference:', error);
            throw error;
        }
    }

    // Import preferences
    async importPreferences(userId, preferences) {
        try {
            // Validate imported preferences
            this.validatePreferences(preferences);

            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            // Merge with default preferences
            const mergedPreferences = {
                ...this.defaultPreferences,
                ...preferences
            };

            user.preferences = mergedPreferences;
            await user.save();

            return mergedPreferences;
        } catch (error) {
            console.error('Failed to import preferences:', error);
            throw error;
        }
    }

    // Export preferences
    async exportPreferences(userId) {
        try {
            const preferences = await this.getUserPreferences(userId);
            return {
                preferences,
                exportDate: new Date(),
                version: '1.0'
            };
        } catch (error) {
            console.error('Failed to export preferences:', error);
            throw error;
        }
    }

    // Validate preferences
    validatePreferences(preferences) {
        for (const [path, value] of this.flattenObject(preferences)) {
            this.validateSinglePreference(path, value);
        }
    }

    // Validate single preference
    validateSinglePreference(path, value) {
        const validator = this.preferenceValidators[path];
        if (validator && !validator(value)) {
            throw new Error(`Invalid value for preference: ${path}`);
        }
    }

    // Merge preferences
    mergePreferences(existing, updates) {
        const merged = { ...existing };
        
        for (const [path, value] of this.flattenObject(updates)) {
            this.setNestedValue(merged, path, value);
        }

        return merged;
    }

    // Get nested value
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => 
            current ? current[key] : undefined, obj);
    }

    // Set nested value
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            current[key] = current[key] || {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    // Flatten object
    *flattenObject(obj, prefix = '') {
        for (const [key, value] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                yield* this.flattenObject(value, path);
            } else {
                yield [path, value];
            }
        }
    }

    // Get preference schema
    getPreferenceSchema() {
        return {
            theme: {
                type: 'string',
                enum: ['light', 'dark'],
                description: 'UI theme preference'
            },
            notifications: {
                type: 'object',
                properties: {
                    email: { type: 'boolean' },
                    browser: { type: 'boolean' },
                    telegram: { type: 'boolean' },
                    discord: { type: 'boolean' }
                }
            },
            botSettings: {
                type: 'object',
                properties: {
                    autoRetry: { type: 'boolean' },
                    retryAttempts: { type: 'number', minimum: 0, maximum: 10 },
                    proxyEnabled: { type: 'boolean' },
                    captchaSolving: { type: 'boolean' }
                }
            },
            monitoring: {
                type: 'object',
                properties: {
                    alertThresholds: {
                        type: 'object',
                        properties: {
                            successRate: { type: 'number', minimum: 0, maximum: 100 },
                            responseTime: { type: 'number', minimum: 0 },
                            errorRate: { type: 'number', minimum: 0, maximum: 100 }
                        }
                    }
                }
            }
        };
    }

    // Validate preference against schema
    validateAgainstSchema(preference, schema) {
        const type = schema.type;
        const value = preference;

        switch (type) {
            case 'string':
                if (schema.enum) {
                    return schema.enum.includes(value);
                }
                return typeof value === 'string';

            case 'boolean':
                return typeof value === 'boolean';

            case 'number':
                return typeof value === 'number' &&
                    (!schema.minimum || value >= schema.minimum) &&
                    (!schema.maximum || value <= schema.maximum);

            case 'object':
                if (typeof value !== 'object' || value === null) {
                    return false;
                }
                return Object.entries(schema.properties).every(([key, propSchema]) =>
                    this.validateAgainstSchema(value[key], propSchema)
                );

            default:
                return true;
        }
    }
}

module.exports = new UserPreferencesService();
