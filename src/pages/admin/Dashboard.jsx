import { useMemo, useState, useRef, useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, ArcElement,
    Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { Building2, AlertTriangle, FileText, DollarSign, Download, Search, FileSpreadsheet, FileDown, ChevronDown } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { useSarprasData, useProposalData, useAktivitasData } from '../../data/dataProvider';
import { formatNumber, formatDateTime, formatShortCurrency, formatCurrency } from '../../utils/formatters';
import { KECAMATAN, JENJANG } from '../../utils/constants';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import SearchableSelect from '../../components/ui/SearchableSelect';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const Dashboard = () => {
    const user = useAuthStore(s => s.user);
    const [filterKec, setFilterKec] = useState('');
    const [filterJenjang, setFilterJenjang] = useState('');
    const [chartYear, setChartYear] = useState('');
    const [searchAktivitas, setSearchAktivitas] = useState('');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showExportAktivitas, setShowExportAktivitas] = useState(false);
    const exportRef = useRef(null);
    const exportAktRef = useRef(null);

    const { data: sarprasData } = useSarprasData();
    const { data: proposalData } = useProposalData();
    const { data: aktivitasData } = useAktivitasData();

    // Close export menus on outside click
    useEffect(() => {
        const handler = (e) => {
            if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false);
            if (exportAktRef.current && !exportAktRef.current.contains(e.target)) setShowExportAktivitas(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filteredSarpras = useMemo(() => {
        return sarprasData.filter(s => {
            if (filterKec && s.kecamatan !== filterKec) return false;
            if (filterJenjang && s.jenjang !== filterJenjang) return false;
            if (chartYear && s.createdAt) {
                const year = new Date(s.createdAt).getFullYear().toString();
                if (year !== chartYear) return false;
            }
            return true;
        });
    }, [sarprasData, filterKec, filterJenjang, chartYear]);

    const filteredProposal = useMemo(() => {
        return proposalData.filter(p => {
            if (filterKec && p.kecamatan !== filterKec) return false;
            if (filterJenjang && p.jenjang !== filterJenjang) return false;
            if (chartYear && p.createdAt) {
                const year = new Date(p.createdAt).getFullYear().toString();
                if (year !== chartYear) return false;
            }
            return true;
        });
    }, [filterKec, filterJenjang, chartYear]);

    const sarprasStats = useMemo(() => {
        const total = filteredSarpras.length;
        const baik = filteredSarpras.filter(s => s.kondisi === 'BAIK').length;
        const rr = filteredSarpras.filter(s => s.kondisi === 'RUSAK RINGAN').length;
        const rs = filteredSarpras.filter(s => s.kondisi === 'RUSAK SEDANG').length;
        const rb = filteredSarpras.filter(s => s.kondisi === 'RUSAK BERAT').length;
        return { total, baik, rr, rs, rb };
    }, [filteredSarpras]);

    const proposalStats = useMemo(() => {
        const menunggu = filteredProposal.filter(p => p.status === 'Menunggu Verifikasi').length;
        const disetujui = filteredProposal.filter(p => p.status === 'Disetujui').length;
        const ditolak = filteredProposal.filter(p => p.status === 'Ditolak').length;
        const revisi = filteredProposal.filter(p => p.status === 'Revisi').length;
        return { menunggu, disetujui, ditolak, revisi };
    }, [filteredProposal]);

    const estimasiBiaya = useMemo(() => {
        const rs = filteredSarpras.filter(s => s.kondisi === 'RUSAK SEDANG').length * 75_000_000;
        const rb = filteredSarpras.filter(s => s.kondisi === 'RUSAK BERAT').length * 100_000_000;
        return rs + rb;
    }, [filteredSarpras]);

    // ---- EXPORT FUNCTIONS ----

    // Column definitions for Sarpras export
    const sarprasExportCols = [
        { header: 'No', accessor: (_, i) => i + 1 },
        { header: 'Nama Sekolah', key: 'namaSekolah' },
        { header: 'NPSN', key: 'npsn' },
        { header: 'Kecamatan', key: 'kecamatan' },
        { header: 'Jenjang', key: 'jenjang' },
        { header: 'Jenis Prasarana', key: 'jenisPrasarana' },
        { header: 'Nama Ruang', key: 'namaRuang' },
        { header: 'Kondisi', key: 'kondisi' },
        { header: 'Luas (m²)', accessor: (r) => r.luas },
    ];

    const handleExportLaporan = (format) => {
        const filterLabel = filterKec ? `_${filterKec}` : '';
        const jenjangLabel = filterJenjang ? `_${filterJenjang}` : '';
        const filename = `laporan_sarpras${filterLabel}${jenjangLabel}`;
        const title = `Laporan Rekapitulasi Sarpras${filterKec ? ' - ' + filterKec : ''}${filterJenjang ? ' - ' + filterJenjang : ''}`;

        // Numbered accessor
        const numberedCols = sarprasExportCols.map(col => {
            if (col.header === 'No') {
                return { ...col, accessor: (row) => filteredSarpras.indexOf(row) + 1 };
            }
            return col;
        });

        try {
            if (format === 'excel') {
                exportToExcel(filteredSarpras, numberedCols, filename);
                toast.success('Berhasil mengekspor ke Excel');
            } else if (format === 'csv') {
                exportToCSV(filteredSarpras, numberedCols, filename);
                toast.success('Berhasil mengekspor ke CSV');
            } else if (format === 'pdf') {
                exportToPDF(filteredSarpras, numberedCols, filename, title);
                toast.success('Berhasil mengekspor ke PDF');
            }
        } catch (err) {
            toast.error('Gagal mengekspor: ' + err.message);
        }
        setShowExportMenu(false);
    };

    // Column definitions for Aktivitas export
    const aktivitasExportCols = [
        { header: 'No', accessor: (_, i) => i + 1 },
        { header: 'Nama Pengguna', key: 'namaAkun' },
        { header: 'Jenis Akun', key: 'jenisAkun' },
        { header: 'Aktivitas', key: 'aktivitas' },
        { header: 'Waktu', accessor: (r) => formatDateTime(r.waktu) },
    ];

    const handleExportAktivitas = (format) => {
        const filename = 'aktivitas_pengguna';
        const title = 'Laporan Aktivitas Pengguna';

        const numberedCols = aktivitasExportCols.map(col => {
            if (col.header === 'No') {
                return { ...col, accessor: (row) => filteredAktivitas.indexOf(row) + 1 };
            }
            return col;
        });

        try {
            if (format === 'excel') {
                exportToExcel(filteredAktivitas, numberedCols, filename);
                toast.success('Berhasil mengekspor ke Excel');
            } else if (format === 'csv') {
                exportToCSV(filteredAktivitas, numberedCols, filename);
                toast.success('Berhasil mengekspor ke CSV');
            } else if (format === 'pdf') {
                exportToPDF(filteredAktivitas, numberedCols, filename, title);
                toast.success('Berhasil mengekspor ke PDF');
            }
        } catch (err) {
            toast.error('Gagal mengekspor: ' + err.message);
        }
        setShowExportAktivitas(false);
    };

    // Bar Chart Data
    const barData = {
        labels: ['BAIK', 'RUSAK RINGAN', 'RUSAK SEDANG', 'RUSAK BERAT'],
        datasets: [{
            label: 'Jumlah Sarpras',
            data: [sarprasStats.baik, sarprasStats.rr, sarprasStats.rs, sarprasStats.rb],
            backgroundColor: ['#22c55e', '#3b82f6', '#f97316', '#ef4444'],
            borderRadius: 6,
            borderSkipped: false,
        }]
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
            y: { grid: { color: 'rgba(100,116,139,0.1)' }, ticks: { color: '#64748b', font: { size: 11 } } },
        }
    };

    // Pie Chart Data
    const pieData = {
        labels: ['Menunggu', 'Disetujui', 'Ditolak', 'Revisi'],
        datasets: [{
            data: [proposalStats.menunggu, proposalStats.disetujui, proposalStats.ditolak, proposalStats.revisi],
            backgroundColor: ['#eab308', '#22c55e', '#ef4444', '#f97316'],
            borderWidth: 0,
        }]
    };

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#94a3b8', font: { size: 11 }, padding: 16, usePointStyle: true, pointStyleWidth: 8 }
            }
        }
    };

    const filteredAktivitas = (aktivitasData || []).filter(a =>
        a.namaAkun.toLowerCase().includes(searchAktivitas.toLowerCase()) ||
        a.aktivitas.toLowerCase().includes(searchAktivitas.toLowerCase())
    );

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard</h1>
                    <p>Sugeng Rawuh, {user?.namaAkun} ({user?.role?.toLowerCase()})</p>
                </div>
                <div className="page-header-right">
                    <div className="export-dropdown" ref={exportRef}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowExportMenu(!showExportMenu)}
                        >
                            <Download size={16} /> Ekspor Laporan <ChevronDown size={14} />
                        </button>
                        {showExportMenu && (
                            <div className="dropdown-menu">
                                <button className="dropdown-item" onClick={() => handleExportLaporan('excel')}>
                                    <span className="export-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                                        <FileSpreadsheet size={14} />
                                    </span>
                                    Ekspor ke Excel
                                </button>
                                <button className="dropdown-item" onClick={() => handleExportLaporan('csv')}>
                                    <span className="export-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                                        <FileDown size={14} />
                                    </span>
                                    Ekspor ke CSV
                                </button>
                                <button className="dropdown-item" onClick={() => handleExportLaporan('pdf')}>
                                    <span className="export-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                        <FileText size={14} />
                                    </span>
                                    Ekspor ke PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Rekap Sarpras Card */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-title">
                    <Building2 size={18} className="card-icon" />
                    Rekapitulasi Kondisi Sarpras Keseluruhan
                </div>
                <div className="filter-bar" style={{ marginBottom: 16 }}>
                    <SearchableSelect
                        options={KECAMATAN}
                        value={filterKec}
                        onChange={setFilterKec}
                        placeholder="Semua Kecamatan"
                        searchPlaceholder="Cari kecamatan..."
                    />
                    <select value={filterJenjang} onChange={e => setFilterJenjang(e.target.value)}>
                        <option value="">Semua Jenjang</option>
                        {JENJANG.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                    <select value={chartYear} onChange={e => setChartYear(e.target.value)}>
                        <option value="">Semua Tahun</option>
                        {[0, 1, 2].map(offset => {
                            const y = new Date().getFullYear() - offset;
                            return <option key={y} value={String(y)}>{y}</option>;
                        })}
                    </select>
                </div>

                <div className="stats-grid">
                    <div className="stat-card total">
                        <div className="stat-label">Total Sarpras</div>
                        <div className="stat-value">{formatNumber(sarprasStats.total)}</div>
                        <div className="stat-desc">Data dari database</div>
                    </div>
                    <div className="stat-card baik">
                        <div className="stat-label"><span className="stat-dot" style={{ background: 'var(--status-baik)' }} /> Baik</div>
                        <div className="stat-value">{formatNumber(sarprasStats.baik)}</div>
                        <div className="stat-desc">{sarprasStats.total ? ((sarprasStats.baik / sarprasStats.total) * 100).toFixed(1) : 0}% dari total</div>
                    </div>
                    <div className="stat-card rusak-ringan">
                        <div className="stat-label"><span className="stat-dot" style={{ background: 'var(--status-rusak-ringan)' }} /> Rusak Ringan</div>
                        <div className="stat-value">{formatNumber(sarprasStats.rr)}</div>
                        <div className="stat-desc">{sarprasStats.total ? ((sarprasStats.rr / sarprasStats.total) * 100).toFixed(1) : 0}% dari total</div>
                    </div>
                    <div className="stat-card rusak-sedang">
                        <div className="stat-label"><span className="stat-dot" style={{ background: 'var(--status-rusak-sedang)' }} /> Rusak Sedang</div>
                        <div className="stat-value">{formatNumber(sarprasStats.rs)}</div>
                        <div className="stat-desc">{sarprasStats.total ? ((sarprasStats.rs / sarprasStats.total) * 100).toFixed(1) : 0}% dari total</div>
                    </div>
                    <div className="stat-card rusak-berat">
                        <div className="stat-label"><span className="stat-dot" style={{ background: 'var(--status-rusak-berat)' }} /> Rusak Berat</div>
                        <div className="stat-value">{formatNumber(sarprasStats.rb)}</div>
                        <div className="stat-desc">{sarprasStats.total ? ((sarprasStats.rb / sarprasStats.total) * 100).toFixed(1) : 0}% dari total</div>
                    </div>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="summary-grid">
                <div className="summary-card">
                    <div className="summary-card-header">
                        <div className="summary-card-title">Total Input Data</div>
                        <div className="summary-card-icon" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}><Building2 size={16} /></div>
                    </div>
                    <div className="summary-card-value">{formatNumber(sarprasStats.total)}</div>
                    <div className="summary-card-desc">Data sarpras dari database</div>
                </div>
                <div className="summary-card">
                    <div className="summary-card-header">
                        <div className="summary-card-title">Kondisi Sarpras</div>
                        <div className="summary-card-icon" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--accent-orange)' }}><AlertTriangle size={16} /></div>
                    </div>
                    <ul className="summary-card-list">
                        <li><span className="dot" style={{ background: 'var(--status-baik)' }} /> Baik: {formatNumber(sarprasStats.baik)}</li>
                        <li><span className="dot" style={{ background: 'var(--status-rusak-ringan)' }} /> Rusak Ringan: {formatNumber(sarprasStats.rr)}</li>
                        <li><span className="dot" style={{ background: 'var(--status-rusak-sedang)' }} /> Rusak Sedang: {formatNumber(sarprasStats.rs)}</li>
                        <li><span className="dot" style={{ background: 'var(--status-rusak-berat)' }} /> Rusak Berat: {formatNumber(sarprasStats.rb)}</li>
                    </ul>
                </div>
                <div className="summary-card">
                    <div className="summary-card-header">
                        <div className="summary-card-title">Proposal Masuk</div>
                        <div className="summary-card-icon" style={{ background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)' }}><FileText size={16} /></div>
                    </div>
                    <div className="summary-card-value">{filteredProposal.length}</div>
                    <ul className="summary-card-list">
                        <li><span className="dot" style={{ background: 'var(--proposal-menunggu)' }} /> Menunggu ({proposalStats.menunggu})</li>
                        <li><span className="dot" style={{ background: 'var(--proposal-disetujui)' }} /> Disetujui ({proposalStats.disetujui})</li>
                        <li><span className="dot" style={{ background: 'var(--proposal-ditolak)' }} /> Ditolak ({proposalStats.ditolak})</li>
                        <li><span className="dot" style={{ background: 'var(--proposal-revisi)' }} /> Revisi ({proposalStats.revisi})</li>
                    </ul>
                </div>
                <div className="summary-card">
                    <div className="summary-card-header">
                        <div className="summary-card-title">Kebutuhan Anggaran</div>
                        <div className="summary-card-icon" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--accent-green)' }}><DollarSign size={16} /></div>
                    </div>
                    <div className="summary-card-value" style={{ color: 'var(--accent-green)', fontSize: 20 }}>{formatShortCurrency(estimasiBiaya)}</div>
                    <div className="summary-card-desc">Estimasi perbaikan (RS/RB)</div>
                </div>
            </div>

            {/* Charts */}
            <div className="charts-grid">
                <div className="chart-card">
                    <div className="chart-header">
                        <div className="chart-title">Grafik Sarpras</div>
                        <div className="chart-filters">
                            <select value={filterJenjang} onChange={e => setFilterJenjang(e.target.value)}>
                                <option value="">Semua Jenjang</option>
                                {JENJANG.map(j => <option key={j} value={j}>{j}</option>)}
                            </select>
                            <select value={chartYear} onChange={e => setChartYear(e.target.value)}>
                                <option value="2025">2025</option>
                                <option value="2024">2024</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ height: 280 }}>
                        <Bar data={barData} options={barOptions} />
                    </div>
                </div>
                <div className="chart-card">
                    <div className="chart-header">
                        <div className="chart-title">Grafik Proposal</div>
                        <div className="chart-filters">
                            <select value={filterJenjang} onChange={e => setFilterJenjang(e.target.value)}>
                                <option value="">Semua Jenjang</option>
                                {JENJANG.map(j => <option key={j} value={j}>{j}</option>)}
                            </select>
                            <select value={chartYear} onChange={e => setChartYear(e.target.value)}>
                                <option value="2025">2025</option>
                                <option value="2024">2024</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ height: 280 }}>
                        <Pie data={pieData} options={pieOptions} />
                    </div>
                </div>
            </div>

            {/* Aktivitas Terkini */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Aktivitas Terkini</h3>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input
                                placeholder="Cari aktivitas..."
                                value={searchAktivitas}
                                onChange={e => setSearchAktivitas(e.target.value)}
                            />
                        </div>
                        <div className="export-dropdown" ref={exportAktRef}>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowExportAktivitas(!showExportAktivitas)}
                            >
                                <Download size={14} /> Ekspor <ChevronDown size={12} />
                            </button>
                            {showExportAktivitas && (
                                <div className="dropdown-menu">
                                    <button className="dropdown-item" onClick={() => handleExportAktivitas('excel')}>
                                        <span className="export-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                                            <FileSpreadsheet size={14} />
                                        </span>
                                        Excel
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExportAktivitas('csv')}>
                                        <span className="export-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                                            <FileDown size={14} />
                                        </span>
                                        CSV
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExportAktivitas('pdf')}>
                                        <span className="export-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                            <FileText size={14} />
                                        </span>
                                        PDF
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
                                <th>No</th>
                                <th>Nama Pengguna</th>
                                <th>Jenis Akun</th>
                                <th>Aktivitas</th>
                                <th>Waktu</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAktivitas.map((a, i) => (
                                <tr key={a.id}>
                                    <td>{i + 1}</td>
                                    <td>{a.namaAkun}</td>
                                    <td><span className="badge badge-disetujui">{a.jenisAkun}</span></td>
                                    <td>{a.aktivitas}</td>
                                    <td>{formatDateTime(a.waktu)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
