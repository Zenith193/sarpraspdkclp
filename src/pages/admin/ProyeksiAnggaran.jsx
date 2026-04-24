import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Search, Download, Edit, Trash2, Save, X, ChevronDown, ChevronUp, Building2, Hammer, HardHat, Wallet, ChevronLeft, ChevronRight, Maximize2, Minimize2, MessageSquareText, Filter, AlertCircle, FileSpreadsheet, FileText, List, Eye, EyeOff, Columns } from 'lucide-react';
import { useProyeksiData, useSarprasData, useSekolahData } from '../../data/dataProvider';
import { JENIS_PRASARANA, JENJANG } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { proyeksiApi } from '../../api/index';
import { useApi } from '../../api/hooks';
import ConfirmModal from '../../components/ui/ConfirmModal';
import useAuthStore from '../../store/authStore';

// Standalone UsulanChipInput component (extracted outside to prevent re-creation on parent render)
const UsulanChipInput = React.memo(({ chips, onAdd, onRemove }) => {
    const [inputVal, setInputVal] = useState('');
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && inputVal.trim()) {
            e.preventDefault();
            onAdd(inputVal.trim());
            setInputVal('');
        }
    };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 32 }} onClick={e => e.stopPropagation()}>
            {chips.map((c, idx) => (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 12, background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: '0.78rem', fontWeight: 500 }}>
                    {idx + 1}. {c}
                    <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '0.9rem', marginLeft: 'auto' }}>×</button>
                </span>
            ))}
            <input
                list="keterangan-options"
                placeholder={chips.length === 0 ? 'Ketik usulan + Enter...' : '+ Tambah usulan...'}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (inputVal.trim()) { onAdd(inputVal.trim()); setInputVal(''); } }}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '4px', color: 'var(--text-primary)', fontSize: '0.82rem' }}
            />
        </div>
    );
});

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
    const { user } = useAuthStore();
    const isAdmin = ['admin', 'verifikator'].includes(user?.role?.toLowerCase());
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

    // ===== STATE UNTUK KETERANGAN/USULAN (MULTI-ARRAY) =====
    const [sekolahKeterangan, setSekolahKeterangan] = useState({});
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportRef = useRef(null);

    // Close export menu on outside click
    useEffect(() => {
        const handleClick = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Load keterangan from backend on mount — backward compat: string → array
    useEffect(() => {
        proyeksiApi.getKeterangan().then(data => {
            if (data && typeof data === 'object') {
                const normalized = {};
                Object.entries(data).forEach(([k, v]) => {
                    if (Array.isArray(v)) normalized[k] = v;
                    else if (typeof v === 'string' && v.trim()) {
                        // Try JSON parse first
                        try { const parsed = JSON.parse(v); normalized[k] = Array.isArray(parsed) ? parsed : [v]; }
                        catch { normalized[k] = [v]; }
                    } else normalized[k] = [];
                });
                setSekolahKeterangan(normalized);
            }
        }).catch(() => {});
    }, []);

    // ===== STATE FILTER =====
    const [filterJenjang, setFilterJenjang] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // ===== COLUMN VISIBILITY (Rekap Usulan) =====
    const [rekapUsulanCols, setRekapUsulanCols] = useState({
        totalRehab: false,
        totalPembangunan: false,
        totalAnggaran: false,
    });
    const [showColFilter, setShowColFilter] = useState(false);
    const toggleCol = (key) => setRekapUsulanCols(prev => ({ ...prev, [key]: !prev[key] }));
    const visibleColCount = 5 + (rekapUsulanCols.totalRehab ? 1 : 0) + (rekapUsulanCols.totalPembangunan ? 1 : 0) + (rekapUsulanCols.totalAnggaran ? 1 : 0);

    // ===== PAGINATION STATE (SHARED) =====
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { type, id }

    // Reset page & expand saat tab, pageSize, atau filter berubah
    useEffect(() => {
        setCurrentPage(1);
        setExpandedRows([]);
    }, [tab, pageSize, filterJenjang, searchQuery]);

    // =========================================================================
    // LOGIC: KALKULASI OTOMATIS TOTAL
    // =========================================================================
    const { rekapData, globalStats } = useMemo(() => {
        const angData = anggaranData.length ? anggaranData : (proyeksiList || []);
        const sekolahMap = {};

        sekolahList.forEach(s => {
            sekolahMap[s.id] = {
                ...s,
                rombel: s.rombel || 0,
                prasaranaCount: {},  // { jenisPrasarana: count }
                rehabGroup: {},      // { "jenisPrasarana|kondisi": { count, unitCost } }
                biayaRS: 0, biayaRB: 0, biayaBuild: 0,
                details: []
            };
        });

        // Count sarpras per sekolah & group rehab
        sarprasList.forEach(sp => {
            const sk = sekolahMap[sp.sekolahId];
            if (!sk) return;

            // Count per jenis prasarana
            sk.prasaranaCount[sp.jenisPrasarana] = (sk.prasaranaCount[sp.jenisPrasarana] || 0) + 1;

            // Group rehab by jenisPrasarana + kondisi (ONLY if in SNP acuan)
            if (sp.kondisi === 'RUSAK SEDANG' || sp.kondisi === 'RUSAK BERAT') {
                const isBerat = sp.kondisi === 'RUSAK BERAT';
                // Skip if this jenisPrasarana is NOT in SNP for this jenjang
                const snpMatch = snpData.find(s => s.jenisPrasarana === sp.jenisPrasarana && s.jenjang === sk.jenjang);
                if (!snpMatch) return;

                const key = `${sp.jenisPrasarana}|${isBerat ? 'berat' : 'sedang'}`;
                const angg = angData.find(a => a.jenisPrasarana === sp.jenisPrasarana && a.jenjang === sk.jenjang);
                const costKey = isBerat ? 'rusakBerat' : 'rusakSedang';
                const defaultCost = isBerat ? 100_000_000 : 75_000_000;
                const unitCost = angg ? angg[costKey] : defaultCost;

                if (!sk.rehabGroup[key]) {
                    sk.rehabGroup[key] = { jenisPrasarana: sp.jenisPrasarana, kondisi: isBerat ? 'berat' : 'sedang', count: 0, unitCost };
                }
                sk.rehabGroup[key].count++;
            }
        });

        let gTotRS = 0, gTotRB = 0, gTotBuild = 0;

        Object.values(sekolahMap).forEach(sk => {
            // === REHAB: grouped ===
            Object.values(sk.rehabGroup).forEach(grp => {
                const totalCost = grp.count * grp.unitCost;
                const snp = snpData.find(s => s.jenisPrasarana === grp.jenisPrasarana && s.jenjang === sk.jenjang);
                const label = grp.kondisi === 'berat' ? 'Berat' : 'Sedang';
                const name = `${snp?.judulRehabilitasi || `Rehabilitasi ${grp.jenisPrasarana}`} (${label})`;

                if (grp.kondisi === 'berat') sk.biayaRB += totalCost;
                else sk.biayaRS += totalCost;

                sk.details.push({
                    type: 'rehab', kondisi: grp.kondisi,
                    name, count: grp.count, unitCost: grp.unitCost, totalCost
                });
            });

            // === PEMBANGUNAN ===
            // 1. Ruang Kelas: kebutuhan = rombel - jumlah ruang kelas yang ada
            const jmlKelas = sk.prasaranaCount['Ruang Kelas'] || 0;
            const defKelas = sk.rombel - jmlKelas;
            if (defKelas > 0) {
                const anggKelas = angData.find(a => a.jenisPrasarana === 'Ruang Kelas' && a.jenjang === sk.jenjang);
                const snpKelas = snpData.find(s => s.jenisPrasarana === 'Ruang Kelas' && s.jenjang === sk.jenjang);
                const unitCost = anggKelas ? anggKelas.pembangunan : 150_000_000;
                const totalCost = defKelas * unitCost;
                sk.biayaBuild += totalCost;
                sk.details.push({
                    type: 'build', name: snpKelas?.judulPembangunan || 'Pembangunan Ruang Kelas Baru',
                    count: defKelas, unitCost, totalCost
                });
            }

            // 2. Toilet: kebutuhan = (rombel - 1) - jumlah toilet yang ada
            const jmlToilet = sk.prasaranaCount['Toilet'] || 0;
            const targetToilet = Math.max(0, sk.rombel - 1);
            const defToilet = targetToilet - jmlToilet;
            if (defToilet > 0) {
                const anggToilet = angData.find(a => a.jenisPrasarana === 'Toilet' && a.jenjang === sk.jenjang);
                const snpToilet = snpData.find(s => s.jenisPrasarana === 'Toilet' && s.jenjang === sk.jenjang);
                const unitCost = anggToilet ? anggToilet.pembangunan : 50_000_000;
                const totalCost = defToilet * unitCost;
                sk.biayaBuild += totalCost;
                sk.details.push({
                    type: 'build', name: snpToilet?.judulPembangunan || 'Pembangunan Toilet Baru',
                    count: defToilet, unitCost, totalCost
                });
            }

            // 3. Prasarana lain dari SNP: jika sekolah tidak punya sama sekali, butuh pembangunan 1 unit
            snpData.forEach(snp => {
                if (snp.jenjang !== sk.jenjang) return;
                if (snp.jenisPrasarana === 'Ruang Kelas' || snp.jenisPrasarana === 'Toilet') return; // sudah dihitung di atas
                const jml = sk.prasaranaCount[snp.jenisPrasarana] || 0;
                if (jml === 0) {
                    const angg = angData.find(a => a.jenisPrasarana === snp.jenisPrasarana && a.jenjang === sk.jenjang);
                    const unitCost = angg ? angg.pembangunan : 100_000_000;
                    sk.biayaBuild += unitCost;
                    sk.details.push({
                        type: 'build', name: snp.judulPembangunan || `Pembangunan ${snp.jenisPrasarana}`,
                        count: 1, unitCost, totalCost: unitCost
                    });
                }
            });

            gTotRS += sk.biayaRS;
            gTotRB += sk.biayaRB;
            gTotBuild += sk.biayaBuild;
        });

        const allData = Object.values(sekolahMap);
        // Sort by total anggaran (largest first)
        allData.sort((a, b) => (b.biayaRS + b.biayaRB + b.biayaBuild) - (a.biayaRS + a.biayaRB + a.biayaBuild));

        return {
            rekapData: allData,
            globalStats: { totalRS: gTotRS, totalRB: gTotRB, totalBuild: gTotBuild, grandTotal: gTotRS + gTotRB + gTotBuild }
        };
    }, [anggaranData, proyeksiList, snpData, sekolahList, sarprasList]);

    // =========================================================================
    // FILTER LOGIC
    // =========================================================================

    // Filter untuk Tab Rekap (Semua)
    const filteredRekapData = useMemo(() => {
        return rekapData.filter(item => {
            const matchJenjang = filterJenjang === 'all' || item.jenjang === filterJenjang;
            const q = searchQuery.toLowerCase();
            const matchSearch = searchQuery === '' || item.nama.toLowerCase().includes(q) || (Array.isArray(sekolahKeterangan[item.id]) ? sekolahKeterangan[item.id].join(' ').toLowerCase().includes(q) : '');
            return matchJenjang && matchSearch;
        });
    }, [rekapData, filterJenjang, searchQuery, sekolahKeterangan]);

    // Filter untuk Tab Baru: Belum Masuk Usulan
    // Kriteria: Total Anggaran > 0 DAN (Usulan kosong / array kosong)
    const filteredBelumUsulan = useMemo(() => {
        return rekapData.filter(item => {
            const totalAnggaran = item.biayaRS + item.biayaRB + item.biayaBuild;
            const usulan = sekolahKeterangan[item.id];
            const isBelumUsul = !usulan || !Array.isArray(usulan) || usulan.length === 0;

            const matchJenjang = filterJenjang === 'all' || item.jenjang === filterJenjang;
            const matchSearch = searchQuery === '' || item.nama.toLowerCase().includes(searchQuery.toLowerCase());

            return totalAnggaran > 0 && isBelumUsul && matchJenjang && matchSearch;
        });
    }, [rekapData, sekolahKeterangan, filterJenjang, searchQuery]);

    // Filter untuk Tab Baru: Rekapitulasi Usulan
    // Kriteria: Total Anggaran > 0 DAN punya >= 1 usulan, sorted by jumlah terbanyak
    const filteredRekapUsulan = useMemo(() => {
        return rekapData.filter(item => {
            const totalAnggaran = item.biayaRS + item.biayaRB + item.biayaBuild;
            const usulan = sekolahKeterangan[item.id];
            const hasUsulan = Array.isArray(usulan) && usulan.length > 0;

            const matchJenjang = filterJenjang === 'all' || item.jenjang === filterJenjang;
            const matchSearch = searchQuery === '' || item.nama.toLowerCase().includes(searchQuery.toLowerCase());

            return totalAnggaran > 0 && hasUsulan && matchJenjang && matchSearch;
        }).sort((a, b) => {
            const cntA = (sekolahKeterangan[a.id] || []).length;
            const cntB = (sekolahKeterangan[b.id] || []).length;
            return cntB - cntA;
        });
    }, [rekapData, sekolahKeterangan, filterJenjang, searchQuery]);


    // =========================================================================
    // REKAP SNP: Sekolah yang sudah & belum memenuhi SNP
    // =========================================================================
    const snpRekapData = useMemo(() => {
        try {
            if (!snpData?.length || !sekolahList?.length || !Array.isArray(sarprasList)) return [];
            return sekolahList.map(sk => {
                const snpForJenjang = snpData.filter(s => s.jenjang === sk.jenjang);
                if (!snpForJenjang.length) return null;
                const items = snpForJenjang.map(snp => {
                    const count = (sarprasList || []).filter(sp => sp.sekolahId === sk.id && sp.jenisPrasarana === snp.jenisPrasarana).length;
                    return { jenisPrasarana: snp.jenisPrasarana, required: true, owned: count, met: count > 0 };
                });
                const met = items.filter(i => i.met).length;
                const total = items.length;
                const pct = total > 0 ? Math.round((met / total) * 100) : 0;
                return { ...sk, snpItems: items, snpMet: met, snpTotal: total, snpPct: pct, snpComplete: pct === 100 };
            }).filter(Boolean);
        } catch (e) { console.error('snpRekapData error:', e); return []; }
    }, [snpData, sekolahList, sarprasList]);

    const [snpRekapFilter, setSnpRekapFilter] = useState('all'); // all | lengkap | belum
    const filteredSnpRekap = useMemo(() => {
        return snpRekapData.filter(item => {
            const matchJenjang = filterJenjang === 'all' || item.jenjang === filterJenjang;
            const matchSearch = searchQuery === '' || item.nama.toLowerCase().includes(searchQuery.toLowerCase());
            const matchStatus = snpRekapFilter === 'all' || (snpRekapFilter === 'lengkap' ? item.snpComplete : !item.snpComplete);
            return matchJenjang && matchSearch && matchStatus;
        }).sort((a, b) => a.snpPct - b.snpPct);
    }, [snpRekapData, filterJenjang, searchQuery, snpRekapFilter]);

    const snpRekapStats = useMemo(() => {
        const total = filteredSnpRekap.length;
        const lengkap = filteredSnpRekap.filter(s => s.snpComplete).length;
        return { total, lengkap, belum: total - lengkap };
    }, [filteredSnpRekap]);

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

    // 4. Belum Usulan
    const totalBelumUsul = filteredBelumUsulan.length;
    const totalPagesBelumUsul = Math.ceil(totalBelumUsul / pageSize) || 1;
    const pagedBelumUsulan = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredBelumUsulan.slice(start, start + pageSize);
    }, [filteredBelumUsulan, currentPage, pageSize]);

    // 5. Rekap SNP
    const totalSnpRekap = filteredSnpRekap.length;
    const totalPagesSnpRekap = Math.ceil(totalSnpRekap / pageSize) || 1;
    const pagedSnpRekap = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredSnpRekap.slice(start, start + pageSize);
    }, [filteredSnpRekap, currentPage, pageSize]);

    // 6. Rekap Usulan
    const totalRekapUsulan = filteredRekapUsulan.length;
    const totalPagesRekapUsulan = Math.ceil(totalRekapUsulan / pageSize) || 1;
    const pagedRekapUsulan = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRekapUsulan.slice(start, start + pageSize);
    }, [filteredRekapUsulan, currentPage, pageSize]);


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

    const keteranganTimerRef = useRef(null);
    const saveUsulan = (sekolahId, arr) => {
        setSekolahKeterangan(prev => ({ ...prev, [sekolahId]: arr }));
        if (keteranganTimerRef.current) clearTimeout(keteranganTimerRef.current);
        keteranganTimerRef.current = setTimeout(() => {
            proyeksiApi.saveKeterangan({ [sekolahId]: JSON.stringify(arr) }).catch(() => {
                toast.error('Gagal menyimpan usulan');
            });
        }, 400);
    };
    const addUsulan = (sekolahId, value) => {
        if (!value.trim()) return;
        const current = Array.isArray(sekolahKeterangan[sekolahId]) ? [...sekolahKeterangan[sekolahId]] : [];
        if (!current.includes(value.trim())) {
            current.push(value.trim());
            saveUsulan(sekolahId, current);
        }
    };
    const removeUsulan = (sekolahId, idx) => {
        const current = Array.isArray(sekolahKeterangan[sekolahId]) ? [...sekolahKeterangan[sekolahId]] : [];
        current.splice(idx, 1);
        saveUsulan(sekolahId, current);
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
        setDeleteConfirm({ type, id });
    };

    const executeDelete = async () => {
        if (!deleteConfirm) return;
        const { type, id } = deleteConfirm;
        try {
            if (type === 'anggaran') { await proyeksiApi.deleteAnggaran(id); setAnggaranData(prev => prev.filter(d => d.id !== id)); }
            else { await proyeksiApi.deleteSnp(id); refetchSnp(); }
            toast.success('Data dihapus');
        } catch (err) { toast.error(err.message || 'Gagal menghapus'); }
        setDeleteConfirm(null);
    };

    // ===== EXPORT FUNCTIONS =====
    const handleExportExcel = async (dataset, title = 'Rekapitulasi') => {
        try {
            const XLSX = await import('xlsx');
            const rows = [];
            dataset.forEach((s, i) => {
                rows.push({
                    'No': i + 1,
                    'Nama Sekolah': s.nama,
                    'Jenjang': s.jenjang,
                    'Rincian': '',
                    'Total Rehab': s.biayaRS + s.biayaRB,
                    'Total Pembangunan': s.biayaBuild,
                    'Total Anggaran': s.biayaRS + s.biayaRB + s.biayaBuild,
                });
                if (s.details?.length) {
                    s.details.forEach(d => {
                        const label = d.type === 'rehab' ? `[REHAB] ${d.name}` : `[BANGUN] ${d.name}`;
                        rows.push({
                            'No': '',
                            'Nama Sekolah': '',
                            'Jenjang': '',
                            'Rincian': `${label} (${d.count} Unit)`,
                            'Total Rehab': d.type === 'rehab' ? d.totalCost : '',
                            'Total Pembangunan': d.type === 'build' ? d.totalCost : '',
                            'Total Anggaran': d.totalCost,
                        });
                    });
                }
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 8 }, { wch: 45 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31));
            XLSX.writeFile(wb, `${title.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
            toast.success('Excel berhasil diunduh');
        } catch (err) {
            console.error('Excel export error:', err);
            toast.error('Gagal membuat Excel: ' + (err.message || ''));
        }
    };

    const handleExportPDF = async (dataset, title = 'Rekapitulasi') => {
        try {
            const jsPDFModule = await import('jspdf');
            const autoTableModule = await import('jspdf-autotable');
            const jsPDFClass = jsPDFModule.default;
            const autoTable = autoTableModule.default;
            const doc = new jsPDFClass({ orientation: 'landscape' });
            doc.setFontSize(14);
            doc.text(title.replace(/_/g, ' '), 14, 15);
            doc.setFontSize(9);
            doc.text(`Diekspor: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);
            const rows = [];
            dataset.forEach((s, i) => {
                rows.push([
                    { content: i + 1, styles: { fontStyle: 'bold' } },
                    s.nama,
                    s.jenjang,
                    '',
                    formatCurrency(s.biayaRS + s.biayaRB),
                    formatCurrency(s.biayaBuild),
                    formatCurrency(s.biayaRS + s.biayaRB + s.biayaBuild),
                ]);
                if (s.details?.length) {
                    s.details.forEach(d => {
                        const label = d.type === 'rehab' ? `[REHAB] ${d.name}` : `[BANGUN] ${d.name}`;
                        rows.push([
                            '', '', '',
                            `${label} (${d.count} Unit)`,
                            d.type === 'rehab' ? formatCurrency(d.totalCost) : '',
                            d.type === 'build' ? formatCurrency(d.totalCost) : '',
                            formatCurrency(d.totalCost),
                        ]);
                    });
                }
            });
            autoTable(doc, {
                startY: 26,
                head: [['No', 'Nama Sekolah', 'Jenjang', 'Rincian Kebutuhan', 'Total Rehab', 'Total Pembangunan', 'Total Anggaran']],
                body: rows,
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { cellWidth: 45 },
                    2: { cellWidth: 15 },
                    3: { cellWidth: 70 },
                    4: { cellWidth: 30, halign: 'right' },
                    5: { cellWidth: 30, halign: 'right' },
                    6: { cellWidth: 35, halign: 'right' },
                },
            });
            doc.save(`${title.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
            toast.success('PDF berhasil diunduh');
        } catch (err) {
            console.error('PDF export error:', err);
            toast.error('Gagal membuat PDF: ' + (err.message || ''));
        }
    };


    // ===== EXPORT: Atur Anggaran =====
    const handleExportAnggaran = async () => {
        try {
            const XLSX = await import('xlsx');
            const rows = anggaranData.map((item, i) => ({
                'No': i + 1,
                'Jenis Prasarana': item.jenisPrasarana,
                'Jenjang': item.jenjang,
                'Rusak Sedang': item.rusakSedang || 0,
                'Rusak Berat': item.rusakBerat || 0,
                'Pembangunan': item.pembangunan || 0,
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Atur Anggaran');
            XLSX.writeFile(wb, `Atur_Anggaran_${new Date().toISOString().slice(0,10)}.xlsx`);
            toast.success('Excel Atur Anggaran berhasil diunduh');
        } catch (err) { toast.error('Gagal ekspor: ' + (err.message || '')); }
    };

    // ===== EXPORT: Belum Usul =====
    const handleExportBelumUsul = async () => {
        try {
            const XLSX = await import('xlsx');
            const rows = [];
            filteredBelumUsulan.forEach((s, i) => {
                rows.push({ 'No': i + 1, 'Nama Sekolah': s.nama, 'Jenjang': s.jenjang, 'Rincian': '', 'Total Rehab': s.biayaRS + s.biayaRB, 'Total Pembangunan': s.biayaBuild, 'Total Anggaran': s.biayaRS + s.biayaRB + s.biayaBuild });
                if (s.details?.length) {
                    s.details.forEach(d => {
                        const label = d.type === 'rehab' ? `[REHAB] ${d.name}` : `[BANGUN] ${d.name}`;
                        rows.push({ 'No': '', 'Nama Sekolah': '', 'Jenjang': '', 'Rincian': `${label} (${d.count} Unit)`, 'Total Rehab': d.type === 'rehab' ? d.totalCost : '', 'Total Pembangunan': d.type === 'build' ? d.totalCost : '', 'Total Anggaran': d.totalCost });
                    });
                }
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 8 }, { wch: 45 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Belum Usul');
            XLSX.writeFile(wb, `Belum_Usul_${new Date().toISOString().slice(0,10)}.xlsx`);
            toast.success('Excel Belum Usul berhasil diunduh');
        } catch (err) { toast.error('Gagal ekspor: ' + (err.message || '')); }
    };

    // ===== EXPORT: Rekap Usulan =====
    const handleExportRekapUsulan = async () => {
        try {
            const XLSX = await import('xlsx');
            const rows = [];
            filteredRekapUsulan.forEach((s, i) => {
                const usulan = sekolahKeterangan[s.id] || [];
                rows.push({ 'No': i + 1, 'Nama Sekolah': s.nama, 'Jenjang': s.jenjang, 'Jumlah Usulan': usulan.length, 'Usulan': usulan.map((u, idx) => `${idx + 1}. ${u}`).join('\n'), 'Total Rehab': s.biayaRS + s.biayaRB, 'Total Pembangunan': s.biayaBuild, 'Total Anggaran': s.biayaRS + s.biayaRB + s.biayaBuild });
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 8 }, { wch: 12 }, { wch: 50 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Rekap Usulan');
            XLSX.writeFile(wb, `Rekap_Usulan_${new Date().toISOString().slice(0,10)}.xlsx`);
            toast.success('Excel Rekap Usulan berhasil diunduh');
        } catch (err) { toast.error('Gagal ekspor: ' + (err.message || '')); }
    };

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

    // Reusable Table Body Renderer (Rekapitulasi — no keterangan column)
    const renderRekapTableBody = (dataset) => {
        if (dataset.length === 0) {
            return (
                <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
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
            const totalBuild = s.biayaBuild;
            const totalAnggaran = totalRehab + totalBuild;
            return (
                <React.Fragment key={s.id}>
                    <tr onClick={() => toggleRow(s.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td>{rowNumber}</td>
                        <td>
                            <div style={{ fontWeight: 500 }}>{s.nama}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{s.jenjang}</div>
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
                        <tr>
                            <td colSpan={6} style={{ padding: 0, background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
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
                </React.Fragment>
            );
        });
    };

    // Helper to render chip input with correct props
    const renderChipInput = (sekolahId) => {
        const chips = Array.isArray(sekolahKeterangan[sekolahId]) ? sekolahKeterangan[sekolahId] : [];
        return <UsulanChipInput chips={chips} onAdd={(val) => addUsulan(sekolahId, val)} onRemove={(idx) => removeUsulan(sekolahId, idx)} />;
    };

    // Belum Usul table body with chip input
    const renderBelumUsulTableBody = (dataset) => {
        if (dataset.length === 0) {
            return (
                <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={24} />
                            <span>Semua sekolah sudah memiliki usulan. 🎉</span>
                        </div>
                    </td>
                </tr>
            );
        }
        return dataset.map((s, i) => {
            const rowNumber = ((currentPage - 1) * pageSize) + i + 1;
            const isExpanded = expandedRows.includes(s.id);
            const totalRehab = s.biayaRS + s.biayaRB;
            const totalBuild = s.biayaBuild;
            const totalAnggaran = totalRehab + totalBuild;
            return (
                <React.Fragment key={s.id}>
                    <tr onClick={() => toggleRow(s.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td>{rowNumber}</td>
                        <td>
                            <div style={{ fontWeight: 500 }}>{s.nama}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{s.jenjang}</div>
                        </td>
                        <td style={{ background: 'rgba(249, 115, 22, 0.05)', borderLeft: '3px solid var(--accent-orange)' }}>
                            {isAdmin ? renderChipInput(s.id) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {(Array.isArray(sekolahKeterangan[s.id]) ? sekolahKeterangan[s.id] : []).map((c, idx) => (
                                        <span key={idx} style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: '0.78rem' }}>{idx + 1}. {c}</span>
                                    ))}
                                </div>
                            )}
                        </td>
                        <td style={{ color: totalRehab > 0 ? 'var(--accent-orange)' : 'var(--text-secondary)', textAlign: 'right', fontWeight: 500 }}>
                            {totalRehab > 0 ? formatCurrency(totalRehab) : '-'}
                        </td>
                        <td style={{ fontWeight: 700, background: 'var(--bg-secondary)', textAlign: 'right', color: 'var(--text-primary)' }}>
                            {formatCurrency(totalAnggaran)}
                        </td>
                    </tr>
                    {isExpanded && (
                        <tr>
                            <td colSpan={6} style={{ padding: 0, background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                                <div style={{ padding: '1rem 1.5rem' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Rincian Kebutuhan</div>
                                    {s.details.length === 0 ? (
                                        <div style={{ color: 'var(--text-secondary)' }}>Tidak ada kebutuhan.</div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                                            {s.details.map((d, idx) => {
                                                let itemColor = 'var(--accent-blue)', labelBg = 'rgba(59,130,246,0.1)', labelText = 'BANGUN';
                                                if (d.type === 'rehab') {
                                                    if (d.kondisi === 'berat') { itemColor = 'var(--accent-red)'; labelBg = 'rgba(239,68,68,0.1)'; }
                                                    else { itemColor = 'var(--accent-orange)'; labelBg = 'rgba(249,115,22,0.1)'; }
                                                    labelText = 'REHAB';
                                                }
                                                return (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: labelBg, color: itemColor }}>{labelText}</span>
                                                            <span>{d.name}</span>
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
                </React.Fragment>
            );
        });
    };

    // Rekap Usulan table body with expandable usulan list
    const renderRekapUsulanTableBody = (dataset) => {
        if (dataset.length === 0) {
            return (
                <tr>
                    <td colSpan={visibleColCount} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={24} />
                            <span>Belum ada sekolah yang memiliki usulan.</span>
                        </div>
                    </td>
                </tr>
            );
        }
        return dataset.map((s, i) => {
            const rowNumber = ((currentPage - 1) * pageSize) + i + 1;
            const isExpanded = expandedRows.includes(s.id);
            const totalRehab = s.biayaRS + s.biayaRB;
            const totalBuild = s.biayaBuild;
            const totalAnggaran = totalRehab + totalBuild;
            const chips = Array.isArray(sekolahKeterangan[s.id]) ? sekolahKeterangan[s.id] : [];
            return (
                <React.Fragment key={s.id}>
                    <tr onClick={() => toggleRow(s.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td>{rowNumber}</td>
                        <td>
                            <div style={{ fontWeight: 500 }}>{s.nama}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{s.jenjang}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, borderRadius: '50%', background: chips.length >= 3 ? 'rgba(34,197,94,0.15)' : chips.length >= 2 ? 'rgba(59,130,246,0.15)' : 'rgba(249,115,22,0.15)', color: chips.length >= 3 ? '#22c55e' : chips.length >= 2 ? '#3b82f6' : '#f59e0b', fontWeight: 700, fontSize: '0.85rem' }}>
                                {chips.length}
                            </span>
                        </td>
                        <td style={{ background: 'rgba(139,92,246,0.05)', borderLeft: '3px solid var(--accent-purple)', minWidth: 220 }}>
                            {isAdmin ? renderChipInput(s.id) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 32 }}>
                                    {chips.map((c, idx) => (
                                        <span key={idx} style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: '0.78rem', fontWeight: 500 }}>{idx + 1}. {c}</span>
                                    ))}
                                    {chips.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>-</span>}
                                </div>
                            )}
                        </td>
                        {rekapUsulanCols.totalRehab && (
                        <td style={{ color: totalRehab > 0 ? 'var(--accent-orange)' : 'var(--text-secondary)', textAlign: 'right', fontWeight: 500 }}>
                            {totalRehab > 0 ? formatCurrency(totalRehab) : '-'}
                        </td>
                        )}
                        {rekapUsulanCols.totalPembangunan && (
                        <td style={{ color: totalBuild > 0 ? 'var(--accent-blue)' : 'var(--text-secondary)', textAlign: 'right', fontWeight: 500 }}>
                            {totalBuild > 0 ? formatCurrency(totalBuild) : '-'}
                        </td>
                        )}
                        {rekapUsulanCols.totalAnggaran && (
                        <td style={{ fontWeight: 700, background: 'var(--bg-secondary)', textAlign: 'right', color: 'var(--text-primary)' }}>
                            {formatCurrency(totalAnggaran)}
                        </td>
                        )}
                    </tr>
                    {isExpanded && (
                        <tr>
                            <td colSpan={visibleColCount} style={{ padding: 0, background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                                <div style={{ padding: '1rem 1.5rem' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent-purple)' }}>?? Daftar Usulan ({chips.length})</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                                        {chips.map((c, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', borderLeft: '3px solid rgba(139,92,246,0.4)' }}>
                                                <span style={{ color: '#a78bfa', fontWeight: 600, fontSize: '0.82rem', minWidth: 20 }}>{idx + 1}.</span>
                                                <span style={{ color: '#a78bfa', fontSize: '0.82rem', fontWeight: 500, flex: 1 }}>{c}</span>
                                                {isAdmin && <button onClick={(e) => { e.stopPropagation(); removeUsulan(s.id, idx); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1 }}>�</button>}
                                            </div>
                                        ))}
                                    </div>
                                    {isAdmin && (
                                    <div onClick={e => e.stopPropagation()} style={{ marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                                        {renderChipInput(s.id)}
                                    </div>
                                    )}
                                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>?? Rincian Kebutuhan</div>
                                    {s.details.length === 0 ? (
                                        <div style={{ color: 'var(--text-secondary)' }}>Tidak ada kebutuhan.</div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                                            {s.details.map((d, idx) => {
                                                let itemColor = 'var(--accent-blue)', labelBg = 'rgba(59,130,246,0.1)', labelText = 'BANGUN';
                                                if (d.type === 'rehab') {
                                                    if (d.kondisi === 'berat') { itemColor = 'var(--accent-red)'; labelBg = 'rgba(239,68,68,0.1)'; }
                                                    else { itemColor = 'var(--accent-orange)'; labelBg = 'rgba(249,115,22,0.1)'; }
                                                    labelText = 'REHAB';
                                                }
                                                return (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: labelBg, color: itemColor }}>{labelText}</span>
                                                            <span>{d.name}</span>
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
                </React.Fragment>
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
                <div ref={exportRef} style={{ position: 'relative' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowExportMenu(!showExportMenu)}><Download size={14} /> Ekspor</button>
                    {showExportMenu && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 50, minWidth: 160, overflow: 'hidden' }}>
                            <button onClick={() => { handleExportExcel(filteredRekapData, 'Rekapitulasi_Anggaran'); setShowExportMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left' }} onMouseOver={e => e.target.style.background='var(--bg-secondary)'} onMouseOut={e => e.target.style.background='none'}>
                                <FileSpreadsheet size={16} style={{ color: '#22c55e' }} /> Excel (.xlsx)
                            </button>
                            <button onClick={() => { handleExportPDF(filteredRekapData, 'Rekapitulasi_Anggaran'); setShowExportMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left' }} onMouseOver={e => e.target.style.background='var(--bg-secondary)'} onMouseOut={e => e.target.style.background='none'}>
                                <FileText size={16} style={{ color: '#ef4444' }} /> PDF (.pdf)
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ fontSize: '0.875rem' }}>
            <div className="page-header">
                <div className="page-header-left"><h1>Proyeksi Anggaran</h1><p>Kalkulasi otomatis kebutuhan anggaran berdasarkan kondisi & SNP</p></div>
            </div>

            <div className="keranjang-tabs" style={{ maxWidth: '56rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <button className={`keranjang-tab ${tab === 'anggaran' ? 'active' : ''}`} onClick={() => setTab('anggaran')}>Atur Anggaran</button>
                <button className={`keranjang-tab ${tab === 'rekap' ? 'active' : ''}`} onClick={() => setTab('rekap')}>Rekapitulasi</button>
                <button className={`keranjang-tab ${tab === 'belum-usul' ? 'active' : ''}`} onClick={() => setTab('belum-usul')}>
                    Belum Usul
                    {filteredBelumUsulan.length > 0 && (
                        <span style={{ marginLeft: '6px', background: 'var(--accent-red)', color: 'white', borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 600 }}>
                            {filteredBelumUsulan.length > 999 ? '999+' : filteredBelumUsulan.length}
                        </span>
                    )}
                </button>
                <button className={`keranjang-tab ${tab === 'rekap-usulan' ? 'active' : ''}`} onClick={() => setTab('rekap-usulan')}>
                    Rekap Usulan
                    {filteredRekapUsulan.length > 0 && (
                        <span style={{ marginLeft: '6px', background: 'rgba(139,92,246,0.8)', color: 'white', borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 600 }}>
                            {filteredRekapUsulan.length}
                        </span>
                    )}
                </button>
                <button className={`keranjang-tab ${tab === 'snp' ? 'active' : ''}`} onClick={() => setTab('snp')}>SNP (Acuan)</button>
                <button className={`keranjang-tab ${tab === 'rekap-snp' ? 'active' : ''}`} onClick={() => setTab('rekap-snp')}>Rekap SNP</button>
            </div>

            {/* TAB 1: ATUR ANGGARAN */}
            {tab === 'anggaran' && (
                <div className="table-container">
                    <div className="table-toolbar">
                        <div className="table-toolbar-left">
                            {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => openModal('anggaran')}><Plus size={14} /> Tambah</button>}
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
                            <button className="btn btn-secondary btn-sm" onClick={handleExportAnggaran}><Download size={14} /> Ekspor</button>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead><tr><th>No</th><th>Jenis Prasarana</th><th>Jenjang</th><th style={{ textAlign: 'right' }}>Rusak Sedang</th><th style={{ textAlign: 'right' }}>Rusak Berat</th><th style={{ textAlign: 'right' }}>Pembangunan</th>{isAdmin && <th>Aksi</th>}</tr></thead>
                            <tbody>
                                {pagedAnggaran.map((item, i) => (
                                    <tr key={item.id}>
                                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                        <td>{item.jenisPrasarana}</td>
                                        <td>{item.jenjang}</td>
                                        <td style={{ color: 'var(--accent-orange)', textAlign: 'right' }}>{formatCurrency(item.rusakSedang)}</td>
                                        <td style={{ color: 'var(--accent-red)', textAlign: 'right' }}>{formatCurrency(item.rusakBerat)}</td>
                                        <td style={{ color: 'var(--accent-blue)', textAlign: 'right' }}>{formatCurrency(item.pembangunan)}</td>
                                        {isAdmin && <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-icon" onClick={() => openModal('anggaran', item)}><Edit size={16} /></button>
                                                <button className="btn-icon" onClick={() => handleDelete('anggaran', item.id)} style={{ color: 'var(--accent-red)' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>}
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
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><HardHat size={16} style={{ marginRight: 6, color: 'var(--accent-orange)' }} /> Total Rehab Sedang {filterJenjang !== 'all' ? `(${filterJenjang})` : ''}</div>
                            <div className="stat-value" style={{ color: 'var(--accent-orange)', fontSize: '1rem' }}>{formatCurrency(filteredRekapData.reduce((s, d) => s + (d.biayaRS || 0), 0))}</div>
                        </div>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-red)' }}>
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><Hammer size={16} style={{ marginRight: 6, color: 'var(--accent-red)' }} /> Total Rehab Berat {filterJenjang !== 'all' ? `(${filterJenjang})` : ''}</div>
                            <div className="stat-value" style={{ color: 'var(--accent-red)', fontSize: '1rem' }}>{formatCurrency(filteredRekapData.reduce((s, d) => s + (d.biayaRB || 0), 0))}</div>
                        </div>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><Building2 size={16} style={{ marginRight: 6, color: 'var(--accent-blue)' }} /> Total Pembangunan {filterJenjang !== 'all' ? `(${filterJenjang})` : ''}</div>
                            <div className="stat-value" style={{ color: 'var(--accent-blue)', fontSize: '1rem' }}>{formatCurrency(filteredRekapData.reduce((s, d) => s + (d.biayaBuild || 0), 0))}</div>
                        </div>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><Wallet size={16} style={{ marginRight: 6, color: 'var(--accent-green)' }} /> Grand Total {filterJenjang !== 'all' ? `(${filterJenjang})` : ''}</div>
                            <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: '1rem' }}>{formatCurrency(filteredRekapData.reduce((s, d) => s + (d.biayaRS || 0) + (d.biayaRB || 0) + (d.biayaBuild || 0), 0))}</div>
                        </div>
                    </div>

                    {/* Column filter toggle */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', position: 'relative' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowColFilter(!showColFilter)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Columns size={14} /> Kolom
                        </button>
                        {showColFilter && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem', zIndex: 20, minWidth: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                {[{ key: 'totalRehab', label: 'Total Rehab' }, { key: 'totalPembangunan', label: 'Total Pembangunan' }, { key: 'totalAnggaran', label: 'Total Anggaran' }].map(col => (
                                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 6, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                        {rekapUsulanCols[col.key] ? <Eye size={14} style={{ color: 'var(--accent-green)' }} /> : <EyeOff size={14} style={{ color: 'var(--text-secondary)' }} />}
                                        <span>{col.label}</span>
                                        <input type="checkbox" checked={rekapUsulanCols[col.key]} onChange={() => toggleCol(col.key)} style={{ marginLeft: 'auto', accentColor: 'var(--accent-purple)' }} />
                                    </label>
                                ))}
                            </div>
                        )}
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
                                        <th style={{ width: 150, textAlign: 'right' }}>Total Rehab</th>
                                        <th style={{ width: 150, textAlign: 'right' }}>Total Pembangunan</th>
                                        <th style={{ width: 170, textAlign: 'right', background: 'var(--bg-secondary)' }}>Total Anggaran</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderRekapTableBody(pagedRekap)}
                                </tbody>
                            </table>
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
                            <strong>Perhatian:</strong> Tabel ini menampilkan sekolah yang memiliki kebutuhan anggaran tetapi belum memiliki usulan. Ketik usulan lalu tekan Enter untuk menambahkan.
                        </div>
                    </div>

                    {/* Column filter toggle */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', position: 'relative' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowColFilter(!showColFilter)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Columns size={14} /> Kolom
                        </button>
                        {showColFilter && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem', zIndex: 20, minWidth: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                {[{ key: 'totalRehab', label: 'Total Rehab' }, { key: 'totalPembangunan', label: 'Total Pembangunan' }, { key: 'totalAnggaran', label: 'Total Anggaran' }].map(col => (
                                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 6, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                        {rekapUsulanCols[col.key] ? <Eye size={14} style={{ color: 'var(--accent-green)' }} /> : <EyeOff size={14} style={{ color: 'var(--text-secondary)' }} />}
                                        <span>{col.label}</span>
                                        <input type="checkbox" checked={rekapUsulanCols[col.key]} onChange={() => toggleCol(col.key)} style={{ marginLeft: 'auto', accentColor: 'var(--accent-purple)' }} />
                                    </label>
                                ))}
                            </div>
                        )}
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
                                        <th style={{ minWidth: 250, background: 'rgba(249, 115, 22, 0.1)', borderLeft: '3px solid var(--accent-orange)' }}>Tambah Usulan</th>
                                        <th style={{ width: 150, textAlign: 'right' }}>Total Rehab</th>
                                        <th style={{ width: 170, textAlign: 'right', background: 'var(--bg-secondary)' }}>Total Anggaran</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderBelumUsulTableBody(pagedBelumUsulan)}
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
                            {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => openModal('snp')}><Plus size={14} /> Tambah</button>}
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
                            <thead><tr><th>No</th><th>Jenis Prasarana</th><th>Jenjang</th><th>Judul Rehabilitasi</th><th>Judul Pembangunan</th>{isAdmin && <th>Aksi</th>}</tr></thead>
                            <tbody>
                                {pagedSnp.map((item, i) => (
                                    <tr key={item.id}>
                                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                        <td>{item.jenisPrasarana}</td>
                                        <td>{item.jenjang}</td>
                                        <td>{item.judulRehabilitasi}</td>
                                        <td>{item.judulPembangunan}</td>
                                        {isAdmin && <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-icon" onClick={() => openModal('snp', item)}><Edit size={16} /></button>
                                                <button className="btn-icon" onClick={() => handleDelete('snp', item.id)} style={{ color: 'var(--accent-red)' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls totalPages={totalPagesSnp} totalItems={totalSnp} tableName="snp" />
                </div>
            )}

            {/* TAB 5: REKAP SNP */}
            {tab === 'rekap-snp' && (
                <div>
                    {/* Jenjang Tab Pills */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                        {['all', ...JENJANG].map(j => (
                            <button key={j} onClick={() => setFilterJenjang(j)}
                                style={{
                                    padding: '6px 18px', borderRadius: 20, fontWeight: 600, fontSize: '0.82rem',
                                    border: filterJenjang === j ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                                    background: filterJenjang === j ? 'rgba(59,130,246,0.12)' : 'var(--bg-secondary)',
                                    color: filterJenjang === j ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}>
                                {j === 'all' ? '🏫 Semua Jenjang' : j}
                            </button>
                        ))}
                    </div>

                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                        <div className="table-container" style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: snpRekapFilter === 'all' ? '2px solid var(--accent-blue)' : undefined, position: 'relative', overflow: 'hidden' }} onClick={() => setSnpRekapFilter('all')}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))' }} />
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Total Sekolah {filterJenjang !== 'all' ? `(${filterJenjang})` : ''}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{snpRekapStats.total}</div>
                        </div>
                        <div className="table-container" style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: snpRekapFilter === 'lengkap' ? '2px solid #22c55e' : undefined, position: 'relative', overflow: 'hidden' }} onClick={() => setSnpRekapFilter('lengkap')}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #22c55e, #10b981)' }} />
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>✅ Sudah Lengkap SNP</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#22c55e' }}>{snpRekapStats.lengkap}</div>
                            {snpRekapStats.total > 0 && <div style={{ fontSize: '0.72rem', color: '#22c55e', marginTop: 2 }}>{((snpRekapStats.lengkap / snpRekapStats.total) * 100).toFixed(1)}%</div>}
                        </div>
                        <div className="table-container" style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: snpRekapFilter === 'belum' ? '2px solid var(--accent-red)' : undefined, position: 'relative', overflow: 'hidden' }} onClick={() => setSnpRekapFilter('belum')}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>❌ Belum Lengkap SNP</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-red)' }}>{snpRekapStats.belum}</div>
                            {snpRekapStats.total > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--accent-red)', marginTop: 2 }}>{((snpRekapStats.belum / snpRekapStats.total) * 100).toFixed(1)}%</div>}
                        </div>
                    </div>

                    {/* Column filter toggle */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', position: 'relative' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowColFilter(!showColFilter)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Columns size={14} /> Kolom
                        </button>
                        {showColFilter && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem', zIndex: 20, minWidth: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                {[{ key: 'totalRehab', label: 'Total Rehab' }, { key: 'totalPembangunan', label: 'Total Pembangunan' }, { key: 'totalAnggaran', label: 'Total Anggaran' }].map(col => (
                                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 6, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                        {rekapUsulanCols[col.key] ? <Eye size={14} style={{ color: 'var(--accent-green)' }} /> : <EyeOff size={14} style={{ color: 'var(--text-secondary)' }} />}
                                        <span>{col.label}</span>
                                        <input type="checkbox" checked={rekapUsulanCols[col.key]} onChange={() => toggleCol(col.key)} style={{ marginLeft: 'auto', accentColor: 'var(--accent-purple)' }} />
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="table-container">
                        <div className="table-toolbar">
                            <div className="table-toolbar-left">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Tampil:</span>
                                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
                                        <option value="10">10</option><option value="15">15</option><option value="50">50</option><option value="100">100</option>
                                    </select>
                                </div>
                            </div>
                            <div className="table-toolbar-right">
                                <div className="search-box" style={{ maxWidth: 240 }}>
                                    <Search size={14} />
                                    <input placeholder="Cari sekolah..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                </div>
                                <select value={filterJenjang} onChange={(e) => setFilterJenjang(e.target.value)} style={{ padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                                    <option value="all">Semua Jenjang</option>
                                    {JENJANG.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}>No</th>
                                        <th>Nama Sekolah</th>
                                        <th>NPSN</th>
                                        <th>Jenjang</th>
                                        {snpData.filter((s, i, arr) => arr.findIndex(x => x.jenisPrasarana === s.jenisPrasarana) === i).map(s => (
                                            <th key={s.jenisPrasarana} style={{ textAlign: 'center', fontSize: '0.72rem', minWidth: 70 }}>{s.jenisPrasarana}</th>
                                        ))}
                                        <th style={{ textAlign: 'center' }}>Pemenuhan</th>
                                        <th style={{ textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedSnpRekap.map((sk, i) => (
                                        <tr key={sk.id}>
                                            <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                            <td style={{ fontWeight: 500 }}>{sk.nama}</td>
                                            <td>{sk.npsn}</td>
                                            <td><span className="status-badge" style={{ background: 'var(--bg-secondary)' }}>{sk.jenjang}</span></td>
                                            {snpData.filter((s, idx, arr) => arr.findIndex(x => x.jenisPrasarana === s.jenisPrasarana) === idx).map(snpItem => {
                                                const match = sk.snpItems?.find(si => si.jenisPrasarana === snpItem.jenisPrasarana);
                                                const required = snpData.some(s => s.jenisPrasarana === snpItem.jenisPrasarana && s.jenjang === sk.jenjang);
                                                if (!required) return <td key={snpItem.jenisPrasarana} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>—</td>;
                                                return (
                                                    <td key={snpItem.jenisPrasarana} style={{ textAlign: 'center' }}>
                                                        {match?.met
                                                            ? <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem' }}>✓ {match.owned}</span>
                                                            : <span style={{ color: 'var(--accent-red)', fontWeight: 700, fontSize: '0.9rem' }}>✗</span>
                                                        }
                                                    </td>
                                                );
                                            })}
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                                    <div style={{ width: 50, height: 6, borderRadius: 4, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                                                        <div style={{ width: `${sk.snpPct}%`, height: '100%', borderRadius: 4, background: sk.snpPct === 100 ? '#22c55e' : sk.snpPct >= 50 ? '#f59e0b' : 'var(--accent-red)', transition: '0.3s' }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: sk.snpPct === 100 ? '#22c55e' : 'var(--text-primary)' }}>{sk.snpPct}%</span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="status-badge" style={{ background: sk.snpComplete ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', color: sk.snpComplete ? '#22c55e' : 'var(--accent-red)', fontWeight: 600, fontSize: '0.72rem' }}>
                                                    {sk.snpComplete ? 'Lengkap' : 'Belum Lengkap'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls totalPages={totalPagesSnpRekap} totalItems={totalSnpRekap} tableName="rekap-snp" />
                    </div>
                </div>
            )}

            {/* TAB 6: REKAPITULASI USULAN */}
            {tab === 'rekap-usulan' && (
                <>
                    <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><List size={16} style={{ marginRight: 6, color: 'var(--accent-purple)' }} /> Total Sekolah Berusulan</div>
                            <div className="stat-value" style={{ color: 'var(--accent-purple)', fontSize: '1.3rem' }}>{filteredRekapUsulan.length}</div>
                        </div>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><MessageSquareText size={16} style={{ marginRight: 6, color: 'var(--accent-blue)' }} /> Total Usulan</div>
                            <div className="stat-value" style={{ color: 'var(--accent-blue)', fontSize: '1.3rem' }}>{filteredRekapUsulan.reduce((s, d) => s + ((sekolahKeterangan[d.id] || []).length), 0)}</div>
                        </div>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center' }}><Wallet size={16} style={{ marginRight: 6, color: 'var(--accent-green)' }} /> Total Anggaran Berusulan</div>
                            <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: '1rem' }}>{formatCurrency(filteredRekapUsulan.reduce((s, d) => s + d.biayaRS + d.biayaRB + d.biayaBuild, 0))}</div>
                        </div>
                    </div>

                    {/* Column filter toggle */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', position: 'relative' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowColFilter(!showColFilter)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Columns size={14} /> Kolom
                        </button>
                        {showColFilter && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem', zIndex: 20, minWidth: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                {[{ key: 'totalRehab', label: 'Total Rehab' }, { key: 'totalPembangunan', label: 'Total Pembangunan' }, { key: 'totalAnggaran', label: 'Total Anggaran' }].map(col => (
                                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 6, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                        {rekapUsulanCols[col.key] ? <Eye size={14} style={{ color: 'var(--accent-green)' }} /> : <EyeOff size={14} style={{ color: 'var(--text-secondary)' }} />}
                                        <span>{col.label}</span>
                                        <input type="checkbox" checked={rekapUsulanCols[col.key]} onChange={() => toggleCol(col.key)} style={{ marginLeft: 'auto', accentColor: 'var(--accent-purple)' }} />
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="table-container">
                        {renderTableToolbar(totalRekapUsulan, pagedRekapUsulan)}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}></th>
                                        <th style={{ width: 50 }}>No</th>
                                        <th style={{ minWidth: 200 }}>Nama Sekolah</th>
                                        <th style={{ width: 80, textAlign: 'center' }}>Jml Usulan</th>
                                        <th style={{ minWidth: 220, background: 'rgba(139,92,246,0.05)', borderLeft: '3px solid var(--accent-purple)' }}>Usulan</th>
                                        {rekapUsulanCols.totalRehab && <th style={{ width: 150, textAlign: 'right' }}>Total Rehab</th>}
                                        {rekapUsulanCols.totalPembangunan && <th style={{ width: 150, textAlign: 'right' }}>Total Pembangunan</th>}
                                        {rekapUsulanCols.totalAnggaran && <th style={{ width: 170, textAlign: 'right', background: 'var(--bg-secondary)' }}>Total Anggaran</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderRekapUsulanTableBody(pagedRekapUsulan)}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls totalPages={totalPagesRekapUsulan} totalItems={totalRekapUsulan} tableName="rekap-usulan" />
                    </div>
                </>
            )}

            {renderModal()}
            <ConfirmModal
                isOpen={!!deleteConfirm}
                title="Hapus Data?"
                message="Data ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan."
                confirmText="Ya, Hapus"
                variant="danger"
                onConfirm={executeDelete}
                onCancel={() => setDeleteConfirm(null)}
            />
        </div>
    );
};

export default ProyeksiAnggaran;
