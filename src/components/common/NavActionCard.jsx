import React from 'react';

/**
 * Reusable post-login navigation card — color-coded left border, icon badge,
 * title + description, and a trailing arrow to signal it's clickable.
 * Matches the client's reference dashboard design so the same visual
 * language can be reused across every post-login page, not just one.
 */
export const NavActionCard = ({ icon, color, title, description, onClick }) => (
    <div
        className="nav-action-card"
        style={{ borderLeftColor: color }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
    >
        <span className="nav-action-icon" style={{ background: `${color}1A`, color }}>
            {icon}
        </span>
        <span className="nav-action-text">
            <span className="nav-action-title">{title}</span>
            <span className="nav-action-desc">{description}</span>
        </span>
        <span className="nav-action-arrow">›</span>
    </div>
);
