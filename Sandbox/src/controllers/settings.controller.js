const User = require('../models/user.model');
const NotificationService = require('../services/notification.service');
const SubscriptionService = require('../services/subscription.service');

class SettingsController {
    // Get user settings
    async getUserSettings(req, res) {
        try {
            const user = await User.findById(req.user.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                settings: {
                    profile: {
                        username: user.username,
                        email: user.email,
                        phantomWalletAddress: user.phantomWalletAddress
                    },
                    preferences: user.preferences || {},
                    notifications: user.preferences?.notifications || {
                        email: true,
                        browser: true
                    },
                    botSettings: user.preferences?.botSettings || {
                        autoRetry: true,
                        proxyEnabled: true,
                        captchaSolving: true
                    },
                    theme: user.preferences?.theme || 'light',
                    language: user.preferences?.language || 'en'
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user settings',
                error: error.message
            });
        }
    }

    // Update user settings
    async updateSettings(req, res) {
        try {
            const { settings } = req.body;
            const user = await User.findById(req.user.userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Validate settings based on subscription plan
            const subscription = await SubscriptionService.getUserSubscription(req.user.userId);
            const validatedSettings = await this.validateSettings(settings, subscription);

            // Update user preferences
            user.preferences = {
                ...user.preferences,
                ...validatedSettings
            };

            await user.save();

            // Send notification about settings update
            await NotificationService.sendToUser(req.user.userId, {
                type: 'settings_updated',
                title: 'Settings Updated',
                message: 'Your settings have been updated successfully'
            });

            res.json({
                success: true,
                message: 'Settings updated successfully',
                settings: user.preferences
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update settings',
                error: error.message
            });
        }
    }

    // Update notification preferences
    async updateNotificationSettings(req, res) {
        try {
            const { notifications } = req.body;
            const user = await User.findById(req.user.userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            user.preferences = {
                ...user.preferences,
                notifications: {
                    ...user.preferences?.notifications,
                    ...notifications
                }
            };

            await user.save();

            res.json({
                success: true,
                message: 'Notification settings updated',
                notifications: user.preferences.notifications
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update notification settings',
                error: error.message
            });
        }
    }

    // Update bot settings
    async updateBotSettings(req, res) {
        try {
            const { botSettings } = req.body;
            const user = await User.findById(req.user.userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Validate bot settings against subscription features
            const subscription = await SubscriptionService.getUserSubscription(req.user.userId);
            const validatedBotSettings = await this.validateBotSettings(botSettings, subscription);

            user.preferences = {
                ...user.preferences,
                botSettings: {
                    ...user.preferences?.botSettings,
                    ...validatedBotSettings
                }
            };

            await user.save();

            res.json({
                success: true,
                message: 'Bot settings updated',
                botSettings: user.preferences.botSettings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update bot settings',
                error: error.message
            });
        }
    }

    // Reset settings to default
    async resetSettings(req, res) {
        try {
            const user = await User.findById(req.user.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const defaultSettings = await this.getDefaultSettings(user.subscription.plan);
            user.preferences = defaultSettings;
            await user.save();

            res.json({
                success: true,
                message: 'Settings reset to default',
                settings: defaultSettings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to reset settings',
                error: error.message
            });
        }
    }

    // Helper methods
    async validateSettings(settings, subscription) {
        const validatedSettings = { ...settings };

        // Validate features based on subscription plan
        if (settings.botSettings) {
            validatedSettings.botSettings = await this.validateBotSettings(
                settings.botSettings,
                subscription
            );
        }

        return validatedSettings;
    }

    async validateBotSettings(botSettings, subscription) {
        const validated = { ...botSettings };

        // Check if features are available in subscription plan
        if (!subscription.features.proxySupport) {
            validated.proxyEnabled = false;
        }
        if (!subscription.features.captchaSolving) {
            validated.captchaSolving = false;
        }

        return validated;
    }

    async getDefaultSettings(subscriptionPlan) {
        return {
            notifications: {
                email: true,
                browser: true
            },
            botSettings: {
                autoRetry: true,
                proxyEnabled: subscriptionPlan !== 'free',
                captchaSolving: subscriptionPlan !== 'free'
            },
            theme: 'light',
            language: 'en'
        };
    }

    // Export settings
    async exportSettings(req, res) {
        try {
            const user = await User.findById(req.user.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const settings = {
                preferences: user.preferences,
                subscription: user.subscription,
                exportDate: new Date(),
                version: '1.0'
            };

            res.json({
                success: true,
                settings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to export settings',
                error: error.message
            });
        }
    }

    // Import settings
    async importSettings(req, res) {
        try {
            const { settings } = req.body;
            const user = await User.findById(req.user.userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Validate imported settings
            const subscription = await SubscriptionService.getUserSubscription(req.user.userId);
            const validatedSettings = await this.validateSettings(settings.preferences, subscription);

            user.preferences = validatedSettings;
            await user.save();

            res.json({
                success: true,
                message: 'Settings imported successfully',
                settings: user.preferences
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to import settings',
                error: error.message
            });
        }
    }
}

module.exports = new SettingsController();
