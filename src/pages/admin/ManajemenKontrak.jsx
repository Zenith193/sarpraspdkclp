import { useState, useEffect } from 'react';
import { ClipboardCheck, Eye, Search, X, CheckCircle, XCircle, Clock, Save, ChevronRight } from 'lucide-react';
import { kontrakApi } from '../../api';

// ===== Number to Terbilang (Indonesian) =====
const angka = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
const terbilangHelper = (n) => {
    if (n < 0) return 'Minus ' + terbilangHelper(-n);
    if (n < 12) return angka[n];
    if (n < 20) return angka[n - 10] + ' Belas';
    if (n < 100) return angka[Math.floor(n / 10)] + ' Puluh' + (n % 10 ? ' ' + angka[n % 10] : '');
    if (n < 200) return 'Seratus' + (n % 100 ? ' ' + terbilangHelper(n % 100) : '');
    if (n < 1000) return angka[Math.floor(n / 100)] + ' Ratus' + (n % 100 ? ' ' + terbilangHelper(n % 100) : '');
    if (n < 2000) return 'Seribu' + (n % 1000 ? ' ' + terbilangHelper(n % 1000) : '');
    if (n < 1000000) return terbilangHelper(Math.floor(n / 1000)) + ' Ribu' + (n % 1000 ? ' ' + terbilangHelper(n % 1000) : '');
    if (n < 1000000000) return terbilangHelper(Math.floor(n / 1000000)) + ' Juta' + (n % 1000000 ? ' ' + terbilangHelper(n % 1000000) : '');
    if (n < 1000000000000) return terbilangHelper(Math.floor(n / 1000000000)) + ' Miliar' + (n % 1000000000 ? ' ' + terbilangHelper(n % 1000000000) : '');
    return terbilangHelper(Math.floor(n / 1000000000000)) + ' Triliun' + (n % 1000000000000 ? ' ' + terbilangHelper(n % 1000000000000) : '');
};
const numberToTerbilang = (n) => { const v = Math.floor(Number(n)); if (!v || v <= 0) return ''; return terbilangHelper(v) + ' Rupiah'; };
const formatSeparator = (v) => { const n = String(v).replace(/\D/g, ''); return n ? Number(n).toLocaleString('id-ID') : ''; };
const parseSeparator = (v) => String(v).replace(/\./g, '').replace(/,/g, '');

const calcTanggalSelesai = (tglMulai, hari) => {
    if (!tglMulai || !hari) return '';
    const days = parseInt(hari);
    if (isNaN(days) || days <= 0) return '';
    const d = new Date(tglMulai);
    d.setDate(d.getDate() + days - 1);
    return d.toISOString().split('T')[0];
};

const statusBadge = (status) => {
    const map = {
        'Menunggu': { bg: 'rgba(251,191,36,0.12)', color: '#f59e0b', icon: Clock },
        'Diverifikasi': { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', icon: CheckCircle },
        'Ditolak': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', icon: XCircle },
    };
    const s = map[status] || map['Menunggu'];
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: '0.78rem', fontWeight: 600 }}>
            <s.icon size={13} /> {status}
        </span>
    );
};

const ManajemenKontrak = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('Menunggu');
    const [detail, setDetail] = useState(null);
    const [tab, setTab] = useState('data_dasar');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    // Verifikator edit fields
    const [spkData, setSpkData] = useState({});
    const [spSpmkData, setSpSpmkData] = useState({});
    const [agreed, setAgreed] = useState(false);

    const load = () => {
        setLoading(true);
        kontrakApi.listPermohonan().then(r => setData(Array.isArray(r) ? r : []))
            .catch(() => {}).finally(() => setLoading(false));
    };
    useEffect(load, []);

    const handleDetail = async (id) => {
        try {
            const res = await kontrakApi.getPermohonan(id);
            const d = res;
            setDetail(d);
            setTab('data_dasar');
            setAgreed(false);
            const nk = d.nilaiKontrak || d.matrik?.nilaiKontrak || '';
            const wp = d.waktuPenyelesaian || (d.matrik?.jangkaWaktu ? String(d.matrik.jangkaWaktu) : '');
            // Strip "hari kalender" text if present, keep only number
            const wpNum = String(wp).replace(/[^\d]/g, '') || '';
            const tglMulai = d.tanggalMulai || d.matrik?.tanggalMulai || '';
            const tglSelesai = d.tanggalSelesai || d.matrik?.tanggalSelesai || calcTanggalSelesai(tglMulai, wpNum);
            const tb = d.terbilangKontrak || d.matrik?.terbilangKontrak || numberToTerbilang(nk);
            setSpkData({
                noSpk: d.noSpk || d.matrik?.noSpk || '',
                nilaiKontrak: nk,
                terbilangKontrak: tb,
                tanggalMulai: tglMulai,
                tanggalSelesai: tglSelesai,
                waktuPenyelesaian: wpNum,
                tataCaraPembayaran: d.tataCaraPembayaran || '',
                uangMuka: d.uangMuka || '',
            });
            setSpSpmkData({
                noSp: d.noSp || '',
                tanggalSp: d.tanggalSp || '',
                idPaket: d.idPaket || d.kodeSirup || '',
            });
        } catch { }
    };

    const handleSaveSpk = async () => {
        if (!detail) return;
        setSaving(true);
        try {
            await kontrakApi.updatePermohonan(detail.id, { ...spkData, nilaiKontrak: Number(spkData.nilaiKontrak) || 0 });
            showToast('Data SPK berhasil disimpan');
        } catch { showToast('Gagal menyimpan SPK', true); }
        setSaving(false);
    };

    const handleSaveSpSpmk = async () => {
        if (!detail) return;
        setSaving(true);
        try {
            await kontrakApi.updatePermohonan(detail.id, spSpmkData);
            showToast('Data SP/SPMK berhasil disimpan');
        } catch { showToast('Gagal menyimpan SP/SPMK', true); }
        setSaving(false);
    };

    const handleVerify = async () => {
        if (!detail || !agreed) return;
        setSaving(true);
        try {
            await kontrakApi.updatePermohonan(detail.id, { status: 'Diverifikasi' });
            showToast('✅ Permohonan berhasil diterima');
            setDetail(null);
            load();
        } catch { showToast('Gagal memverifikasi', true); }
        setSaving(false);
    };

    const handleReject = async (id) => {
        if (!confirm('Yakin tolak permohonan ini?')) return;
        try {
            await kontrakApi.updatePermohonan(id, { status: 'Ditolak' });
            showToast('Permohonan ditolak');
            load();
        } catch { showToast('Gagal menolak', true); }
    };

    const showToast = (msg, isError) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const filtered = data.filter(d => {
        const q = search.toLowerCase();
        const matchSearch = (d.namaPaket || '').toLowerCase().includes(q) || (d.namaPerusahaan || '').toLowerCase().includes(q) || (d.kodeSirup || '').includes(q);
        if (filter === 'Semua') return matchSearch;
        return matchSearch && d.status === filter;
    });

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
    const formatCurrency = (v) => v ? `Rp. ${Number(v).toLocaleString('id-ID')}` : '-';
    const fieldStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' };
    const readOnlyStyle = { ...fieldStyle, background: 'var(--bg-tertiary, rgba(0,0,0,0.03))', color: 'var(--text-secondary)' };
    const labelStyle = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };

    const tabs = [
        { key: 'data_dasar', label: 'Data Dasar' },
        { key: 'spk', label: 'SPK' },
        { key: 'lampiran', label: 'Lampiran' },
        { key: 'sp_spmk', label: 'SP/SPMK' },
        { key: 'verifikasi', label: 'Verifikasi' },
    ];

    return (
        <div className="page-container">
            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '14px 24px', borderRadius: 12, background: toast.includes('Gagal') ? '#ef4444' : '#22c55e', color: '#fff', fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', animation: 'fadeIn 0.3s ease' }}>
                    {toast}
                </div>
            )}

            <div className="page-header">
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ClipboardCheck size={24} /> {filter === 'Menunggu' ? 'Verifikasi Permohonan Kontrak' : 'Riwayat Kontrak'}
                </h1>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {['Menunggu', 'Diverifikasi', 'Ditolak', 'Semua'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={filter === f ? 'btn btn-primary' : 'btn btn-outline'}
                        style={{ padding: '8px 16px', fontSize: '0.825rem' }}>
                        {f === 'Menunggu' ? '⏳ Perlu Verifikasi' : f === 'Diverifikasi' ? '✅ Diverifikasi' : f === 'Ditolak' ? '❌ Ditolak' : '📋 Semua'}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input style={{ ...fieldStyle, paddingLeft: 36 }} placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Memuat data...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Tidak ada data</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>AKSI</th>
                                <th>NAMA PERUSAHAAN</th>
                                <th>NAMA PAKET</th>
                                <th>JENIS PENGADAAN</th>
                                <th>METODE</th>
                                <th>STATUS</th>
                                <th>TANGGAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p, i) => (
                                <tr key={p.id}>
                                    <td>{i + 1}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {p.status === 'Menunggu' && (
                                                <button onClick={() => handleReject(p.id)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Tolak</button>
                                            )}
                                            <button onClick={() => handleDetail(p.id)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Detail</button>
                                        </div>
                                    </td>
                                    <td>{p.namaPerusahaan}</td>
                                    <td>{p.namaPaket}</td>
                                    <td>{p.jenisPengadaan}</td>
                                    <td>{p.metodePengadaan}</td>
                                    <td>{statusBadge(p.status)}</td>
                                    <td>{formatDate(p.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal with Tabs */}
            {detail && (() => {
                const cs = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' };
                const cl = { fontSize: '0.78rem', fontWeight: 600, color: '#22c55e', marginBottom: 4 };
                const cv = { fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 500 };
                const tabDone = { data_dasar: !!detail.kodeSirup, spk: !!spkData.noSpk, lampiran: !!(detail.noDppl || detail.noBahpl), sp_spmk: !!spSpmkData.noSp, verifikasi: detail.status === 'Diverifikasi' };
                return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setDetail(null)} />
                    <div style={{ position: 'relative', background: 'var(--bg-primary)', borderRadius: 16, width: 'min(92vw, 900px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        {/* Header */}
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>🏠 DETAIL PERMOHONAN KONTRAK</h3>
                            <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>

                        {/* Tab Bar - Lakon pill style */}
                        <div style={{ display: 'flex', gap: 8, padding: '14px 24px', flexWrap: 'wrap' }}>
                            {tabs.map(t => (
                                <button key={t.key} onClick={() => setTab(t.key)}
                                    style={{
                                        padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                                        background: tab === t.key ? 'var(--accent-blue)' : 'transparent',
                                        color: tab === t.key ? '#fff' : 'var(--text-secondary)',
                                        border: tab === t.key ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                                        borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
                                    }}>
                                    {t.label} {tabDone[t.key]
                                        ? <CheckCircle size={14} style={{ color: tab === t.key ? '#86efac' : '#22c55e' }} />
                                        : <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'rgba(239,68,68,0.2)', fontSize: '0.55rem', color: '#ef4444', fontWeight: 700 }}>✕</span>}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                            {/* DATA DASAR */}
                            {tab === 'data_dasar' && (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: '0.9rem' }}>Data Dasar Permohonan Kontrak</div>

                                    <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>👤 DIREKTUR</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                                        <div style={cs}><div style={cl}>Nama Direktur</div><div style={cv}>{detail.perusahaan?.namaPemilik || '-'}</div></div>
                                        <div style={cs}><div style={cl}>Alamat Direktur</div><div style={cv}>{detail.perusahaan?.alamatPemilik || '-'}</div></div>
                                    </div>

                                    <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>🏢 PERUSAHAAN</h4>
                                    <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Nama Perusahaan</div><div style={cv}>{detail.perusahaan?.namaPerusahaan || '-'}</div></div>
                                    <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>NPWP Perusahaan</div><div style={cv}>{detail.perusahaan?.npwp || '-'}</div></div>
                                    <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Alamat Perusahaan</div><div style={cv}>{detail.perusahaan?.alamatPerusahaan || '-'}</div></div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div style={cs}><div style={cl}>Nomor Telp</div><div style={cv}>{detail.perusahaan?.noTelp || '-'}</div></div>
                                        <div style={cs}><div style={cl}>Email</div><div style={cv}>{detail.perusahaan?.emailPerusahaan || '-'}</div></div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div style={cs}><div style={cl}>Nomor Akta Notaris</div><div style={cv}>{detail.perusahaan?.noAkta || '-'}</div></div>
                                        <div style={cs}><div style={cl}>Tanggal Akta Notaris</div><div style={cv}>{detail.perusahaan?.tanggalAkta || '-'}</div></div>
                                    </div>
                                    <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Nama Akta Notaris</div><div style={cv}>{detail.perusahaan?.namaNotaris || '-'}</div></div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                                        <div style={cs}><div style={cl}>Bank</div><div style={cv}>{detail.perusahaan?.bank || '-'}</div></div>
                                        <div style={cs}><div style={cl}>Rekening</div><div style={cv}>{detail.perusahaan?.noRekening || '-'} atas nama <strong>{detail.perusahaan?.namaRekening || '-'}</strong></div></div>
                                    </div>

                                    <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>⚙️ PAKET PEKERJAAN</h4>
                                    <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Kode Sirup</div><div style={cv}>{detail.kodeSirup || '-'}</div></div>
                                    <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Nama Paket</div><div style={cv}>{detail.namaPaket || '-'}</div></div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div style={cs}><div style={cl}>Jenis Pengadaan</div><div style={cv}>{detail.jenisPengadaan || '-'}</div></div>
                                        <div style={cs}><div style={cl}>Metode Pemilihan</div><div style={cv}>{detail.metodePengadaan || '-'}</div></div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div style={cs}><div style={cl}>Satuan Kerja</div><div style={cv}>{detail.matrik?.satuanKerja || 'DINAS PENDIDIKAN DAN KEBUDAYAAN KABUPATEN CILACAP'}</div></div>
                                        <div style={cs}><div style={cl}>Satuan Kerja</div><div style={cv}>{detail.matrik?.sumberDana || 'APBD'}</div></div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div style={cs}><div style={cl}>Nomor DPPL</div><div style={cv}>{detail.noDppl || '-'}</div></div>
                                        <div style={cs}><div style={cl}>Tanggal DPPL</div><div style={cv}>{formatDate(detail.tanggalDppl)}</div></div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div style={cs}><div style={cl}>Nomor BAHPL</div><div style={cv}>{detail.noBahpl || '-'}</div></div>
                                        <div style={cs}><div style={cl}>Tanggal BAHPL</div><div style={cv}>{formatDate(detail.tanggalBahpl)}</div></div>
                                    </div>
                                    {detail.berkasPenawaranPath && (
                                        <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Berkas Penawaran</div>
                                            <a href={detail.berkasPenawaranPath} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: '0.875rem' }}>📄 Lihat Dokumen PDF</a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SPK */}
                            {tab === 'spk' && (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: '0.9rem' }}>Surat Perintah Kerja</div>
                                    <div style={{ display: 'grid', gap: 12 }}>
                                        <div style={cs}><div style={cl}>Jenis Kontrak</div><div style={cv}>{detail.jenisPengadaan || '-'}</div></div>
                                        <div style={cs}><div style={cl}>Nomor SPK</div><input style={fieldStyle} value={spkData.noSpk} onChange={e => setSpkData({ ...spkData, noSpk: e.target.value })} placeholder="400.3.13/..." /></div>
                                        <div style={cs}><div style={cl}>Nilai Kontrak (Rp)</div><input style={fieldStyle} value={formatSeparator(spkData.nilaiKontrak)} onChange={e => { const raw = parseSeparator(e.target.value); const tb = numberToTerbilang(raw); setSpkData({ ...spkData, nilaiKontrak: raw, terbilangKontrak: tb }); }} placeholder="0" /></div>
                                        <div style={cs}><div style={cl}>Terbilang</div><div style={cv}>{spkData.terbilangKontrak || '-'}</div></div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div style={cs}><div style={cl}>Tanggal Mulai</div><input type="date" style={fieldStyle} value={spkData.tanggalMulai} onChange={e => { const tgl = e.target.value; const selesai = calcTanggalSelesai(tgl, spkData.waktuPenyelesaian); setSpkData({ ...spkData, tanggalMulai: tgl, tanggalSelesai: selesai }); }} /></div>
                                            <div style={cs}><div style={cl}>Tanggal Selesai</div><div style={cv}>{spkData.tanggalSelesai || '-'}</div></div>
                                        </div>
                                        <div style={cs}><div style={cl}>Waktu Penyelesaian (hari kalender)</div><input type="number" style={fieldStyle} value={spkData.waktuPenyelesaian} onChange={e => { const hari = e.target.value; const selesai = calcTanggalSelesai(spkData.tanggalMulai, hari); setSpkData({ ...spkData, waktuPenyelesaian: hari, tanggalSelesai: selesai }); }} placeholder="90" /></div>
                                        <div style={cs}><div style={cl}>Tata Cara Pembayaran</div><input style={fieldStyle} value={spkData.tataCaraPembayaran} onChange={e => setSpkData({ ...spkData, tataCaraPembayaran: e.target.value })} placeholder="Termin" /></div>
                                        <div style={cs}><div style={cl}>Uang Muka</div><input style={fieldStyle} value={spkData.uangMuka} onChange={e => setSpkData({ ...spkData, uangMuka: e.target.value })} placeholder="Tidak Ada / Ada" /></div>
                                        <button className="btn btn-primary" onClick={handleSaveSpk} disabled={saving}
                                            style={{ width: '100%', padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: '1rem', borderRadius: 10 }}>
                                            <Save size={18} /> {saving ? 'Menyimpan...' : '✓ Simpan Data SPK'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* LAMPIRAN */}
                            {tab === 'lampiran' && (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: '0.9rem' }}>Lampiran Dokumen</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div style={cs}><div style={cl}>No DPPL</div><div style={cv}>{detail.noDppl || '-'}</div></div>
                                        <div style={cs}><div style={cl}>Tanggal DPPL</div><div style={cv}>{formatDate(detail.tanggalDppl)}</div></div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div style={cs}><div style={cl}>No BAHPL</div><div style={cv}>{detail.noBahpl || '-'}</div></div>
                                        <div style={cs}><div style={cl}>Tanggal BAHPL</div><div style={cv}>{formatDate(detail.tanggalBahpl)}</div></div>
                                    </div>
                                    {detail.berkasPenawaranPath && (
                                        <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Berkas Penawaran</div>
                                            <a href={detail.berkasPenawaranPath} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: '0.875rem' }}>📄 Lihat Dokumen PDF</a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SP/SPMK */}
                            {tab === 'sp_spmk' && (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: '0.9rem' }}>Surat Perintah / SPMK</div>
                                    <div style={{ display: 'grid', gap: 12 }}>
                                        <div style={cs}><div style={cl}>Nomor SP</div><input style={fieldStyle} value={spSpmkData.noSp} onChange={e => setSpSpmkData({ ...spSpmkData, noSp: e.target.value })} placeholder="Nomor Surat Perintah" /></div>
                                        <div style={cs}><div style={cl}>Tanggal SP</div><input type="date" style={fieldStyle} value={spSpmkData.tanggalSp} onChange={e => setSpSpmkData({ ...spSpmkData, tanggalSp: e.target.value })} /></div>
                                        <div style={cs}><div style={cl}>ID Paket</div><input style={fieldStyle} value={spSpmkData.idPaket} onChange={e => setSpSpmkData({ ...spSpmkData, idPaket: e.target.value })} placeholder="ID Paket / Kode SiRUP" /></div>
                                        <button className="btn btn-primary" onClick={handleSaveSpSpmk} disabled={saving}
                                            style={{ width: '100%', padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: '1rem', borderRadius: 10 }}>
                                            <Save size={18} /> {saving ? 'Menyimpan...' : '✓ Simpan Data SP/SPMK'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* VERIFIKASI */}
                            {tab === 'verifikasi' && (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: '0.9rem' }}>Verifikasi Permohonan Kontrak</div>
                                    <div style={{ ...cs, marginBottom: 20, padding: 20 }}>
                                        <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Konfirmasi Verifikasi</h4>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 16px' }}>
                                            Dengan ini saya menyatakan bahwa data yang saya lihat dan saya sampaikan adalah benar sesuai dengan fakta yang ada,
                                            dan apabila dikemudian hari data yang saya lihat atau sampaikan tidak benar, maka saya bersedia untuk diproses secara hukum
                                            sesuai dengan ketentuan Undang-Undang yang berlaku.
                                        </p>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.88rem' }}>
                                            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                                            Saya setuju dengan pernyataan di atas
                                        </label>
                                    </div>
                                    <button onClick={handleVerify} disabled={!agreed || saving}
                                        style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 10, background: agreed ? '#22c55e' : 'rgba(128,128,128,0.3)', color: '#fff', cursor: agreed ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <CheckCircle size={20} /> {saving ? 'Memproses...' : '✓ Terima Permohonan Kontrak'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

export default ManajemenKontrak;
