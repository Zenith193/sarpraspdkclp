import { useState, useEffect } from 'react';
import { ClipboardCheck, Eye, Search, X, CheckCircle, XCircle, Clock, Save, ChevronRight } from 'lucide-react';
import { kontrakApi } from '../../api';

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
            setSpkData({
                noSpk: d.noSpk || d.matrik?.noSpk || '',
                nilaiKontrak: d.nilaiKontrak || d.matrik?.nilaiKontrak || '',
                terbilangKontrak: d.terbilangKontrak || d.matrik?.terbilangKontrak || '',
                tanggalMulai: d.tanggalMulai || d.matrik?.tanggalMulai || '',
                tanggalSelesai: d.tanggalSelesai || d.matrik?.tanggalSelesai || '',
                waktuPenyelesaian: d.waktuPenyelesaian || (d.matrik?.jangkaWaktu ? `${d.matrik.jangkaWaktu} hari kalender` : ''),
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
            {detail && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setDetail(null)} />
                    <div style={{ position: 'relative', background: 'var(--bg-primary)', borderRadius: 16, width: 'min(92vw, 900px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        {/* Header */}
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>📋 Detail Permohonan Kontrak</h3>
                            <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        {/* Tab Bar */}
                        <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
                            {tabs.map(t => (
                                <button key={t.key} onClick={() => setTab(t.key)}
                                    style={{
                                        padding: '10px 18px', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
                                        background: tab === t.key ? 'var(--accent-blue)' : 'transparent',
                                        color: tab === t.key ? '#fff' : 'var(--text-secondary)',
                                    }}>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                            {/* DATA DASAR */}
                            {tab === 'data_dasar' && (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontWeight: 600 }}>Data Dasar Permohonan Kontrak</div>
                                    <h4 style={{ marginBottom: 12 }}>👤 DIREKTUR</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                                        {[
                                            ['Nama Direktur', detail.perusahaan?.namaPemilik],
                                            ['Alamat Direktur', detail.perusahaan?.alamatPemilik],
                                        ].map(([l, v]) => (
                                            <div key={l} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14 }}>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', marginBottom: 4 }}>{l}</div>
                                                <div style={{ fontSize: '0.9rem' }}>{v || '-'}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <h4 style={{ marginBottom: 12 }}>🏢 PERUSAHAAN</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        {[
                                            ['Nama Perusahaan', detail.perusahaan?.namaPerusahaan],
                                            ['NPWP', detail.perusahaan?.npwp],
                                            ['Telepon', detail.perusahaan?.noTelp],
                                            ['Email', detail.perusahaan?.emailPerusahaan],
                                            ['Alamat', detail.perusahaan?.alamatPerusahaan],
                                            ['Bank', `${detail.perusahaan?.bank || '-'} / ${detail.perusahaan?.noRekening || '-'}`],
                                        ].map(([l, v]) => (
                                            <div key={l} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14 }}>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', marginBottom: 4 }}>{l}</div>
                                                <div style={{ fontSize: '0.9rem' }}>{v || '-'}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SPK */}
                            {tab === 'spk' && (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontWeight: 600 }}>Surat Perintah Kerja</div>
                                    <div style={{ display: 'grid', gap: 16 }}>
                                        <div>
                                            <label style={labelStyle}>Jenis Kontrak</label>
                                            <input style={readOnlyStyle} value={detail.jenisPengadaan || '-'} readOnly />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Nomor SPK</label>
                                            <input style={fieldStyle} value={spkData.noSpk} onChange={e => setSpkData({ ...spkData, noSpk: e.target.value })} placeholder="400.3.13/..." />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Nilai Kontrak (Rp)</label>
                                            <input type="number" style={fieldStyle} value={spkData.nilaiKontrak} onChange={e => setSpkData({ ...spkData, nilaiKontrak: e.target.value })} placeholder="0" />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Terbilang</label>
                                            <input style={fieldStyle} value={spkData.terbilangKontrak} onChange={e => setSpkData({ ...spkData, terbilangKontrak: e.target.value })} placeholder="Delapan puluh juta rupiah" />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div><label style={labelStyle}>Tanggal Mulai</label><input type="date" style={fieldStyle} value={spkData.tanggalMulai} onChange={e => setSpkData({ ...spkData, tanggalMulai: e.target.value })} /></div>
                                            <div><label style={labelStyle}>Tanggal Selesai</label><input type="date" style={fieldStyle} value={spkData.tanggalSelesai} onChange={e => setSpkData({ ...spkData, tanggalSelesai: e.target.value })} /></div>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Waktu Penyelesaian</label>
                                            <input style={fieldStyle} value={spkData.waktuPenyelesaian} onChange={e => setSpkData({ ...spkData, waktuPenyelesaian: e.target.value })} placeholder="90 hari kalender" />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Tata Cara Pembayaran</label>
                                            <input style={fieldStyle} value={spkData.tataCaraPembayaran} onChange={e => setSpkData({ ...spkData, tataCaraPembayaran: e.target.value })} placeholder="Termin" />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Uang Muka</label>
                                            <input style={fieldStyle} value={spkData.uangMuka} onChange={e => setSpkData({ ...spkData, uangMuka: e.target.value })} placeholder="Tidak Ada / Ada" />
                                        </div>
                                        <button className="btn btn-primary" onClick={handleSaveSpk} disabled={saving}
                                            style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600 }}>
                                            <Save size={18} /> {saving ? 'Menyimpan...' : 'Simpan Data SPK'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* LAMPIRAN */}
                            {tab === 'lampiran' && (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontWeight: 600 }}>Lampiran Dokumen</div>
                                    <div style={{ display: 'grid', gap: 16 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            {[
                                                ['No DPPL', detail.noDppl],
                                                ['Tanggal DPPL', formatDate(detail.tanggalDppl)],
                                                ['No BAHPL', detail.noBahpl],
                                                ['Tanggal BAHPL', formatDate(detail.tanggalBahpl)],
                                            ].map(([l, v]) => (
                                                <div key={l} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14 }}>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', marginBottom: 4 }}>{l}</div>
                                                    <div style={{ fontSize: '0.9rem' }}>{v || '-'}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {detail.berkasPenawaranPath && (
                                            <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 8, padding: 16 }}>
                                                <div style={{ fontSize: '0.82rem', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 8 }}>Berkas Penawaran</div>
                                                <a href={detail.berkasPenawaranPath} target="_blank" rel="noreferrer"
                                                    style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: '0.875rem' }}>
                                                    📄 Lihat Dokumen PDF
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* SP/SPMK */}
                            {tab === 'sp_spmk' && (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontWeight: 600 }}>Surat Perintah / SPMK</div>
                                    <div style={{ display: 'grid', gap: 16 }}>
                                        <div>
                                            <label style={labelStyle}>Nomor SP</label>
                                            <input style={fieldStyle} value={spSpmkData.noSp} onChange={e => setSpSpmkData({ ...spSpmkData, noSp: e.target.value })} placeholder="Nomor Surat Perintah" />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Tanggal SP</label>
                                            <input type="date" style={fieldStyle} value={spSpmkData.tanggalSp} onChange={e => setSpSpmkData({ ...spSpmkData, tanggalSp: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>ID Paket</label>
                                            <input style={fieldStyle} value={spSpmkData.idPaket} onChange={e => setSpSpmkData({ ...spSpmkData, idPaket: e.target.value })} placeholder="ID Paket / Kode SiRUP" />
                                        </div>
                                        <button className="btn btn-primary" onClick={handleSaveSpSpmk} disabled={saving}
                                            style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600 }}>
                                            <Save size={18} /> {saving ? 'Menyimpan...' : 'Simpan Data SP/SPMK'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* VERIFIKASI */}
                            {tab === 'verifikasi' && (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontWeight: 600 }}>Verifikasi</div>
                                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                                        <h4 style={{ marginBottom: 12 }}>Konfirmasi Verifikasi</h4>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                                            Dengan ini saya menyatakan bahwa data yang saya lihat dan saya sampaikan adalah benar sesuai dengan fakta yang ada,
                                            dan apabila dikemudian hari data yang saya lihat atau sampaikan tidak benar, maka saya bersedia untuk diproses secara hukum
                                            sesuai dengan ketentuan Undang-Undang yang berlaku.
                                        </p>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                                            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width: 18, height: 18 }} />
                                            Saya setuju dengan pernyataan di atas
                                        </label>
                                    </div>
                                    <button className="btn" onClick={handleVerify} disabled={!agreed || saving}
                                        style={{
                                            width: '100%', padding: '14px 24px', fontSize: '1rem', fontWeight: 700,
                                            background: agreed ? '#22c55e' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 10, cursor: agreed ? 'pointer' : 'not-allowed',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.3s',
                                        }}>
                                        <CheckCircle size={20} /> {saving ? 'Memproses...' : 'Terima Permohonan Kontrak'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManajemenKontrak;
