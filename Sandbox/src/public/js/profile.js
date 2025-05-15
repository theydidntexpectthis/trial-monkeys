class ProfileManager {
    constructor() {
        this.userDetails = null;
        this.subscriptionDetails = null;
        this.activityHistory = [];
        this.connectedServices = new Map();
        
        this.initializeProfile();
        this.initializeEventListeners();
    }

    // Initialize profile data
    async initializeProfile() {
        try {
            await Promise.all([
                this.loadUserDetails(),
                this.loadSubscriptionDetails(),
                this.loadActivityHistory(),
                this.loadConnectedServices()
            ]);

            this.updateUI();
        } catch (error) {
            console.error('Failed to initialize profile:', error);
            this.showToast('Failed to load profile data', 'error');
        }
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Profile image upload
        const profileImage = document.getElementById('profile-image');
        if (profileImage) {
            profileImage.addEventListener('click', () => {
                document.createElement('input').type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => this.handleProfileImageUpload(e.target.files[0]);
                input.click();
            });
        }

        // Two-factor authentication toggle
        const twoFAToggle = document.getElementById('2fa-toggle');
        if (twoFAToggle) {
            twoFAToggle.addEventListener('change', (e) => this.handle2FAToggle(e.target.checked));
        }

        // Form submissions
        document.getElementById('profile-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        document.getElementById('password-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });
    }

    // Load user details
    async loadUserDetails() {
        try {
            const response = await fetch('/api/users/profile', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.userDetails = data.user;
            }
        } catch (error) {
            console.error('Failed to load user details:', error);
            throw error;
        }
    }

    // Load subscription details
    async loadSubscriptionDetails() {
        try {
            const response = await fetch('/api/subscription/details', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.subscriptionDetails = data.subscription;
            }
        } catch (error) {
            console.error('Failed to load subscription details:', error);
            throw error;
        }
    }

    // Load activity history
    async loadActivityHistory() {
        try {
            const response = await fetch('/api/users/activity', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.activityHistory = data.activity;
            }
        } catch (error) {
            console.error('Failed to load activity history:', error);
            throw error;
        }
    }

    // Load connected services
    async loadConnectedServices() {
        try {
            const response = await fetch('/api/users/services', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.connectedServices = new Map(data.services.map(s => [s.id, s]));
            }
        } catch (error) {
            console.error('Failed to load connected services:', error);
            throw error;
        }
    }

    // Update UI with loaded data
    updateUI() {
        // Update profile information
        if (this.userDetails) {
            document.getElementById('user-name').textContent = this.userDetails.name;
            document.getElementById('user-email').textContent = this.userDetails.email;
            document.getElementById('profile-image').src = this.userDetails.avatar || 'assets/default-avatar.png';
        }

        // Update subscription information
        if (this.subscriptionDetails) {
            document.getElementById('subscription-tier').textContent = this.subscriptionDetails.plan;
            document.getElementById('current-plan').textContent = this.subscriptionDetails.plan;
            document.getElementById('subscription-expiry').textContent = new Date(this.subscriptionDetails.endDate).toLocaleDateString();

            // Update usage bars
            this.updateUsageBars();
        }

        // Update activity timeline
        this.updateActivityTimeline();

        // Update connected services
        this.updateConnectedServices();

        // Update statistics
        this.updateStatistics();
    }

    // Update usage bars
    updateUsageBars() {
        const usage = this.subscriptionDetails.usage;
        const limits = this.subscriptionDetails.limits;

        // Update trial usage
        const trialProgress = (usage.activeTrials / limits.maxTrials) * 100;
        document.querySelector('.usage-progress').style.width = `${trialProgress}%`;
        document.querySelector('.usage-text').textContent = `${usage.activeTrials}/${limits.maxTrials}`;

        // Update concurrent bots
        const botProgress = (usage.concurrentBots / limits.maxConcurrentBots) * 100;
        document.querySelectorAll('.usage-progress')[1].style.width = `${botProgress}%`;
        document.querySelectorAll('.usage-text')[1].textContent = `${usage.concurrentBots}/${limits.maxConcurrentBots}`;
    }

    // Update activity timeline
    updateActivityTimeline() {
        const container = document.getElementById('activity-timeline');
        if (!container) return;

        container.innerHTML = this.activityHistory.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${this.getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-message">${activity.message}</div>
                    <div class="activity-time">${this.formatTime(activity.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    // Update connected services
    updateConnectedServices() {
        const container = document.getElementById('connected-services');
        if (!container) return;

        container.innerHTML = Array.from(this.connectedServices.values()).map(service => `
            <div class="service-card">
                <img src="${service.icon}" alt="${service.name}" class="service-icon">
                <div class="service-info">
                    <h3>${service.name}</h3>
                    <p>${service.status}</p>
                </div>
                <button class="btn-secondary btn-sm" onclick="profileManager.disconnectService('${service.id}')">
                    Disconnect
                </button>
            </div>
        `).join('');
    }

    // Update statistics
    updateStatistics() {
        if (this.userDetails?.statistics) {
            const stats = this.userDetails.statistics;
            document.getElementById('total-trials').textContent = stats.totalTrials;
            document.getElementById('success-rate').textContent = `${stats.successRate}%`;
            document.getElementById('active-days').textContent = stats.activeDays;
            document.getElementById('total-time').textContent = this.formatDuration(stats.totalTime);
        }
    }

    // Handle profile image upload
    async handleProfileImageUpload(file) {
        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await fetch('/api/users/avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                document.getElementById('profile-image').src = data.avatarUrl;
                this.showToast('Profile image updated successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to upload profile image:', error);
            this.showToast('Failed to upload profile image', 'error');
        }
    }

    // Handle 2FA toggle
    async handle2FAToggle(enabled) {
        try {
            const response = await fetch('/api/users/2fa', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ enabled })
            });

            const data = await response.json();
            if (data.success) {
                this.showToast(`Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`, 'success');
                if (enabled && data.qrCode) {
                    this.show2FASetupModal(data.qrCode);
                }
            }
        } catch (error) {
            console.error('Failed to update 2FA settings:', error);
            this.showToast('Failed to update 2FA settings', 'error');
        }
    }

    // Save profile changes
    async saveProfile() {
        try {
            const updates = {
                name: document.getElementById('edit-name').value,
                email: document.getElementById('edit-email').value,
                timezone: document.getElementById('edit-timezone').value
            };

            const response = await fetch('/api/users/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(updates)
            });

            const data = await response.json();
            if (data.success) {
                this.userDetails = data.user;
                this.updateUI();
                this.showToast('Profile updated successfully', 'success');
                this.closeEditProfileModal();
            }
        } catch (error) {
            console.error('Failed to save profile:', error);
            this.showToast('Failed to save profile changes', 'error');
        }
    }

    // Change password
    async changePassword() {
        try {
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword !== confirmPassword) {
                this.showToast('New passwords do not match', 'error');
                return;
            }

            const response = await fetch('/api/users/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();
            if (data.success) {
                this.showToast('Password changed successfully', 'success');
                this.closeSecurityModal();
            }
        } catch (error) {
            console.error('Failed to change password:', error);
            this.showToast('Failed to change password', 'error');
        }
    }

    // Helper methods
    getActivityIcon(type) {
        const icons = {
            login: 'fa-sign-in-alt',
            trial: 'fa-robot',
            subscription: 'fa-credit-card',
            security: 'fa-shield-alt'
        };
        return icons[type] || 'fa-info-circle';
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        return `${hours}h`;
    }

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

    // Modal management
    showEditProfileModal() {
        const modal = document.getElementById('edit-profile-modal');
        if (modal) {
            document.getElementById('edit-name').value = this.userDetails.name;
            document.getElementById('edit-email').value = this.userDetails.email;
            document.getElementById('edit-timezone').value = this.userDetails.timezone;
            modal.classList.add('show');
        }
    }

    closeEditProfileModal() {
        const modal = document.getElementById('edit-profile-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    showSecurityModal() {
        const modal = document.getElementById('security-modal');
        if (modal) {
            document.getElementById('2fa-toggle').checked = this.userDetails.twoFactorEnabled;
            modal.classList.add('show');
        }
    }

    closeSecurityModal() {
        const modal = document.getElementById('security-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
}

// Initialize profile manager
const profileManager = new ProfileManager();
