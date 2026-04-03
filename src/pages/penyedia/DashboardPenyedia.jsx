import { useState, useEffect } from 'react';
import { Search, Send, CheckCircle, Upload, ArrowRight, Eye, X } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { kontrakApi } from '../../api';

const DashboardPenyedia = () => {
    const user = useAuthStore(s => s.user);
    const [perusahaan, setPerusahaan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('data-dasar');
    const [completed, setCompleted] = useState({ 'data-dasar': false, spk: false, lampiran: false, spspmk: false, verifikasi: false });
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResult, setSearchResult] = useState(null);
    const [searchError, setSearchError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [permohonanAktif, setPermohonanAktif] = useState([]);
    const [detailModal, setDetailModal] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [toast, setToast] = useState('');

    // Step 1
    const [kodeSirup, setKodeSirup] = useState('');
    const [namaPaket, setNamaPaket] = useState('');
    const [metodePengadaan, setMetodePengadaan] = useState('');
    const [jenisPengadaan, setJenisPengadaan] = useState('');
    const [matrikId, setMatrikId] = useState(null);
    // Step 2
    const [noDppl, setNoDppl] = useState('');
    const [tanggalDppl, setTanggalDppl] = useState('');
    const [noBahpl, setNoBahpl] = useState('');
    const [tanggalBahpl, setTanggalBahpl] = useState('');
    const [berkasPenawaran, setBerkasPenawaran] = useState(null);
    // Lampiran
    const [saved, setSaved] = useState(false);
    const [agreedLampiran, setAgreedLampiran] = useState(false);
    const emptyTim = { nama: '', posisi: '', statusTenaga: '', pendidikan: '', pengalaman: '', sertifikasi: '', keterangan: '', jadwal: Array(12).fill(false) };
    const emptyPeralatan = { nama: '', merk: '', type: '', kapasitas: '', jumlah: '', kondisi: '', statusKepemilikan: '', keterangan: '' };
    const [timInput, setTimInput] = useState({ ...emptyTim });
    const [timRows, setTimRows] = useState([]);
    const [peralatanInput, setPeralatanInput] = useState({ ...emptyPeralatan });
    const [peralatanRows, setPeralatanRows] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [pRes, lRes] = await Promise.all([
                    fetch('/api/perusahaan/me', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
                    kontrakApi.listPermohonan().catch(() => []),
                ]);
                setPerusahaan(pRes);
                const list = Array.isArray(lRes) ? lRes : [];
                setPermohonanAktif(list.filter(p => p.status === 'Menunggu'));
            } catch { }
            setLoading(false);
        };
        load();
    }, [user]);

    const handleSearch = async (kode) => {
        const k = (kode || kodeSirup).trim();
        if (!k) {
            setSearchResult(null); setNamaPaket(''); setMetodePengadaan(''); setJenisPengadaan(''); setMatrikId(null);
            return;
        }
        setSearchLoading(true);
        setSearchError('');
        setSearchResult(null);
        try {
            const res = await kontrakApi.searchSirup(k);
            if (res) {
                setSearchResult(res);
                setNamaPaket(res.namaPaket || '');
                setMetodePengadaan(res.metode || '');
                setJenisPengadaan(res.jenisPengadaan || '');
                setMatrikId(res.id || null);
            }
        } catch (e) {
            setSearchError(e?.message || 'Paket tidak ditemukan');
            setNamaPaket(''); setMetodePengadaan(''); setJenisPengadaan(''); setMatrikId(null);
        }
        setSearchLoading(false);
    };

    // Auto-search with debounce when kodeSirup changes
    useEffect(() => {
        if (!kodeSirup.trim()) {
            setSearchResult(null); setNamaPaket(''); setMetodePengadaan(''); setJenisPengadaan(''); setMatrikId(null);
            setSearchError('');
            return;
        }
        const timer = setTimeout(() => { handleSearch(kodeSirup); }, 500);
        return () => clearTimeout(timer);
    }, [kodeSirup]);

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError('');
        try {
            const formData = new FormData();
            formData.append('kodeSirup', kodeSirup);
            formData.append('namaPaket', namaPaket);
            formData.append('metodePengadaan', metodePengadaan);
            formData.append('jenisPengadaan', jenisPengadaan);
            if (matrikId) formData.append('matrikId', matrikId);
            formData.append('noDppl', noDppl);
            formData.append('tanggalDppl', tanggalDppl);
            formData.append('noBahpl', noBahpl);
            formData.append('tanggalBahpl', tanggalBahpl);
            if (berkasPenawaran) formData.append('berkasPenawaran', berkasPenawaran);
            await kontrakApi.createPermohonan(formData);
            // Reset & reload
            setKodeSirup(''); setNamaPaket(''); setMetodePengadaan(''); setJenisPengadaan('');
            setSearchResult(null); setNoDppl(''); setTanggalDppl(''); setNoBahpl(''); setTanggalBahpl('');
            setBerkasPenawaran(null); setMatrikId(null);
            setSaved(false); setAgreedLampiran(false);
            setTimInput({ ...emptyTim }); setTimRows([]);
            setPeralatanInput({ ...emptyPeralatan }); setPeralatanRows([]);
            const lRes = await kontrakApi.listPermohonan().catch(() => []);
            setPermohonanAktif(Array.isArray(lRes) ? lRes.filter(p => p.status === 'Menunggu') : []);
            setToast('Permohonan Kontrak berhasil');
            setTimeout(() => setToast(''), 3000);
        } catch (e) {
            setSubmitError(e?.message || 'Gagal mengirim permohonan');
        }
        setSubmitting(false);
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
    const formatCurrency = (v) => v ? `Rp. ${Number(v).toLocaleString('id-ID')}` : '-';

    const handleDetail = async (id) => {
        setDetailLoading(true);
        try {
            const res = await kontrakApi.getPermohonan(id);
            setDetailModal(res);
        } catch { }
        setDetailLoading(false);
    };

    const fieldStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' };
    const readOnlyStyle = { ...fieldStyle, background: 'var(--bg-tertiary, rgba(128,128,128,0.08))', color: 'var(--text-secondary)' };
    const labelStyle = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' };
    const tblInput = { padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.78rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' };
    const tblSelect = { ...tblInput, padding: '5px 4px' };

    if (loading) return <div className="page-container" style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>Memuat data...</div>;

    // If company not verified, show waiting status
    if (!perusahaan || perusahaan.status !== 'Diverifikasi') {
        return (
            <div className="page-container">
                <div className="page-header"><h1 className="page-title">📋 PERMOHONAN KONTRAK</h1></div>
                <div className="stat-card" style={{ padding: 40, textAlign: 'center', maxWidth: 500, margin: '40px auto' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(251,191,36,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <span style={{ fontSize: 36 }}>⏳</span>
                    </div>
                    <h3 style={{ color: 'var(--accent-yellow)', marginBottom: 8 }}>Menunggu Verifikasi</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>Data perusahaan Anda sedang ditinjau oleh Admin. Setelah diverifikasi, Anda dapat mengajukan permohonan kontrak.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            {/* Toast notification */}
            {toast && (
                <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#16a34a', color: '#fff', padding: '12px 28px', borderRadius: 8, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', animation: 'fadeIn 0.3s ease' }}>
                    <CheckCircle size={20} /> {toast}
                </div>
            )}
            {submitError && <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', marginBottom: 20, fontSize: '0.875rem' }}>{submitError}</div>}

            {/* ===== LAKON TOP SECTION ===== */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
                {/* Left: Informasi Perusahaan */}
                <div className="stat-card" style={{ padding: 24 }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem' }}>Informasi Perusahaan</h3>
                    <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '2px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Company<br/>Logo</div>
                    <div style={{ display: 'grid', gap: 12, fontSize: '0.88rem' }}>
                        {[
                            ['Nama Perusahaan', perusahaan?.namaPerusahaan],
                            ['Alamat Perusahaan', perusahaan?.alamatPerusahaan],
                            ['No. Telepon', perusahaan?.noTelp],
                            ['Email', perusahaan?.emailPerusahaan],
                        ].map(([l, v]) => (
                            <div key={l} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{l}</span>
                                <span>: {v || '-'}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 16, textAlign: 'center' }}>
                        <a href="#" style={{ color: 'var(--accent-blue)', fontSize: '0.85rem', textDecoration: 'none' }}>Lengkapi Data Perusahaan →</a>
                    </div>
                </div>

                {/* Right: Pengajuan Layanan Kontrak */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="stat-card" style={{ padding: 24, background: 'var(--accent-blue)', color: '#fff' }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', color: '#fff' }}>Pengajuan Layanan Kontrak</h3>
                        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 20px', opacity: 0.9 }}>Gunakan SPIDOL untuk mengajukan permohonan kontrak dengan lebih efisien. Siapkan dokumen dan data pendukung untuk memperlancar proses pengajuan Anda.</p>
                        <button onClick={() => { setActiveTab('data-dasar'); window.scrollTo({ top: 500, behavior: 'smooth' }); }}
                            style={{ width: '100%', padding: '14px 0', border: '2px solid #fff', borderRadius: 10, background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <ArrowRight size={18} /> AJUKAN PERMOHONAN KONTRAK
                        </button>
                    </div>
                    <div className="stat-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle size={24} style={{ color: 'var(--accent-blue)' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Permohonan Aktif</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{permohonanAktif.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== FORM SECTION ===== */}
            <div className="page-header"><h1 className="page-title">🏠 DETAIL PERMOHONAN KONTRAK</h1></div>

            {/* ===== TAB INDICATORS ===== */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                    { id: 'data-dasar', label: 'Data Dasar' },
                    { id: 'spk', label: 'SPK' },
                    { id: 'lampiran', label: 'Lampiran' },
                    { id: 'spspmk', label: 'SP/SPMK' },
                    { id: 'verifikasi', label: 'Verifikasi' },
                ].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        style={{
                            padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                            background: activeTab === t.id ? 'var(--accent-blue)' : 'transparent',
                            color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
                            border: activeTab === t.id ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                            borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
                        }}>
                        {t.label} {completed[t.id]
                            ? <CheckCircle size={14} style={{ color: activeTab === t.id ? '#86efac' : '#22c55e' }} />
                            : <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'rgba(239,68,68,0.2)', fontSize: '0.55rem', color: '#ef4444', fontWeight: 700 }}>✕</span>}
                    </button>
                ))}
            </div>
            <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 24, fontWeight: 600, fontSize: '0.9rem' }}>
                {activeTab === 'data-dasar' ? 'Data Dasar' : activeTab === 'spk' ? 'SPK' : activeTab === 'lampiran' ? 'Lampiran' : activeTab === 'spspmk' ? 'SP/SPMK' : 'Verifikasi'} Permohonan Kontrak
            </div>

            {/* ===== TAB: DATA DASAR ===== */}
            {activeTab === 'data-dasar' && (() => {
                const cs = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' };
                const cl = { fontSize: '0.78rem', fontWeight: 600, color: '#22c55e', marginBottom: 4 };
                const cv = { fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 500 };
                return (
                <div>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>👤 DIREKTUR</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                        <div style={cs}><div style={cl}>Nama Direktur</div><div style={cv}>{perusahaan?.namaPemilik || '-'}</div></div>
                        <div style={cs}><div style={cl}>Alamat Direktur</div><div style={cv}>{perusahaan?.alamatPemilik || '-'}</div></div>
                    </div>

                    <h3 style={{ margin: '0 0 16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>🏢 PERUSAHAAN</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div style={cs}><div style={cl}>Nama Perusahaan</div><div style={cv}>{perusahaan?.namaPerusahaan || '-'}</div></div>
                        <div style={cs}><div style={cl}>NPWP</div><div style={cv}>{perusahaan?.npwp || '-'}</div></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div style={cs}><div style={cl}>Telepon</div><div style={cv}>{perusahaan?.noTelp || '-'}</div></div>
                        <div style={cs}><div style={cl}>Email</div><div style={cv}>{perusahaan?.emailPerusahaan || '-'}</div></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div style={cs}><div style={cl}>Alamat</div><div style={cv}>{perusahaan?.alamatPerusahaan || '-'}</div></div>
                        <div style={cs}><div style={cl}>Bank</div><div style={cv}>{perusahaan?.bank || '-'} / {perusahaan?.noRekening || '-'}</div></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div style={cs}><div style={cl}>Nomor Akta Notaris</div><div style={cv}>{perusahaan?.noAkta || '-'}</div></div>
                        <div style={cs}><div style={cl}>Tanggal Akta Notaris</div><div style={cv}>{perusahaan?.tanggalAkta || '-'}</div></div>
                    </div>
                    <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Nama Akta Notaris</div><div style={cv}>{perusahaan?.namaNotaris || '-'}</div></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                        <div style={cs}><div style={cl}>Bank</div><div style={cv}>{perusahaan?.bank || '-'}</div></div>
                        <div style={cs}><div style={cl}>Rekening</div><div style={cv}>{perusahaan?.noRekening || '-'} atas nama <strong>{perusahaan?.namaRekening || '-'}</strong></div></div>
                    </div>

                    <h3 style={{ margin: '0 0 16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>⚙️ PAKET PEKERJAAN</h3>
                    <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Kode Sirup</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input style={{ ...fieldStyle, flex: 1 }} placeholder="Masukkan Kode Sirup" value={kodeSirup} onChange={e => setKodeSirup(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                            <button onClick={handleSearch} disabled={searchLoading} style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: 'var(--accent-blue)', color: '#fff', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Search size={16} /></button>
                        </div>
                        {searchResult && <div style={{ color: '#22c55e', fontSize: '0.82rem', marginTop: 6 }}>✅ Paket ditemukan</div>}
                        {searchError && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 6 }}>❌ {searchError}</div>}
                    </div>
                    <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Nama Paket</div><div style={cv}>{namaPaket || '-'}</div></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div style={cs}><div style={cl}>Jenis Pengadaan</div><div style={cv}>{jenisPengadaan || '-'}</div></div>
                        <div style={cs}><div style={cl}>Metode Pemilihan</div><div style={cv}>{metodePengadaan || '-'}</div></div>
                    </div>

                    {searchResult && (
                        <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div style={cs}><div style={cl}>Nomor DPPL</div><input style={fieldStyle} placeholder="Nomor DPPL" value={noDppl} onChange={e => setNoDppl(e.target.value)} /></div>
                            <div style={cs}><div style={cl}>Tanggal DPPL</div><input type="date" style={fieldStyle} value={tanggalDppl} onChange={e => setTanggalDppl(e.target.value)} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div style={cs}><div style={cl}>Nomor BAHPL</div><input style={fieldStyle} placeholder="Nomor BAHPL" value={noBahpl} onChange={e => setNoBahpl(e.target.value)} /></div>
                            <div style={cs}><div style={cl}>Tanggal BAHPL</div><input type="date" style={fieldStyle} value={tanggalBahpl} onChange={e => setTanggalBahpl(e.target.value)} /></div>
                        </div>
                        <div style={{ ...cs, marginBottom: 24 }}><div style={cl}>Berkas Penawaran</div>
                            <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                                <input type="file" accept=".pdf" onChange={e => setBerkasPenawaran(e.target.files?.[0])} style={{ display: 'none' }} />
                                <div style={{ padding: '6px 16px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', marginTop: 6 }}>Choose File</div>
                                <span style={{ marginLeft: 10, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{berkasPenawaran ? berkasPenawaran.name : 'No file chosen'}</span>
                            </label>
                        </div>

                        <button onClick={() => { setCompleted(c => ({ ...c, 'data-dasar': true })); setActiveTab('lampiran'); setToast('Data Dasar berhasil disimpan'); setTimeout(() => setToast(''), 3000); }}
                            style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 10, background: 'var(--accent-blue)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <CheckCircle size={18} /> ✓ Simpan Data Dasar
                        </button>
                        </>
                    )}
                </div>
                );
            })()}

            {/* ===== TAB: LAMPIRAN ===== */}
            {activeTab === 'lampiran' && (
                <div>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem' }}>Lampiran Dokumen</h3>

                    <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>👥 KOMPOSISI TIM DAN PENUGASAN</h4>
                    <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                        <table className="data-table" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            <thead>
                                <tr>
                                    <th>Nama</th><th>Posisi</th><th>Status Tenaga</th><th>Pendidikan</th>
                                    <th>Pengalaman (tahun)</th><th>Sertifikasi</th><th>Keterangan</th>
                                    <th colSpan={12} style={{ textAlign: 'center' }}>Jadwal Pelaksanaan Kegiatan (Bulan)</th>
                                    <th>Aksi</th>
                                </tr>
                                <tr>
                                    <th colSpan={7}></th>
                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <th key={m} style={{ textAlign: 'center', padding: '2px 4px' }}>{m}</th>)}
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {timRows.map((row, i) => (
                                    <tr key={'saved-'+i} style={{ background: 'rgba(34,197,94,0.05)' }}>
                                        <td>{row.nama}</td><td>{row.posisi}</td><td>{row.statusTenaga}</td><td>{row.pendidikan}</td>
                                        <td>{row.pengalaman}</td><td>{row.sertifikasi}</td><td>{row.keterangan}</td>
                                        {row.jadwal.map((c, j) => <td key={j} style={{ textAlign: 'center' }}>{c ? '■' : '□'}</td>)}
                                        <td><button onClick={() => setTimRows(r => r.filter((_, idx) => idx !== i))} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: '0.7rem' }}>Hapus</button></td>
                                    </tr>
                                ))}
                                <tr>
                                    <td><input style={tblInput} value={timInput.nama} onChange={e => setTimInput({ ...timInput, nama: e.target.value })} /></td>
                                    <td><input style={tblInput} value={timInput.posisi} onChange={e => setTimInput({ ...timInput, posisi: e.target.value })} /></td>
                                    <td><select style={tblSelect} value={timInput.statusTenaga} onChange={e => setTimInput({ ...timInput, statusTenaga: e.target.value })}><option value="">Pilih Status Te...</option><option>Tenaga Ahli</option><option>Tenaga Penunjang</option><option>Tenaga Teknis</option></select></td>
                                    <td><select style={tblSelect} value={timInput.pendidikan} onChange={e => setTimInput({ ...timInput, pendidikan: e.target.value })}><option value="">Pilih Pendid...</option><option>SD</option><option>SMP</option><option>SMA</option><option>D1</option><option>D2</option><option>D3</option><option>S1/D4</option><option>S2</option><option>S3</option></select></td>
                                    <td><input type="number" style={tblInput} placeholder="0" value={timInput.pengalaman} onChange={e => setTimInput({ ...timInput, pengalaman: e.target.value })} /></td>
                                    <td><input style={tblInput} value={timInput.sertifikasi} onChange={e => setTimInput({ ...timInput, sertifikasi: e.target.value })} /></td>
                                    <td><input style={tblInput} value={timInput.keterangan} onChange={e => setTimInput({ ...timInput, keterangan: e.target.value })} /></td>
                                    {timInput.jadwal.map((checked, j) => (
                                        <td key={j} style={{ textAlign: 'center' }}><input type="checkbox" checked={checked} onChange={() => { const jd = [...timInput.jadwal]; jd[j] = !jd[j]; setTimInput({ ...timInput, jadwal: jd }); }} /></td>
                                    ))}
                                    <td><button onClick={() => { if (!timInput.nama.trim()) return; setTimRows(r => [...r, { ...timInput }]); setTimInput({ ...emptyTim }); }} style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Simpan</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>🔧 PERALATAN UTAMA (Apabila dipersyaratkan)</h4>
                    <div style={{ overflowX: 'auto', marginBottom: 30 }}>
                        <table className="data-table" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            <thead><tr><th>Nama Peralatan</th><th>Merk</th><th>Type</th><th>Kapasitas</th><th>Jumlah</th><th>Kondisi</th><th>Status Kepemilikan</th><th>Keterangan</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {peralatanRows.map((row, i) => (
                                    <tr key={'saved-'+i} style={{ background: 'rgba(34,197,94,0.05)' }}>
                                        <td>{row.nama}</td><td>{row.merk}</td><td>{row.type}</td><td>{row.kapasitas}</td>
                                        <td>{row.jumlah}</td><td>{row.kondisi}</td><td>{row.statusKepemilikan}</td><td>{row.keterangan}</td>
                                        <td><button onClick={() => setPeralatanRows(r => r.filter((_, idx) => idx !== i))} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: '0.7rem' }}>Hapus</button></td>
                                    </tr>
                                ))}
                                <tr>
                                    <td><input style={tblInput} value={peralatanInput.nama} onChange={e => setPeralatanInput({ ...peralatanInput, nama: e.target.value })} /></td>
                                    <td><input style={tblInput} value={peralatanInput.merk} onChange={e => setPeralatanInput({ ...peralatanInput, merk: e.target.value })} /></td>
                                    <td><input style={tblInput} value={peralatanInput.type} onChange={e => setPeralatanInput({ ...peralatanInput, type: e.target.value })} /></td>
                                    <td><input style={tblInput} value={peralatanInput.kapasitas} onChange={e => setPeralatanInput({ ...peralatanInput, kapasitas: e.target.value })} /></td>
                                    <td><input type="number" style={tblInput} placeholder="0" value={peralatanInput.jumlah} onChange={e => setPeralatanInput({ ...peralatanInput, jumlah: e.target.value })} /></td>
                                    <td><select style={tblSelect} value={peralatanInput.kondisi} onChange={e => setPeralatanInput({ ...peralatanInput, kondisi: e.target.value })}><option value="">Pilih Kondisi</option><option>Baik</option><option>Sedang</option><option>Rusak</option></select></td>
                                    <td><select style={tblSelect} value={peralatanInput.statusKepemilikan} onChange={e => setPeralatanInput({ ...peralatanInput, statusKepemilikan: e.target.value })}><option value="">Pilih Status</option><option>Milik Sendiri</option><option>Sewa</option></select></td>
                                    <td><input style={tblInput} value={peralatanInput.keterangan} onChange={e => setPeralatanInput({ ...peralatanInput, keterangan: e.target.value })} /></td>
                                    <td><button onClick={() => { if (!peralatanInput.nama.trim()) return; setPeralatanRows(r => [...r, { ...peralatanInput }]); setPeralatanInput({ ...emptyPeralatan }); }} style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Simpan</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Pernyataan Kesanggupan</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 16px' }}>
                            Dengan ini saya menyatakan bahwa data yang saya sampaikan adalah benar sesuai dengan fakta yang ada, dan apabila dikemudian hari data perusahaan yang saya sampaikan tidak benar, maka saya bersedia untuk diproses secara hukum sesuai dengan ketentuan Undang-Undang yang berlaku.
                        </p>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.88rem' }}>
                            <input type="checkbox" checked={agreedLampiran} onChange={e => setAgreedLampiran(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                            Saya setuju dengan pernyataan di atas
                        </label>
                    </div>

                    <button onClick={() => { setCompleted(c => ({ ...c, lampiran: true })); setToast('Lampiran berhasil disimpan'); setTimeout(() => setToast(''), 3000); }}
                        style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 10, background: 'var(--accent-blue)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                        <CheckCircle size={18} /> ✓ Simpan Lampiran
                    </button>

                    {submitError && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 12 }}>{submitError}</div>}

                    <button onClick={handleSubmit} disabled={!agreedLampiran || submitting}
                        style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 10, background: agreedLampiran ? '#f59e0b' : 'rgba(128,128,128,0.3)', color: '#fff', cursor: agreedLampiran ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Send size={18} /> {submitting ? 'Mengirim...' : '✈️ Kirimkan Permohonan Kontrak'}
                    </button>
                </div>
            )}

            {/* ===== TAB: SPK / SP-SPMK / VERIFIKASI (placeholder) ===== */}
            {(activeTab === 'spk' || activeTab === 'spspmk' || activeTab === 'verifikasi') && (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                    <h3 style={{ marginBottom: 8 }}>{activeTab === 'spk' ? 'SPK' : activeTab === 'spspmk' ? 'SP/SPMK' : 'Verifikasi'}</h3>
                    <p style={{ fontSize: '0.9rem' }}>Tahap ini akan diisi setelah proses verifikasi oleh admin.</p>
                </div>
            )}

            {/* ===== Permohonan Dalam Proses ===== */}
            {permohonanAktif.length > 0 && (
                <div style={{ marginTop: 40 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            📋 Permohonan Kontrak Dalam Proses
                        </h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total: {permohonanAktif.length} permohonan</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>NO.</th>
                                    <th>KODE SIRUP</th>
                                    <th>NAMA PAKET</th>
                                    <th>JENIS PENGADAAN</th>
                                    <th>METODE PENGADAAN</th>
                                    <th>TANGGAL</th>
                                    <th>AKSI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {permohonanAktif.map((p, i) => (
                                    <tr key={p.id}>
                                        <td>{i + 1}</td>
                                        <td style={{ fontWeight: 600 }}>{p.kodeSirup}</td>
                                        <td>{p.namaPaket}</td>
                                        <td>{p.jenisPengadaan}</td>
                                        <td>{p.metodePengadaan}</td>
                                        <td>{formatDate(p.createdAt)}</td>
                                        <td>
                                            <button onClick={() => handleDetail(p.id)} style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: 'var(--accent-blue)', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Eye size={14} /> Detail
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {/* Detail Modal - Lakon style */}
            {detailModal && (() => {
                const cs = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' };
                const cl = { fontSize: '0.78rem', fontWeight: 600, color: '#22c55e', marginBottom: 4 };
                const cv = { fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 500 };
                return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setDetailModal(null)} />
                    <div style={{ position: 'relative', background: 'var(--bg-primary)', borderRadius: 16, width: 'min(90vw, 720px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>🏠 DETAIL PERMOHONAN KONTRAK</h3>
                            <button onClick={() => setDetailModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                            <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: '0.9rem' }}>Data Permohonan Kontrak</div>

                            <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>⚙️ PAKET PEKERJAAN</h4>
                            <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Kode SiRUP</div><div style={cv}>{detailModal.kodeSirup || '-'}</div></div>
                            <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Nama Paket</div><div style={cv}>{detailModal.namaPaket || '-'}</div></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <div style={cs}><div style={cl}>Jenis Pengadaan</div><div style={cv}>{detailModal.jenisPengadaan || '-'}</div></div>
                                <div style={cs}><div style={cl}>Metode Pengadaan</div><div style={cv}>{detailModal.metodePengadaan || '-'}</div></div>
                            </div>

                            <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>📋 LAMPIRAN</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <div style={cs}><div style={cl}>No DPPL</div><div style={cv}>{detailModal.noDppl || '-'}</div></div>
                                <div style={cs}><div style={cl}>Tanggal DPPL</div><div style={cv}>{formatDate(detailModal.tanggalDppl)}</div></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <div style={cs}><div style={cl}>No BAHPL</div><div style={cv}>{detailModal.noBahpl || '-'}</div></div>
                                <div style={cs}><div style={cl}>Tanggal BAHPL</div><div style={cv}>{formatDate(detailModal.tanggalBahpl)}</div></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <div style={cs}><div style={cl}>Status</div><div style={cv}>{detailModal.status || '-'}</div></div>
                                <div style={cs}><div style={cl}>Tanggal Pengajuan</div><div style={cv}>{formatDate(detailModal.createdAt)}</div></div>
                            </div>
                            {detailModal.berkasPenawaranPath && (
                                <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Berkas Penawaran</div>
                                    <a href={detailModal.berkasPenawaranPath} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: '0.875rem' }}>📄 Lihat Dokumen PDF</a>
                                </div>
                            )}

                            {detailModal.status === 'Diverifikasi' && (
                                <>
                                <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                                <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>📝 DATA KONTRAK (Verifikator)</h4>
                                <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>No SPK</div><div style={cv}>{detailModal.noSpk || '-'}</div></div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                    <div style={cs}><div style={cl}>Nilai Kontrak</div><div style={cv}>{formatCurrency(detailModal.nilaiKontrak)}</div></div>
                                    <div style={cs}><div style={cl}>Terbilang</div><div style={cv}>{detailModal.terbilangKontrak || '-'}</div></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                    <div style={cs}><div style={cl}>Tanggal Mulai</div><div style={cv}>{formatDate(detailModal.tanggalMulai)}</div></div>
                                    <div style={cs}><div style={cl}>Tanggal Selesai</div><div style={cv}>{formatDate(detailModal.tanggalSelesai)}</div></div>
                                </div>
                                <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Waktu Penyelesaian</div><div style={cv}>{detailModal.waktuPenyelesaian || '-'}</div></div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

export default DashboardPenyedia;
