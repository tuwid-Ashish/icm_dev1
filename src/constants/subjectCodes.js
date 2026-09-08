/**
 * CEP Online Mock Test Platform - Subject Codes & Resolver System
 * Defines canonical default subject codes (M1-M9) and provides dynamic resolution
 * for custom admin-created subjects, Marathi/English aliases, and smart matching.
 */

export const DEFAULT_SUBJECT_CODES = [
    { code: 'M1', name: 'Maths', name_mr: 'गणित', color: '#3b82f6', aliases: 'm1, maths, math, mathematics, गणित, अंकगणित, quantitative aptitude, arithmetic', order: 1 },
    { code: 'M2', name: 'Marathi', name_mr: 'मराठी', color: '#ea580c', aliases: 'm2, marathi, मराठी, मराठी व्याकरण, मराठी भाषा, marathi grammar', order: 2 },
    { code: 'M3', name: 'Reasoning', name_mr: 'बुद्धिमत्ता', color: '#a855f7', aliases: 'm3, reasoning, intelligence, बुद्धिमत्ता, बुद्धिमत्ता चाचणी, mental ability, general intelligence, logic, aptitude', order: 3 },
    { code: 'M4', name: 'GK 1', name_mr: 'सामान्य ज्ञान १', color: '#10b981', aliases: 'm4, gk1, gk 1, gk-1, general knowledge 1, gk, general knowledge, सामान्य ज्ञान 1, सामान्य ज्ञान', order: 4 },
    { code: 'M5', name: 'GK 2', name_mr: 'सामान्य ज्ञान २', color: '#14b8a6', aliases: 'm5, gk2, gk 2, gk-2, general knowledge 2, सामान्य ज्ञान 2', order: 5 },
    { code: 'M6', name: 'GS 1', name_mr: 'सामान्य अध्ययन १', color: '#f59e0b', aliases: 'm6, gs1, gs 1, gs-1, general studies 1, gs, general studies, सामान्य अध्ययन, सामान्य अध्ययन 1, general knowledge & current affairs, current affairs, चालू घडामोडी, इतिहास, भूगोल, राज्यशास्त्र, राज्यघटना, नागरिकशास्त्र, अर्थशास्त्र, विज्ञान, सामान्य विज्ञान, history, geography, polity, civics, economics, science, general science', order: 6 },
    { code: 'M7', name: 'GS 2', name_mr: 'सामान्य अध्ययन २', color: '#ef4444', aliases: 'm7, gs2, gs 2, gs-2, general studies 2, सामान्य अध्ययन 2', order: 7 },
    { code: 'M8', name: 'Hindi', name_mr: 'हिंदी', color: '#ec4899', aliases: 'm8, hindi, हिंदी, हिन्दी, सामान्य हिंदी, हिंदी व्याकरण, hindi grammar', order: 8 },
    { code: 'M9', name: 'English', name_mr: 'इंग्रजी', color: '#6366f1', aliases: 'm9, english, इंग्लिश, इंग्रजी, general english, english grammar', order: 9 }
];

export const SUBJECT_CODES = DEFAULT_SUBJECT_CODES;

// Dynamic in-memory registry of subject codes (updated from Firestore)
let cachedSubjectCodes = [...DEFAULT_SUBJECT_CODES];

export function setDynamicSubjectCodes(list) {
    if (Array.isArray(list) && list.length > 0) {
        cachedSubjectCodes = [...list];
    }
}

export function getCachedSubjectCodes() {
    return cachedSubjectCodes;
}

/**
 * Resolves a raw subject code or name (e.g. "M1", "M10", "Mathematics", "कायदे")
 * to a canonical { code, name, color, name_mr, resolved }.
 *
 * Matching is EXACT at every step — code, code-with-separator prefix, name, or
 * a whole alias. The alias step previously matched on
 *     lower.includes(a) || a.includes(lower)
 * which meant a one-character alias matched everything, and "GK" matched both
 * "GK 1" and "GK 2". A subject is either recognised or it is not; guessing
 * turns a data-entry mistake into a silently mis-filed question.
 *
 * `resolved: false` marks a value nothing matched, so callers can report it
 * (e.g. in the CSV import preview) instead of quietly filing it under OTHER.
 */
export function resolveSubjectCode(raw, customList = null) {
    const value = (raw || '').trim();
    if (!value) return { code: 'OTHER', name: 'General', color: '#64748b', resolved: false };

    const pool = (Array.isArray(customList) && customList.length > 0) ? customList : cachedSubjectCodes;
    const upper = value.toUpperCase();

    // 1. Direct code exact match (e.g. "M1", "M10")
    const exactCode = pool.find(s => (s.code || '').toUpperCase() === upper);
    if (exactCode) return { ...exactCode, resolved: true };

    // 2. Direct code prefix match (e.g. "M1 - Maths", "M10: Law", "M6_GS1")
    for (const s of pool) {
        const sCode = (s.code || '').toUpperCase();
        if (upper === sCode || upper.startsWith(sCode + ' ') || upper.startsWith(sCode + '-') || upper.startsWith(sCode + '_') || upper.startsWith(sCode + ':')) {
            return { ...s, resolved: true };
        }
    }

    // 3. Exact Subject Name match (English or Marathi)
    const exactName = pool.find(s => 
        (s.name && s.name.toLowerCase() === value.toLowerCase()) || 
        (s.name_mr && s.name_mr.toLowerCase() === value.toLowerCase())
    );
    if (exactName) return { ...exactName, resolved: true };

    // 4. Alias list match — whole-value equality only, never substring.
    const lower = value.toLowerCase();
    for (const s of pool) {
        if (s.aliases) {
            const aliasList = Array.isArray(s.aliases)
                ? s.aliases.map(a => String(a).trim().toLowerCase())
                : s.aliases.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
            if (aliasList.includes(lower)) {
                return { ...s, resolved: true };
            }
        }
    }

    return { code: 'OTHER', name: value, color: '#64748b', resolved: false };
}

export function getSubjectLabel(code, customList = null) {
    const res = resolveSubjectCode(code, customList);
    return res ? res.name : (code || 'General');
}

