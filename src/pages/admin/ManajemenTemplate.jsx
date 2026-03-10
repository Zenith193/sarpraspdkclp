import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Download, Upload, Edit, Trash2, Save, X, FileText, AlertTriangle, Code, Copy, CheckCheck, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { templateApi } from '../../api/index';
import { useApi } from '../../api/hooks';

// ===== DATA PANDUAN VARIABEL (per Menu) =====
const GUIDE_DATA = {
    "Data Sekolah": [
        { variable: "${NAMA_SEKOLAH}", description: "Nama sekolah" },
        { variable: "${NPSN}", description: "Nomor Pokok Sekolah Nasional" },
        { variable: "${JENJANG}", description: "Jenjang sekolah (SD/SMP)" },
        { variable: "${KECAMATAN}", description: "Kecamatan sekolah" },
        { variable: "${STATUS_SEKOLAH}", description: "Status sekolah (Negeri/Swasta)" },
        { variable: "${ALAMAT_SEKOLAH}", description: "Alamat lengkap sekolah" },
        { variable: "${KEPALA_SEKOLAH}", description: "Nama Kepala Sekolah" },
        { variable: "${NIP_KEPSEK}", description: "NIP Kepala Sekolah" },
        { variable: "${NO_REK_SEKOLAH}", description: "Nomor rekening sekolah" },
        { variable: "${NAMA_BANK_SEKOLAH}", description: "Nama bank sekolah" },
        { variable: "${ROMBEL}", description: "Jumlah rombongan belajar" },
    ],
    "Data Sarpras": [
        { variable: "${NAMA_RUANG}", description: "Nama ruang/prasarana" },
        { variable: "${JENIS_PRASARANA}", description: "Jenis prasarana" },
        { variable: "${MASA_BANGUNAN}", description: "Masa/tahun bangunan" },
        { variable: "${LANTAI}", description: "Lantai bangunan" },
        { variable: "${PANJANG}", description: "Panjang ruang (meter)" },
        { variable: "${LEBAR}", description: "Lebar ruang (meter)" },
        { variable: "${LUAS}", description: "Luas ruang (m²)" },
        { variable: "${KONDISI}", description: "Kondisi ruang (Baik/Rusak Ringan/Sedang/Berat)" },
        { variable: "${KETERANGAN_SARPRAS}", description: "Keterangan sarpras" },
    ],
    "Proposal": [
        { variable: "${SUB_KEGIATAN}", description: "Nama sub kegiatan" },
        { variable: "${NILAI_PENGAJUAN}", description: "Nilai pengajuan (format angka)" },
        { variable: "${TARGET_PROPOSAL}", description: "Target proposal" },
        { variable: "${NO_AGENDA_SURAT}", description: "Nomor agenda surat" },
        { variable: "${TANGGAL_SURAT}", description: "Tanggal surat" },
        { variable: "${STATUS_USULAN}", description: "Status usulan" },
        { variable: "${KERANJANG}", description: "Keranjang proposal (Sekolah/Korwil/dll)" },
        { variable: "${RANKING}", description: "Ranking/prioritas proposal" },
        { variable: "${STATUS_PROPOSAL}", description: "Status verifikasi proposal" },
    ],
    "Matrik Kegiatan": [
        { variable: "${NO_MATRIK}", description: "Nomor matrik kegiatan" },
        { variable: "${SUB_BIDANG}", description: "Sub bidang kegiatan" },
        { variable: "${NO_SUB_KEGIATAN}", description: "Nomor sub kegiatan" },
        { variable: "${SUB_KEGIATAN_MATRIK}", description: "Nama sub kegiatan" },
        { variable: "${RUP}", description: "Rencana Umum Pengadaan" },
        { variable: "${NAMA_PAKET}", description: "Nama paket pekerjaan" },
        { variable: "${PAGU_ANGGARAN}", description: "Pagu anggaran (format angka)" },
        { variable: "${PAGU_PAKET}", description: "Pagu paket (format angka)" },
        { variable: "${HPS}", description: "Harga Perkiraan Sendiri" },
        { variable: "${SUMBER_DANA}", description: "Sumber dana" },
        { variable: "${METODE}", description: "Metode pengadaan" },
        { variable: "${JENIS_PENGADAAN}", description: "Jenis pengadaan" },
        { variable: "${HONOR}", description: "Honor pelaksana" },
        { variable: "${TAHUN_ANGGARAN}", description: "Tahun anggaran" },
        { variable: "${JANGKA_WAKTU}", description: "Jangka waktu pelaksanaan (hari)" },
    ],
    "Kontrak & SPK": [
        { variable: "${NO_SPK}", description: "Nomor SPK/kontrak" },
        { variable: "${NILAI_KONTRAK}", description: "Nilai kontrak (format angka)" },
        { variable: "${NILAI_KONTRAK_HURUF}", description: "Nilai kontrak (terbilang)" },
        { variable: "${TANGGAL_MULAI}", description: "Tanggal mulai pekerjaan" },
        { variable: "${TANGGAL_SELESAI}", description: "Tanggal selesai pekerjaan" },
        { variable: "${MASA_PELAKSANAAN}", description: "Masa pelaksanaan (hari)" },
    ],
    "Penyedia": [
        { variable: "${NAMA_PENYEDIA}", description: "Nama perusahaan penyedia" },
        { variable: "${NAMA_PEMILIK}", description: "Nama pemilik/direktur penyedia" },
        { variable: "${STATUS_PEMILIK}", description: "Status pemilik (Direktur/CV/dll)" },
        { variable: "${ALAMAT_KANTOR}", description: "Alamat kantor penyedia" },
        { variable: "${NPWP_PENYEDIA}", description: "NPWP penyedia" },
        { variable: "${NO_REKENING_PENYEDIA}", description: "Nomor rekening penyedia" },
        { variable: "${BANK_PENYEDIA}", description: "Nama bank penyedia" },
    ],
    "Pencairan": [
        { variable: "${PENCAIRAN_PERSEN}", description: "Persentase pencairan (%)" },
        { variable: "${STATUS_PENCAIRAN}", description: "Status pencairan (Belum Masuk/Masuk/Keuangan/Clear)" },
        { variable: "${NO_REGISTER}", description: "Nomor register pencairan" },
        { variable: "${NO_SP2D}", description: "Nomor SP2D" },
        { variable: "${HARI_KALENDER}", description: "Hari kalender pencairan" },
    ],
    "BAST": [
        { variable: "${NO_BAST}", description: "Nomor BAST" },
        { variable: "${TANGGAL_BAST}", description: "Tanggal BAST" },
        { variable: "${NAMA_PAKET_BAST}", description: "Nama paket pekerjaan BAST" },
        { variable: "${NILAI_KONTRAK_BAST}", description: "Nilai kontrak BAST (format angka)" },
        { variable: "${PENYEDIA_BAST}", description: "Nama penyedia BAST" },
    ],
    "Prestasi": [
        { variable: "${JENIS_PRESTASI}", description: "Jenis prestasi" },
        { variable: "${NAMA_SISWA}", description: "Nama siswa berprestasi" },
        { variable: "${KATEGORI_PRESTASI}", description: "Kategori (Perorangan/Beregu)" },
        { variable: "${TINGKAT_PRESTASI}", description: "Tingkat (Kecamatan/Kabupaten/Provinsi/Nasional)" },
        { variable: "${TAHUN_PRESTASI}", description: "Tahun prestasi" },
        { variable: "${CAPAIAN}", description: "Capaian (Juara 1/2/3, dll)" },
    ],
    "Umum": [
        { variable: "${TANGGAL_HARI_INI}", description: "Tanggal hari ini (format Indonesia)" },
        { variable: "${BULAN}", description: "Nama bulan saat ini" },
        { variable: "${TAHUN}", description: "Tahun saat ini" },
        { variable: "${NOMOR_SURAT}", description: "Nomor surat" },
        { variable: "${PERIHAL}", description: "Perihal surat" },
        { variable: "${KETERANGAN}", description: "Keterangan tambahan" },
    ],
};

const ManajemenTemplate = () => {
    const { data: apiData, loading, refetch } = useApi(() => templateApi.list(), []);
    const [templates, setTemplates] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => { if (apiData?.data) setTemplates(apiData.data); else if (Array.isArray(apiData)) setTemplates(apiData); }, [apiData]);

    // ===== STATE PAGINASI =====
    const [perPage, setPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // State Modal Form
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('add');
    const [formData, setFormData] = useState({ name: '', type: 'BAST' });
    const [formFile, setFormFile] = useState(null);
    const [editId, setEditId] = useState(null);

    // State Modal Hapus
    const [deleteTarget, setDeleteTarget] = useState(null);

    // State Modal Panduan
    const [showGuide, setShowGuide] = useState(false);
    const [activeGuideTab, setActiveGuideTab] = useState("Data Sekolah");
    const [copiedId, setCopiedId] = useState(null);

    // Filter Data
    const filteredData = useMemo(() => {
        return templates.filter(t =>
            (t.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.type || '').toLowerCase().includes(search.toLowerCase())
        );
    }, [templates, search]);

    // ===== LOGIC PAGINASI =====
    const totalPages = Math.ceil(filteredData.length / perPage) || 1;

    const pagedData = useMemo(() => {
        const start = (currentPage - 1) * perPage;
        const end = start + perPage;
        return filteredData.slice(start, end);
    }, [filteredData, currentPage, perPage]);

    // Reset halaman ke 1 jika filter berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [search, perPage]);

    // ===== HANDLERS =====
    const openAddModal = () => {
        setFormData({ name: '', type: 'BAST' });
        setFormFile(null);
        setModalType('add');
        setShowModal(true);
    };

    const openEditModal = (item) => {
        setFormData({ name: item.name, type: item.type });
        setFormFile(null);
        setEditId(item.id);
        setModalType('edit');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name) { toast.error("Nama template wajib diisi"); return; }
        if (modalType === 'add' && !formFile) { toast.error("File template wajib dipilih"); return; }
        try {
            const fd = new FormData();
            fd.append('name', formData.name);
            fd.append('type', formData.type);
            if (formFile) fd.append('file', formFile);
            if (modalType === 'add') {
                await templateApi.create(fd);
                toast.success("Template berhasil ditambahkan");
            } else {
                await templateApi.update(editId, fd);
                toast.success("Template berhasil diperbarui");
            }
            setShowModal(false);
            setFormFile(null);
            refetch();
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan template');
        }
    };

    const executeDelete = async () => {
        if (deleteTarget) {
            try {
                await templateApi.delete(deleteTarget.id);
                toast.success("Template berhasil dihapus");
                setDeleteTarget(null);
                refetch();
            } catch (err) {
                toast.error(err.message || 'Gagal menghapus template');
            }
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(dateString));
    };

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success("Kode disalin!");
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Manajemen Template</h1>
                    <p>Kelola template dokumen sistem</p>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={16} /> Tambah Template
                    </button>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari template..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        {/* Select Snippet untuk Pembatas Data */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select
                                value={perPage}
                                onChange={(e) => setPerPage(Number(e.target.value))}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                            >
                                <option value="10">10</option>
                                <option value="15">15</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowGuide(true)}>
                            <Code size={14} /> Panduan Variabel
                        </button>
                        <button className="btn btn-secondary btn-sm">
                            <Download size={14} /> Ekspor
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 50 }}>No</th>
                                <th>Nama Template</th>
                                <th style={{ width: 150 }}>Jenis</th>
                                <th style={{ width: 200 }}>Terakhir Diubah</th>
                                <th style={{ width: 100 }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Menggunakan pagedData */}
                            {pagedData.length > 0 ? (
                                pagedData.map((t, i) => (
                                    <tr key={t.id}>
                                        <td>{(currentPage - 1) * perPage + i + 1}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <FileText size={16} style={{ color: 'var(--text-secondary)' }} />
                                                <span style={{ fontWeight: 500 }}>{t.name}</span>
                                            </div>
                                        </td>
                                        <td><span className="badge badge-baik">{t.type}</span></td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{formatDate(t.lastUpdated)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                {t.filePath && (
                                                    <a href={`/api${t.filePath}`} target="_blank" rel="noopener noreferrer" className="btn-icon" title="Download" style={{ color: 'var(--accent-green)' }}><Download size={16} /></a>
                                                )}
                                                <button className="btn-icon" onClick={() => openEditModal(t)} title="Edit"><Edit size={16} /></button>
                                                <button className="btn-icon" onClick={() => setDeleteTarget(t)} style={{ color: 'var(--accent-red)' }} title="Hapus"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Tidak ada data</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Paginasi */}
                <div className="table-pagination">
                    <div className="table-pagination-info">
                        Menampilkan {filteredData.length > 0 ? (currentPage - 1) * perPage + 1 : 0}-{Math.min(currentPage * perPage, filteredData.length)} dari {filteredData.length} data
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

            {/* ===== MODAL FORM (Tambah/Edit) ===== */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{modalType === 'add' ? 'Tambah Template Baru' : 'Edit Template'}</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nama Template *</label>
                                <input className="form-input" placeholder="Contoh: Kontrak APBD 2026" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Jenis Dokumen</label>
                                <select className="form-select" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                    <option value="BAST">BAST</option>
                                    <option value="Kontrak">Kontrak</option>
                                    <option value="Surat">Surat</option>
                                    <option value="Checklist">Checklist</option>
                                    <option value="Lainnya">Lainnya</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">File Template (PDF/DOCX) {modalType === 'add' ? '*' : ''}</label>
                                <div style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-input)', transition: 'border-color 150ms' }}
                                    onClick={() => document.getElementById('template-file-input').click()}
                                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                                    onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                                    onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-color)'; const f = e.dataTransfer.files[0]; if (f) setFormFile(f); }}
                                >
                                    <input id="template-file-input" type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) setFormFile(e.target.files[0]); }} />
                                    {formFile ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            <FileText size={20} style={{ color: 'var(--accent-blue)' }} />
                                            <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{formFile.name}</span>
                                            <button className="btn-icon" onClick={e => { e.stopPropagation(); setFormFile(null); }} style={{ color: 'var(--accent-red)' }}><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <div>
                                            <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: 8 }} />
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Klik atau drag file ke sini</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>PDF, DOCX (Maks. 10MB)</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL HAPUS ===== */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <AlertTriangle size={32} />
                            </div>
                            <h3 style={{ marginBottom: 8 }}>Hapus Template?</h3>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Template <strong>"{deleteTarget.name}"</strong> akan dihapus permanen.</p>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Batal</button>
                                <button className="btn btn-primary" onClick={executeDelete} style={{ background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}>Hapus</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL PANDUAN VARIABEL ===== */}
            {showGuide && (
                <div className="modal-overlay" onClick={() => setShowGuide(false)}>
                    <div className="modal" style={{ maxWidth: '800px', background: 'var(--bg-secondary)' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <div className="modal-title">Panduan Penggunaan Template</div>
                            <button className="modal-close" onClick={() => setShowGuide(false)}><X size={18} /></button>
                        </div>

                        <div className="modal-body" style={{ padding: 0 }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Informasi Umum</h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    Gunakan kode format <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent-blue)' }}>{` ${"`${VARIABLE_NAME}`"} `}</code> untuk menandai bagian yang akan diganti otomatis oleh sistem.
                                </p>
                            </div>

                            <div style={{ borderBottom: '1px solid var(--border-color)', padding: '0 1.5rem', display: 'flex', gap: '0.5rem', background: 'var(--bg-primary)' }}>
                                {Object.keys(GUIDE_DATA).map((key) => (
                                    <button
                                        key={key}
                                        onClick={() => setActiveGuideTab(key)}
                                        style={{
                                            padding: '0.75rem 0',
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: activeGuideTab === key ? '2px solid var(--accent-blue)' : '2px solid transparent',
                                            fontWeight: 600,
                                            fontSize: '0.875rem',
                                            color: activeGuideTab === key ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            marginRight: '1rem'
                                        }}
                                    >
                                        {key}
                                    </button>
                                ))}
                            </div>

                            <div style={{ padding: '1.5rem' }}>
                                <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Code size={16} /> Variables {activeGuideTab}
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    {GUIDE_DATA[activeGuideTab].map((item, idx) => (
                                        <div key={idx}
                                            style={{ padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'border-color 150ms' }}
                                            onClick={() => handleCopy(item.variable, `${activeGuideTab}-${idx}`)}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <code style={{ color: 'var(--accent-blue)', fontSize: '0.85rem', fontWeight: 600 }}>{item.variable}</code>
                                                {copiedId === `${activeGuideTab}-${idx}` ? <CheckCheck size={14} style={{ color: 'var(--accent-green)' }} /> : <Copy size={14} style={{ color: 'var(--text-secondary)' }} />}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManajemenTemplate;