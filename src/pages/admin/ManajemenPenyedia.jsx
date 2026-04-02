import { useState, useMemo, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Clock, Trash2, Eye, X, ChevronLeft, ChevronRight, AlertTriangle, Pencil, Save, Building2, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { perusahaanApi } from '../../api/index';

const ManajemenPenyedia = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterTipe, setFilterTipe] = useState('');
    const [detailItem, setDetailItem] = useState(null);
    const [editItem, setEditItem] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editSaving, setEditSaving] = useState(false);
    const [verifyTarget, setVerifyTarget] = useState(null);
    const [verifyStatus, setVerifyStatus] = useState('');
    const [verifyKeterangan, setVerifyKeterangan] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [page, setPage] = useState(1);
    const perPage = 20;

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await perusahaanApi.list();
            setData(result);
        } catch (err) {
            toast.error('Gagal memuat data');
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = useMemo(() => {
        return data.filter(p => {
            const matchSearch = !search || [p.namaPerusahaan, p.npwp, p.namaPemilik, p.emailPerusahaan].some(f => f?.toLowerCase().includes(search.toLowerCase()));
            const matchStatus = !filterStatus || p.status === filterStatus;
            const matchTipe = !filterTipe || p.tipePerusahaan === filterTipe;
            return matchSearch && matchStatus && matchTipe;
        });
    }, [data, search, filterStatus, filterTipe]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const paged = filtered.slice((page - 1) * perPage, page * perPage);

    const statusBadge = (status) => {
        const cfg = {
            'Menunggu': { color: 'var(--accent-yellow)', bg: 'rgba(251,191,36,0.12)', icon: <Clock size={12} /> },
            'Diverifikasi': { color: 'var(--accent-green)', bg: 'rgba(34,197,94,0.12)', icon: <CheckCircle size={12} /> },
            'Ditolak': { color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.12)', icon: <XCircle size={12} /> },
        }[status] || { color: 'var(--text-secondary)', bg: 'var(--bg-secondary)', icon: null };
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: cfg.color, background: cfg.bg }}>{cfg.icon} {status}</span>;
    };

    const tipeBadge = (tipe) => {
        const cfg = {
            'Penyedia': { color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.12)', icon: <Building2 size={12} /> },
            'Konsultan': { color: 'var(--accent-purple, #a855f7)', bg: 'rgba(168,85,247,0.12)', icon: <Briefcase size={12} /> },
        }[tipe] || { color: 'var(--text-secondary)', bg: 'var(--bg-secondary)', icon: null };
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: cfg.color, background: cfg.bg }}>{cfg.icon} {tipe || 'Penyedia'}</span>;
    };

    const handleVerify = async () => {
        if (!verifyTarget || !verifyStatus) return;
        try {
            await perusahaanApi.verify(verifyTarget.id, { status: verifyStatus, keterangan: verifyKeterangan });
            toast.success(`Perusahaan ${verifyStatus === 'Diverifikasi' ? 'diverifikasi' : 'ditolak'}`);
            setVerifyTarget(null); setVerifyStatus(''); setVerifyKeterangan('');
            fetchData();
        } catch (err) { toast.error(err?.message || 'Gagal'); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await perusahaanApi.delete(deleteTarget.id);
            toast.success('Perusahaan dihapus');
            setDeleteTarget(null);
            fetchData();
        } catch (err) { toast.error(err?.message || 'Gagal menghapus'); }
    };

    // ===== EDIT HANDLERS =====
    const openEdit = (item) => {
        setEditItem(item);
        setEditForm({
            nikPemilik: item.nikPemilik || '',
            namaPemilik: item.namaPemilik || '',
            jabatanPemilik: item.jabatanPemilik || '',
            alamatPemilik: item.alamatPemilik || '',
            namaPerusahaan: item.namaPerusahaan || '',
            namaPerusahaanSingkat: item.namaPerusahaanSingkat || '',
            tipePerusahaan: item.tipePerusahaan || 'Penyedia',
            noAkta: item.noAkta || '',
            namaNotaris: item.namaNotaris || '',
            tanggalAkta: item.tanggalAkta || '',
            alamatPerusahaan: item.alamatPerusahaan || '',
            noTelp: item.noTelp || '',
            emailPerusahaan: item.emailPerusahaan || '',
            npwp: item.npwp || '',
            noRekening: item.noRekening || '',
            namaRekening: item.namaRekening || '',
            bank: item.bank || '',
        });
    };

    const setField = (k, v) => setEditForm(prev => ({ ...prev, [k]: v }));

    const handleEditSave = async () => {
        if (!editItem) return;
        setEditSaving(true);
        try {
            await perusahaanApi.update(editItem.id, editForm);
            toast.success('Data penyedia berhasil diperbarui');
            setEditItem(null);
            fetchData();
        } catch (err) {
            toast.error(err?.message || 'Gagal menyimpan');
        } finally { setEditSaving(false); }
    };

    const countByStatus = (st) => data.filter(d => d.status === st).length;
    const countByTipe = (t) => data.filter(d => (d.tipePerusahaan || 'Penyedia') === t).length;

    // Form row helper
    const formRow = (children, cols = 2) => (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14, marginBottom: 14 }}>
            {children}
        </div>
    );

    const formField = (label, field, opts = {}) => (
        <div className="form-group" style={opts.style || {}}>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4, color: 'var(--text-secondary)' }}>
                {label} {opts.required && <span style={{ color: 'var(--accent-red)' }}>*</span>}
            </label>
            {opts.helper && <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: 4, opacity: 0.7 }}>{opts.helper}</div>}
            {opts.type === 'textarea' ? (
                <textarea className="form-input" rows={opts.rows || 3} value={editForm[field] || ''} onChange={e => setField(field, e.target.value)}
                    placeholder={opts.placeholder || ''} style={{ resize: 'vertical', fontSize: '0.85rem' }} />
            ) : opts.type === 'select' ? (
                <select className="form-select" value={editForm[field] || ''} onChange={e => setField(field, e.target.value)} style={{ fontSize: '0.85rem' }}>
                    {opts.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            ) : (
                <input className="form-input" type={opts.type || 'text'} value={editForm[field] || ''}
                    onChange={e => setField(field, e.target.value)} placeholder={opts.placeholder || ''}
                    maxLength={opts.maxLength} style={{ fontSize: '0.85rem' }} />
            )}
        </div>
    );

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Manajemen Penyedia</h1>
                    <p className="page-subtitle">Kelola data perusahaan penyedia (PT/CV)</p>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Total', value: data.length, color: 'var(--accent-blue)', filter: '' },
                    { label: 'Menunggu', value: countByStatus('Menunggu'), color: 'var(--accent-yellow)', filter: 'Menunggu' },
                    { label: 'Diverifikasi', value: countByStatus('Diverifikasi'), color: 'var(--accent-green)', filter: 'Diverifikasi' },
                    { label: 'Ditolak', value: countByStatus('Ditolak'), color: 'var(--accent-red)', filter: 'Ditolak' },
                ].map(s => (
                    <div key={s.label} className="stat-card" style={{
                        cursor: 'pointer',
                        borderLeft: `3px solid ${s.color}`,
                        opacity: filterStatus && filterStatus !== s.filter ? 0.5 : 1,
                        transition: 'all 0.2s',
                    }} onClick={() => setFilterStatus(filterStatus === s.filter ? '' : s.filter)}>
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Search & Filter */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
                    <Search size={16} className="search-icon" />
                    <input className="search-input" placeholder="Cari perusahaan, NPWP, email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className="form-select" value={filterTipe} onChange={e => { setFilterTipe(e.target.value); setPage(1); }} style={{ width: 160 }}>
                    <option value="">Semua Tipe</option>
                    <option value="Penyedia">Penyedia</option>
                    <option value="Konsultan">Konsultan</option>
                </select>
                <select className="form-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} style={{ width: 160 }}>
                    <option value="">Semua Status</option>
                    <option>Menunggu</option>
                    <option>Diverifikasi</option>
                    <option>Ditolak</option>
                </select>
            </div>

            {/* Table */}
            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: 40, textAlign: 'center' }}>No</th>
                            <th>Nama Perusahaan</th>
                            <th style={{ width: 90 }}>Tipe</th>
                            <th>NPWP</th>
                            <th>Pemilik</th>
                            <th>Email</th>
                            <th style={{ width: 110 }}>Status</th>
                            <th style={{ width: 130, textAlign: 'center' }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Memuat data...</td></tr>
                        ) : paged.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Belum ada data penyedia</td></tr>
                        ) : paged.map((p, i) => (
                            <tr key={p.id}>
                                <td style={{ textAlign: 'center' }}>{(page - 1) * perPage + i + 1}</td>
                                <td>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.namaPerusahaan}</div>
                                    {p.namaPerusahaanSingkat && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{p.namaPerusahaanSingkat}</div>}
                                </td>
                                <td>{tipeBadge(p.tipePerusahaan)}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{p.npwp}</td>
                                <td style={{ fontSize: '0.875rem' }}>{p.namaPemilik || '-'}</td>
                                <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{p.emailPerusahaan || '-'}</td>
                                <td>{statusBadge(p.status)}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                        <button className="btn-icon" title="Detail" onClick={() => setDetailItem(p)}><Eye size={15} /></button>
                                        <button className="btn-icon" title="Edit" style={{ color: 'var(--accent-blue)' }} onClick={() => openEdit(p)}><Pencil size={15} /></button>
                                        {p.status === 'Menunggu' && (
                                            <>
                                                <button className="btn-icon" title="Verifikasi" style={{ color: 'var(--accent-green)' }} onClick={() => { setVerifyTarget(p); setVerifyStatus('Diverifikasi'); }}><CheckCircle size={15} /></button>
                                                <button className="btn-icon" title="Tolak" style={{ color: 'var(--accent-red)' }} onClick={() => { setVerifyTarget(p); setVerifyStatus('Ditolak'); }}><XCircle size={15} /></button>
                                            </>
                                        )}
                                        <button className="btn-icon" title="Hapus" style={{ color: 'var(--accent-red)' }} onClick={() => setDeleteTarget(p)}><Trash2 size={15} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                    <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Halaman {page} / {totalPages}</span>
                    <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
                </div>
            )}

            {/* ===== MODAL DETAIL ===== */}
            {detailItem && (
                <div className="modal-overlay" onClick={() => setDetailItem(null)}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Detail Perusahaan</div>
                            <button className="modal-close" onClick={() => setDetailItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{detailItem.namaPerusahaan}</h3>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {tipeBadge(detailItem.tipePerusahaan)}
                                    {statusBadge(detailItem.status)}
                                </div>
                            </div>
                            {[
                                ['NPWP', detailItem.npwp],
                                ['Nama Singkat', detailItem.namaPerusahaanSingkat],
                                ['Tipe', detailItem.tipePerusahaan || 'Penyedia'],
                                ['Pemilik', detailItem.namaPemilik],
                                ['NIK', detailItem.nikPemilik],
                                ['Jabatan', detailItem.jabatanPemilik],
                                ['Alamat Pemilik', detailItem.alamatPemilik],
                                ['Alamat Perusahaan', detailItem.alamatPerusahaan],
                                ['Telepon', detailItem.noTelp],
                                ['Email', detailItem.emailPerusahaan],
                                ['No. Akta', detailItem.noAkta],
                                ['Nama Notaris', detailItem.namaNotaris],
                                ['Tanggal Akta', detailItem.tanggalAkta],
                                ['Bank', detailItem.bank],
                                ['No. Rekening', detailItem.noRekening],
                                ['Nama Rekening', detailItem.namaRekening],
                                ['Terdaftar', detailItem.createdAt ? new Date(detailItem.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'],
                            ].map(([label, value]) => value ? (
                                <div key={label} style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                                    <div style={{ width: 150, color: 'var(--text-secondary)', flexShrink: 0, fontWeight: 500 }}>{label}</div>
                                    <div style={{ color: 'var(--text-primary)' }}>{value}</div>
                                </div>
                            ) : null)}
                            {detailItem.keteranganVerifikasi && (
                                <div style={{ marginTop: 16, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                    <strong style={{ fontSize: '0.82rem' }}>Keterangan Verifikasi:</strong>
                                    <div style={{ fontSize: '0.85rem', marginTop: 4, color: 'var(--text-secondary)' }}>{detailItem.keteranganVerifikasi}</div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setDetailItem(null)}>Tutup</button>
                            <button className="btn btn-secondary" onClick={() => { openEdit(detailItem); setDetailItem(null); }}>
                                <Pencil size={14} /> Edit
                            </button>
                            {detailItem.status === 'Menunggu' && (
                                <>
                                    <button className="btn btn-secondary" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)' }} onClick={() => { setVerifyTarget(detailItem); setVerifyStatus('Ditolak'); setDetailItem(null); }}>Tolak</button>
                                    <button className="btn btn-primary" onClick={() => { setVerifyTarget(detailItem); setVerifyStatus('Diverifikasi'); setDetailItem(null); }}>Verifikasi</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL EDIT ===== */}
            {editItem && (
                <div className="modal-overlay" onClick={() => setEditItem(null)}>
                    <div className="modal" style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Edit Data Penyedia</div>
                            <button className="modal-close" onClick={() => setEditItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                            {/* NIK, Nama, Jabatan */}
                            {formRow(<>
                                {formField('NIK', 'nikPemilik', { required: true, placeholder: 'Nomor Induk Kependudukan Pemilik/Direktur', helper: 'Nomor Induk Kependudukan Pemilik/Direktur', maxLength: 16 })}
                                {formField('Nama', 'namaPemilik', { required: true, placeholder: 'Nama Pemilik Sah Perusahaan', helper: 'Nama Pemilik Sah Perusahaan' })}
                                {formField('Jabatan', 'jabatanPemilik', { required: true, placeholder: 'Jabatan Wakil Sah Perusahaan', helper: 'Jabatan Wakil Sah Perusahaan' })}
                            </>, 3)}

                            {/* Alamat */}
                            {formField('Alamat', 'alamatPemilik', { required: true, type: 'textarea', rows: 2, placeholder: 'Alamat lengkap pemilik/direktur', helper: 'Alamat Pemilik/Direktur Perusahaan' })}

                            {/* Nama Perusahaan */}
                            {formRow(<>
                                {formField('Nama Perusahaan (lengkap)', 'namaPerusahaan', { required: true, placeholder: 'PT/CV ...' })}
                                {formField('Nama Perusahaan (singkat)', 'namaPerusahaanSingkat', { required: true, placeholder: 'Singkatan' })}
                            </>)}

                            {/* Akta Notaris */}
                            {formRow(<>
                                {formField('Akta Notaris', 'noAkta', { required: true, placeholder: 'Nomor akta' })}
                                {formField('Nama Notaris', 'namaNotaris', { placeholder: 'Nama notaris' })}
                                {formField('Tanggal Akta', 'tanggalAkta', { type: 'date' })}
                            </>, 3)}

                            {/* Alamat Perusahaan */}
                            {formField('Alamat Perusahaan', 'alamatPerusahaan', { required: true, type: 'textarea', rows: 2, placeholder: 'Alamat kantor perusahaan' })}

                            {/* Kontak */}
                            {formRow(<>
                                {formField('No. Telepon', 'noTelp', { placeholder: '081234567890', maxLength: 13 })}
                                {formField('Email Perusahaan', 'emailPerusahaan', { type: 'email', placeholder: 'info@perusahaan.com' })}
                            </>)}

                            {/* NPWP */}
                            {formField('NPWP', 'npwp', { required: true, placeholder: '93.290.382.0-382.323' })}

                            {/* Rekening */}
                            {formRow(<>
                                {formField('Bank', 'bank', { placeholder: 'Nama bank' })}
                                {formField('No. Rekening', 'noRekening', { placeholder: '123456789' })}
                                {formField('Nama Rekening', 'namaRekening', { placeholder: 'Atas nama...' })}
                            </>, 3)}

                            {/* Tipe Perusahaan */}
                            <div style={{ marginTop: 4 }}>
                                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 8, color: 'var(--text-secondary)' }}>Tipe Perusahaan <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {['Penyedia', 'Konsultan'].map(tipe => (
                                        <label key={tipe} style={{
                                            flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                                            borderRadius: 'var(--radius-md)',
                                            border: `2px solid ${editForm.tipePerusahaan === tipe ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                                            background: editForm.tipePerusahaan === tipe ? 'rgba(59,130,246,0.08)' : 'transparent',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}>
                                            <input type="radio" name="editTipe" value={tipe} checked={editForm.tipePerusahaan === tipe}
                                                onChange={e => setField('tipePerusahaan', e.target.value)}
                                                style={{ accentColor: 'var(--accent-blue)', width: 16, height: 16 }} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{tipe}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                    {tipe === 'Penyedia' ? 'Penyedia barang/jasa' : 'Konsultan perencanaan/pengawasan'}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setEditItem(null)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleEditSave} disabled={editSaving}>
                                {editSaving ? <span className="spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} /> : <Save size={14} />}
                                {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL VERIFIKASI ===== */}
            {verifyTarget && (
                <div className="modal-overlay" onClick={() => setVerifyTarget(null)}>
                    <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{verifyStatus === 'Diverifikasi' ? '✅ Verifikasi' : '❌ Tolak'} Perusahaan</div>
                            <button className="modal-close" onClick={() => setVerifyTarget(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: 16 }}>
                                {verifyStatus === 'Diverifikasi'
                                    ? <>Anda akan <strong>memverifikasi</strong> perusahaan <strong>{verifyTarget.namaPerusahaan}</strong>. Akun login perusahaan akan diaktifkan.</>
                                    : <>Anda akan <strong>menolak</strong> registrasi <strong>{verifyTarget.namaPerusahaan}</strong>.</>}
                            </p>
                            <div className="form-group">
                                <label className="form-label">Keterangan (opsional)</label>
                                <textarea className="form-input" rows={3} placeholder="Tambahkan catatan..." value={verifyKeterangan} onChange={e => setVerifyKeterangan(e.target.value)} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setVerifyTarget(null)}>Batal</button>
                            <button className="btn btn-primary" style={verifyStatus === 'Ditolak' ? { background: 'var(--accent-red)' } : {}} onClick={handleVerify}>
                                {verifyStatus === 'Diverifikasi' ? 'Verifikasi' : 'Tolak'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL DELETE ===== */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Hapus Perusahaan</div>
                            <button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center' }}>
                            <AlertTriangle size={48} style={{ color: 'var(--accent-red)', marginBottom: 16 }} />
                            <p>Anda yakin ingin menghapus <strong>{deleteTarget.namaPerusahaan}</strong>? Akun login terkait juga akan dihapus.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Batal</button>
                            <button className="btn btn-primary" style={{ background: 'var(--accent-red)' }} onClick={handleDelete}>Hapus</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManajemenPenyedia;
