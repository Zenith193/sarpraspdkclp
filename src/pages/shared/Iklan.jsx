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
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <div className="modal-header">
                            <h3>{editItem ? 'Edit Iklan' : 'Tambah Iklan Baru'}</h3>
                            <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Judul / Label *</label>
                                    <input className="form-input" value={formData.judul} onChange={e => setFormData(p => ({ ...p, judul: e.target.value }))} placeholder="Contoh: Google AdSense Banner" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Deskripsi (opsional)</label>
                                    <input className="form-input" value={formData.deskripsi} onChange={e => setFormData(p => ({ ...p, deskripsi: e.target.value }))} placeholder="Catatan untuk referensi" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Script Code *</label>
                                    <textarea className="form-input" rows={6} value={formData.scriptCode} onChange={e => setFormData(p => ({ ...p, scriptCode: e.target.value }))}
                                        placeholder={'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxxxxxxx" crossorigin="anonymous"></script>'}
                                        style={{ fontFamily: 'monospace', fontSize: 12 }} />
                                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        Paste kode script iklan lengkap termasuk tag &lt;script&gt;
                                    </p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">Posisi</label>
                                        <select className="form-select" value={formData.posisi} onChange={e => setFormData(p => ({ ...p, posisi: e.target.value }))}>
                                            {POSISI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Prioritas</label>
                                        <input className="form-input" type="number" value={formData.prioritas} onChange={e => setFormData(p => ({ ...p, prioritas: e.target.value }))} placeholder="0" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formData.aktif} onChange={e => setFormData(p => ({ ...p, aktif: e.target.checked }))} style={{ width: 16, height: 16 }} />
                                        <span style={{ fontSize: 14 }}>Aktifkan iklan ini</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> {editItem ? 'Simpan Perubahan' : 'Tambah Iklan'}</button>
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
