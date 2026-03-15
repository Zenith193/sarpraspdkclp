import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Timer, X } from 'lucide-react';
import useSettingsStore from '../../store/settingsStore';
import useAuthStore from '../../store/authStore';
import { settingsApi } from '../../api/index';

const CountdownBanner = () => {
    const user = useAuthStore(s => s.user);
    const { countdownTimers, setCountdownTimers } = useSettingsStore();
    const [remainings, setRemainings] = useState({});
    const [dismissedIds, setDismissedIds] = useState([]);

    // Load countdown config from server on mount
    useEffect(() => {
        settingsApi.getCountdown().then(serverCfg => {
            const cfg = serverCfg?.value || serverCfg;
            if (cfg && Array.isArray(cfg.timers)) {
                setCountdownTimers(cfg.timers);
            } else if (cfg && typeof cfg === 'object' && cfg.enabled !== undefined) {
                // Legacy single-timer
                setCountdownTimers([{ ...cfg, id: cfg.id || 'legacy' }]);
            }
        }).catch(() => { });
    }, []);

    const role = user?.role?.toLowerCase();

    // Filter timers that apply to this user's role
    const activeTimers = countdownTimers.filter(t =>
        t.enabled && t.deadline && t.affectedRoles.includes(role) && !dismissedIds.includes(t.id)
    );

    useEffect(() => {
        if (activeTimers.length === 0) return;

        const tick = () => {
            const now = new Date();
            const newRemainings = {};
            activeTimers.forEach(t => {
                const diff = new Date(t.deadline) - now;
                if (diff <= 0) {
                    newRemainings[t.id] = { expired: true };
                } else {
                    newRemainings[t.id] = {
                        expired: false,
                        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                        seconds: Math.floor((diff % (1000 * 60)) / 1000),
                    };
                }
            });
            setRemainings(newRemainings);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [activeTimers.map(t => t.id + t.deadline).join(',')]);

    if (activeTimers.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            <style>{`
                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
            `}</style>
            {activeTimers.map(cfg => {
                const remaining = remainings[cfg.id];
                if (!remaining) return null;
                const isExpired = remaining.expired;
                const restrictedText = (cfg.restrictedActions || []).join(', ');

                return (
                    <div key={cfg.id} style={{
                        background: isExpired
                            ? 'linear-gradient(135deg, #fee2e2, #fecaca)'
                            : 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                        border: `1px solid ${isExpired ? '#fca5a5' : '#93c5fd'}`,
                        borderRadius: 12,
                        padding: '10px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        position: 'relative',
                        animation: 'slideDown 0.3s ease-out'
                    }}>
                        {/* Icon */}
                        <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: isExpired ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {isExpired
                                ? <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                                : <Timer size={18} style={{ color: '#3b82f6', animation: 'pulse-glow 2s infinite' }} />
                            }
                        </div>

                        {/* Label & Message */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontWeight: 600, fontSize: '0.82rem',
                                color: isExpired ? '#b91c1c' : '#1e40af',
                                marginBottom: 1
                            }}>
                                {cfg.label || 'Countdown Timer'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: isExpired ? '#dc2626' : '#3b82f6' }}>
                                {isExpired
                                    ? `Aksi ${restrictedText} telah dinonaktifkan oleh admin`
                                    : `Sisa waktu untuk aksi: ${restrictedText}`
                                }
                            </div>
                        </div>

                        {/* Countdown Digits */}
                        {!isExpired && (
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                {[
                                    { val: remaining.days, label: 'Hari' },
                                    { val: remaining.hours, label: 'Jam' },
                                    { val: remaining.minutes, label: 'Mnt' },
                                    { val: remaining.seconds, label: 'Dtk' },
                                ].map(item => (
                                    <div key={item.label} style={{
                                        background: 'rgba(59,130,246,0.1)',
                                        border: '1px solid rgba(59,130,246,0.2)',
                                        borderRadius: 6, padding: '4px 8px',
                                        textAlign: 'center', minWidth: 40
                                    }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e40af', fontFamily: 'monospace', lineHeight: 1 }}>
                                            {String(item.val).padStart(2, '0')}
                                        </div>
                                        <div style={{ fontSize: '0.55rem', color: '#3b82f6', fontWeight: 500, marginTop: 2 }}>
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
                                padding: '5px 14px', borderRadius: 16,
                                fontSize: '0.75rem', fontWeight: 700,
                                flexShrink: 0, letterSpacing: '0.5px'
                            }}>
                                EXPIRED
                            </div>
                        )}

                        {/* Dismiss */}
                        <button onClick={() => setDismissedIds(prev => [...prev, cfg.id])} style={{
                            position: 'absolute', top: 4, right: 4,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: isExpired ? '#ef4444' : '#93c5fd', padding: 2,
                            opacity: 0.6, transition: '0.2s'
                        }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                        >
                            <X size={12} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default CountdownBanner;
