import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';

/**
 * Floating WhatsApp Chat Support Widget for Student Portal
 * Positioned in bottom-right corner with direct wa.me chat link.
 */
export const WhatsAppFloatButton = () => {
    // const [upiPhone, setUpiPhone] = useState('');
    const [hovered, setHovered] = useState(false);

    // useEffect(() => {
    //     let isMounted = true;
    //     async function fetchPaymentSettings() {
    //         try {
    //             const settings = await firestoreEngine.getMerchantPaymentSettings();
    //             if (isMounted && settings) {
    //                 const phoneMatch = (settings.upiId || '').match(/\d{10}/);
    //                 if (phoneMatch) setUpiPhone(phoneMatch[0]);
    //             }
    //         } catch (err) {
    //             // Fallback gracefully
    //         }
    //     }
    //     fetchPaymentSettings();
    //     return () => { isMounted = false; };
    // }, []);

    // Default support WhatsApp number or extracted merchant number
    const phoneNumber ='919850845094';
    const whatsappUrl = `https://wa.me/${phoneNumber.startsWith('91') ? phoneNumber : '91' + phoneNumber}?text=${encodeURIComponent('Hello Sigma vardi Support, I need assistance with my account/tests.')}`;

    return (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
            {hovered && (
                <div style={{
                    position: 'absolute',
                    right: '65px',
                    bottom: '8px',
                    whiteSpace: 'nowrap',
                    background: '#111827',
                    color: '#ffffff',
                    padding: '0.4rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    💬 Need Help? Chat on WhatsApp
                </div>
            )}
            <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#25D366',
                    boxShadow: '0 8px 24px rgba(37, 211, 102, 0.45)',
                    color: '#ffffff',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: hovered ? 'scale(1.1)' : 'scale(1)',
                    textDecoration: 'none'
                }}
            >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
            </a>
        </div>
    );
};
