/**
 * CEP Online Mock Test Platform - CSV Parser Service
 * Parses exported Google Sheets CSV content for Question Bank bulk upload.
 */

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

            questions.push({
                id: cols[0] || 'Q-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
                batch: cols[1] || 'Police Bharti',
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
