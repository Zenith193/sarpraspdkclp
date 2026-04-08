import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GripVertical, Save, Search, Lock, Unlock, ChevronLeft, ChevronRight, Download, ChevronDown, FileSpreadsheet, FileDown, FileText } from 'lucide-react';
import { sekolahApi, korwilApi, rankingApi } from '../../api/index';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import { KECAMATAN, JENJANG } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

// Check if a specific kecamatan+jenjang combo is locked
// Cascade: specific combo → jenjang only → kecamatan only → all
function isLockedFor(locks, kecamatan, jenjang) {
    if (!locks || !Object.keys(locks).length) return false;
    if (locks['all']) return true;
    if (jenjang && locks[jenjang]) return true;
    if (kecamatan && locks[kecamatan]) return true;
    if (kecamatan && jenjang && locks[`${jenjang}_${kecamatan}`]) return true;
    return false;
}

const RankingPrioritas = () => {
    const user = useAuthStore(s => s.user);
    const role = (user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'verifikator';
    const isKorwil = role === 'korwil';
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [locks, setLocks] = useState({});
    const [wilayahInfo, setWilayahInfo] = useState('');
    const [myKecamatan, setMyKecamatan] = useState('');
    const [myJenjang, setMyJenjang] = useState('');
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);
    const [showExport, setShowExport] = useState(false);
    const exportRef = useRef(null);

    // Pagination
    const [pageSize, setPageSize] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

    // Admin filter state
    const [filterJenjang, setFilterJenjang] = useState('');
    const [filterKecamatan, setFilterKecamatan] = useState('');

    // Load lock status from server
    useEffect(() => {
        rankingApi.getLock()
            .then(res => { if (res?.locks) setLocks(res.locks); })
            .catch(() => {});
    }, []);

    // Determine current lock state
    const activeKec = isAdmin ? filterKecamatan : myKecamatan;
    const activeJen = isAdmin ? filterJenjang : myJenjang;
    const currentlyLocked = isLockedFor(locks, activeKec, activeJen);

    // Fetch schools and ranking data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let kecamatan = '';
            let jenjang = '';

            if (isAdmin) {
                kecamatan = filterKecamatan;
                jenjang = filterJenjang;
            } else if (isKorwil && user?.id) {
                try {
                    const korwilList = await korwilApi.list();
                    const myRows = (korwilList || []).filter(row => {
                        const ka = row.korwilAssignment || row;
                        return String(ka.userId) === String(user.id);
                    });
                    if (myRows.length > 0) {
                        const ka = myRows[0].korwilAssignment || myRows[0];
                        kecamatan = ka.kecamatan || '';
                        jenjang = ka.jenjang || '';
                    }
                } catch (e) { console.error('Korwil assignment error:', e); }
            }

            setMyKecamatan(kecamatan);
            setMyJenjang(jenjang);
            setWilayahInfo(`${kecamatan || 'Semua Kecamatan'} — ${jenjang || 'Semua Jenjang'}`);

            const params = { limit: 9999 };
            if (kecamatan) params.kecamatan = kecamatan;
            if (jenjang) params.jenjang = jenjang;

            const result = await sekolahApi.list(params);
            const list = (result?.data || result || []).map((s, i) => ({
                id: s.id,
                nama: s.nama || s.name || '',
                npsn: s.npsn || '',
                kecamatan: s.kecamatan || '',
                jenjang: s.jenjang || '',
                alasan: '',
                rank: i + 1,
            }));

            // Load saved ranking from server
            try {
                const savedRanking = await rankingApi.getData(kecamatan, jenjang);
                if (savedRanking?.items?.length > 0) {
                    savedRanking.items.forEach(saved => {
                        const found = list.find(s => s.id === saved.id);
                        if (found) {
                            found.rank = saved.rank;
                            found.alasan = saved.alasan || '';
                        }
                    });
                }
            } catch { /* no saved ranking */ }

            list.sort((a, b) => a.rank - b.rank);
            list.forEach((s, i) => { s.rank = i + 1; });
            setSchools(list);
        } catch (e) {
            console.error('Fetch error:', e);
            toast.error('Gagal memuat data sekolah');
        } finally { setLoading(false); }
    }, [role, user?.id, isAdmin, isKorwil, filterKecamatan, filterJenjang]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Drag & Drop
    const handleDragStart = (idx) => { dragItem.current = idx; };
    const handleDragEnter = (idx) => { dragOverItem.current = idx; };
    const handleDragEnd = () => {
        if (currentlyLocked && !isAdmin) return;
        if (dragItem.current === null || dragOverItem.current === null) return;
        const arr = [...schools];
        const dragged = arr.splice(dragItem.current, 1)[0];
        arr.splice(dragOverItem.current, 0, dragged);
        arr.forEach((s, i) => { s.rank = i + 1; });
        setSchools(arr);
        dragItem.current = null;
        dragOverItem.current = null;
    };

    const handleRankInput = (id, newRank) => {
        if (currentlyLocked && !isAdmin) return;
        const num = parseInt(newRank);
        if (isNaN(num) || num < 1 || num > schools.length) return;
        const arr = [...schools];
        const currentIdx = arr.findIndex(s => s.id === id);
        if (currentIdx === -1) return;
        const item = arr.splice(currentIdx, 1)[0];
        arr.splice(num - 1, 0, item);
        arr.forEach((s, i) => { s.rank = i + 1; });
        setSchools(arr);
    };

    const handleAlasanChange = (id, value) => {
        if (currentlyLocked && !isAdmin) return;
        setSchools(prev => prev.map(s => s.id === id ? { ...s, alasan: value } : s));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const items = schools.map(s => ({ id: s.id, rank: s.rank, alasan: s.alasan }));
            const kec = isAdmin ? (filterKecamatan || '') : myKecamatan;
            const jen = isAdmin ? (filterJenjang || '') : myJenjang;
            await rankingApi.saveData(kec, jen, items);
            toast.success('Ranking berhasil disimpan');
        } catch { toast.error('Gagal menyimpan ranking'); }
        finally { setSaving(false); }
    };

    // Lock toggle (admin) — granular options
    const handleLock = async (key, label) => {
        const isCurrentlyLocked = !!locks[key];
        try {
            await rankingApi.setLock(key, !isCurrentlyLocked);
            setLocks(prev => {
                const next = { ...prev };
                if (isCurrentlyLocked) delete next[key];
                else next[key] = true;
                return next;
            });
            toast.success(isCurrentlyLocked ? `🔓 ${label} dibuka` : `🔒 ${label} dikunci`);
        } catch { toast.error('Gagal mengubah kunci'); }
    };

    // Build lock options based on current filter
    const lockOptions = [];
    if (isAdmin) {
        lockOptions.push({ key: 'all', label: 'Semua' });
        if (filterJenjang) lockOptions.push({ key: filterJenjang, label: `Jenjang ${filterJenjang}` });
        if (filterKecamatan) lockOptions.push({ key: filterKecamatan, label: `Kec. ${filterKecamatan}` });
        if (filterKecamatan && filterJenjang) lockOptions.push({ key: `${filterJenjang}_${filterKecamatan}`, label: `${filterJenjang} ${filterKecamatan}` });
    }

    const filtered = search
        ? schools.filter(s => s.nama.toLowerCase().includes(search.toLowerCase()) || s.npsn.includes(search))
        : schools;

    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    useEffect(() => { setCurrentPage(1); }, [search, pageSize, filterJenjang, filterKecamatan]);

    const canEdit = isAdmin || !currentlyLocked;

    // Export handler
    const handleExport = (format) => {
        setShowExport(false);
        if (!schools.length) { toast.error('Tidak ada data untuk diekspor'); return; }

        // Dynamic filename
        const kecLabel = activeKec || 'Semua';
        const jenLabel = activeJen || 'Semua';
        let fileName = `Ranking_Prioritas_${jenLabel}_${kecLabel}`.replace(/\s+/g, '_');
        const pdfTitle = `Ranking Prioritas ${jenLabel} ${kecLabel}`;

        const exportCols = [
            { header: 'No', accessor: (_, i) => i + 1 },
            { header: 'Nama Sekolah', key: 'nama' },
            { header: 'NPSN', key: 'npsn' },
            { header: 'Kecamatan', key: 'kecamatan' },
            { header: 'Jenjang', key: 'jenjang' },
            { header: 'Alasan / Keterangan', key: 'alasan' },
            { header: 'Urutan Prioritas', key: 'rank' },
        ];

        try {
            if (format === 'excel') exportToExcel(schools, exportCols, fileName);
            else if (format === 'csv') exportToCSV(schools, exportCols, fileName);
            else if (format === 'pdf') exportToPDF(schools, exportCols, fileName, pdfTitle);
            toast.success(`Berhasil ekspor ${format.toUpperCase()}`);
        } catch (err) {
            console.error('Export error:', err);
            toast.error('Gagal mengekspor data');
        }
    };

    // Close export dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Ranking Prioritas</h1>
                    <p>
                        {isAdmin ? 'Kelola ranking prioritas' : `Wilayah: ${wilayahInfo}`}
                        {' — '}{schools.length} sekolah
                        {currentlyLocked && !isAdmin && <span style={{ color: '#ef4444', fontWeight: 600 }}> 🔒 Terkunci</span>}
                    </p>
                </div>
                <div className="page-header-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(canEdit) && (
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Ranking'}
                        </button>
                    )}
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari sekolah..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                                style={{ padding: '6px 10px', fontSize: 13, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        {isAdmin && (
                            <>
                                <select
                                    value={filterJenjang}
                                    onChange={e => setFilterJenjang(e.target.value)}
                                    style={{
                                        padding: '8px 12px', fontSize: 13, borderRadius: 8,
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                        color: 'var(--text-primary)', cursor: 'pointer', minWidth: 100,
                                    }}
                                >
                                    <option value="">Semua Jenjang</option>
                                    {JENJANG.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                                <select
                                    value={filterKecamatan}
                                    onChange={e => setFilterKecamatan(e.target.value)}
                                    style={{
                                        padding: '8px 12px', fontSize: 13, borderRadius: 8,
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                        color: 'var(--text-primary)', cursor: 'pointer', minWidth: 140,
                                    }}
                                >
                                    <option value="">Semua Kecamatan</option>
                                    {KECAMATAN.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </>
                        )}
                    </div>
                    <div className="table-toolbar-right" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {isAdmin && lockOptions.map(opt => (
                            <button
                                key={opt.key}
                                className={`btn btn-sm ${locks[opt.key] ? 'btn-danger' : 'btn-secondary'}`}
                                onClick={() => handleLock(opt.key, opt.label)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                            >
                                {locks[opt.key] ? <Lock size={12} /> : <Unlock size={12} />}
                                {locks[opt.key] ? `🔒 ${opt.label}` : `Kunci ${opt.label}`}
                            </button>
                        ))}
                        <div className="export-dropdown" ref={exportRef}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(!showExport)}>
                                <Download size={14} /> Ekspor <ChevronDown size={12} />
                            </button>
                            {showExport && (
                                <div className="dropdown-menu">
                                    <button className="dropdown-item" onClick={() => handleExport('excel')}>
                                        <span className="export-icon"><FileSpreadsheet size={14} /></span> Excel
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExport('csv')}>
                                        <span className="export-icon"><FileDown size={14} /></span> CSV
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExport('pdf')}>
                                        <span className="export-icon"><FileText size={14} /></span> PDF
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}></th>
                                <th style={{ width: 60 }}>No</th>
                                <th>Nama Sekolah</th>
                                <th>NPSN</th>
                                {isAdmin && <th>Kecamatan</th>}
                                {isAdmin && <th>Jenjang</th>}
                                <th style={{ minWidth: 200 }}>Alasan / Keterangan</th>
                                <th style={{ width: 100 }}>Urutan Prioritas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={isAdmin ? 8 : 6} style={{ textAlign: 'center', padding: 40 }}>Memuat data...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={isAdmin ? 8 : 6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                    {search ? 'Tidak ditemukan' : 'Belum ada data sekolah'}
                                </td></tr>
                            ) : paginatedData.map((s) => {
                                const rowLocked = isLockedFor(locks, s.kecamatan, s.jenjang);
                                const editable = isAdmin || !rowLocked;
                                return (
                                    <tr
                                        key={s.id}
                                        draggable={editable && !search}
                                        onDragStart={() => handleDragStart(schools.indexOf(s))}
                                        onDragEnter={() => handleDragEnter(schools.indexOf(s))}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={e => e.preventDefault()}
                                        style={{
                                            cursor: editable && !search ? 'grab' : 'default',
                                            transition: 'background 0.15s',
                                            opacity: rowLocked && !isAdmin ? 0.7 : 1,
                                        }}
                                    >
                                        <td style={{ cursor: editable ? 'grab' : 'default', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                            {editable ? <GripVertical size={16} /> : <Lock size={14} style={{ opacity: 0.4 }} />}
                                        </td>
                                        <td style={{ fontWeight: 700, color: 'var(--accent-blue)', textAlign: 'center' }}>{s.rank}</td>
                                        <td style={{ fontWeight: 500 }}>{s.nama}</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.npsn}</td>
                                        {isAdmin && <td><span className="badge badge-disetujui">{s.kecamatan}</span></td>}
                                        {isAdmin && <td><span className="badge badge-baik">{s.jenjang}</span></td>}
                                        <td>
                                            <input
                                                type="text"
                                                value={s.alasan}
                                                onChange={e => handleAlasanChange(s.id, e.target.value)}
                                                placeholder="Tulis alasan prioritas..."
                                                disabled={!editable}
                                                style={{
                                                    width: '100%', padding: '6px 10px', fontSize: 13,
                                                    background: !editable ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
                                                    opacity: !editable ? 0.6 : 1,
                                                }}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                min={1}
                                                max={schools.length}
                                                value={s.rank}
                                                onChange={e => handleRankInput(s.id, e.target.value)}
                                                disabled={!editable}
                                                style={{
                                                    width: 60, padding: '6px 8px', fontSize: 14, fontWeight: 700,
                                                    background: !editable ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 6, color: 'var(--accent-blue)', textAlign: 'center',
                                                    outline: 'none', opacity: !editable ? 0.6 : 1,
                                                }}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="table-pagination">
                    <div className="table-pagination-info">
                        Menampilkan {filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} data
                    </div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem' }}>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default RankingPrioritas;
