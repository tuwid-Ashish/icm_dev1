import React, { useState } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { Modal } from '../common/Modal.jsx';

// A small "?" beside a question. A student who thinks the question, an option or
// the answer key is wrong taps it, says what is wrong, and the report goes to the
// admin's "Reported Questions" tab.
//
// Safe to use during a test: it only opens a dialog. It does not touch the
// timer, the answers or the question palette.

const REASONS = [
    { id: 'wrong_answer', key: 'report_q_reason_wrong_answer' },
    { id: 'wrong_question', key: 'report_q_reason_wrong_question' },
    { id: 'wrong_option', key: 'report_q_reason_wrong_option' },
    { id: 'unclear', key: 'report_q_reason_unclear' },
    { id: 'other', key: 'report_q_reason_other' }
];

// Questions reported in this browser session, so the button stays marked when the
// student moves on and comes back.
const reportedThisSession = new Set();

export const ReportQuestionButton = ({ questionId, examId }) => {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(null);   // null | 'sent' | 'already'
    const [reported, setReported] = useState(() => reportedThisSession.has(questionId));

    const openDialog = () => {
        setError('');
        setReason('');
        setNote('');
        setDone(reported ? 'already' : null);
        setOpen(true);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!reason) {
            setError(t('report_q_pick_reason'));
            return;
        }
        setBusy(true);
        setError('');
        try {
            const res = await firestoreEngine.reportQuestion({ questionId, reason, note: note.trim(), examId });
            reportedThisSession.add(questionId);
            setReported(true);
            setDone(res.alreadyReported ? 'already' : 'sent');
        } catch (err) {
            setError(err.code === 'too-many' ? t('report_q_limit') : t('report_q_error'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={openDialog}
                title={reported ? t('report_q_already') : t('report_q_button_title')}
                aria-label={t('report_q_button_title')}
                style={{
                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', fontWeight: 800, lineHeight: 1, cursor: 'pointer', padding: 0,
                    border: `1.5px solid ${reported ? 'var(--success)' : 'var(--border-strong, var(--text-muted))'}`,
                    background: reported ? 'var(--success-bg)' : 'transparent',
                    color: reported ? 'var(--success)' : 'var(--text-muted)'
                }}
            >
                {reported ? '✓' : '?'}
            </button>

            <Modal
                isOpen={open}
                onClose={() => !busy && setOpen(false)}
                title={t('report_q_title')}
                subtitle={done ? undefined : t('report_q_intro')}
                maxWidth="520px"
                onSubmit={done ? undefined : submit}
                footer={
                    done ? (
                        <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>{t('report_q_close')}</button>
                    ) : (
                        <>
                            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>{t('report_q_cancel')}</button>
                            <button type="submit" className="btn btn-primary" disabled={busy}>
                                {busy ? t('report_q_sending') : t('report_q_submit')}
                            </button>
                        </>
                    )
                }
            >
                {done ? (
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0 }}>
                        {done === 'sent' ? t('report_q_thanks') : t('report_q_already')}
                    </p>
                ) : (
                    <div>
                        {error && (
                            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '1rem' }}>
                                {error}
                            </div>
                        )}
                        <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                            {REASONS.map(r => (
                                <label key={r.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.92rem' }}>
                                    <input type="radio" name="report-reason" checked={reason === r.id} onChange={() => setReason(r.id)} style={{ marginTop: '0.25rem' }} />
                                    <span>{t(r.key)}</span>
                                </label>
                            ))}
                        </div>
                        <label className="form-label">{t('report_q_note_label')}</label>
                        <textarea
                            className="form-control"
                            style={{ minHeight: '70px' }}
                            maxLength={500}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder={t('report_q_note_placeholder')}
                        />
                    </div>
                )}
            </Modal>
        </>
    );
};
