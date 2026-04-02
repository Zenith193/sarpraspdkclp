import { useState, useEffect } from 'react';
import { Search, Send, CheckCircle, Upload, ArrowRight, Eye } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { kontrakApi } from '../../api';

const DashboardPenyedia = () => {
    const user = useAuthStore(s => s.user);
    const [perusahaan, setPerusahaan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1); // 1=dasar, 2=dppl/bahpl, 3=lampiran
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResult, setSearchResult] = useState(null);
    const [searchError, setSearchError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [permohonanAktif, setPermohonanAktif] = useState([]);

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

    useEffect(() => {
        const load = async () => {
            try {
                const [pRes, lRes] = await Promise.all([
                    fetch('/api/perusahaan/me', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
                    kontrakApi.listPermohonan().then(r => r.data).catch(() => []),
                ]);
                setPerusahaan(pRes);
                setPermohonanAktif(Array.isArray(lRes) ? lRes.filter(p => p.status === 'Menunggu') : []);
            } catch { }
            setLoading(false);
        };
        load();
    }, [user]);

    const handleSearch = async () => {
        if (!kodeSirup.trim()) return;
        setSearchLoading(true);
        setSearchError('');
        setSearchResult(null);
        try {
            const res = await kontrakApi.searchSirup(kodeSirup.trim());
            if (res.data) {
                setSearchResult(res.data);
                setNamaPaket(res.data.namaPaket || '');
                setMetodePengadaan(res.data.metode || '');
                setJenisPengadaan(res.data.jenisPengadaan || '');
                setMatrikId(res.data.id || null);
            }
        } catch (e) {
            setSearchError(e?.response?.data?.error || 'Paket tidak ditemukan');
        }
        setSearchLoading(false);
    };

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
            setStep(1); setKodeSirup(''); setNamaPaket(''); setMetodePengadaan(''); setJenisPengadaan('');
            setSearchResult(null); setNoDppl(''); setTanggalDppl(''); setNoBahpl(''); setTanggalBahpl('');
            setBerkasPenawaran(null); setMatrikId(null);
            const lRes = await kontrakApi.listPermohonan().then(r => r.data).catch(() => []);
            setPermohonanAktif(Array.isArray(lRes) ? lRes.filter(p => p.status === 'Menunggu') : []);
            alert('Permohonan kontrak berhasil dikirim!');
        } catch (e) {
            setSubmitError(e?.response?.data?.error || 'Gagal mengirim permohonan');
        }
        setSubmitting(false);
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

    const fieldStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' };
    const readOnlyStyle = { ...fieldStyle, background: 'var(--bg-tertiary, rgba(128,128,128,0.08))', color: 'var(--text-secondary)' };
    const labelStyle = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' };

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
            <div className="page-header"><h1 className="page-title">📋 PERMOHONAN KONTRAK</h1></div>

            {submitError && <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', marginBottom: 20, fontSize: '0.875rem' }}>{submitError}</div>}

            {/* ===== STEP 1: Data Perusahaan + SiRUP ===== */}
            {step === 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                    {/* LEFT: Company Data (read-only) */}
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>NIK Direktur</label>
                            <input style={readOnlyStyle} value={perusahaan?.nikPemilik || '-'} readOnly />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>Nama Direktur</label>
                            <input style={readOnlyStyle} value={perusahaan?.namaPemilik || '-'} readOnly />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>Alamat Direktur</label>
                            <textarea style={{ ...readOnlyStyle, minHeight: 70, resize: 'vertical' }} value={perusahaan?.alamatPemilik || '-'} readOnly />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div><label style={labelStyle}>Nama Perusahaan</label><input style={readOnlyStyle} value={perusahaan?.namaPerusahaan || '-'} readOnly /></div>
                            <div><label style={labelStyle}>Singkatan</label><input style={readOnlyStyle} value={perusahaan?.namaPerusahaanSingkat || '-'} readOnly /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                            <div><label style={labelStyle}>No. Akta</label><input style={readOnlyStyle} value={perusahaan?.noAkta || '-'} readOnly /></div>
                            <div><label style={labelStyle}>Notaris</label><input style={readOnlyStyle} value={perusahaan?.namaNotaris || '-'} readOnly /></div>
                            <div><label style={labelStyle}>Tgl Akta</label><input style={readOnlyStyle} value={perusahaan?.tanggalAkta || '-'} readOnly /></div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>Alamat Perusahaan</label>
                            <textarea style={{ ...readOnlyStyle, minHeight: 70, resize: 'vertical' }} value={perusahaan?.alamatPerusahaan || '-'} readOnly />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div><label style={labelStyle}>No. Telepon</label><input style={readOnlyStyle} value={perusahaan?.noTelp || '-'} readOnly /></div>
                            <div><label style={labelStyle}>Email</label><input style={readOnlyStyle} value={perusahaan?.emailPerusahaan || '-'} readOnly /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                            <div><label style={labelStyle}>No Rekening</label><input style={readOnlyStyle} value={perusahaan?.noRekening || '-'} readOnly /></div>
                            <div><label style={labelStyle}>Atas Nama</label><input style={readOnlyStyle} value={perusahaan?.namaRekening || '-'} readOnly /></div>
                            <div><label style={labelStyle}>Bank</label><input style={readOnlyStyle} value={perusahaan?.bank || '-'} readOnly /></div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>NPWP Perusahaan</label>
                            <input style={readOnlyStyle} value={perusahaan?.npwp || '-'} readOnly />
                        </div>
                    </div>

                    {/* RIGHT: Catatan + DASAR PERMOHONAN */}
                    <div>
                        <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, border: '1px solid rgba(59,130,246,0.15)' }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.9rem' }}>⭐ Catatan:</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Pastikan untuk mengecek kembali kebenaran data perusahaan Anda. Jika ingin merubah data perusahaan maka hubungi admin.</div>
                        </div>

                        <h3 style={{ margin: '0 0 20px', fontSize: '1.05rem', fontWeight: 700 }}>📋 DASAR PERMOHONAN</h3>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>Kode Sirup <span style={{ color: '#ef4444' }}>*</span></label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input style={{ ...fieldStyle, flex: 1 }} placeholder="Kode Sirup" value={kodeSirup}
                                    onChange={e => setKodeSirup(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                                <button onClick={handleSearch} disabled={searchLoading}
                                    style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: 'var(--accent-blue)', color: '#fff', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Search size={16} />
                                </button>
                            </div>
                            {searchResult && <div style={{ color: '#22c55e', fontSize: '0.82rem', marginTop: 6 }}>✅ Paket berhasil ditemukan!</div>}
                            {searchError && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 6 }}>❌ {searchError}</div>}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>Nama Paket</label>
                            <input style={readOnlyStyle} value={namaPaket} readOnly />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>Metode Pengadaan</label>
                            <input style={readOnlyStyle} value={metodePengadaan} readOnly />
                        </div>
                        <div style={{ marginBottom: 24 }}>
                            <label style={labelStyle}>Jenis Pengadaan</label>
                            <input style={readOnlyStyle} value={jenisPengadaan} readOnly />
                        </div>

                        <button onClick={() => setStep(2)} disabled={!searchResult}
                            style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 10, background: searchResult ? 'var(--accent-blue)' : '#9ca3af', color: '#fff', cursor: searchResult ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.3s' }}>
                            <Send size={18} /> LANJUT PERMOHONAN
                        </button>
                    </div>
                </div>
            )}

            {/* ===== STEP 2: DPPL, BAHPL, Upload ===== */}
            {step === 2 && (
                <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-blue)', fontSize: '0.875rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>← Kembali ke Data Dasar</button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div>
                            <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>Nomor DPPL <span style={{ color: '#ef4444' }}>*</span></label>
                            <input style={fieldStyle} placeholder="Nomor DPPL" value={noDppl} onChange={e => setNoDppl(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>Tanggal DPPL <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="date" style={fieldStyle} value={tanggalDppl} onChange={e => setTanggalDppl(e.target.value)} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
                        <div>
                            <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>Nomor BAHPL <span style={{ color: '#ef4444' }}>*</span></label>
                            <input style={fieldStyle} placeholder="Nomor BAHPL" value={noBahpl} onChange={e => setNoBahpl(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>Tanggal BAHPL <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="date" style={fieldStyle} value={tanggalBahpl} onChange={e => setTanggalBahpl(e.target.value)} />
                        </div>
                    </div>

                    <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Upload size={18} style={{ color: 'var(--accent-blue)' }} /> Dokumen Penawaran
                    </h4>
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 32 }}>
                        <div style={{ fontSize: '0.875rem', marginBottom: 10 }}>Upload Berkas Penawaran <span style={{ color: 'var(--accent-blue)' }}>(.pdf)</span></div>
                        <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                            <input type="file" accept=".pdf" onChange={e => setBerkasPenawaran(e.target.files?.[0])} style={{ display: 'none' }} />
                            <div style={{ padding: '8px 20px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)' }}>Choose File</div>
                            <span style={{ marginLeft: 10, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{berkasPenawaran ? berkasPenawaran.name : 'No file chosen'}</span>
                        </label>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 10 }}>ℹ️ Maksimum ukuran file 10MB dalam format PDF</div>
                    </div>

                    <button onClick={handleSubmit} disabled={submitting}
                        style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 10, background: 'var(--accent-blue)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Send size={18} /> {submitting ? 'Mengirim...' : '💾 Simpan Data Permohonan'}
                    </button>
                </div>
            )}

            {/* ===== Permohonan Dalam Proses ===== */}
            {step === 1 && permohonanAktif.length > 0 && (
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
                                            <button style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: 'var(--accent-blue)', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
        </div>
    );
};

export default DashboardPenyedia;
