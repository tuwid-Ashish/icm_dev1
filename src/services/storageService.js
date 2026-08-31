/**
 * CEP Online Mock Test Platform - Active CBT Session Transient Storage
 * Driver managing client-side transient active test recovery sessions & Auth session caching.
 */

const STORAGE_KEYS = {
    TEST_SESSIONS: 'cep_react_test_sessions',
    CURRENT_USER: 'cep_react_current_user'
};

class StorageService {
    // --- AUTH SESSION CACHE ---
    getCurrentUser() {
        if (typeof localStorage === 'undefined') return null;
        const u = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        return u ? JSON.parse(u) : null;
    }

    setCurrentUser(user) {
        if (typeof localStorage === 'undefined') return;
        if (user) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        } else {
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        }
    }

    // --- TRANSIENT ACTIVE CBT TEST SESSION RECOVERY ---
    saveActiveTestSession(session) {
        if (typeof localStorage === 'undefined') return;
        const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TEST_SESSIONS) || '{}');
        sessions[session.id] = session;
        localStorage.setItem(STORAGE_KEYS.TEST_SESSIONS, JSON.stringify(sessions));
    }

    getActiveTestSession(sessionId) {
        if (typeof localStorage === 'undefined') return null;
        const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TEST_SESSIONS) || '{}');
        return sessions[sessionId] || null;
    }

    removeActiveTestSession(sessionId) {
        if (typeof localStorage === 'undefined') return;
        const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TEST_SESSIONS) || '{}');
        delete sessions[sessionId];
        localStorage.setItem(STORAGE_KEYS.TEST_SESSIONS, JSON.stringify(sessions));
    }

    // --- OFFLINE SUBMISSION & QUESTION CACHE FALLBACKS ---

    saveSubmissionOffline(submission) {
        if (typeof localStorage === 'undefined') return;
        const key = 'cep_react_offline_submissions';
        const subs = JSON.parse(localStorage.getItem(key) || '[]');
        subs.unshift(submission);
        localStorage.setItem(key, JSON.stringify(subs));
    }

    getSubmissionsOffline() {
        if (typeof localStorage === 'undefined') return [];
        return JSON.parse(localStorage.getItem('cep_react_offline_submissions') || '[]');
    }

    saveQuestionOffline(question) {
        if (typeof localStorage === 'undefined') return;
        const key = 'cep_react_offline_questions';
        const questions = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = questions.findIndex(q => q.id === question.id);
        if (idx !== -1) questions[idx] = question;
        else questions.push(question);
        localStorage.setItem(key, JSON.stringify(questions));
    }

    getQuestionsOffline() {
        if (typeof localStorage === 'undefined') return [];
        return JSON.parse(localStorage.getItem('cep_react_offline_questions') || '[]');
    }
}

export const storageService = new StorageService();

