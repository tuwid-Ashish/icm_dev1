/**
 * CEP Online Mock Test Platform - CSV Parser Service
 * Parses exported Google Sheets CSV content for Question Bank bulk upload.
 *
 * Note: line.split(',') is a naive splitter that doesn't respect commas
 * inside quoted cells (e.g. a comma in the question text or explanation
 * would shift every column after it). That's a pre-existing limitation of
 * the whole parser, not something this multi-batch change addresses.
 */

// Multiple batches in one CSV cell use ';' (not ',') specifically so they
// survive the naive comma-based line split above without corrupting the row.
function parseBatchCell(rawValue) {
    const value = (rawValue || '').trim();
    if (!value) return ['Police Bharti'];
    return value.split(';').map(b => b.trim()).filter(Boolean);
}

export function parseCSVQuestions(csvText) {
    if (!csvText || !csvText.trim()) return [];

    const lines = csvText.trim().split('\n');
    const questions = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length >= 8) {
            const ansLetter = (cols[8] || 'A').toUpperCase();
            const idxMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
            const batches = parseBatchCell(cols[1]);

            questions.push({
                id: cols[0] || 'Q-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
                batches,
                batch: batches.join(', '),
                subject: cols[2] || 'General Knowledge',
                text: cols[3],
                options: [cols[4] || '', cols[5] || '', cols[6] || '', cols[7] || ''],
                correctIndex: idxMap[ansLetter] !== undefined ? idxMap[ansLetter] : 0,
                correctAnswerLetter: ansLetter,
                marks: parseFloat(cols[9]) || 1,
                testType: cols[10] || 'Subject-wise',
                language: cols[11] || 'Marathi/English',
                explanation: `Correct option is ${ansLetter}`
            });
        }
    }

    return questions;
}
