import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';

export const ExamConfigList = () => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingExam, setEditingExam] = useState(null);

    // Form state
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [medium, setMedium] = useState('Marathi & English');
    const [description, setDescription] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(90);
    const [negativeRate, setNegativeRate] = useState(0);
    const [minQualifying, setMinQualifying] = useState(40);
    const [isFreeTest, setIsFreeTest] = useState(false);

    // Subject-wise question distribution list
    const [subjectsList, setSubjectsList] = useState([
        { id: 's1', name: 'Marathi Grammar', questionsCount: 25, marksPerQuestion: 1 },
        { id: 's2', name: 'Mathematics', questionsCount: 25, marksPerQuestion: 1 },
        { id: 's3', name: 'Intelligence Test / Reasoning', questionsCount: 25, marksPerQuestion: 1 },
        { id: 's4', name: 'General Knowledge & Current Affairs', questionsCount: 25, marksPerQuestion: 1 }
    ]);

    const loadExams = async () => {
        setLoading(true);
        const loaded = await firestoreEngine.getExams();
        setExams(loaded);
        setLoading(false);
    };

    useEffect(() => {
        loadExams();
    }, []);

    // Calculate dynamic total questions & marks
    const calculatedTotalQuestions = subjectsList.reduce((sum, s) => sum + (parseInt(s.questionsCount, 10) || 0), 0);
    const calculatedTotalMarks = subjectsList.reduce((sum, s) => sum + ((parseInt(s.questionsCount, 10) || 0) * (parseFloat(s.marksPerQuestion) || 1)), 0);

    const handleOpenModal = (e = null) => {
        setEditingExam(e);
        if (e) {
            setCode(e.code);
            setName(e.name);
            setMedium(e.medium || 'Marathi & English');
            setDescription(e.description || '');
            setDurationMinutes(e.durationMinutes);
            setNegativeRate(e.negativeMarkingRate);
            setMinQualifying(e.minQualifyingPercent || 40);
            setIsFreeTest(e.isFreeTest || false);
            setSubjectsList(e.subjects && e.subjects.length > 0 ? e.subjects : [
                { id: 's1', name: 'Marathi Grammar', questionsCount: 25, marksPerQuestion: 1 },
                { id: 's2', name: 'Mathematics', questionsCount: 25, marksPerQuestion: 1 },
                { id: 's3', name: 'Intelligence Test / Reasoning', questionsCount: 25, marksPerQuestion: 1 },
                { id: 's4', name: 'General Knowledge & Current Affairs', questionsCount: 25, marksPerQuestion: 1 }
            ]);
        } else {
            setCode('PB-MOCK');
            setName('Maharashtra Police Bharti Mock');
            setMedium('Marathi & English');
            setDescription('Official written test pattern with subject-wise question distribution.');
            setDurationMinutes(90);
            setNegativeRate(0);
            setMinQualifying(40);
            setIsFreeTest(false);
            setSubjectsList([
                { id: 's1', name: 'Marathi Grammar', questionsCount: 25, marksPerQuestion: 1 },
                { id: 's2', name: 'Mathematics', questionsCount: 25, marksPerQuestion: 1 },
                { id: 's3', name: 'Intelligence Test / Reasoning', questionsCount: 25, marksPerQuestion: 1 },
                { id: 's4', name: 'General Knowledge & Current Affairs', questionsCount: 25, marksPerQuestion: 1 }
            ]);
        }
        setModalOpen(true);
    };

    const handleSubjectChange = (idx, field, val) => {
        const updated = [...subjectsList];
        updated[idx] = { ...updated[idx], [field]: val };
        setSubjectsList(updated);
    };

    const handleAddSubject = () => {
        setSubjectsList([
            ...subjectsList,
            { id: 's_' + Date.now(), name: 'New Subject', questionsCount: 15, marksPerQuestion: 1 }
        ]);
    };

    const handleRemoveSubject = (idx) => {
        if (subjectsList.length <= 1) return;
        setSubjectsList(subjectsList.filter((_, i) => i !== idx));
    };

    const handleSave = async (evt) => {
        evt.preventDefault();
        const examId = editingExam ? editingExam.id : 'exam_' + Date.now();
        const examData = {
            id: examId,
            code,
            name,
            medium,
            description,
            durationMinutes: parseInt(durationMinutes, 10),
            totalQuestions: calculatedTotalQuestions,
            totalMarks: calculatedTotalMarks,
            negativeMarkingRate: parseFloat(negativeRate),
            minQualifyingPercent: parseFloat(minQualifying),
            isFreeTest,
            subjects: subjectsList.map(s => ({
                id: s.id,
                name: s.name,
                questionsCount: parseInt(s.questionsCount, 10) || 0,
                marksPerQuestion: parseFloat(s.marksPerQuestion) || 1
            }))
        };

        await firestoreEngine.saveExamBlueprint(examData);
        setModalOpen(false);
        await loadExams();
    };

    return (
        <div className="card">
            <div className="card-header">
                <div>
                    <h3 className="card-title">Recruitment Exam Blueprints & Subject Distributions</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure subject-wise question allocations, time limits, and free/paid access flags.</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal(null)}>
                    Create New Exam Type
                </button>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Exam Code & Title</th>
                            <th>Test Access</th>
                            <th>Duration</th>
                            <th>Total Qs (Subject Split)</th>
                            <th>Total Marks</th>
                            <th>Negative Rate</th>
                            <th>Min Qualifying</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading exam patterns...</td></tr>
                        ) : (
                            exams.map(e => (
                                <tr key={e.id}>
                                    <td>
                                        <strong>{e.name}</strong><br />
                                        <small style={{ color: 'var(--text-muted)' }}>{e.code}</small>
                                    </td>
                                    <td>
                                        <span className={`badge ${e.isFreeTest ? 'badge-success' : 'badge-orange'}`}>
                                            {e.isFreeTest ? 'FREE TEST' : 'PAID TEST'}
                                        </span>
                                    </td>
                                    <td><strong>{e.durationMinutes} Mins</strong></td>
                                    <td>
                                        <strong>{e.totalQuestions} Qs</strong><br />
                                        <small style={{ color: 'var(--text-muted)' }}>
                                            {e.subjects ? e.subjects.map(s => `${s.name}: ${s.questionsCount}`).join(' | ') : ''}
                                        </small>
                                    </td>
                                    <td><strong>{e.totalMarks} M</strong></td>
                                    <td><span className="badge badge-danger">-{e.negativeMarkingRate}</span></td>
                                    <td><span className="badge badge-success">{e.minQualifyingPercent || 40}%</span></td>
                                    <td>
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(e)}>
                                            Configure Blueprint
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Exam Blueprint Modal with Subject-wise Question Distribution */}
            {modalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-card" style={{ maxWidth: '720px' }}>
                        <div className="modal-header" style={{ marginBottom: '1.25rem' }}>
                            <h3 className="card-title">{editingExam ? 'Edit Exam Blueprint' : 'Create New Exam Type'}</h3>
                            <button className="modal-close" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Exam Code</label>
                                    <input type="text" className="form-control" required value={code} onChange={e => setCode(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Exam Title Name</label>
                                    <input type="text" className="form-control" required value={name} onChange={e => setName(e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-control" style={{ minHeight: '60px' }} value={description} onChange={e => setDescription(e.target.value)} />
                            </div>

                            {/* Subject-wise Question Distribution Panel */}
                            <div className="form-group" style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Subject-wise Question Distribution</h4>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Specify exact question counts per subject section.</p>
                                    </div>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddSubject}>
                                        + Add Subject
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {subjectsList.map((s, idx) => (
                                        <div key={s.id || idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: '0.75rem', alignItems: 'center' }}>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                placeholder="Subject Name" 
                                                value={s.name} 
                                                onChange={e => handleSubjectChange(idx, 'name', e.target.value)}
                                            />
                                            <input 
                                                type="number" 
                                                className="form-control" 
                                                placeholder="Question Count" 
                                                min="1"
                                                value={s.questionsCount} 
                                                onChange={e => handleSubjectChange(idx, 'questionsCount', e.target.value)}
                                            />
                                            <input 
                                                type="number" 
                                                className="form-control" 
                                                placeholder="Marks / Q" 
                                                step="0.5"
                                                min="0.5"
                                                value={s.marksPerQuestion} 
                                                onChange={e => handleSubjectChange(idx, 'marksPerQuestion', e.target.value)}
                                            />
                                            <button 
                                                type="button" 
                                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 800 }}
                                                onClick={() => handleRemoveSubject(idx)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.9rem' }}>
                                    <span>Calculated Total Questions: <strong style={{ color: 'var(--primary)' }}>{calculatedTotalQuestions} Qs</strong></span>
                                    <span>Calculated Total Marks: <strong style={{ color: 'var(--success)' }}>{calculatedTotalMarks} M</strong></span>
                                </div>
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Duration (Mins)</label>
                                    <input type="number" className="form-control" required value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Negative Marking Rate</label>
                                    <input type="number" className="form-control" step="0.25" min="0" max="1" value={negativeRate} onChange={e => setNegativeRate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Min Qualifying %</label>
                                    <input type="number" className="form-control" min="10" max="90" value={minQualifying} onChange={e => setMinQualifying(e.target.value)} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Blueprint</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
