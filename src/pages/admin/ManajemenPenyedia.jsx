import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, CheckCircle, XCircle, Clock, Trash2, Eye, X, ChevronLeft, ChevronRight, AlertTriangle, Pencil, Save, Building2, Briefcase, MoreVertical, Key, EyeOff, ShieldCheck, ShieldX } from 'lucide-react';
import toast from 'react-hot-toast';
import { perusahaanApi, penggunaApi, referensiApi } from '../../api/index';

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
    const [activeMenu, setActiveMenu] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const [passwordModal, setPasswordModal] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [pwSaving, setPwSaving] = useState(false);
    const menuRef = useRef(null);
    const perPage = 20;

    // Reference data states
    const [dasarHukumData, setDasarHukumData] = useState([]);
    const [satuanKerjaData, setSatuanKerjaData] = useState([]);
    const [ppkomData, setPpkomData] = useState([]);
    const [dhForm, setDhForm] = useState({ tahun: new Date().getFullYear(), isi: '' });
    const [skForm, setSkForm] = useState({ nip: '', namaPimpinan: '', jabatan: '', website: '', email: '', telepon: '', klpd: '' });
    const [ppkForm, setPpkForm] = useState({ nip: '', nama: '', pangkat: '', jabatan: '', alamat: '', noTelp: '', email: '' });
    const [dhEdit, setDhEdit] = useState(null);
    const [skEdit, setSkEdit] = useState(null);
    const [ppkEdit, setPpkEdit] = useState(null);
    const [dhSearch, setDhSearch] = useState('');
    const [skSearch, setSkSearch] = useState('');
    const [ppkSearch, setPpkSearch] = useState('');
    const [mainTab, setMainTab] = useState('akun-penyedia');

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await perusahaanApi.list();
            setData(result);
        } catch (err) {
            toast.error('Gagal memuat data');
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); fetchRef(); }, []);

    const fetchRef = async () => {
        try { setDasarHukumData(await referensiApi.listDasarHukum()); } catch {}
        try { setSatuanKerjaData(await referensiApi.listSatuanKerja()); } catch {}
        try { setPpkomData(await referensiApi.listPpkom()); } catch {}
    };

    // Close dropdown menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setActiveMenu(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

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
            toast.success(`Perusahaan ${verifyStatus === 'Diverifikasi' ? 'diverifikasi' : verifyStatus === 'Ditolak' ? 'ditolak' : 'status diubah ke Menunggu'}`);
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

    const handleChangePassword = async () => {
        if (!passwordModal || !newPassword) return;
        if (newPassword.length < 6) { toast.error('Password minimal 6 karakter'); return; }
        setPwSaving(true);
        try {
            await penggunaApi.changePassword(passwordModal.userId, newPassword);
            toast.success('Password berhasil diubah');
            setPasswordModal(null); setNewPassword(''); setShowPw(false);
        } catch (err) {
            toast.error(err?.message || 'Gagal mengubah password');
        } finally { setPwSaving(false); }
    };

    // ===== EDIT HANDLERS =====
    const openEdit = (item) => {
        setEditItem(item);
        setActiveMenu(null);
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

    // Form row helper
    const formRow = (children, cols = 2) => (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14, marginBottom: 14 }}>
            {children}
        </div>
    );

    const formField = (label, field, opts = {}) => (
        <div className="form-group" style={{ marginBottom: 0, ...(opts.style || {}) }}>
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

    // Dropdown action menu
    const ActionMenu = ({ item }) => {
        const isOpen = activeMenu === item.id;
        return (
            <div style={{ position: 'relative' }} ref={isOpen ? menuRef : null}>
                <button className="btn-icon" title="Aksi" onClick={(e) => {
                    e.stopPropagation();
                    if (isOpen) {
                        setActiveMenu(null);
                    } else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const menuHeight = 300;
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const flipUp = spaceBelow < menuHeight;
                        setMenuPos({
                            top: flipUp ? undefined : rect.bottom + 4,
                            bottom: flipUp ? (window.innerHeight - rect.top + 4) : undefined,
                            right: window.innerWidth - rect.right
                        });
                        setActiveMenu(item.id);
                    }
                }}
                    style={{ color: isOpen ? 'var(--accent-blue)' : undefined }}>
                    <MoreVertical size={16} />
                </button>
                {isOpen && (
                    <div style={{
                        position: 'fixed',
                        ...(menuPos.top !== undefined ? { top: menuPos.top } : {}),
                        ...(menuPos.bottom !== undefined ? { bottom: menuPos.bottom } : {}),
                        right: menuPos.right, zIndex: 9999,
                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                        minWidth: 190, overflow: 'hidden', animation: 'fadeIn 150ms ease'
                    }}>
                        {/* Lihat Detail */}
                        <button onClick={() => { setDetailItem(item); setActiveMenu(null); }}
                            style={menuItemStyle}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Eye size={14} style={{ color: 'var(--text-secondary)' }} /> Lihat Detail
                        </button>
                        {/* Edit */}
                        <button onClick={() => openEdit(item)}
                            style={menuItemStyle}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Pencil size={14} style={{ color: 'var(--accent-blue)' }} /> Edit Data
                        </button>
                        {/* Ganti Password */}
                        {item.userId && (
                            <button onClick={() => { setPasswordModal(item); setActiveMenu(null); }}
                                style={menuItemStyle}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <Key size={14} style={{ color: 'var(--accent-yellow)' }} /> Ganti Password
                            </button>
                        )}
                        {/* Divider */}
                        <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
                        {/* Verifikasi */}
                        {item.status !== 'Diverifikasi' && (
                            <button onClick={() => { setVerifyTarget(item); setVerifyStatus('Diverifikasi'); setActiveMenu(null); }}
                                style={menuItemStyle}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <ShieldCheck size={14} style={{ color: 'var(--accent-green)' }} /> Verifikasi
                            </button>
                        )}
                        {/* Unverifikasi (set back to Menunggu) */}
                        {item.status === 'Diverifikasi' && (
                            <button onClick={() => { setVerifyTarget(item); setVerifyStatus('Menunggu'); setActiveMenu(null); }}
                                style={menuItemStyle}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <ShieldX size={14} style={{ color: 'var(--accent-orange, #f97316)' }} /> Unverifikasi
                            </button>
                        )}
                        {/* Tolak */}
                        {item.status !== 'Ditolak' && (
                            <button onClick={() => { setVerifyTarget(item); setVerifyStatus('Ditolak'); setActiveMenu(null); }}
                                style={menuItemStyle}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <XCircle size={14} style={{ color: 'var(--accent-red)' }} /> Tolak
                            </button>
                        )}
                        {/* Divider */}
                        <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
                        {/* Hapus */}
                        <button onClick={() => { setDeleteTarget(item); setActiveMenu(null); }}
                            style={{ ...menuItemStyle, color: 'var(--accent-red)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Trash2 size={14} /> Hapus
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const menuItemStyle = {
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px', fontSize: '0.82rem', color: 'var(--text-primary)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        transition: 'background 0.15s', textAlign: 'left',
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Manajemen Penyedia</h1>
                    <p className="page-subtitle">Kelola data perusahaan penyedia (PT/CV)</p>
                </div>
            </div>

            {/* ===== MAIN TABS ===== */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border-color)' }}>
                {[{ key: 'akun-penyedia', label: 'Akun Penyedia' }, { key: 'dasar-hukum', label: 'Dasar Hukum' }, { key: 'satuan-kerja', label: 'Satuan Kerja' }, { key: 'ppkom', label: 'PPKOM' }].map(tab => (
                    <button key={tab.key} onClick={() => setMainTab(tab.key)} style={{
                        padding: '10px 24px', background: mainTab === tab.key ? 'var(--accent-blue)' : 'none',
                        border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                        color: mainTab === tab.key ? '#fff' : 'var(--text-secondary)',
                        borderRadius: mainTab === tab.key ? '8px 8px 0 0' : 0,
                        marginBottom: -2, transition: 'all 0.2s'
                    }}>{tab.label}</button>
                ))}
            </div>

            {/* ===== TAB: AKUN PENYEDIA ===== */}
            {mainTab === 'akun-penyedia' && (<>
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
                <div className="table-search" style={{ flex: 1, minWidth: 200 }}>
                    <Search size={16} className="search-icon" />
                    <input placeholder="Cari perusahaan, NPWP, email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
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
                            <th style={{ width: 100 }}>Tipe</th>
                            <th>NPWP</th>
                            <th>Pemilik</th>
                            <th>Email</th>
                            <th style={{ width: 110 }}>Status</th>
                            <th style={{ width: 60, textAlign: 'center' }}>Aksi</th>
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
                                <td style={{ textAlign: 'center', overflow: 'visible', position: 'relative' }}>
                                    <ActionMenu item={p} />
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
            </>)}

            {/* ===== TAB: DASAR HUKUM ===== */}
            {mainTab === 'dasar-hukum' && (
                <div style={{ paddingTop: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="table-search" style={{ maxWidth: 220 }}><Search size={14} className="search-icon" /><input placeholder="Search" value={dhSearch} onChange={e => setDhSearch(e.target.value)} /></div>
                        <button className="btn btn-primary btn-sm" onClick={() => setDhEdit({ tahun: new Date().getFullYear(), isi: '', _new: true })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>＋ Tambah Data</button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ minWidth: 700 }}>
                            <thead><tr><th style={{ width: 50 }}></th><th style={{ width: 60 }}>AKSI</th><th style={{ width: 80 }}>TAHUN</th><th>DASAR HUKUM</th></tr></thead>
                            <tbody>
                                {dasarHukumData.filter(r => !dhSearch || r.isi?.toLowerCase().includes(dhSearch.toLowerCase()) || String(r.tahun).includes(dhSearch)).map(r => (
                                    <tr key={r.id}><td style={{ textAlign: 'center' }}><input type="checkbox" /></td>
                                        <td><div style={{ display: 'flex', gap: 4 }}><button title="Edit" onClick={() => setDhEdit({ ...r })} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer' }}><Pencil size={13} /></button><button title="Hapus" onClick={async () => { if (!confirm('Hapus?')) return; await referensiApi.deleteDasarHukum(r.id); fetchRef(); toast.success('Dihapus'); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer' }}><Trash2 size={13} /></button></div></td>
                                        <td>{r.tahun}</td><td style={{ whiteSpace: 'normal' }}>{r.isi}</td>
                                    </tr>
                                ))}
                                {dasarHukumData.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>Belum ada data</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', marginTop: 6 }}>Showing {dasarHukumData.length} results</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 6, background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6 }}>Variabel Template: <code>{'{dasarHukum}'}</code></div>
                </div>
            )}

            {/* ===== TAB: SATUAN KERJA ===== */}
            {mainTab === 'satuan-kerja' && (
                <div style={{ paddingTop: 0, maxWidth: '100%', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="table-search" style={{ maxWidth: 220 }}><Search size={14} className="search-icon" /><input placeholder="Search" value={skSearch} onChange={e => setSkSearch(e.target.value)} /></div>
                        <button className="btn btn-primary btn-sm" onClick={() => setSkEdit({ nip: '', namaPimpinan: '', jabatan: '', website: '', email: '', telepon: '', klpd: '', _new: true })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>＋ Tambah Data</button>
                    </div>
                    <div className="table-container" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                        <table className="data-table" style={{ minWidth: 1200, width: '100%' }}>
                            <thead><tr><th style={{ width: 40 }}></th><th style={{ width: 55 }}>AKSI</th><th style={{ width: 170 }}>NIP</th><th>NAMA PIMPINAN</th><th>JABATAN</th><th>WEBSITE</th><th>EMAIL</th><th style={{ width: 120 }}>TELEPON</th><th>KLPD</th></tr></thead>
                            <tbody>
                                {satuanKerjaData.filter(r => !skSearch || [r.nip, r.namaPimpinan, r.email].some(f => f?.toLowerCase().includes(skSearch.toLowerCase()))).map(r => (
                                    <tr key={r.id}><td style={{ textAlign: 'center' }}><input type="checkbox" /></td>
                                        <td><div style={{ display: 'flex', gap: 4 }}><button title="Edit" onClick={() => setSkEdit({ ...r })} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer' }}><Pencil size={13} /></button><button title="Hapus" onClick={async () => { if (!confirm('Hapus?')) return; await referensiApi.deleteSatuanKerja(r.id); fetchRef(); toast.success('Dihapus'); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer' }}><Trash2 size={13} /></button></div></td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r.nip}</td><td style={{ whiteSpace: 'nowrap' }}>{r.namaPimpinan}</td><td style={{ whiteSpace: 'nowrap' }}>{r.jabatan}</td><td style={{ whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.website}</td><td style={{ whiteSpace: 'nowrap' }}>{r.email}</td><td style={{ whiteSpace: 'nowrap' }}>{r.telepon}</td><td style={{ whiteSpace: 'nowrap' }}>{r.klpd}</td>
                                    </tr>
                                ))}
                                {satuanKerjaData.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>Belum ada data</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', marginTop: 6 }}>Showing {satuanKerjaData.length} results</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 6, background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6 }}>Variabel: <code>{'{nipSatker}'}</code> <code>{'{namaSatker}'}</code> <code>{'{jabatanSatker}'}</code> <code>{'{websiteSatker}'}</code> <code>{'{emailSatker}'}</code> <code>{'{teleponSatker}'}</code> <code>{'{klpdSatker}'}</code></div>
                </div>
            )}

            {/* ===== TAB: PPKOM ===== */}
            {mainTab === 'ppkom' && (
                <div style={{ paddingTop: 0, maxWidth: '100%', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="table-search" style={{ maxWidth: 220 }}><Search size={14} className="search-icon" /><input placeholder="Search" value={ppkSearch} onChange={e => setPpkSearch(e.target.value)} /></div>
                        <button className="btn btn-primary btn-sm" onClick={() => setPpkEdit({ nip: '', nama: '', pangkat: '', jabatan: '', alamat: '', noTelp: '', email: '', _new: true })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>＋ Tambah Data</button>
                    </div>
                    <div className="table-container" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                        <table className="data-table" style={{ minWidth: 1200, width: '100%' }}>
                            <thead><tr><th style={{ width: 40 }}></th><th style={{ width: 55 }}>AKSI</th><th style={{ width: 170 }}>NIP</th><th>NAMA</th><th>PANGKAT</th><th>JABATAN</th><th>ALAMAT</th><th style={{ width: 120 }}>NO TELP</th><th>EMAIL</th></tr></thead>
                            <tbody>
                                {ppkomData.filter(r => !ppkSearch || [r.nip, r.nama, r.email].some(f => f?.toLowerCase().includes(ppkSearch.toLowerCase()))).map(r => (
                                    <tr key={r.id}><td style={{ textAlign: 'center' }}><input type="checkbox" /></td>
                                        <td><div style={{ display: 'flex', gap: 4 }}><button title="Edit" onClick={() => setPpkEdit({ ...r })} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer' }}><Pencil size={13} /></button><button title="Hapus" onClick={async () => { if (!confirm('Hapus?')) return; await referensiApi.deletePpkom(r.id); fetchRef(); toast.success('Dihapus'); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer' }}><Trash2 size={13} /></button></div></td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r.nip}</td><td style={{ whiteSpace: 'nowrap' }}>{r.nama}</td><td style={{ whiteSpace: 'nowrap' }}>{r.pangkat}</td><td style={{ whiteSpace: 'nowrap' }}>{r.jabatan}</td><td style={{ whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.alamat}</td><td style={{ whiteSpace: 'nowrap' }}>{r.noTelp}</td><td style={{ whiteSpace: 'nowrap' }}>{r.email}</td>
                                    </tr>
                                ))}
                                {ppkomData.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>Belum ada data</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', marginTop: 6 }}>Showing {ppkomData.length} results</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 6, background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6 }}>Variabel: <code>{'{ppkom}'}</code> <code>{'{nipPpkom}'}</code> <code>{'{jabatanPpkom}'}</code> <code>{'{alamatPpkom}'}</code> <code>{'{pangkatPpkom}'}</code> <code>{'{telpPpkom}'}</code> <code>{'{emailPpkom}'}</code></div>
                </div>
            )}

            {/* ===== MODAL DETAIL ===== */}
            {detailItem && (
                <div className="modal-overlay" onClick={() => setDetailItem(null)}>
                    <div className="modal" style={{ maxWidth: 640, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ flexShrink: 0 }}>
                            <div className="modal-title">Detail Perusahaan</div>
                            <button className="modal-close" onClick={() => setDetailItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
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
                        <div className="modal-footer" style={{ flexWrap: 'wrap', flexShrink: 0 }}>
                            <button className="btn btn-ghost" onClick={() => setDetailItem(null)}>Tutup</button>
                            {detailItem.userId && (
                                <button className="btn btn-secondary" onClick={() => { setPasswordModal(detailItem); setDetailItem(null); }}>
                                    <Key size={14} /> Ganti Password
                                </button>
                            )}
                            <button className="btn btn-secondary" onClick={() => { openEdit(detailItem); setDetailItem(null); }}>
                                <Pencil size={14} /> Edit
                            </button>
                            {detailItem.status === 'Menunggu' && (
                                <>
                                    <button className="btn btn-secondary" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)' }} onClick={() => { setVerifyTarget(detailItem); setVerifyStatus('Ditolak'); setDetailItem(null); }}>Tolak</button>
                                    <button className="btn btn-primary" onClick={() => { setVerifyTarget(detailItem); setVerifyStatus('Diverifikasi'); setDetailItem(null); }}>Verifikasi</button>
                                </>
                            )}
                            {detailItem.status === 'Diverifikasi' && (
                                <button className="btn btn-secondary" style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--accent-orange, #f97316)' }} onClick={() => { setVerifyTarget(detailItem); setVerifyStatus('Menunggu'); setDetailItem(null); }}>Unverifikasi</button>
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

            {/* ===== MODAL GANTI PASSWORD ===== */}
            {passwordModal && (
                <div className="modal-overlay" onClick={() => { setPasswordModal(null); setNewPassword(''); setShowPw(false); }}>
                    <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Ganti Password</div>
                            <button className="modal-close" onClick={() => { setPasswordModal(null); setNewPassword(''); setShowPw(false); }}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: 16, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Perusahaan</div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: 2 }}>{passwordModal.namaPerusahaan}</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password Baru <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                                <div style={{ position: 'relative' }}>
                                    <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Minimal 6 karakter"
                                        value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ paddingRight: 40 }} />
                                    <button type="button" onClick={() => setShowPw(!showPw)} style={{
                                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4
                                    }}>
                                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => { setPasswordModal(null); setNewPassword(''); setShowPw(false); }}>Batal</button>
                            <button className="btn btn-primary" onClick={handleChangePassword} disabled={pwSaving || !newPassword}>
                                <Key size={14} /> {pwSaving ? 'Menyimpan...' : 'Ganti Password'}
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
                            <div className="modal-title">
                                {verifyStatus === 'Diverifikasi' ? '✅ Verifikasi' : verifyStatus === 'Ditolak' ? '❌ Tolak' : '🔄 Unverifikasi'} Perusahaan
                            </div>
                            <button className="modal-close" onClick={() => setVerifyTarget(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: 16 }}>
                                {verifyStatus === 'Diverifikasi'
                                    ? <>Anda akan <strong>memverifikasi</strong> perusahaan <strong>{verifyTarget.namaPerusahaan}</strong>. Akun login perusahaan akan diaktifkan.</>
                                    : verifyStatus === 'Ditolak'
                                    ? <>Anda akan <strong>menolak</strong> registrasi <strong>{verifyTarget.namaPerusahaan}</strong>.</>
                                    : <>Anda akan <strong>membatalkan verifikasi</strong> perusahaan <strong>{verifyTarget.namaPerusahaan}</strong>. Akun login akan dinonaktifkan.</>}
                            </p>
                            <div className="form-group">
                                <label className="form-label">Keterangan (opsional)</label>
                                <textarea className="form-input" rows={3} placeholder="Tambahkan catatan..." value={verifyKeterangan} onChange={e => setVerifyKeterangan(e.target.value)} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setVerifyTarget(null)}>Batal</button>
                            <button className="btn btn-primary" style={
                                verifyStatus === 'Ditolak' ? { background: 'var(--accent-red)' }
                                : verifyStatus === 'Menunggu' ? { background: 'var(--accent-orange, #f97316)' }
                                : {}
                            } onClick={handleVerify}>
                                {verifyStatus === 'Diverifikasi' ? 'Verifikasi' : verifyStatus === 'Ditolak' ? 'Tolak' : 'Unverifikasi'}
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

            {/* ===== MODAL DASAR HUKUM ===== */}
            {dhEdit && (
                <div className="modal-overlay" onClick={() => setDhEdit(null)}><div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header"><div className="modal-title">{dhEdit._new ? 'Tambah' : 'Edit'} Dasar Hukum</div><button className="modal-close" onClick={() => setDhEdit(null)}><X size={18} /></button></div>
                    <div className="modal-body">
                        <div className="form-group"><label className="form-label">Tahun</label><input className="form-input" type="number" value={dhEdit.tahun} onChange={e => setDhEdit({ ...dhEdit, tahun: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Dasar Hukum</label><textarea className="form-input" rows={4} value={dhEdit.isi} onChange={e => setDhEdit({ ...dhEdit, isi: e.target.value })} /></div>
                    </div>
                    <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setDhEdit(null)}>Batal</button><button className="btn btn-primary" onClick={async () => { try { if (dhEdit._new) { await referensiApi.createDasarHukum(dhEdit); } else { await referensiApi.updateDasarHukum(dhEdit.id, dhEdit); } toast.success('Tersimpan'); setDhEdit(null); fetchRef(); } catch { toast.error('Gagal'); } }}>Simpan</button></div>
                </div></div>
            )}

            {/* ===== MODAL SATUAN KERJA ===== */}
            {skEdit && (
                <div className="modal-overlay" onClick={() => setSkEdit(null)}><div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header"><div className="modal-title">{skEdit._new ? 'Tambah' : 'Edit'} Satuan Kerja</div><button className="modal-close" onClick={() => setSkEdit(null)}><X size={18} /></button></div>
                    <div className="modal-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="form-group"><label className="form-label">NIP</label><input className="form-input" value={skEdit.nip} onChange={e => setSkEdit({ ...skEdit, nip: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Nama Pimpinan</label><input className="form-input" value={skEdit.namaPimpinan} onChange={e => setSkEdit({ ...skEdit, namaPimpinan: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Jabatan</label><input className="form-input" value={skEdit.jabatan} onChange={e => setSkEdit({ ...skEdit, jabatan: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Website</label><input className="form-input" value={skEdit.website} onChange={e => setSkEdit({ ...skEdit, website: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={skEdit.email} onChange={e => setSkEdit({ ...skEdit, email: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Telepon</label><input className="form-input" value={skEdit.telepon} onChange={e => setSkEdit({ ...skEdit, telepon: e.target.value })} /></div>
                        </div>
                        <div className="form-group"><label className="form-label">KLPD</label><input className="form-input" value={skEdit.klpd} onChange={e => setSkEdit({ ...skEdit, klpd: e.target.value })} /></div>
                    </div>
                    <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setSkEdit(null)}>Batal</button><button className="btn btn-primary" onClick={async () => { try { if (skEdit._new) { await referensiApi.createSatuanKerja(skEdit); } else { await referensiApi.updateSatuanKerja(skEdit.id, skEdit); } toast.success('Tersimpan'); setSkEdit(null); fetchRef(); } catch { toast.error('Gagal'); } }}>Simpan</button></div>
                </div></div>
            )}

            {/* ===== MODAL PPKOM ===== */}
            {ppkEdit && (
                <div className="modal-overlay" onClick={() => setPpkEdit(null)}><div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header"><div className="modal-title">{ppkEdit._new ? 'Tambah' : 'Edit'} PPKOM</div><button className="modal-close" onClick={() => setPpkEdit(null)}><X size={18} /></button></div>
                    <div className="modal-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="form-group"><label className="form-label">NIP</label><input className="form-input" value={ppkEdit.nip} onChange={e => setPpkEdit({ ...ppkEdit, nip: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Nama</label><input className="form-input" value={ppkEdit.nama} onChange={e => setPpkEdit({ ...ppkEdit, nama: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Pangkat</label><input className="form-input" value={ppkEdit.pangkat} onChange={e => setPpkEdit({ ...ppkEdit, pangkat: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Jabatan</label><input className="form-input" value={ppkEdit.jabatan} onChange={e => setPpkEdit({ ...ppkEdit, jabatan: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Alamat</label><input className="form-input" value={ppkEdit.alamat} onChange={e => setPpkEdit({ ...ppkEdit, alamat: e.target.value })} /></div>
                            <div className="form-group"><label className="form-label">No Telp</label><input className="form-input" value={ppkEdit.noTelp} onChange={e => setPpkEdit({ ...ppkEdit, noTelp: e.target.value })} /></div>
                        </div>
                        <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={ppkEdit.email} onChange={e => setPpkEdit({ ...ppkEdit, email: e.target.value })} /></div>
                    </div>
                    <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setPpkEdit(null)}>Batal</button><button className="btn btn-primary" onClick={async () => { try { if (ppkEdit._new) { await referensiApi.createPpkom(ppkEdit); } else { await referensiApi.updatePpkom(ppkEdit.id, ppkEdit); } toast.success('Tersimpan'); setPpkEdit(null); fetchRef(); } catch { toast.error('Gagal'); } }}>Simpan</button></div>
                </div></div>
            )}
        </div>
    );
};

export default ManajemenPenyedia;
