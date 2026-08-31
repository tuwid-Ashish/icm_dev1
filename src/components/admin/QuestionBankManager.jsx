import React, { useState, useEffect, useRef } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { BulkUploadModal } from './BulkUploadModal.jsx';
import { Modal } from '../common/Modal.jsx';
import { MathRenderer } from '../common/MathRenderer.jsx';
import { MathExpressionEditor } from '../common/MathExpressionEditor.jsx';
import { MathToolbar } from './MathToolbar.jsx';
import { looksLikeMathContent } from '../../utils/mathContent.js';
import { SUBJECT_CODES, resolveSubjectCode } from '../../constants/subjectCodes.js';

export const QuestionBankManager = ({ onRefresh }) => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [batchFilter, setBatchFilter] = useState('ALL');
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingQ, setEditingQ] = useState(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingQ, setDeletingQ] = useState(null);

    const handleOpenDeleteModal = (q) => {
        setDeletingQ(q);
        setDeleteModalOpen(true);
    };

    const handleConfirmDeleteQuestion = async () => {
        if (!deletingQ) return;
        try {
            await firestoreEngine.deleteQuestion(deletingQ.id);
            setDeleteModalOpen(false);
            setDeletingQ(null);
            await loadQuestions();
            if (onRefresh) onRefresh();
        } catch (err) {
            alert('Error deleting question: ' + err.message);
        }
    };

    // Multi-select batch choices
    const availableBatches = ['Police Bharti', 'Vanrakshak', 'SSC GD'];
    const [selectedBatches, setSelectedBatches] = useState(['Police Bharti']);
    const [isAllBatches, setIsAllBatches] = useState(false);

    const [qSubjectCode, setQSubjectCode] = useState('M1');
    const [qText, setQText] = useState('');
    const [qTextMr, setQTextMr] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [optA, setOptA] = useState('');
    const [optB, setOptB] = useState('');
    const [optC, setOptC] = useState('');
    const [optD, setOptD] = useState('');
    const [correctIdx, setCorrectIdx] = useState(0);
    const [marks, setMarks] = useState(1);
    const [explanation, setExplanation] = useState('');

    // Explicit authoring mode — never inferred from Subject (a Mathematics-subject
    // question can still be plain text, and other subjects can contain equations).
    const [questionType, setQuestionType] = useState('standard');
    // Tracks whichever MathLive mathfield last had focus, across every
    // MathExpressionEditor instance in the modal, so the shared toolbar
    // knows where to insert structure.
    const activeMathFieldRef = useRef(null);

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
            (item.text && item.text.toLowerCase().includes(query)) || 
            (item.text_mr && item.text_mr.toLowerCase().includes(query)) || 
            (item.subject && item.subject.toLowerCase().includes(query)) ||
            (item.subjectCode && item.subjectCode.toLowerCase().includes(query)) ||
            (item.id && item.id.toLowerCase().includes(query))
        );
    }

    const handleOpenEditModal = (q = null) => {
        setEditingQ(q);
        if (q) {
            const batchesArr = Array.isArray(q.batches) ? q.batches : (q.batch ? q.batch.split(', ') : ['Police Bharti']);
            if (batchesArr.includes('ALL')) {
                setIsAllBatches(true);
                setSelectedBatches([...availableBatches]);
            } else {
                setIsAllBatches(false);
                setSelectedBatches(batchesArr);
            }
            setQSubjectCode(q.subjectCode || resolveSubjectCode(q.subject).code);
            setQText(q.text || '');
            setQTextMr(q.text_mr || '');
            setImageUrl(q.imageUrl || (q.questionImages && q.questionImages[0]?.url) || '');
            setOptA(q.options ? q.options[0] || '' : '');
            setOptB(q.options ? q.options[1] || '' : '');
            setOptC(q.options ? q.options[2] || '' : '');
            setOptD(q.options ? q.options[3] || '' : '');
            setCorrectIdx(q.correctIndex !== undefined ? q.correctIndex : (q.correctOption !== undefined ? q.correctOption : 0));
            setMarks(q.marks || 1);
            setExplanation(q.explanation || '');
            setQuestionType(q.questionType || (looksLikeMathContent(q.text) ? 'mathematical' : 'standard'));
        } else {
            setIsAllBatches(false);
            setSelectedBatches(['Police Bharti']);
            setQSubjectCode('M1');
            setQText('');
            setQTextMr('');
            setImageUrl('');
            setOptA(''); setOptB(''); setOptC(''); setOptD('');
            setCorrectIdx(0);
            setMarks(1);
            setExplanation('');
            setQuestionType('standard');
        }
        setEditModalOpen(true);
    };

    const handleBatchToggle = (b) => {
        if (b === 'ALL') {
            if (!isAllBatches) {
                setIsAllBatches(true);
                setSelectedBatches([...availableBatches]);
            } else {
                setIsAllBatches(false);
                setSelectedBatches(['Police Bharti']);
            }
        } else {
            setIsAllBatches(false);
            if (selectedBatches.includes(b)) {
                const next = selectedBatches.filter(item => item !== b);
                setSelectedBatches(next.length > 0 ? next : ['Police Bharti']);
            } else {
                const next = [...selectedBatches, b];
                if (next.length === availableBatches.length) {
                    setIsAllBatches(true);
                }
                setSelectedBatches(next);
            }
        }
    };

    const [isSaving, setIsSaving] = useState(false);

    const handleSaveQuestion = async (e) => {
        e.preventDefault();
        const batchesToSave = isAllBatches ? ['ALL'] : selectedBatches;
        const batchDisplayString = isAllBatches ? 'All Batches' : selectedBatches.join(', ');

        const subjectEntry = SUBJECT_CODES.find(s => s.code === qSubjectCode);

        const questionData = {
            id: editingQ ? editingQ.id : 'Q-' + Date.now(),
            batches: batchesToSave,
            batch: batchDisplayString,
            subjectCode: qSubjectCode,
            subject: subjectEntry ? subjectEntry.name : qSubjectCode,
            questionType,
            text: qText,
            text_mr: qTextMr || qText,
            imageUrl: imageUrl.trim() || null,
            questionImages: imageUrl.trim() ? [{ url: imageUrl.trim(), alt: 'Question diagram', type: 'image' }] : [],
            options: [optA, optB, optC, optD],
            options_mr: [optA, optB, optC, optD],
            correctOption: parseInt(correctIdx, 10),
            correctIndex: parseInt(correctIdx, 10),
            marks: parseFloat(marks) || 1,
            explanation: explanation || `Correct option is ${['A','B','C','D'][correctIdx]}`
        };

        setIsSaving(true);
        try {
            await firestoreEngine.saveQuestion(questionData);
            setEditModalOpen(false);
            await loadQuestions();
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('[QuestionBankManager] Error saving question:', err);
            alert('Failed to save question: ' + (err.message || 'Unknown error'));
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">Central Question Bank ({filtered.length} Questions)</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Multi-batch question pool supporting mathematical equations & diagrams.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={() => setBulkModalOpen(true)}>
                        Google Sheets CSV Upload
                    </button>
                    <button className="btn btn-primary" onClick={() => handleOpenEditModal(null)}>
                        + Add New Question
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <input 
                    type="text" 
                    className="form-control" 
                    style={{ flex: 1, minWidth: '220px' }}
                    placeholder="Search question text, ID or subject..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />

                <select 
                    className="form-control" 
                    value={batchFilter}
                    onChange={e => setBatchFilter(e.target.value)}
                    style={{ flex: 1, minWidth: '200px' }}
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
                            <th>Batches</th>
                            <th>Subject</th>
                            <th>Question Text / Equations</th>
                            <th>Correct Option</th>
                            <th>Marks</th>
                            <th>Detailed Solution Explanation</th>
                            <th style={{ minWidth: '100px', whiteSpace: 'nowrap' }}>Action</th>
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
                                    <td>
                                        <span className="badge badge-purple">
                                            {Array.isArray(q.batches) ? (q.batches.includes('ALL') ? 'All Batches' : q.batches.join(', ')) : (q.batch || 'Police Bharti')}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="badge badge-orange">{q.subjectCode || resolveSubjectCode(q.subject).code}</span> <strong>{q.subject}</strong>
                                    </td>
                                    <td style={{ maxWidth: '280px' }}>
                                        <MathRenderer text={q.text} imageUrl={q.imageUrl || (q.questionImages && q.questionImages[0]?.url)} />
                                    </td>
                                    <td>
                                        <span className="badge badge-success">
                                            <MathRenderer text={q.options ? q.options[q.correctIndex !== undefined ? q.correctIndex : q.correctOption] : ''} />
                                        </span>
                                    </td>
                                    <td><strong>{q.marks || 1} M</strong></td>
                                    <td style={{ maxWidth: '220px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        <MathRenderer text={q.explanation} />
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <button className="btn btn-secondary btn-sm" style={{ marginRight: '0.35rem' }} onClick={() => handleOpenEditModal(q)}>
                                            Edit
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleOpenDeleteModal(q)}>
                                            Delete
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

            {/* Single Question Editor Modal with Math & Image Support */}
            <Modal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                title={editingQ ? 'Edit Question & Math Solution' : 'Add New Question & Math Solution'}
                maxWidth="1120px"
                onSubmit={handleSaveQuestion}
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Question</button>
                    </>
                }
            >
                {/* Question Type — explicit, never inferred from Subject */}
                <div className="form-group">
                    <label className="form-label" style={{ marginBottom: '0.4rem' }}>Question Type</label>
                    <div style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <button
                            type="button"
                            onClick={() => setQuestionType('standard')}
                            style={{
                                padding: '0.5rem 1.1rem', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                                background: questionType === 'standard' ? 'var(--primary)' : 'var(--bg-surface)',
                                color: questionType === 'standard' ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            Standard
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuestionType('mathematical')}
                            style={{
                                padding: '0.5rem 1.1rem', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                                background: questionType === 'mathematical' ? 'var(--primary)' : 'var(--bg-surface)',
                                color: questionType === 'mathematical' ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            Σ Mathematical
                        </button>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        {questionType === 'mathematical'
                            ? 'Question text, options and explanation below become visual math editors — click "+ Insert Math Here" to add an equation anywhere in the sentence.'
                            : 'Plain text authoring. Switch to Mathematical if this question contains any equation, fraction, or symbol.'}
                    </p>
                </div>

                <div className="qb-editor-grid">
                    <div className="qb-editor-col">
                        {/* Multi-select Batch Checkboxes */}
                        <div className="form-group" style={{ background: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <label className="form-label" style={{ marginBottom: '0.4rem' }}>Applicable Exam Batches (Check all that apply)</label>
                            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <input
                                        type="checkbox"
                                        checked={isAllBatches}
                                        onChange={() => handleBatchToggle('ALL')}
                                    />
                                    All Batches
                                </label>
                                {availableBatches.map(b => (
                                    <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                        <input
                                            type="checkbox"
                                            checked={isAllBatches || selectedBatches.includes(b)}
                                            disabled={isAllBatches}
                                            onChange={() => handleBatchToggle(b)}
                                        />
                                        {b}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Subject</label>
                            <select className="form-control" required value={qSubjectCode} onChange={e => setQSubjectCode(e.target.value)}>
                                {SUBJECT_CODES.map(s => (
                                    <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                                ))}
                            </select>
                        </div>

                        {questionType === 'mathematical' && (
                            <MathToolbar activeMathFieldRef={activeMathFieldRef} />
                        )}

                        <div className="form-group">
                            <label className="form-label">Question Text (English)</label>
                            {questionType === 'mathematical' ? (
                                <MathExpressionEditor
                                    value={qText}
                                    onChange={setQText}
                                    minHeight="4rem"
                                    placeholder="e.g. If ... find x."
                                    onMathFieldFocus={(el) => { activeMathFieldRef.current = el; }}
                                />
                            ) : (
                                <textarea className="form-control" required style={{ minHeight: '70px' }} value={qText} onChange={e => setQText(e.target.value)} placeholder="e.g. What is the capital of Maharashtra?" />
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Question Text (Marathi - मराठी)</label>
                            {questionType === 'mathematical' ? (
                                <MathExpressionEditor
                                    value={qTextMr}
                                    onChange={setQTextMr}
                                    minHeight="4rem"
                                    placeholder="उदा. जर ... तर x चे मूल्य शोधा."
                                    onMathFieldFocus={(el) => { activeMathFieldRef.current = el; }}
                                />
                            ) : (
                                <textarea className="form-control" style={{ minHeight: '70px' }} value={qTextMr} onChange={e => setQTextMr(e.target.value)} placeholder="उदा. महाराष्ट्राची राजधानी कोणती?" />
                            )}
                        </div>

                        {/* Question Image Attachment */}
                        <div className="form-group">
                            <label className="form-label">Attached Geometry / Diagram Image URL (Optional)</label>
                            <input type="url" className="form-control" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/diagram.png or Firebase Storage URL" />
                        </div>

                        {/* Answer Options */}
                        <div className="form-group form-grid-2col">
                            {[
                                { key: 'A', value: optA, setter: setOptA },
                                { key: 'B', value: optB, setter: setOptB },
                                { key: 'C', value: optC, setter: setOptC },
                                { key: 'D', value: optD, setter: setOptD }
                            ].map(opt => (
                                <div key={opt.key}>
                                    <label className="form-label">Option {opt.key}</label>
                                    {questionType === 'mathematical' ? (
                                        <MathExpressionEditor
                                            value={opt.value}
                                            onChange={opt.setter}
                                            minHeight="2.6rem"
                                            placeholder={`Option ${opt.key}`}
                                            onMathFieldFocus={(el) => { activeMathFieldRef.current = el; }}
                                        />
                                    ) : (
                                        <input type="text" className="form-control" required value={opt.value} onChange={e => opt.setter(e.target.value)} />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="form-group form-grid-2col">
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
                                <label className="form-label">Marks</label>
                                <input type="number" step="0.5" className="form-control" required value={marks} onChange={e => setMarks(e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Detailed Solution Explanation</label>
                            {questionType === 'mathematical' ? (
                                <MathExpressionEditor
                                    value={explanation}
                                    onChange={setExplanation}
                                    minHeight="3.2rem"
                                    placeholder="Using the quadratic formula: x = ..."
                                    onMathFieldFocus={(el) => { activeMathFieldRef.current = el; }}
                                />
                            ) : (
                                <textarea className="form-control" style={{ minHeight: '80px' }} value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Explain why this option is correct." />
                            )}
                        </div>
                    </div>

                    {/* Live Preview Column — mirrors the student CBT renderer exactly */}
                    <div className="qb-preview-col">
                        <div className="qb-preview-box">
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                👁 Live Question Preview (Student CBT View)
                            </div>

                            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                                <MathRenderer text={qText || 'Question text preview...'} imageUrl={imageUrl} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                                <div style={{ padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: correctIdx == 0 ? '2px solid var(--success)' : '1px solid var(--border-color)' }}>
                                    <strong>A)</strong> <MathRenderer text={optA || 'Option A'} />
                                </div>
                                <div style={{ padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: correctIdx == 1 ? '2px solid var(--success)' : '1px solid var(--border-color)' }}>
                                    <strong>B)</strong> <MathRenderer text={optB || 'Option B'} />
                                </div>
                                <div style={{ padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: correctIdx == 2 ? '2px solid var(--success)' : '1px solid var(--border-color)' }}>
                                    <strong>C)</strong> <MathRenderer text={optC || 'Option C'} />
                                </div>
                                <div style={{ padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: correctIdx == 3 ? '2px solid var(--success)' : '1px solid var(--border-color)' }}>
                                    <strong>D)</strong> <MathRenderer text={optD || 'Option D'} />
                                </div>
                            </div>

                            {explanation && (
                                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', borderLeft: '3px solid var(--primary)' }}>
                                    <strong>Explanation:</strong> <MathRenderer text={explanation} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Warning Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setDeletingQ(null); }}
                title="⚠️ Delete Question Confirmation"
                maxWidth="500px"
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => { setDeleteModalOpen(false); setDeletingQ(null); }}>Cancel</button>
                        <button type="button" className="btn btn-danger" onClick={handleConfirmDeleteQuestion}>Confirm & Delete Question</button>
                    </>
                }
            >
                <div style={{ padding: '0.5rem 0' }}>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                        Are you sure you want to delete question <code>{deletingQ?.id}</code> from Cloud Firestore?
                    </p>
                    {deletingQ && (
                        <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Question Content:</div>
                            <MathRenderer text={deletingQ.text} imageUrl={deletingQ.imageUrl || (deletingQ.questionImages && deletingQ.questionImages[0]?.url)} />
                        </div>
                    )}
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600 }}>
                        ⚠️ <strong>Warning:</strong> This action is permanent and cannot be undone. The question will be permanently removed from Cloud Firestore.
                    </div>
                </div>
            </Modal>
        </div>
    );
};
