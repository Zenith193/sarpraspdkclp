import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Timer, X } from 'lucide-react';
import useSettingsStore from '../../store/settingsStore';
import useAuthStore from '../../store/authStore';

const CountdownBanner = () => {
    const user = useAuthStore(s => s.user);
    const { countdownConfig } = useSettingsStore();
    const [remaining, setRemaining] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    const role = user?.role?.toLowerCase();
    const cfg = countdownConfig;

    // Should show banner?
    const shouldShow = cfg.enabled && cfg.deadline && cfg.affectedRoles.includes(role) && !dismissed;

    useEffect(() => {
        if (!shouldShow) return;

        const tick = () => {
            const now = new Date();
            const deadline = new Date(cfg.deadline);
            const diff = deadline - now;

            if (diff <= 0) {
                setRemaining({ expired: true, text: 'Waktu telah habis', days: 0, hours: 0, minutes: 0, seconds: 0 });
            } else {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setRemaining({ expired: false, days, hours, minutes, seconds });
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [shouldShow, cfg.deadline]);

    if (!shouldShow || !remaining) return null;

    const isExpired = remaining.expired;
    const restrictedText = cfg.restrictedActions.join(', ');

    return (
        <div style={{
            background: isExpired
                ? 'linear-gradient(135deg, #fee2e2, #fecaca)'
                : 'linear-gradient(135deg, #eff6ff, #dbeafe)',
            border: `1px solid ${isExpired ? '#fca5a5' : '#93c5fd'}`,
            borderRadius: 12,
            padding: '12px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            position: 'relative',
            animation: 'slideDown 0.3s ease-out'
        }}>
            <style>{`
                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
            `}</style>

            {/* Icon */}
            <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: isExpired ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
            }}>
                {isExpired
                    ? <AlertTriangle size={22} style={{ color: '#ef4444' }} />
                    : <Timer size={22} style={{ color: '#3b82f6', animation: 'pulse-glow 2s infinite' }} />
                }
            </div>

            {/* Label & Message */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontWeight: 600, fontSize: '0.85rem',
                    color: isExpired ? '#b91c1c' : '#1e40af',
                    marginBottom: 2
                }}>
                    {cfg.label || 'Countdown Timer'}
                </div>
                <div style={{ fontSize: '0.75rem', color: isExpired ? '#dc2626' : '#3b82f6' }}>
                    {isExpired
                        ? `Aksi ${restrictedText} telah dinonaktifkan oleh admin`
                        : `Sisa waktu untuk aksi: ${restrictedText}`
                    }
                </div>
            </div>

            {/* Countdown Digits */}
            {!isExpired && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {[
                        { val: remaining.days, label: 'Hari' },
                        { val: remaining.hours, label: 'Jam' },
                        { val: remaining.minutes, label: 'Mnt' },
                        { val: remaining.seconds, label: 'Dtk' },
                    ].map(item => (
                        <div key={item.label} style={{
                            background: 'rgba(59,130,246,0.1)',
                            border: '1px solid rgba(59,130,246,0.2)',
                            borderRadius: 8, padding: '6px 10px',
                            textAlign: 'center', minWidth: 48
                        }}>
                            <div style={{
                                fontSize: '1.1rem', fontWeight: 700,
                                color: '#1e40af', fontFamily: 'monospace',
                                lineHeight: 1
                            }}>
                                {String(item.val).padStart(2, '0')}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 500, marginTop: 2 }}>
                                {item.label}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Expired Badge */}
            {isExpired && (
                <div style={{
                    background: '#ef4444', color: '#fff',
                    padding: '6px 16px', borderRadius: 20,
                    fontSize: '0.8rem', fontWeight: 700,
                    flexShrink: 0, letterSpacing: '0.5px'
                }}>
                    EXPIRED
                </div>
            )}

            {/* Dismiss */}
            <button onClick={() => setDismissed(true)} style={{
                position: 'absolute', top: 6, right: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: isExpired ? '#ef4444' : '#93c5fd', padding: 2,
                opacity: 0.6, transition: '0.2s'
            }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
            >
                <X size={14} />
            </button>
        </div>
    );
};

export default CountdownBanner;
