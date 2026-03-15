import { useMemo, useEffect, useState } from 'react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { Building2, FileText, Star, Database, CheckCircle, AlertCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { useKorwilData, useSekolahData } from '../../data/dataProvider';
import { sarprasApi, proposalApi, rankingApi } from '../../api/index';
import { formatNumber } from '../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const DashboardKorwil = () => {
    const user = useAuthStore(s => s.user);
    const { data: korwilList } = useKorwilData();
    const { data: sekolahList } = useSekolahData();

    // Direct API data states
    const [sarprasData, setSarprasData] = useState([]);
    const [proposalData, setProposalData] = useState([]);
    const [allProposalsTop5, setAllProposalsTop5] = useState([]);
    const [loading, setLoading] = useState(true);

    // Get this korwil's assignment from korwil_assignment table
    const myAssignment = useMemo(() => {
        if (!korwilList || !user) return { kecamatan: [], jenjang: '' };
        const myRows = korwilList.filter(row => {
            const ka = row.korwilAssignment || row;
            return String(ka.userId) === String(user.id);
        });
        if (myRows.length === 0) return { kecamatan: [], jenjang: '' };
        const kecList = [];
        let jenj = '';
        myRows.forEach(row => {
            const ka = row.korwilAssignment || row;
            if (ka.kecamatan && !kecList.includes(ka.kecamatan)) kecList.push(ka.kecamatan);
            if (ka.jenjang) jenj = ka.jenjang;
        });
        return { kecamatan: kecList, jenjang: jenj };
    }, [korwilList, user]);

    const wilayah = myAssignment.kecamatan;
    const jenjang = myAssignment.jenjang || 'SD';

    // Fetch sarpras & proposal with server-side kecamatan+jenjang filter
    useEffect(() => {
        if (wilayah.length === 0) return;
        let cancelled = false;
        setLoading(true);

        const fetchData = async () => {
            try {
                // Fetch for each kecamatan in the assignment
                const allSarpras = [];
                const allProposals = [];
                for (const kec of wilayah) {
                    const [sRes, pRes] = await Promise.all([
                        sarprasApi.list({ kecamatan: kec, jenjang, limit: 99999 }),
                        proposalApi.list({ kecamatan: kec, jenjang, limit: 99999 }),
                    ]);
                    // Flatten sarpras
                    const sItems = (sRes.data || sRes || []).map(item => {
                        if (item.sarpras) {
                            return { ...item.sarpras, namaSekolah: item.sekolahNama || '', npsn: item.sekolahNpsn || '', kecamatan: item.sekolahKecamatan || '', jenjang: item.sekolahJenjang || '' };
                        }
                        return item;
                    });
                    allSarpras.push(...sItems);
                    // Flatten proposals
                    const pItems = (pRes.data || pRes || []).map(item => {
                        if (item.proposal) {
                            return { ...item.proposal, namaSekolah: item.sekolahNama || '', npsn: item.sekolahNpsn || '', kecamatan: item.sekolahKecamatan || '', jenjang: item.sekolahJenjang || '' };
                        }
                        return item;
                    });
                    allProposals.push(...pItems);
                }
                if (!cancelled) {
                    setSarprasData(allSarpras);
                    setProposalData(allProposals);
                    setLoading(false);
                }
            } catch (err) {
                console.error('Dashboard fetch error:', err);
                if (!cancelled) setLoading(false);
            }
        };
        fetchData();
        return () => { cancelled = true; };
    }, [wilayah, jenjang]);

    // Fetch top 5 from Ranking Prioritas (merged with sekolahList for names)
    useEffect(() => {
        if (!sekolahList || sekolahList.length === 0) return;
        rankingApi.getData('all', 'all').then(res => {
            const items = res?.items || res || [];
            const sorted = [...items].sort((a, b) => (a.rank || 999) - (b.rank || 999));
            const top5 = sorted.slice(0, 5).map(item => {
                const sch = sekolahList.find(s => s.id === item.id);
                return { ...item, namaSekolah: sch?.nama || sch?.name || '' };
            });
            setAllProposalsTop5(top5);
        }).catch(() => {});
    }, [sekolahList]);

    const jumlahSekolah = useMemo(() =>
        sekolahList.filter(s => wilayah.includes(s.kecamatan) && s.jenjang === jenjang).length
    , [sekolahList, wilayah, jenjang]);

    // Sarpras stats
    const sarprasStats = useMemo(() => ({
        total: sarprasData.length,
        baik: sarprasData.filter(s => s.kondisi === 'BAIK').length,
        rr: sarprasData.filter(s => s.kondisi === 'RUSAK RINGAN').length,
        rs: sarprasData.filter(s => s.kondisi === 'RUSAK SEDANG').length,
        rb: sarprasData.filter(s => s.kondisi === 'RUSAK BERAT').length,
    }), [sarprasData]);

    // Proposal stats
    const proposalStats = useMemo(() => ({
        menunggu: proposalData.filter(p => p.status === 'Menunggu Verifikasi').length,
        disetujui: proposalData.filter(p => p.status === 'Disetujui').length,
        ditolak: proposalData.filter(p => p.status === 'Ditolak').length,
        revisi: proposalData.filter(p => p.status === 'Revisi').length,
    }), [proposalData]);

    // Recap per jenis prasarana
    const sarprasRecap = useMemo(() => {
        const map = {};
        sarprasData.forEach(s => {
            const jenis = s.jenisPrasarana || 'Lainnya';
            if (!map[jenis]) map[jenis] = { jenis, total: 0, baik: 0, rr: 0, rs: 0, rb: 0 };
            map[jenis].total++;
            if (s.kondisi === 'BAIK') map[jenis].baik++;
            else if (s.kondisi === 'RUSAK RINGAN') map[jenis].rr++;
            else if (s.kondisi === 'RUSAK SEDANG') map[jenis].rs++;
            else if (s.kondisi === 'RUSAK BERAT') map[jenis].rb++;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [sarprasData]);

    // Bar chart data
    const barData = {
        labels: ['BAIK', 'RUSAK RINGAN', 'RUSAK SEDANG', 'RUSAK BERAT'],
        datasets: [{ label: 'Jumlah', data: [sarprasStats.baik, sarprasStats.rr, sarprasStats.rs, sarprasStats.rb], backgroundColor: ['#22c55e', '#3b82f6', '#f97316', '#ef4444'], borderRadius: 6, borderSkipped: false }]
    };
    const barOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } }, y: { grid: { color: 'rgba(100,116,139,0.1)' }, ticks: { color: '#64748b', font: { size: 11 } } } } };

    // Pie chart data
    const pieData = {
        labels: ['Menunggu', 'Disetujui', 'Ditolak', 'Revisi'],
        datasets: [{ data: [proposalStats.menunggu, proposalStats.disetujui, proposalStats.ditolak, proposalStats.revisi], backgroundColor: ['#eab308', '#22c55e', '#ef4444', '#f97316'], borderWidth: 0 }]
    };
    const pieOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } } } };

    const topProposals = allProposalsTop5;

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard Korwil</h1>
                    <p>Sugeng Rawuh, {user?.name || user?.namaAkun} ({user?.role?.toLowerCase()}) — Wilayah: {wilayah.length > 0 ? wilayah.join(', ') : '(belum di-assign)'} ({jenjang})</p>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card"><div className="stat-label"><Database size={14} style={{ color: 'var(--accent-blue)' }} /> Total Sarpras</div><div className="stat-value">{loading ? '...' : formatNumber(sarprasStats.total)}</div></div>
                <div className="stat-card"><div className="stat-label"><Building2 size={14} style={{ color: 'var(--accent-purple)' }} /> Jumlah Sekolah</div><div className="stat-value" style={{ color: 'var(--accent-purple)' }}>{formatNumber(jumlahSekolah)}</div></div>
                <div className="stat-card"><div className="stat-label"><CheckCircle size={14} style={{ color: '#22c55e' }} /> Baik</div><div className="stat-value" style={{ color: '#22c55e' }}>{loading ? '...' : formatNumber(sarprasStats.baik)}</div></div>
                <div className="stat-card"><div className="stat-label"><AlertCircle size={14} style={{ color: '#3b82f6' }} /> Rusak Ringan</div><div className="stat-value" style={{ color: '#3b82f6' }}>{loading ? '...' : formatNumber(sarprasStats.rr)}</div></div>
                <div className="stat-card"><div className="stat-label"><AlertCircle size={14} style={{ color: '#f59e0b' }} /> Rusak Sedang</div><div className="stat-value" style={{ color: '#f59e0b' }}>{loading ? '...' : formatNumber(sarprasStats.rs)}</div></div>
                <div className="stat-card"><div className="stat-label"><AlertCircle size={14} style={{ color: '#ef4444' }} /> Rusak Berat</div><div className="stat-value" style={{ color: '#ef4444' }}>{loading ? '...' : formatNumber(sarprasStats.rb)}</div></div>
            </div>

            {/* Summary Cards */}
            <div className="summary-grid" style={{ marginBottom: 24 }}>
                <div className="summary-card">
                    <div className="summary-card-header"><div className="summary-card-title">Rekap Sarpras {jenjang}</div><div className="summary-card-icon" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}><Building2 size={16} /></div></div>
                    <div className="summary-card-value">{loading ? '...' : formatNumber(sarprasStats.total)}</div>
                    <ul className="summary-card-list">
                        <li><span className="dot" style={{ background: '#22c55e' }} /> Baik: {sarprasStats.baik}</li>
                        <li><span className="dot" style={{ background: '#3b82f6' }} /> R. Ringan: {sarprasStats.rr}</li>
                        <li><span className="dot" style={{ background: '#f59e0b' }} /> R. Sedang: {sarprasStats.rs}</li>
                        <li><span className="dot" style={{ background: '#ef4444' }} /> R. Berat: {sarprasStats.rb}</li>
                    </ul>
                </div>
                <div className="summary-card">
                    <div className="summary-card-header"><div className="summary-card-title">Rekap Usulan {jenjang}</div><div className="summary-card-icon" style={{ background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)' }}><FileText size={16} /></div></div>
                    <div className="summary-card-value">{loading ? '...' : proposalData.length}</div>
                    <ul className="summary-card-list">
                        <li><span className="dot" style={{ background: '#eab308' }} /> Menunggu: {proposalStats.menunggu}</li>
                        <li><span className="dot" style={{ background: '#22c55e' }} /> Disetujui: {proposalStats.disetujui}</li>
                        <li><span className="dot" style={{ background: '#ef4444' }} /> Ditolak: {proposalStats.ditolak}</li>
                        <li><span className="dot" style={{ background: '#f97316' }} /> Revisi: {proposalStats.revisi}</li>
                    </ul>
                </div>
                <div className="summary-card">
                    <div className="summary-card-header"><div className="summary-card-title">Top 5 Prioritas</div><div className="summary-card-icon" style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--accent-yellow)' }}><Star size={16} /></div></div>
                    <ul className="summary-card-list">
                        {topProposals.map((p, i) => (
                            <li key={p.id || i} style={{ justifyContent: 'space-between' }}><span>{i + 1}. {p.namaSekolah || p.nama || '-'}</span></li>
                        ))}
                        {topProposals.length === 0 && <li style={{ color: 'var(--text-secondary)' }}>{loading ? 'Memuat data...' : 'Belum ada data'}</li>}
                    </ul>
                </div>
            </div>

            {/* Charts */}
            {!loading && sarprasData.length > 0 && (
                <div className="charts-grid" style={{ marginBottom: 24 }}>
                    <div className="chart-card">
                        <div className="chart-header"><div className="chart-title">Grafik Kondisi Sarpras ({jenjang})</div></div>
                        <div style={{ height: 280 }}><Bar data={barData} options={barOptions} /></div>
                    </div>
                    <div className="chart-card">
                        <div className="chart-header"><div className="chart-title">Grafik Proposal ({jenjang})</div></div>
                        <div style={{ height: 280 }}><Pie data={pieData} options={pieOptions} /></div>
                    </div>
                </div>
            )}

            {/* Rekapitulasi per Jenis Prasarana */}
            <div className="table-container" style={{ marginBottom: 24 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={16} style={{ color: '#3b82f6' }} />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Rekapitulasi Sarpras per Jenis Prasarana ({jenjang})</h3>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sarprasStats.total} item</span>
                </div>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat data...</div>
                ) : sarprasRecap.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <Database size={32} style={{ opacity: 0.2, marginBottom: 8 }} /><br />Belum ada data sarpras
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead><tr><th>No</th><th>Jenis Prasarana</th><th style={{ textAlign: 'center' }}>Jumlah</th><th style={{ textAlign: 'center' }}>Baik</th><th style={{ textAlign: 'center' }}>R. Ringan</th><th style={{ textAlign: 'center' }}>R. Sedang</th><th style={{ textAlign: 'center' }}>R. Berat</th></tr></thead>
                            <tbody>
                                {sarprasRecap.map((r, i) => (
                                    <tr key={r.jenis}><td>{i + 1}</td><td style={{ fontWeight: 500 }}>{r.jenis}</td><td style={{ textAlign: 'center', fontWeight: 600 }}>{r.total}</td><td style={{ textAlign: 'center' }}><span style={{ color: '#22c55e', fontWeight: 600 }}>{r.baik || '-'}</span></td><td style={{ textAlign: 'center' }}><span style={{ color: '#3b82f6', fontWeight: 600 }}>{r.rr || '-'}</span></td><td style={{ textAlign: 'center' }}><span style={{ color: '#f59e0b', fontWeight: 600 }}>{r.rs || '-'}</span></td><td style={{ textAlign: 'center' }}><span style={{ color: '#ef4444', fontWeight: 600 }}>{r.rb || '-'}</span></td></tr>
                                ))}
                                <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}><td></td><td>Total</td><td style={{ textAlign: 'center' }}>{sarprasStats.total}</td><td style={{ textAlign: 'center', color: '#22c55e' }}>{sarprasStats.baik}</td><td style={{ textAlign: 'center', color: '#3b82f6' }}>{sarprasStats.rr}</td><td style={{ textAlign: 'center', color: '#f59e0b' }}>{sarprasStats.rs}</td><td style={{ textAlign: 'center', color: '#ef4444' }}>{sarprasStats.rb}</td></tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
export default DashboardKorwil;
