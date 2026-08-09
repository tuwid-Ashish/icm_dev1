import React, { useState } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const BulkUploadModal = ({ isOpen, onClose, onRefresh }) => {
    const [csvContent, setCsvContent] = useState('');
    const [selectedFileName, setSelectedFileName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    if (!isOpen) return null;

    const sampleCsv = `ID,Batch,Subject,Text,OptionA,OptionB,OptionC,OptionD,CorrectIndex,Marks,Explanation
PB-101,Police Bharti,Mathematics,"150 च्या 40% चे मूल्य किती आहे?",50,60,70,80,1,1,"150 × 40 / 100 = 60."
VR-201,Vanrakshak,Marathi,"'झाड' या शब्दाचे अनेकवचन कोणते?",झाडे,झाडांना,झाडांचे,झाडावर,0,2,"'झाड' या नपुंसकलिंगी नामाचे अनेकवचन 'झाडे' होते."`;

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setSelectedFileName(file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            setCsvContent(event.target.result);
            setStatusMsg(`Loaded ${file.name} (${event.target.result.split('\n').length - 1} rows)`);
        };
        reader.readAsText(file);
    };

    const handleUpload = async () => {
        if (!csvContent.trim()) {
            alert('Please select a .csv file or paste valid CSV content from Google Sheets.');
            return;
        }

        setUploading(true);
        setStatusMsg('Parsing CSV content...');

        try {
            const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
            if (lines.length <= 1) {
                alert('CSV must contain a header row and at least one data row.');
                setUploading(false);
                return;
            }

            const questionsToAdd = [];
            // Skip header row
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
                if (parts && parts.length >= 8) {
                    const clean = parts.map(p => p.replace(/^"|"$/g, '').trim());
                    questionsToAdd.push({
                        id: clean[0] || 'Q-' + (Date.now() + i),
                        batch: clean[1] || 'Police Bharti',
                        subject: clean[2] || 'General Knowledge',
                        text: clean[3] || '',
                        options: [clean[4] || '', clean[5] || '', clean[6] || '', clean[7] || ''],
                        correctIndex: parseInt(clean[8], 10) || 0,
                        marks: parseFloat(clean[9]) || 1,
                        explanation: clean[10] || `Correct answer is option ${clean[8] || 'A'}`
                    });
                }
            }

            setStatusMsg(`Uploading ${questionsToAdd.length} questions to Cloud Firestore...`);
            for (const q of questionsToAdd) {
                await firestoreEngine.saveQuestion(q);
            }

            setStatusMsg(`Successfully imported ${questionsToAdd.length} questions!`);
            setTimeout(() => {
                setUploading(false);
                onClose();
                if (onRefresh) onRefresh();
            }, 1000);

        } catch (err) {
            console.error('CSV Import Error:', err);
            alert('Failed to parse and upload CSV: ' + err.message);
            setUploading(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-card" style={{ maxWidth: '680px' }}>
                <div className="modal-header" style={{ marginBottom: '1rem' }}>
                    <h3 className="card-title">Google Sheets CSV Bulk Importer</h3>
                    <button className="modal-close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Select a <code>.csv</code> file from your computer or paste raw CSV rows exported from Google Sheets.
                </p>

                {/* File Upload Trigger */}
                <div className="form-group" style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px border-dashed var(--border-color)', marginBottom: '1rem', textAlign: 'center' }}>
                    <label className="form-label" style={{ marginBottom: '0.5rem' }}>Select CSV File from Computer</label>
                    <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileSelect}
                        style={{ fontSize: '0.85rem' }}
                    />
                    {selectedFileName && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700 }}>
                            Selected File: {selectedFileName}
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">Or Paste CSV Content Directly Below</label>
                    <textarea 
                        className="form-control"
                        rows="6"
                        style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                        placeholder="Paste CSV rows here..."
                        value={csvContent}
                        onChange={e => setCsvContent(e.target.value)}
                    />
                </div>

                {statusMsg && (
                    <div style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>
                        {statusMsg}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" onClick={onClose} disabled={uploading}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
                        {uploading ? 'Importing...' : 'Bulk Import to Firestore'}
                    </button>
                </div>
            </div>
        </div>
    );
};
