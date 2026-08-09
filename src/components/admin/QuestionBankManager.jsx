import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { BulkUploadModal } from './BulkUploadModal.jsx';

export const QuestionBankManager = ({ onRefresh }) => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [batchFilter, setBatchFilter] = useState('ALL');
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingQ, setEditingQ] = useState(null);

    // Question form state
    const [qBatch, setQBatch] = useState('Police Bharti');
    const [qSubject, setQSubject] = useState('Mathematics');
    const [qText, setQText] = useState('');
    const [optA, setOptA] = useState('');
    const [optB, setOptB] = useState('');
    const [optC, setOptC] = useState('');
    const [optD, setOptD] = useState('');
    const [correctIdx, setCorrectIdx] = useState(0);
    const [marks, setMarks] = useState(1);
    const [explanation, setExplanation] = useState('');

    const loadQuestions = async () => {
        setLoading(true);
        const loaded = await firestoreEngine.getQuestions(batchFilter);
        setQuestions(loaded);
        setLoading(false);
    };

    useEffect(() => {
        loadQuestions();
    }, [batchFilter]);

    let filtered = questions;
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(item => 
            item.text.toLowerCase().includes(query) || 
            item.subject.toLowerCase().includes(query) ||
            item.id.toLowerCase().includes(query)
        );
    }

    const handleOpenEditModal = (q = null) => {
        setEditingQ(q);
        if (q) {
            setQBatch(q.batch);
            setQSubject(q.subject);
            setQText(q.text);
            setOptA(q.options[0] || '');
            setOptB(q.options[1] || '');
            setOptC(q.options[2] || '');
            setOptD(q.options[3] || '');
            setCorrectIdx(q.correctIndex || 0);
            setMarks(q.marks || 1);
            setExplanation(q.explanation || '');
        } else {
            setQBatch('Police Bharti');
            setQSubject('Mathematics');
            setQText('');
            setOptA(''); setOptB(''); setOptC(''); setOptD('');
            setCorrectIdx(0);
            setMarks(1);
            setExplanation('');
        }
        setEditModalOpen(true);
    };

    const handleSaveQuestion = async (e) => {
        e.preventDefault();
        const questionData = {
            id: editingQ ? editingQ.id : 'Q-' + Date.now(),
            batch: qBatch,
            subject: qSubject,
            text: qText,
            options: [optA, optB, optC, optD],
            correctIndex: parseInt(correctIdx, 10),
            marks: parseFloat(marks) || 1,
            explanation: explanation || `Correct option is ${['A','B','C','D'][correctIdx]}`
        };

        await firestoreEngine.saveQuestion(questionData);
        setEditModalOpen(false);
        await loadQuestions();
        if (onRefresh) onRefresh();
    };

    return (
        <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">Central Question Bank ({filtered.length} Questions)</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Source question pool with solutions for practice paper generation.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={() => setBulkModalOpen(true)}>
                        Google Sheets CSV Upload
                    </button>
                    <button className="btn btn-primary" onClick={() => handleOpenEditModal(null)}>
                        Add New Question
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <input 
                    type="text" 
                    className="form-control" 
                    style={{ maxWidth: '350px' }}
                    placeholder="Search question text, ID or subject..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />

                <select 
                    className="form-control" 
                    value={batchFilter}
                    onChange={e => setBatchFilter(e.target.value)}
                    style={{ maxWidth: '240px' }}
                >
                    <option value="ALL">All Exam Batches</option>
                    <option value="Police Bharti">Police Bharti</option>
                    <option value="Vanrakshak">Vanrakshak (Forest Guard)</option>
                    <option value="SSC GD">SSC GD Constable</option>
                </select>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Q.ID</th>
                            <th>Batch</th>
                            <th>Subject</th>
                            <th>Question Text</th>
                            <th>Correct Option</th>
                            <th>Marks</th>
                            <th>Detailed Solution Explanation</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading question bank from Cloud Firestore...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No questions match your filter.</td></tr>
                        ) : (
                            filtered.slice(0, 30).map(q => (
                                <tr key={q.id}>
                                    <td><code>{q.id}</code></td>
                                    <td><span className="badge badge-purple">{q.batch}</span></td>
                                    <td><strong>{q.subject}</strong></td>
                                    <td style={{ maxWidth: '300px' }}>{q.text}</td>
                                    <td><span className="badge badge-success">{q.options[q.correctIndex]}</span></td>
                                    <td><strong>{q.marks || 1} M</strong></td>
                                    <td style={{ maxWidth: '250px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{q.explanation}</td>
                                    <td>
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEditModal(q)}>
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <BulkUploadModal 
                isOpen={bulkModalOpen} 
                onClose={() => setBulkModalOpen(false)}
                onRefresh={loadQuestions}
            />

            {/* Single Question Editor Modal */}
            {editModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-card" style={{ maxWidth: '650px' }}>
                        <div className="modal-header" style={{ marginBottom: '1.25rem' }}>
                            <h3 className="card-title">{editingQ ? 'Edit Question & Solution' : 'Add New Question & Solution'}</h3>
                            <button className="modal-close" onClick={() => setEditModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <form onSubmit={handleSaveQuestion}>
                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Batch / Exam Pattern</label>
                                    <select className="form-control" value={qBatch} onChange={e => setQBatch(e.target.value)}>
                                        <option value="Police Bharti">Police Bharti</option>
                                        <option value="Vanrakshak">Vanrakshak</option>
                                        <option value="SSC GD">SSC GD</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Subject</label>
                                    <input type="text" className="form-control" required value={qSubject} onChange={e => setQSubject(e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Question Text (Marathi / English)</label>
                                <textarea className="form-control" required style={{ minHeight: '80px' }} value={qText} onChange={e => setQText(e.target.value)} />
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Option A</label>
                                    <input type="text" className="form-control" required value={optA} onChange={e => setOptA(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Option B</label>
                                    <input type="text" className="form-control" required value={optB} onChange={e => setOptB(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Option C</label>
                                    <input type="text" className="form-control" required value={optC} onChange={e => setOptC(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Option D</label>
                                    <input type="text" className="form-control" required value={optD} onChange={e => setOptD(e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Correct Answer</label>
                                    <select className="form-control" value={correctIdx} onChange={e => setCorrectIdx(e.target.value)}>
                                        <option value="0">Option A</option>
                                        <option value="1">Option B</option>
                                        <option value="2">Option C</option>
                                        <option value="3">Option D</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Marks Weight</label>
                                    <input type="number" className="form-control" step="0.5" min="1" max="5" value={marks} onChange={e => setMarks(e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Detailed Solution Explanation (Shown to Student in Scorecard)</label>
                                <textarea className="form-control" style={{ minHeight: '80px' }} value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Provide step-by-step solution rationale..." />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Question</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
