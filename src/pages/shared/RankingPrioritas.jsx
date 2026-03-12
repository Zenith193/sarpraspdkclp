import { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical, Save, Search } from 'lucide-react';
import { sekolahApi, korwilApi } from '../../api/index';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const RankingPrioritas = () => {
    const user = useAuthStore(s => s.user);
    const role = (user?.role || '').toLowerCase();
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [wilayahInfo, setWilayahInfo] = useState('');
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // Fetch schools filtered by korwil assignment
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let kecamatan = '';
            let jenjang = '';

            // Get korwil assignment
            if (role === 'korwil' && user?.id) {
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

            setWilayahInfo(`${kecamatan || 'Semua'} (${jenjang || 'Semua'})`);

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
                alasan: s.rankAlasan || '',
                rank: s.rankUrutan || (i + 1),
            }));

            // Sort by existing rank
            list.sort((a, b) => (a.rank || 999) - (b.rank || 999));
            // Re-number ranks
            list.forEach((s, i) => { s.rank = i + 1; });
            setSchools(list);
        } catch (e) {
            console.error('Failed to fetch schools:', e);
            toast.error('Gagal memuat data sekolah');
        } finally { setLoading(false); }
    }, [role, user?.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Drag & Drop
    const handleDragStart = (idx) => { dragItem.current = idx; };
    const handleDragEnter = (idx) => { dragOverItem.current = idx; };
    const handleDragEnd = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
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
        setSchools(prev => prev.map(s => s.id === id ? { ...s, alasan: value } : s));
    };

    // Save rankings (local only for now)
    const handleSave = async () => {
        setSaving(true);
        try {
            // Save ranking data to localStorage as backup
            const rankData = schools.map(s => ({ id: s.id, rank: s.rank, alasan: s.alasan }));
            localStorage.setItem(`ranking-${user?.id}`, JSON.stringify(rankData));
            toast.success('Ranking prioritas berhasil disimpan');
        } catch (e) {
            toast.error('Gagal menyimpan ranking');
        } finally { setSaving(false); }
    };

    // Load saved rankings from localStorage
    useEffect(() => {
        if (schools.length > 0 && user?.id) {
            try {
                const saved = JSON.parse(localStorage.getItem(`ranking-${user.id}`) || '[]');
                if (saved.length > 0) {
                    const updated = [...schools];
                    saved.forEach(s => {
                        const found = updated.find(u => u.id === s.id);
                        if (found) {
                            found.rank = s.rank;
                            found.alasan = s.alasan || '';
                        }
                    });
                    updated.sort((a, b) => a.rank - b.rank);
                    updated.forEach((s, i) => { s.rank = i + 1; });
                    setSchools(updated);
                }
            } catch { /* ignore */ }
        }
    }, [loading]); // Only run after initial load

    // Filtered schools
    const filtered = search
        ? schools.filter(s => s.nama.toLowerCase().includes(search.toLowerCase()) || s.npsn.includes(search))
        : schools;

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Ranking Prioritas</h1>
                    <p>Atur urutan prioritas sekolah — Wilayah: {wilayahInfo} — {schools.length} sekolah</p>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Ranking'}
                    </button>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari sekolah..." value={search} onChange={e => setSearch(e.target.value)} />
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
                                <th style={{ minWidth: 200 }}>Alasan / Keterangan</th>
                                <th style={{ width: 100 }}>Urutan Prioritas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Memuat data...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                    {search ? 'Tidak ditemukan' : 'Belum ada data sekolah'}
                                </td></tr>
                            ) : filtered.map((s, i) => (
                                <tr
                                    key={s.id}
                                    draggable={!search}
                                    onDragStart={() => handleDragStart(schools.indexOf(s))}
                                    onDragEnter={() => handleDragEnter(schools.indexOf(s))}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={e => e.preventDefault()}
                                    style={{ cursor: search ? 'default' : 'grab', transition: 'background 0.15s' }}
                                >
                                    <td style={{ cursor: 'grab', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                        <GripVertical size={16} />
                                    </td>
                                    <td style={{ fontWeight: 700, color: 'var(--accent-blue)', textAlign: 'center' }}>{s.rank}</td>
                                    <td style={{ fontWeight: 500 }}>{s.nama}</td>
                                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.npsn}</td>
                                    <td>
                                        <input
                                            type="text"
                                            value={s.alasan}
                                            onChange={e => handleAlasanChange(s.id, e.target.value)}
                                            placeholder="Tulis alasan prioritas..."
                                            style={{
                                                width: '100%', padding: '6px 10px', fontSize: 13,
                                                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                                borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
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
                                            style={{
                                                width: 60, padding: '6px 8px', fontSize: 14, fontWeight: 700,
                                                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                                borderRadius: 6, color: 'var(--accent-blue)', textAlign: 'center',
                                                outline: 'none',
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
