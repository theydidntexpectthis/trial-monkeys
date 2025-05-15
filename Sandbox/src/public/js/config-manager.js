class ConfigManager {
    constructor() {
        this.currentEnv = 'development';
        this.config = new Map();
        this.featureFlags = new Map();
        this.hasUnsavedChanges = false;

        this.initializeEventListeners();
        this.loadConfigurations();
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Environment selection
        document.querySelectorAll('.env-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchEnvironment(btn.dataset.env));
        });

        // Config changes
        document.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', () => {
                this.hasUnsavedChanges = true;
                this.updateSaveButton();
            });
        });

        // Window unload warning
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        // Range input for rollout percentage
        const rolloutInput = document.getElementById('rollout-percentage');
        if (rolloutInput) {
            rolloutInput.addEventListener('input', (e) => {
                document.getElementById('rollout-value').textContent = `${e.target.value}%`;
            });
        }
    }

    // Load configurations
    async loadConfigurations() {
        try {
            // Load config for current environment
            const configResponse = await fetch(`/api/config?env=${this.currentEnv}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const configData = await configResponse.json();
            if (configData.success) {
                this.config.set(this.currentEnv, configData.config);
                this.updateConfigUI();
            }

            // Load feature flags
            const flagsResponse = await fetch('/api/features', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const flagsData = await flagsResponse.json();
            if (flagsData.success) {
                this.featureFlags = new Map(Object.entries(flagsData.flags));
                this.renderFeatureFlags();
            }
        } catch (error) {
            console.error('Failed to load configurations:', error);
            this.showToast('Failed to load configurations', 'error');
        }
    }

    // Switch environment
    async switchEnvironment(env) {
        if (this.hasUnsavedChanges) {
            if (!confirm('You have unsaved changes. Continue without saving?')) {
                return;
            }
        }

        this.currentEnv = env;
        
        // Update UI
        document.querySelectorAll('.env-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.env === env);
        });

        await this.loadConfigurations();
    }

    // Update config UI
    updateConfigUI() {
        const config = this.config.get(this.currentEnv);
        if (!config) return;

        // Update debug settings
        document.getElementById('debug-mode').checked = config.debugMode;
        document.getElementById('log-level').value = config.logLevel;
        document.getElementById('mock-services').checked = config.mockServices;

        // Update timeouts
        document.getElementById('api-timeout').value = config.timeouts.api;
        document.getElementById('bot-timeout').value = config.timeouts.bot;
        document.getElementById('proxy-timeout').value = config.timeouts.proxy;
    }

    // Render feature flags
    renderFeatureFlags() {
        const container = document.getElementById('feature-flags-container');
        if (!container) return;

        container.innerHTML = '';
        const template = document.getElementById('feature-flag-template');

        this.featureFlags.forEach((flag, name) => {
            const card = template.content.cloneNode(true);
            
            // Set flag name and description
            card.querySelector('.flag-name').textContent = name;
            card.querySelector('.flag-description').textContent = flag.description;

            // Set enabled state
            card.querySelector('.flag-enabled').checked = flag.enabled;

            // Add environments
            const envContainer = card.querySelector('.flag-environments');
            flag.environments.forEach(env => {
                const tag = document.createElement('span');
                tag.className = `env-tag ${env}`;
                tag.textContent = env;
                envContainer.appendChild(tag);
            });

            // Set rollout percentage
            const progress = card.querySelector('.rollout-progress');
            progress.style.width = `${flag.rolloutPercentage}%`;
            card.querySelector('.rollout-percentage').textContent = `${flag.rolloutPercentage}%`;

            container.appendChild(card);
        });
    }

    // Save configuration changes
    async saveConfig() {
        try {
            const config = {
                debugMode: document.getElementById('debug-mode').checked,
                logLevel: document.getElementById('log-level').value,
                mockServices: document.getElementById('mock-services').checked,
                timeouts: {
                    api: parseInt(document.getElementById('api-timeout').value),
                    bot: parseInt(document.getElementById('bot-timeout').value),
                    proxy: parseInt(document.getElementById('proxy-timeout').value)
                }
            };

            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    env: this.currentEnv,
                    updates: config
                })
            });

            const data = await response.json();
            if (data.success) {
                this.hasUnsavedChanges = false;
                this.updateSaveButton();
                this.showToast('Configuration saved successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to save configuration:', error);
            this.showToast('Failed to save configuration', 'error');
        }
    }

    // Create new feature flag
    async createFeatureFlag() {
        try {
            const name = document.getElementById('feature-name').value;
            const config = {
                enabled: document.getElementById('feature-enabled').checked,
                description: document.getElementById('feature-description').value,
                environments: Array.from(document.querySelectorAll('.checkbox-group input:checked'))
                    .map(input => input.value),
                rolloutPercentage: parseInt(document.getElementById('rollout-percentage').value)
            };

            const response = await fetch('/api/features', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    featureName: name,
                    config
                })
            });

            const data = await response.json();
            if (data.success) {
                this.closeNewFeatureModal();
                await this.loadConfigurations();
                this.showToast('Feature flag created successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to create feature flag:', error);
            this.showToast('Failed to create feature flag', 'error');
        }
    }

    // Update feature flag
    async updateFeatureFlag(name, updates) {
        try {
            const response = await fetch(`/api/features/${name}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(updates)
            });

            const data = await response.json();
            if (data.success) {
                await this.loadConfigurations();
                this.showToast('Feature flag updated successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to update feature flag:', error);
            this.showToast('Failed to update feature flag', 'error');
        }
    }

    // Delete feature flag
    async deleteFeatureFlag(element) {
        const name = element.closest('.feature-flag-card').querySelector('.flag-name').textContent;
        
        if (!confirm(`Are you sure you want to delete the feature flag "${name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/features/${name}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                await this.loadConfigurations();
                this.showToast('Feature flag deleted successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to delete feature flag:', error);
            this.showToast('Failed to delete feature flag', 'error');
        }
    }

    // Export configuration
    async exportConfig() {
        try {
            const format = 'json'; // or 'yaml'
            const response = await fetch(`/api/config/export?format=${format}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `config-export.${format}`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export configuration:', error);
            this.showToast('Failed to export configuration', 'error');
        }
    }

    // UI Helpers
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    updateSaveButton() {
        const saveBtn = document.querySelector('.btn-primary');
        if (saveBtn) {
            saveBtn.disabled = !this.hasUnsavedChanges;
        }
    }

    // Modal management
    showNewFeatureModal() {
        const modal = document.getElementById('new-feature-modal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    closeNewFeatureModal() {
        const modal = document.getElementById('new-feature-modal');
        if (modal) {
            modal.classList.remove('show');
            document.getElementById('new-feature-form').reset();
        }
    }
}

// Initialize config manager
const configManager = new ConfigManager();

// Export for global access
window.configManager = configManager;
