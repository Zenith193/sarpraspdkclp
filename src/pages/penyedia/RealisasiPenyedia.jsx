import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, Target, Camera, Trash2, Edit, X, ArrowLeft, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { kontrakApi } from '../../api/index';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const currentYear = new Date().getFullYear();

// Fix image path — use file proxy that searches multiple directories
const fixImgPath = (p) => {
    if (!p) return '';
    // Extract filename from path like /uploads/kontrak/1234_file.jpg
    const match = p.match(/\/uploads\/kontrak\/(.+)$/);
    if (match) return '/api/file/kontrak/' + encodeURIComponent(match[1]);
    return p;
};

const RealisasiPenyedia = () => {
    const [matrikList, setMatrikList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedId, setExpandedId] = useState(null);

    // Detail view
    const [activeMatrik, setActiveMatrik] = useState(null);
    const [anakan, setAnakan] = useState([]);
    const [realisasiList, setRealisasiList] = useState([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Form state
    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({
        namaSekolah: '', matrikId: '', tahun: currentYear,
        bulan: new Date().getMonth() + 1, targetPersen: '', realisasiPersen: '', keterangan: ''
    });
    const [files, setFiles] = useState([null, null, null, null, null, null]);
    const fileRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
    const [submitting, setSubmitting] = useState(false);
    const [editPhotos, setEditPhotos] = useState([]); // existing photos when editing

    // Lightbox state
    const [lightbox, setLightbox] = useState({ open: false, photos: [], index: 0 });
    const openLightbox = (photos, index) => setLightbox({ open: true, photos, index });
    const closeLightbox = () => setLightbox({ open: false, photos: [], index: 0 });
    const lbPrev = () => setLightbox(prev => ({ ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length }));
    const lbNext = () => setLightbox(prev => ({ ...prev, index: (prev.index + 1) % prev.photos.length }));

    useEffect(() => {
        kontrakApi.listMatrikRealisasi().then(data => {
            const arr = Array.isArray(data) ? data : (data?.data || []);
            setMatrikList(arr);
        }).catch(() => toast.error('Gagal memuat data paket')).finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return matrikList;
        return matrikList.filter(k =>
            (k.namaPaket || '').toLowerCase().includes(q) ||
            (k.noSpk || '').toLowerCase().includes(q) ||
            (k.penyedia || '').toLowerCase().includes(q) ||
            (k.noMatrik || '').toLowerCase().includes(q) ||
            (k.jenisPengadaan || '').toLowerCase().includes(q) ||
            (k.anakan || []).some(a => (a.namaSekolah || '').toLowerCase().includes(q))
        );
    }, [matrikList, search]);

    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const paged = useMemo(() => {
        const s = (currentPage - 1) * pageSize;
        return filtered.slice(s, s + pageSize);
    }, [filtered, currentPage, pageSize]);

    const openDetail = async (matrik, preSelectedAnakan = null) => {
        setActiveMatrik(matrik);
        const anakanList = matrik.anakan || [];
        setAnakan(anakanList);
        setLoadingDetail(true);
        setFormOpen(false);
        setEditId(null);
        try {
            // Fetch realisasi from parent + all anakan
            const parentRl = await kontrakApi.listRealisasiByMatrik(matrik.id);
            const parentArr = Array.isArray(parentRl) ? parentRl : (parentRl?.data || []);
            
            // Also fetch realisasi from all anakan
            const anakanResults = await Promise.all(
                anakanList.map(a => kontrakApi.listRealisasiByMatrik(a.id).then(r => {
                    const arr = Array.isArray(r) ? r : [];
                    // Tag with anakan info so we know which school it belongs to
                    return arr.map(item => ({
                        ...item,
                        namaSekolah: item.namaSekolah || a.namaSekolah || a.namaPaket,
                        matrikId: item.matrikId || a.id,
                    }));
                }).catch(() => []))
            );
            
            setRealisasiList([...parentArr, ...anakanResults.flat()]);
        } catch { toast.error('Gagal memuat data realisasi'); }
        setLoadingDetail(false);

        // If pre-selected anakan, open form with it
        if (preSelectedAnakan) {
            setForm(prev => ({
                ...prev,
                matrikId: String(preSelectedAnakan.id),
                namaSekolah: preSelectedAnakan.namaSekolah || preSelectedAnakan.namaPaket || '',
            }));
            setFormOpen(true);
        }
    };

    const resetForm = () => {
        setForm({
            namaSekolah: activeMatrik?.namaSekolah || '',
            matrikId: '', tahun: currentYear,
            bulan: new Date().getMonth() + 1, targetPersen: '', realisasiPersen: '', keterangan: ''
        });
        setFiles([null, null, null, null, null, null]);
        setEditId(null);
        setEditPhotos([]);
    };

    const handleAnakanChange = (e) => {
        const id = e.target.value;
        if (!id) { setForm(prev => ({ ...prev, matrikId: '', namaSekolah: '' })); return; }
        const child = anakan.find(a => String(a.id) === id);
        setForm(prev => ({ ...prev, matrikId: id, namaSekolah: child?.namaSekolah || '' }));
    };

    const handleFileChange = (index, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFiles(prev => { const n = [...prev]; n[index] = file; return n; });
    };

    // Helper to reload all realisasi (parent + anakan)
    const reloadRealisasi = async () => {
        if (!activeMatrik) return;
        try {
            const parentRl = await kontrakApi.listRealisasiByMatrik(activeMatrik.id);
            const parentArr = Array.isArray(parentRl) ? parentRl : [];
            const anakanResults = await Promise.all(
                (activeMatrik.anakan || []).map(a => kontrakApi.listRealisasiByMatrik(a.id).then(r => {
                    const arr = Array.isArray(r) ? r : [];
                    return arr.map(item => ({
                        ...item,
                        namaSekolah: item.namaSekolah || a.namaSekolah || a.namaPaket,
                        matrikId: item.matrikId || a.id,
                    }));
                }).catch(() => []))
            );
            setRealisasiList([...parentArr, ...anakanResults.flat()]);
        } catch {}
    };

    const handleSubmit = async () => {
        if (!form.namaSekolah) return toast.error('Nama Sekolah wajib diisi');
        if (!form.targetPersen && !form.realisasiPersen) return toast.error('Target / Realisasi wajib diisi');
        // Validate 6 photos mandatory on create
        if (!editId) {
            const filledPhotos = files.filter(f => f !== null).length;
            if (filledPhotos < 6) return toast.error(`Wajib upload 6 gambar (baru ${filledPhotos} gambar)`);
        }
        setSubmitting(true);
        try {
            if (editId) {
                await kontrakApi.updateRealisasi(editId, {
                    namaSekolah: form.namaSekolah,
                    matrikId: form.matrikId || activeMatrik.id,
                    tahun: form.tahun, bulan: form.bulan,
                    targetPersen: form.targetPersen, realisasiPersen: form.realisasiPersen,
                    keterangan: form.keterangan,
                });
                toast.success('Realisasi berhasil diperbarui');
            } else {
                const fd = new FormData();
                fd.append('namaSekolah', form.namaSekolah);
                fd.append('matrikId', form.matrikId || String(activeMatrik.id));
                fd.append('tahun', String(form.tahun));
                fd.append('bulan', String(form.bulan));
                fd.append('targetPersen', String(form.targetPersen || 0));
                fd.append('realisasiPersen', String(form.realisasiPersen || 0));
                if (form.keterangan) fd.append('keterangan', form.keterangan);
                files.forEach(f => { if (f) fd.append('dokumentasi', f); });
                await kontrakApi.createRealisasiByMatrik(activeMatrik.id, fd);
                toast.success('Realisasi berhasil ditambahkan');
            }
            await reloadRealisasi();
            resetForm();
            setFormOpen(false);
        } catch (e) { toast.error('Gagal: ' + (e.message || '')); }
        setSubmitting(false);
    };

    const handleEdit = (item) => {
        setEditId(item.id);
        setForm({
            namaSekolah: item.namaSekolah || '', matrikId: item.matrikId || '',
            tahun: item.tahun, bulan: item.bulan,
            targetPersen: item.targetPersen || '', realisasiPersen: item.realisasiPersen || '',
            keterangan: item.keterangan || '',
        });
        setFiles([null, null, null, null, null, null]);
        // Parse existing photos for display in edit form
        const existingPhotos = parsePaths(item.dokumentasiPaths).map(p => fixImgPath(p));
        setEditPhotos(existingPhotos);
        setFormOpen(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus data realisasi ini?')) return;
        try {
            await kontrakApi.deleteRealisasi(id);
            await reloadRealisasi();
            toast.success('Data realisasi dihapus');
        } catch { toast.error('Gagal menghapus'); }
    };

    const parsePaths = (p) => { try { return JSON.parse(p); } catch { return []; } };

    // ===== Build merged table rows =====
    const buildMergedRows = () => {
        if (realisasiList.length === 0) return [];

        // Sort by sekolah, tahun desc, bulan desc
        const sorted = [...realisasiList].sort((a, b) => {
            const sa = (a.namaSekolah || '').localeCompare(b.namaSekolah || '');
            if (sa !== 0) return sa;
            if (a.tahun !== b.tahun) return b.tahun - a.tahun;
            return b.bulan - a.bulan;
        });

        // Group by sekolah → tahun → bulan
        const rows = [];
        let prevSekolah = null, prevTahun = null, prevBulan = null;
        let sekolahCount = 0, tahunCount = 0, bulanCount = 0;
        let sekolahStartIdx = 0, tahunStartIdx = 0, bulanStartIdx = 0;

        sorted.forEach((item, idx) => {
            const sekolah = item.namaSekolah || '-';
            const tahun = item.tahun;
            const bulan = item.bulan;

            const isNewSekolah = sekolah !== prevSekolah;
            const isNewTahun = isNewSekolah || tahun !== prevTahun;
            const isNewBulan = isNewTahun || bulan !== prevBulan;

            // Set rowspans for previous groups
            if (isNewSekolah && prevSekolah !== null) {
                rows[sekolahStartIdx].sekolahRowSpan = sekolahCount;
            }
            if (isNewTahun && prevTahun !== null) {
                rows[tahunStartIdx].tahunRowSpan = tahunCount;
            }
            if (isNewBulan && prevBulan !== null) {
                rows[bulanStartIdx].bulanRowSpan = bulanCount;
            }

            if (isNewSekolah) { sekolahCount = 0; sekolahStartIdx = rows.length; }
            if (isNewTahun) { tahunCount = 0; tahunStartIdx = rows.length; }
            if (isNewBulan) { bulanCount = 0; bulanStartIdx = rows.length; }

            sekolahCount++;
            tahunCount++;
            bulanCount++;

            rows.push({
                ...item,
                showSekolah: isNewSekolah,
                showTahun: isNewTahun,
                showBulan: isNewBulan,
                sekolahRowSpan: 1,
                tahunRowSpan: 1,
                bulanRowSpan: 1,
            });

            prevSekolah = sekolah;
            prevTahun = tahun;
            prevBulan = bulan;
        });

        // Final group rowspans
        if (rows.length > 0) {
            rows[sekolahStartIdx].sekolahRowSpan = sekolahCount;
            rows[tahunStartIdx].tahunRowSpan = tahunCount;
            rows[bulanStartIdx].bulanRowSpan = bulanCount;
        }

        return rows;
    };

    // ===== LIGHTBOX =====
    const renderLightbox = () => {
        if (!lightbox.open || lightbox.photos.length === 0) return null;
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
                onClick={closeLightbox}>
                {/* Close button */}
                <button onClick={closeLightbox}
                    style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontSize: '1.2rem' }}>
                    <X size={24} />
                </button>
                {/* Counter */}
                <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', zIndex: 10 }}>
                    {lightbox.index + 1} / {lightbox.photos.length}
                </div>
                {/* Prev button */}
                {lightbox.photos.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); lbPrev(); }}
                        style={{ position: 'absolute', left: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, transition: 'background 0.2s' }}
                        onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.1)'}>
                        <ChevronLeft size={28} />
                    </button>
                )}
                {/* Image */}
                <img src={lightbox.photos[lightbox.index]} alt=""
                    onClick={e => e.stopPropagation()}
                    style={{ maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
                {/* Next button */}
                {lightbox.photos.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); lbNext(); }}
                        style={{ position: 'absolute', right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, transition: 'background 0.2s' }}
                        onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.1)'}>
                        <ChevronRight size={28} />
                    </button>
                )}
            </div>
        );
    };

    // ===== DETAIL VIEW =====
    if (activeMatrik) {
        const mergedRows = buildMergedRows();
        let noCounter = 0;

        return (
            <div>
                {renderLightbox()}
                <button className="btn btn-ghost btn-sm" onClick={() => setActiveMatrik(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                    <ArrowLeft size={16} /> Kembali ke Daftar Paket
                </button>

                {/* Header info */}
                <div className="table-container" style={{ marginBottom: 16, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Realisasi Paket</h2>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>{activeMatrik.namaPaket}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                No. Matrik: <strong>{activeMatrik.noMatrik}</strong> • {activeMatrik.jenisPengadaan}
                            </div>
                            {activeMatrik.penyedia && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>Penyedia: <strong>{activeMatrik.penyedia}</strong></div>}
                            {activeMatrik.nilaiKontrak && <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)', marginTop: 2, fontWeight: 600 }}>Nilai Kontrak: {formatCurrency(activeMatrik.nilaiKontrak)}</div>}
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setFormOpen(!formOpen); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Plus size={14} /> Tambah Realisasi
                        </button>
                    </div>
                </div>

                {/* Form */}
                {formOpen && (
                    <div className="table-container" style={{ marginBottom: 16, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{editId ? 'Edit Realisasi' : 'Tambah Realisasi Baru'}</h3>
                            <button className="btn-icon" onClick={() => { setFormOpen(false); resetForm(); }}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                            {anakan.length > 0 && (
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Pilih Sekolah (Anakan)</label>
                                    <select value={form.matrikId} onChange={handleAnakanChange}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                        <option value="">-- Pilih Sekolah --</option>
                                        {anakan.map(a => <option key={a.id} value={a.id}>{a.namaSekolah || a.namaPaket} ({a.noMatrik})</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Nama Sekolah</label>
                                <input value={form.namaSekolah} onChange={e => setForm(prev => ({ ...prev, namaSekolah: e.target.value }))}
                                    placeholder="Nama Sekolah" readOnly={anakan.length > 0 && !!form.matrikId}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: anakan.length > 0 && form.matrikId ? 'var(--bg-secondary)' : 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Tahun</label>
                                <input type="number" value={form.tahun} readOnly
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'not-allowed' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Bulan</label>
                                <select value={form.bulan} onChange={e => setForm(prev => ({ ...prev, bulan: Number(e.target.value) }))}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                    {BULAN.map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Target (%)</label>
                                <input type="number" step="0.01" value={form.targetPersen} onChange={e => setForm(prev => ({ ...prev, targetPersen: e.target.value }))}
                                    placeholder="0.00" min="0" max="100"
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Realisasi (%)</label>
                                <input type="number" step="0.01" value={form.realisasiPersen} onChange={e => setForm(prev => ({ ...prev, realisasiPersen: e.target.value }))}
                                    placeholder="0.00" min="0" max="100"
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                            </div>
                        </div>
                        {/* Photo section */}
                        {editId ? (
                            /* EDIT MODE: Show existing photos with click-to-replace */
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>
                                    Dokumentasi <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.72rem' }}>(klik foto untuk mengganti)</span>
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                                    {Array.from({ length: 6 }).map((_, i) => {
                                        const hasNewFile = files[i] !== null;
                                        const existingSrc = editPhotos[i] || null;
                                        return (
                                            <div key={i} onClick={() => fileRefs[i].current.click()}
                                                style={{ position: 'relative', height: 110, borderRadius: 8, cursor: 'pointer', border: hasNewFile ? '2px solid var(--accent-green)' : existingSrc ? '1px solid var(--border-color)' : '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
                                                {hasNewFile ? (
                                                    <>
                                                        <img src={URL.createObjectURL(files[i])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(34,197,94,0.8)', color: '#fff', fontSize: '0.6rem', textAlign: 'center', padding: '2px 0', fontWeight: 600 }}>BARU</div>
                                                        <button onClick={(e) => { e.stopPropagation(); setFiles(prev => { const n = [...prev]; n[i] = null; return n; }); }}
                                                            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
                                                    </>
                                                ) : existingSrc ? (
                                                    <>
                                                        <img src={existingSrc} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            onError={e => { e.target.style.display = 'none'; }} />
                                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                                                            onMouseEnter={e => e.target.style.opacity = '1'}
                                                            onMouseLeave={e => e.target.style.opacity = '0'}>
                                                            <Camera size={22} style={{ color: '#fff' }} />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <><Camera size={20} style={{ color: 'var(--text-secondary)' }} /><span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Gambar {i + 1}</span></>
                                                )}
                                                <input ref={fileRefs[i]} type="file" accept="image/*" onChange={e => handleFileChange(i, e)} style={{ display: 'none' }} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            /* CREATE MODE: 6 mandatory upload slots */
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>Dokumentasi (wajib 6 gambar)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                                    {files.map((file, i) => (
                                        <div key={i} onClick={() => fileRefs[i].current.click()}
                                            style={{ position: 'relative', height: 100, borderRadius: 8, cursor: 'pointer', border: '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: file ? 'var(--bg-secondary)' : 'var(--bg-input)', overflow: 'hidden' }}>
                                            {file ? (
                                                <>
                                                    <img src={URL.createObjectURL(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    <button onClick={(e) => { e.stopPropagation(); setFiles(prev => { const n = [...prev]; n[i] = null; return n; }); }}
                                                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
                                                </>
                                            ) : (<><Camera size={20} style={{ color: 'var(--text-secondary)' }} /><span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Gambar {i + 1}</span></>)}
                                            <input ref={fileRefs[i]} type="file" accept="image/*" onChange={e => handleFileChange(i, e)} style={{ display: 'none' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Keterangan</label>
                            <textarea value={form.keterangan} onChange={e => setForm(prev => ({ ...prev, keterangan: e.target.value }))}
                                rows={2} placeholder="Catatan tambahan (opsional)"
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setFormOpen(false); resetForm(); }}>Batal</button>
                            <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting}
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {submitting ? 'Menyimpan...' : editId ? 'Update' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Riwayat with merged cells */}
                <div className="table-container">
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Riwayat Realisasi</h3>
                    </div>
                    {loadingDetail ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat...</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 40, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>No</th>
                                        <th style={{ minWidth: 180, borderRight: '1px solid var(--border-color)' }}>Sekolah</th>
                                        <th style={{ width: 60, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Tahun</th>
                                        <th style={{ width: 100, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Bulan</th>
                                        <th style={{ width: 90, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Target</th>
                                        <th style={{ width: 90, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Realisasi</th>
                                        <th style={{ minWidth: 220, borderRight: '1px solid var(--border-color)' }}>Dokumentasi</th>
                                        <th style={{ width: 80, textAlign: 'center' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mergedRows.map((r, i) => {
                                        const target = Number(r.targetPersen) || 0;
                                        const real = Number(r.realisasiPersen) || 0;
                                        const photos = parsePaths(r.dokumentasiPaths);
                                        if (r.showSekolah) noCounter++;

                                        return (
                                            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                {r.showSekolah && (
                                                    <td rowSpan={r.sekolahRowSpan} style={{ textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontWeight: 600 }}>
                                                        {noCounter}
                                                    </td>
                                                )}
                                                {r.showSekolah && (
                                                    <td rowSpan={r.sekolahRowSpan} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600, padding: '12px 10px' }}>
                                                        {r.namaSekolah || '-'}
                                                    </td>
                                                )}
                                                {r.showTahun && (
                                                    <td rowSpan={r.tahunRowSpan} style={{ textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600 }}>
                                                        {r.tahun}
                                                    </td>
                                                )}
                                                {r.showBulan && (
                                                    <td rowSpan={r.bulanRowSpan} style={{ textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                                                        {BULAN[r.bulan - 1]}
                                                    </td>
                                                )}
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', padding: '10px 6px' }}>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 3 }}>{target.toFixed(2)}%</div>
                                                    <div style={{ width: '100%', height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{ width: `${Math.min(target, 100)}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: 3, transition: 'width 0.3s' }} />
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', padding: '10px 6px' }}>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 3 }}>{real.toFixed(2)}%</div>
                                                    <div style={{ width: '100%', height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{ width: `${Math.min(real, 100)}%`, height: '100%', background: 'var(--accent-green)', borderRadius: 3, transition: 'width 0.3s' }} />
                                                    </div>
                                                </td>
                                                <td style={{ verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', padding: '8px 6px' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                                                        {photos.length > 0 ? photos.map((p, j) => {
                                                            const allPhotos = photos.map(pp => fixImgPath(pp));
                                                            return (
                                                                <div key={j} onClick={() => openLightbox(allPhotos, j)} style={{ cursor: 'pointer' }}>
                                                                    <img src={fixImgPath(p)} alt={`Foto ${j + 1}`}
                                                                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)', display: 'block', transition: 'transform 0.15s, opacity 0.15s' }}
                                                                        onMouseEnter={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.opacity = '0.85'; }}
                                                                        onMouseLeave={e => { e.target.style.transform = 'scale(1)'; e.target.style.opacity = '1'; }}
                                                                        onError={e => { e.target.style.display = 'none'; }} />
                                                                </div>
                                                            );
                                                        }) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', gridColumn: 'span 3' }}>Tidak ada foto</span>}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 4px' }}>
                                                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                        <button onClick={() => handleEdit(r)} title="Edit"
                                                            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                                                            <Edit size={15} />
                                                        </button>
                                                        <button onClick={() => handleDelete(r.id)} title="Hapus"
                                                            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {mergedRows.length === 0 && (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Belum ada data realisasi</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ===== LIST VIEW =====
    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Realisasi Kontrak</h1>
                    <p>Laporkan progress pelaksanaan pekerjaan</p>
                </div>
            </div>
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left" style={{ gap: 8 }}>
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari paket, No SPK, penyedia..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                <option value="10">10</option><option value="25">25</option><option value="50">50</option>
                            </select>
                        </div>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat data paket...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>#</th>
                                    <th style={{ width: 70 }}>Matrik</th>
                                    <th>Aksi</th>
                                    <th style={{ minWidth: 250 }}>Nama Paket</th>
                                    <th>Penyedia</th>
                                    <th>Jenis</th>
                                    <th>Anakan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((k, i) => {
                                    const hasAnakan = k.anakan && k.anakan.length > 0;
                                    const isExpanded = expandedId === k.id;
                                    return (
                                        <>
                                            <tr key={k.id}>
                                                <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600 }}>{k.noMatrik}</td>
                                                <td>
                                                    <button className="btn btn-primary btn-sm" onClick={() => openDetail(k)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                                        <Target size={13} /> Realisasi
                                                    </button>
                                                </td>
                                                <td style={{ fontSize: '0.82rem' }}>{k.namaPaket}</td>
                                                <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>{k.penyedia || '-'}</td>
                                                <td><span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(59,130,246,0.08)', color: 'var(--accent-blue)', fontWeight: 500, whiteSpace: 'nowrap' }}>{k.jenisPengadaan}</span></td>
                                                <td>
                                                    {hasAnakan ? (
                                                        <button className="btn btn-ghost btn-sm" onClick={() => setExpandedId(isExpanded ? null : k.id)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--accent-blue)' }}>
                                                            {k.anakan.length} sekolah {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </button>
                                                    ) : <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>-</span>}
                                                </td>
                                            </tr>
                                            {hasAnakan && isExpanded && k.anakan.map(a => (
                                                <tr key={`${k.id}-${a.id}`} style={{ background: 'rgba(59,130,246,0.03)' }}>
                                                    <td></td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: 16 }}>{a.noMatrik}</td>
                                                    <td>
                                                        <button className="btn btn-sm" onClick={() => openDetail(k, a)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: '0.72rem', whiteSpace: 'nowrap', background: 'rgba(34,197,94,0.1)', color: 'var(--accent-green)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, cursor: 'pointer' }}>
                                                            <Target size={11} /> Realisasi
                                                        </button>
                                                    </td>
                                                    <td colSpan={2} style={{ fontSize: '0.82rem', paddingLeft: 8 }}>
                                                        <span style={{ color: 'var(--accent-blue)', marginRight: 6 }}>↳</span>
                                                        {a.namaSekolah || a.namaPaket}
                                                    </td>
                                                    <td></td>
                                                    <td>{a.nilaiKontrak ? <span style={{ fontSize: '0.72rem', color: 'var(--accent-green)' }}>{formatCurrency(a.nilaiKontrak)}</span> : null}</td>
                                                </tr>
                                            ))}
                                        </>
                                    );
                                })}
                                {paged.length === 0 && (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Tidak ada paket yang sesuai.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="table-pagination">
                    <div className="table-pagination-info">
                        Menampilkan {filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} paket
                    </div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem' }}>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RealisasiPenyedia;
