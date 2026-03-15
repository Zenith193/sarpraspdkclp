import { useState, useEffect, useRef } from 'react';
import { queueApi } from '../../api/index';
import useAuthStore from '../../store/authStore';

/**
 * Compact queue status indicator for the topbar.
 * Shows a small icon with count when there are pending uploads/failures.
 * Hidden when queue is empty.
 */
const QueueStatus = () => {
    const { isAuthenticated } = useAuthStore();
    const [status, setStatus] = useState(null);
    const intervalRef = useRef(null);

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

    if (!status) return null;

    const { totalUploading, totalFailed } = status;
    if (totalUploading === 0 && totalFailed === 0) return null;

    const hasFailure = totalFailed > 0;
    const isUploading = totalUploading > 0;

    return (
        <div
            title={`${isUploading ? `${totalUploading} sedang upload` : ''}${isUploading && hasFailure ? ', ' : ''}${hasFailure ? `${totalFailed} gagal` : ''}`}
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
                cursor: 'default',
                whiteSpace: 'nowrap',
            }}
        >
            {/* Sync icon */}
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

            {/* Count */}
            {isUploading && <span>⬆ {totalUploading}</span>}
            {hasFailure && <span>⚠ {totalFailed}</span>}

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
