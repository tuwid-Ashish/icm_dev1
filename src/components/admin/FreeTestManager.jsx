import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { Modal } from '../common/Modal.jsx';
import { EXAM_BATCHES } from '../../constants/examBatches.js';

// A blueprint row names its subject by CODE, chosen from subject_codes —
// same contract as ExamConfigList. This used to be a free-text box, which is
// what forced examEngine to fuzzy-match blueprint text against question data.
const blueprintRow = (subjectCode, questionsCount = 5) => ({
    subjectCode,
    questionsCount,
    marksPerQuestion: 1
});

// Dedicated admin surface for free-test exams — kept separate from
// ExamConfigList (paid exam blueprints) per client requirement: free tests
// "should not come under exam test." Same underlying `exams` collection
// (isFreeTest: true), but its own list/create/edit/delete flow so admins
// can add more free tests over time without them mixing into the paid
// blueprint list.
export const FreeTestManager = ({ onRefresh }) => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingExam, setEditingExam] = useState(null);

    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [medium, setMedium] = useState('Marathi/English');
    const [durationMinutes, setDurationMinutes] = useState(20);
    const [negativeMarkingRate, setNegativeMarkingRate] = useState(0);
    const [minQualifyingPercent, setMinQualifyingPercent] = useState(40);
    const [freeAttemptLimit, setFreeAttemptLimit] = useState(1);
    const [questionBatch, setQuestionBatch] = useState(EXAM_BATCHES[0]);

    const [subjectCodes, setSubjectCodes] = useState([]);
    const [availability, setAvailability] = useState({});
    const [subjectBreakdown, setSubjectBreakdown] = useState([
        blueprintRow('M1'), blueprintRow('M3'), blueprintRow('M6'), blueprintRow('M2')
    ]);

    const loadExams = async () => {
        setLoading(true);
        const [examList, codes] = await Promise.all([
            firestoreEngine.getExams(),
            firestoreEngine.getSubjectCodes()
        ]);
        setExams(examList.filter(e => e.isFreeTest));
        setSubjectCodes(codes || []);
        setLoading(false);

        // Live per-subject availability, so a blueprint asking for more than
        // the bank holds is visible here instead of at exam time.
        const counts = await firestoreEngine.getQuestionCountsBySubject((codes || []).map(c => c.code));
        setAvailability(counts);
    };

    const labelForCode = (codeValue) => {
        const hit = subjectCodes.find(s => s.code === codeValue);
        return hit ? `${hit.code} — ${hit.name}` : codeValue;
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
            setDurationMinutes(exam.durationMinutes || 20);
            setNegativeMarkingRate(exam.negativeMarkingRate || 0);
            setMinQualifyingPercent(exam.minQualifyingPercent || 40);
            setFreeAttemptLimit(exam.freeAttemptLimit || 1);
            setQuestionBatch(exam.questionBatch || EXAM_BATCHES[0]);

            if (exam.subjects && Array.isArray(exam.subjects) && exam.subjects.length > 0) {
                // `s.name` is the pre-migration field, which also held the code.
                setSubjectBreakdown(exam.subjects.map(s => ({
                    subjectCode: s.subjectCode || s.name || '',
                    questionsCount: parseInt(s.questionsCount, 10) || 0,
                    marksPerQuestion: s.marksPerQuestion || 1
                })));
            } else {
                setSubjectBreakdown([blueprintRow('M1'), blueprintRow('M3'), blueprintRow('M6'), blueprintRow('M2')]);
            }
        } else {
            setCode('FREE-TEST-2026');
            setName('New Free Test');
            setMedium('Marathi/English');
            setDurationMinutes(20);
            setNegativeMarkingRate(0);
            setMinQualifyingPercent(40);
            setFreeAttemptLimit(1);
            setQuestionBatch(EXAM_BATCHES[0]);
            setSubjectBreakdown([blueprintRow('M1'), blueprintRow('M3'), blueprintRow('M6'), blueprintRow('M2')]);
        }
        setModalOpen(true);
    };

    const handleSubjectChange = (index, field, value) => {
        // Copy the edited row rather than mutating the object held in state.
        const updated = subjectBreakdown.map((row, i) => (
            i === index
                ? { ...row, [field]: (field === 'questionsCount' || field === 'marksPerQuestion') ? parseFloat(value) || 0 : value }
                : row
        ));
        setSubjectBreakdown(updated);
    };

    const handleAddSubject = () => {
        const used = new Set(subjectBreakdown.map(s => s.subjectCode));
        const nextCode = (subjectCodes.find(s => !used.has(s.code)) || subjectCodes[0])?.code || '';
        setSubjectBreakdown([...subjectBreakdown, blueprintRow(nextCode)]);
    };

    const handleRemoveSubject = (index) => {
        if (subjectBreakdown.length <= 1) return;
        setSubjectBreakdown(subjectBreakdown.filter((_, i) => i !== index));
    };

    const calculatedTotalQuestions = subjectBreakdown.reduce((sum, s) => sum + (s.questionsCount || 0), 0);
    // A subject whose count could not be read is assumed available, so a failed
    // lookup never fabricates a shortfall warning.
    const deliverableTotal = subjectBreakdown.reduce((sum, s) => {
        const have = availability[s.subjectCode];
        const want = s.questionsCount || 0;
        return sum + (have === undefined ? want : Math.min(want, have));
    }, 0);
    const calculatedTotalMarks = subjectBreakdown.reduce((sum, s) => sum + (s.questionsCount || 0) * (s.marksPerQuestion || 1), 0);

    const handleSave = async (e) => {
        e.preventDefault();
        // Opaque, permanent id — never derived from the display code. Slugifying
        // the code is what produced mh_police_2026 for an exam whose real id was
        // pb, stranding the purchases that referenced it.
        const examId = editingExam
            ? editingExam.id
            : 'exam_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

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
            isFreeTest: true,
            freeAttemptLimit: parseInt(freeAttemptLimit, 10) || 1,
            questionBatch,
            subjects: subjectBreakdown,
            updatedAt: new Date().toISOString()
        };

        await firestoreEngine.saveExamBlueprint(examData);
        setModalOpen(false);
        await loadExams();
        if (onRefresh) onRefresh();
    };

    const handleDelete = async (examId) => {
        if (!window.confirm('Are you sure you want to delete this free test? This cannot be undone.')) return;
        await firestoreEngine.deleteExamBlueprint(examId);
        await loadExams();
        if (onRefresh) onRefresh();
    };

    return (
        <div className="card">
            <div className="card-header">
                <div>
                    <h3 className="card-title">Free Tests</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Manage free-preview tests separately from paid exam blueprints — students see these only on the dedicated Free Tests page, never in Exam Catalog or the public homepage.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal(null)}>
                    + Create Free Test
                </button>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Free Test Code & Title</th>
                            <th>Duration</th>
                            <th>Subject Question Distribution</th>
                            <th>Total Marks</th>
                            <th>Allowed Attempts</th>
                            <th style={{ minWidth: '220px', whiteSpace: 'nowrap' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading free tests from Cloud Firestore...</td></tr>
                        ) : exams.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No free tests configured yet.</td></tr>
                        ) : (
                            exams.map(e => (
                                <tr key={e.id}>
                                    <td>
                                        <strong>{e.name}</strong><br />
                                        <small style={{ color: 'var(--text-muted)' }}>{e.code}</small>
                                    </td>
                                    <td><strong>{e.durationMinutes} Mins</strong></td>
                                    <td style={{ maxWidth: '320px' }}>
                                        <strong>{e.totalQuestions} Questions Total</strong><br />
                                        <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            {e.subjects ? e.subjects.map(s => `${labelForCode(s.subjectCode || s.name)}: ${s.questionsCount}`).join(' | ') : 'General Distribution'}
                                        </small>
                                    </td>
                                    <td><strong>{e.totalMarks} Marks</strong></td>
                                    <td><span className="badge badge-success">{e.freeAttemptLimit || 1} attempt{(e.freeAttemptLimit || 1) === 1 ? '' : 's'}</span></td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <div className="action-buttons-group">
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(e)}>
                                                Configure
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

            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingExam ? 'Edit Free Test' : 'Create New Free Test'}
                maxWidth="740px"
                onSubmit={handleSave}
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Free Test</button>
                    </>
                }
            >
                <div className="form-group form-grid-2col">
                    <div>
                        <label className="form-label">Free Test Code</label>
                        <input type="text" className="form-control" required value={code} onChange={e => setCode(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Free Test Title</label>
                        <input type="text" className="form-control" required value={name} onChange={e => setName(e.target.value)} />
                    </div>
                </div>

                <div className="form-group form-grid-2col">
                    <div>
                        <label className="form-label">Language Medium</label>
                        <input type="text" className="form-control" required value={medium} onChange={e => setMedium(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Allowed Attempts per Student</label>
                        <input type="number" className="form-control" required min="1" max="20" value={freeAttemptLimit} onChange={e => setFreeAttemptLimit(e.target.value)} />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Question Pool (Exam Board)</label>
                    <select className="form-control" value={questionBatch} onChange={e => setQuestionBatch(e.target.value)}>
                        {EXAM_BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        Which board's question bank this free test previews from.
                    </p>
                </div>

                <div className="form-group form-grid-3col">
                    <div>
                        <label className="form-label">Duration (Minutes)</label>
                        <input type="number" className="form-control" required min="5" max="300" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} />
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

                <div className="form-group" style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Subject-wise Question Breakdown</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keep this short — a free test is a preview, not a full mock.</p>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddSubject}>
                            + Add Subject Module
                        </button>
                    </div>

                    <div className="subject-row-grid" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        <span>Subject Name</span>
                        <span>Qs Count</span>
                        <span>Marks/Q</span>
                        <span></span>
                    </div>

                    {subjectBreakdown.map((sb, idx) => {
                        // undefined = count unreadable; 0 = genuinely none.
                        const have = availability[sb.subjectCode];
                        const want = sb.questionsCount || 0;
                        const isShort = have !== undefined && want > have;
                        return (
                        <div key={idx} className="subject-row-grid">
                            <div style={{ minWidth: 0 }}>
                                <select
                                    className="form-control"
                                    required
                                    value={sb.subjectCode || ''}
                                    onChange={e => handleSubjectChange(idx, 'subjectCode', e.target.value)}
                                >
                                    <option value="" disabled>Select subject…</option>
                                    {subjectCodes.map(s => (
                                        <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                                    ))}
                                    {sb.subjectCode && !subjectCodes.some(s => s.code === sb.subjectCode) && (
                                        <option value={sb.subjectCode}>{sb.subjectCode} — (unknown code)</option>
                                    )}
                                </select>
                                <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.72rem', fontWeight: isShort ? 700 : 400, color: isShort ? 'var(--danger)' : 'var(--text-muted)' }}>
                                    {have === undefined
                                        ? 'availability unknown'
                                        : isShort
                                            ? `only ${have} available — short by ${want - have}`
                                            : `${have} available`}
                                </small>
                            </div>
                            <input
                                type="number"
                                className="form-control"
                                required
                                min="1"
                                max="50"
                                value={sb.questionsCount}
                                onChange={e => handleSubjectChange(idx, 'questionsCount', e.target.value)}
                                placeholder="Qs Count"
                            />
                            <input
                                type="number"
                                className="form-control"
                                required
                                min="0.25"
                                max="20"
                                step="0.25"
                                value={sb.marksPerQuestion || 1}
                                onChange={e => handleSubjectChange(idx, 'marksPerQuestion', e.target.value)}
                                placeholder="Marks/Q"
                                title="Marks per Question"
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
                        );
                    })}

                    {deliverableTotal < calculatedTotalQuestions && (
                        <div style={{ marginTop: '0.85rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                            <strong>This paper cannot be filled.</strong> The question bank can supply{' '}
                            {deliverableTotal} of the {calculatedTotalQuestions} questions configured — students would
                            sit a paper {calculatedTotalQuestions - deliverableTotal} question
                            {calculatedTotalQuestions - deliverableTotal === 1 ? '' : 's'} short. Add questions for the
                            subjects marked above, or lower their counts.
                        </div>
                    )}

                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800 }}>
                        <span>Total Calculated Exam Questions:</span>
                        <span style={{ color: 'var(--primary)' }}>{calculatedTotalQuestions} Questions ({calculatedTotalMarks} Marks)</span>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
