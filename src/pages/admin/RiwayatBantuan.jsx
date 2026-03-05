import { useState, useMemo, useEffect } from 'react';
import { Search, Download, Eye, ChevronLeft, ChevronRight, FileText, Printer, Wallet, Package } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import useMatrikStore from '../../store/matrikStore';
import useAuthStore from '../../store/authStore';

const formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch (e) { return '-'; }
};

const RiwayatBantuan = ({ readOnly = false }) => {
    const bastData = useMatrikStore(s => s.bastData);
    const user = useAuthStore(s => s.user);
    const role = user?.role?.toLowerCase();
    const npsn = user?.npsn || user?.email;

    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewItem, setViewItem] = useState(null);

    // Filter by NPSN for sekolah role, show all for admin/verifikator/korwil
    const data = useMemo(() => {
        let items = bastData || [];
        if (readOnly && role === 'sekolah' && npsn) {
            items = items.filter(b => b.npsn === npsn);
        }
        return items;
    }, [bastData, readOnly, role, npsn]);

    // Search
    const filtered = useMemo(() => {
        if (!search) return data;
        const q = search.toLowerCase();
        return data.filter(d =>
            d.namaSekolah?.toLowerCase().includes(q) ||
            d.npsn?.includes(q) ||
            d.namaPaket?.toLowerCase().includes(q) ||
            d.noBAST?.toLowerCase().includes(q) ||
            d.kepsek?.toLowerCase().includes(q)
        );
    }, [data, search]);

    // Stats
    const stats = useMemo(() => {
        const totalNilaiBAST = data.reduce((sum, b) => sum + (b.nilaiBAST || 0), 0);
        const uniqueNpsn = new Set(data.map(b => b.npsn)).size;
        return { total: data.length, totalNilaiBAST, uniqueNpsn };
    }, [data]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    useEffect(() => { setCurrentPage(1); }, [search, pageSize]);

    return (
        <div>
            {/* ===== STATS ===== */}
            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <FileText size={14} style={{ marginRight: 4 }} /> Total BAST
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>{stats.total}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <Wallet size={14} style={{ marginRight: 4 }} /> Total Nilai BAST
                    </div>
                    <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: '1.25rem' }}>{formatCurrency(stats.totalNilaiBAST)}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <Package size={14} style={{ marginRight: 4 }} /> {readOnly ? 'Paket Bantuan' : 'Sekolah Penerima'}
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>{readOnly ? stats.total : stats.uniqueNpsn}</div>
                </div>
            </div>

            <div className="page-header">
                <div className="page-header-left">
                    <h1>Riwayat Bantuan</h1>
                    <p>Data BAST yang sudah di-generate{readOnly ? ' untuk sekolah Anda' : ''}</p>
                </div>
            </div>
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari sekolah, paket, NPSN, BAST..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
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
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Nama Sekolah</th>
                                <th>NPSN</th>
                                <th>Nama Paket</th>
                                <th>No BAST</th>
                                <th style={{ textAlign: 'right' }}>Nilai BAST</th>
                                <th>Volume</th>
                                <th>Tanggal</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((d, i) => (
                                <tr key={d.id}>
                                    <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                    <td style={{ fontSize: '0.85rem' }}>{d.namaSekolah}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{d.npsn}</td>
                                    <td style={{ fontSize: '0.85rem', maxWidth: 220 }}>
                                        <div style={{ fontWeight: 500 }}>{d.namaPaket}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{d.jenisPengadaan}</div>
                                    </td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{d.noBAST}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--accent-green)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatCurrency(d.nilaiBAST)}</td>
                                    <td style={{ fontSize: '0.85rem' }}>{d.volume || '-'}</td>
                                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formatDateShort(d.tanggalGenerate)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" onClick={() => setViewItem(d)} title="Detail"><Eye size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {paginatedData.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        {data.length === 0 ? 'Belum ada BAST yang di-generate. Buat BAST terlebih dahulu di menu BAST.' : 'Tidak ada data ditemukan'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="table-pagination">
                    <div className="table-pagination-info">
                        Menampilkan {filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} data
                    </div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem' }}>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ===== VIEW DETAIL MODAL ===== */}
            {viewItem && (
                <div className="modal-overlay" onClick={() => setViewItem(null)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Detail Riwayat Bantuan</div>
                            <button className="modal-close" onClick={() => setViewItem(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                                {[
                                    { label: 'No BAST', value: viewItem.noBAST },
                                    { label: 'No Matrik', value: viewItem.noMatrik },
                                    { label: 'Nama Paket', value: viewItem.namaPaket },
                                    { label: 'Jenis Pengadaan', value: viewItem.jenisPengadaan },
                                    { label: 'Sekolah', value: viewItem.namaSekolah },
                                    { label: 'NPSN', value: viewItem.npsn },
                                    { label: 'Kepala Sekolah', value: viewItem.kepsek },
                                    { label: 'NIP', value: viewItem.nipKepsek },
                                    { label: 'Nilai BAST', value: formatCurrency(viewItem.nilaiBAST) },
                                    { label: 'Nilai Kontrak', value: formatCurrency(viewItem.nilaiKontrak) },
                                    { label: 'Honor', value: formatCurrency(viewItem.honor || 0) },
                                    { label: 'Volume', value: viewItem.volume || '-' },
                                    { label: 'Penyedia', value: viewItem.penyedia },
                                    { label: 'Sumber Dana', value: viewItem.sumberDana },
                                    { label: 'Tanggal Generate', value: formatDateShort(viewItem.tanggalGenerate) },
                                ].map(item => (
                                    <div key={item.label}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{item.label}</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.value || '-'}</div>
                                    </div>
                                ))}
                            </div>
                            {viewItem.terbilangBAST && (
                                <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Terbilang</div>
                                    <div style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>{viewItem.terbilangBAST}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RiwayatBantuan;