import { useState, useMemo, useEffect } from 'react';
import { Shield, Save, RotateCcw, Search, CheckCircle, XCircle, Info } from 'lucide-react';
import useSettingsStore, { ALL_MENUS } from '../../store/settingsStore';
import { settingsApi } from '../../api/index';
import toast from 'react-hot-toast';

const ROLES = ['admin', 'verifikator', 'korwil', 'sekolah'];
const ROLE_LABELS = { admin: 'Admin', verifikator: 'Verifikator', korwil: 'Korwil', sekolah: 'Sekolah' };
const ROLE_COLORS = {
    admin: { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
    verifikator: { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
    korwil: { bg: '#d1fae5', color: '#047857', border: '#6ee7b7' },
    sekolah: { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' }
};

// Collect all unique menus across roles
const ALL_UNIQUE_MENUS = (() => {
    const map = new Map();
    Object.values(ALL_MENUS).forEach(menus => {
        menus.forEach(m => { if (!map.has(m.path)) map.set(m.path, m.label); });
    });
    return Array.from(map.entries()).map(([path, label]) => ({ path, label }));
})();

const HakAkses = () => {
    const { accessConfig, toggleMenuAccess, resetAccessConfig, setAccessConfig } = useSettingsStore();
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('matrix');
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);

    // Load from server on mount
    useEffect(() => {
        settingsApi.getAccess().then(res => {
            // API returns config directly: { admin: [...], verifikator: [...], ... }
            // or wrapped: { value: { admin: [...], ... } }
            let serverConfig = res;
            if (res && res.value) {
                serverConfig = typeof res.value === 'string' ? JSON.parse(res.value) : res.value;
            }
            if (serverConfig && typeof serverConfig === 'object' && (serverConfig.admin || serverConfig.verifikator)) {
                setAccessConfig(serverConfig);
            }
        }).catch(() => { /* use local defaults */ });
    }, []);

    const filteredMenus = useMemo(() => {
        if (!search) return ALL_UNIQUE_MENUS;
        const q = search.toLowerCase();
        return ALL_UNIQUE_MENUS.filter(m => m.label.toLowerCase().includes(q) || m.path.toLowerCase().includes(q));
    }, [search]);

    const isAvailableForRole = (role, path) => {
        return ALL_MENUS[role]?.some(m => m.path === path) || false;
    };

    const handleToggle = (role, path) => {
        if (!isAvailableForRole(role, path)) return;
        toggleMenuAccess(role, path);
        setHasChanges(true);
    };

    const handleReset = async () => {
        try {
            await settingsApi.resetAccess();
            resetAccessConfig();
            setHasChanges(false);
            toast.success('Konfigurasi akses direset ke default');
        } catch { toast.error('Gagal reset'); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsApi.saveAccess(accessConfig);
            setHasChanges(false);
            toast.success('Konfigurasi akses berhasil disimpan');
        } catch { toast.error('Gagal menyimpan'); }
        setSaving(false);
    };

    // Stats per role
    const stats = ROLES.map(role => {
        const available = ALL_MENUS[role]?.length || 0;
        const enabled = (accessConfig[role] || []).filter(p => isAvailableForRole(role, p)).length;
        return { role, available, enabled, pct: available > 0 ? Math.round((enabled / available) * 100) : 0 };
    });

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Hak Akses</h1>
                    <p>Kelola akses menu untuk setiap role pengguna</p>
                </div>
                <div className="page-header-right" style={{ gap: 8 }}>
                    <button className="btn btn-ghost" onClick={handleReset}><RotateCcw size={14} /> Reset Default</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!hasChanges || saving}>
                        <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </div>

            {/* ===== STATS ===== */}
            <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
                {stats.map(s => {
                    const c = ROLE_COLORS[s.role];
                    return (
                        <div key={s.role} className="stat-card" style={{ borderLeft: `4px solid ${c.border}` }}>
                            <div className="stat-label" style={{ fontSize: '0.8rem' }}>
                                <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 600 }}>
                                    {ROLE_LABELS[s.role]}
                                </span>
                            </div>
                            <div className="stat-value" style={{ fontSize: '1.15rem' }}>
                                {s.enabled}/{s.available} menu
                            </div>
                            <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${s.pct}%`, background: c.color, borderRadius: 2, transition: 'width 0.3s ease' }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ===== TABS ===== */}
            <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderBottom: '2px solid var(--border-color)' }}>
                {[{ key: 'matrix', label: 'Matrix Akses' }, { key: 'detail', label: 'Detail Per Role' }].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: activeTab === tab.key ? 600 : 400,
                            color: activeTab === tab.key ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            borderBottom: activeTab === tab.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
                            marginBottom: -2, transition: 'all 0.2s'
                        }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ===== MATRIX VIEW ===== */}
            {activeTab === 'matrix' && (
                <div className="table-container">
                    <div className="table-toolbar">
                        <div className="table-toolbar-left">
                            <div className="table-search">
                                <Search size={16} className="search-icon" />
                                <input placeholder="Cari menu..." value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                        </div>
                        <div className="table-toolbar-right">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <Info size={12} />
                                Klik checkbox untuk mengubah akses. Sel abu-abu = menu tidak tersedia untuk role tersebut.
                            </div>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ minWidth: 220, fontSize: '0.85rem' }}>Menu</th>
                                    {ROLES.map(role => {
                                        const c = ROLE_COLORS[role];
                                        return (
                                            <th key={role} style={{ textAlign: 'center', minWidth: 130 }}>
                                                <span style={{ background: c.bg, color: c.color, padding: '3px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600 }}>
                                                    {ROLE_LABELS[role]}
                                                </span>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMenus.map(menu => (
                                    <tr key={menu.path}>
                                        <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: 4 }}>
                                                    /{menu.path}
                                                </span>
                                                <span>{menu.label}</span>
                                            </div>
                                        </td>
                                        {ROLES.map(role => {
                                            const available = isAvailableForRole(role, menu.path);
                                            const enabled = available && (accessConfig[role] || []).includes(menu.path);
                                            return (
                                                <td key={role} style={{
                                                    textAlign: 'center',
                                                    background: !available ? 'var(--bg-secondary)' : 'transparent',
                                                    cursor: available ? 'pointer' : 'default',
                                                    opacity: !available ? 0.4 : 1
                                                }}
                                                    onClick={() => handleToggle(role, menu.path)}
                                                >
                                                    {available ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {enabled ? (
                                                                <CheckCircle size={20} style={{ color: '#22c55e' }} />
                                                            ) : (
                                                                <XCircle size={20} style={{ color: '#ef4444', opacity: 0.4 }} />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== DETAIL VIEW ===== */}
            {activeTab === 'detail' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    {ROLES.map(role => {
                        const c = ROLE_COLORS[role];
                        const roleMenus = ALL_MENUS[role] || [];
                        const enabledMenus = accessConfig[role] || [];
                        return (
                            <div key={role} className="table-container" style={{ borderTop: `3px solid ${c.border}` }}>
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ background: c.bg, color: c.color, padding: '4px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600 }}>
                                            {ROLE_LABELS[role]}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {enabledMenus.filter(p => isAvailableForRole(role, p)).length} / {roleMenus.length} aktif
                                        </span>
                                    </div>
                                </div>
                                <div style={{ padding: '12px 16px' }}>
                                    {roleMenus.map(menu => {
                                        const enabled = enabledMenus.includes(menu.path);
                                        return (
                                            <label key={menu.path} style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '8px 8px', borderRadius: 6, cursor: 'pointer',
                                                transition: 'background 0.15s',
                                                fontSize: '0.85rem'
                                            }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <input type="checkbox" checked={enabled}
                                                    onChange={() => handleToggle(role, menu.path)}
                                                    style={{ accentColor: c.color, width: 16, height: 16 }}
                                                />
                                                <span style={{ fontWeight: enabled ? 500 : 400, color: enabled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                    {menu.label}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default HakAkses;
