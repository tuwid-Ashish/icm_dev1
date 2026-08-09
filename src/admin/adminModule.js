/**
 * CEP Online Mock Test Platform - Admin Module
 * Handles Student Management, Question Bank CRUD & Bulk Upload, Exam Blueprint Configurations, and Reports.
 */

import { storage } from '../core/storage.js';

export class AdminModule {
    constructor() {
        this.activeTab = 'dashboard'; // 'dashboard' | 'students' | 'questions' | 'exams' | 'analytics'
        this.searchQuery = '';
        this.batchFilter = 'ALL';
    }

    render() {
        const container = document.getElementById('admin-view');
        if (!container) return;

        container.innerHTML = `
            <div class="admin-wrapper">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">⚙️ Admin Control Panel</h1>
                        <p class="page-subtitle">Manage student access limits, question bank, exam configurations, and system metrics.</p>
                    </div>
                    <div class="admin-actions">
                        <button class="btn btn-secondary btn-sm" id="btn-theme-toggle">🌓 Theme Toggle</button>
                    </div>
                </div>

                <!-- Admin Sub Navigation Tabs -->
                <div class="nav-tabs" style="margin-bottom: 1.5rem; justify-content: flex-start; overflow-x: auto;">
                    <button class="tab-btn ${this.activeTab === 'dashboard' ? 'active' : ''}" data-admin-tab="dashboard">📊 Dashboard</button>
                    <button class="tab-btn ${this.activeTab === 'students' ? 'active' : ''}" data-admin-tab="students">👥 Student Management</button>
                    <button class="tab-btn ${this.activeTab === 'questions' ? 'active' : ''}" data-admin-tab="questions">📚 Question Bank</button>
                    <button class="tab-btn ${this.activeTab === 'exams' ? 'active' : ''}" data-admin-tab="exams">🎯 Exam Configurations</button>
                    <button class="tab-btn ${this.activeTab === 'analytics' ? 'active' : ''}" data-admin-tab="analytics">📈 System Reports</button>
                </div>

                <div id="admin-tab-content">
                    ${this.renderTabContent()}
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderTabContent() {
        switch (this.activeTab) {
            case 'dashboard': return this.renderDashboard();
            case 'students': return this.renderStudentManagement();
            case 'questions': return this.renderQuestionBank();
            case 'exams': return this.renderExamConfig();
            case 'analytics': return this.renderAnalytics();
            default: return this.renderDashboard();
        }
    }

    // --- 1. DASHBOARD VIEW ---
    renderDashboard() {
        const students = storage.getStudents();
        const questions = storage.getQuestions();
        const submissions = storage.getSubmissions();
        const exams = storage.getExams();

        const activeStudents = students.filter(s => s.status === 'active').length;
        const totalAttempts = submissions.length;

        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Total Students</span>
                        <div class="stat-icon">👥</div>
                    </div>
                    <div class="stat-value">${students.length}</div>
                    <div class="stat-footer">${activeStudents} Active Accounts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Question Bank</span>
                        <div class="stat-icon">📚</div>
                    </div>
                    <div class="stat-value">${questions.length}</div>
                    <div class="stat-footer">Across ${exams.length} Exam Patterns</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Tests Attempted</span>
                        <div class="stat-icon">📝</div>
                    </div>
                    <div class="stat-value">${totalAttempts}</div>
                    <div class="stat-footer">Evaluated Mock Sessions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Active Exams</span>
                        <div class="stat-icon">🎯</div>
                    </div>
                    <div class="stat-value">${exams.length}</div>
                    <div class="stat-footer">Police Bharti, Vanrakshak, SSC GD</div>
                </div>
            </div>

            <div class="content-grid">
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">👥 Student Practice Test Balance Overview</h3>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Enrollment ID</th>
                                    <th>Status</th>
                                    <th>Allowed</th>
                                    <th>Completed</th>
                                    <th>Remaining</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${students.slice(0, 5).map(s => `
                                    <tr>
                                        <td><strong>${s.name}</strong><br><small style="color:var(--text-muted)">${s.email}</small></td>
                                        <td><code>${s.enrollmentId || 'N/A'}</code></td>
                                        <td>
                                            <span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}">
                                                ${s.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>${s.allowedTests}</td>
                                        <td>${s.completedTests}</td>
                                        <td><strong style="color:${s.remainingTests > 0 ? 'var(--success)' : 'var(--danger)'}">${s.remainingTests}</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">⚡ Quick Admin Actions</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <button class="btn btn-primary" id="btn-add-student-quick">+ Register New Student</button>
                        <button class="btn btn-gradient" id="btn-bulk-upload-quick">📥 Bulk Upload Questions (CSV)</button>
                        <button class="btn btn-secondary" id="btn-add-question-quick">+ Add Single Question</button>
                    </div>
                </div>
            </div>
        `;
    }

    // --- 2. STUDENT MANAGEMENT ---
    renderStudentManagement() {
        const students = storage.getStudents();

        return `
            <div class="panel">
                <div class="panel-header">
                    <div>
                        <h3 class="panel-title">Student Accounts & Practice Test Limits</h3>
                        <p class="page-subtitle">Set allowed test counts, enable/disable access, or edit student details.</p>
                    </div>
                    <button class="btn btn-primary" id="btn-create-student-modal">+ Create Student Account</button>
                </div>

                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name & Email</th>
                                <th>Enrollment ID</th>
                                <th>Allowed Tests</th>
                                <th>Completed</th>
                                <th>Remaining Balance</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(s => `
                                <tr>
                                    <td>
                                        <strong>${s.name}</strong><br>
                                        <small style="color:var(--text-muted)">${s.email}</small>
                                    </td>
                                    <td><code>${s.enrollmentId || 'SIGMA-2026'}</code></td>
                                    <td><strong>${s.allowedTests}</strong></td>
                                    <td>${s.completedTests}</td>
                                    <td>
                                        <span class="badge ${s.remainingTests > 0 ? 'badge-success' : 'badge-danger'}">
                                            ${s.remainingTests} Left
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}">
                                            ${s.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm edit-student-btn" data-id="${s.id}">Edit / Set Limit</button>
                                        <button class="btn ${s.status === 'active' ? 'btn-danger' : 'btn-success'} btn-sm toggle-status-btn" data-id="${s.id}">
                                            ${s.status === 'active' ? 'Disable' : 'Enable'}
                                        </button>
                                        <button class="btn btn-danger btn-sm delete-student-btn" data-id="${s.id}" style="padding:0.3rem 0.6rem;">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // --- 3. QUESTION BANK MANAGEMENT ---
    renderQuestionBank() {
        const questions = storage.getQuestions();
        const exams = storage.getExams();

        let filtered = questions;
        if (this.batchFilter !== 'ALL') {
            filtered = filtered.filter(q => q.batch === this.batchFilter || q.batch.toLowerCase().includes(this.batchFilter.toLowerCase()));
        }
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                item.text.toLowerCase().includes(q) || 
                item.subject.toLowerCase().includes(q) ||
                item.id.toLowerCase().includes(q)
            );
        }

        return `
            <div class="panel">
                <div class="panel-header" style="flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h3 class="panel-title">Centralized Question Bank (${filtered.length} Questions)</h3>
                        <p class="page-subtitle">Source database for randomized CBT mock test generation.</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-gradient" id="btn-open-bulk-modal">📥 Bulk Upload CSV</button>
                        <button class="btn btn-primary" id="btn-open-add-q-modal">+ Add New Question</button>
                    </div>
                </div>

                <!-- Filters Bar -->
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                    <input type="text" class="form-control" id="q-search-input" placeholder="🔍 Search question text, ID or subject..." value="${this.searchQuery}" style="max-width: 350px;">
                    <select class="form-control" id="q-batch-filter" style="max-width: 220px;">
                        <option value="ALL">All Exams / Batches</option>
                        <option value="Police Bharti" ${this.batchFilter === 'Police Bharti' ? 'selected' : ''}>Police Bharti</option>
                        <option value="Vanrakshak" ${this.batchFilter === 'Vanrakshak' ? 'selected' : ''}>Vanrakshak (Forest Guard)</option>
                        <option value="SSC GD" ${this.batchFilter === 'SSC GD' ? 'selected' : ''}>SSC GD Constable</option>
                    </select>
                </div>

                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Q.ID</th>
                                <th>Batch / Exam</th>
                                <th>Subject</th>
                                <th>Question Text</th>
                                <th>Correct Ans</th>
                                <th>Marks</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.slice(0, 30).map(q => `
                                <tr>
                                    <td><code>${q.id}</code></td>
                                    <td><span class="badge badge-purple">${q.batch}</span></td>
                                    <td><strong>${q.subject}</strong></td>
                                    <td style="max-width: 380px;">${q.text}</td>
                                    <td><span class="badge badge-success">${q.options[q.correctIndex] || q.correctAnswerLetter}</span></td>
                                    <td><strong>${q.marks || 1} M</strong></td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm edit-q-btn" data-id="${q.id}">Edit</button>
                                        <button class="btn btn-danger btn-sm delete-q-btn" data-id="${q.id}">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // --- 4. EXAM PATTERN CONFIGURATION ---
    renderExamConfig() {
        const exams = storage.getExams();

        return `
            <div class="panel">
                <div class="panel-header">
                    <div>
                        <h3 class="panel-title">Exam Blueprint Configurations</h3>
                        <p class="page-subtitle">Defines the total questions, duration, negative marking, and subject distribution for generating test papers.</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                    ${exams.map(e => `
                        <div class="panel" style="background: var(--bg-primary); border: 1px solid var(--border-highlight);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                                <div>
                                    <span class="badge badge-purple">${e.code}</span>
                                    <h4 style="font-family:var(--font-heading); font-size:1.1rem; margin-top:0.3rem;">${e.name}</h4>
                                </div>
                            </div>
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">${e.description}</p>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem; background: var(--bg-secondary); padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                                <div>⏱️ Duration: <strong>${e.durationMinutes} mins</strong></div>
                                <div>🎯 Total Qs: <strong>${e.totalQuestions}</strong></div>
                                <div>💯 Total Marks: <strong>${e.totalMarks}</strong></div>
                                <div>⚠️ Negative: <strong>${e.negativeMarkingRate > 0 ? e.negativeMarkingRate + ' mark/Q' : 'None'}</strong></div>
                            </div>

                            <h5 style="font-size:0.85rem; font-weight:700; color:var(--text-muted); margin-bottom:0.5rem; text-transform:uppercase;">Subject Distribution</h5>
                            <ul style="list-style:none; font-size:0.85rem; margin-bottom:1rem;">
                                ${e.subjects.map(s => `
                                    <li style="display:flex; justify-content:space-between; padding:0.25rem 0; border-bottom:1px solid var(--border-color);">
                                        <span>• ${s.name}</span>
                                        <strong>${s.questionsCount} Qs (${s.questionsCount * s.marksPerQuestion} Marks)</strong>
                                    </li>
                                `).join('')}
                            </ul>

                            <button class="btn btn-secondary btn-sm edit-exam-btn" data-id="${e.id}" style="width:100%;">⚙️ Configure Blueprint</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // --- 5. SYSTEM REPORTS ---
    renderAnalytics() {
        const submissions = storage.getSubmissions();
        const students = storage.getStudents();

        return `
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">📈 System-Wide Exam Evaluation Reports</h3>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Submission ID</th>
                                <th>Student</th>
                                <th>Exam</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Accuracy</th>
                                <th>Submitted At</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${submissions.length === 0 ? `<tr><td colspan="7" style="text-align:center;">No mock test submissions logged yet.</td></tr>` : ''}
                            ${submissions.map(sub => `
                                <tr>
                                    <td><code>${sub.id}</code></td>
                                    <td><strong>${sub.studentName}</strong></td>
                                    <td><span class="badge badge-purple">${sub.examCode || sub.examName}</span></td>
                                    <td><strong>${sub.finalScore} / ${sub.totalMarks}</strong></td>
                                    <td><span class="badge ${sub.passed ? 'badge-success' : 'badge-danger'}">${sub.percentage}%</span></td>
                                    <td>${sub.accuracy}%</td>
                                    <td><small>${new Date(sub.submittedAt).toLocaleString()}</small></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // --- EVENT BINDINGS & MODALS ---
    bindEvents() {
        // Admin Tab switching
        document.querySelectorAll('[data-admin-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.activeTab = e.currentTarget.dataset.adminTab;
                this.render();
            });
        });

        // Theme toggle
        const themeBtn = document.getElementById('btn-theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                document.body.classList.toggle('light-theme');
            });
        }

        // Search & Filter in Question Bank
        const searchInput = document.getElementById('q-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.render();
            });
        }

        const batchFilter = document.getElementById('q-batch-filter');
        if (batchFilter) {
            batchFilter.addEventListener('change', (e) => {
                this.batchFilter = e.target.value;
                this.render();
            });
        }

        // Quick Action Triggers
        const createStdQuick = document.getElementById('btn-add-student-quick');
        if (createStdQuick) createStdQuick.addEventListener('click', () => this.showStudentModal());

        const createStdModalBtn = document.getElementById('btn-create-student-modal');
        if (createStdModalBtn) createStdModalBtn.addEventListener('click', () => this.showStudentModal());

        const bulkUploadBtn = document.getElementById('btn-bulk-upload-quick');
        if (bulkUploadBtn) bulkUploadBtn.addEventListener('click', () => this.showBulkUploadModal());

        const openBulkModalBtn = document.getElementById('btn-open-bulk-modal');
        if (openBulkModalBtn) openBulkModalBtn.addEventListener('click', () => this.showBulkUploadModal());

        const addQQuick = document.getElementById('btn-add-question-quick');
        if (addQQuick) addQQuick.addEventListener('click', () => this.showQuestionModal());

        const openAddQBtn = document.getElementById('btn-open-add-q-modal');
        if (openAddQBtn) openAddQBtn.addEventListener('click', () => this.showQuestionModal());

        // Table Action Delegations
        document.querySelectorAll('.edit-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const std = storage.getStudentById(e.currentTarget.dataset.id);
                if (std) this.showStudentModal(std);
            });
        });

        document.querySelectorAll('.toggle-status-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const std = storage.getStudentById(e.currentTarget.dataset.id);
                if (std) {
                    storage.saveStudent({ id: std.id, status: std.status === 'active' ? 'disabled' : 'active' });
                    this.render();
                }
            });
        });

        document.querySelectorAll('.delete-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('Are you sure you want to delete this student account?')) {
                    storage.deleteStudent(e.currentTarget.dataset.id);
                    this.render();
                }
            });
        });

        document.querySelectorAll('.delete-q-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('Delete this question from database?')) {
                    storage.deleteQuestion(e.currentTarget.dataset.id);
                    this.render();
                }
            });
        });
    }

    // --- STUDENT EDIT / CREATE MODAL ---
    showStudentModal(student = null) {
        const isEdit = !!student;
        const modalHtml = `
            <div class="modal-overlay" id="admin-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="panel-title">${isEdit ? 'Edit Student & Access Limits' : 'Create New Student Account'}</h3>
                        <button class="modal-close" id="modal-close-btn">&times;</button>
                    </div>
                    <form id="student-form">
                        <input type="hidden" id="std-id" value="${student ? student.id : ''}">
                        <div class="form-group">
                            <label class="form-label">Full Name</label>
                            <input type="text" class="form-control" id="std-name" required value="${student ? student.name : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email Address</label>
                            <input type="email" class="form-control" id="std-email" required value="${student ? student.email : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Password</label>
                            <input type="text" class="form-control" id="std-password" required value="${student ? student.password : 'pass123'}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Enrollment ID</label>
                            <input type="text" class="form-control" id="std-enrollment" value="${student ? student.enrollmentId : 'SIGMA-2026-' + Math.floor(100+Math.random()*900)}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Practice Test Limit (Allowed Tests)</label>
                            <input type="number" class="form-control" id="std-allowed" required min="1" max="500" value="${student ? student.allowedTests : 20}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Account Status</label>
                            <select class="form-control" id="std-status">
                                <option value="active" ${student && student.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="disabled" ${student && student.status === 'disabled' ? 'selected' : ''}>Disabled</option>
                            </select>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
                            <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Account'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const overlay = document.getElementById('admin-modal');
        const closeBtn = document.getElementById('modal-close-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const form = document.getElementById('student-form');

        const closeModal = () => overlay.remove();
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = {
                id: document.getElementById('std-id').value,
                name: document.getElementById('std-name').value,
                email: document.getElementById('std-email').value,
                password: document.getElementById('std-password').value,
                enrollmentId: document.getElementById('std-enrollment').value,
                allowedTests: parseInt(document.getElementById('std-allowed').value, 10),
                status: document.getElementById('std-status').value
            };
            storage.saveStudent(data);
            closeModal();
            this.render();
        });
    }

    // --- BULK UPLOAD MODAL (CSV / GOOGLE SHEETS) ---
    showBulkUploadModal() {
        const modalHtml = `
            <div class="modal-overlay" id="admin-modal">
                <div class="modal-content" style="max-width:700px;">
                    <div class="modal-header">
                        <h3 class="panel-title">📥 Bulk Upload Questions (Google Sheets / CSV)</h3>
                        <button class="modal-close" id="modal-close-btn">&times;</button>
                    </div>
                    <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:1rem;">
                        Paste raw CSV text exported from Google Sheets. Format header:<br>
                        <code>Question ID,Batch,Subject,Question (Marathi/English),Option A,Option B,Option C,Option D,Correct Answer,Marks,Test Type,Language</code>
                    </p>
                    <form id="bulk-form">
                        <div class="form-group">
                            <textarea class="form-control" id="csv-paste-area" style="min-height:220px; font-family:monospace; font-size:0.85rem;" placeholder="Paste CSV text here..."></textarea>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem;">
                            <button type="button" class="btn btn-secondary" id="btn-load-sample-csv">Load Sample CSV</button>
                            <div style="display:flex; gap:0.75rem;">
                                <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                                <button type="submit" class="btn btn-gradient">Import Questions</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const overlay = document.getElementById('admin-modal');
        const closeModal = () => overlay.remove();
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

        document.getElementById('btn-load-sample-csv').addEventListener('click', () => {
            const sample = `Question ID,Batch,Subject,Question (Marathi/English),Option A,Option B,Option C,Option D,Correct Answer,Marks,Test Type,Language
PB-MAT-101,Police Bharti,Mathematics,एका चौरसाची बाजू 10 सेमी आहे तर त्याचे क्षेत्रफळ किती?,100 चौरस सेमी,50 चौरस सेमी,40 चौरस सेमी,200 चौरस सेमी,A,1,Subject-wise,Marathi/English
VR-ENG-101,Vanrakshak,English,Select the correct synonym for 'Wild':,Untamed,Civilized,Domestic,Mild,A,2,Subject-wise,Marathi/English`;
            document.getElementById('csv-paste-area').value = sample;
        });

        document.getElementById('bulk-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const text = document.getElementById('csv-paste-area').value.trim();
            if (!text) {
                alert('Please paste CSV content.');
                return;
            }

            const lines = text.split('\n');
            const newQuestions = [];
            const header = lines[0].split(',');

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length >= 8) {
                    const ansLetter = (cols[8] || 'A').toUpperCase();
                    const idxMap = {'A': 0, 'B': 1, 'C': 2, 'D': 3};
                    newQuestions.push({
                        id: cols[0] || 'Q-' + Date.now().toString(36),
                        batch: cols[1] || 'Police Bharti',
                        subject: cols[2] || 'General Knowledge',
                        text: cols[3],
                        options: [cols[4], cols[5], cols[6], cols[7]],
                        correctIndex: idxMap[ansLetter] || 0,
                        correctAnswerLetter: ansLetter,
                        marks: parseFloat(cols[9]) || 1,
                        testType: cols[10] || 'Subject-wise',
                        language: cols[11] || 'Marathi/English',
                        explanation: `Correct option is ${ansLetter}`
                    });
                }
            }

            const res = storage.bulkUploadQuestions(newQuestions);
            alert(`Success! Uploaded ${res.added} new questions. Total in Bank: ${res.total}`);
            closeModal();
            this.render();
        });
    }

    // --- ADD / EDIT QUESTION MODAL ---
    showQuestionModal(question = null) {
        const isEdit = !!question;
        const modalHtml = `
            <div class="modal-overlay" id="admin-modal">
                <div class="modal-content" style="max-width:650px;">
                    <div class="modal-header">
                        <h3 class="panel-title">${isEdit ? 'Edit Question' : 'Add New Question to Bank'}</h3>
                        <button class="modal-close" id="modal-close-btn">&times;</button>
                    </div>
                    <form id="q-form">
                        <input type="hidden" id="q-edit-id" value="${question ? question.id : ''}">
                        <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div>
                                <label class="form-label">Batch / Exam</label>
                                <select class="form-control" id="q-batch">
                                    <option value="Police Bharti" ${question && question.batch === 'Police Bharti' ? 'selected' : ''}>Police Bharti</option>
                                    <option value="Vanrakshak" ${question && question.batch === 'Vanrakshak' ? 'selected' : ''}>Vanrakshak</option>
                                    <option value="SSC GD" ${question && question.batch === 'SSC GD' ? 'selected' : ''}>SSC GD</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">Subject</label>
                                <input type="text" class="form-control" id="q-subject" required value="${question ? question.subject : 'Mathematics'}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Question Text (Marathi / English)</label>
                            <textarea class="form-control" id="q-text" required>${question ? question.text : ''}</textarea>
                        </div>
                        <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div>
                                <label class="form-label">Option A</label>
                                <input type="text" class="form-control" id="q-opt-a" required value="${question ? question.options[0] : ''}">
                            </div>
                            <div>
                                <label class="form-label">Option B</label>
                                <input type="text" class="form-control" id="q-opt-b" required value="${question ? question.options[1] : ''}">
                            </div>
                            <div>
                                <label class="form-label">Option C</label>
                                <input type="text" class="form-control" id="q-opt-c" required value="${question ? question.options[2] : ''}">
                            </div>
                            <div>
                                <label class="form-label">Option D</label>
                                <input type="text" class="form-control" id="q-opt-d" required value="${question ? question.options[3] : ''}">
                            </div>
                        </div>
                        <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div>
                                <label class="form-label">Correct Option</label>
                                <select class="form-control" id="q-correct-idx">
                                    <option value="0" ${question && question.correctIndex === 0 ? 'selected' : ''}>Option A</option>
                                    <option value="1" ${question && question.correctIndex === 1 ? 'selected' : ''}>Option B</option>
                                    <option value="2" ${question && question.correctIndex === 2 ? 'selected' : ''}>Option C</option>
                                    <option value="3" ${question && question.correctIndex === 3 ? 'selected' : ''}>Option D</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">Marks</label>
                                <input type="number" class="form-control" id="q-marks" value="${question ? question.marks : 1}" step="0.5" min="1" max="5">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Explanation</label>
                            <input type="text" class="form-control" id="q-explanation" value="${question ? question.explanation : ''}">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
                            <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save Question</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const overlay = document.getElementById('admin-modal');
        const closeModal = () => overlay.remove();
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

        document.getElementById('q-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const qData = {
                id: document.getElementById('q-edit-id').value,
                batch: document.getElementById('q-batch').value,
                subject: document.getElementById('q-subject').value,
                text: document.getElementById('q-text').value,
                options: [
                    document.getElementById('q-opt-a').value,
                    document.getElementById('q-opt-b').value,
                    document.getElementById('q-opt-c').value,
                    document.getElementById('q-opt-d').value
                ],
                correctIndex: parseInt(document.getElementById('q-correct-idx').value, 10),
                marks: parseFloat(document.getElementById('q-marks').value) || 1,
                explanation: document.getElementById('q-explanation').value || 'Detailed answer'
            };
            storage.saveQuestion(qData);
            closeModal();
            this.render();
        });
    }
}
