import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Megaphone, Plus, Edit, Trash2, Search, X, Save, AlertTriangle,
    Eye, MousePointerClick, DollarSign, BarChart2, ExternalLink,
    TrendingUp, Target, Calendar, ChevronLeft, ChevronRight, Power, PowerOff,
    Globe, Image as ImageIcon, Zap
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../api/client';
import toast from 'react-hot-toast';

// ===== CONSTANTS =====
const TIPE_IKLAN = ['banner', 'sidebar', 'popup', 'native'];
const STATUS_IKLAN = ['aktif', 'nonaktif', 'habis', 'dijadwalkan'];

const formatCurrency = (v) => v ? `Rp ${Number(v).toLocaleString('id-ID')}` : 'Rp 0';
const formatNumber = (v) => Number(v || 0).toLocaleString('id-ID');

const Iklan = () => {
    const user = useAuthStore(s => s.user);
    const isAdmin = user?.role === 'Admin';

    // ===== DATA STATE =====
    const [data, setData] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // ===== UI STATE =====
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterTipe, setFilterTipe] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // ===== FORM STATE =====
    const [formData, setFormData] = useState({
        judul: '', deskripsi: '', tipeIklan: 'banner', gambarUrl: '', targetUrl: '',
        advertiser: '', biayaPerKlik: '', biayaPerTayang: '', budgetTotal: '',
        status: 'aktif', tanggalMulai: '', tanggalSelesai: '', prioritas: 0
    });

    // ===== FETCH =====
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/iklan');
            setData(res.data || res || []);
            if (isAdmin) {
                try { const s = await api.get('/iklan/stats'); setStats(s); } catch { }
            }
        } catch (err) {
            console.error('iklan fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ===== FILTERING =====
    const filtered = useMemo(() => {
        return data.filter(d => {
            if (search && !d.judul?.toLowerCase().includes(search.toLowerCase()) &&
                !d.advertiser?.toLowerCase().includes(search.toLowerCase())) return false;
            if (filterStatus && d.status !== filterStatus) return false;
            if (filterTipe && d.tipeIklan !== filterTipe) return false;
            return true;
        });
    }, [data, search, filterStatus, filterTipe]);

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // ===== HANDLERS =====
    const resetForm = () => {
        setFormData({ judul: '', deskripsi: '', tipeIklan: 'banner', gambarUrl: '', targetUrl: '', advertiser: '', biayaPerKlik: '', biayaPerTayang: '', budgetTotal: '', status: 'aktif', tanggalMulai: '', tanggalSelesai: '', prioritas: 0 });
        setEditItem(null);
    };
    const handleAdd = () => { resetForm(); setShowModal(true); };
    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({
            judul: item.judul || '', deskripsi: item.deskripsi || '', tipeIklan: item.tipeIklan || 'banner',
            gambarUrl: item.gambarUrl || '', targetUrl: item.targetUrl || '', advertiser: item.advertiser || '',
            biayaPerKlik: item.biayaPerKlik || '', biayaPerTayang: item.biayaPerTayang || '',
            budgetTotal: item.budgetTotal || '', status: item.status || 'aktif',
            tanggalMulai: item.tanggalMulai || '', tanggalSelesai: item.tanggalSelesai || '',
            prioritas: item.prioritas || 0
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.judul) { toast.error('Judul iklan wajib diisi'); return; }
        if (!formData.advertiser) { toast.error('Advertiser wajib diisi'); return; }
        try {
            const payload = {
                ...formData,
                biayaPerKlik: parseFloat(formData.biayaPerKlik) || 0,
                biayaPerTayang: parseFloat(formData.biayaPerTayang) || 0,
                budgetTotal: parseFloat(formData.budgetTotal) || 0,
                prioritas: parseInt(formData.prioritas) || 0,
            };
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
            toast.error(err.message || 'Gagal menyimpan iklan');
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

    const handleAdClick = async (ad) => {
        try { await api.post(`/iklan/${ad.id}/klik`); } catch { }
        if (ad.targetUrl) window.open(ad.targetUrl, '_blank');
    };

    const toggleStatus = async (item) => {
        try {
            const newStatus = item.status === 'aktif' ? 'nonaktif' : 'aktif';
            await api.put(`/iklan/${item.id}`, { status: newStatus });
            toast.success(`Iklan ${newStatus === 'aktif' ? 'diaktifkan' : 'dinonaktifkan'}`);
            fetchData();
        } catch (err) { toast.error(err.message); }
    };

    // ===== STATUS BADGE =====
    const renderStatus = (status) => {
        const map = {
            aktif: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', label: 'Aktif' },
            nonaktif: { bg: 'rgba(156,163,175,0.1)', color: '#9ca3af', label: 'Nonaktif' },
            habis: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Budget Habis' },
            dijadwalkan: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', label: 'Dijadwalkan' },
        };
        const s = map[status] || map.nonaktif;
        return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
    };

    // ===== NON-ADMIN: AD GALLERY =====
    if (!isAdmin) {
        const activeAds = data.filter(d => d.status === 'aktif');
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title"><Megaphone size={22} /> Iklan & Promosi</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Informasi iklan dan promosi mitra</p>
                </div>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Memuat iklan...</div>
                ) : activeAds.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 80 }}>
                        <Megaphone size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                        <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Belum ada iklan aktif saat ini</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                        {activeAds.map(ad => (
                            <div key={ad.id} className="card" style={{ cursor: 'pointer', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative' }}
                                onClick={() => handleAdClick(ad)}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.12)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                            >
                                {/* Sponsored badge */}
                                <div style={{ position: 'absolute', top: 12, right: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', backdropFilter: 'blur(4px)' }}>
                                    Sponsored
                                </div>
                                {ad.gambarUrl ? (
                                    <div style={{ height: 180, background: `url(${ad.gambarUrl}) center/cover`, borderBottom: '1px solid var(--border-color)' }} />
                                ) : (
                                    <div style={{ height: 180, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border-color)' }}>
                                        <Megaphone size={48} style={{ color: 'rgba(255,255,255,0.4)' }} />
                                    </div>
                                )}
                                <div style={{ padding: '16px 20px' }}>
                                    <div style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{ad.advertiser}</div>
                                    <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{ad.judul}</h3>
                                    {ad.deskripsi && <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{ad.deskripsi}</p>}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', fontSize: 13, fontWeight: 500 }}>
                                        <ExternalLink size={14} /> Kunjungi
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ===== ADMIN VIEW =====
    return (
        <div>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 className="page-title"><Megaphone size={22} /> Manajemen Iklan</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Kelola iklan berbayar (CPC/CPM)</p>
                </div>
                <button className="btn-primary" onClick={handleAdd}><Plus size={16} /> Tambah Iklan</button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                    {[
                        { label: 'Total Iklan', value: stats.totalIklan, icon: <Megaphone size={20} />, color: '#8b5cf6' },
                        { label: 'Iklan Aktif', value: stats.iklanAktif, icon: <Zap size={20} />, color: '#22c55e' },
                        { label: 'Total Tayang', value: formatNumber(stats.totalTayang), icon: <Eye size={20} />, color: '#3b82f6' },
                        { label: 'Total Klik', value: formatNumber(stats.totalKlik), icon: <MousePointerClick size={20} />, color: '#f59e0b' },
                        { label: 'CTR', value: `${stats.ctr}%`, icon: <TrendingUp size={20} />, color: '#ec4899' },
                        { label: 'Pendapatan', value: formatCurrency(stats.totalPendapatan), icon: <DollarSign size={20} />, color: '#10b981' },
                    ].map((s, i) => (
                        <div key={i} className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                                {s.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter Bar */}
            <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input className="form-input" placeholder="Cari judul / advertiser..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
                </div>
                <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 160 }}>
                    <option value="">Semua Status</option>
                    {STATUS_IKLAN.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <select className="form-select" value={filterTipe} onChange={e => setFilterTipe(e.target.value)} style={{ width: 140 }}>
                    <option value="">Semua Tipe</option>
                    {TIPE_IKLAN.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
            </div>

            {/* Data Table */}
            <div className="card" style={{ overflow: 'auto' }}>
                <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th>Judul</th>
                            <th>Advertiser</th>
                            <th>Tipe</th>
                            <th>CPC</th>
                            <th>CPM</th>
                            <th style={{ textAlign: 'right' }}>Budget</th>
                            <th style={{ textAlign: 'right' }}>Terpakai</th>
                            <th style={{ textAlign: 'right' }}>Tayang</th>
                            <th style={{ textAlign: 'right' }}>Klik</th>
                            <th>CTR</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40 }}>Memuat...</td></tr>
                        ) : paged.length === 0 ? (
                            <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Belum ada data iklan</td></tr>
                        ) : paged.map(item => {
                            const ctr = item.totalTayang > 0 ? ((item.totalKlik / item.totalTayang) * 100).toFixed(2) + '%' : '0%';
                            const budgetPct = item.budgetTotal > 0 ? Math.min(100, ((item.budgetTerpakai || 0) / item.budgetTotal * 100)).toFixed(0) : 0;
                            return (
                                <tr key={item.id}>
                                    <td>
                                        <div style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.judul}</div>
                                        {item.targetUrl && <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.targetUrl}</div>}
                                    </td>
                                    <td>{item.advertiser}</td>
                                    <td><span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{item.tipeIklan}</span></td>
                                    <td>{formatCurrency(item.biayaPerKlik)}</td>
                                    <td>{formatCurrency(item.biayaPerTayang)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.budgetTotal)}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div>{formatCurrency(item.budgetTerpakai)}</div>
                                        {item.budgetTotal > 0 && (
                                            <div style={{ marginTop: 4, height: 3, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${budgetPct}%`, borderRadius: 2, background: budgetPct > 80 ? '#ef4444' : budgetPct > 50 ? '#f59e0b' : '#22c55e', transition: 'width 0.3s' }} />
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNumber(item.totalTayang)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNumber(item.totalKlik)}</td>
                                    <td><span style={{ fontWeight: 600, color: parseFloat(ctr) > 1 ? '#22c55e' : 'var(--text-secondary)' }}>{ctr}</span></td>
                                    <td>{renderStatus(item.status)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" onClick={() => toggleStatus(item)} title={item.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'} style={{ color: item.status === 'aktif' ? '#22c55e' : '#9ca3af' }}>
                                                {item.status === 'aktif' ? <Power size={14} /> : <PowerOff size={14} />}
                                            </button>
                                            <button className="btn-icon" onClick={() => handleEdit(item)} title="Edit"><Edit size={14} /></button>
                                            <button className="btn-icon" onClick={() => setDeleteTarget(item)} title="Hapus" style={{ color: 'var(--accent-red)' }}><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Menampilkan {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={16} /></button>
                        <button className="btn-icon" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={16} /></button>
                    </div>
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Judul Iklan *</label>
                                    <input className="form-input" value={formData.judul} onChange={e => setFormData(p => ({ ...p, judul: e.target.value }))} placeholder="Masukkan judul iklan" />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Deskripsi</label>
                                    <textarea className="form-input" rows={2} value={formData.deskripsi} onChange={e => setFormData(p => ({ ...p, deskripsi: e.target.value }))} placeholder="Deskripsi singkat iklan" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Advertiser *</label>
                                    <input className="form-input" value={formData.advertiser} onChange={e => setFormData(p => ({ ...p, advertiser: e.target.value }))} placeholder="Nama pemasang iklan" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipe Iklan</label>
                                    <select className="form-select" value={formData.tipeIklan} onChange={e => setFormData(p => ({ ...p, tipeIklan: e.target.value }))}>
                                        {TIPE_IKLAN.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">URL Gambar</label>
                                    <input className="form-input" value={formData.gambarUrl} onChange={e => setFormData(p => ({ ...p, gambarUrl: e.target.value }))} placeholder="https://example.com/banner.jpg" />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">URL Tujuan (Target Link)</label>
                                    <input className="form-input" value={formData.targetUrl} onChange={e => setFormData(p => ({ ...p, targetUrl: e.target.value }))} placeholder="https://example.com" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Biaya Per Klik (CPC)</label>
                                    <input className="form-input" type="number" value={formData.biayaPerKlik} onChange={e => setFormData(p => ({ ...p, biayaPerKlik: e.target.value }))} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Biaya Per 1000 Tayang (CPM)</label>
                                    <input className="form-input" type="number" value={formData.biayaPerTayang} onChange={e => setFormData(p => ({ ...p, biayaPerTayang: e.target.value }))} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Budget Total</label>
                                    <input className="form-input" type="number" value={formData.budgetTotal} onChange={e => setFormData(p => ({ ...p, budgetTotal: e.target.value }))} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Prioritas</label>
                                    <input className="form-input" type="number" value={formData.prioritas} onChange={e => setFormData(p => ({ ...p, prioritas: e.target.value }))} placeholder="0 = rendah" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tanggal Mulai</label>
                                    <input className="form-input" type="date" value={formData.tanggalMulai} onChange={e => setFormData(p => ({ ...p, tanggalMulai: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tanggal Selesai</label>
                                    <input className="form-input" type="date" value={formData.tanggalSelesai} onChange={e => setFormData(p => ({ ...p, tanggalSelesai: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-select" value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
                                        {STATUS_IKLAN.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                            <button className="btn-primary" onClick={handleSave}><Save size={14} /> {editItem ? 'Simpan Perubahan' : 'Tambah Iklan'}</button>
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
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Data iklan dan statistik akan terhapus permanen.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Batal</button>
                            <button className="btn-primary" style={{ background: 'var(--accent-red)' }} onClick={executeDelete}><Trash2 size={14} /> Hapus</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Iklan;
