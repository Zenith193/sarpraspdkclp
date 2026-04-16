import { useState, useEffect, useMemo } from 'react';
import {
    Megaphone, Plus, Edit, Trash2, Search, X, Save, AlertTriangle,
    Power, PowerOff, Code, Copy, Check
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../api/client';
import toast from 'react-hot-toast';

const POSISI_OPTIONS = [
    { value: 'head', label: 'Head (Script Tag)' },
    { value: 'body', label: 'Body (sebelum </body>)' },
];

const Iklan = () => {
    const user = useAuthStore(s => s.user);
    const isAdmin = user?.role?.toLowerCase() === 'admin';

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    const [formData, setFormData] = useState({
        judul: '', deskripsi: '', scriptCode: '', posisi: 'head', aktif: true, prioritas: 0
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/iklan');
            setData(res.data || res || []);
        } catch (err) {
            console.error('iklan fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = useMemo(() => {
        return data.filter(d => {
            if (search && !d.judul?.toLowerCase().includes(search.toLowerCase()) &&
                !d.deskripsi?.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [data, search]);

    const resetForm = () => {
        setFormData({ judul: '', deskripsi: '', scriptCode: '', posisi: 'head', aktif: true, prioritas: 0 });
        setEditItem(null);
    };

    const handleAdd = () => { resetForm(); setShowModal(true); };
    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({
            judul: item.judul || '', deskripsi: item.deskripsi || '',
            scriptCode: item.scriptCode || '', posisi: item.posisi || 'head',
            aktif: item.aktif !== false, prioritas: item.prioritas || 0
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.judul) { toast.error('Judul iklan wajib diisi'); return; }
        if (!formData.scriptCode) { toast.error('Script code wajib diisi'); return; }
        try {
            const payload = { ...formData, prioritas: parseInt(formData.prioritas) || 0 };
            if (editItem) {
                await api.put(`/iklan/${editItem.id}`, payload);
                toast.success('Iklan berhasil diperbarui');
            } else {
                await api.post('/iklan', payload);
                toast.success('Iklan berhasil ditambahkan');
            }
            setShowModal(false);
            resetForm();
            fetchData();
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan');
        }
    };

    const executeDelete = async () => {
        if (!deleteTarget) return;
        try {
            await api.delete(`/iklan/${deleteTarget.id}`);
            toast.success('Iklan berhasil dihapus');
            setDeleteTarget(null);
            fetchData();
        } catch (err) {
            toast.error(err.message || 'Gagal menghapus');
        }
    };

    const toggleAktif = async (item) => {
        try {
            await api.put(`/iklan/${item.id}`, { aktif: !item.aktif });
            toast.success(item.aktif ? 'Iklan dinonaktifkan' : 'Iklan diaktifkan');
            fetchData();
        } catch (err) { toast.error(err.message); }
    };

    const copyScript = (item) => {
        navigator.clipboard.writeText(item.scriptCode);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Non-admin: show nothing (scripts auto-injected via AdScriptInjector)
    if (!isAdmin) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title"><Megaphone size={22} /> Iklan & Promosi</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Hanya admin yang dapat mengelola iklan</p>
                </div>
                <div style={{ textAlign: 'center', padding: 80 }}>
                    <Megaphone size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                    <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Menu ini hanya tersedia untuk admin</p>
                </div>
            </div>
        );
    }

    // ===== ADMIN VIEW =====
    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 className="page-title"><Megaphone size={22} /> Manajemen Iklan</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Kelola script iklan (Google Adsense, dll). Script akan otomatis di-inject ke halaman.</p>
                </div>
                <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Tambah Iklan</button>
            </div>

            {/* Info box */}
            <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent-blue)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Code size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                        <strong>Cara kerja:</strong> Masukkan script tag iklan (contoh: Google AdSense, Facebook Pixel, dll).
                        Script aktif akan otomatis di-inject ke <code style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4 }}>&lt;head&gt;</code> halaman saat aplikasi dimuat.
                        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 6, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
{`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxxxxxxx" crossorigin="anonymous"></script>`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input className="form-input" placeholder="Cari iklan..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {data.filter(d => d.aktif).length} aktif / {data.length} total
                </span>
            </div>

            {/* Cards Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Memuat...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 80 }}>
                    <Megaphone size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                    <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Belum ada iklan. Klik "Tambah Iklan" untuk menambahkan.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
                    {filtered.map(item => (
                        <div key={item.id} className="card" style={{
                            padding: '20px', position: 'relative',
                            opacity: item.aktif ? 1 : 0.6,
                            borderLeft: `4px solid ${item.aktif ? '#22c55e' : '#6b7280'}`
                        }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 15 }}>{item.judul}</div>
                                    {item.deskripsi && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.deskripsi}</div>}
                                </div>
                                <span style={{
                                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                    background: item.aktif ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
                                    color: item.aktif ? '#22c55e' : '#6b7280'
                                }}>
                                    {item.aktif ? 'Aktif' : 'Nonaktif'}
                                </span>
                            </div>

                            {/* Script preview */}
                            <div style={{
                                padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)',
                                fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5,
                                maxHeight: 100, overflow: 'auto', marginBottom: 12,
                                whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-secondary)'
                            }}>
                                {item.scriptCode}
                            </div>

                            {/* Meta */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                <span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
                                    {item.posisi || 'head'}
                                </span>
                                <span>Prioritas: {item.prioritas || 0}</span>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => toggleAktif(item)}>
                                    {item.aktif ? <PowerOff size={13} /> : <Power size={13} />}
                                    {item.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                                </button>
                                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => copyScript(item)}>
                                    {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                                    {copiedId === item.id ? 'Tersalin!' : 'Copy'}
                                </button>
                                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => handleEdit(item)}>
                                    <Edit size={13} /> Edit
                                </button>
                                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--accent-red)' }} onClick={() => setDeleteTarget(item)}>
                                    <Trash2 size={13} /> Hapus
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ===== ADD/EDIT MODAL ===== */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, borderRadius: 16, overflow: 'hidden', border: 'none' }}>
                        
                        {/* Gradient Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            padding: '28px 28px 24px', position: 'relative', overflow: 'hidden'
                        }}>
                            {/* Background decoration */}
                            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                            <div style={{ position: 'absolute', bottom: -20, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)'
                                    }}>
                                        <Code size={24} style={{ color: '#fff' }} />
                                    </div>
                                    <div>
                                        <h3 style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 700 }}>
                                            {editItem ? 'Edit Script Iklan' : 'Tambah Script Iklan'}
                                        </h3>
                                        <p style={{ color: 'rgba(255,255,255,0.7)', margin: '4px 0 0', fontSize: 13 }}>
                                            Pasang script iklan ke aplikasi
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowModal(false)} style={{
                                    background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 36, height: 36,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                    color: '#fff', transition: 'background 0.2s'
                                }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                                   onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '24px 28px', maxHeight: '60vh', overflowY: 'auto' }}>
                            
                            {/* Section 1: Info */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: 13, fontWeight: 700
                                }}>1</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: 'var(--text-primary)' }}>Informasi Iklan</div>
                                    <div style={{ display: 'grid', gap: 12 }}>
                                        <div>
                                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                Judul / Label <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <input className="form-input" value={formData.judul}
                                                onChange={e => setFormData(p => ({ ...p, judul: e.target.value }))}
                                                placeholder="Contoh: Google AdSense Banner"
                                                style={{ borderRadius: 10, padding: '10px 14px', fontSize: 14 }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                Deskripsi <span style={{ fontSize: 10, fontWeight: 400 }}>(opsional)</span>
                                            </label>
                                            <input className="form-input" value={formData.deskripsi}
                                                onChange={e => setFormData(p => ({ ...p, deskripsi: e.target.value }))}
                                                placeholder="Catatan untuk referensi internal"
                                                style={{ borderRadius: 10, padding: '10px 14px', fontSize: 14 }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div style={{ height: 1, background: 'var(--border-color)', margin: '0 0 24px 42px' }} />

                            {/* Section 2: Script Code */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: 13, fontWeight: 700
                                }}>2</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: 'var(--text-primary)' }}>Script Code</div>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                                        Paste kode script iklan lengkap. Contoh: Google AdSense, Facebook Pixel, Analytics, dll.
                                    </p>
                                    
                                    {/* Code editor style */}
                                    <div style={{
                                        borderRadius: 12, overflow: 'hidden',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-primary)'
                                    }}>
                                        {/* Editor toolbar */}
                                        <div style={{
                                            padding: '8px 14px', background: 'var(--bg-secondary)',
                                            borderBottom: '1px solid var(--border-color)',
                                            display: 'flex', alignItems: 'center', gap: 8
                                        }}>
                                            <div style={{ display: 'flex', gap: 5 }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                                            </div>
                                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', marginLeft: 8 }}>
                                                script.html
                                            </span>
                                        </div>
                                        
                                        <textarea
                                            value={formData.scriptCode}
                                            onChange={e => setFormData(p => ({ ...p, scriptCode: e.target.value }))}
                                            placeholder={'<script async\n  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxxxxxxx"\n  crossorigin="anonymous">\n</script>'}
                                            rows={8}
                                            style={{
                                                width: '100%', border: 'none', outline: 'none', resize: 'vertical',
                                                padding: '14px 16px', fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                                                fontSize: 13, lineHeight: 1.7, background: 'transparent',
                                                color: 'var(--text-primary)', boxSizing: 'border-box',
                                                minHeight: 160
                                            }}
                                        />
                                    </div>

                                    {/* Hint */}
                                    <div style={{
                                        marginTop: 10, padding: '8px 12px', borderRadius: 8,
                                        background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.15)',
                                        fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8
                                    }}>
                                        <Code size={14} style={{ color: '#667eea', flexShrink: 0 }} />
                                        Script akan di-inject ke <code style={{ background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3, fontWeight: 600, fontSize: 11 }}>&lt;head&gt;</code> saat halaman dimuat
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div style={{ height: 1, background: 'var(--border-color)', margin: '0 0 24px 42px' }} />

                            {/* Section 3: Settings */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: 13, fontWeight: 700
                                }}>3</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: 'var(--text-primary)' }}>Pengaturan</div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                        {/* Posisi */}
                                        <div>
                                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Posisi Inject</label>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {POSISI_OPTIONS.map(o => (
                                                    <button key={o.value} onClick={() => setFormData(p => ({ ...p, posisi: o.value }))}
                                                        style={{
                                                            flex: 1, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                                                            border: formData.posisi === o.value ? '2px solid #667eea' : '2px solid var(--border-color)',
                                                            background: formData.posisi === o.value ? 'rgba(102,126,234,0.1)' : 'transparent',
                                                            color: formData.posisi === o.value ? '#667eea' : 'var(--text-secondary)',
                                                            fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                                                            fontFamily: 'monospace'
                                                        }}>
                                                        &lt;{o.value}&gt;
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Prioritas */}
                                        <div>
                                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Prioritas</label>
                                            <input className="form-input" type="number" value={formData.prioritas}
                                                onChange={e => setFormData(p => ({ ...p, prioritas: e.target.value }))}
                                                placeholder="0 (default)"
                                                style={{ borderRadius: 10, padding: '8px 14px', fontSize: 14 }} />
                                        </div>
                                    </div>

                                    {/* Active toggle */}
                                    <div style={{
                                        padding: '14px 18px', borderRadius: 12, 
                                        background: formData.aktif ? 'rgba(34,197,94,0.06)' : 'var(--bg-secondary)',
                                        border: `1px solid ${formData.aktif ? 'rgba(34,197,94,0.2)' : 'var(--border-color)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }} onClick={() => setFormData(p => ({ ...p, aktif: !p.aktif }))}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {formData.aktif ? <Power size={18} style={{ color: '#22c55e' }} /> : <PowerOff size={18} style={{ color: '#6b7280' }} />}
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: formData.aktif ? '#22c55e' : 'var(--text-secondary)' }}>
                                                    {formData.aktif ? 'Iklan Aktif' : 'Iklan Nonaktif'}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                                    {formData.aktif ? 'Script akan di-inject ke halaman' : 'Script tidak akan dimuat'}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Toggle switch */}
                                        <div style={{
                                            width: 44, height: 24, borderRadius: 12, padding: 3,
                                            background: formData.aktif ? '#22c55e' : '#6b7280',
                                            transition: 'background 0.3s', position: 'relative'
                                        }}>
                                            <div style={{
                                                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                                transition: 'transform 0.3s',
                                                transform: formData.aktif ? 'translateX(20px)' : 'translateX(0)'
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '18px 28px', borderTop: '1px solid var(--border-color)',
                            display: 'flex', justifyContent: 'flex-end', gap: 10
                        }}>
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ borderRadius: 10, padding: '10px 20px' }}>
                                Batal
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} style={{
                                borderRadius: 10, padding: '10px 24px',
                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                border: 'none', fontWeight: 600
                            }}>
                                <Save size={15} /> {editItem ? 'Simpan Perubahan' : 'Tambah Iklan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DELETE CONFIRM ===== */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header"><h3 style={{ color: 'var(--accent-red)' }}><AlertTriangle size={18} /> Konfirmasi Hapus</h3></div>
                        <div className="modal-body">
                            <p>Yakin ingin menghapus iklan <b>"{deleteTarget.judul}"</b>?</p>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Script iklan akan dihapus dan tidak lagi di-inject ke halaman.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Batal</button>
                            <button className="btn btn-primary" style={{ background: 'var(--accent-red)' }} onClick={executeDelete}><Trash2 size={14} /> Hapus</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Iklan;
