import React, { useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { parseMixedContent } from '../../utils/mathContent.js';

/**
 * Universal MathRenderer Component
 * Parses mixed text + LaTeX mathematics ($...$, $$...$$, \(...\), \[...\])
 * Renders HTML safely using KaTeX with responsive overflow scrolling for mobile devices.
 */
export const MathRenderer = ({ text = '', imageUrl = null, images = [], className = '', style = {} }) => {
    const [brokenUrls, setBrokenUrls] = useState({});

    if (!text && !imageUrl && (!images || images.length === 0)) {
        return null;
    }

    const renderMixedContent = (contentStr) => {
        if (!contentStr) return null;

        const parts = parseMixedContent(contentStr);

        return parts.map((part, idx) => {
            if (part.type === 'text') {
                return <span key={idx}>{part.value}</span>;
            } else {
                try {
                    const html = katex.renderToString(part.latex, {
                        displayMode: part.displayMode,
                        throwOnError: false
                    });
                    return (
                        <span
                            key={idx}
                            style={{
                                display: part.displayMode ? 'block' : 'inline-block',
                                margin: part.displayMode ? '0.5rem 0' : '0 0.2rem',
                                maxWidth: '100%',
                                overflowX: 'auto',
                                verticalAlign: 'middle'
                            }}
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    );
                } catch (e) {
                    return <code key={idx} style={{ color: 'var(--danger)' }}>{part.latex}</code>;
                }
            }
        });
    };

    const imageList = [];
    if (imageUrl) imageList.push(imageUrl);
    if (Array.isArray(images)) {
        images.forEach(img => {
            const url = typeof img === 'string' ? img : img?.url;
            if (url && !imageList.includes(url)) imageList.push(url);
        });
    }

    return (
        <div className={`math-renderer-container ${className}`} style={{ width: '100%', wordBreak: 'break-word', ...style }}>
            {/* Render Question / Content Text & Equations */}
            {text && <div style={{ fontSize: 'inherit', lineHeight: 1.6 }}>{renderMixedContent(text)}</div>}

            {/* Render Attached Diagrams & Images */}
            {imageList.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.75rem' }}>
                    {imageList.filter(url => !brokenUrls[url]).map((url, i) => (
                        <div key={url} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', padding: '0.35rem' }}>
                            <img
                                src={url}
                                alt={`Question diagram ${i + 1}`}
                                style={{ maxHeight: '240px', maxWidth: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', display: 'block' }}
                                onError={() => setBrokenUrls(prev => (prev[url] ? prev : { ...prev, [url]: true }))}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
