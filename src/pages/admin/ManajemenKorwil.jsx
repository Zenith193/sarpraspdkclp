import { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, X, Save, AlertTriangle, Map, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { KECAMATAN, JENJANG } from '../../utils/constants';
import { useSekolahData, useKorwilData, useUsersData } from '../../data/dataProvider';
import { korwilApi } from '../../api/index';
import toast from 'react-hot-toast';
import SearchableSelect from '../../components/ui/SearchableSelect';

const ManajemenKorwil = () => {
    // ===== STATE DATA =====
    const [assignedKorwils, setAssignedKorwils] = useState([]);
    const { data: sekolahList } = useSekolahData();
    const { data: usersList } = useUsersData();
    const { data: korwilList, loading: korwilLoading, refetch: refetchKorwil } = useKorwilData();

    // Group korwil API data by userId (API returns one row per kecamatan)
    useEffect(() => {
        if (korwilList && Array.isArray(korwilList)) {
            const grouped = {};
            korwilList.forEach(row => {
                const ka = row.korwilAssignment || row;
                const uid = ka.userId;
                if (!grouped[uid]) {
                    grouped[uid] = {
                        userId: uid,
                        namaAkun: row.userName || ka.namaAkun || '',
                        email: row.userEmail || ka.email || '',
                        jenjang: ka.jenjang || 'SD',
                        kecamatan: []
                    };
                }
                if (ka.kecamatan && !grouped[uid].kecamatan.includes(ka.kecamatan)) {
                    grouped[uid].kecamatan.push(ka.kecamatan);
                }
            });
            setAssignedKorwils(Object.values(grouped));
        }
    }, [korwilList]);

    // ===== STATE PAGINASI =====
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // ===== UI STATE =====
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // ===== FORM STATE =====
    const [formData, setFormData] = useState({
        userId: '',
        jenjang: JENJANG[0],
        kecamatan: []
    });

    // ===== HELPER =====
    const availableUsers = useMemo(() => {
        return usersList.filter(u => {
            if ((u.role || '').toLowerCase() !== 'korwil') return false;
            if (editItem && String(editItem.userId) === String(u.id)) return true;
            return !assignedKorwils.some(ak => String(ak.userId) === String(u.id));
        });
    }, [usersList, assignedKorwils, editItem]);

    const getSchoolCount = (kecamatanList, jenjang) => {
        if (!kecamatanList || kecamatanList.length === 0) return 0;
        return sekolahList.filter(s =>
            kecamatanList.includes(s.kecamatan) && s.jenjang === jenjang
        ).length;
    };

    // ===== FILTERING & PAGINATION LOGIC =====
    const filtered = useMemo(() => {
        return assignedKorwils.filter(d => {
            if (search) {
                const q = search.toLowerCase();
                return d.namaAkun.toLowerCase().includes(q) ||
                    d.email.toLowerCase().includes(q) ||
                    d.kecamatan.some(k => k.toLowerCase().includes(q));
            }
            return true;
        });
    }, [assignedKorwils, search]);

    const totalPages = Math.ceil(filtered.length / pageSize) || 1;

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        return filtered.slice(start, end);
    }, [filtered, currentPage, pageSize]);

    // Reset halaman saat search atau pageSize berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [search, pageSize]);

    // ===== HANDLERS =====
    const resetForm = () => {
        setFormData({ userId: '', jenjang: JENJANG[0], kecamatan: [] });
        setEditItem(null);
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditItem(item);
            setFormData({
                userId: item.userId,
                jenjang: item.jenjang,
                kecamatan: item.kecamatan
            });
        } else {
            resetForm();
        }
        setShowModal(true);
    };

    const handleUserSelect = (userId) => {
        setFormData(prev => ({ ...prev, userId: userId }));
    };

    const handleSave = async () => {
        if (!formData.userId) { toast.error('Pilih akun pengguna terlebih dahulu'); return; }
        if (formData.kecamatan.length === 0) { toast.error('Pilih minimal satu wilayah kecamatan'); return; }

        try {
            const payload = {
                userId: String(formData.userId),
                kecamatanList: formData.kecamatan,
                jenjang: formData.jenjang
            };
            if (editItem) {
                await korwilApi.update(formData.userId, payload);
                toast.success('Assignment wilayah berhasil diperbarui');
            } else {
                await korwilApi.assign(payload);
                toast.success('Wilayah berhasil ditambahkan ke akun Korwil');
            }
            await refetchKorwil();
        } catch (err) {
            toast.error(err?.message || 'Gagal menyimpan assignment');
        }
        setShowModal(false);
        resetForm();
    };

    const executeDelete = async () => {
        if (deleteTarget) {
            try {
                await korwilApi.delete(deleteTarget.userId);
                toast.success('Data wilayah Korwil berhasil dihapus');
                await refetchKorwil();
            } catch (err) {
                toast.error(err?.message || 'Gagal menghapus assignment');
            }
            setDeleteTarget(null);
        }
    };

    const handleKecamatanChange = (kec) => {
        setFormData(prev => {
            const isSelected = prev.kecamatan.includes(kec);
            return {
                ...prev,
                kecamatan: isSelected
                    ? prev.kecamatan.filter(k => k !== kec)
                    : [...prev.kecamatan, kec]
            };
        });
    };

    const renderUserOption = (userId) => {
        const u = usersList.find(u => String(u.id) === String(userId));
        if (!u) return null;
        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%' }}>
                <span style={{ fontWeight: 500 }}>{u.name || u.namaAkun}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{u.email}</span>
            </div>
        );
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Manajemen Korwil</h1>
                    <p>Assign wilayah ke akun Koordinator Wilayah</p>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                        <Plus size={16} /> Tambah Assignment
                    </button>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input
                                placeholder="Cari nama akun atau wilayah..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        {/* Select Snippet untuk Pembatas Data */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                            >
                                <option value="10">10</option>
                                <option value="15">15</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Nama Akun</th>
                                <th>Email</th>
                                <th>Jenjang</th>
                                <th>Wilayah Kecamatan</th>
                                <th>Jumlah Sekolah</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Menggunakan paginatedData */}
                            {paginatedData.map((d, i) => (
                                <tr key={d.userId}>
                                    <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <User size={16} style={{ color: 'var(--text-secondary)' }} />
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{d.namaAkun}</span>
                                        </div>
                                    </td>
                                    <td>{d.email}</td>
                                    <td><span className="badge badge-baik">{d.jenjang}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 300 }}>
                                            {d.kecamatan.length > 0 ? d.kecamatan.map(k => (
                                                <span key={k} className="badge badge-disetujui">{k}</span>
                                            )) : (
                                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Belum ada wilayah</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                            <Map size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span style={{ fontWeight: 600 }}>{getSchoolCount(d.kecamatan, d.jenjang)}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" onClick={() => handleOpenModal(d)} title="Edit Wilayah">
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => setDeleteTarget(d)}
                                                title="Hapus Assignment"
                                                style={{ color: 'var(--accent-red)' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {paginatedData.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                        Belum ada akun Korwil yang di-assign wilayahnya
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Paginasi */}
                <div className="table-pagination">
                    <div className="table-pagination-info">
                        Menampilkan {filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} data
                    </div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem' }}>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ===== ADD/EDIT MODAL ===== */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{editItem ? 'Edit Wilayah Korwil' : 'Assign Wilayah ke Akun'}</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            {editItem ? (
                                <div className="form-group">
                                    <label className="form-label">Akun Korwil</label>
                                    <input
                                        className="form-input"
                                        value={`${editItem.namaAkun} (${editItem.email})`}
                                        disabled
                                        style={{ background: 'var(--bg-secondary)', fontWeight: 500 }}
                                    />
                                </div>
                            ) : (
                                <div className="form-group">
                                    <label className="form-label">Pilih Akun Pengguna (Role Korwil)</label>
                                    <SearchableSelect
                                        options={availableUsers.map(u => u.id.toString())}
                                        value={formData.userId.toString()}
                                        onChange={handleUserSelect}
                                        placeholder="-- Pilih Akun yang Belum Punya Wilayah --"
                                        renderOption={renderUserOption}
                                    />
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        *Data akun diambil dari Manajemen Pengguna
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Jenjang Tanggung Jawab</label>
                                <select
                                    className="form-select"
                                    value={formData.jenjang}
                                    onChange={e => setFormData({ ...formData, jenjang: e.target.value })}
                                >
                                    {JENJANG.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Wilayah Kecamatan *</label>
                                <div style={{
                                    border: '1px solid var(--border-input)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 12,
                                    maxHeight: 200,
                                    overflowY: 'auto',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: 8,
                                    background: 'var(--bg-secondary)'
                                }}>
                                    {KECAMATAN.map(kec => (
                                        <label key={kec} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, padding: '4px 0' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.kecamatan.includes(kec)}
                                                onChange={() => handleKecamatanChange(kec)}
                                                style={{ accentColor: 'var(--accent-blue)', width: 14, height: 14 }}
                                            />
                                            {kec}
                                        </label>
                                    ))}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                                    Terpilih: {formData.kecamatan.length} kecamatan
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!editItem && !formData.userId}>
                                <Save size={14} /> Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DELETE CONFIRMATION MODAL ===== */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: 'var(--accent-red)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                <AlertTriangle size={32} strokeWidth={1.5} />
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                                Hapus Assignment Wilayah?
                            </h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
                                Data wilayah untuk <strong>"{deleteTarget.namaAkun}"</strong> akan dihapus.<br />
                                Akun pengguna tetap ada, namun tidak akan memiliki wilayah tugas.
                            </p>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} style={{ minWidth: 100 }}>Batal</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={executeDelete}
                                    style={{ minWidth: 100, background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                                >
                                    <Trash2 size={14} /> Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManajemenKorwil;