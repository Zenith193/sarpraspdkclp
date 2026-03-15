import { useState, useEffect, useRef } from 'react';
import { queueApi } from '../../api/index';
import useAuthStore from '../../store/authStore';

/**
 * Compact queue status indicator for the topbar.
 * Shows a small icon with count when there are pending uploads/failures.
 * Clicking shows a dropdown with the file list.
 */
const QueueStatus = () => {
    const { isAuthenticated } = useAuthStore();
    const [status, setStatus] = useState(null);
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const intervalRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!isAuthenticated) return;

        const poll = async () => {
            try {
                const data = await queueApi.status();
                setStatus(data);
            } catch { /* ignore */ }
        };

        poll();
        intervalRef.current = setInterval(poll, 8000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isAuthenticated]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch file list when dropdown opens
    const handleClick = async () => {
        const newOpen = !open;
        setOpen(newOpen);
        if (newOpen) {
            setLoadingFiles(true);
            try {
                const data = await queueApi.files();
                setFiles(data.files || []);
            } catch { setFiles([]); }
            setLoadingFiles(false);
        }
    };

    if (!status) return null;

    const { totalUploading, totalFailed } = status;
    if (totalUploading === 0 && totalFailed === 0) return null;

    const hasFailure = totalFailed > 0;
    const isUploading = totalUploading > 0;
    const total = totalUploading + totalFailed;

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Pill button */}
            <button
                onClick={handleClick}
                title="Klik untuk lihat daftar file"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full, 20px)',
                    background: hasFailure
                        ? 'rgba(249,115,22,0.15)'
                        : 'rgba(99,102,241,0.15)',
                    color: hasFailure ? '#f97316' : '#818cf8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    border: 'none',
                    outline: 'none',
                    transition: 'all 150ms',
                }}
            >
                {isUploading && (
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{
                        animation: 'queueSpin 1.5s linear infinite',
                        flexShrink: 0,
                    }}>
                        <path d="M10 2a8 8 0 018 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M10 18a8 8 0 01-8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
                    </svg>
                )}
                {hasFailure && !isUploading && (
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M10 6v5M10 14h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                )}
                {isUploading && <span>⬆ {totalUploading}</span>}
                {hasFailure && <span>⚠ {totalFailed}</span>}
            </button>

            {/* Dropdown */}
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 320,
                    maxHeight: 360,
                    overflowY: 'auto',
                    background: 'var(--bg-card, #1e293b)',
                    border: '1px solid var(--border-color, #334155)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                    zIndex: 9999,
                    padding: 0,
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-color, #334155)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                            Sinkronisasi GDrive
                        </span>
                        <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full, 20px)',
                            background: hasFailure ? 'rgba(249,115,22,0.15)' : 'rgba(99,102,241,0.15)',
                            color: hasFailure ? '#f97316' : '#818cf8',
                            fontWeight: 600,
                        }}>
                            {total} file
                        </span>
                    </div>

                    {/* File list */}
                    <div style={{ padding: '4px 0' }}>
                        {loadingFiles ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.8rem' }}>
                                Memuat daftar file...
                            </div>
                        ) : files.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.8rem' }}>
                                Tidak ada file dalam antrian
                            </div>
                        ) : (
                            files.map((f, i) => (
                                <div key={i} style={{
                                    padding: '8px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    borderBottom: i < files.length - 1 ? '1px solid var(--border-color, #1e293b)' : 'none',
                                }}>
                                    {/* Status icon */}
                                    <div style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 'var(--radius-sm, 6px)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        background: f.status === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                                        color: f.status === 'failed' ? '#ef4444' : '#818cf8',
                                        fontSize: '0.7rem',
                                    }}>
                                        {f.status === 'failed' ? '✕' : (
                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ animation: 'queueSpin 1.5s linear infinite' }}>
                                                <path d="M10 2a8 8 0 018 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                            </svg>
                                        )}
                                    </div>
                                    {/* File info */}
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{
                                            fontSize: '0.78rem',
                                            color: 'var(--text-primary, #f1f5f9)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>
                                            {f.name}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary, #64748b)' }}>
                                            {f.type}
                                        </div>
                                    </div>
                                    {/* Status badge */}
                                    <span style={{
                                        fontSize: '0.65rem',
                                        padding: '2px 6px',
                                        borderRadius: 'var(--radius-full, 20px)',
                                        background: f.status === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                                        color: f.status === 'failed' ? '#ef4444' : '#3b82f6',
                                        fontWeight: 600,
                                        flexShrink: 0,
                                    }}>
                                        {f.status === 'failed' ? 'Gagal' : 'Upload'}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* CSS animation */}
            <style>{`
                @keyframes queueSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default QueueStatus;
