import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Search, Download, Upload, Edit, Trash2, Save, X, FileText, AlertTriangle, Code, Copy, CheckCheck, Info, ChevronLeft, ChevronRight, MoreHorizontal, Eye } from 'lucide-react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';
import { templateApi } from '../../api/index';
import { useApi } from '../../api/hooks';

// ===== DATA PANDUAN VARIABEL (per Kategori) =====
const GUIDE_DATA = {
    "Identitas Paket": [
        { variable: "{{noMatrik}}", description: "Nomor matrik kegiatan" },
        { variable: "{{namaPaket}}", description: "Nama paket pekerjaan" },
        { variable: "{{namaSekolah}}", description: "Nama sekolah" },
        { variable: "{{namaSekolahUpper}}", description: "Nama sekolah (HURUF BESAR)" },
        { variable: "{{npsn}}", description: "NPSN sekolah" },
        { variable: "{{sumberDana}}", description: "Sumber dana (APBD/DAK/dll)" },
        { variable: "{{tahunAnggaran}}", description: "Tahun anggaran" },
        { variable: "{{tahunTerbilang}}", description: "Tahun terbilang (huruf)" },
        { variable: "{{jenisPengadaan}}", description: "Jenis pengadaan" },
        { variable: "{{metode}}", description: "Metode pengadaan" },
        { variable: "{{noSubKegiatan}}", description: "Nomor sub kegiatan" },
        { variable: "{{subKegiatan}}", description: "Nama sub kegiatan" },
        { variable: "{{kodeLampiran}}", description: "Kode lampiran / kode sirup" },
    ],
    "Keuangan": [
        { variable: "{{nilaiKontrak}}", description: "Nilai kontrak (Rp format)" },
        { variable: "{{nilaiKontrakRaw}}", description: "Nilai kontrak (angka mentah)" },
        { variable: "{{terbilangKontrak}}", description: "Terbilang nilai kontrak" },
        { variable: "{{paguAnggaran}}", description: "Pagu anggaran (Rp format)" },
        { variable: "{{paguAnggaranRaw}}", description: "Pagu anggaran (angka)" },
        { variable: "{{terbilangPaguAnggaran}}", description: "Terbilang pagu anggaran" },
        { variable: "{{paguPaket}}", description: "Pagu paket (Rp format)" },
        { variable: "{{hps}}", description: "HPS (Rp format)" },
        { variable: "{{hpsRaw}}", description: "HPS (angka)" },
        { variable: "{{terbilangHps}}", description: "Terbilang HPS" },
    ],
    "Penyedia": [
        { variable: "{{penyedia}}", description: "Nama perusahaan penyedia" },
        { variable: "{{namaPemilik}}", description: "Nama pemilik/direktur" },
        { variable: "{{statusPemilik}}", description: "Status pemilik (Direktur/dll)" },
        { variable: "{{alamatKantor}}", description: "Alamat kantor penyedia" },
        { variable: "{{noHp}}", description: "No HP / telepon penyedia" },
        { variable: "{{noAkta}}", description: "Nomor akta perusahaan" },
        { variable: "{{tanggalAkta}}", description: "Tanggal akta" },
        { variable: "{{namaNotaris}}", description: "Nama notaris" },
        { variable: "{{bank}}", description: "Bank penyedia" },
        { variable: "{{noRekening}}", description: "Nomor rekening penyedia" },
        { variable: "{{namaRekening}}", description: "Nama rekening penyedia" },
        { variable: "{{emailPerusahaan}}", description: "Email perusahaan penyedia" },
    ],
    "SPK & Kontrak": [
        { variable: "{{noSpk}}", description: "Nomor SPK" },
        { variable: "{{jangkaWaktu}}", description: "Jangka waktu (hari angka)" },
        { variable: "{{jangkaWaktuText}}", description: "Jangka waktu (teks: X Hari Kalender)" },
        { variable: "{{terbilangJangkaWaktu}}", description: "Jangka waktu terbilang (huruf)" },
        { variable: "{{noDppl}}", description: "Nomor DPPL" },
        { variable: "{{tanggalDppl}}", description: "Tanggal DPPL" },
        { variable: "{{noBahpl}}", description: "Nomor BAHPL" },
        { variable: "{{tanggalBahpl}}", description: "Tanggal BAHPL" },
    ],
    "SPMK": [
        { variable: "{{noSpmk}}", description: "Nomor SPMK" },
        { variable: "{{tanggalSpmk}}", description: "Tanggal SPMK (DD Bulan YYYY)" },
        { variable: "{{hariTanggalSpmk}}", description: "Hari, tanggal bulan tahun SPMK" },
        { variable: "{{terbilangTanggalSpmk}}", description: "Terbilang tanggal SPMK" },
        { variable: "{{hariSpmk}}", description: "Nama hari SPMK" },
        { variable: "{{hariSpmkLower}}", description: "Nama hari SPMK (huruf kecil)" },
        { variable: "{{tglSpmkTerbilang}}", description: "Tanggal SPMK terbilang" },
        { variable: "{{bulanSpmk}}", description: "Nama bulan SPMK" },
        { variable: "{{tahunSpmkTerbilang}}", description: "Tahun SPMK terbilang" },
        { variable: "{{tanggalSpmkDash}}", description: "Tanggal SPMK (DD-MM-YYYY)" },
        { variable: "{{idPaket}}", description: "ID Paket" },
        { variable: "{{hariTanggalSpk}}", description: "Hari, tanggal SPK" },
        { variable: "{{terbilangTanggalSpk}}", description: "Terbilang tanggal SPK" },
    ],
    "Tgl Mulai/Selesai": [
        { variable: "{{tanggalMulai}}", description: "Tanggal mulai (DD Bulan YYYY)" },
        { variable: "{{hariTanggalMulai}}", description: "Hari, tanggal mulai lengkap" },
        { variable: "{{terbilangTanggalMulai}}", description: "Terbilang tanggal mulai" },
        { variable: "{{hariMulai}}", description: "Nama hari mulai" },
        { variable: "{{hariMulaiLower}}", description: "Nama hari mulai (huruf kecil)" },
        { variable: "{{tglMulaiTerbilang}}", description: "Tanggal mulai terbilang" },
        { variable: "{{bulanMulai}}", description: "Nama bulan mulai" },
        { variable: "{{tahunMulaiTerbilang}}", description: "Tahun mulai terbilang" },
        { variable: "{{tanggalMulaiDash}}", description: "Tanggal mulai (DD-MM-YYYY)" },
        { variable: "{{tanggalSelesai}}", description: "Tanggal selesai (DD Bulan YYYY)" },
        { variable: "{{hariTanggalSelesai}}", description: "Hari, tanggal selesai lengkap" },
        { variable: "{{terbilangTanggalSelesai}}", description: "Terbilang tanggal selesai" },
        { variable: "{{hariSelesai}}", description: "Nama hari selesai" },
        { variable: "{{hariSelesaiLower}}", description: "Nama hari selesai (huruf kecil)" },
        { variable: "{{tglSelesaiTerbilang}}", description: "Tanggal selesai terbilang" },
        { variable: "{{bulanSelesai}}", description: "Nama bulan selesai" },
        { variable: "{{tahunSelesaiTerbilang}}", description: "Tahun selesai terbilang" },
        { variable: "{{tanggalSelesaiDash}}", description: "Tanggal selesai (DD-MM-YYYY)" },
    ],
    "PCM & MC": [
        { variable: "{{noPcm}}", description: "Nomor PCM" },
        { variable: "{{tglPcm}}", description: "Tanggal PCM" },
        { variable: "{{hariTanggalPcm}}", description: "Hari, tanggal PCM lengkap" },
        { variable: "{{terbilangTanggalPcm}}", description: "Terbilang tanggal PCM" },
        { variable: "{{hariPcm}}", description: "Nama hari PCM" },
        { variable: "{{hariPcmLower}}", description: "Nama hari PCM (huruf kecil)" },
        { variable: "{{tglPcmTerbilang}}", description: "Tanggal PCM terbilang" },
        { variable: "{{bulanPcm}}", description: "Nama bulan PCM" },
        { variable: "{{tahunPcmTerbilang}}", description: "Tahun PCM terbilang" },
        { variable: "{{tglPcmDash}}", description: "Tanggal PCM (DD-MM-YYYY)" },
        { variable: "{{noMc0}}", description: "Nomor MC-0%" },
        { variable: "{{tglMc0}}", description: "Tanggal MC-0%" },
        { variable: "{{hariTanggalMc0}}", description: "Hari, tanggal MC-0% lengkap" },
        { variable: "{{terbilangTanggalMc0}}", description: "Terbilang tanggal MC-0%" },
        { variable: "{{hariMc0}}", description: "Nama hari MC-0%" },
        { variable: "{{hariMc0Lower}}", description: "Nama hari MC-0% (huruf kecil)" },
        { variable: "{{tglMc0Terbilang}}", description: "Tanggal MC-0% terbilang" },
        { variable: "{{bulanMc0}}", description: "Nama bulan MC-0%" },
        { variable: "{{tahunMc0Terbilang}}", description: "Tahun MC-0% terbilang" },
        { variable: "{{tglMc0Dash}}", description: "Tanggal MC-0% (DD-MM-YYYY)" },
        { variable: "{{noMc100}}", description: "Nomor MC-100%" },
        { variable: "{{tglMc100}}", description: "Tanggal MC-100%" },
        { variable: "{{hariTanggalMc100}}", description: "Hari, tanggal MC-100% lengkap" },
        { variable: "{{terbilangTanggalMc100}}", description: "Terbilang tanggal MC-100%" },
        { variable: "{{hariMc100}}", description: "Nama hari MC-100%" },
        { variable: "{{hariMc100Lower}}", description: "Nama hari MC-100% (huruf kecil)" },
        { variable: "{{tglMc100Terbilang}}", description: "Tanggal MC-100% terbilang" },
        { variable: "{{bulanMc100}}", description: "Nama bulan MC-100%" },
        { variable: "{{tahunMc100Terbilang}}", description: "Tahun MC-100% terbilang" },
        { variable: "{{tglMc100Dash}}", description: "Tanggal MC-100% (DD-MM-YYYY)" },
    ],
    "Pejabat & Satker": [
        { variable: "{{kepsek}}", description: "Nama Kepala Sekolah" },
        { variable: "{{nipKs}}", description: "NIP Kepala Sekolah" },
        { variable: "{{sekretaris}}", description: "Nama Sekretaris" },
        { variable: "{{nipSekretaris}}", description: "NIP Sekretaris" },
        { variable: "{{ppkom}}", description: "Nama PPKom" },
        { variable: "{{nipPpkom}}", description: "NIP PPKom" },
        { variable: "{{jabatanPpkom}}", description: "Jabatan PPKom" },
        { variable: "{{alamatPpkom}}", description: "Alamat PPKom" },
        { variable: "{{pangkatPpkom}}", description: "Pangkat PPKom" },
        { variable: "{{telpPpkom}}", description: "Telepon PPKom" },
        { variable: "{{emailPpkom}}", description: "Email PPKom" },
        { variable: "{{nipSatker}}", description: "NIP Pimpinan Satuan Kerja" },
        { variable: "{{namaSatker}}", description: "Nama Pimpinan Satuan Kerja" },
        { variable: "{{jabatanSatker}}", description: "Jabatan Pimpinan Satker" },
        { variable: "{{websiteSatker}}", description: "Website Satuan Kerja" },
        { variable: "{{emailSatker}}", description: "Email Satuan Kerja" },
        { variable: "{{teleponSatker}}", description: "Telepon Satuan Kerja" },
        { variable: "{{klpdSatker}}", description: "KLPD Satuan Kerja" },
        { variable: "{{ketuaTimTeknis}}", description: "Nama Ketua Tim Teknis" },
        { variable: "{{nipKetuaTimTeknis}}", description: "NIP Ketua Tim Teknis" },
        { variable: "{{konsultanPengawas}}", description: "Konsultan Pengawas" },
        { variable: "{{dirKonsultanPengawas}}", description: "Direktur Konsultan Pengawas" },
        { variable: "{{dasarHukum}}", description: "Dasar hukum (teks)" },
    ],
    "BAST": [
        { variable: "{{noBAST}}", description: "Nomor BAST otomatis (400.3.13/...)" },
        { variable: "{{volume}}", description: "Volume pekerjaan" },
        { variable: "{{nilaiBAST}}", description: "Nilai BAST (Rp format)" },
        { variable: "{{nilaiBastRaw}}", description: "Nilai BAST (angka)" },
        { variable: "{{terbilangBAST}}", description: "Terbilang nilai BAST" },
    ],
    "Sekolah & Kop": [
        { variable: "{{kopSekolah}}", description: "Path kop sekolah" },
        { variable: "{{kopSekolahAda}}", description: "Status kop: Ada / Belum" },
    ],
    "Anakan (1-15)": [
        { variable: "{{jumlahAnakan}}", description: "Jumlah anakan (angka)" },
        { variable: "{{anakan1NoBAST}}", description: "Nomor BAST anakan ke-1" },
        { variable: "{{anakan1NamaSekolah}}", description: "Nama Sekolah anakan ke-1" },
        { variable: "{{anakan1Kepsek}}", description: "Kepala Sekolah anakan ke-1" },
        { variable: "{{anakan1NipKs}}", description: "NIP KS anakan ke-1" },
        { variable: "{{anakan1NamaPaket}}", description: "Nama Paket anakan ke-1" },
        { variable: "{{anakan1Volume}}", description: "Volume anakan ke-1" },
        { variable: "{{anakan1NilaiBAST}}", description: "Nilai BAST anakan ke-1 (Rp)" },
        { variable: "{{anakan1NilaiBastRaw}}", description: "Nilai BAST anakan ke-1 (angka)" },
        { variable: "{{anakan1TerbilangBAST}}", description: "Terbilang anakan ke-1" },
        { variable: "{{anakan1KopSekolah}}", description: "Kop Sekolah anakan ke-1" },
        { variable: "{{anakan1Kecamatan}}", description: "Kecamatan anakan ke-1" },
    ],
    "Rincian Kontrak (Anakan)": [
        { variable: "{{jumlahRincian}}", description: "Jumlah rincian paket (angka)" },
        { variable: "{{adaRincian}}", description: "'Ya' jika paket punya anakan" },
        { variable: "{{lingkupPekerjaan}}", description: "Daftar pekerjaan bernomor (baris baru)" },
        { variable: "{{totalRincian}}", description: "Total rincian (Rp. format)" },
        { variable: "{{totalRincianRaw}}", description: "Total nilai rincian (angka)" },
        { variable: "{{terbilangTotalRincian}}", description: "Terbilang total rincian" },
        { variable: "{{#rincianKontrak}}", description: "⬇ Loop tabel rincian kontrak (baris per anakan)" },
        { variable: "{{no}}", description: "Nomor urut (dalam loop)" },
        { variable: "{{rincianNama}}", description: "Nama paket anakan (dalam loop)" },
        { variable: "{{rincianNilai}}", description: "Nilai anakan format angka (dalam loop)" },
        { variable: "{{rincianNilaiRaw}}", description: "Nilai anakan angka mentah (dalam loop)" },
        { variable: "{{/rincianKontrak}}", description: "⬆ Akhir loop tabel rincian" },
    ],
};


const ManajemenTemplate = () => {
    const { data: apiData, loading, refetch } = useApi(() => templateApi.list(), []);
    const [templates, setTemplates] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const raw = apiData?.data || (Array.isArray(apiData) ? apiData : []);
        // Normalize DB field names → frontend field names
        setTemplates(raw.map(t => ({
            ...t,
            name: t.name || t.nama || '',
            type: t.type || t.jenisCocok || '',
            lastUpdated: t.lastUpdated || t.updatedAt || t.createdAt || null,
        })));
    }, [apiData]);

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

    // Action dropdown state
    const [openActionId, setOpenActionId] = useState(null);
    const [actionPos, setActionPos] = useState({ top: 0, left: 0 });
    const actionDropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target) && !e.target.closest('.btn-icon')) {
                setOpenActionId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // State Modal Panduan
    const [showGuide, setShowGuide] = useState(false);
    const [activeGuideTab, setActiveGuideTab] = useState("Identitas Paket");
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
        setFormData({
            name: item.name || item.nama || '',
            type: item.type || item.jenisCocok || '',
            existingFileName: item.filePath ? (item.filePath.split('/').pop() || item.filePath.split('\\').pop() || '') : '',
        });
        setFormFile(null);
        setEditId(item.id);
        setModalType('edit');
        setShowModal(true);
    };

    const handleActionClick = (e, id) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setActionPos({ top: rect.bottom + 4, left: rect.right - 170 });
        setOpenActionId(openActionId === id ? null : id);
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
                                            <button className="btn-icon" onClick={(e) => handleActionClick(e, t.id)} title="Aksi"><MoreHorizontal size={16} /></button>
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

            {/* ===== FIXED-POSITION ACTION DROPDOWN ===== */}
            {openActionId && (() => {
                const item = pagedData.find(t => t.id === openActionId);
                if (!item) return null;
                return ReactDOM.createPortal(
                    <div ref={actionDropdownRef} className="dropdown-menu" style={{ position: 'fixed', top: actionPos.top, left: actionPos.left, minWidth: 170, padding: 4, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                        {item.filePath && (
                            <a href={`/api/template/download/${item.id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--accent-green)', borderRadius: 6, textDecoration: 'none' }} className="dropdown-item" onClick={() => setOpenActionId(null)}>
                                <Eye size={14} /> Preview / Download
                            </a>
                        )}
                        <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)', borderRadius: 6 }} className="dropdown-item" onClick={() => { openEditModal(item); setOpenActionId(null); }}>
                            <Edit size={14} /> Edit
                        </button>
                        <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--accent-red)', borderRadius: 6 }} className="dropdown-item" onClick={() => { setDeleteTarget(item); setOpenActionId(null); }}>
                            <Trash2 size={14} /> Hapus
                        </button>
                    </div>,
                    document.body
                );
            })()}

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
                                    ) : modalType === 'edit' && formData.existingFileName ? (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                                                <FileText size={20} style={{ color: 'var(--accent-green)' }} />
                                                <span style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--accent-green)' }}>{formData.existingFileName}</span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Klik untuk mengganti file</div>
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
                            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
                            <button type="button" className="btn btn-primary" style={{ cursor: 'pointer' }} onClick={handleSave}><Save size={14} /> Simpan</button>
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
                                    Gunakan format <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent-blue)' }}>{'{{variabel}}'}</code> di file DOCX template. Klik variabel untuk menyalin.
                                </p>
                            </div>

                            <div style={{ borderBottom: '1px solid var(--border-color)', padding: '0 1.5rem', display: 'flex', gap: '0.25rem', background: 'var(--bg-primary)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                                {Object.keys(GUIDE_DATA).map((key) => (
                                    <button
                                        key={key}
                                        onClick={() => setActiveGuideTab(key)}
                                        style={{
                                            padding: '0.6rem 0.5rem',
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: activeGuideTab === key ? '2px solid var(--accent-blue)' : '2px solid transparent',
                                            fontWeight: 600,
                                            fontSize: '0.78rem',
                                            color: activeGuideTab === key ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            flexShrink: 0,
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