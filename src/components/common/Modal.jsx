import React from 'react';

export const Modal = ({
    isOpen,
    onClose,
    title,
    subtitle,
    maxWidth = '680px',
    children,
    footer,
    onSubmit
}) => {
    if (!isOpen) return null;

    const modalInner = (
        <div className="modal-card" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
            
            {title && (
                <div className="modal-header">
                    <div>
                        <h3 className="card-title">{title}</h3>
                        {subtitle && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{subtitle}</p>}
                    </div>
                </div>
            )}

            {onSubmit ? (
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
                    <div className="modal-body">
                        {children}
                    </div>
                    {footer && <div className="modal-footer">{footer}</div>}
                </form>
            ) : (
                <>
                    <div className="modal-body">
                        {children}
                    </div>
                    {footer && <div className="modal-footer">{footer}</div>}
                </>
            )}
        </div>
    );

    return (
        <div className="modal-backdrop" onClick={onClose}>
            {modalInner}
        </div>
    );
};
