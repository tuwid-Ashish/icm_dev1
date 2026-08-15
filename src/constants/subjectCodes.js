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
    M1: ['maths', 'math', 'mathematics', 'गणित', 'अंकगणित'],
    M2: ['marathi', 'मराठी', 'मराठी व्याकरण'],
    M3: ['reasoning', 'intelligence', 'बुद्धिमत्ता'],
    M4: ['gk1', 'gk 1', 'general knowledge 1', 'gk'],
    M5: ['gk2', 'gk 2', 'general knowledge 2'],
    M6: ['gs1', 'gs 1', 'general studies 1', 'gs', 'general knowledge & current affairs'],
    M7: ['gs2', 'gs 2', 'general studies 2'],
    M8: ['hindi', 'हिंदी'],
    M9: ['english', 'इंग्लिश']
};

/**
 * Resolves a raw subject cell (a code like "M1", or free text like
 * "Mathematics" / "गणित") to a canonical { code, name }. Falls back to a
 * synthetic OTHER entry (preserving the original text) when nothing matches,
 * rather than silently dropping the question.
 */
export function resolveSubjectCode(raw) {
    const value = (raw || '').trim();
    if (!value) return { code: 'OTHER', name: 'General' };

    const upper = value.toUpperCase();
    if (CODE_BY_CODE.has(upper)) return CODE_BY_CODE.get(upper);

    const lower = value.toLowerCase();
    for (const [code, aliases] of Object.entries(ALIASES)) {
        if (aliases.some(a => lower === a || lower.includes(a))) {
            return CODE_BY_CODE.get(code);
        }
    }

    return { code: 'OTHER', name: value };
}

export function getSubjectLabel(code) {
    const entry = CODE_BY_CODE.get((code || '').toUpperCase());
    return entry ? entry.name : (code || 'General');
}
