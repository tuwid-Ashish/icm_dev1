/**
 * CEP Online Mock Test Platform - Student Module & CBT Exam Simulator
 * Handles Student Dashboard, Practice Test Creation, Exam Simulator, Scoring, Result Review & Analytics.
 */

import { storage } from '../core/storage.js';
import { examEngine } from '../core/examEngine.js';

export class StudentModule {
    constructor() {
        this.currentView = 'dashboard'; // 'dashboard' | 'cbt_simulator' | 'result_screen' | 'history' | 'analytics'
        this.activeSession = null;
        this.currentQuestionIdx = 0;
        this.timerInterval = null;
        this.activeResult = null;
    }

    render() {
        const container = document.getElementById('student-view');
        if (!container) return;

        const user = storage.getCurrentUser();

        container.innerHTML = `
            <div class="student-wrapper">
                <!-- Navigation Sub-Bar (Hidden during active CBT test) -->
                ${this.currentView !== 'cbt_simulator' ? `
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">🎓 Student Practice Portal</h1>
                            <p class="page-subtitle">Welcome back, <strong>${user.name}</strong> (${user.enrollmentId || 'SIGMA-2026'})</p>
                        </div>
                        <div style="display:flex; gap:0.75rem;">
                            <button class="btn btn-gradient" id="btn-create-test-main">🚀 Create Practice Test</button>
                        </div>
                    </div>

                    <div class="nav-tabs" style="margin-bottom: 1.5rem; justify-content: flex-start;">
                        <button class="tab-btn ${this.currentView === 'dashboard' ? 'active' : ''}" data-student-tab="dashboard">🏠 Dashboard</button>
                        <button class="tab-btn ${this.currentView === 'history' ? 'active' : ''}" data-student-tab="history">📜 Test History</button>
                        <button class="tab-btn ${this.currentView === 'analytics' ? 'active' : ''}" data-student-tab="analytics">📊 Performance Analytics</button>
                    </div>
                ` : ''}

                <div id="student-view-content">
                    ${this.renderViewContent()}
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderViewContent() {
        switch (this.currentView) {
            case 'dashboard': return this.renderDashboard();
            case 'cbt_simulator': return this.renderCBTSimulator();
            case 'result_screen': return this.renderResultScreen();
            case 'history': return this.renderHistory();
            case 'analytics': return this.renderAnalytics();
            default: return this.renderDashboard();
        }
    }

    // --- 1. STUDENT DASHBOARD ---
    renderDashboard() {
        const user = storage.getCurrentUser();
        const submissions = storage.getStudentSubmissions(user.id);
        const exams = storage.getExams();

        // Calculate analytics metrics
        const totalAttempted = submissions.length;
        const avgScore = totalAttempted > 0 ? (submissions.reduce((s, a) => s + a.percentage, 0) / totalAttempted).toFixed(1) : '0.0';
        const avgAccuracy = totalAttempted > 0 ? (submissions.reduce((s, a) => s + a.accuracy, 0) / totalAttempted).toFixed(1) : '0.0';

        return `
            <!-- Practice Test Balance Card Banner -->
            <div class="panel" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%); border: 1px solid var(--border-highlight); margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <span class="badge ${user.remainingTests > 0 ? 'badge-success' : 'badge-danger'}" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;">
                            🎯 REMAINING TEST BALANCE: ${user.remainingTests} / ${user.allowedTests}
                        </span>
                        <h2 style="font-family: var(--font-heading); margin-top: 0.5rem; font-size: 1.6rem;">
                            ${user.remainingTests > 0 ? 'Ready for your next mock test?' : 'Test Limit Exhausted!'}
                        </h2>
                        <p style="color: var(--text-secondary); font-size: 0.95rem;">
                            ${user.remainingTests > 0 
                                ? 'Generate a new paper from our randomized question database.' 
                                : 'You have 0 remaining tests. Contact Administrator to increase your limit.'}
                        </p>
                    </div>
                    <button class="btn btn-gradient btn-lg" id="btn-dashboard-start-test" ${user.remainingTests <= 0 ? 'disabled' : ''}>
                        ⚡ Generate Practice Test
                    </button>
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Tests Completed</span>
                        <div class="stat-icon">📝</div>
                    </div>
                    <div class="stat-value">${totalAttempted}</div>
                    <div class="stat-footer">Of ${user.allowedTests} Max Quota</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Remaining Balance</span>
                        <div class="stat-icon">🎟️</div>
                    </div>
                    <div class="stat-value" style="color: ${user.remainingTests > 0 ? 'var(--success)' : 'var(--danger)'}">
                        ${user.remainingTests}
                    </div>
                    <div class="stat-footer">Available Attempts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Average Percentage</span>
                        <div class="stat-icon">📊</div>
                    </div>
                    <div class="stat-value">${avgScore}%</div>
                    <div class="stat-footer">Across Evaluated Tests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span>Overall Accuracy</span>
                        <div class="stat-icon">🎯</div>
                    </div>
                    <div class="stat-value">${avgAccuracy}%</div>
                    <div class="stat-footer">Correct vs Attempted</div>
                </div>
            </div>

            <!-- Content Grid: Available Exams & Recent Activity -->
            <div class="content-grid">
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">🎯 Supported Exam Blueprints</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        ${exams.map(e => `
                            <div style="background: var(--bg-primary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                                <div>
                                    <span class="badge badge-purple">${e.code}</span>
                                    <strong style="margin-left: 0.5rem; font-size: 1.05rem;">${e.name}</strong>
                                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                        ⏱️ ${e.durationMinutes} Mins | 🎯 ${e.totalQuestions} Questions | 💯 ${e.totalMarks} Marks | ⚠️ Negative: ${e.negativeMarkingRate}
                                    </div>
                                </div>
                                <button class="btn btn-secondary btn-sm select-exam-btn" data-id="${e.id}" ${user.remainingTests <= 0 ? 'disabled' : ''}>
                                    Start Test
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">📜 Recent Test Results</h3>
                    </div>
                    ${submissions.length === 0 ? `
                        <p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 2rem 0;">No tests attempted yet. Click "Create Practice Test" to get started!</p>
                    ` : `
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${submissions.slice(0, 4).map(sub => `
                                <div style="background: var(--bg-primary); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong style="font-size:0.9rem;">${sub.examCode || sub.examName}</strong>
                                        <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(sub.submittedAt).toLocaleDateString()}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <span class="badge ${sub.passed ? 'badge-success' : 'badge-danger'}">${sub.percentage}%</span>
                                        <div style="font-size:0.8rem; color:var(--text-secondary);">${sub.finalScore} / ${sub.totalMarks} M</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // --- 2. CBT EXAM SIMULATOR VIEW ---
    renderCBTSimulator() {
        const session = this.activeSession;
        if (!session || !session.questions || session.questions.length === 0) {
            return `<div class="panel"><p>No active test session found.</p></div>`;
        }

        const q = session.questions[this.currentQuestionIdx];
        const userAns = session.userAnswers[q.id];

        // Format timer string MM:SS
        const mins = Math.floor(session.timeRemainingSeconds / 60);
        const secs = session.timeRemainingSeconds % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        const isTimerWarning = mins < 5;

        // Calculate Palette Status Counts
        let notVisitedCount = 0;
        let visitedCount = 0;
        let answeredCount = 0;
        let markedCount = 0;
        let answeredMarkedCount = 0;

        session.questions.forEach(item => {
            const st = session.paletteStates[item.id] || 'not_visited';
            if (st === 'not_visited') notVisitedCount++;
            else if (st === 'visited') visitedCount++;
            else if (st === 'answered') answeredCount++;
            else if (st === 'marked') markedCount++;
            else if (st === 'answered_marked') answeredMarkedCount++;
        });

        return `
            <div class="cbt-container">
                <!-- CBT Header -->
                <div class="cbt-header">
                    <div class="cbt-title-area">
                        <span class="badge badge-purple">${session.examCode}</span>
                        <h3 style="font-family: var(--font-heading); font-size: 1.15rem;">${session.examName}</h3>
                    </div>
                    <div class="cbt-timer ${isTimerWarning ? 'warning' : ''}" id="cbt-timer-display">
                        ⏱️ Time Remaining: ${timeStr}
                    </div>
                </div>

                <div class="cbt-body">
                    <!-- Left: Question Display & Navigation -->
                    <div class="cbt-question-area">
                        <div>
                            <!-- Section Tabs -->
                            <div class="cbt-section-bar">
                                <div class="sec-tab active">${q.sectionName || 'General Section'}</div>
                            </div>

                            <!-- Question Card -->
                            <div class="question-card">
                                <div class="q-header">
                                    <span>Question ${this.currentQuestionIdx + 1} of ${session.questions.length}</span>
                                    <span>Marks: +${q.marks || 1} | Neg: -${session.negativeMarkingRate}</span>
                                </div>
                                <div class="q-text">${q.text}</div>

                                <!-- Options List -->
                                <div class="options-list">
                                    ${q.options.map((optText, optIdx) => {
                                        const isSelected = userAns === optIdx;
                                        const labelLetter = String.fromCharCode(65 + optIdx);
                                        return `
                                            <div class="option-item ${isSelected ? 'selected' : ''}" data-option-idx="${optIdx}">
                                                <div class="option-label">${labelLetter}</div>
                                                <div style="font-size: 1rem;">${optText}</div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Action Bar -->
                        <div class="cbt-actions">
                            <div>
                                <button class="btn btn-secondary" id="btn-prev-q" ${this.currentQuestionIdx === 0 ? 'disabled' : ''}>◄ Previous</button>
                                <button class="btn btn-secondary" id="btn-clear-choice">Clear Selection</button>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-purple" id="btn-mark-review" style="background: var(--purple); color: white;">🔖 Mark for Review & Next</button>
                                <button class="btn btn-primary" id="btn-save-next">💾 Save & Next ►</button>
                                <button class="btn btn-danger" id="btn-submit-cbt" style="margin-left: 1rem;">📤 Submit Test</button>
                            </div>
                        </div>
                    </div>

                    <!-- Right Sidebar Question Palette -->
                    <div class="cbt-palette-sidebar">
                        <h4 style="font-family: var(--font-heading); font-size: 1rem;">Question Palette</h4>

                        <div class="palette-legend">
                            <div class="legend-item"><div class="dot dot-answered"></div> Answered (${answeredCount})</div>
                            <div class="legend-item"><div class="dot dot-visited"></div> Visited (${visitedCount})</div>
                            <div class="legend-item"><div class="dot dot-marked"></div> Marked (${markedCount})</div>
                            <div class="legend-item"><div class="dot dot-answered-marked"></div> Ans & Marked (${answeredMarkedCount})</div>
                            <div class="legend-item"><div class="dot dot-not-visited"></div> Not Visited (${notVisitedCount})</div>
                        </div>

                        <div class="palette-grid">
                            ${session.questions.map((item, idx) => {
                                const st = session.paletteStates[item.id] || 'not_visited';
                                const isActive = idx === this.currentQuestionIdx;
                                return `
                                    <button class="palette-btn ${st} ${isActive ? 'active-q' : ''}" data-jump-idx="${idx}">
                                        ${idx + 1}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- 3. RESULT & DETAILED SCORECARD SCREEN ---
    renderResultScreen() {
        const res = this.activeResult;
        if (!res) return `<div class="panel"><p>No result data available.</p></div>`;

        return `
            <div class="score-card-banner">
                <span class="badge ${res.passed ? 'badge-success' : 'badge-danger'}" style="font-size: 1rem; padding: 0.5rem 1rem; margin-bottom: 0.5rem;">
                    ${res.passed ? '🎉 PASSED / QUALIFIED' : '⚠️ NEEDS IMPROVEMENT'}
                </span>
                <div class="score-big">${res.finalScore} / ${res.totalMarks}</div>
                <p style="font-size: 1.2rem; opacity: 0.9;">Overall Score: ${res.percentage}% | Accuracy: ${res.accuracy}%</p>
            </div>

            <!-- Metrics Summary Grid -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-header"><span>Correct Answers</span></div>
                    <div class="stat-value" style="color: var(--success);">${res.correctCount}</div>
                    <div class="stat-footer">+${res.grossScore} Gross Marks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span>Wrong Answers</span></div>
                    <div class="stat-value" style="color: var(--danger);">${res.wrongCount}</div>
                    <div class="stat-footer">-${res.negativeDeduction} Negative Deductions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span>Unattempted</span></div>
                    <div class="stat-value" style="color: var(--text-muted);">${res.unattemptedCount}</div>
                    <div class="stat-footer">Skipped Questions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span>Time Taken</span></div>
                    <div class="stat-value" style="font-size: 1.8rem;">
                        ${Math.floor(res.timeTakenSeconds / 60)}m ${res.timeTakenSeconds % 60}s
                    </div>
                    <div class="stat-footer">Completed Session</div>
                </div>
            </div>

            <!-- Detailed Question Review Accordion -->
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">🔍 Detailed Question-by-Question Review</h3>
                    <button class="btn btn-secondary btn-sm" id="btn-back-to-dashboard">Back to Dashboard</button>
                </div>

                <div class="review-accordion">
                    ${res.detailedReview.map(q => `
                        <div class="review-item ${q.status}">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <strong>Question ${q.questionNumber}: ${q.sectionName}</strong>
                                <span class="badge ${q.status === 'correct' ? 'badge-success' : q.status === 'wrong' ? 'badge-danger' : 'badge-warning'}">
                                    ${q.status.toUpperCase()} (${q.isCorrect ? '+' + q.marks : q.status === 'wrong' ? '-' + (q.marks * res.negativeDeduction) : '0'})
                                </span>
                            </div>
                            <div style="font-size: 1.05rem; margin-bottom: 0.75rem;">${q.text}</div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem; margin-bottom: 0.75rem;">
                                <div>Your Answer: <strong style="color: ${q.isCorrect ? 'var(--success)' : q.userAnswerIndex !== null ? 'var(--danger)' : 'var(--text-muted)'}">${q.userAnswerIndex !== null ? q.options[q.userAnswerIndex] : 'Not Attempted'}</strong></div>
                                <div>Correct Answer: <strong style="color: var(--success);">${q.options[q.correctIndex]}</strong></div>
                            </div>
                            
                            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-secondary); border-left: 3px solid var(--brand-primary);">
                                💡 <strong>Explanation:</strong> ${q.explanation}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // --- 4. TEST HISTORY ---
    renderHistory() {
        const user = storage.getCurrentUser();
        const submissions = storage.getStudentSubmissions(user.id);

        return `
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">📜 Completed Practice Test Records</h3>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Exam</th>
                                <th>Date & Time</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Accuracy</th>
                                <th>Result</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${submissions.length === 0 ? `<tr><td colspan="7" style="text-align:center;">No past test records found.</td></tr>` : ''}
                            ${submissions.map(sub => `
                                <tr>
                                    <td><strong>${sub.examName}</strong></td>
                                    <td><small>${new Date(sub.submittedAt).toLocaleString()}</small></td>
                                    <td><strong>${sub.finalScore} / ${sub.totalMarks}</strong></td>
                                    <td>${sub.percentage}%</td>
                                    <td>${sub.accuracy}%</td>
                                    <td><span class="badge ${sub.passed ? 'badge-success' : 'badge-danger'}">${sub.passed ? 'PASS' : 'FAIL'}</span></td>
                                    <td><button class="btn btn-secondary btn-sm open-result-btn" data-id="${sub.id}">View Scorecard</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // --- 5. PERFORMANCE ANALYTICS ---
    renderAnalytics() {
        const user = storage.getCurrentUser();
        const submissions = storage.getStudentSubmissions(user.id);

        return `
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">📊 Subject & Accuracy Analytics</h3>
                </div>
                <p style="color:var(--text-secondary); margin-bottom:1.5rem;">Visual progress tracking across attempted competitive exams.</p>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
                    <div style="background:var(--bg-primary); padding:1.5rem; border-radius:var(--radius-lg); border:1px solid var(--border-color);">
                        <h4 style="font-family:var(--font-heading); margin-bottom:1rem;">Target Exam Accuracy Breakdown</h4>
                        ${submissions.length === 0 ? '<p style="font-size:0.9rem; color:var(--text-muted);">Attempt mock tests to generate accuracy analytics.</p>' : ''}
                        ${submissions.map(s => `
                            <div style="margin-bottom:1rem;">
                                <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.25rem;">
                                    <span>${s.examCode} (${new Date(s.submittedAt).toLocaleDateString()})</span>
                                    <strong>${s.accuracy}% Accuracy</strong>
                                </div>
                                <div style="height:8px; background:var(--bg-tertiary); border-radius:var(--radius-full); overflow:hidden;">
                                    <div style="width:${s.accuracy}%; height:100%; background:var(--brand-gradient);"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="background:var(--bg-primary); padding:1.5rem; border-radius:var(--radius-lg); border:1px solid var(--border-color);">
                        <h4 style="font-family:var(--font-heading); margin-bottom:1rem;">Strength & Focus Summary</h4>
                        <ul style="list-style:none; display:flex; flex-direction:column; gap:0.75rem; font-size:0.9rem;">
                            <li style="display:flex; gap:0.5rem; align-items:center;">
                                <span style="color:var(--success);">✅</span> Mathematics & Reasoning accuracy is consistently strong.
                            </li>
                            <li style="display:flex; gap:0.5rem; align-items:center;">
                                <span style="color:var(--warning);">⚠️</span> Watch negative marks in Forest Guard (0.5 deduction per wrong answer).
                            </li>
                            <li style="display:flex; gap:0.5rem; align-items:center;">
                                <span style="color:var(--cyan);">💡</span> Recommended: Practice 2 more Full-Length mocks to maximize speed.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    // --- EVENT BINDINGS & TIMERS ---
    bindEvents() {
        // Tab switching
        document.querySelectorAll('[data-student-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentView = e.currentTarget.dataset.studentTab;
                this.render();
            });
        });

        // Trigger Practice Test Creation Modal
        const createTestBtn = document.getElementById('btn-create-test-main');
        if (createTestBtn) createTestBtn.addEventListener('click', () => this.showCreateTestModal());

        const startDashBtn = document.getElementById('btn-dashboard-start-test');
        if (startDashBtn) startDashBtn.addEventListener('click', () => this.showCreateTestModal());

        document.querySelectorAll('.select-exam-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.showCreateTestModal(e.currentTarget.dataset.id));
        });

        document.querySelectorAll('.open-result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sub = storage.getSubmissionById(e.currentTarget.dataset.id);
                if (sub) {
                    this.activeResult = sub;
                    this.currentView = 'result_screen';
                    this.render();
                }
            });
        });

        const backBtn = document.getElementById('btn-back-to-dashboard');
        if (backBtn) backBtn.addEventListener('click', () => {
            this.currentView = 'dashboard';
            this.render();
        });

        // CBT Simulator Events
        if (this.currentView === 'cbt_simulator') {
            this.bindCBTEvents();
        }
    }

    // --- CREATE PRACTICE TEST MODAL ---
    showCreateTestModal(preSelectedExamId = null) {
        const user = storage.getCurrentUser();
        const exams = storage.getExams();

        // Business Rule: Validate practice test balance
        if (user.remainingTests <= 0) {
            alert('⚠️ Test Balance Exhausted!\n\nYou have 0 remaining practice tests. Please contact your Administrator to increase your test quota.');
            return;
        }

        const modalHtml = `
            <div class="modal-overlay" id="student-modal">
                <div class="modal-content" style="max-width:550px;">
                    <div class="modal-header">
                        <h3 class="panel-title">🚀 Create New Practice Test</h3>
                        <button class="modal-close" id="modal-close-btn">&times;</button>
                    </div>

                    <div style="background:var(--bg-primary); padding:1rem; border-radius:var(--radius-md); margin-bottom:1.25rem; border:1px solid var(--border-color);">
                        <div style="font-weight:600; font-size:0.9rem;">Remaining Test Balance: <span style="color:var(--success); font-weight:800;">${user.remainingTests}</span></div>
                        <small style="color:var(--text-muted)">Creating a test will deduct 1 attempt from your remaining balance.</small>
                    </div>

                    <form id="create-test-form">
                        <div class="form-group">
                            <label class="form-label">Select Target Exam</label>
                            <select class="form-control" id="select-exam-input">
                                ${exams.map(e => `
                                    <option value="${e.id}" ${preSelectedExamId === e.id ? 'selected' : ''}>
                                        ${e.name} (${e.durationMinutes} mins / ${e.totalQuestions} Qs)
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
                            <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                            <button type="submit" class="btn btn-gradient">⚡ Generate & Start Test</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const overlay = document.getElementById('student-modal');
        const closeModal = () => overlay.remove();
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

        document.getElementById('create-test-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const examId = document.getElementById('select-exam-input').value;
            closeModal();
            this.startNewTestSession(user.id, examId);
        });
    }

    startNewTestSession(studentId, examId) {
        const result = examEngine.generatePracticeTest(studentId, examId);
        if (result.error) {
            alert(result.error);
            return;
        }

        this.activeSession = result.session;
        this.currentQuestionIdx = 0;
        this.currentView = 'cbt_simulator';
        this.render();

        this.startTimer();
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            if (!this.activeSession) {
                clearInterval(this.timerInterval);
                return;
            }

            this.activeSession.timeRemainingSeconds -= 1;
            
            // Continuous state persistence
            storage.saveActiveTestSession(this.activeSession);

            const display = document.getElementById('cbt-timer-display');
            if (display) {
                const mins = Math.floor(this.activeSession.timeRemainingSeconds / 60);
                const secs = this.activeSession.timeRemainingSeconds % 60;
                display.innerText = `⏱️ Time Remaining: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                if (mins < 5) display.classList.add('warning');
            }

            if (this.activeSession.timeRemainingSeconds <= 0) {
                clearInterval(this.timerInterval);
                alert('⏰ Time Expired! Auto-submitting your test paper now.');
                this.submitTestSession();
            }
        }, 1000);
    }

    bindCBTEvents() {
        const session = this.activeSession;
        if (!session) return;

        const currentQ = session.questions[this.currentQuestionIdx];

        // Option selection
        document.querySelectorAll('.option-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const optIdx = parseInt(e.currentTarget.dataset.optionIdx, 10);
                session.userAnswers[currentQ.id] = optIdx;
                session.paletteStates[currentQ.id] = 'answered';
                this.render();
            });
        });

        // Clear Selection
        const clearBtn = document.getElementById('btn-clear-choice');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                delete session.userAnswers[currentQ.id];
                session.paletteStates[currentQ.id] = 'visited';
                this.render();
            });
        }

        // Previous
        const prevBtn = document.getElementById('btn-prev-q');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentQuestionIdx > 0) {
                    this.currentQuestionIdx--;
                    this.updateVisitedState();
                    this.render();
                }
            });
        }

        // Save & Next
        const saveNextBtn = document.getElementById('btn-save-next');
        if (saveNextBtn) {
            saveNextBtn.addEventListener('click', () => {
                if (session.userAnswers[currentQ.id] !== undefined) {
                    session.paletteStates[currentQ.id] = 'answered';
                } else {
                    session.paletteStates[currentQ.id] = 'visited';
                }

                if (this.currentQuestionIdx < session.questions.length - 1) {
                    this.currentQuestionIdx++;
                    this.updateVisitedState();
                }
                this.render();
            });
        }

        // Mark for Review & Next
        const markBtn = document.getElementById('btn-mark-review');
        if (markBtn) {
            markBtn.addEventListener('click', () => {
                if (session.userAnswers[currentQ.id] !== undefined) {
                    session.paletteStates[currentQ.id] = 'answered_marked';
                } else {
                    session.paletteStates[currentQ.id] = 'marked';
                }

                if (this.currentQuestionIdx < session.questions.length - 1) {
                    this.currentQuestionIdx++;
                    this.updateVisitedState();
                }
                this.render();
            });
        }

        // Jump via Palette Button
        document.querySelectorAll('[data-jump-idx]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentQuestionIdx = parseInt(e.currentTarget.dataset.jumpIdx, 10);
                this.updateVisitedState();
                this.render();
            });
        });

        // Submit Button Trigger
        const submitBtn = document.getElementById('btn-submit-cbt');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.confirmAndSubmitTest());
        }
    }

    updateVisitedState() {
        const q = this.activeSession.questions[this.currentQuestionIdx];
        if (this.activeSession.paletteStates[q.id] === 'not_visited') {
            this.activeSession.paletteStates[q.id] = 'visited';
        }
    }

    confirmAndSubmitTest() {
        const session = this.activeSession;
        let answeredCount = 0;
        let unattemptedCount = 0;

        session.questions.forEach(q => {
            if (session.userAnswers[q.id] !== undefined) answeredCount++;
            else unattemptedCount++;
        });

        if (confirm(`Are you sure you want to submit your exam?\n\n• Answered: ${answeredCount}\n• Unattempted: ${unattemptedCount}\n• Total Questions: ${session.questions.length}`)) {
            this.submitTestSession();
        }
    }

    submitTestSession() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        const session = this.activeSession;
        const result = examEngine.evaluateSubmission(
            session.id,
            session.userAnswers,
            session.paletteStates,
            (session.durationMinutes * 60) - session.timeRemainingSeconds
        );

        this.activeSession = null;
        this.activeResult = result.submission;
        this.currentView = 'result_screen';
        this.render();
    }
}
