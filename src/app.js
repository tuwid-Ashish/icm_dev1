/**
 * CEP Online Mock Test Platform - Application Router & Entry Point
 */

import { AdminModule } from './admin/adminModule.js';
import { StudentModule } from './student/studentModule.js';
import { storage } from './core/storage.js';

class App {
    constructor() {
        this.adminModule = new AdminModule();
        this.studentModule = new StudentModule();
        this.currentTab = 'student'; // 'student' | 'admin'
    }

    init() {
        this.bindNavigation();
        this.bindAuthModal();
        this.updateUserBadge();
        this.renderCurrentView();
    }

    bindNavigation() {
        const tabBtns = document.querySelectorAll('.nav-tabs .tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.dataset.tab;
                if (targetTab && targetTab !== this.currentTab) {
                    this.currentTab = targetTab;

                    tabBtns.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');

                    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
                    const targetSec = document.getElementById(`${targetTab}-view`);
                    if (targetSec) targetSec.classList.add('active');

                    this.renderCurrentView();
                }
            });
        });
    }

    updateUserBadge() {
        const user = storage.getCurrentUser();
        const nameEl = document.getElementById('nav-user-name');
        const metaEl = document.getElementById('nav-user-meta');
        const roleEl = document.getElementById('nav-user-role');

        if (user) {
            if (nameEl) nameEl.innerText = user.name || 'User';
            if (metaEl) metaEl.innerText = user.role === 'admin' ? 'System Administrator' : `${user.enrollmentId || 'SIGMA-2026'}`;
            if (roleEl) {
                roleEl.innerText = user.role.toUpperCase();
                if (user.role === 'admin') roleEl.classList.add('admin');
                else roleEl.classList.remove('admin');
            }
        }
    }

    bindAuthModal() {
        const switchBtn = document.getElementById('btn-account-switch');
        const authModal = document.getElementById('auth-modal');
        const closeBtn = document.getElementById('auth-modal-close');
        const form = document.getElementById('auth-form');

        const stdTab = document.getElementById('auth-tab-student');
        const adminTab = document.getElementById('auth-tab-admin');
        const roleInput = document.getElementById('auth-role');
        const emailInput = document.getElementById('auth-email');
        const passInput = document.getElementById('auth-password');

        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                authModal.style.display = 'flex';
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                authModal.style.display = 'none';
            });
        }

        if (stdTab && adminTab) {
            stdTab.addEventListener('click', () => {
                stdTab.className = 'btn btn-primary';
                adminTab.className = 'btn btn-secondary';
                roleInput.value = 'student';
                emailInput.value = 'student@sigma.com';
                passInput.value = 'pass123';
            });

            adminTab.addEventListener('click', () => {
                adminTab.className = 'btn btn-primary';
                stdTab.className = 'btn btn-secondary';
                roleInput.value = 'admin';
                emailInput.value = 'admin@sigma.com';
                passInput.value = 'admin123';
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = emailInput.value.trim();
                const pass = passInput.value.trim();
                const role = roleInput.value;

                const res = storage.login(email, pass, role);
                if (res.success) {
                    authModal.style.display = 'none';
                    this.updateUserBadge();
                    if (role === 'admin') {
                        this.switchTab('admin');
                    } else {
                        this.switchTab('student');
                    }
                } else {
                    alert(res.message || 'Login failed.');
                }
            });
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll('.nav-tabs .tab-btn').forEach(b => {
            if (b.dataset.tab === tabName) b.classList.add('active');
            else b.classList.remove('active');
        });
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        const targetSec = document.getElementById(`${tabName}-view`);
        if (targetSec) targetSec.classList.add('active');

        this.renderCurrentView();
    }

    renderCurrentView() {
        if (this.currentTab === 'admin') {
            this.adminModule.render();
        } else if (this.currentTab === 'student') {
            this.studentModule.render();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
