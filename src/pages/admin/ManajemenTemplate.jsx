import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Download, Edit, Trash2, Save, X, FileText, AlertTriangle, Code, Copy, CheckCheck, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

// Data Mocking Template
const INITIAL_DATA = [
    { id: 1, name: 'Template BAST Umum', type: 'BAST', lastUpdated: '2025-06-15T10:00:00' },
    { id: 2, name: 'Checklist Verifikasi Renovasi', type: 'Checklist', lastUpdated: '2025-06-10T14:30:00' },
    { id: 3, name: 'Template Surat Penawaran', type: 'Surat', lastUpdated: '2025-05-20T09:15:00' },
    { id: 4, name: 'Template Kontrak Kerja', type: 'Kontrak', lastUpdated: '2025-05-18T08:00:00' },
    { id: 5, name: 'Template Berita Acara', type: 'Berita Acara', lastUpdated: '2025-05-10T11:00:00' },
];

// ===== DATA PANDUAN VARIABEL =====
const GUIDE_DATA = {
    "Paket Pekerjaan": [
        { variable: "${KODE_PAKET}", description: "Kode Paket Pekerjaan", example: "PKT-2025-001" },
        { variable: "${PEKERZAAN_JUDUL}", description: "Judul Pekerjaan + Nama Sekolah", example: "Renovasi Ruang Kelas SD 1" },
        { variable: "${NILAI_PAGU_PAKET}", description: "Nilai Pagu (Format Angka)", example: "150000000" },
        { variable: "${PAGU_ANGGARAN}", description: "Nilai Pagu (Format Rupiah)", example: "Rp 150.000.000" },
    ],
    "Kontrak": [
        { variable: "${NO_KONTRAK}", description: "Nomor Kontrak", example: "021/SPK/VI/2025" },
        { variable: "${NAMA_PENYEDIA}", description: "Nama Perusahaan Penyedia", example: "PT Maju Jaya" },
    ],
    "Data Sekolah": [
        { variable: "${NAMA_SEKOLAH}", description: "Nama Sekolah", example: "SD Negeri 1 Nama Sekolah" },
        { variable: "${NPSN}", description: "Nomor Pokok Sekolah Nasional", example: "12345678" },
    ]
};

const ManajemenTemplate = () => {
    const [templates, setTemplates] = useState(INITIAL_DATA);
    const [search, setSearch] = useState('');
    
    // ===== STATE PAGINASI =====
    const [perPage, setPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // State Modal Form
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('add');
    const [formData, setFormData] = useState({ name: '', type: 'BAST' });
    const [editId, setEditId] = useState(null);

    // State Modal Hapus
    const [deleteTarget, setDeleteTarget] = useState(null);

    // State Modal Panduan
    const [showGuide, setShowGuide] = useState(false);
    const [activeGuideTab, setActiveGuideTab] = useState("Paket Pekerjaan");
    const [copiedId, setCopiedId] = useState(null);

    // Filter Data
    const filteredData = useMemo(() => {
        return templates.filter(t => 
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.type.toLowerCase().includes(search.toLowerCase())
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
        setModalType('add');
        setShowModal(true);
    };

    const openEditModal = (item) => {
        setFormData({ name: item.name, type: item.type });
        setEditId(item.id);
        setModalType('edit');
        setShowModal(true);
    };

    const handleSave = () => {
        if (!formData.name) { toast.error("Nama template wajib diisi"); return; }
        if (modalType === 'add') {
            setTemplates(prev => [{ id: Date.now(), ...formData, lastUpdated: new Date().toISOString() }, ...prev]);
            toast.success("Template berhasil ditambahkan");
        } else {
            setTemplates(prev => prev.map(t => t.id === editId ? { ...t, ...formData, lastUpdated: new Date().toISOString() } : t));
            toast.success("Template berhasil diperbarui");
        }
        setShowModal(false);
    };

    const executeDelete = () => {
        if (deleteTarget) {
            setTemplates(prev => prev.filter(t => t.id !== deleteTarget.id));
            toast.success("Template berhasil dihapus");
            setDeleteTarget(null);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
                                <label className="form-label">Nama Template</label>
                                <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Jenis Dokumen</label>
                                <select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                    <option value="BAST">BAST</option>
                                    <option value="Checklist">Checklist</option>
                                    <option value="Surat">Surat</option>
                                    <option value="Contract">Kontrak</option>
                                </select>
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
                                <table className="data-table" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-secondary)' }}>
                                            <th style={{ width: '30%' }}>Kode</th>
                                            <th style={{ width: '35%' }}>Deskripsi</th>
                                            <th style={{ width: '35%' }}>Contoh Hasil</th>
                                            <th style={{ width: 80, textAlign: 'center' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {GUIDE_DATA[activeGuideTab].map((item, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <span style={{ 
                                                        background: 'var(--bg-secondary)', 
                                                        padding: '4px 8px', 
                                                        borderRadius: '4px', 
                                                        fontFamily: 'monospace', 
                                                        fontSize: '0.85rem', 
                                                        color: 'var(--accent-blue)',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        {item.variable}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.875rem' }}>{item.description}</td>
                                                <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.example}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button 
                                                        onClick={() => handleCopy(item.variable, `${activeGuideTab}-${idx}`)}
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ padding: '4px 8px' }}
                                                    >
                                                        {copiedId === `${activeGuideTab}-${idx}` ? <CheckCheck size={14} /> : <Copy size={14} />}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManajemenTemplate;