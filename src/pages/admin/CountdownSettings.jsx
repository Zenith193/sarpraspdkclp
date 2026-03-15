import { useState, useEffect } from 'react';
import { Timer, Save, RotateCcw, Play, Pause, Clock, Users, ShieldAlert, CheckCircle, XCircle, AlertTriangle, MapPin, GraduationCap, Plus, Edit, Trash2, Power, X, MoreHorizontal } from 'lucide-react';
import useSettingsStore, { AVAILABLE_ACTIONS, createNewTimer } from '../../store/settingsStore';
import { settingsApi } from '../../api/index';
import { KECAMATAN, JENJANG } from '../../utils/constants';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
    { key: 'verifikator', label: 'Verifikator', color: '#6d28d9' },
    { key: 'korwil', label: 'Korwil', color: '#047857' },
    { key: 'sekolah', label: 'Sekolah', color: '#b45309' },
];

const CountdownSettings = () => {
    const { countdownTimers, setCountdownTimers, addCountdownTimer, updateCountdownTimer, removeCountdownTimer, toggleCountdownTimer, resetCountdownTimers } = useSettingsStore();
    const [editTimer, setEditTimer] = useState(null); // null = closed, object = editing
    const [showForm, setShowForm] = useState(false);
    const [previews, setPreviews] = useState({});
    const [openActionId, setOpenActionId] = useState(null);
    const [actionPos, setActionPos] = useState({ top: 0, left: 0 });
    const handleActionClick = (e, id) => {
        if (openActionId === id) { setOpenActionId(null); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        setActionPos({ top: rect.bottom + 4, left: rect.right - 170 });
        setOpenActionId(id);
    };

    // Load from server on mount
    useEffect(() => {
        settingsApi.getCountdown().then(serverCfg => {
            const cfg = serverCfg?.value || serverCfg;
            if (cfg && Array.isArray(cfg.timers)) {
                setCountdownTimers(cfg.timers);
            } else if (cfg && typeof cfg === 'object' && cfg.enabled !== undefined) {
                // Legacy single-timer — migrate
                setCountdownTimers([{ ...cfg, id: cfg.id || 'legacy' }]);
            }
        }).catch(() => { });
    }, []);

    // Live previews for all timers
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            const newPreviews = {};
            countdownTimers.forEach(t => {
                if (!t.enabled || !t.deadline) {
                    newPreviews[t.id] = null;
                    return;
                }
                const diff = new Date(t.deadline) - now;
                if (diff <= 0) {
                    newPreviews[t.id] = { expired: true };
                } else {
                    newPreviews[t.id] = {
                        expired: false,
                        days: Math.floor(diff / 86400000),
                        hours: Math.floor((diff % 86400000) / 3600000),
                        minutes: Math.floor((diff % 3600000) / 60000),
                        seconds: Math.floor((diff % 60000) / 1000),
                    };
                }
            });
            setPreviews(newPreviews);
        };
        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, [countdownTimers]);

    // Click outside to close dropdown
    useEffect(() => {
        const handler = () => setOpenActionId(null);
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const saveToServer = async (timers) => {
        try {
            await settingsApi.setCountdown({ timers });
            toast.success('Countdown Timer disimpan ke server');
        } catch {
            toast.success('Disimpan lokal (gagal sync ke server)');
        }
    };

    const handleAdd = () => {
        const newTimer = createNewTimer();
        setEditTimer(newTimer);
        setShowForm(true);
    };

    const handleEdit = (timer) => {
        setEditTimer({ ...timer });
        setShowForm(true);
    };

    const handleSaveTimer = async () => {
        if (!editTimer.deadline) {
            toast.error('Tentukan deadline terlebih dahulu');
            return;
        }
        const existing = countdownTimers.find(t => t.id === editTimer.id);
        let newTimers;
        if (existing) {
            newTimers = countdownTimers.map(t => t.id === editTimer.id ? editTimer : t);
        } else {
            newTimers = [...countdownTimers, editTimer];
        }
        setCountdownTimers(newTimers);
        await saveToServer(newTimers);
        setShowForm(false);
        setEditTimer(null);
    };

    const handleDelete = async (id) => {
        const newTimers = countdownTimers.filter(t => t.id !== id);
        setCountdownTimers(newTimers);
        await saveToServer(newTimers);
    };

    const handleToggle = async (id) => {
        const newTimers = countdownTimers.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t);
        setCountdownTimers(newTimers);
        await saveToServer(newTimers);
    };

    const handleResetAll = async () => {
        resetCountdownTimers();
        await saveToServer([]);
    };

    const handleFormChange = (field, value) => {
        setEditTimer(prev => ({ ...prev, [field]: value }));
    };

    const formatCountdown = (preview) => {
        if (!preview) return 'Nonaktif';
        if (preview.expired) return 'EXPIRED';
        return `${preview.days}h ${preview.hours}j ${preview.minutes}m ${preview.seconds}d`;
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Countdown Timer</h1>
                    <p>Kelola beberapa countdown timer sekaligus</p>
                </div>
                <div className="page-header-right" style={{ gap: 8 }}>
                    <button className="btn btn-ghost" onClick={handleResetAll}><RotateCcw size={14} /> Reset Semua</button>
                    <button className="btn btn-primary" onClick={handleAdd}><Plus size={14} /> Tambah Timer</button>
                </div>
            </div>

            {/* ===== TIMER TABLE ===== */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            <Timer size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
                            Daftar Countdown Timer ({countdownTimers.length})
                        </h3>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 50 }}>No</th>
                                <th>Label</th>
                                <th>Deadline</th>
                                <th>Sisa Waktu</th>
                                <th>Role</th>
                                <th>Jenjang</th>
                                <th>Kecamatan</th>
                                <th>Aksi Dibatasi</th>
                                <th>Status</th>
                                <th style={{ width: 50 }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {countdownTimers.map((timer, i) => {
                                const preview = previews[timer.id];
                                const isExpired = preview?.expired;
                                const isActive = timer.enabled && timer.deadline;
                                return (
                                    <tr key={timer.id} style={{ opacity: timer.enabled ? 1 : 0.5 }}>
                                        <td>{i + 1}</td>
                                        <td style={{ fontWeight: 600, minWidth: 180 }}>{timer.label || 'Timer'}</td>
                                        <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {timer.deadline ? new Date(timer.deadline).toLocaleString('id-ID') : '—'}
                                        </td>
                                        <td>
                                            {isActive ? (
                                                <span style={{
                                                    fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem',
                                                    color: isExpired ? '#ef4444' : '#3b82f6',
                                                    background: isExpired ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                                                    padding: '3px 8px', borderRadius: 6
                                                }}>
                                                    {formatCountdown(preview)}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                                {(timer.affectedRoles || []).map(r => (
                                                    <span key={r} style={{ background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: 8, fontSize: 10, textTransform: 'capitalize' }}>{r}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '0.78rem' }}>
                                            {(timer.filterJenjang || []).length > 0 ? timer.filterJenjang.join(', ') : <span style={{ color: 'var(--text-secondary)' }}>Semua</span>}
                                        </td>
                                        <td style={{ fontSize: '0.78rem' }}>
                                            {(timer.filterKecamatan || []).length > 0 ? (
                                                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                                    {(timer.filterKecamatan || []).map(k => (
                                                        <span key={k} style={{ background: 'rgba(14,165,233,0.08)', color: '#0ea5e9', padding: '1px 6px', borderRadius: 8, fontSize: 10 }}>{k}</span>
                                                    ))}
                                                </div>
                                            ) : <span style={{ color: 'var(--text-secondary)' }}>Semua</span>}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                                {(timer.restrictedActions || []).map(a => (
                                                    <span key={a} style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '1px 6px', borderRadius: 8, fontSize: 10, textTransform: 'capitalize' }}>{a}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            {isExpired ? (
                                                <span className="badge badge-ditolak" style={{ fontSize: 10 }}>Expired</span>
                                            ) : timer.enabled ? (
                                                <span className="badge badge-disetujui" style={{ fontSize: 10 }}>Aktif</span>
                                            ) : (
                                                <span className="badge badge-menunggu" style={{ fontSize: 10 }}>Nonaktif</span>
                                            )}
                                        </td>
                                        <td>
                                            <button className="btn-icon" onClick={(e) => handleActionClick(e, timer.id)} title="Aksi">
                                                <MoreHorizontal size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {countdownTimers.length === 0 && (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                        <Timer size={32} style={{ opacity: 0.2, marginBottom: 8 }} /><br />
                                        Belum ada countdown timer. Klik "Tambah Timer" untuk membuat.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
                {/* Fixed-position action dropdown */}
                {openActionId && (() => {
                    const timer = countdownTimers.find(t => t.id === openActionId);
                    if (!timer) return null;
                    return (
                        <div className="dropdown-menu" style={{ position: 'fixed', top: actionPos.top, left: actionPos.left, minWidth: 170, padding: 4, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                            <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: timer.enabled ? '#22c55e' : 'var(--text-primary)', borderRadius: 6 }} className="dropdown-item" onClick={() => { handleToggle(timer.id); setOpenActionId(null); }}>
                                <Power size={14} /> {timer.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)', borderRadius: 6 }} className="dropdown-item" onClick={() => { handleEdit(timer); setOpenActionId(null); }}>
                                <Edit size={14} /> Edit
                            </button>
                            <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--accent-red)', borderRadius: 6 }} className="dropdown-item" onClick={() => { handleDelete(timer.id); setOpenActionId(null); }}>
                                <Trash2 size={14} /> Hapus
                            </button>
                        </div>
                    );
                })()}

            {/* ===== ADD/EDIT MODAL ===== */}
            {showForm && editTimer && (
                <div className="modal-overlay" onClick={() => { setShowForm(false); setEditTimer(null); }}>
                    <div className="modal" style={{ maxWidth: 650, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{countdownTimers.find(t => t.id === editTimer.id) ? 'Edit Timer' : 'Tambah Timer Baru'}</div>
                            <button className="modal-close" onClick={() => { setShowForm(false); setEditTimer(null); }}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            {/* Label & Deadline */}
                            <div className="form-group">
                                <label className="form-label">Label Timer *</label>
                                <input className="form-input" value={editTimer.label} onChange={e => handleFormChange('label', e.target.value)} placeholder="Cth: Batas Akhir Input Data Sarpras" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tanggal & Waktu Deadline *</label>
                                <input className="form-input" type="datetime-local" value={editTimer.deadline ? editTimer.deadline.slice(0, 16) : ''} onChange={e => handleFormChange('deadline', e.target.value ? new Date(e.target.value).toISOString() : '')} style={{ fontFamily: 'monospace' }} />
                            </div>

                            {/* Enabled Toggle */}
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Timer {editTimer.enabled ? 'Aktif' : 'Nonaktif'}</span>
                                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={editTimer.enabled} onChange={e => handleFormChange('enabled', e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                                    <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: editTimer.enabled ? '#3b82f6' : 'var(--bg-card)', borderRadius: 24, transition: '0.3s', border: `1px solid ${editTimer.enabled ? '#3b82f6' : 'var(--border-color)'}` }}>
                                        <span style={{ position: 'absolute', height: 18, width: 18, left: editTimer.enabled ? 22 : 2, bottom: 2, background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                    </span>
                                </label>
                            </div>

                            {/* Affected Roles */}
                            <div style={{ marginTop: 12, marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <Users size={14} style={{ color: 'var(--accent-green)' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Role Terdampak</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {ROLE_OPTIONS.map(r => {
                                        const checked = (editTimer.affectedRoles || []).includes(r.key);
                                        return (
                                            <label key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${checked ? r.color : 'var(--border-color)'}`, background: checked ? `${r.color}08` : 'transparent', transition: '0.2s' }}>
                                                <input type="checkbox" checked={checked} onChange={() => {
                                                    const arr = editTimer.affectedRoles || [];
                                                    handleFormChange('affectedRoles', checked ? arr.filter(x => x !== r.key) : [...arr, r.key]);
                                                }} style={{ accentColor: r.color, width: 16, height: 16 }} />
                                                <span style={{ fontWeight: checked ? 600 : 400, fontSize: '0.85rem', color: checked ? r.color : 'var(--text-primary)' }}>{r.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Restricted Actions */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <ShieldAlert size={14} style={{ color: '#ef4444' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Aksi yang Dibatasi</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                    {AVAILABLE_ACTIONS.map(a => {
                                        const checked = (editTimer.restrictedActions || []).includes(a.key);
                                        return (
                                            <label key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${checked ? '#ef4444' : 'var(--border-color)'}`, background: checked ? 'rgba(239,68,68,0.04)' : 'transparent', transition: '0.2s' }}>
                                                <input type="checkbox" checked={checked} onChange={() => {
                                                    const arr = editTimer.restrictedActions || [];
                                                    handleFormChange('restrictedActions', checked ? arr.filter(x => x !== a.key) : [...arr, a.key]);
                                                }} style={{ accentColor: '#ef4444', width: 14, height: 14 }} />
                                                <div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: checked ? 600 : 400 }}>{a.label}</div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{a.desc}</div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Filter Jenjang */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <GraduationCap size={14} style={{ color: '#8b5cf6' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter Jenjang</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>(kosong = semua)</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {JENJANG.map(j => {
                                        const checked = (editTimer.filterJenjang || []).includes(j);
                                        return (
                                            <label key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${checked ? '#8b5cf6' : 'var(--border-color)'}`, background: checked ? 'rgba(139,92,246,0.06)' : 'transparent', transition: '0.2s', fontSize: '0.8rem' }}>
                                                <input type="checkbox" checked={checked} onChange={() => {
                                                    const arr = editTimer.filterJenjang || [];
                                                    handleFormChange('filterJenjang', checked ? arr.filter(x => x !== j) : [...arr, j]);
                                                }} style={{ accentColor: '#8b5cf6', width: 14, height: 14 }} />
                                                <span style={{ fontWeight: checked ? 600 : 400, color: checked ? '#8b5cf6' : 'var(--text-primary)' }}>{j}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Filter Kecamatan */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <MapPin size={14} style={{ color: '#0ea5e9' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter Kecamatan</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>(kosong = semua)</span>
                                    {(editTimer.filterKecamatan || []).length > 0 && (
                                        <button onClick={() => handleFormChange('filterKecamatan', [])} style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>Reset</button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 160, overflowY: 'auto', padding: 2 }}>
                                    {KECAMATAN.map(k => {
                                        const checked = (editTimer.filterKecamatan || []).includes(k);
                                        return (
                                            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${checked ? '#0ea5e9' : 'var(--border-color)'}`, background: checked ? 'rgba(14,165,233,0.06)' : 'transparent', transition: '0.2s', fontSize: '0.73rem' }}>
                                                <input type="checkbox" checked={checked} onChange={() => {
                                                    const arr = editTimer.filterKecamatan || [];
                                                    handleFormChange('filterKecamatan', checked ? arr.filter(x => x !== k) : [...arr, k]);
                                                }} style={{ accentColor: '#0ea5e9', width: 12, height: 12 }} />
                                                <span style={{ fontWeight: checked ? 600 : 400, color: checked ? '#0ea5e9' : 'var(--text-primary)' }}>{k}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditTimer(null); }}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSaveTimer}><Save size={14} /> Simpan Timer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CountdownSettings;
