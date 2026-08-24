/**
 * CEP Online Mock Test Platform - CSV Parser Service
 * Parses exported Google Sheets CSV content for Question Bank bulk upload.
 *
 * Supports quoted cells containing commas, newlines, and quotes,
 * dynamic header mapping (for explanation, imageUrl, text_mr, etc.),
 * and multiple batches separated by semicolons (';').
 */

import { resolveSubjectCode } from '../constants/subjectCodes.js';

// Multiple batches in one CSV cell use ';' (not ',')
function parseBatchCell(rawValue) {
    const value = (rawValue || '').trim();
    if (!value) return ['Police Bharti'];
    return value.split(';').map(b => b.trim()).filter(Boolean);
}

/**
 * Robust RFC-4180 compliant CSV line tokenizer that respects double quotes
 */
function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur.trim());
    return result;
}

export function parseCSVQuestions(csvText) {
    if (!csvText || !csvText.trim()) return [];

    // Split lines cleanly (handling Windows \r\n and Unix \n)
    const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];

    const questions = [];

    // 1. Detect Header Row if present
    const firstLineCols = parseCSVLine(lines[0]);
    const lowerHeaderCols = firstLineCols.map(c => c.toLowerCase());

    const isHeaderRow = lowerHeaderCols.some(h => 
        h.includes('question') || h.includes('text') || h.includes('option') || 
        h.includes('subject') || h.includes('batch') || h.includes('correct') || h.includes('explanation')
    );

    let startIdx = 0;
    const colMap = {};

    if (isHeaderRow) {
        startIdx = 1; // Skip header line
        lowerHeaderCols.forEach((header, index) => {
            if (header.includes('id')) colMap.id = index;
            else if (header.includes('batch')) colMap.batch = index;
            else if (header.includes('subject')) colMap.subject = index;
            else if (header.includes('question') || header === 'text') colMap.text = index;
            else if (header.includes('optiona') || header === 'a') colMap.optionA = index;
            else if (header.includes('optionb') || header === 'b') colMap.optionB = index;
            else if (header.includes('optionc') || header === 'c') colMap.optionC = index;
            else if (header.includes('optiond') || header === 'd') colMap.optionD = index;
            else if (header.includes('correct')) colMap.correctOption = index;
            else if (header.includes('mark')) colMap.marks = index;
            else if (header.includes('testtype') || header.includes('type')) colMap.testType = index;
            else if (header.includes('language') || header.includes('lang')) colMap.language = index;
            else if (header.includes('explanation') || header.includes('exp') || header.includes('solution')) colMap.explanation = index;
            else if (header.includes('image') || header.includes('img') || header.includes('diagram')) colMap.imageUrl = index;
            else if (header.includes('text_mr') || header.includes('marathi')) colMap.text_mr = index;
        });
    }

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        const cols = parseCSVLine(line);
        if (cols.length < 4) continue; // Skip malformed short lines

        const getCol = (key, defaultIdx) => {
            const idx = colMap[key] !== undefined ? colMap[key] : defaultIdx;
            return idx !== undefined && idx < cols.length ? cols[idx] : '';
        };

        const rawId = getCol('id', 0);
        const rawBatch = getCol('batch', 1);
        const rawSubject = getCol('subject', 2);
        const qText = getCol('text', 3);

        const optA = getCol('optionA', 4);
        const optB = getCol('optionB', 5);
        const optC = getCol('optionC', 6);
        const optD = getCol('optionD', 7);

        const rawCorrect = getCol('correctOption', 8) || 'A';
        const ansLetter = rawCorrect.toUpperCase().charAt(0);
        const idxMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

        const rawMarks = getCol('marks', 9);
        const rawTestType = getCol('testType', 10);
        const rawLang = getCol('language', 11);
        
        // 🌟 Explanation Column Handling (Fixes default value fallback bug)
        const rawExp = getCol('explanation', 12);
        const rawImage = getCol('imageUrl', 13);
        const rawTextMr = getCol('text_mr', 14);

        const batches = parseBatchCell(rawBatch);
        const resolvedSubject = resolveSubjectCode(rawSubject);

        // Preserve uploaded explanation if present, otherwise default gracefully
        const finalExplanation = rawExp && rawExp.trim() ? rawExp.trim() : `Correct option is ${ansLetter}`;

        questions.push({
            id: rawId && rawId.trim() ? rawId.trim() : 'Q-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            batches,
            batch: batches.join(', '),
            subjectCode: resolvedSubject.code,
            subject: resolvedSubject.name,
            text: qText || '',
            text_mr: rawTextMr || '',
            options: [optA || '', optB || '', optC || '', optD || ''],
            correctIndex: idxMap[ansLetter] !== undefined ? idxMap[ansLetter] : 0,
            correctAnswerLetter: ansLetter,
            marks: parseFloat(rawMarks) || 1,
            testType: rawTestType || 'Subject-wise',
            language: rawLang || 'Marathi/English',
            explanation: finalExplanation,
            imageUrl: rawImage || ''
        });
    }

    return questions;
}
