import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Download, Edit, Trash2, Save, X, ChevronDown, ChevronUp, Building2, Hammer, HardHat, Wallet, ChevronLeft, ChevronRight, Maximize2, Minimize2, MessageSquareText, Filter, AlertCircle } from 'lucide-react';
import { useProyeksiData, useSarprasData, useSekolahData } from '../../data/dataProvider';
import { JENIS_PRASARANA, JENJANG } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { proyeksiApi } from '../../api/index';
import { useApi } from '../../api/hooks';

// Opsi untuk Keterangan (Combo Box)
const KETERANGAN_OPTIONS = [
    'Sudah masuk DAU',
    'Sudah masuk DAK',
    'Usulan APBD',
    'Usulan Renstra',
    'Belum diusulkan',
    'Prioritas Tinggi',
    'Ditolak (Tidak Memenuhi Syarat)'
];

// Helper untuk format angka di input
const formatNumberInput = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const cleanValue = value.toString().replace(/\D/g, '');
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseFormattedNumber = (value) => {
    if (!value) return 0;
    return Number(value.toString().replace(/\./g, '').replace(/,/g, ''));
};

const ProyeksiAnggaran = () => {
    const [tab, setTab] = useState('anggaran');
    const { data: proyeksiList, refetch: refetchAnggaran } = useProyeksiData();
    const { data: sekolahList } = useSekolahData();
    const { data: sarprasList } = useSarprasData();

    const [anggaranData, setAnggaranData] = useState([]);
    const { data: snpApiData, refetch: refetchSnp } = useApi(() => proyeksiApi.listSnp(), []);
    const [snpData, setSnpData] = useState([]);
    const [expandedRows, setExpandedRows] = useState([]);

    useEffect(() => { if (proyeksiList?.length) setAnggaranData(proyeksiList); }, [proyeksiList]);
    useEffect(() => { if (snpApiData?.data) setSnpData(snpApiData.data); else if (Array.isArray(snpApiData)) setSnpData(snpApiData); }, [snpApiData]);

    // ===== STATE UNTUK KETERANGAN MANUAL =====
    const [sekolahKeterangan, setSekolahKeterangan] = useState({});

    // ===== STATE FILTER =====
    const [filterJenjang, setFilterJenjang] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // ===== PAGINATION STATE (SHARED) =====
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({});

    // Reset page & expand saat tab, pageSize, atau filter berubah
    useEffect(() => {
        setCurrentPage(1);
        setExpandedRows([]);
    }, [tab, pageSize, filterJenjang, searchQuery]);

    // =========================================================================
    // LOGIC: KALKULASI OTOMATIS TOTAL
    // =========================================================================
    const { rekapData, globalStats } = useMemo(() => {
        const sekolahMap = {};

        sekolahList.forEach(s => {
            const rombel = s.rombel || Math.floor(Math.random() * 12) + 6;
            sekolahMap[s.id] = {
                ...s, rombel,
                jmlRuangKelas: 0, jmlToilet: 0,
                biayaRS: 0, biayaRB: 0, biayaKelas: 0, biayaToilet: 0,
                details: []
            };
        });

        sarprasList.forEach(sp => {
            const sk = sekolahMap[sp.sekolahId];
            if (!sk) return;

            const angg = anggaranData.find(a => a.jenisPrasarana === sp.jenisPrasarana && a.jenjang === sk.jenjang);
            const snp = snpData.find(s => s.jenisPrasarana === sp.jenisPrasarana && s.jenjang === sk.jenjang);

            if (sp.jenisPrasarana === 'Ruang Kelas') sk.jmlRuangKelas++;
            if (sp.jenisPrasarana === 'Toilet') sk.jmlToilet++;

            if (sp.kondisi === 'RUSAK SEDANG' || sp.kondisi === 'RUSAK BERAT') {
                const isBerat = sp.kondisi === 'RUSAK BERAT';
                const costKey = isBerat ? 'rusakBerat' : 'rusakSedang';
                const defaultCost = isBerat ? 100_000_000 : 75_000_000;
                const cost = angg ? angg[costKey] : defaultCost;

                if (isBerat) sk.biayaRB += cost;
                else sk.biayaRS += cost;

                sk.details.push({
                    type: 'rehab', kondisi: isBerat ? 'berat' : 'sedang',
                    name: `${snp?.judulRehabilitasi || `Rehabilitasi ${sp.jenisPrasarana}`} (${isBerat ? 'Berat' : 'Sedang'})`,
                    count: 1, unitCost: cost, totalCost: cost
                });
            }
        });

        let gTotRS = 0, gTotRB = 0, gTotBuild = 0;

        Object.values(sekolahMap).forEach(sk => {
            const anggKelas = anggaranData.find(a => a.jenisPrasarana === 'Ruang Kelas' && a.jenjang === sk.jenjang);
            const anggToilet = anggaranData.find(a => a.jenisPrasarana === 'Toilet' && a.jenjang === sk.jenjang);
            const snpKelas = snpData.find(s => s.jenisPrasarana === 'Ruang Kelas' && s.jenjang === sk.jenjang);
            const snpToilet = snpData.find(s => s.jenisPrasarana === 'Toilet' && s.jenjang === sk.jenjang);

            const defKelas = sk.rombel - sk.jmlRuangKelas;
            if (defKelas > 0) {
                const unitCost = anggKelas ? anggKelas.pembangunan : 150_000_000;
                const totalCost = defKelas * unitCost;
                sk.biayaKelas = totalCost;
                sk.details.push({
                    type: 'build', name: snpKelas?.judulPembangunan || 'Pembangunan Ruang Kelas Baru',
                    count: defKelas, unitCost, totalCost
                });
            }

            const targetToilet = Math.max(1, sk.rombel - 1);
            const defToilet = targetToilet - sk.jmlToilet;
            if (defToilet > 0) {
                const unitCost = anggToilet ? anggToilet.pembangunan : 50_000_000;
                const totalCost = defToilet * unitCost;
                sk.biayaToilet = totalCost;
                sk.details.push({
                    type: 'build', name: snpToilet?.judulPembangunan || 'Pembangunan Toilet Baru',
                    count: defToilet, unitCost, totalCost
                });
            }

            gTotRS += sk.biayaRS;
            gTotRB += sk.biayaRB;
            gTotBuild += (sk.biayaKelas + sk.biayaToilet);
        });

        return {
            rekapData: Object.values(sekolahMap),
            globalStats: { totalRS: gTotRS, totalRB: gTotRB, totalBuild: gTotBuild, grandTotal: gTotRS + gTotRB + gTotBuild }
        };
    }, [anggaranData, snpData]);

    // =========================================================================
    // FILTER LOGIC
    // =========================================================================

    // Filter untuk Tab Rekap (Semua)
    const filteredRekapData = useMemo(() => {
        return rekapData.filter(item => {
            const matchJenjang = filterJenjang === 'all' || item.jenjang === filterJenjang;
            const matchSearch = searchQuery === '' || item.nama.toLowerCase().includes(searchQuery.toLowerCase());
            return matchJenjang && matchSearch;
        });
    }, [rekapData, filterJenjang, searchQuery]);

    // Filter untuk Tab Baru: Belum Masuk Usulan
    // Kriteria: Total Anggaran > 0 DAN (Keterangan kosong ATAU Keterangan == 'Belum diusulkan')
    const filteredBelumUsulan = useMemo(() => {
        return rekapData.filter(item => {
            const totalAnggaran = item.biayaRS + item.biayaRB + item.biayaKelas + item.biayaToilet;
            const keterangan = sekolahKeterangan[item.id];
            const isBelumUsul = !keterangan || keterangan === 'Belum diusulkan';

            const matchJenjang = filterJenjang === 'all' || item.jenjang === filterJenjang;
            const matchSearch = searchQuery === '' || item.nama.toLowerCase().includes(searchQuery.toLowerCase());

            return totalAnggaran > 0 && isBelumUsul && matchJenjang && matchSearch;
        });
    }, [rekapData, sekolahKeterangan, filterJenjang, searchQuery]);


    // =========================================================================
    // PAGINATION COMPUTED DATA
    // =========================================================================

    // 1. Anggaran
    const totalAnggaran = anggaranData.length;
    const totalPagesAnggaran = Math.ceil(totalAnggaran / pageSize) || 1;
    const pagedAnggaran = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return anggaranData.slice(start, start + pageSize);
    }, [anggaranData, currentPage, pageSize]);

    // 2. Rekap (All)
    const totalRekap = filteredRekapData.length;
    const totalPagesRekap = Math.ceil(totalRekap / pageSize) || 1;
    const pagedRekap = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRekapData.slice(start, start + pageSize);
    }, [filteredRekapData, currentPage, pageSize]);

    // 3. SNP
    const totalSnp = snpData.length;
    const totalPagesSnp = Math.ceil(totalSnp / pageSize) || 1;
    const pagedSnp = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return snpData.slice(start, start + pageSize);
    }, [snpData, currentPage, pageSize]);

    // 4. Belum Usulan (New)
    const totalBelumUsul = filteredBelumUsulan.length;
    const totalPagesBelumUsul = Math.ceil(totalBelumUsul / pageSize) || 1;
    const pagedBelumUsulan = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredBelumUsulan.slice(start, start + pageSize);
    }, [filteredBelumUsulan, currentPage, pageSize]);


    // =========================================================================
    // HANDLERS
    // =========================================================================
    const toggleRow = (id) => {
        setExpandedRows(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleExpandAll = (dataset) => {
        const allVisibleExpanded = dataset.every(d => expandedRows.includes(d.id));
        if (allVisibleExpanded) setExpandedRows([]);
        else setExpandedRows(dataset.map(d => d.id));
    };

    const handleKeteranganChange = (sekolahId, value) => {
        setSekolahKeterangan(prev => ({
            ...prev,
            [sekolahId]: value
        }));
        // Optional: Toast notification when status changes from 'Belum Diusulkan' to something else
        if (value !== 'Belum diusulkan' && value !== '') {
            // toast.success(`Status sekolah diperbarui`);
        }
    };

    const openModal = (type, item = null) => {
        setModalType(type); setEditItem(item);
        if (item) setFormData(item);
        else {
            if (type === 'anggaran') setFormData({ jenisPrasarana: JENIS_PRASARANA[0], jenjang: JENJANG[0], lantai: 1, rusakSedang: 0, rusakBerat: 0, pembangunan: 0 });
            else setFormData({ jenisPrasarana: JENIS_PRASARANA[0], jenjang: JENJANG[0], judulRehabilitasi: '', judulPembangunan: '' });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.jenisPrasarana || !formData.jenjang) { toast.error('Wajib diisi'); return; }
        const payload = { ...formData };
        if (modalType === 'anggaran') {
            payload.rusakSedang = parseFormattedNumber(payload.rusakSedang);
            payload.rusakBerat = parseFormattedNumber(payload.rusakBerat);
            payload.pembangunan = parseFormattedNumber(payload.pembangunan);
        }
        try {
            if (modalType === 'anggaran') {
                if (editItem) await proyeksiApi.updateAnggaran(editItem.id, payload);
                else await proyeksiApi.createAnggaran(payload);
                toast.success('Data Anggaran Disimpan');
                refetchAnggaran();
            } else {
                if (editItem) await proyeksiApi.updateSnp(editItem.id, payload);
                else await proyeksiApi.createSnp(payload);
                toast.success('Data SNP Disimpan');
                refetchSnp();
            }
            setShowModal(false);
        } catch (err) { toast.error(err.message || 'Gagal menyimpan'); }
    };

    const handleDelete = async (type, id) => {
        if (!confirm('Hapus data ini?')) return;
        try {
            if (type === 'anggaran') { await proyeksiApi.deleteAnggaran(id); setAnggaranData(prev => prev.filter(d => d.id !== id)); }
            else { await proyeksiApi.deleteSnp(id); refetchSnp(); }
            toast.success('Data dihapus');
        } catch (err) { toast.error(err.message || 'Gagal menghapus'); }
    };

    const handleExport = (type) => toast.success('Ekspor berhasil');

    // Helper for Pagination Text
    const getPaginationText = (total, page, size) => {
        const start = (page - 1) * size + 1;
        const end = Math.min(page * size, total);
        return `Menampilkan ${total > 0 ? start : 0}-${end} dari ${total} data`;
    };

    // Pagination Controls Component
    const PaginationControls = ({ totalPages, totalItems, tableName }) => (
        <div className="table-pagination">
            <div className="table-pagination-info">{getPaginationText(totalItems, currentPage, pageSize)}</div>
            <div className="table-pagination-controls">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                <span>Hal {currentPage} dari {totalPages || 1}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>›</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0}>»</button>
            </div>
        </div>
    );

    // Reusable Table Body Renderer to avoid code duplication
    const renderTableBody = (dataset) => {
        if (dataset.length === 0) {
            return (
                <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={24} />
                            <span>Tidak ada data yang memenuhi kriteria filter.</span>
                        </div>
                    </td>
                </tr>
            );
        }

        return dataset.map((s, i) => {
            const rowNumber = ((currentPage - 1) * pageSize) + i + 1;
            const isExpanded = expandedRows.includes(s.id);

            const totalRehab = s.biayaRS + s.biayaRB;
            const totalBuild = s.biayaKelas + s.biayaToilet;
            const totalAnggaran = totalRehab + totalBuild;

            return (
                <>
                    <tr key={s.id} onClick={() => toggleRow(s.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td>{rowNumber}</td>
                        <td>
                            <div style={{ fontWeight: 500 }}>{s.nama}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{s.jenjang}</div>
                        </td>
                        {/* Input Keterangan Combo Box */}
                        <td style={{ background: 'rgba(139, 92, 246, 0.05)' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MessageSquareText size={16} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
                                <input
                                    list="keterangan-options"
                                    placeholder="Pilih atau ketik..."
                                    value={sekolahKeterangan[s.id] || ''}
                                    onChange={(e) => handleKeteranganChange(s.id, e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'transparent',
                                        border: '1px solid transparent',
                                        borderBottom: '1px dashed var(--border-color)',
                                        padding: '4px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>
                        </td>
                        <td style={{ color: totalRehab > 0 ? 'var(--accent-orange)' : 'var(--text-secondary)', textAlign: 'right', fontWeight: 500 }}>
                            {totalRehab > 0 ? formatCurrency(totalRehab) : '-'}
                        </td>
                        <td style={{ color: totalBuild > 0 ? 'var(--accent-blue)' : 'var(--text-secondary)', textAlign: 'right', fontWeight: 500 }}>
                            {totalBuild > 0 ? formatCurrency(totalBuild) : '-'}
                        </td>
                        <td style={{ fontWeight: 700, background: 'var(--bg-secondary)', textAlign: 'right', color: 'var(--text-primary)' }}>
                            {formatCurrency(totalAnggaran)}
                        </td>
                    </tr>

                    {isExpanded && (
                        <tr key={s.id + '-details'}>
                            <td colSpan={7} style={{ padding: 0, background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                                <div style={{ padding: '1rem 1.5rem' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Rincian Kebutuhan</div>
                                    {s.details.length === 0 ? (
                                        <div style={{ color: 'var(--text-secondary)' }}>Tidak ada kebutuhan.</div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                                            {s.details.map((d, idx) => {
                                                let itemColor = 'var(--accent-blue)';
                                                let labelBg = 'rgba(59, 130, 246, 0.1)'; let labelText = 'BANGUN';
                                                if (d.type === 'rehab') {
                                                    if (d.kondisi === 'berat') { itemColor = 'var(--accent-red)'; labelBg = 'rgba(239, 68, 68, 0.1)'; }
                                                    else { itemColor = 'var(--accent-orange)'; labelBg = 'rgba(249, 115, 22, 0.1)'; }
                                                    labelText = 'REHAB';
                                                }
                                                return (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: labelBg, color: itemColor }}>{labelText}</span>
                                                            <span style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                                                            <span style={{ color: 'var(--text-secondary)' }}>({d.count} Unit)</span>
                                                        </div>
                                                        <span style={{ fontWeight: 600, color: itemColor }}>{formatCurrency(d.totalCost)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )}
                </>
            );
        });
    };

    const renderModal = () => {
        if (!showModal) return null;
        return (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
                <div className="modal" style={{ maxWidth: '32rem' }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <div className="modal-title">{editItem ? 'Edit' : 'Tambah'} Data</div>
                        <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Jenis Prasarana</label>
                            <select className="form-select" value={formData.jenisPrasarana || ''} onChange={e => setFormData({ ...formData, jenisPrasarana: e.target.value })}>
                                {JENIS_PRASARANA.map(j => <option key={j} value={j}>{j}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Jenjang</label>
                            <select className="form-select" value={formData.jenjang || ''} onChange={e => setFormData({ ...formData, jenjang: e.target.value })}>
                                {JENJANG.map(j => <option key={j} value={j}>{j}</option>)}
                            </select>
                        </div>
                        {modalType === 'anggaran' ? (
                            <>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Rusak Sedang (Rp)</label><input className="form-input" type="text" value={formatNumberInput(formData.rusakSedang)} onChange={e => setFormData({ ...formData, rusakSedang: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Rusak Berat (Rp)</label><input className="form-input" type="text" value={formatNumberInput(formData.rusakBerat)} onChange={e => setFormData({ ...formData, rusakBerat: e.target.value })} /></div>
                                </div>
                                <div className="form-group"><label className="form-label">Pembangunan Baru (Rp)</label><input className="form-input" type="text" value={formatNumberInput(formData.pembangunan)} onChange={e => setFormData({ ...formData, pembangunan: e.target.value })} /></div>
                            </>
                        ) : (
                            <>
                                <div className="form-group"><label className="form-label">Judul Rehabilitasi</label><input className="form-input" value={formData.judulRehabilitasi || ''} onChange={e => setFormData({ ...formData, judulRehabilitasi: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Judul Pembangunan</label><input className="form-input" value={formData.judulPembangunan || ''} onChange={e => setFormData({ ...formData, judulPembangunan: e.target.value })} /></div>
                            </>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
                        <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Simpan</button>
                    </div>
                </div>
            </div>
        );
    };

    // Helper for Toolbar (to avoid repetition)
    const renderTableToolbar = (totalItems, expandDataset = null) => (
        <div className="table-toolbar">
            <div className="table-toolbar-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
                    <select
                        value={filterJenjang}
                        onChange={(e) => setFilterJenjang(e.target.value)}
                        style={{ padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                    >
                        <option value="all">Semua Jenjang</option>
                        {JENJANG.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tampil:</span>
                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
                        <option value="10">10</option>
                        <option value="15">15</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </div>

                {expandDataset && (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleExpandAll(expandDataset)} style={{ marginLeft: '0.5rem' }}>
                        {expandDataset.every(d => expandedRows.includes(d.id)) ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        <span style={{ marginLeft: 4 }}>{expandDataset.every(d => expandedRows.includes(d.id)) ? 'Collapse All' : 'Expand All'}</span>
                    </button>
                )}
            </div>
            <div className="table-toolbar-right">
                <div className="table-search">
                    <Search size={16} className="search-icon" />
                    <input
                        placeholder="Cari sekolah..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => handleExport('rekap')}><Download size={14} /> Ekspor</button>
            </div>
        </div>
    );

    return (
        <div style={{ fontSize: '0.875rem' }}>
            <div className="page-header">
                <div className="page-header-left"><h1>Proyeksi Anggaran</h1><p>Kalkulasi otomatis kebutuhan anggaran berdasarkan kondisi & SNP</p></div>
            </div>

            <div className="keranjang-tabs" style={{ maxWidth: '35rem', marginBottom: '1.5rem' }}>
                <button className={`keranjang-tab ${tab === 'anggaran' ? 'active' : ''}`} onClick={() => setTab('anggaran')}>Atur Anggaran</button>
                <button className={`keranjang-tab ${tab === 'rekap' ? 'active' : ''}`} onClick={() => setTab('rekap')}>Rekapitulasi</button>
                <button className={`keranjang-tab ${tab === 'belum-usul' ? 'active' : ''}`} onClick={() => setTab('belum-usul')}>
                    Belum Usul
                    {filteredBelumUsulan.length > 0 && (
                        <span style={{ marginLeft: '6px', background: 'var(--accent-red)', color: 'white', borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 600 }}>
                            {filteredBelumUsulan.length}
                        </span>
                    )}
                </button>
                <button className={`keranjang-tab ${tab === 'snp' ? 'active' : ''}`} onClick={() => setTab('snp')}>SNP (Acuan)</button>
            </div>

            {/* TAB 1: ATUR ANGGARAN */}
            {tab === 'anggaran' && (
                <div className="table-container">
                    <div className="table-toolbar">
                        <div className="table-toolbar-left">
                            <button className="btn btn-primary btn-sm" onClick={() => openModal('anggaran')}><Plus size={14} /> Tambah</button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Tampil:</span>
                                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
                                    <option value="10">10</option>
                                    <option value="15">15</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>
                        <div className="table-toolbar-right">
                            <button className="btn btn-secondary btn-sm" onClick={() => handleExport('anggaran')}><Download size={14} /> Ekspor</button>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead><tr><th>No</th><th>Jenis Prasarana</th><th>Jenjang</th><th style={{ textAlign: 'right' }}>Rusak Sedang</th><th style={{ textAlign: 'right' }}>Rusak Berat</th><th style={{ textAlign: 'right' }}>Pembangunan</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {pagedAnggaran.map((item, i) => (
                                    <tr key={item.id}>
                                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                        <td>{item.jenisPrasarana}</td>
                                        <td>{item.jenjang}</td>
                                        <td style={{ color: 'var(--accent-orange)', textAlign: 'right' }}>{formatCurrency(item.rusakSedang)}</td>
                                        <td style={{ color: 'var(--accent-red)', textAlign: 'right' }}>{formatCurrency(item.rusakBerat)}</td>
                                        <td style={{ color: 'var(--accent-blue)', textAlign: 'right' }}>{formatCurrency(item.pembangunan)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-icon" onClick={() => openModal('anggaran', item)}><Edit size={16} /></button>
                                                <button className="btn-icon" onClick={() => handleDelete('anggaran', item.id)} style={{ color: 'var(--accent-red)' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls totalPages={totalPagesAnggaran} totalItems={totalAnggaran} tableName="anggaran" />
                </div>
            )}

            {/* TAB 2: REKAPITULASI KEBUTUHAN (SEMUA) */}
            {tab === 'rekap' && (
                <>
                    <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><HardHat size={16} style={{ marginRight: 6, color: 'var(--accent-orange)' }} /> Total Rehab Sedang</div>
                            <div className="stat-value" style={{ color: 'var(--accent-orange)', fontSize: '1.25rem' }}>{formatCurrency(globalStats.totalRS)}</div>
                        </div>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-red)' }}>
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><Hammer size={16} style={{ marginRight: 6, color: 'var(--accent-red)' }} /> Total Rehab Berat</div>
                            <div className="stat-value" style={{ color: 'var(--accent-red)', fontSize: '1.25rem' }}>{formatCurrency(globalStats.totalRB)}</div>
                        </div>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><Building2 size={16} style={{ marginRight: 6, color: 'var(--accent-blue)' }} /> Total Pembangunan</div>
                            <div className="stat-value" style={{ color: 'var(--accent-blue)', fontSize: '1.25rem' }}>{formatCurrency(globalStats.totalBuild)}</div>
                        </div>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><Wallet size={16} style={{ marginRight: 6, color: 'var(--accent-green)' }} /> Grand Total</div>
                            <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: '1.25rem' }}>{formatCurrency(globalStats.grandTotal)}</div>
                        </div>
                    </div>

                    <div className="table-container">
                        {renderTableToolbar(totalRekap, pagedRekap)}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}></th>
                                        <th style={{ width: 50 }}>No</th>
                                        <th style={{ minWidth: 200 }}>Nama Sekolah</th>
                                        <th style={{ minWidth: 220, background: 'var(--bg-secondary)', borderLeft: '3px solid var(--accent-purple)' }}>Keterangan / Usulan</th>
                                        <th style={{ width: 150, textAlign: 'right' }}>Total Rehab</th>
                                        <th style={{ width: 150, textAlign: 'right' }}>Total Pembangunan</th>
                                        <th style={{ width: 170, textAlign: 'right', background: 'var(--bg-secondary)' }}>Total Anggaran</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderTableBody(pagedRekap)}
                                </tbody>
                            </table>
                            <datalist id="keterangan-options">
                                {KETERANGAN_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                            </datalist>
                        </div>
                        <PaginationControls totalPages={totalPagesRekap} totalItems={totalRekap} tableName="rekap" />
                    </div>
                </>
            )}

            {/* TAB 3: BELUM MASUK USULAN (NEW) */}
            {tab === 'belum-usul' && (
                <>
                    <div className="alert alert-warning" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', color: 'var(--accent-orange)' }}>
                        <AlertCircle size={20} />
                        <div>
                            <strong>Perhatian:</strong> Tabel ini menampilkan sekolah yang memiliki kebutuhan anggaran tetapi belum memiliki status usulan (kosong atau "Belum diusulkan"). Ubah status pada kolom "Keterangan" untuk mengeluarkannya dari daftar ini.
                        </div>
                    </div>

                    <div className="table-container">
                        {renderTableToolbar(totalBelumUsul, pagedBelumUsulan)}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}></th>
                                        <th style={{ width: 50 }}>No</th>
                                        <th style={{ minWidth: 200 }}>Nama Sekolah</th>
                                        {/* Highlighted Column for Action */}
                                        <th style={{ minWidth: 220, background: 'rgba(249, 115, 22, 0.1)', borderLeft: '3px solid var(--accent-orange)' }}>Ubah Status</th>
                                        <th style={{ width: 150, textAlign: 'right' }}>Total Rehab</th>
                                        <th style={{ width: 150, textAlign: 'right' }}>Total Pembangunan</th>
                                        <th style={{ width: 170, textAlign: 'right', background: 'var(--bg-secondary)' }}>Total Anggaran</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderTableBody(pagedBelumUsulan)}
                                </tbody>
                            </table>
                            <datalist id="keterangan-options">
                                {KETERANGAN_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                            </datalist>
                        </div>
                        <PaginationControls totalPages={totalPagesBelumUsul} totalItems={totalBelumUsul} tableName="belum-usul" />
                    </div>
                </>
            )}

            {/* TAB 4: SNP */}
            {tab === 'snp' && (
                <div className="table-container">
                    <div className="table-toolbar">
                        <div className="table-toolbar-left">
                            <button className="btn btn-primary btn-sm" onClick={() => openModal('snp')}><Plus size={14} /> Tambah</button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Tampil:</span>
                                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
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
                            <thead><tr><th>No</th><th>Jenis Prasarana</th><th>Jenjang</th><th>Judul Rehabilitasi</th><th>Judul Pembangunan</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {pagedSnp.map((item, i) => (
                                    <tr key={item.id}>
                                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                        <td>{item.jenisPrasarana}</td>
                                        <td>{item.jenjang}</td>
                                        <td>{item.judulRehabilitasi}</td>
                                        <td>{item.judulPembangunan}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-icon" onClick={() => openModal('snp', item)}><Edit size={16} /></button>
                                                <button className="btn-icon" onClick={() => handleDelete('snp', item.id)} style={{ color: 'var(--accent-red)' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls totalPages={totalPagesSnp} totalItems={totalSnp} tableName="snp" />
                </div>
            )}

            {renderModal()}
        </div>
    );
};

export default ProyeksiAnggaran;