import React, { useState } from 'react';
import { parseCSVQuestions } from '../../services/csvParserService.js';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { Modal } from '../common/Modal.jsx';

export const BulkUploadModal = ({ isOpen, onClose, onRefresh }) => {
    const [rawText, setRawText] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parsedPreview, setParsedPreview] = useState(null);
    const [validationError, setValidationError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    if (!isOpen) return null;

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (evt) => {
            setRawText(evt.target.result);
        };
        reader.readAsText(file);
    };

    const handleParsePreview = () => {
        setValidationError('');
        setSuccessMessage('');
        if (!rawText.trim()) {
            setValidationError('Please paste CSV content or upload a CSV file.');
            return;
        }

        setIsParsing(true);
        const questions = parseCSVQuestions(rawText);
        setIsParsing(false);

        if (questions.length === 0) {
            setValidationError('No valid question rows found in the provided CSV text.');
            setParsedPreview(null);
        } else {
            setParsedPreview(questions);
        }
    };

    const handleConfirmImport = async () => {
        if (!parsedPreview || parsedPreview.length === 0) return;

        setIsParsing(true);
        let importedCount = 0;

        for (const qData of parsedPreview) {
            await firestoreEngine.saveQuestion(qData);
            importedCount++;
        }

        setIsParsing(false);
        setSuccessMessage(`Successfully imported ${importedCount} questions into Question Bank!`);
        setParsedPreview(null);
        setRawText('');
        setSelectedFile(null);
        
        setTimeout(() => {
            if (onRefresh) onRefresh();
            onClose();
        }, 1800);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Bulk Import Questions from Google Sheets CSV"
            subtitle="Paste raw CSV rows or pick a .csv file from your computer."
            maxWidth="780px"
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    {!parsedPreview ? (
                        <button type="button" className="btn btn-primary" onClick={handleParsePreview} disabled={isParsing}>
                            {isParsing ? 'Validating CSV...' : 'Parse & Validate CSV'}
                        </button>
                    ) : (
                        <button type="button" className="btn btn-primary" onClick={handleConfirmImport} disabled={isParsing}>
                            {isParsing ? 'Importing...' : `Confirm & Save ${parsedPreview.length} Questions`}
                        </button>
                    )}
                </>
            }
        >
            {validationError && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>
                    {validationError}
                </div>
            )}

            {successMessage && (
                <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>
                    {successMessage}
                </div>
            )}

            {!parsedPreview ? (
                <div>
                    {/* File Upload Box */}
                    <div className="form-group" style={{ border: '2px dashed var(--border-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'center', background: 'var(--bg-subtle)' }}>
                        <label className="form-label" style={{ marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700 }}>
                            Option A: Pick a CSV File (.csv)
                        </label>
                        <input 
                            type="file" 
                            accept=".csv" 
                            onChange={handleFileSelect}
                            style={{ display: 'block', margin: '0 auto', fontSize: '0.85rem' }}
                        />
                        {selectedFile && (
                            <div style={{ marginTop: '0.5rem', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 700 }}>
                                Loaded file: {selectedFile.name}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Option B: Or Paste CSV Rows Directly</label>
                        <textarea 
                            className="form-control"
                            style={{ minHeight: '140px', fontFamily: 'monospace', fontSize: '0.8rem' }}
                            placeholder={`batch,subject,text,optionA,optionB,optionC,optionD,correctIndex,marks,explanation\n"Police Bharti","Mathematics","15 + 25 = ?","35","40","45","50",1,1,"15 + 25 equals 40."`}
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                        />
                    </div>

                    <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <strong>Expected Header Columns:</strong> <code>id, batch, subject, questionText, optionA, optionB, optionC, optionD, correctOption, marks</code>
                    </div>
                </div>
            ) : (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>Validation Passed: Previewing {parsedPreview.length} Questions</h4>
                        <span className="badge badge-success">{parsedPreview.length} Ready to Import</span>
                    </div>

                    <div className="table-wrapper" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Batch</th>
                                    <th>Subject</th>
                                    <th>Question Text</th>
                                    <th>Options (A/B/C/D)</th>
                                    <th>Correct</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedPreview.map((q, idx) => (
                                    <tr key={idx}>
                                        <td>{idx + 1}</td>
                                        <td><span className="badge badge-purple">{q.batch}</span></td>
                                        <td><strong>{q.subject}</strong></td>
                                        <td style={{ maxWidth: '220px' }}>{q.text}</td>
                                        <td><small>{q.options.join(' | ')}</small></td>
                                        <td><span className="badge badge-success">Opt {String.fromCharCode(65 + q.correctIndex)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Modal>
    );
};
