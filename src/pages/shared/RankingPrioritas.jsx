import { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical, Save, Search, Lock, Unlock, Filter } from 'lucide-react';
import { sekolahApi, korwilApi } from '../../api/index';
import { KECAMATAN, JENJANG } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const RankingPrioritas = () => {
    const user = useAuthStore(s => s.user);
    const role = (user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'verifikator';
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [locked, setLocked] = useState(false);
    const [wilayahInfo, setWilayahInfo] = useState('');
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // Admin filter state
    const [filterJenjang, setFilterJenjang] = useState('');
    const [filterKecamatan, setFilterKecamatan] = useState('');

    // Load lock status from localStorage
    useEffect(() => {
        const lockKey = isAdmin ? 'ranking-lock-admin' : `ranking-lock-${user?.id}`;
        const lockStatus = localStorage.getItem(lockKey);
        if (lockStatus === 'true') setLocked(true);
    }, [isAdmin, user?.id]);

    // Fetch schools filtered by korwil assignment or admin filters
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let kecamatan = '';
            let jenjang = '';

            if (isAdmin) {
                // Admin: use filter dropdowns
                kecamatan = filterKecamatan;
                jenjang = filterJenjang;
            } else if (role === 'korwil' && user?.id) {
                // Korwil: use assignment
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
                } catch (e) { console.error('Failed to get korwil assignment:', e); }

                // Check if admin has locked the ranking
                const adminLock = localStorage.getItem('ranking-lock-admin');
                if (adminLock === 'true') setLocked(true);
            }

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
                alasan: s.rankAlasan || '',
                rank: s.rankUrutan || (i + 1),
            }));

            list.sort((a, b) => (a.rank || 999) - (b.rank || 999));
            list.forEach((s, i) => { s.rank = i + 1; });

            // Load saved rankings
            const storageKey = isAdmin
                ? `ranking-admin-${filterKecamatan || 'all'}-${filterJenjang || 'all'}`
                : `ranking-${user?.id}`;
            try {
                const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
                if (saved.length > 0) {
                    saved.forEach(s => {
                        const found = list.find(u => u.id === s.id);
                        if (found) {
                            found.rank = s.rank;
                            found.alasan = s.alasan || '';
                        }
                    });
                    list.sort((a, b) => a.rank - b.rank);
                    list.forEach((s, i) => { s.rank = i + 1; });
                }
            } catch { /* ignore */ }

            setSchools(list);
        } catch (e) {
            console.error('Failed to fetch schools:', e);
            toast.error('Gagal memuat data sekolah');
        } finally { setLoading(false); }
    }, [role, user?.id, isAdmin, filterKecamatan, filterJenjang]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Drag & Drop
    const handleDragStart = (idx) => { dragItem.current = idx; };
    const handleDragEnter = (idx) => { dragOverItem.current = idx; };
    const handleDragEnd = () => {
        if (locked || dragItem.current === null || dragOverItem.current === null) return;
        const arr = [...schools];
        const dragged = arr.splice(dragItem.current, 1)[0];
        arr.splice(dragOverItem.current, 0, dragged);
        arr.forEach((s, i) => { s.rank = i + 1; });
        setSchools(arr);
        dragItem.current = null;
        dragOverItem.current = null;
    };

    // Direct rank input
    const handleRankInput = (id, newRank) => {
        if (locked) return;
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

    // Update alasan/keterangan
    const handleAlasanChange = (id, value) => {
        if (locked) return;
        setSchools(prev => prev.map(s => s.id === id ? { ...s, alasan: value } : s));
    };

    // Save rankings
    const handleSave = async () => {
        setSaving(true);
        try {
            const rankData = schools.map(s => ({ id: s.id, rank: s.rank, alasan: s.alasan }));
            const storageKey = isAdmin
                ? `ranking-admin-${filterKecamatan || 'all'}-${filterJenjang || 'all'}`
                : `ranking-${user?.id}`;
            localStorage.setItem(storageKey, JSON.stringify(rankData));
            toast.success('Ranking prioritas berhasil disimpan');
        } catch (e) {
            toast.error('Gagal menyimpan ranking');
        } finally { setSaving(false); }
    };

    // Lock/Unlock ranking (admin only)
    const handleToggleLock = () => {
        const newLocked = !locked;
        setLocked(newLocked);
        localStorage.setItem('ranking-lock-admin', String(newLocked));
        toast.success(newLocked ? 'Ranking dikunci — Korwil tidak bisa mengedit' : 'Ranking dibuka — Korwil bisa mengedit kembali', {
            style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
        });
    };

    // Filtered schools by search
    const filtered = search
        ? schools.filter(s => s.nama.toLowerCase().includes(search.toLowerCase()) || s.npsn.includes(search))
        : schools;

    const canEdit = !locked;

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Ranking Prioritas</h1>
                    <p>
                        {isAdmin ? 'Kelola ranking prioritas seluruh sekolah' : `Wilayah: ${wilayahInfo}`}
                        {' — '}{schools.length} sekolah
                        {locked && <span style={{ color: '#ef4444', fontWeight: 600 }}> 🔒 Terkunci</span>}
                    </p>
                </div>
                <div className="page-header-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {isAdmin && (
                        <button
                            className={`btn ${locked ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={handleToggleLock}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            {locked ? <Lock size={16} /> : <Unlock size={16} />}
                            {locked ? 'Buka Kunci' : 'Kunci Ranking'}
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || locked}>
                        <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Ranking'}
                    </button>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari sekolah..." value={search} onChange={e => setSearch(e.target.value)} />
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
                            ) : filtered.map((s) => (
                                <tr
                                    key={s.id}
                                    draggable={canEdit && !search}
                                    onDragStart={() => handleDragStart(schools.indexOf(s))}
                                    onDragEnter={() => handleDragEnter(schools.indexOf(s))}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={e => e.preventDefault()}
                                    style={{
                                        cursor: canEdit && !search ? 'grab' : 'default',
                                        transition: 'background 0.15s',
                                        opacity: locked ? 0.8 : 1,
                                    }}
                                >
                                    <td style={{ cursor: canEdit ? 'grab' : 'default', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                        {canEdit ? <GripVertical size={16} /> : <Lock size={14} style={{ opacity: 0.4 }} />}
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
                                            disabled={locked}
                                            style={{
                                                width: '100%', padding: '6px 10px', fontSize: 13,
                                                background: locked ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
                                                opacity: locked ? 0.6 : 1,
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
                                            disabled={locked}
                                            style={{
                                                width: 60, padding: '6px 8px', fontSize: 14, fontWeight: 700,
                                                background: locked ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 6, color: 'var(--accent-blue)', textAlign: 'center',
                                                outline: 'none', opacity: locked ? 0.6 : 1,
                                            }}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
export default RankingPrioritas;
