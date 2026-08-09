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
    const [totalQuestions, setTotalQuestions] = useState(100);
    const [totalMarks, setTotalMarks] = useState(100);
    const [negativeRate, setNegativeRate] = useState(0);
    const [minQualifying, setMinQualifying] = useState(40);

    const loadExams = async () => {
        setLoading(true);
        const loaded = await firestoreEngine.getExams();
        setExams(loaded);
        setLoading(false);
    };

    useEffect(() => {
        loadExams();
    }, []);

    const handleOpenModal = (e = null) => {
        setEditingExam(e);
        if (e) {
            setCode(e.code);
            setName(e.name);
            setMedium(e.medium || 'Marathi & English');
            setDescription(e.description || '');
            setDurationMinutes(e.durationMinutes);
            setTotalQuestions(e.totalQuestions);
            setTotalMarks(e.totalMarks);
            setNegativeRate(e.negativeMarkingRate);
            setMinQualifying(e.minQualifyingPercent || 40);
        } else {
            setCode('MPSC-PSI');
            setName('MPSC Sub-Inspector Written Exam');
            setMedium('Marathi & English');
            setDescription('Official preliminary written test pattern for MPSC PSI recruitment.');
            setDurationMinutes(90);
            setTotalQuestions(100);
            setTotalMarks(100);
            setNegativeRate(0.25);
            setMinQualifying(40);
        }
        setModalOpen(true);
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
            totalQuestions: parseInt(totalQuestions, 10),
            totalMarks: parseInt(totalMarks, 10),
            negativeMarkingRate: parseFloat(negativeRate),
            minQualifyingPercent: parseFloat(minQualifying),
            subjects: editingExam?.subjects || [
                { id: 's1', name: 'Mathematics', questionsCount: Math.floor(totalQuestions / 4), marksPerQuestion: 1 },
                { id: 's2', name: 'General Knowledge', questionsCount: Math.floor(totalQuestions / 4), marksPerQuestion: 1 },
                { id: 's3', name: 'Reasoning', questionsCount: Math.floor(totalQuestions / 4), marksPerQuestion: 1 },
                { id: 's4', name: 'Marathi Grammar', questionsCount: Math.floor(totalQuestions / 4), marksPerQuestion: 1 }
            ]
        };

        await firestoreEngine.saveExamBlueprint(examData);
        setModalOpen(false);
        await loadExams();
    };

    return (
        <div className="card">
            <div className="card-header">
                <div>
                    <h3 className="card-title">Recruitment Exam Blueprints & Patterns</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure official examination test parameters, time limits, and negative marking rates.</p>
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
                            <th>Medium</th>
                            <th>Duration</th>
                            <th>Total Qs</th>
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
                                    <td><span className="badge badge-orange">{e.medium}</span></td>
                                    <td><strong>{e.durationMinutes} Mins</strong></td>
                                    <td>{e.totalQuestions} Qs</td>
                                    <td><strong>{e.totalMarks} M</strong></td>
                                    <td><span className="badge badge-danger">-{e.negativeMarkingRate}</span></td>
                                    <td><span className="badge badge-success">{e.minQualifyingPercent || 40}%</span></td>
                                    <td>
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(e)}>
                                            Configure Pattern
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Exam Blueprint Modal */}
            {modalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-card" style={{ maxWidth: '620px' }}>
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

                            <div className="form-group">
                                <label className="form-label">Language Medium</label>
                                <input type="text" className="form-control" required value={medium} onChange={e => setMedium(e.target.value)} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-control" style={{ minHeight: '60px' }} value={description} onChange={e => setDescription(e.target.value)} />
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Duration (Mins)</label>
                                    <input type="number" className="form-control" required value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Total Qs</label>
                                    <input type="number" className="form-control" required value={totalQuestions} onChange={e => setTotalQuestions(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Total Marks</label>
                                    <input type="number" className="form-control" required value={totalMarks} onChange={e => setTotalMarks(e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Negative Marking Rate</label>
                                    <input type="number" className="form-control" step="0.25" min="0" max="1" value={negativeRate} onChange={e => setNegativeRate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Min Qualifying Cutoff %</label>
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
