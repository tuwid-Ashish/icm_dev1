/**
 * Client-fixed subject code list (Bug handoff item #7) — assigns every
 * subject a stable code so bulk CSV upload and the admin panel can match
 * subjects by code instead of free-text name. Free-text matching was
 * rejecting valid questions whenever a sheet's spelling didn't exactly
 * match what was already in Firestore (e.g. "Maths" vs "Mathematics").
 */
export const SUBJECT_CODES = [
    { code: 'M1', name: 'Maths' },
    { code: 'M2', name: 'Marathi' },
    { code: 'M3', name: 'Reasoning' },
    { code: 'M4', name: 'GK 1' },
    { code: 'M5', name: 'GK 2' },
    { code: 'M6', name: 'GS 1' },
    { code: 'M7', name: 'GS 2' },
    { code: 'M8', name: 'Hindi' },
    { code: 'M9', name: 'English' }
];

const CODE_BY_CODE = new Map(SUBJECT_CODES.map(s => [s.code, s]));

// Alias groups so existing free-text subject values already in Firestore
// (and admins typing names instead of codes) still resolve to a code,
// without requiring a destructive rename of live question data.
const ALIASES = {
    M1: ['m1', 'maths', 'math', 'mathematics', 'गणित', 'अंकगणित', 'quantitative aptitude', 'arithmetic'],
    M2: ['m2', 'marathi', 'मराठी', 'मराठी व्याकरण', 'मराठी भाषा', 'marathi grammar'],
    M3: ['m3', 'reasoning', 'intelligence', 'बुद्धिमत्ता', 'बुद्धिमत्ता चाचणी', 'mental ability', 'general intelligence', 'logic', 'aptitude'],
    M4: ['m4', 'gk1', 'gk 1', 'gk-1', 'general knowledge 1', 'gk', 'general knowledge', 'सामान्य ज्ञान 1', 'सामान्य ज्ञान'],
    M5: ['m5', 'gk2', 'gk 2', 'gk-2', 'general knowledge 2', 'सामान्य ज्ञान 2'],
    M6: [
        'm6', 'gs1', 'gs 1', 'gs-1', 'general studies 1', 'gs', 'general studies', 
        'सामान्य अध्ययन', 'सामान्य अध्ययन 1', 'general knowledge & current affairs',
        'current affairs', 'चालू घडामोडी', 'इतिहास', 'भूगोल', 'राज्यशास्त्र', 
        'राज्यघटना', 'नागरिकशास्त्र', 'अर्थशास्त्र', 'विज्ञान', 'सामान्य विज्ञान', 
        'history', 'geography', 'polity', 'civics', 'economics', 'science', 'general science'
    ],
    M7: ['m7', 'gs2', 'gs 2', 'gs-2', 'general studies 2', 'सामान्य अध्ययन 2'],
    M8: ['m8', 'hindi', 'हिंदी', 'हिन्दी', 'सामान्य हिंदी', 'हिंदी व्याकरण', 'hindi grammar'],
    M9: ['m9', 'english', 'इंग्लिश', 'इंग्रजी', 'general english', 'english grammar']
};

/**
 * Resolves a raw subject cell (a code like "M1", or free text like
 * "Mathematics" / "गणित" / "चालू घडामोडी") to a canonical { code, name }.
 */
export function resolveSubjectCode(raw) {
    const value = (raw || '').trim();
    if (!value) return { code: 'OTHER', name: 'General' };

    const upper = value.toUpperCase();
    if (CODE_BY_CODE.has(upper)) return CODE_BY_CODE.get(upper);

    // Direct prefix match for codes like "M6 - GS 1", "M1: Maths", "M6_GS1"
    for (const s of SUBJECT_CODES) {
        if (upper.startsWith(s.code)) {
            return s;
        }
    }

    const lower = value.toLowerCase();
    for (const [code, aliases] of Object.entries(ALIASES)) {
        if (aliases.some(a => lower === a || lower.includes(a) || a.includes(lower))) {
            return CODE_BY_CODE.get(code);
        }
    }

    return { code: 'OTHER', name: value };
}


export function getSubjectLabel(code) {
    const entry = CODE_BY_CODE.get((code || '').toUpperCase());
    return entry ? entry.name : (code || 'General');
}
