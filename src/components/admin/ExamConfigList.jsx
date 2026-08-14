import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { Modal } from '../common/Modal.jsx';

export const ExamConfigList = ({ onRefresh }) => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingExam, setEditingExam] = useState(null);

    // Form state
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [medium, setMedium] = useState('Marathi/English');
    const [durationMinutes, setDurationMinutes] = useState(90);
    const [negativeMarkingRate, setNegativeMarkingRate] = useState(0.25);
    const [minQualifyingPercent, setMinQualifyingPercent] = useState(40);
    const [isFreeTest, setIsFreeTest] = useState(false);

    // Subject breakdown state
    const [subjectBreakdown, setSubjectBreakdown] = useState([
        { name: 'Mathematics', questionsCount: 25 },
        { name: 'Reasoning Ability', questionsCount: 25 },
        { name: 'General Knowledge & Current Affairs', questionsCount: 25 },
        { name: 'Marathi Grammar / Verbal', questionsCount: 25 }
    ]);

    const loadExams = async () => {
        setLoading(true);
        const examList = await firestoreEngine.getExams();
        setExams(examList);
        setLoading(false);
    };

    useEffect(() => {
        loadExams();
    }, []);

    const handleOpenModal = (exam = null) => {
        setEditingExam(exam);
        if (exam) {
            setCode(exam.code || exam.id);
            setName(exam.name || exam.title);
            setMedium(exam.medium || 'Marathi/English');
            setDurationMinutes(exam.durationMinutes || 90);
            setNegativeMarkingRate(exam.negativeMarkingRate || 0.25);
            setMinQualifyingPercent(exam.minQualifyingPercent || 40);
            setIsFreeTest(exam.isFreeTest || false);

            if (exam.subjects && Array.isArray(exam.subjects) && exam.subjects.length > 0) {
                setSubjectBreakdown(exam.subjects);
            } else {
                setSubjectBreakdown([
                    { name: 'Mathematics', questionsCount: 25 },
                    { name: 'Reasoning Ability', questionsCount: 25 },
                    { name: 'General Knowledge', questionsCount: 25 },
                    { name: 'Marathi Language', questionsCount: 25 }
                ]);
            }
        } else {
            setCode('MH-POLICE-2026');
            setName('Maharashtra Police Bharti Mega Mock Test');
            setMedium('Marathi/English');
            setDurationMinutes(90);
            setNegativeMarkingRate(0.25);
            setMinQualifyingPercent(40);
            setIsFreeTest(false);
            setSubjectBreakdown([
                { name: 'Mathematics', questionsCount: 25 },
                { name: 'Reasoning Ability', questionsCount: 25 },
                { name: 'General Knowledge', questionsCount: 25 },
                { name: 'Marathi Language', questionsCount: 25 }
            ]);
        }
        setModalOpen(true);
    };

    const handleSubjectChange = (index, field, value) => {
        const updated = [...subjectBreakdown];
        updated[index][field] = field === 'questionsCount' ? parseInt(value, 10) || 0 : value;
        setSubjectBreakdown(updated);
    };

    const handleAddSubject = () => {
        setSubjectBreakdown([...subjectBreakdown, { name: 'New Subject', questionsCount: 10 }]);
    };

    const handleRemoveSubject = (index) => {
        if (subjectBreakdown.length <= 1) return;
        const updated = subjectBreakdown.filter((_, i) => i !== index);
        setSubjectBreakdown(updated);
    };

    const calculatedTotalQuestions = subjectBreakdown.reduce((sum, s) => sum + (s.questionsCount || 0), 0);
    const calculatedTotalMarks = calculatedTotalQuestions;

    const handleSave = async (e) => {
        e.preventDefault();
        const examId = editingExam ? editingExam.id : code.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        const examData = {
            id: examId,
            code,
            name,
            title: name,
            medium,
            durationMinutes: parseInt(durationMinutes, 10),
            totalQuestions: calculatedTotalQuestions,
            totalMarks: calculatedTotalMarks,
            negativeMarkingRate: parseFloat(negativeMarkingRate),
            minQualifyingPercent: parseInt(minQualifyingPercent, 10),
            isFreeTest,
            subjects: subjectBreakdown,
            updatedAt: new Date().toISOString()
        };

        await firestoreEngine.saveExamBlueprint(examData);
        setModalOpen(false);
        await loadExams();
        if (onRefresh) onRefresh();
    };

    const handleDelete = async (examId) => {
        if (!window.confirm('Are you sure you want to delete this exam blueprint? This cannot be undone, and any package still pointing at this exam will no longer unlock anything.')) return;
        await firestoreEngine.deleteExamBlueprint(examId);
        await loadExams();
        if (onRefresh) onRefresh();
    };

    return (
        <div className="card">
            <div className="card-header">
                <div>
                    <h3 className="card-title">Exam Blueprints & Subject Question Distributions</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure exam patterns, duration limits, subject-wise question allocations, and negative marking rates.</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal(null)}>
                    + Create Exam Type
                </button>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Exam Code & Title</th>
                            <th>Access Status</th>
                            <th>Duration</th>
                            <th>Subject Question Distribution</th>
                            <th>Total Marks</th>
                            <th>Negative Marks</th>
                            <th>Passing %</th>
                            <th style={{ minWidth: '220px', whiteSpace: 'nowrap' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading exam patterns from Cloud Firestore...</td></tr>
                        ) : (
                            exams.map(e => (
                                <tr key={e.id}>
                                    <td>
                                        <strong>{e.name}</strong><br />
                                        <small style={{ color: 'var(--text-muted)' }}>{e.code}</small>
                                    </td>
                                    <td>
                                        <span className={`badge ${e.isFreeTest ? 'badge-success' : 'badge-orange'}`}>
                                            {e.isFreeTest ? 'FREE TEST' : 'PAID MOCK'}
                                        </span>
                                    </td>
                                    <td><strong>{e.durationMinutes} Mins</strong></td>
                                    <td style={{ maxWidth: '320px' }}>
                                        <strong>{e.totalQuestions} Questions Total</strong><br />
                                        <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            {e.subjects ? e.subjects.map(s => `${s.name}: ${s.questionsCount}`).join(' | ') : 'General Distribution'}
                                        </small>
                                    </td>
                                    <td><strong>{e.totalMarks} Marks</strong></td>
                                    <td><span className="badge badge-danger">-{e.negativeMarkingRate}</span></td>
                                    <td><span className="badge badge-success">{e.minQualifyingPercent || 40}%</span></td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <div className="action-buttons-group">
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(e)}>
                                                Configure Blueprint
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Exam Blueprint Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingExam ? 'Edit Exam Blueprint & Distribution' : 'Create New Exam Type'}
                maxWidth="740px"
                onSubmit={handleSave}
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Blueprint & Pattern</button>
                    </>
                }
            >
                <div className="form-group form-grid-2col">
                    <div>
                        <label className="form-label">Exam Code</label>
                        <input type="text" className="form-control" required value={code} onChange={e => setCode(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Exam Title Name</label>
                        <input type="text" className="form-control" required value={name} onChange={e => setName(e.target.value)} />
                    </div>
                </div>

                <div className="form-group form-grid-2col">
                    <div>
                        <label className="form-label">Language Medium</label>
                        <input type="text" className="form-control" required value={medium} onChange={e => setMedium(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Test Access Type</label>
                        <select className="form-control" value={isFreeTest ? 'free' : 'paid'} onChange={e => setIsFreeTest(e.target.value === 'free')}>
                            <option value="paid">Paid Test (Requires Purchased Package)</option>
                            <option value="free">Free Test (Accessible to All Students)</option>
                        </select>
                    </div>
                </div>

                <div className="form-group form-grid-3col">
                    <div>
                        <label className="form-label">Duration (Minutes)</label>
                        <input type="number" className="form-control" required min="10" max="300" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Negative Marking Rate</label>
                        <select className="form-control" value={negativeMarkingRate} onChange={e => setNegativeMarkingRate(e.target.value)}>
                            <option value="0">No Negative Marking (0.0)</option>
                            <option value="0.25">1/4th Deduction (-0.25 Marks)</option>
                            <option value="0.33">1/3rd Deduction (-0.33 Marks)</option>
                            <option value="0.5">1/2 Deduction (-0.5 Marks)</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Min Passing Score (%)</label>
                        <input type="number" className="form-control" required min="10" max="90" value={minQualifyingPercent} onChange={e => setMinQualifyingPercent(e.target.value)} />
                    </div>
                </div>

                {/* Subject-wise Question Selection Panel */}
                <div className="form-group" style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Subject-wise Question Breakdown</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Specify exact question count per subject module.</p>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddSubject}>
                            + Add Subject Module
                        </button>
                    </div>

                    {subjectBreakdown.map((sb, idx) => (
                        <div key={idx} className="subject-row-grid">
                            <input 
                                type="text" 
                                className="form-control" 
                                required 
                                value={sb.name} 
                                onChange={e => handleSubjectChange(idx, 'name', e.target.value)}
                                placeholder="Subject Name (e.g. Mathematics)"
                            />
                            <input 
                                type="number" 
                                className="form-control" 
                                required 
                                min="1" 
                                max="200" 
                                value={sb.questionsCount} 
                                onChange={e => handleSubjectChange(idx, 'questionsCount', e.target.value)}
                                placeholder="Qs Count"
                            />
                            <button 
                                type="button" 
                                className="btn btn-danger btn-sm" 
                                onClick={() => handleRemoveSubject(idx)}
                                disabled={subjectBreakdown.length <= 1}
                                style={{ padding: '0.4rem', justifyContent: 'center' }}
                                title="Remove Subject"
                            >
                                ✕
                            </button>
                        </div>
                    ))}

                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800 }}>
                        <span>Total Calculated Exam Questions:</span>
                        <span style={{ color: 'var(--primary)' }}>{calculatedTotalQuestions} Questions ({calculatedTotalMarks} Marks)</span>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
