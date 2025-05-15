class SettingsManager {
    constructor() {
        this.currentSettings = {};
        this.initializeSettings();
        this.setupEventListeners();
    }

    // Initialize settings
    async initializeSettings() {
        try {
            // Fetch current settings
            const response = await fetch('/api/settings', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            const data = await response.json();

            if (data.success) {
                this.currentSettings = data.settings;
                this.renderSettings();
            }
        } catch (error) {
            console.error('Failed to initialize settings:', error);
            this.showError('Failed to load settings');
        }
    }

    // Set up event listeners
    setupEventListeners() {
        // Theme toggle
        document.getElementById('theme-toggle')?.addEventListener('change', (e) => {
            this.updateTheme(e.target.checked ? 'dark' : 'light');
        });

        // Notification settings
        document.querySelectorAll('.notification-toggle').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.updateNotificationSettings({
                    [e.target.dataset.type]: e.target.checked
                });
            });
        });

        // Bot settings
        document.querySelectorAll('.bot-setting-toggle').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.updateBotSettings({
                    [e.target.dataset.setting]: e.target.checked
                });
            });
        });

        // Language selector
        document.getElementById('language-select')?.addEventListener('change', (e) => {
            this.updateLanguage(e.target.value);
        });

        // Save settings button
        document.getElementById('save-settings')?.addEventListener('click', () => {
            this.saveAllSettings();
        });

        // Reset settings button
        document.getElementById('reset-settings')?.addEventListener('click', () => {
            this.resetSettings();
        });

        // Export/Import buttons
        document.getElementById('export-settings')?.addEventListener('click', () => {
            this.exportSettings();
        });

        document.getElementById('import-settings')?.addEventListener('click', () => {
            this.importSettings();
        });
    }

    // Render settings UI
    renderSettings() {
        this.renderThemeSettings();
        this.renderNotificationSettings();
        this.renderBotSettings();
        this.renderLanguageSettings();
        this.updateSettingsForm();
    }

    // Render theme settings
    renderThemeSettings() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.checked = this.currentSettings.theme === 'dark';
        }

        document.body.setAttribute('data-theme', this.currentSettings.theme);
    }

    // Render notification settings
    renderNotificationSettings() {
        const notifications = this.currentSettings.notifications || {};
        
        Object.entries(notifications).forEach(([type, enabled]) => {
            const toggle = document.querySelector(`.notification-toggle[data-type="${type}"]`);
            if (toggle) {
                toggle.checked = enabled;
            }
        });
    }

    // Render bot settings
    renderBotSettings() {
        const botSettings = this.currentSettings.botSettings || {};
        
        Object.entries(botSettings).forEach(([setting, enabled]) => {
            const toggle = document.querySelector(`.bot-setting-toggle[data-setting="${setting}"]`);
            if (toggle) {
                toggle.checked = enabled;
                toggle.disabled = !this.isFeatureAvailable(setting);
            }
        });
    }

    // Render language settings
    renderLanguageSettings() {
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.value = this.currentSettings.language || 'en';
        }
    }

    // Update theme
    async updateTheme(theme) {
        try {
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    settings: {
                        theme
                    }
                })
            });

            const data = await response.json();
            if (data.success) {
                this.currentSettings.theme = theme;
                document.body.setAttribute('data-theme', theme);
                this.showSuccess('Theme updated successfully');
            }
        } catch (error) {
            console.error('Failed to update theme:', error);
            this.showError('Failed to update theme');
        }
    }

    // Update notification settings
    async updateNotificationSettings(settings) {
        try {
            const response = await fetch('/api/settings/notifications', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    notifications: settings
                })
            });

            const data = await response.json();
            if (data.success) {
                this.currentSettings.notifications = {
                    ...this.currentSettings.notifications,
                    ...settings
                };
                this.showSuccess('Notification settings updated');
            }
        } catch (error) {
            console.error('Failed to update notification settings:', error);
            this.showError('Failed to update notification settings');
        }
    }

    // Update bot settings
    async updateBotSettings(settings) {
        try {
            const response = await fetch('/api/settings/bot', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    botSettings: settings
                })
            });

            const data = await response.json();
            if (data.success) {
                this.currentSettings.botSettings = {
                    ...this.currentSettings.botSettings,
                    ...settings
                };
                this.showSuccess('Bot settings updated');
            }
        } catch (error) {
            console.error('Failed to update bot settings:', error);
            this.showError('Failed to update bot settings');
        }
    }

    // Update language
    async updateLanguage(language) {
        try {
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    settings: {
                        language
                    }
                })
            });

            const data = await response.json();
            if (data.success) {
                this.currentSettings.language = language;
                this.showSuccess('Language updated successfully');
                // Reload page to apply language changes
                setTimeout(() => window.location.reload(), 1000);
            }
        } catch (error) {
            console.error('Failed to update language:', error);
            this.showError('Failed to update language');
        }
    }

    // Save all settings
    async saveAllSettings() {
        try {
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    settings: this.currentSettings
                })
            });

            const data = await response.json();
            if (data.success) {
                this.showSuccess('All settings saved successfully');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showError('Failed to save settings');
        }
    }

    // Reset settings
    async resetSettings() {
        try {
            const response = await fetch('/api/settings/reset', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.currentSettings = data.settings;
                this.renderSettings();
                this.showSuccess('Settings reset to default');
            }
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.showError('Failed to reset settings');
        }
    }

    // Export settings
    async exportSettings() {
        try {
            const response = await fetch('/api/settings/export', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                const blob = new Blob([JSON.stringify(data.settings, null, 2)], {
                    type: 'application/json'
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'settings.json';
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Failed to export settings:', error);
            this.showError('Failed to export settings');
        }
    }

    // Import settings
    async importSettings() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                
                reader.onload = async (event) => {
                    try {
                        const settings = JSON.parse(event.target.result);
                        
                        const response = await fetch('/api/settings/import', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                            },
                            body: JSON.stringify({ settings })
                        });

                        const data = await response.json();
                        if (data.success) {
                            this.currentSettings = data.settings;
                            this.renderSettings();
                            this.showSuccess('Settings imported successfully');
                        }
                    } catch (error) {
                        this.showError('Invalid settings file');
                    }
                };
                
                reader.readAsText(file);
            };
            
            input.click();
        } catch (error) {
            console.error('Failed to import settings:', error);
            this.showError('Failed to import settings');
        }
    }

    // Check if feature is available in current subscription
    isFeatureAvailable(feature) {
        // Implementation depends on subscription service
        return true; // Placeholder
    }

    // Show success message
    showSuccess(message) {
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Show error message
    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'toast error';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Initialize settings manager
window.settingsManager = new SettingsManager();
