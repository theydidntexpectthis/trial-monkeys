class QuickSettings {
    constructor() {
        this.panel = document.getElementById('quick-settings-panel');
        this.themeToggle = document.getElementById('quick-theme-toggle');
        this.notificationsToggle = document.getElementById('quick-notifications');
        this.retrySelect = document.getElementById('quick-retry-setting');
        this.closeButton = document.querySelector('.quick-settings .close-btn');
        
        this.initializeSettings();
        this.setupEventListeners();
    }

    // Initialize settings from localStorage
    initializeSettings() {
        // Theme
        const currentTheme = localStorage.getItem('theme') || 'light';
        this.themeToggle.checked = currentTheme === 'dark';
        document.body.setAttribute('data-theme', currentTheme);

        // Notifications
        const notifications = localStorage.getItem('notifications') === 'true';
        this.notificationsToggle.checked = notifications;

        // Auto-retry
        const retrySettings = localStorage.getItem('autoRetry') || 'off';
        this.retrySelect.value = retrySettings;
    }

    // Setup event listeners
    setupEventListeners() {
        // Theme toggle
        this.themeToggle.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            this.notifySettingChange('theme', theme);
        });

        // Notifications toggle
        this.notificationsToggle.addEventListener('change', (e) => {
            localStorage.setItem('notifications', e.target.checked);
            this.notifySettingChange('notifications', e.target.checked);
            
            if (e.target.checked) {
                this.requestNotificationPermission();
            }
        });

        // Auto-retry select
        this.retrySelect.addEventListener('change', (e) => {
            localStorage.setItem('autoRetry', e.target.value);
            this.notifySettingChange('autoRetry', e.target.value);
        });

        // Close button
        this.closeButton.addEventListener('click', () => {
            this.hidePanel();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && 
                !e.target.matches('[onclick="toggleQuickSettings()"]')) {
                this.hidePanel();
            }
        });
    }

    // Show settings panel
    showPanel() {
        this.panel.classList.add('show');
        this.panel.classList.add('slide-in');
    }

    // Hide settings panel
    hidePanel() {
        this.panel.classList.remove('show');
    }

    // Request notification permission
    async requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                this.notificationsToggle.checked = false;
                localStorage.setItem('notifications', false);
                this.showToast('Notification permission denied', 'error');
            }
        } catch (error) {
            console.error('Failed to request notification permission:', error);
            this.showToast('Failed to enable notifications', 'error');
        }
    }

    // Notify setting change
    notifySettingChange(setting, value) {
        // Dispatch custom event
        const event = new CustomEvent('settingChanged', {
            detail: { setting, value }
        });
        document.dispatchEvent(event);

        // Show toast notification
        this.showToast(`${setting} updated successfully`, 'success');
    }

    // Show toast notification
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

    // Get current settings
    getSettings() {
        return {
            theme: localStorage.getItem('theme') || 'light',
            notifications: localStorage.getItem('notifications') === 'true',
            autoRetry: localStorage.getItem('autoRetry') || 'off'
        };
    }

    // Apply settings
    applySettings(settings) {
        // Theme
        if (settings.theme) {
            this.themeToggle.checked = settings.theme === 'dark';
            document.body.setAttribute('data-theme', settings.theme);
            localStorage.setItem('theme', settings.theme);
        }

        // Notifications
        if (typeof settings.notifications !== 'undefined') {
            this.notificationsToggle.checked = settings.notifications;
            localStorage.setItem('notifications', settings.notifications);
        }

        // Auto-retry
        if (settings.autoRetry) {
            this.retrySelect.value = settings.autoRetry;
            localStorage.setItem('autoRetry', settings.autoRetry);
        }
    }

    // Reset settings to default
    resetSettings() {
        const defaultSettings = {
            theme: 'light',
            notifications: false,
            autoRetry: 'off'
        };

        this.applySettings(defaultSettings);
        this.showToast('Settings reset to default', 'info');
    }
}

// Initialize quick settings
window.quickSettings = new QuickSettings();

// Global toggle function
window.toggleQuickSettings = () => {
    const panel = document.getElementById('quick-settings-panel');
    if (panel.classList.contains('show')) {
        window.quickSettings.hidePanel();
    } else {
        window.quickSettings.showPanel();
    }
};
