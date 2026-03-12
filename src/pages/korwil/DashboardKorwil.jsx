import { useMemo, useEffect, useState } from 'react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { Building2, FileText, Star, Database, CheckCircle, AlertCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { useSarprasData, useProposalData, useSekolahData, useKorwilData } from '../../data/dataProvider';
import { formatNumber } from '../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const DashboardKorwil = () => {
    const user = useAuthStore(s => s.user);
    const { data: korwilList } = useKorwilData();
    const { data: sarprasData } = useSarprasData();
    const { data: proposalData } = useProposalData();
    const { data: sekolahList } = useSekolahData();

    // Get this korwil's assignment (kecamatan list + jenjang) from korwil_assignment table
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

    // Filter sarpras & proposal by assigned kecamatan + jenjang
    const filteredSarpras = useMemo(() =>
        sarprasData.filter(s => wilayah.includes(s.kecamatan) && s.jenjang === jenjang)
    , [sarprasData, wilayah, jenjang]);

    const filteredProposal = useMemo(() =>
        proposalData.filter(p => wilayah.includes(p.kecamatan) && p.jenjang === jenjang)
    , [proposalData, wilayah, jenjang]);

    const jumlahSekolah = useMemo(() =>
        sekolahList.filter(s => wilayah.includes(s.kecamatan) && s.jenjang === jenjang).length
    , [sekolahList, wilayah, jenjang]);

    // Sarpras stats
    const sarprasStats = useMemo(() => ({
        total: filteredSarpras.length,
        baik: filteredSarpras.filter(s => s.kondisi === 'BAIK').length,
        rr: filteredSarpras.filter(s => s.kondisi === 'RUSAK RINGAN').length,
        rs: filteredSarpras.filter(s => s.kondisi === 'RUSAK SEDANG').length,
        rb: filteredSarpras.filter(s => s.kondisi === 'RUSAK BERAT').length,
    }), [filteredSarpras]);

    // Proposal stats
    const proposalStats = useMemo(() => ({
        menunggu: filteredProposal.filter(p => p.status === 'Menunggu Verifikasi').length,
        disetujui: filteredProposal.filter(p => p.status === 'Disetujui').length,
        ditolak: filteredProposal.filter(p => p.status === 'Ditolak').length,
        revisi: filteredProposal.filter(p => p.status === 'Revisi').length,
    }), [filteredProposal]);

    // Recap per jenis prasarana
    const sarprasRecap = useMemo(() => {
        const map = {};
        filteredSarpras.forEach(s => {
            const jenis = s.jenisPrasarana || 'Lainnya';
            if (!map[jenis]) map[jenis] = { jenis, total: 0, baik: 0, rr: 0, rs: 0, rb: 0 };
            map[jenis].total++;
            if (s.kondisi === 'BAIK') map[jenis].baik++;
            else if (s.kondisi === 'RUSAK RINGAN') map[jenis].rr++;
            else if (s.kondisi === 'RUSAK SEDANG') map[jenis].rs++;
            else if (s.kondisi === 'RUSAK BERAT') map[jenis].rb++;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [filteredSarpras]);

    // Bar chart data (kondisi sarpras)
    const barData = {
        labels: ['BAIK', 'RUSAK RINGAN', 'RUSAK SEDANG', 'RUSAK BERAT'],
        datasets: [{
            label: 'Jumlah',
            data: [sarprasStats.baik, sarprasStats.rr, sarprasStats.rs, sarprasStats.rb],
            backgroundColor: ['#22c55e', '#3b82f6', '#f97316', '#ef4444'],
            borderRadius: 6, borderSkipped: false,
        }]
    };
    const barOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
            y: { grid: { color: 'rgba(100,116,139,0.1)' }, ticks: { color: '#64748b', font: { size: 11 } } },
        }
    };

    // Pie chart data (proposal)
    const pieData = {
        labels: ['Menunggu', 'Disetujui', 'Ditolak', 'Revisi'],
        datasets: [{
            data: [proposalStats.menunggu, proposalStats.disetujui, proposalStats.ditolak, proposalStats.revisi],
            backgroundColor: ['#eab308', '#22c55e', '#ef4444', '#f97316'], borderWidth: 0,
        }]
    };
    const pieOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } } }
    };

    const topProposals = [...filteredProposal].sort((a, b) => (b.bintang || 0) - (a.bintang || 0)).slice(0, 5);

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
                <div className="stat-card total">
                    <div className="stat-label"><Database size={14} style={{ color: 'var(--accent-blue)' }} /> Total Sarpras</div>
                    <div className="stat-value">{formatNumber(sarprasStats.total)}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
                    <div className="stat-label"><Building2 size={14} style={{ color: 'var(--accent-purple)' }} /> Jumlah Sekolah</div>
                    <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>{formatNumber(jumlahSekolah)}</div>
                </div>
                <div className="stat-card baik">
                    <div className="stat-label"><CheckCircle size={14} style={{ color: 'var(--status-baik)' }} /> Baik</div>
                    <div className="stat-value" style={{ color: 'var(--status-baik)' }}>{formatNumber(sarprasStats.baik)}</div>
                </div>
                <div className="stat-card rusak-ringan">
                    <div className="stat-label"><AlertCircle size={14} style={{ color: 'var(--status-rusak-ringan)' }} /> Rusak Ringan</div>
                    <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{formatNumber(sarprasStats.rr)}</div>
                </div>
                <div className="stat-card rusak-sedang">
                    <div className="stat-label"><AlertCircle size={14} style={{ color: 'var(--status-rusak-sedang)' }} /> Rusak Sedang</div>
                    <div className="stat-value" style={{ color: 'var(--accent-orange)' }}>{formatNumber(sarprasStats.rs)}</div>
                </div>
                <div className="stat-card rusak-berat">
                    <div className="stat-label"><AlertCircle size={14} style={{ color: 'var(--status-rusak-berat)' }} /> Rusak Berat</div>
                    <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{formatNumber(sarprasStats.rb)}</div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-grid" style={{ marginBottom: 24 }}>
                <div className="summary-card">
                    <div className="summary-card-header">
                        <div className="summary-card-title">Rekap Sarpras {jenjang}</div>
                        <div className="summary-card-icon" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}><Building2 size={16} /></div>
                    </div>
                    <div className="summary-card-value">{formatNumber(sarprasStats.total)}</div>
                    <ul className="summary-card-list">
                        <li><span className="dot" style={{ background: 'var(--status-baik)' }} /> Baik: {sarprasStats.baik}</li>
                        <li><span className="dot" style={{ background: 'var(--status-rusak-ringan)' }} /> R. Ringan: {sarprasStats.rr}</li>
                        <li><span className="dot" style={{ background: 'var(--status-rusak-sedang)' }} /> R. Sedang: {sarprasStats.rs}</li>
                        <li><span className="dot" style={{ background: 'var(--status-rusak-berat)' }} /> R. Berat: {sarprasStats.rb}</li>
                    </ul>
                </div>
                <div className="summary-card">
                    <div className="summary-card-header">
                        <div className="summary-card-title">Rekap Usulan {jenjang}</div>
                        <div className="summary-card-icon" style={{ background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)' }}><FileText size={16} /></div>
                    </div>
                    <div className="summary-card-value">{filteredProposal.length}</div>
                    <ul className="summary-card-list">
                        <li><span className="dot" style={{ background: 'var(--proposal-menunggu)' }} /> Menunggu: {proposalStats.menunggu}</li>
                        <li><span className="dot" style={{ background: 'var(--proposal-disetujui)' }} /> Disetujui: {proposalStats.disetujui}</li>
                        <li><span className="dot" style={{ background: 'var(--proposal-ditolak)' }} /> Ditolak: {proposalStats.ditolak}</li>
                        <li><span className="dot" style={{ background: 'var(--proposal-revisi)' }} /> Revisi: {proposalStats.revisi}</li>
                    </ul>
                </div>
                <div className="summary-card">
                    <div className="summary-card-header">
                        <div className="summary-card-title">Top 5 Prioritas</div>
                        <div className="summary-card-icon" style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--accent-yellow)' }}><Star size={16} /></div>
                    </div>
                    <ul className="summary-card-list">
                        {topProposals.map((p, i) => (
                            <li key={p.id} style={{ justifyContent: 'space-between' }}>
                                <span>{i + 1}. {p.namaSekolah}</span>
                                <span style={{ color: 'var(--accent-yellow)' }}>{'★'.repeat(p.bintang || 0)}</span>
                            </li>
                        ))}
                        {topProposals.length === 0 && <li style={{ color: 'var(--text-secondary)' }}>Belum ada data</li>}
                    </ul>
                </div>
            </div>

            {/* Charts */}
            <div className="charts-grid" style={{ marginBottom: 24 }}>
                <div className="chart-card">
                    <div className="chart-header">
                        <div className="chart-title">Grafik Kondisi Sarpras ({jenjang})</div>
                    </div>
                    <div style={{ height: 280 }}>
                        <Bar data={barData} options={barOptions} />
                    </div>
                </div>
                <div className="chart-card">
                    <div className="chart-header">
                        <div className="chart-title">Grafik Proposal ({jenjang})</div>
                    </div>
                    <div style={{ height: 280 }}>
                        <Pie data={pieData} options={pieOptions} />
                    </div>
                </div>
            </div>

            {/* Rekapitulasi per Jenis Prasarana */}
            <div className="table-container" style={{ marginBottom: 24 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={16} style={{ color: '#3b82f6' }} />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Rekapitulasi Sarpras per Jenis Prasarana ({jenjang})</h3>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sarprasStats.total} item</span>
                </div>
                {sarprasRecap.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <Database size={32} style={{ opacity: 0.2, marginBottom: 8 }} /><br />
                        Belum ada data sarpras
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Jenis Prasarana</th>
                                    <th style={{ textAlign: 'center' }}>Jumlah</th>
                                    <th style={{ textAlign: 'center' }}>Baik</th>
                                    <th style={{ textAlign: 'center' }}>R. Ringan</th>
                                    <th style={{ textAlign: 'center' }}>R. Sedang</th>
                                    <th style={{ textAlign: 'center' }}>R. Berat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sarprasRecap.map((r, i) => (
                                    <tr key={r.jenis}>
                                        <td>{i + 1}</td>
                                        <td style={{ fontWeight: 500 }}>{r.jenis}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.total}</td>
                                        <td style={{ textAlign: 'center' }}><span style={{ color: '#22c55e', fontWeight: 600 }}>{r.baik || '-'}</span></td>
                                        <td style={{ textAlign: 'center' }}><span style={{ color: '#3b82f6', fontWeight: 600 }}>{r.rr || '-'}</span></td>
                                        <td style={{ textAlign: 'center' }}><span style={{ color: '#f59e0b', fontWeight: 600 }}>{r.rs || '-'}</span></td>
                                        <td style={{ textAlign: 'center' }}><span style={{ color: '#ef4444', fontWeight: 600 }}>{r.rb || '-'}</span></td>
                                    </tr>
                                ))}
                                <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                                    <td></td>
                                    <td>Total</td>
                                    <td style={{ textAlign: 'center' }}>{sarprasStats.total}</td>
                                    <td style={{ textAlign: 'center', color: '#22c55e' }}>{sarprasStats.baik}</td>
                                    <td style={{ textAlign: 'center', color: '#3b82f6' }}>{sarprasStats.rr}</td>
                                    <td style={{ textAlign: 'center', color: '#f59e0b' }}>{sarprasStats.rs}</td>
                                    <td style={{ textAlign: 'center', color: '#ef4444' }}>{sarprasStats.rb}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
export default DashboardKorwil;
