import { useState, useEffect } from 'react';
import { Search, ArrowLeft, ArrowRight, Send, CheckCircle, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { kontrakApi } from '../../api';

const PermohonanKontrak = () => {
    const user = useAuthStore(s => s.user);
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [perusahaan, setPerusahaan] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResult, setSearchResult] = useState(null);
    const [searchError, setSearchError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [submitSuccess, setSubmitSuccess] = useState(false);

    // Form fields
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
        fetch('/api/perusahaan', { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                const mine = Array.isArray(data) ? data.find(p => p.userId === user?.id) : null;
                setPerusahaan(mine);
            }).catch(() => {});
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
        setLoading(true);
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
            setSubmitSuccess(true);
            setTimeout(() => navigate('/penyedia/dashboard'), 2000);
        } catch (e) {
            setSubmitError(e?.response?.data?.error || 'Gagal mengirim permohonan');
        }
        setLoading(false);
    };

    const fieldStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' };
    const readOnlyStyle = { ...fieldStyle, background: 'var(--bg-tertiary, rgba(0,0,0,0.03))', color: 'var(--text-secondary)' };
    const labelStyle = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };
    const sectionStyle = { background: 'var(--bg-primary)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' };

    if (submitSuccess) {
        return (
            <div className="page-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <CheckCircle size={40} style={{ color: 'var(--accent-green)' }} />
                </div>
                <h2 style={{ color: 'var(--accent-green)', marginBottom: 8 }}>Permohonan Berhasil Dikirim!</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Permohonan kontrak Anda sedang diproses. Mengarahkan ke dashboard...</p>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
                        <ArrowLeft size={20} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <div>
                        <h1 className="page-title">Permohonan Kontrak</h1>
                        <p className="page-subtitle">Step {step} dari 2 — {step === 1 ? 'Dasar Permohonan' : 'Detail & Dokumen'}</p>
                    </div>
                </div>
            </div>

            {/* Step indicator */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 28, alignItems: 'center' }}>
                {[1, 2].map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.85rem', fontWeight: 700,
                            background: step >= s ? 'var(--accent-blue)' : 'var(--bg-tertiary, #e5e7eb)',
                            color: step >= s ? '#fff' : 'var(--text-secondary)',
                            transition: 'all 0.3s ease',
                        }}>{s}</div>
                        <span style={{ fontSize: '0.85rem', fontWeight: step === s ? 600 : 400, color: step === s ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {s === 1 ? 'Dasar Permohonan' : 'Detail Dokumen'}
                        </span>
                        {s < 2 && <ArrowRight size={16} style={{ color: 'var(--text-secondary)', margin: '0 8px' }} />}
                    </div>
                ))}
            </div>

            {submitError && <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', marginBottom: 20, fontSize: '0.875rem' }}>{submitError}</div>}

            {/* STEP 1 */}
            {step === 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    {/* Left - Company Data (read-only) */}
                    <div style={sectionStyle}>
                        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.2rem' }}>👤</span> Data Perusahaan
                        </h3>
                        <div style={{ display: 'grid', gap: 14 }}>
                            {[
                                ['NIK Direktur', perusahaan?.nikPemilik],
                                ['Nama Direktur', perusahaan?.namaPemilik],
                            ].map(([l, v]) => (
                                <div key={l}><label style={labelStyle}>{l}</label><input style={readOnlyStyle} value={v || '-'} readOnly /></div>
                            ))}
                            <div>
                                <label style={labelStyle}>Alamat Direktur</label>
                                <textarea style={{ ...readOnlyStyle, minHeight: 60, resize: 'vertical' }} value={perusahaan?.alamatPemilik || '-'} readOnly />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                                <div><label style={labelStyle}>Nama Perusahaan</label><input style={readOnlyStyle} value={perusahaan?.namaPerusahaan || '-'} readOnly /></div>
                                <div><label style={labelStyle}>Singkatan</label><input style={readOnlyStyle} value={perusahaan?.namaPerusahaanSingkat || '-'} readOnly /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                <div><label style={labelStyle}>No. Akta</label><input style={readOnlyStyle} value={perusahaan?.noAkta || '-'} readOnly /></div>
                                <div><label style={labelStyle}>Notaris</label><input style={readOnlyStyle} value={perusahaan?.namaNotaris || '-'} readOnly /></div>
                                <div><label style={labelStyle}>Tgl Akta</label><input style={readOnlyStyle} value={perusahaan?.tanggalAkta || '-'} readOnly /></div>
                            </div>
                            <div>
                                <label style={labelStyle}>Alamat Perusahaan</label>
                                <textarea style={{ ...readOnlyStyle, minHeight: 60, resize: 'vertical' }} value={perusahaan?.alamatPerusahaan || '-'} readOnly />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div><label style={labelStyle}>Telepon</label><input style={readOnlyStyle} value={perusahaan?.noTelp || '-'} readOnly /></div>
                                <div><label style={labelStyle}>Email</label><input style={readOnlyStyle} value={perusahaan?.emailPerusahaan || '-'} readOnly /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                <div><label style={labelStyle}>No Rekening</label><input style={readOnlyStyle} value={perusahaan?.noRekening || '-'} readOnly /></div>
                                <div><label style={labelStyle}>Atas Nama</label><input style={readOnlyStyle} value={perusahaan?.namaRekening || '-'} readOnly /></div>
                                <div><label style={labelStyle}>Bank</label><input style={readOnlyStyle} value={perusahaan?.bank || '-'} readOnly /></div>
                            </div>
                            <div><label style={labelStyle}>NPWP Perusahaan</label><input style={readOnlyStyle} value={perusahaan?.npwp || '-'} readOnly /></div>
                        </div>
                    </div>

                    {/* Right - Search SiRUP */}
                    <div style={sectionStyle}>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.2rem' }}>📋</span> DASAR PERMOHONAN
                        </h3>
                        <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: '0.82rem', color: 'var(--accent-blue)' }}>
                            ⭐ Pastikan untuk mengecek kembali kebenaran data perusahaan Anda. Jika ingin merubah data perusahaan maka hubungi admin.
                        </div>

                        <div style={{ display: 'grid', gap: 16 }}>
                            <div>
                                <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>Kode Sirup <span style={{ color: '#ef4444' }}>*</span></label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input style={{ ...fieldStyle, flex: 1 }} placeholder="Masukkan Kode Sirup" value={kodeSirup}
                                        onChange={e => setKodeSirup(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                                    <button className="btn btn-primary" onClick={handleSearch} disabled={searchLoading}
                                        style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Search size={18} /> {searchLoading ? '...' : 'Cari'}
                                    </button>
                                </div>
                                {searchResult && <div style={{ color: 'var(--accent-green)', fontSize: '0.82rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>✅ Paket berhasil ditemukan!</div>}
                                {searchError && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 6 }}>❌ {searchError}</div>}
                            </div>
                            <div><label style={labelStyle}>Nama Paket</label><input style={readOnlyStyle} value={namaPaket} readOnly /></div>
                            <div><label style={labelStyle}>Metode Pengadaan</label><input style={readOnlyStyle} value={metodePengadaan} readOnly /></div>
                            <div><label style={labelStyle}>Jenis Pengadaan</label><input style={readOnlyStyle} value={jenisPengadaan} readOnly /></div>

                            <button className="btn btn-primary" disabled={!searchResult}
                                onClick={() => setStep(2)}
                                style={{ marginTop: 16, padding: '14px 24px', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
                                <Send size={18} /> LANJUT PERMOHONAN
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
                <div style={sectionStyle}>
                    <h3 style={{ margin: '0 0 24px', fontSize: '1rem' }}>📄 Detail Permohonan — {namaPaket}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div>
                            <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>Nomor DPPL <span style={{ color: '#ef4444' }}>*</span></label>
                            <input style={fieldStyle} placeholder="Masukkan nomor DPPL" value={noDppl} onChange={e => setNoDppl(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>Tanggal DPPL <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="date" style={fieldStyle} value={tanggalDppl} onChange={e => setTanggalDppl(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>Nomor BAHPL <span style={{ color: '#ef4444' }}>*</span></label>
                            <input style={fieldStyle} placeholder="Masukkan nomor BAHPL" value={noBahpl} onChange={e => setNoBahpl(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>Tanggal BAHPL <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="date" style={fieldStyle} value={tanggalBahpl} onChange={e => setTanggalBahpl(e.target.value)} />
                        </div>
                    </div>

                    <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Upload size={18} style={{ color: 'var(--accent-blue)' }} /> Dokumen Penawaran
                    </h4>
                    <div style={{ background: 'var(--bg-secondary)', border: '2px dashed var(--border)', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 24 }}>
                        <label style={{ cursor: 'pointer', display: 'block' }}>
                            <input type="file" accept=".pdf" onChange={e => setBerkasPenawaran(e.target.files?.[0])} style={{ display: 'none' }} />
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                                Upload Berkas Penawaran <span style={{ color: 'var(--accent-blue)' }}>(.pdf)</span>
                            </div>
                            <div className="btn btn-outline" style={{ padding: '8px 20px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <Upload size={16} /> Pilih File
                            </div>
                            {berkasPenawaran && <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--accent-green)' }}>✅ {berkasPenawaran.name}</div>}
                        </label>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 8 }}>ℹ️ Maksimum ukuran file 10MB dalam format PDF</div>
                    </div>

                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}
                        style={{ width: '100%', padding: '14px 24px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Send size={20} /> {loading ? 'Mengirim...' : 'Kirimkan Permohonan Kontrak'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PermohonanKontrak;
