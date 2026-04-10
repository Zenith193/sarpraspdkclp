import { useState, useEffect } from 'react';
import { MessageSquare, Trash2, CheckCircle, Clock, Eye, X, Search, Edit2, Save } from 'lucide-react';
import { feedbackApi } from '../../api/index';
import toast from 'react-hot-toast';

const ManajemenFeedback = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('Semua');
    const [viewItem, setViewItem] = useState(null);
    const [editItem, setEditItem] = useState(null);
    const [editCatatan, setEditCatatan] = useState('');
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await feedbackApi.list();
            setData(Array.isArray(res) ? res : []);
        } catch { setData([]); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id) => {
        if (!confirm('Yakin hapus feedback ini?')) return;
        try {
            await feedbackApi.delete(id);
            toast.success('Feedback dihapus');
            load();
            if (viewItem?.id === id) setViewItem(null);
        } catch { toast.error('Gagal menghapus'); }
    };

    const handleStatus = async (id, status) => {
        try {
            await feedbackApi.update(id, { status });
            toast.success(`Status diubah ke ${status}`);
            load();
            if (viewItem?.id === id) setViewItem(prev => ({ ...prev, status }));
        } catch { toast.error('Gagal mengubah status'); }
    };

    const handleSaveCatatan = async () => {
        if (!editItem) return;
        setSaving(true);
        try {
            await feedbackApi.update(editItem.id, { catatanAdmin: editCatatan });
            toast.success('Catatan disimpan');
            load();
            setEditItem(null);
            if (viewItem?.id === editItem.id) setViewItem(prev => ({ ...prev, catatanAdmin: editCatatan }));
        } catch { toast.error('Gagal menyimpan catatan'); }
        setSaving(false);
    };

    const filtered = data.filter(d => {
        if (filterStatus !== 'Semua' && d.status !== filterStatus) return false;
        if (search) {
            const q = search.toLowerCase();
            return (d.namaAkun || '').toLowerCase().includes(q) ||
                (d.email || '').toLowerCase().includes(q) ||
                (d.isiGagasan || '').toLowerCase().includes(q) ||
                (d.role || '').toLowerCase().includes(q);
        }
        return true;
    });

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

    const statusBadge = (status) => {
        const map = {
            'Baru': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', icon: Clock },
            'Selesai': { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', icon: CheckCircle },
        };
        const s = map[status] || map['Baru'];
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: '0.78rem', fontWeight: 600 }}>
                <s.icon size={13} /> {status}
            </span>
        );
    };

    const roleBadge = (role) => {
        const colors = { Sekolah: '#3b82f6', Korwil: '#f59e0b', Penyedia: '#8b5cf6' };
        const c = colors[role] || '#6b7280';
        return <span style={{ padding: '3px 10px', borderRadius: 12, background: `${c}18`, color: c, fontSize: '0.75rem', fontWeight: 600 }}>{role}</span>;
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-left">
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><MessageSquare size={24} /> Manajemen Feedback</h1>
                    <p>Total {data.length} feedback — {data.filter(d => d.status === 'Baru').length} baru</p>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Feedback</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{data.length}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Baru</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>{data.filter(d => d.status === 'Baru').length}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Selesai</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>{data.filter(d => d.status === 'Selesai').length}</div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                {['Semua', 'Baru', 'Selesai'].map(f => (
                    <button key={f} onClick={() => setFilterStatus(f)}
                        className={filterStatus === f ? 'btn btn-primary' : 'btn btn-outline'}
                        style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                        {f === 'Semua' ? '📋 Semua' : f === 'Baru' ? '🕐 Baru' : '✅ Selesai'}
                    </button>
                ))}
                <div style={{ marginLeft: 'auto', position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: 32, padding: '8px 12px 8px 32px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-primary)', width: 220 }} />
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Memuat data...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Tidak ada feedback</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>#</th>
                                <th>AKSI</th>
                                <th>NAMA</th>
                                <th>ROLE</th>
                                <th>ISI GAGASAN</th>
                                <th>FOTO</th>
                                <th>STATUS</th>
                                <th>TANGGAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((d, i) => (
                                <tr key={d.id}>
                                    <td>{i + 1}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => setViewItem(d)} title="Lihat" style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}><Eye size={14} /></button>
                                            <button onClick={() => { setEditItem(d); setEditCatatan(d.catatanAdmin || ''); }} title="Edit Catatan" style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer' }}><Edit2 size={14} /></button>
                                            {d.status === 'Baru' && (
                                                <button onClick={() => handleStatus(d.id, 'Selesai')} title="Tandai Selesai" style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer' }}><CheckCircle size={14} /></button>
                                            )}
                                            <button onClick={() => handleDelete(d.id)} title="Hapus" style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{d.namaAkun}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{d.email}</div>
                                    </td>
                                    <td>{roleBadge(d.role)}</td>
                                    <td style={{ maxWidth: 300 }}>
                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{d.isiGagasan}</div>
                                    </td>
                                    <td>{d.fotoPath ? '📷' : '-'}</td>
                                    <td>{statusBadge(d.status)}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(d.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* View Modal */}
            {viewItem && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setViewItem(null)} />
                    <div style={{ position: 'relative', background: 'var(--bg-primary)', borderRadius: 16, width: 'min(90vw, 560px)', maxHeight: '85vh', overflow: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <button onClick={() => setViewItem(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare size={20} /> Detail Feedback</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 2 }}>NAMA AKUN</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{viewItem.namaAkun}</div>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 2 }}>EMAIL</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{viewItem.email}</div>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 2 }}>ROLE</div>
                                <div>{roleBadge(viewItem.role)}</div>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 2 }}>STATUS</div>
                                <div>{statusBadge(viewItem.status)}</div>
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--border-color)', marginBottom: 16 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 6 }}>ISI GAGASAN</div>
                            <div style={{ fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{viewItem.isiGagasan}</div>
                        </div>

                        {viewItem.fotoPath && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 6 }}>FOTO</div>
                                <img src={`/api/file/feedback/${viewItem.id}`} alt="Feedback" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, border: '1px solid var(--border-color)' }} />
                            </div>
                        )}

                        {viewItem.catatanAdmin && (
                            <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: '12px 16px', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 16 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>CATATAN ADMIN</div>
                                <div style={{ fontSize: '0.85rem' }}>{viewItem.catatanAdmin}</div>
                            </div>
                        )}

                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Dikirim: {formatDate(viewItem.createdAt)}</div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                            {viewItem.status === 'Baru' && (
                                <button onClick={() => { handleStatus(viewItem.id, 'Selesai'); }} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                                    <CheckCircle size={14} /> Tandai Selesai
                                </button>
                            )}
                            <button onClick={() => handleDelete(viewItem.id)} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#ef4444', borderColor: '#ef4444' }}>
                                <Trash2 size={14} /> Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Catatan Modal */}
            {editItem && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setEditItem(null)} />
                    <div style={{ position: 'relative', background: 'var(--bg-primary)', borderRadius: 16, width: 'min(90vw, 480px)', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <button onClick={() => setEditItem(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Edit2 size={18} /> Edit Catatan Admin</h3>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                            Feedback dari: <strong>{editItem.namaAkun}</strong> ({editItem.role})
                        </div>
                        <textarea
                            value={editCatatan}
                            onChange={e => setEditCatatan(e.target.value)}
                            placeholder="Tulis catatan admin..."
                            rows={4}
                            style={{
                                width: '100%', padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-input)',
                                borderRadius: 8, fontSize: '0.9rem', color: 'var(--text-primary)', resize: 'vertical',
                                fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16,
                            }}
                        />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditItem(null)} className="btn btn-outline" style={{ padding: '8px 16px' }}>Batal</button>
                            <button onClick={handleSaveCatatan} disabled={saving} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                                <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManajemenFeedback;
