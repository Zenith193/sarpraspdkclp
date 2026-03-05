import { useMemo, useState } from 'react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { Building2, FileText, Star, AlertTriangle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { useSarprasData, useProposalData } from '../../data/dataProvider';
import { formatNumber } from '../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const DashboardKorwil = () => {
    const user = useAuthStore(s => s.user);
    const wilayah = user?.wilayah || [];
    const jenjang = user?.jenjang || 'SD';

    const { data: sarprasData } = useSarprasData();
    const { data: proposalData } = useProposalData();

    const filteredSarpras = useMemo(() =>
        sarprasData.filter(s => wilayah.includes(s.kecamatan) && s.jenjang === jenjang)
        , [sarprasData, wilayah, jenjang]);

    const filteredProposal = useMemo(() =>
        proposalData.filter(p => wilayah.includes(p.kecamatan) && p.jenjang === jenjang)
        , [proposalData, wilayah, jenjang]);

    const sarprasStats = {
        total: filteredSarpras.length,
        baik: filteredSarpras.filter(s => s.kondisi === 'BAIK').length,
        rr: filteredSarpras.filter(s => s.kondisi === 'RUSAK RINGAN').length,
        rs: filteredSarpras.filter(s => s.kondisi === 'RUSAK SEDANG').length,
        rb: filteredSarpras.filter(s => s.kondisi === 'RUSAK BERAT').length,
    };

    const proposalStats = {
        menunggu: filteredProposal.filter(p => p.status === 'Menunggu Verifikasi').length,
        disetujui: filteredProposal.filter(p => p.status === 'Disetujui').length,
        ditolak: filteredProposal.filter(p => p.status === 'Ditolak').length,
        revisi: filteredProposal.filter(p => p.status === 'Revisi').length,
    };

    const pieData = {
        labels: ['Menunggu', 'Disetujui', 'Ditolak', 'Revisi'],
        datasets: [{ data: [proposalStats.menunggu, proposalStats.disetujui, proposalStats.ditolak, proposalStats.revisi], backgroundColor: ['#eab308', '#22c55e', '#ef4444', '#f97316'], borderWidth: 0 }]
    };

    const topProposals = [...filteredProposal].sort((a, b) => b.bintang - a.bintang).slice(0, 5);

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard Korwil</h1>
                    <p>Sugeng Rawuh, {user?.namaAkun} ({user?.role?.toLowerCase()}) — Wilayah: {wilayah.join(', ')} ({jenjang})</p>
                </div>
            </div>

            <div className="summary-grid">
                <div className="summary-card">
                    <div className="summary-card-header">
                        <div className="summary-card-title">Rekap Sarpras {jenjang}</div>
                        <div className="summary-card-icon" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}><Building2 size={16} /></div>
                    </div>
                    <div className="summary-card-value">{formatNumber(sarprasStats.total)}</div>
                    <ul className="summary-card-list">
                        <li><span className="dot" style={{ background: 'var(--status-baik)' }} /> Baik: {sarprasStats.baik}</li>
                        <li><span className="dot" style={{ background: 'var(--status-rusak-ringan)' }} /> RR: {sarprasStats.rr}</li>
                        <li><span className="dot" style={{ background: 'var(--status-rusak-sedang)' }} /> RS: {sarprasStats.rs}</li>
                        <li><span className="dot" style={{ background: 'var(--status-rusak-berat)' }} /> RB: {sarprasStats.rb}</li>
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
                        <div className="summary-card-title">Status Proposal</div>
                        <div className="summary-card-icon" style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--accent-yellow)' }}><AlertTriangle size={16} /></div>
                    </div>
                    <div style={{ height: 140 }}>
                        <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                    </div>
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
                                <span style={{ color: 'var(--accent-yellow)' }}>{'★'.repeat(p.bintang)}</span>
                            </li>
                        ))}
                        {topProposals.length === 0 && <li style={{ color: 'var(--text-secondary)' }}>Belum ada data</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};
export default DashboardKorwil;
