import { useState, useEffect, useRef } from 'react';
import { queueApi } from '../../api/index';
import useAuthStore from '../../store/authStore';

/**
 * Floating queue status indicator.
 * Auto-appears when there are pending uploads/deletions.
 * Auto-hides when queue is empty.
 */
const QueueStatus = () => {
    const { isAuthenticated } = useAuthStore();
    const [status, setStatus] = useState(null);
    const [visible, setVisible] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const intervalRef = useRef(null);
    const hideTimerRef = useRef(null);

    useEffect(() => {
        if (!isAuthenticated) return;

        const poll = async () => {
            try {
                const data = await queueApi.status();
                setStatus(data);
                if (data.totalUploading > 0 || data.totalFailed > 0) {
                    setVisible(true);
                    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
                } else if (visible) {
                    // Auto-hide after 3 seconds when done
                    if (!hideTimerRef.current) {
                        hideTimerRef.current = setTimeout(() => {
                            setVisible(false);
                            hideTimerRef.current = null;
                        }, 3000);
                    }
                }
            } catch { /* ignore */ }
        };

        poll();
        intervalRef.current = setInterval(poll, 5000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [isAuthenticated]);

    if (!visible || !status) return null;

    const { totalUploading, totalFailed } = status;
    const isDone = totalUploading === 0 && totalFailed === 0;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {/* Floating indicator */}
            <div
                onClick={() => setMinimized(m => !m)}
                style={{
                    background: isDone
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : totalFailed > 0
                            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                            : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    borderRadius: minimized ? '50%' : '16px',
                    padding: minimized ? '12px' : '14px 20px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    backdropFilter: 'blur(20px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    minWidth: minimized ? '48px' : '200px',
                    maxWidth: '320px',
                    userSelect: 'none',
                }}
            >
                {/* Sync icon */}
                <div style={{
                    width: '24px', height: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    {isDone ? (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M4 10l4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{
                            animation: 'queueSpin 1.5s linear infinite',
                        }}>
                            <path d="M10 2a8 8 0 018 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                            <path d="M10 18a8 8 0 01-8-8" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                    )}
                </div>

                {/* Content */}
                {!minimized && (
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        {isDone ? (
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>
                                ✅ Semua selesai
                            </div>
                        ) : (
                            <>
                                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                                    Sinkronisasi GDrive
                                </div>
                                <div style={{ fontSize: '11px', opacity: 0.85, display: 'flex', gap: '10px' }}>
                                    {totalUploading > 0 && (
                                        <span>⬆️ {totalUploading} upload</span>
                                    )}
                                    {totalFailed > 0 && (
                                        <span>⚠️ {totalFailed} gagal</span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

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
