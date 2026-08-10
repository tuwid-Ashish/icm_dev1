/**
 * CEP Online Mock Test Platform - React Storage & Persistence Service
 * Driver managing localStorage persistence for Students, Questions, Exam Blueprints, Active CBT Sessions, and Submissions.
 */

import { SEED_QUESTIONS } from '../data/seedQuestions.js';

const STORAGE_KEYS = {
    STUDENTS: 'cep_react_students',
    QUESTIONS: 'cep_react_questions',
    EXAMS: 'cep_react_exams',
    TEST_SESSIONS: 'cep_react_test_sessions',
    SUBMISSIONS: 'cep_react_submissions',
    CURRENT_USER: 'cep_react_current_user'
};

const SEED_EXAMS = [
    {
        id: 'police_bharti',
        code: 'PB',
        name: 'Maharashtra Police Bharti (Police Constable)',
        description: 'Written Examination pattern for Police Constable recruitment in Maharashtra.',
        totalMarks: 100,
        totalQuestions: 100,
        durationMinutes: 90,
        negativeMarkingRate: 0,
        medium: 'Marathi (General English section only in English)',
        minQualifyingPercent: 40,
        subjects: [
            { id: 'maths', name: 'Mathematics', questionsCount: 25, marksPerQuestion: 1 },
            { id: 'gk', name: 'General Knowledge & Current Affairs', questionsCount: 25, marksPerQuestion: 1 },
            { id: 'marathi', name: 'Marathi Grammar', questionsCount: 25, marksPerQuestion: 1 },
            { id: 'reasoning', name: 'Intelligence Test / Reasoning', questionsCount: 25, marksPerQuestion: 1 }
        ]
    },
    {
        id: 'vanrakshak',
        code: 'VR',
        name: 'Maharashtra Vanrakshak (Forest Guard) Bharti',
        description: 'TCS iON CBT Exam pattern for Forest Guard recruitment in Maharashtra.',
        totalMarks: 120,
        totalQuestions: 60,
        durationMinutes: 90,
        negativeMarkingRate: 0.5,
        medium: 'Marathi & English (Bilingual)',
        minQualifyingPercent: 45,
        subjects: [
            { id: 'marathi', name: 'Marathi', questionsCount: 15, marksPerQuestion: 2 },
            { id: 'english', name: 'English', questionsCount: 15, marksPerQuestion: 2 },
            { id: 'gk', name: 'General Knowledge', questionsCount: 15, marksPerQuestion: 2 },
            { id: 'reasoning', name: 'Intelligence Test', questionsCount: 15, marksPerQuestion: 2 }
        ]
    },
    {
        id: 'ssc_gd',
        code: 'GD',
        name: 'SSC GD Constable',
        description: 'Staff Selection Commission General Duty Constable Computer Based Test.',
        totalMarks: 160,
        totalQuestions: 80,
        durationMinutes: 60,
        negativeMarkingRate: 0.25,
        medium: 'English, Hindi + 13 Regional Languages',
        minQualifyingPercent: 35,
        subjects: [
            { id: 'reasoning', name: 'General Intelligence & Reasoning', questionsCount: 20, marksPerQuestion: 2 },
            { id: 'gk', name: 'General Knowledge & General Awareness', questionsCount: 20, marksPerQuestion: 2 },
            { id: 'maths', name: 'Elementary Mathematics', questionsCount: 20, marksPerQuestion: 2 },
            { id: 'english_hindi', name: 'English/Hindi', questionsCount: 20, marksPerQuestion: 2 }
        ]
    }
];

const SEED_STUDENTS = [
    {
        id: 'std_101',
        name: 'Alex Student',
        email: 'student@sigma.com',
        mobile: '9876543210',
        password: 'pass123',
        enrollmentId: 'SIGMA-2026-001',
        role: 'student',
        status: 'active',
        allowedTests: 0,
        completedTests: 0,
        remainingTests: 0,
        purchasedPackages: [],
        createdAt: '2026-08-01T09:00:00Z'
    },
    {
        id: 'std_102',
        name: 'Priya Sharma',
        email: 'priya@sigma.com',
        mobile: '9876543211',
        password: 'pass123',
        enrollmentId: 'SIGMA-2026-002',
        role: 'student',
        status: 'active',
        allowedTests: 0,
        completedTests: 0,
        remainingTests: 0,
        purchasedPackages: [],
        createdAt: '2026-08-02T10:30:00Z'
    },
    {
        id: 'std_103',
        name: 'Rahul Patil',
        email: 'rahul@sigma.com',
        mobile: '9876543212',
        password: 'pass123',
        enrollmentId: 'SIGMA-2026-003',
        role: 'student',
        status: 'active',
        allowedTests: 0,
        completedTests: 0,
        remainingTests: 0,
        purchasedPackages: [],
        createdAt: '2026-08-03T11:15:00Z'
    }
];

const DEFAULT_ADMIN = {
    id: 'admin_001',
    name: 'Platform Administrator',
    email: 'admin@sigma.com',
    role: 'admin'
};

class StorageService {
    constructor() {
        if (typeof localStorage !== 'undefined') {
            this.init();
        }
    }

    init() {
        if (typeof localStorage === 'undefined') return;
        if (!localStorage.getItem(STORAGE_KEYS.QUESTIONS)) {
            localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(SEED_QUESTIONS));
        }
        if (!localStorage.getItem(STORAGE_KEYS.EXAMS)) {
            localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(SEED_EXAMS));
        }
        if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(SEED_STUDENTS));
        } else {
            // One-time automatic migration: reset all existing local student quotas to 0
            const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS) || '[]');
            const resetList = existing.map(s => ({ ...s, allowedTests: 0, remainingTests: 0 }));
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(resetList));
            localStorage.setItem('sigma_students', JSON.stringify(resetList));
        }
        if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
            localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(SEED_STUDENTS[0]));
        } else {
            const curr = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || '{}');
            if (curr && curr.role === 'student') {
                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify({ ...curr, allowedTests: 0, remainingTests: 0 }));
            }
        }
    }

    // --- AUTH & SESSION ---
    getCurrentUser() {
        if (typeof localStorage === 'undefined') return SEED_STUDENTS[0];
        const u = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        return u ? JSON.parse(u) : SEED_STUDENTS[0];
    }

    setCurrentUser(user) {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }

    login(email, password, role = 'student') {
        if (role === 'admin') {
            if (email === DEFAULT_ADMIN.email && (password === 'admin123' || password === 'admin')) {
                this.setCurrentUser(DEFAULT_ADMIN);
                return { success: true, user: DEFAULT_ADMIN };
            }
            return { success: false, message: 'Invalid admin credentials' };
        }

        const students = this.getStudents();
        const student = students.find(s => s.email.toLowerCase() === email.toLowerCase() && s.password === password);
        
        if (!student) {
            return { success: false, message: 'Invalid email or password' };
        }
        if (student.status !== 'active') {
            return { success: false, message: 'Account is disabled. Please contact administrator.' };
        }

        this.setCurrentUser(student);
        return { success: true, user: student };
    }

    // --- STUDENTS MANAGEMENT ---
    getStudents() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS) || '[]');
    }

    getStudentById(id) {
        return this.getStudents().find(s => s.id === id);
    }

    saveStudent(studentData) {
        const students = this.getStudents();
        let updated;
        
        if (studentData.id) {
            const index = students.findIndex(s => s.id === studentData.id);
            if (index !== -1) {
                const allowed = parseInt(studentData.allowedTests, 10) || 0;
                const completed = parseInt(students[index].completedTests, 10) || 0;
                const remaining = Math.max(0, allowed - completed);

                students[index] = {
                    ...students[index],
                    ...studentData,
                    allowedTests: allowed,
                    remainingTests: remaining
                };
                updated = students[index];
            }
        } else {
            const allowed = parseInt(studentData.allowedTests, 10) || 10;
            updated = {
                id: 'std_' + Date.now(),
                name: studentData.name,
                email: studentData.email,
                password: studentData.password || 'pass123',
                enrollmentId: studentData.enrollmentId || 'SIGMA-2026-' + Math.floor(100 + Math.random() * 900),
                role: 'student',
                status: studentData.status || 'active',
                allowedTests: allowed,
                completedTests: 0,
                remainingTests: allowed,
                createdAt: new Date().toISOString()
            };
            students.unshift(updated);
        }

        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
        return updated;
    }

    deleteStudent(id) {
        let students = this.getStudents().filter(s => s.id !== id);
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    }

    decrementStudentTestBalance(studentId) {
        const students = this.getStudents();
        const index = students.findIndex(s => s.id === studentId);
        if (index !== -1) {
            if (students[index].remainingTests > 0) {
                students[index].remainingTests -= 1;
                students[index].completedTests += 1;
                localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
                
                const currentUser = this.getCurrentUser();
                if (currentUser && currentUser.id === studentId) {
                    this.setCurrentUser(students[index]);
                }
                return students[index];
            }
        }
        return null;
    }

    // --- QUESTION BANK ---
    getQuestions() {
        if (typeof localStorage === 'undefined') return SEED_QUESTIONS;
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS) || '[]');
    }

    saveQuestion(q) {
        const questions = this.getQuestions();
        let saved;
        if (q.id) {
            const index = questions.findIndex(item => item.id === q.id);
            if (index !== -1) {
                questions[index] = { ...questions[index], ...q };
                saved = questions[index];
            }
        }
        if (!saved) {
            saved = {
                ...q,
                id: q.id || 'Q-' + Date.now().toString(36).toUpperCase()
            };
            questions.unshift(saved);
        }
        localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
        return saved;
    }

    deleteQuestion(id) {
        let questions = this.getQuestions().filter(q => q.id !== id);
        localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    }

    bulkUploadQuestions(newQuestionsList) {
        const questions = this.getQuestions();
        let addedCount = 0;

        newQuestionsList.forEach(q => {
            if (!q.text) return;
            const existingIndex = questions.findIndex(existing => existing.id === q.id);
            if (existingIndex !== -1) {
                questions[existingIndex] = { ...questions[existingIndex], ...q };
            } else {
                questions.unshift({
                    ...q,
                    id: q.id || 'Q-' + Math.random().toString(36).substring(2, 9).toUpperCase()
                });
                addedCount++;
            }
        });

        localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
        return { total: questions.length, added: addedCount };
    }

    // --- EXAM BLUEPRINTS ---
    getExams() {
        if (typeof localStorage === 'undefined') return SEED_EXAMS;
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAMS) || '[]');
    }

    getExamById(id) {
        return this.getExams().find(e => e.id === id);
    }

    saveExam(examData) {
        const exams = this.getExams();
        const index = exams.findIndex(e => e.id === examData.id);
        if (index !== -1) {
            exams[index] = { ...exams[index], ...examData };
        } else {
            exams.push(examData);
        }
        localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
        return examData;
    }

    // --- ACTIVE TEST SESSIONS & SUBMISSIONS ---
    saveActiveTestSession(session) {
        const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TEST_SESSIONS) || '{}');
        sessions[session.id] = session;
        localStorage.setItem(STORAGE_KEYS.TEST_SESSIONS, JSON.stringify(sessions));
    }

    getActiveTestSession(sessionId) {
        const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TEST_SESSIONS) || '{}');
        return sessions[sessionId] || null;
    }

    removeActiveTestSession(sessionId) {
        const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TEST_SESSIONS) || '{}');
        delete sessions[sessionId];
        localStorage.setItem(STORAGE_KEYS.TEST_SESSIONS, JSON.stringify(sessions));
    }

    getSubmissions() {
        if (typeof localStorage === 'undefined') return this._inMemorySubs || [];
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
    }

    getSubmissionById(id) {
        return this.getSubmissions().find(s => s.id === id);
    }

    getStudentSubmissions(studentId) {
        return this.getSubmissions().filter(s => s.studentId === studentId);
    }

    saveSubmission(sub) {
        const subs = this.getSubmissions();
        if (!sub.id) sub.id = 'sub_' + Date.now();
        if (!sub.submittedAt) sub.submittedAt = new Date().toISOString();
        subs.unshift(sub);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
        } else {
            this._inMemorySubs = subs;
        }
        return sub;
    }
}

export const storageService = new StorageService();
