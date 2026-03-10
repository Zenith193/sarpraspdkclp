import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search, Download, Eye, Edit, Trash2, X, Filter, Star, FileSpreadsheet, FileText, Save, Printer, FileCheck, FilePlus, Archive, AlertOctagon } from 'lucide-react';
import { useProposalData, useSekolahData, useUsersData } from '../../data/dataProvider';
import { proposalApi } from '../../api/index';
import { KECAMATAN, JENJANG, SUB_KEGIATAN, KERANJANG, STATUS_PROPOSAL } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import SearchableSelect from '../../components/ui/SearchableSelect';
import useAuthStore from '../../store/authStore';
import useCountdownGuard from '../../hooks/useCountdownGuard';
import toast from 'react-hot-toast';
import { safeStr } from '../../utils/safeStr';

const INITIAL_FORM_DATA = {
    subKegiatan: SUB_KEGIATAN[0]?.nama || '',
    nilaiPengajuan: '',
    target: '',
    keterangan: '',
    status: 'Menunggu Verifikasi',
    keranjang: '',
    noAgendaSurat: '',
    tanggalSurat: ''
};

const INITIAL_CHECKLIST_ITEMS = [
    { id: 1, indikator: 'Ijin Operasional dan Pendirian dari Instansi', status: '-', keterangan: '' },
    { id: 2, indikator: 'Akta Notaris (berisi AD / ART, Tujuan, Program Kerja Lembaga, dll)', status: '-', keterangan: '' },
    { id: 3, indikator: 'SK Menkumham (bila ada)', status: '-', keterangan: '' },
    { id: 4, indikator: 'NPSN', status: '-', keterangan: '' },
    { id: 5, indikator: 'Profil Sekolah (data lembaga, data pendidik, data siswa, data sarpras, denah sekolah)', status: '-', keterangan: '' },
    { id: 6, indikator: 'Foto Papan Lembaga, Foto Kegiatan KBM, dan foto lahan bagi usulan pembangunan/foto ruang yang rusak bagi usulan rehabilitasi (GPS map Camera)', status: '-', keterangan: '' },
    { id: 7, indikator: 'Surat Keterangan Domisili badan atau lembaga dari kepala desa / lurah yang diketahui Camat', status: '-', keterangan: '' },
    { id: 8, indikator: 'Surat Pernyataan Tidak terjadi konflik kepengurusan yang ditandatangani ketua yayasan', status: '-', keterangan: '' },
    { id: 9, indikator: 'Surat Keterangan / pernyataan penggunaan Tanah (milik yayasan, tanah wakaf disampiri surat tidak keberatan dari ahli waris lain, hak guna pakai / milik desa)', status: '-', keterangan: '' },
    { id: 10, indikator: 'Pernah mendapat bantuan Hibah tahun berapa / berupa apa?', status: '-', keterangan: '' },
    { id: 11, indikator: 'Rencana Anggaran Biaya (RAB)', status: '-', keterangan: '' },
    { id: 12, indikator: 'Nomor Pokok Wajib Pajak (NPWP)', status: '-', keterangan: '' },
    { id: 13, indikator: 'Rekening atas nama sekolah yang masih aktif (bukan rek BOP)', status: '-', keterangan: '' },
    { id: 14, indikator: 'Denah Sekolah', status: '-', keterangan: '' },
];

const INITIAL_REKOMENDASI = {
    namaSekolah: '', kecamatan: '', jenjang: '', subKegiatan: '', perihal: '',
    nilai: '', target: '', noAgenda: '', suratMasuk: '', tanggalSurat: '', nomorSurat: '', kondisi: '', sumber: ''
};

const Proposal = ({ readOnly = false }) => {
    const user = useAuthStore(s => s.user);
    const { guard, isRestricted } = useCountdownGuard();
    const isAdmin = user?.role === 'Admin';
    const canManageKeranjang = user?.role === 'Admin' || user?.role === 'Verifikator';

    const { data: sekolahList } = useSekolahData();
    const { data: usersList } = useUsersData();
    const { data: proposalList, loading: proposalLoading, refetch: refetchProposal } = useProposalData();

    const [data, setData] = useState([]);

    useEffect(() => {
        if (proposalList.length) setData(proposalList.map(d => ({ ...d, bintang: d.bintang || 0 })));
    }, [proposalList]);

    // State untuk Rekomendasi & Checklist
    const [rekomendasiList, setRekomendasiList] = useState([]);
    const [checklistList, setChecklistList] = useState([]);
    const [showDaftarModal, setShowDaftarModal] = useState(false);
    const [daftarTab, setDaftarTab] = useState('rekomendasi');

    const [search, setSearch] = useState('');
    const [headerFilters, setHeaderFilters] = useState({ kecamatan: '', jenjang: '', keranjang: '', bintang: '' });
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const filterPanelRef = useRef(null);

    // Modals
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [viewItem, setViewItem] = useState(null);

    // State untuk Konfirmasi Hapus
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Checklist & Rekomendasi State
    const [showChecklist, setShowChecklist] = useState(false);
    const [checklistForm, setChecklistForm] = useState({
        sekolah: null, alamat: '', jenisUsulan: '', items: INITIAL_CHECKLIST_ITEMS, verifikators: []
    });
    const [showRekomendasi, setShowRekomendasi] = useState(false);
    const [rekomendasiForm, setRekomendasiForm] = useState(INITIAL_REKOMENDASI);

    // Form State
    const [formSekolah, setFormSekolah] = useState('');
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);

    // Effects
    useEffect(() => {
        const handler = (e) => {
            if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) setShowFilterPanel(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Pagination State
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    // ===== FILTERING =====
    const filtered = useMemo(() => {
        return data.filter(p => {
            if (search) {
                const q = search.toLowerCase();
                if (!p.namaSekolah.toLowerCase().includes(q) && !p.npsn.includes(q)) return false;
            }
            if (headerFilters.kecamatan && p.kecamatan !== headerFilters.kecamatan) return false;
            if (headerFilters.jenjang && p.jenjang !== headerFilters.jenjang) return false;
            if (canManageKeranjang && headerFilters.keranjang && p.keranjang !== headerFilters.keranjang) return false;
            if (headerFilters.bintang === 'Ya' && p.bintang !== 1) return false;
            return true;
        });
    }, [data, search, headerFilters, canManageKeranjang]);

    const paged = useMemo(() => {
        return filtered.slice((page - 1) * perPage, page * perPage);
    }, [filtered, page, perPage]);

    const totalPages = Math.ceil(filtered.length / perPage) || 1;

    // ===== HANDLERS =====
    const resetForm = () => { setFormSekolah(''); setFormData(INITIAL_FORM_DATA); setEditItem(null); };

    const handleOpenModal = (item = null) => {
        if (item) {
            if (!guard('edit')) return;
            setEditItem(item); setFormSekolah(item.namaSekolah || '');
            setFormData({ ...INITIAL_FORM_DATA, ...item, nilaiPengajuan: item.nilaiPengajuan || '' });
        } else {
            if (!guard('tambah')) return;
            resetForm();
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        const rawValue = String(formData.nilaiPengajuan).replace(/\./g, '');
        if (!rawValue || parseFloat(rawValue) <= 0) { toast.error('Nilai pengajuan harus lebih dari 0'); return; }
        const payload = { ...formData, nilaiPengajuan: parseFloat(rawValue) };
        try {
            if (editItem) {
                await proposalApi.update(editItem.id, payload);
                toast.success('Proposal berhasil diperbarui');
            } else {
                const sekolah = sekolahList.find(s => s.nama === formSekolah);
                if (!sekolah) { toast.error('Pilih sekolah terlebih dahulu'); return; }
                await proposalApi.create({ ...payload, sekolahId: sekolah.id });
                toast.success('Proposal berhasil ditambahkan');
            }
            await refetchProposal();
            setShowModal(false); resetForm();
        } catch (err) {
            toast.error(err?.message || 'Gagal menyimpan proposal');
        }
    };

    // ===== UPDATED DELETE HANDLER =====
    const performDelete = async () => {
        try {
            await proposalApi.delete(deleteConfirm.id);
            toast.success('Proposal berhasil dihapus');
            setDeleteConfirm(null);
            await refetchProposal();
        } catch (err) {
            toast.error(err?.message || 'Gagal menghapus proposal');
        }
    };

    const handleStar = (id) => {
        if (!isAdmin) return;
        setData(prev => prev.map(d => {
            if (d.id === id) return { ...d, bintang: d.bintang === 1 ? 0 : 1 };
            return d;
        }));
    };

    // Handlers Checklist & Rekomendasi
    const handleOpenChecklist = () => {
        setChecklistForm({
            sekolah: null, alamat: '', jenisUsulan: '',
            items: INITIAL_CHECKLIST_ITEMS.map(i => ({ ...i, id: Date.now() + Math.random() })),
            verifikators: []
        });
        setShowChecklist(true);
    };

    const handleChecklistSchoolChange = (nama) => {
        const sch = sekolahList.find(s => s.nama === nama);
        setChecklistForm(prev => ({ ...prev, sekolah: sch, alamat: sch?.alamat || '' }));
    };

    const handleSaveRekomendasi = () => {
        if (!rekomendasiForm.namaSekolah) { toast.error('Nama sekolah wajib diisi'); return; }
        const newItem = {
            ...rekomendasiForm,
            id: Date.now(),
            createdAt: new Date().toISOString()
        };
        setRekomendasiList(prev => [newItem, ...prev]);
        toast.success('Rekomendasi berhasil disimpan');
        setShowRekomendasi(false);
        setRekomendasiForm(INITIAL_REKOMENDASI);
    };

    const handleSaveChecklist = () => {
        if (!checklistForm.sekolah) { toast.error('Sekolah wajib dipilih'); return; }
        const newItem = {
            ...checklistForm,
            id: Date.now(),
            createdAt: new Date().toISOString()
        };
        setChecklistList(prev => [newItem, ...prev]);
        toast.success('Checklist berhasil disimpan');
        setShowChecklist(false);
    };

    const handlePrintChecklist = () => {
        const sch = checklistForm.sekolah;
        const tahun = new Date().getFullYear();
        const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const now = new Date();
        const tanggal = `${now.getDate()} ${bulanIndo[now.getMonth()]} ${now.getFullYear()}`;
        const rows = checklistForm.items.map((item, i) =>
            `<tr><td style="text-align:center;padding:6px;border:1px solid #000">${i + 1}</td><td style="padding:6px;border:1px solid #000">${item.indikator}</td><td style="text-align:center;padding:6px;border:1px solid #000">${item.status === 'Ada' ? '✓' : ''}</td><td style="text-align:center;padding:6px;border:1px solid #000">${item.status === 'Tidak Ada' ? '✓' : ''}</td><td style="padding:6px;border:1px solid #000">${item.keterangan || ''}</td></tr>`
        ).join('');
        const verSection = checklistForm.verifikators.length > 0
            ? checklistForm.verifikators.map(v =>
                `<div style="text-align:left;margin-top:60px"><div>Cilacap, ${tanggal}</div><div>Verifikator</div><br/><br/><br/><div style="text-decoration:underline;font-weight:bold">${v.nama || '...........................'}</div><div>NIP. ${v.nip || '...........................'}</div></div>`
            ).join('')
            : `<div style="text-align:left;margin-top:60px"><div>Cilacap, ${tanggal}</div><div>Verifikator</div><br/><br/><br/><div style="text-decoration:underline;font-weight:bold">.............................</div><div>NIP. .............................</div></div>`;
        const html = `<!DOCTYPE html><html><head><title>Instrumen Verifikasi Proposal</title><style>@page{size:A4;margin:2cm}body{font-family:'Times New Roman',serif;font-size:12pt;color:#000}table{width:100%;border-collapse:collapse}th{padding:6px;border:1px solid #000;background:#f0f0f0;font-weight:bold}</style></head><body>
        <div style="text-align:center;margin-bottom:24px"><h3 style="margin:0">INSTRUMEN VERIFIKASI PROPOSAL</h3><h3 style="margin:4px 0">PENGAJUAN DANA HIBAH TAHUN ${tahun}</h3></div>
        <div style="margin-bottom:16px"><table style="border:none"><tr><td style="border:none;width:200px">1. Nama Lembaga / Sekolah</td><td style="border:none">: ${sch?.nama || '...........................'}</td></tr><tr><td style="border:none">2. Alamat</td><td style="border:none">: ${sch?.alamat || checklistForm.alamat || '...........................'}</td></tr><tr><td style="border:none">3. Jenis Usulan</td><td style="border:none">: ${checklistForm.jenisUsulan || '...........................'}</td></tr></table></div>
        <table><thead><tr><th rowspan="2" style="width:30px">NO</th><th rowspan="2">INDIATOR / URAIAN</th><th colspan="2">HASIL</th><th rowspan="2">KETERANGAN</th></tr><tr><th style="width:60px">ADA</th><th style="width:60px">TIDAK ADA</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="margin-top:24px"><p><b>Kesimpulan / Catatan :</b></p><p>1. ............................................................................................................</p><p>2. ............................................................................................................</p><p>dst.</p></div>
        <div style="display:flex;justify-content:flex-end;margin-top:20px">${verSection}</div>
        </body></html>`;
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
    };

    const handleOpenRekomendasi = () => { setRekomendasiForm(INITIAL_REKOMENDASI); setShowRekomendasi(true); };
    const handleRekomendasiSchoolChange = (nama) => {
        const sch = sekolahList.find(s => s.nama === nama);
        setRekomendasiForm(prev => ({ ...prev, namaSekolah: nama, kecamatan: sch?.kecamatan || '', jenjang: sch?.jenjang || '' }));
    };
    const handleRekomendasiChange = (field, value) => setRekomendasiForm(prev => ({ ...prev, [field]: value }));

    // ===== HELPERS =====
    const getStatusBadge = (status) => {
        const map = { 'Menunggu Verifikasi': 'badge-menunggu', 'Disetujui': 'badge-disetujui', 'Ditolak': 'badge-ditolak', 'Revisi': 'badge-revisi' };
        return <span className={`badge ${map[status] || ''}`}>{status}</span>;
    };

    const renderPriorityStar = (isStarred, itemId) => (
        <span className={`star ${isStarred ? 'filled' : ''}`}
            style={{ fontSize: 20, cursor: isAdmin ? 'pointer' : 'default', color: isStarred ? 'var(--accent-yellow)' : 'var(--border-color)', transition: 'color 150ms' }}
            onClick={() => handleStar(itemId)}>★</span>
    );

    const schoolNames = useMemo(() => sekolahList.map(s => s.nama), [sekolahList]);
    const renderSchoolOption = (name) => {
        const sch = sekolahList.find(s => s.nama === name);
        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span>{name}</span>
                {sch && <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{sch.npsn}</span>}
            </div>
        );
    };
    const selectedSchoolData = useMemo(() => sekolahList.find(s => s.nama === formSekolah), [formSekolah]);

    const handleExport = (format) => {
        const exportCols = [{ header: 'No', accessor: (_, i) => i + 1 }, { header: 'Nama Sekolah', key: 'namaSekolah' }, { header: 'NPSN', key: 'npsn' }, { header: 'Kecamatan', key: 'kecamatan' }, { header: 'Sub Kegiatan', key: 'subKegiatan' }, { header: 'Nilai', key: 'nilaiPengajuan' }, { header: 'Status', key: 'status' }];
        try { if (format === 'excel') exportToExcel(filtered, exportCols, 'data_proposal'); else if (format === 'csv') exportToCSV(filtered, exportCols, 'data_proposal'); else if (format === 'pdf') exportToPDF(filtered, exportCols, 'data_proposal', 'Data Proposal'); toast.success(`Berhasil ekspor ${format.toUpperCase()}`); }
        catch (err) { toast.error('Gagal ekspor'); }
    };

    const activeFilterCount = Object.values(headerFilters).filter(v => v).length;

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left"><h1>Proposal</h1><p>Total {filtered.length} proposal</p></div>
                <div className="page-header-right">
                    {!readOnly && (<button className="btn btn-primary" onClick={() => handleOpenModal()} disabled={isRestricted('tambah')} style={isRestricted('tambah') ? { opacity: 0.5, cursor: 'not-allowed' } : {}}><Plus size={16} /> Tambah Proposal</button>)}
                </div>
            </div>

            {canManageKeranjang && (
                <div className="keranjang-tabs">
                    <button className={`keranjang-tab ${headerFilters.keranjang === '' ? 'active' : ''}`} onClick={() => { setHeaderFilters(prev => ({ ...prev, keranjang: '' })); setPage(1); }}>Semua</button>
                    {KERANJANG.map(k => (<button key={k} className={`keranjang-tab ${headerFilters.keranjang === k ? 'active' : ''}`} onClick={() => { setHeaderFilters(prev => ({ ...prev, keranjang: k })); setPage(1); }}>{k.replace('Keranjang Usulan ', '')}</button>))}
                </div>
            )}

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search"><Search size={16} className="search-icon" /><input placeholder="Cari nama sekolah, NPSN..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Tampil
                            <select
                                value={perPage}
                                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                            >
                                <option value="10">10</option>
                                <option value="15">15</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                            data
                        </div>

                        <div style={{ position: 'relative' }} ref={filterPanelRef}>
                            <button className={`btn ${activeFilterCount > 0 ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setShowFilterPanel(!showFilterPanel)}><Filter size={14} /> Filter {activeFilterCount > 0 && <span style={{ background: '#fff', color: 'var(--accent-blue)', borderRadius: 'var(--radius-full)', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, marginLeft: 2 }}>{activeFilterCount}</span>}</button>
                            {showFilterPanel && (<div className="dropdown-menu" style={{ left: 0, top: '100%', marginTop: 4, minWidth: 500, padding: 16, zIndex: 50 }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}><div><label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Kecamatan</label><SearchableSelect options={KECAMATAN} value={headerFilters.kecamatan} onChange={v => { setHeaderFilters(prev => ({ ...prev, kecamatan: v })); setPage(1); }} placeholder="Semua" /></div><div><label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Jenjang</label><select className="form-select" value={headerFilters.jenjang} onChange={e => { setHeaderFilters(prev => ({ ...prev, jenjang: e.target.value })); setPage(1); }}><option value="">Semua</option>{JENJANG.map(j => <option key={j} value={j}>{j}</option>)}</select></div>{isAdmin && (<div><label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Prioritas</label><select className="form-select" value={headerFilters.bintang} onChange={e => { setHeaderFilters(prev => ({ ...prev, bintang: e.target.value })); setPage(1); }}><option value="">Semua</option><option value="Ya">Berbintang</option></select></div>)}</div></div>)}
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        {isAdmin && (
                            <>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowDaftarModal(true)}><Archive size={14} /> Daftar Dokumen</button>
                                <button className="btn btn-secondary btn-sm" onClick={handleOpenRekomendasi}><FilePlus size={14} /> Rekomendasi</button>
                                <button className="btn btn-secondary btn-sm" onClick={handleOpenChecklist}><FileCheck size={14} /> Checklist</button>
                            </>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('excel')}><FileSpreadsheet size={14} /> Excel</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}><FileText size={14} /> PDF</button>
                    </div>
                </div>

                {/* Table Content */}
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Nama Sekolah</th>
                                <th>NPSN</th>
                                <th>Kecamatan</th>
                                <th>Sub Kegiatan</th>
                                <th>Nilai Pengajuan</th>
                                <th>Target</th>
                                <th>Status</th>
                                {isAdmin && <th>Prioritas</th>}
                                {canManageKeranjang && <th>Keranjang</th>}
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paged.map((item, i) => (
                                <tr key={item.id}>
                                    <td>{(page - 1) * perPage + i + 1}</td>
                                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{safeStr(item.namaSekolah)}</td>
                                    <td>{safeStr(item.npsn)}</td>
                                    <td>{safeStr(item.kecamatan)}</td>
                                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.subKegiatan}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatCurrency(item.nilaiPengajuan)}</td>
                                    <td>{item.target}</td>
                                    <td>{getStatusBadge(item.status)}</td>
                                    {isAdmin && <td>{renderPriorityStar(item.bintang === 1, item.id)}</td>}
                                    {canManageKeranjang && (
                                        <td>
                                            <span className="badge badge-disetujui" style={{ fontSize: 10 }}>
                                                {item.keranjang?.replace('Keranjang Usulan ', '') || '-'}
                                            </span>
                                        </td>
                                    )}
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" onClick={() => setViewItem(item)} title="Lihat"><Eye size={16} /></button>
                                            {!readOnly && (
                                                <>
                                                    <button className="btn-icon" onClick={() => handleOpenModal(item)} title="Edit"><Edit size={16} /></button>
                                                    {/* Tombol Hapus diubah untuk membuka modal konfirmasi */}
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => {
                                                            if (!guard('hapus')) return;
                                                            setDeleteConfirm(item);
                                                        }}
                                                        title="Hapus"
                                                        style={{ color: 'var(--accent-red)' }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {paged.length === 0 && (
                                <tr>
                                    <td colSpan={isAdmin ? (canManageKeranjang ? 11 : 10) : (canManageKeranjang ? 10 : 9)} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                        Tidak ada data ditemukan
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="table-pagination">
                    <div className="table-pagination-info">Menampilkan {Math.min((page - 1) * perPage + 1, filtered.length)}-{Math.min(page * perPage, filtered.length)} dari {filtered.length}</div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>‹</button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (<button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>))}
                        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>›</button>
                    </div>
                </div>
            </div>

            {/* ===== MODAL PROPOSAL (ADD/EDIT) ===== */}
            {showModal && (
                <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
                    <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">{editItem ? 'Edit Proposal' : 'Tambah Proposal'}</div><button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nama Sekolah *</label>
                                {editItem ? (<input className="form-input" value={formSekolah} disabled style={{ background: 'var(--bg-secondary)' }} />) : (<SearchableSelect options={schoolNames} value={formSekolah} onChange={setFormSekolah} placeholder="-- Pilih Sekolah --" renderOption={renderSchoolOption} />)}
                            </div>
                            {selectedSchoolData && (<div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.06)', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 20, flexWrap: 'wrap' }}><span><b>NPSN:</b> {safeStr(selectedSchoolData.npsn)}</span><span><b>Kecamatan:</b> {safeStr(selectedSchoolData.kecamatan)}</span><span><b>Jenjang:</b> {safeStr(selectedSchoolData.jenjang)}</span></div>)}

                            <div className="form-row">
                                <div className="form-group"><label className="form-label">Sub Kegiatan</label><select className="form-select" value={formData.subKegiatan || ''} onChange={e => setFormData({ ...formData, subKegiatan: e.target.value })}>{SUB_KEGIATAN.filter(s => !selectedSchoolData?.jenjang || s.jenjang === selectedSchoolData.jenjang).map(s => <option key={s.kode} value={s.nama}>{s.nama}</option>)}</select></div>
                                <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={formData.status || ''} onChange={e => setFormData({ ...formData, status: e.target.value })}>{STATUS_PROPOSAL.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                            </div>

                            {canManageKeranjang && (
                                <div className="form-group">
                                    <label className="form-label">Keranjang Usulan</label>
                                    <select className="form-select" value={formData.keranjang || ''} onChange={e => setFormData({ ...formData, keranjang: e.target.value })}>
                                        <option value="">Belum Ditetapkan</option>
                                        {KERANJANG.map(k => <option key={k} value={k}>{k}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="form-row"><div className="form-group"><label className="form-label">Nilai Pengajuan (Rp) *</label><input className="form-input" type="text" inputMode="numeric" value={formData.nilaiPengajuan ? String(formData.nilaiPengajuan).replace(/\./g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) setFormData({ ...formData, nilaiPengajuan: raw }); }} placeholder="Contoh: 50.000.000" /></div><div className="form-group"><label className="form-label">Target</label><input className="form-input" value={formData.target || ''} onChange={e => setFormData({ ...formData, target: e.target.value })} /></div></div>
                            <div className="form-group"><label className="form-label">Keterangan</label><textarea className="form-input" rows={2} value={formData.keterangan || ''} onChange={e => setFormData({ ...formData, keterangan: e.target.value })}></textarea></div>
                            <div className="form-row"><div className="form-group"><label className="form-label">No Agenda Surat</label><input className="form-input" value={formData.noAgendaSurat || ''} onChange={e => setFormData({ ...formData, noAgendaSurat: e.target.value })} /></div><div className="form-group"><label className="form-label">Tanggal Surat</label><input className="form-input" type="date" value={formData.tanggalSurat || ''} onChange={e => setFormData({ ...formData, tanggalSurat: e.target.value })} /></div></div>
                        </div>
                        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>Batal</button><button className="btn btn-primary" onClick={handleSave} disabled={!editItem && !formSekolah}><Save size={14} /> Simpan</button></div>
                    </div>
                </div>
            )}

            {/* ===== MODAL VIEW ===== */}
            {viewItem && (
                <div className="modal-overlay" onClick={() => setViewItem(null)}>
                    <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">Detail Proposal</div><button className="modal-close" onClick={() => setViewItem(null)}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div className="form-row"><div className="form-group"><label className="form-label">Nama Sekolah</label><div style={{ fontWeight: 500 }}>{safeStr(viewItem.namaSekolah)}</div></div><div className="form-group"><label className="form-label">NPSN</label><div>{safeStr(viewItem.npsn)}</div></div></div>
                            <div className="form-row"><div className="form-group"><label className="form-label">Kecamatan</label><div>{safeStr(viewItem.kecamatan)}</div></div><div className="form-group"><label className="form-label">Status</label><div>{getStatusBadge(viewItem.status)}</div></div></div>
                            <div className="form-group"><label className="form-label">Sub Kegiatan</label><div>{viewItem.subKegiatan}</div></div>
                            {canManageKeranjang && (<div className="form-group"><label className="form-label">Keranjang</label><div>{viewItem.keranjang || 'Belum Ditetapkan'}</div></div>)}
                            <div className="form-row"><div className="form-group"><label className="form-label">Nilai Pengajuan</label><div style={{ fontWeight: 600, color: 'var(--accent-green)', fontSize: 16 }}>{formatCurrency(viewItem.nilaiPengajuan)}</div></div><div className="form-group"><label className="form-label">Target</label><div>{viewItem.target}</div></div></div>
                            <div className="form-group"><label className="form-label">Keterangan</label><div>{viewItem.keterangan || '-'}</div></div>
                            {isAdmin && <div className="form-group"><label className="form-label">Prioritas</label><div>{renderPriorityStar(viewItem.bintang === 1, viewItem.id)}</div></div>}
                        </div>
                        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setViewItem(null)}>Tutup</button>{!readOnly && <button className="btn btn-primary" onClick={() => { setViewItem(null); handleOpenModal(viewItem); }}><Edit size={14} /> Edit Data</button>}</div>
                    </div>
                </div>
            )}

            {/* ===== CUSTOM DELETE CONFIRMATION MODAL ===== */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            {/* Animated Icon Container */}
                            <div style={{
                                width: 64,
                                height: 64,
                                borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: 'var(--accent-red)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px',
                                animation: 'pulse 2s infinite'
                            }}>
                                <AlertOctagon size={32} strokeWidth={1.5} />
                            </div>

                            <h3 style={{ fontSize: '1.15rem', marginBottom: 8, color: 'var(--text-primary)' }}>Hapus Data Proposal?</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                                Data yang dihapus tidak dapat dikembalikan.
                            </p>

                            {/* Preview Data */}
                            <div style={{
                                background: 'var(--bg-secondary)',
                                padding: '12px',
                                borderRadius: 'var(--radius-md)',
                                margin: '16px 0 24px',
                                textAlign: 'left',
                                border: '1px solid var(--border-color)'
                            }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Item yang akan dihapus:</div>
                                <div style={{ fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>{deleteConfirm.namaSekolah}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                    <span>{deleteConfirm.subKegiatan}</span>
                                    <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{formatCurrency(deleteConfirm.nilaiPengajuan)}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => setDeleteConfirm(null)}
                                    style={{ minWidth: 100 }}
                                >
                                    Batal
                                </button>
                                <button
                                    className="btn"
                                    onClick={performDelete}
                                    style={{
                                        minWidth: 100,
                                        background: 'var(--accent-red)',
                                        color: '#fff',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6
                                    }}
                                >
                                    <Trash2 size={14} /> Ya, Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL CHECKLIST PROPOSAL ===== */}
            {showChecklist && (
                <div className="modal-overlay" onClick={() => setShowChecklist(false)}>
                    <div className="modal" style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">Checklist Proposal - Instrumen Verifikasi Proposal</div><button className="modal-close" onClick={() => setShowChecklist(false)}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                                <div className="form-group"><label className="form-label">Cari Sekolah</label><SearchableSelect options={schoolNames} value={checklistForm.sekolah?.nama || ''} onChange={handleChecklistSchoolChange} placeholder="Ketik nama sekolah..." /></div>
                                <div className="form-group"><label className="form-label">Jenis Usulan</label><input className="form-input" placeholder="Ketik jenis usulan..." value={checklistForm.jenisUsulan} onChange={e => setChecklistForm(prev => ({ ...prev, jenisUsulan: e.target.value }))} /></div>
                            </div>
                            <div className="form-group"><label className="form-label">Alamat</label><input className="form-input" value={checklistForm.alamat} readOnly placeholder="Alamat sekolah" /></div>
                            <h4 style={{ marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Tabel Verifikasi</h4>
                            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                                <table className="data-table" style={{ margin: 0 }}>
                                    <thead><tr><th style={{ width: 40 }}>No</th><th style={{ width: 300 }}>Indikator</th><th style={{ width: 120 }}>Ada/Tidak Ada</th><th>Keterangan</th><th style={{ width: 40 }}>Aksi</th></tr></thead>
                                    <tbody>
                                        {checklistForm.items.map((item, i) => (
                                            <tr key={item.id}>
                                                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                                                <td><input className="form-input" style={{ border: 'none', background: 'transparent', padding: '4px' }} value={item.indikator} onChange={e => setChecklistForm(prev => ({ ...prev, items: prev.items.map(it => it.id === item.id ? { ...it, indikator: e.target.value } : it) }))} /></td>
                                                <td><select className="form-select" style={{ height: 32, fontSize: 12 }} value={item.status} onChange={e => setChecklistForm(prev => ({ ...prev, items: prev.items.map(it => it.id === item.id ? { ...it, status: e.target.value } : it) }))}><option value="-">-</option><option value="Ada">Ada</option><option value="Tidak Ada">Tidak Ada</option></select></td>
                                                <td><input className="form-input" style={{ border: 'none', background: 'transparent', padding: '4px' }} placeholder="Keterangan..." value={item.keterangan} onChange={e => setChecklistForm(prev => ({ ...prev, items: prev.items.map(it => it.id === item.id ? { ...it, keterangan: e.target.value } : it) }))} /></td>
                                                <td style={{ textAlign: 'center' }}><button className="btn-icon" onClick={() => setChecklistForm(prev => ({ ...prev, items: prev.items.filter(it => it.id !== item.id) }))} style={{ color: 'var(--accent-red)' }}><Trash2 size={14} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setChecklistForm(prev => ({ ...prev, items: [...prev.items, { id: Date.now(), indikator: '', status: '-', keterangan: '' }] }))}><Plus size={14} /> Tambah Baris</button>

                            <h4 style={{ marginTop: 24, marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>TTD Verifikator</h4>
                            {checklistForm.verifikators.map((ver, i) => (
                                <div key={ver.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 12, marginBottom: 12, alignItems: 'center' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Nama Verifikator {i + 1}</label><select className="form-select" value={ver.userId} onChange={e => { const user = usersList.find(u => u.id === parseInt(e.target.value)); setChecklistForm(prev => ({ ...prev, verifikators: prev.verifikators.map(v => v.id === ver.id ? { ...v, userId: e.target.value, nama: user?.namaAkun || '', nip: user?.nip || '-' } : v) })); }}><option value="">Pilih verifikator...</option>{usersList.filter(u => ['Admin', 'Verifikator', 'Korwil'].includes(u.role)).map(u => (<option key={u.id} value={u.id}>{u.namaAkun}</option>))}</select></div>
                                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">NIP</label><input className="form-input" value={ver.nip} readOnly placeholder="NIP otomatis terisi" /></div>
                                    <button className="btn-icon" onClick={() => setChecklistForm(prev => ({ ...prev, verifikators: prev.verifikators.filter(v => v.id !== ver.id) }))} style={{ color: 'var(--accent-red)', marginTop: 24 }}><Trash2 size={14} /></button>
                                </div>
                            ))}
                            <button className="btn btn-ghost btn-sm" onClick={() => setChecklistForm(prev => ({ ...prev, verifikators: [...prev.verifikators, { id: Date.now(), userId: '', nama: '', nip: '' }] }))}><Plus size={14} /> Tambah Verifikator</button>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowChecklist(false)}>Batal</button>
                            <button className="btn btn-secondary" onClick={handlePrintChecklist}><Printer size={14} /> Cetak</button>
                            <button className="btn btn-primary" onClick={handleSaveChecklist}><Save size={14} /> Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL REKOMENDASI ===== */}
            {showRekomendasi && (
                <div className="modal-overlay" onClick={() => setShowRekomendasi(false)}>
                    <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">Form Rekomendasi</div><button className="modal-close" onClick={() => setShowRekomendasi(false)}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group"><label className="form-label">Nama Sekolah</label><SearchableSelect options={schoolNames} value={rekomendasiForm.namaSekolah} onChange={handleRekomendasiSchoolChange} placeholder="Cari Sekolah..." /></div>
                                <div className="form-group"><label className="form-label">Kecamatan</label><input className="form-input" value={rekomendasiForm.kecamatan} readOnly placeholder="Otomatis terisi" /></div>
                                <div className="form-group"><label className="form-label">Sub Kegiatan</label><select className="form-select" value={rekomendasiForm.subKegiatan} onChange={e => handleRekomendasiChange('subKegiatan', e.target.value)}><option value="">Pilih Sub Kegiatan</option>{SUB_KEGIATAN.filter(s => !rekomendasiForm.jenjang || s.jenjang === rekomendasiForm.jenjang).map(s => <option key={s.kode} value={s.nama}>{s.nama}</option>)}</select></div>
                                <div className="form-group"><label className="form-label">Perihal</label><input className="form-input" placeholder="Isi perihal..." value={rekomendasiForm.perihal} onChange={e => handleRekomendasiChange('perihal', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Jenjang</label><input className="form-input" value={rekomendasiForm.jenjang} readOnly placeholder="Otomatis terisi" /></div>
                                <div className="form-group"><label className="form-label">Nilai (Rp)</label><input className="form-input" type="text" inputMode="numeric" placeholder="Contoh: 50.000.000" value={rekomendasiForm.nilai ? String(rekomendasiForm.nilai).replace(/\./g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) handleRekomendasiChange('nilai', raw); }} /></div>
                                <div className="form-group"><label className="form-label">Target</label><input className="form-input" placeholder="Contoh: 1 Unit" value={rekomendasiForm.target} onChange={e => handleRekomendasiChange('target', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">No Agenda</label><input className="form-input" placeholder="Nomor Agenda" value={rekomendasiForm.noAgenda} onChange={e => handleRekomendasiChange('noAgenda', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Surat Masuk</label><input className="form-input" placeholder="Sumber surat masuk" value={rekomendasiForm.suratMasuk} onChange={e => handleRekomendasiChange('suratMasuk', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Tanggal Surat</label><input className="form-input" type="date" value={rekomendasiForm.tanggalSurat} onChange={e => handleRekomendasiChange('tanggalSurat', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Nomor Surat</label><input className="form-input" placeholder="Nomor surat" value={rekomendasiForm.nomorSurat} onChange={e => handleRekomendasiChange('nomorSurat', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Sumber</label><input className="form-input" placeholder="Sumber dana/keterangan" value={rekomendasiForm.sumber} onChange={e => handleRekomendasiChange('sumber', e.target.value)} /></div>
                            </div>
                            <div className="form-group" style={{ marginTop: 16 }}><label className="form-label">Kondisi Sebenarnya</label><textarea className="form-input" rows={4} placeholder="Deskripsi kondisi sebenarnya di lapangan..." value={rekomendasiForm.kondisi} onChange={e => handleRekomendasiChange('kondisi', e.target.value)}></textarea></div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowRekomendasi(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSaveRekomendasi}><Save size={14} /> Simpan Rekomendasi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL DAFTAR DOKUMEN ===== */}
            {showDaftarModal && (
                <div className="modal-overlay" onClick={() => setShowDaftarModal(false)}>
                    <div className="modal" style={{ maxWidth: 1100, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Arsip Dokumen Terbit</div>
                            <button className="modal-close" onClick={() => setShowDaftarModal(false)}><X size={18} /></button>
                        </div>

                        <div style={{ padding: '0 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setDaftarTab('rekomendasi')}
                                style={{ padding: '0.75rem 0', borderBottom: daftarTab === 'rekomendasi' ? '2px solid var(--accent-blue)' : 'none', color: daftarTab === 'rekomendasi' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <FileText size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Daftar Rekomendasi
                            </button>
                            <button
                                onClick={() => setDaftarTab('checklist')}
                                style={{ padding: '0.75rem 0', borderBottom: daftarTab === 'checklist' ? '2px solid var(--accent-blue)' : 'none', color: daftarTab === 'checklist' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <FileCheck size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Daftar Checklist
                            </button>
                        </div>

                        <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 140px)' }}>
                            {daftarTab === 'rekomendasi' && (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th>Tanggal</th>
                                            <th>Nama Sekolah</th>
                                            <th>Perihal</th>
                                            <th>Nilai</th>
                                            <th>Sumber</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rekomendasiList.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Belum ada data rekomendasi.</td></tr>
                                        ) : (
                                            rekomendasiList.map((item, i) => (
                                                <tr key={item.id}>
                                                    <td>{i + 1}</td>
                                                    <td>{new Date(item.createdAt).toLocaleDateString('id-ID')}</td>
                                                    <td>{item.namaSekolah}</td>
                                                    <td>{item.perihal}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.nilai)}</td>
                                                    <td>{item.sumber}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button className="btn-icon" title="Lihat"><Eye size={16} /></button>
                                                            <button className="btn-icon" title="Hapus" style={{ color: 'var(--accent-red)' }} onClick={() => setRekomendasiList(prev => prev.filter(d => d.id !== item.id))}><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}

                            {daftarTab === 'checklist' && (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th>Tanggal</th>
                                            <th>Nama Sekolah</th>
                                            <th>Jenis Usulan</th>
                                            <th>Jumlah Indikator</th>
                                            <th>Verifikator</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {checklistList.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Belum ada data checklist.</td></tr>
                                        ) : (
                                            checklistList.map((item, i) => (
                                                <tr key={item.id}>
                                                    <td>{i + 1}</td>
                                                    <td>{new Date(item.createdAt).toLocaleDateString('id-ID')}</td>
                                                    <td>{item.sekolah?.nama || '-'}</td>
                                                    <td>{item.jenisUsulan || '-'}</td>
                                                    <td>{item.items?.length || 0} Item</td>
                                                    <td>{item.verifikators?.length || 0} Orang</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button className="btn-icon" title="Cetak" onClick={() => window.print()}><Printer size={16} /></button>
                                                            <button className="btn-icon" title="Hapus" style={{ color: 'var(--accent-red)' }} onClick={() => setChecklistList(prev => prev.filter(d => d.id !== item.id))}><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Global style for pulse animation */}
            <style>{`
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
            `}</style>
        </div>
    );
};

export default Proposal;