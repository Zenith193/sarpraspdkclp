import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, CheckCircle, XCircle } from 'lucide-react';

/**
 * Reusable confirmation modal with Enter key support and premium styling.
 * 
 * Props:
 *   isOpen: boolean
 *   title: string (default: 'Konfirmasi')
 *   message: string | JSX
 *   confirmText: string (default: 'Ya, Hapus')
 *   cancelText: string (default: 'Batal')
 *   variant: 'danger' | 'warning' | 'success' (default: 'danger')
 *   onConfirm: () => void
 *   onCancel: () => void
 */
const ConfirmModal = ({ isOpen, title = 'Konfirmasi', message, confirmText = 'Ya, Hapus', cancelText = 'Batal', variant = 'danger', onConfirm, onCancel }) => {
    const confirmBtnRef = useRef(null);

    // Focus confirm button on open & handle Enter/Escape keys
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => confirmBtnRef.current?.focus(), 100);

        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm?.();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancel?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onConfirm, onCancel]);

    if (!isOpen) return null;

    const variants = {
        danger: {
            iconBg: 'rgba(239, 68, 68, 0.1)',
            iconColor: 'var(--accent-red)',
            Icon: Trash2,
            btnBg: 'var(--accent-red)',
        },
        warning: {
            iconBg: 'rgba(249, 115, 22, 0.1)',
            iconColor: 'var(--accent-orange)',
            Icon: AlertTriangle,
            btnBg: 'var(--accent-orange)',
        },
        success: {
            iconBg: 'rgba(34, 197, 94, 0.1)',
            iconColor: 'var(--accent-green)',
            Icon: CheckCircle,
            btnBg: 'var(--accent-green)',
        },
    };

    const v = variants[variant] || variants.danger;
    const { Icon } = v;

    return (
        <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 9999 }}>
            <div className="modal" style={{ maxWidth: 420, animation: 'slideUp 0.2s ease' }} onClick={e => e.stopPropagation()}>
                <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                    {/* Icon */}
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: v.iconBg, color: v.iconColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                        animation: 'pulse 0.3s ease',
                    }}>
                        <Icon size={32} />
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                        {title}
                    </h3>

                    {/* Message */}
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
                        {message}
                    </p>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button
                            className="btn btn-ghost"
                            onClick={onCancel}
                            style={{ minWidth: 90 }}
                        >
                            {cancelText}
                        </button>
                        <button
                            ref={confirmBtnRef}
                            className="btn btn-primary"
                            onClick={onConfirm}
                            style={{
                                background: v.btnBg,
                                borderColor: v.btnBg,
                                minWidth: 110,
                            }}
                        >
                            {confirmText}
                        </button>
                    </div>

                    {/* Hint */}
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary, rgba(255,255,255,0.3))', marginTop: 16 }}>
                        Tekan <kbd style={{ 
                            background: 'var(--bg-secondary)', 
                            padding: '2px 6px', 
                            borderRadius: 4, 
                            fontSize: 10, 
                            border: '1px solid var(--border-primary)',
                        }}>Enter</kbd> untuk konfirmasi atau <kbd style={{
                            background: 'var(--bg-secondary)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            border: '1px solid var(--border-primary)',
                        }}>Esc</kbd> untuk batal
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
