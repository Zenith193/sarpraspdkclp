import { useState, useEffect } from 'react';
import { Timer, Save, RotateCcw, Play, Pause, Clock, Users, ShieldAlert, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import useSettingsStore, { AVAILABLE_ACTIONS } from '../../store/settingsStore';
import { settingsApi } from '../../api/index';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
    { key: 'verifikator', label: 'Verifikator', color: '#6d28d9' },
    { key: 'korwil', label: 'Korwil', color: '#047857' },
    { key: 'sekolah', label: 'Sekolah', color: '#b45309' },
];

const CountdownSettings = () => {
    const { countdownConfig, updateCountdown, resetCountdown } = useSettingsStore();
    const [form, setForm] = useState({ ...countdownConfig });
    const [hasChanges, setHasChanges] = useState(false);
    const [preview, setPreview] = useState(null);

    // Load countdown config from server on mount
    useEffect(() => {
        settingsApi.getCountdown().then(serverCfg => {
            if (serverCfg && serverCfg.value) {
                updateCountdown(serverCfg.value);
                setForm({ ...countdownConfig, ...serverCfg.value });
            }
        }).catch(() => { });
    }, []);

    // Live preview timer
    useEffect(() => {
        if (!form.enabled || !form.deadline) { setPreview(null); return; }
        const tick = () => {
            const diff = new Date(form.deadline) - new Date();
            if (diff <= 0) {
                setPreview({ expired: true });
            } else {
                setPreview({
                    expired: false,
                    days: Math.floor(diff / 86400000),
                    hours: Math.floor((diff % 86400000) / 3600000),
                    minutes: Math.floor((diff % 3600000) / 60000),
                    seconds: Math.floor((diff % 60000) / 1000),
                });
            }
        };
        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, [form.enabled, form.deadline]);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const toggleRole = (role) => {
        const roles = form.affectedRoles.includes(role)
            ? form.affectedRoles.filter(r => r !== role)
            : [...form.affectedRoles, role];
        handleChange('affectedRoles', roles);
    };

    const toggleAction = (action) => {
        const actions = form.restrictedActions.includes(action)
            ? form.restrictedActions.filter(a => a !== action)
            : [...form.restrictedActions, action];
        handleChange('restrictedActions', actions);
    };

    const handleSave = async () => {
        if (form.enabled && !form.deadline) {
            toast.error('Tentukan deadline terlebih dahulu');
            return;
        }
        try {
            // Save to server so all users get the same config
            await settingsApi.setCountdown(form);
            // Also save to local store
            updateCountdown(form);
            setHasChanges(false);
            toast.success('Pengaturan countdown berhasil disimpan ke server');
        } catch (err) {
            // Fallback: save to local only
            updateCountdown(form);
            setHasChanges(false);
            toast.success('Disimpan lokal (gagal sync ke server)');
        }
    };

    const handleReset = () => {
        resetCountdown();
        setHasChanges(false);
        toast.success('Countdown direset ke default');
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Countdown Timer</h1>
                    <p>Atur batas waktu aksi untuk akun non-admin</p>
                </div>
                <div className="page-header-right" style={{ gap: 8 }}>
                    <button className="btn btn-ghost" onClick={handleReset}><RotateCcw size={14} /> Reset</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!hasChanges}>
                        <Save size={14} /> Simpan
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* ===== LEFT: CONFIG ===== */}
                <div>
                    {/* Enable Toggle */}
                    <div className="table-container" style={{ padding: 20, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: form.enabled ? 'rgba(59,130,246,0.12)' : 'var(--bg-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: form.enabled ? '#3b82f6' : 'var(--text-secondary)'
                                }}>
                                    <Timer size={20} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Countdown Timer</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {form.enabled ? 'Timer aktif — aksi akan dibatasi setelah deadline' : 'Timer nonaktif'}
                                    </div>
                                </div>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, cursor: 'pointer' }}>
                                <input type="checkbox" checked={form.enabled} onChange={e => handleChange('enabled', e.target.checked)}
                                    style={{ opacity: 0, width: 0, height: 0 }} />
                                <span style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    background: form.enabled ? '#3b82f6' : 'var(--bg-secondary)',
                                    borderRadius: 26, transition: '0.3s',
                                    border: `1px solid ${form.enabled ? '#3b82f6' : 'var(--border-color)'}`
                                }}>
                                    <span style={{
                                        position: 'absolute', height: 20, width: 20, left: form.enabled ? 24 : 2, bottom: 2,
                                        background: '#fff', borderRadius: '50%', transition: '0.3s',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }} />
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Deadline & Label */}
                    <div className="table-container" style={{ padding: 20, marginBottom: 16, opacity: form.enabled ? 1 : 0.5, pointerEvents: form.enabled ? 'auto' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--bg-secondary)' }}>
                            <Clock size={16} style={{ color: 'var(--accent-blue)' }} />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Deadline & Label</h3>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Label Timer</label>
                            <input className="form-input" value={form.label}
                                onChange={e => handleChange('label', e.target.value)}
                                placeholder="Cth: Batas Akhir Input Data Sarpras" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tanggal & Waktu Deadline</label>
                            <input className="form-input" type="datetime-local"
                                value={form.deadline ? form.deadline.slice(0, 16) : ''}
                                onChange={e => handleChange('deadline', e.target.value ? new Date(e.target.value).toISOString() : '')}
                                style={{ fontFamily: 'monospace' }} />
                        </div>
                    </div>

                    {/* Affected Roles */}
                    <div className="table-container" style={{ padding: 20, marginBottom: 16, opacity: form.enabled ? 1 : 0.5, pointerEvents: form.enabled ? 'auto' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--bg-secondary)' }}>
                            <Users size={16} style={{ color: 'var(--accent-green)' }} />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Role Terdampak</h3>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                            Pilih role yang akan terdampak countdown. Admin tidak pernah terdampak.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {ROLE_OPTIONS.map(r => {
                                const checked = form.affectedRoles.includes(r.key);
                                return (
                                    <label key={r.key} style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                                        border: `2px solid ${checked ? r.color : 'var(--border-color)'}`,
                                        background: checked ? `${r.color}08` : 'transparent',
                                        transition: '0.2s'
                                    }}>
                                        <input type="checkbox" checked={checked}
                                            onChange={() => toggleRole(r.key)}
                                            style={{ accentColor: r.color, width: 16, height: 16 }} />
                                        <span style={{ fontWeight: checked ? 600 : 400, fontSize: '0.85rem', color: checked ? r.color : 'var(--text-primary)' }}>
                                            {r.label}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Restricted Actions */}
                    <div className="table-container" style={{ padding: 20, opacity: form.enabled ? 1 : 0.5, pointerEvents: form.enabled ? 'auto' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--bg-secondary)' }}>
                            <ShieldAlert size={16} style={{ color: '#ef4444' }} />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Aksi yang Dibatasi</h3>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                            Pilih aksi yang akan dinonaktifkan setelah deadline berakhir.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {AVAILABLE_ACTIONS.map(a => {
                                const checked = form.restrictedActions.includes(a.key);
                                return (
                                    <label key={a.key} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 10,
                                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                                        border: `2px solid ${checked ? '#ef4444' : 'var(--border-color)'}`,
                                        background: checked ? 'rgba(239,68,68,0.04)' : 'transparent',
                                        transition: '0.2s'
                                    }}>
                                        <input type="checkbox" checked={checked}
                                            onChange={() => toggleAction(a.key)}
                                            style={{ accentColor: '#ef4444', width: 16, height: 16, marginTop: 2 }} />
                                        <div>
                                            <div style={{ fontWeight: checked ? 600 : 400, fontSize: '0.85rem' }}>{a.label}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{a.desc}</div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ===== RIGHT: PREVIEW ===== */}
                <div>
                    {/* Live Preview */}
                    <div className="table-container" style={{ padding: 20, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--bg-secondary)' }}>
                            <Play size={16} style={{ color: 'var(--accent-blue)' }} />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Preview Timer</h3>
                        </div>

                        {!form.enabled ? (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                <Pause size={32} style={{ opacity: 0.3, marginBottom: 8 }} /><br />
                                Timer tidak aktif
                            </div>
                        ) : !form.deadline ? (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                <Clock size={32} style={{ opacity: 0.3, marginBottom: 8 }} /><br />
                                Tentukan deadline untuk melihat preview
                            </div>
                        ) : preview ? (
                            <div>
                                {/* Simulated Banner */}
                                <div style={{
                                    background: preview.expired
                                        ? 'linear-gradient(135deg, #fee2e2, #fecaca)'
                                        : 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                                    border: `1px solid ${preview.expired ? '#fca5a5' : '#93c5fd'}`,
                                    borderRadius: 12, padding: '14px 18px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        {preview.expired
                                            ? <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                                            : <Timer size={18} style={{ color: '#3b82f6' }} />
                                        }
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: preview.expired ? '#b91c1c' : '#1e40af' }}>
                                            {form.label}
                                        </span>
                                    </div>

                                    {!preview.expired && (
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '12px 0' }}>
                                            {[
                                                { val: preview.days, label: 'Hari' },
                                                { val: preview.hours, label: 'Jam' },
                                                { val: preview.minutes, label: 'Mnt' },
                                                { val: preview.seconds, label: 'Dtk' },
                                            ].map(item => (
                                                <div key={item.label} style={{
                                                    background: 'rgba(59,130,246,0.1)',
                                                    border: '1px solid rgba(59,130,246,0.2)',
                                                    borderRadius: 8, padding: '8px 14px',
                                                    textAlign: 'center', minWidth: 52
                                                }}>
                                                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e40af', fontFamily: 'monospace', lineHeight: 1 }}>
                                                        {String(item.val).padStart(2, '0')}
                                                    </div>
                                                    <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 500, marginTop: 3 }}>
                                                        {item.label}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {preview.expired && (
                                        <div style={{
                                            textAlign: 'center', marginTop: 10,
                                            background: '#ef4444', color: '#fff',
                                            padding: '8px 0', borderRadius: 8,
                                            fontWeight: 700, fontSize: '0.9rem', letterSpacing: '1px'
                                        }}>
                                            WAKTU TELAH HABIS
                                        </div>
                                    )}
                                </div>

                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 10, textAlign: 'center' }}>
                                    Tampilan ini akan muncul di halaman akun role terdampak
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Summary Card */}
                    <div className="table-container" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--bg-secondary)' }}>
                            <CheckCircle size={16} style={{ color: 'var(--accent-green)' }} />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Ringkasan Konfigurasi</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                                <span style={{
                                    fontWeight: 600,
                                    color: form.enabled ? '#22c55e' : 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', gap: 6
                                }}>
                                    {form.enabled ? <><CheckCircle size={14} /> Aktif</> : <><XCircle size={14} /> Nonaktif</>}
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Deadline</span>
                                <span style={{ fontWeight: 500 }}>
                                    {form.deadline ? new Date(form.deadline).toLocaleString('id-ID') : '—'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Role Terdampak</span>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {form.affectedRoles.length > 0 ? form.affectedRoles.map(r => (
                                        <span key={r} style={{
                                            background: 'var(--bg-secondary)', padding: '2px 8px',
                                            borderRadius: 10, fontSize: '0.75rem', fontWeight: 500,
                                            textTransform: 'capitalize'
                                        }}>{r}</span>
                                    )) : '—'}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Aksi Dibatasi</span>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {form.restrictedActions.length > 0 ? form.restrictedActions.map(a => (
                                        <span key={a} style={{
                                            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                            padding: '2px 8px', borderRadius: 10,
                                            fontSize: '0.75rem', fontWeight: 500,
                                            textTransform: 'capitalize'
                                        }}>{a}</span>
                                    )) : '—'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CountdownSettings;
