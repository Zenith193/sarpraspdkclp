import { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical, Save, Search, Lock, Unlock, Filter } from 'lucide-react';
import { sekolahApi, korwilApi, rankingApi } from '../../api/index';
import { KECAMATAN, JENJANG } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const RankingPrioritas = () => {
    const user = useAuthStore(s => s.user);
    const role = (user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'verifikator';
    const isKorwil = role === 'korwil';
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [locked, setLocked] = useState(false);
    const [wilayahInfo, setWilayahInfo] = useState('');
    const [myKecamatan, setMyKecamatan] = useState('');
    const [myJenjang, setMyJenjang] = useState('');
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // Admin filter state
    const [filterJenjang, setFilterJenjang] = useState('');
    const [filterKecamatan, setFilterKecamatan] = useState('');

    // Load lock status from server
    useEffect(() => {
        rankingApi.getLock()
            .then(res => { if (res?.locked) setLocked(true); })
            .catch(() => {});
    }, []);

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
                } catch (e) { console.error('Failed to get korwil assignment:', e); }
            }

            setMyKecamatan(kecamatan);
            setMyJenjang(jenjang);
            setWilayahInfo(`${kecamatan || 'Semua Kecamatan'} — ${jenjang || 'Semua Jenjang'}`);

            // Fetch schools
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
            } catch { /* no saved ranking yet */ }

            // Sort and re-number
            list.sort((a, b) => a.rank - b.rank);
            list.forEach((s, i) => { s.rank = i + 1; });
            setSchools(list);
        } catch (e) {
            console.error('Failed to fetch:', e);
            toast.error('Gagal memuat data sekolah');
        } finally { setLoading(false); }
    }, [role, user?.id, isAdmin, isKorwil, filterKecamatan, filterJenjang]);

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

    const handleAlasanChange = (id, value) => {
        if (locked) return;
        setSchools(prev => prev.map(s => s.id === id ? { ...s, alasan: value } : s));
    };

    // Save to server
    const handleSave = async () => {
        setSaving(true);
        try {
            const items = schools.map(s => ({ id: s.id, rank: s.rank, alasan: s.alasan }));
            const kec = isAdmin ? (filterKecamatan || '') : myKecamatan;
            const jen = isAdmin ? (filterJenjang || '') : myJenjang;
            await rankingApi.saveData(kec, jen, items);
            toast.success('Ranking berhasil disimpan ke server');
        } catch (e) {
            toast.error('Gagal menyimpan ranking');
        } finally { setSaving(false); }
    };

    // Lock/Unlock (admin only)
    const handleToggleLock = async () => {
        const newLocked = !locked;
        try {
            await rankingApi.setLock(newLocked);
            setLocked(newLocked);
            toast.success(newLocked ? 'Ranking dikunci — Korwil tidak bisa mengedit' : 'Ranking dibuka — Korwil bisa mengedit');
        } catch { toast.error('Gagal mengubah status kunci'); }
    };

    // Search filter
    const filtered = search
        ? schools.filter(s => s.nama.toLowerCase().includes(search.toLowerCase()) || s.npsn.includes(search))
        : schools;

    const canEdit = !locked || isAdmin;

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
                        >
                            {locked ? <Lock size={16} /> : <Unlock size={16} />}
                            {locked ? ' Buka Kunci' : ' Kunci Ranking'}
                        </button>
                    )}
                    {(isAdmin || !locked) && (
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
                            ) : filtered.map((s) => {
                                const editable = canEdit || (isAdmin && !locked);
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
                                            opacity: locked && !isAdmin ? 0.7 : 1,
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
                                                placeholder={isAdmin && locked ? '(dari korwil)' : 'Tulis alasan prioritas...'}
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
            </div>
        </div>
    );
};
export default RankingPrioritas;
