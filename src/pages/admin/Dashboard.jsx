import { useMemo, useState, useRef, useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, ArcElement,
    Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { Building2, AlertTriangle, FileText, DollarSign, Download, Search, FileSpreadsheet, FileDown, ChevronDown } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { useSarprasData, useProposalData, useAktivitasData, useSekolahData, useProyeksiData } from '../../data/dataProvider';
import { useApi } from '../../api/hooks';
import { proyeksiApi } from '../../api/index';
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
    const [chartYear, setChartYear] = useState(String(new Date().getFullYear()));
    const [searchAktivitas, setSearchAktivitas] = useState('');
    const [aktPageSize, setAktPageSize] = useState(10);
    const [aktPage, setAktPage] = useState(1);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showExportAktivitas, setShowExportAktivitas] = useState(false);
    const exportRef = useRef(null);
    const exportAktRef = useRef(null);

    const { data: sarprasData } = useSarprasData();
    const { data: proposalData } = useProposalData();
    const { data: aktivitasData } = useAktivitasData();
    const { data: sekolahList } = useSekolahData();
    const { data: proyeksiList } = useProyeksiData();
    const { data: snpApiData } = useApi(() => proyeksiApi.listSnp(), []);

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

    // Rekapitulasi calculation (same logic as ProyeksiAnggaran)
    const anggaranData = proyeksiList || [];
    const snpData = (snpApiData?.data) ? snpApiData.data : (Array.isArray(snpApiData) ? snpApiData : []);

    const globalStats = useMemo(() => {
        const sekolahMap = {};
        (sekolahList || []).forEach(s => {
            sekolahMap[s.id] = { ...s, rombel: s.rombel || 0, prasaranaCount: {}, rehabGroup: {}, biayaRS: 0, biayaRB: 0, biayaBuild: 0 };
        });
        (sarprasData || []).forEach(sp => {
            const sk = sekolahMap[sp.sekolahId];
            if (!sk) return;
            sk.prasaranaCount[sp.jenisPrasarana] = (sk.prasaranaCount[sp.jenisPrasarana] || 0) + 1;
            if (sp.kondisi === 'RUSAK SEDANG' || sp.kondisi === 'RUSAK BERAT') {
                const isBerat = sp.kondisi === 'RUSAK BERAT';
                const key = `${sp.jenisPrasarana}|${isBerat ? 'berat' : 'sedang'}`;
                const angg = anggaranData.find(a => a.jenisPrasarana === sp.jenisPrasarana && a.jenjang === sk.jenjang);
                const unitCost = angg ? angg[isBerat ? 'rusakBerat' : 'rusakSedang'] : (isBerat ? 100_000_000 : 75_000_000);
                if (!sk.rehabGroup[key]) sk.rehabGroup[key] = { kondisi: isBerat ? 'berat' : 'sedang', count: 0, unitCost };
                sk.rehabGroup[key].count++;
            }
        });
        let tRS = 0, tRB = 0, tBuild = 0;
        Object.values(sekolahMap).forEach(sk => {
            Object.values(sk.rehabGroup).forEach(grp => {
                const cost = grp.count * grp.unitCost;
                if (grp.kondisi === 'berat') sk.biayaRB += cost; else sk.biayaRS += cost;
            });
            const defKelas = sk.rombel - (sk.prasaranaCount['Ruang Kelas'] || 0);
            if (defKelas > 0) { const c = (anggaranData.find(a => a.jenisPrasarana === 'Ruang Kelas' && a.jenjang === sk.jenjang)?.pembangunan || 150_000_000); sk.biayaBuild += defKelas * c; }
            const defToilet = Math.max(0, sk.rombel - 1) - (sk.prasaranaCount['Toilet'] || 0);
            if (defToilet > 0) { const c = (anggaranData.find(a => a.jenisPrasarana === 'Toilet' && a.jenjang === sk.jenjang)?.pembangunan || 50_000_000); sk.biayaBuild += defToilet * c; }
            snpData.forEach(snp => {
                if (snp.jenjang !== sk.jenjang || snp.jenisPrasarana === 'Ruang Kelas' || snp.jenisPrasarana === 'Toilet') return;
                if ((sk.prasaranaCount[snp.jenisPrasarana] || 0) === 0) {
                    sk.biayaBuild += (anggaranData.find(a => a.jenisPrasarana === snp.jenisPrasarana && a.jenjang === sk.jenjang)?.pembangunan || 100_000_000);
                }
            });
            tRS += sk.biayaRS; tRB += sk.biayaRB; tBuild += sk.biayaBuild;
        });
        return { totalRS: tRS, totalRB: tRB, totalBuild: tBuild, grandTotal: tRS + tRB + tBuild };
    }, [sarprasData, sekolahList, anggaranData, snpData]);

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
        { header: 'Waktu', accessor: (r) => formatDateTime(r.createdAt) },
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
    const aktTotalPages = Math.ceil(filteredAktivitas.length / aktPageSize) || 1;
    const pagedAktivitas = filteredAktivitas.slice((aktPage - 1) * aktPageSize, aktPage * aktPageSize);

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
                        {[0, 1, 2, 3].map(offset => {
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
                    <div className="summary-card-value" style={{ color: 'var(--accent-green)', fontSize: 14 }}>{formatCurrency(globalStats.grandTotal)}</div>
                    <ul className="summary-card-list">
                        <li><span className="dot" style={{ background: 'var(--accent-orange)' }} /> R. Sedang: {formatCurrency(globalStats.totalRS)}</li>
                        <li><span className="dot" style={{ background: 'var(--accent-red)' }} /> R. Berat: {formatCurrency(globalStats.totalRB)}</li>
                        <li><span className="dot" style={{ background: 'var(--accent-blue)' }} /> Pembangunan: {formatCurrency(globalStats.totalBuild)}</li>
                    </ul>
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
                                {[0, 1, 2, 3].map(offset => {
                                    const y = new Date().getFullYear() - offset;
                                    return <option key={y} value={String(y)}>{y}</option>;
                                })}
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
                                {[0, 1, 2, 3].map(offset => {
                                    const y = new Date().getFullYear() - offset;
                                    return <option key={y} value={String(y)}>{y}</option>;
                                })}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Tampil:</span>
                            <select value={aktPageSize} onChange={(e) => { setAktPageSize(Number(e.target.value)); setAktPage(1); }} style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                <option value="10">10</option>
                                <option value="20">20</option>
                                <option value="50">50</option>
                                <option value="75">75</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input
                                placeholder="Cari aktivitas..."
                                value={searchAktivitas}
                                onChange={e => { setSearchAktivitas(e.target.value); setAktPage(1); }}
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
                                <th>Keterangan</th>
                                <th>Waktu</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedAktivitas.map((a, i) => (
                                <tr key={a.id}>
                                    <td>{(aktPage - 1) * aktPageSize + i + 1}</td>
                                    <td>{a.namaAkun}</td>
                                    <td><span className="badge badge-disetujui">{a.jenisAkun}</span></td>
                                    <td>{a.aktivitas}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 300 }}>{a.keterangan || '-'}</td>
                                    <td>{formatDateTime(a.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="table-pagination">
                    <div className="table-pagination-info" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Menampilkan {filteredAktivitas.length > 0 ? (aktPage - 1) * aktPageSize + 1 : 0}-{Math.min(aktPage * aktPageSize, filteredAktivitas.length)} dari {filteredAktivitas.length} data
                    </div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setAktPage(1)} disabled={aktPage === 1}>«</button>
                        <button onClick={() => setAktPage(p => Math.max(1, p - 1))} disabled={aktPage === 1}>‹</button>
                        <span style={{ fontSize: '0.8rem' }}>Hal {aktPage} dari {aktTotalPages}</span>
                        <button onClick={() => setAktPage(p => Math.min(aktTotalPages, p + 1))} disabled={aktPage === aktTotalPages}>›</button>
                        <button onClick={() => setAktPage(aktTotalPages)} disabled={aktPage === aktTotalPages}>»</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
