import { useState, useEffect } from 'react';
import { ClipboardCheck, Eye, Search, X, CheckCircle, XCircle, Clock, Save, ChevronRight, Plus, Minus, Edit2, ArrowLeft, Download, FileText } from 'lucide-react';
import { kontrakApi } from '../../api';
import { templateApi } from '../../api';

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
    const [viewDetail, setViewDetail] = useState(null);
    const [tab, setTab] = useState('data_dasar');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    // Verifikator edit fields
    const [spkData, setSpkData] = useState({});
    const [spSpmkData, setSpSpmkData] = useState({});
    const [agreed, setAgreed] = useState(false);
    const [spkAgreed, setSpkAgreed] = useState(false);
    const [nilaiItems, setNilaiItems] = useState([]);
    const [editDppl, setEditDppl] = useState({ noDppl: '', tanggalDppl: '', noBahpl: '', tanggalBahpl: '' });
    const [tabSaved, setTabSaved] = useState({ data_dasar: false, spk: false, lampiran: false, sp_spmk: false, verifikasi: false });
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [generating, setGenerating] = useState(false);

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
            setSpkAgreed(false);
            // Init tabSaved from existing server data
            setTabSaved({
                data_dasar: !!d.kodeSirup,
                spk: !!d.noSpk,
                lampiran: !!(d.noDppl || d.noBahpl),
                sp_spmk: !!d.noSp,
                verifikasi: d.status === 'Diverifikasi',
            });
            const nk = d.nilaiKontrak || d.matrik?.nilaiKontrak || '';
            const wp = d.waktuPenyelesaian || (d.matrik?.jangkaWaktu ? String(d.matrik.jangkaWaktu) : '');
            const wpNum = String(wp).replace(/[^\d]/g, '') || '';
            const tglMulai = d.tanggalMulai || d.matrik?.tanggalMulai || '';
            const tglSelesai = d.tanggalSelesai || d.matrik?.tanggalSelesai || calcTanggalSelesai(tglMulai, wpNum);
            const tb = d.terbilangKontrak || d.matrik?.terbilangKontrak || numberToTerbilang(nk);
            // Initialize nilaiItems: priority = stored > siblings > single
            const storedItems = d.nilaiItems ? JSON.parse(d.nilaiItems) : null;
            if (storedItems) {
                setNilaiItems(storedItems);
            } else {
                // Auto-detect siblings (anakan) from matrik using RUP code
                const rupCode = d.kodeSirup || d.matrik?.rup || '';
                console.log('[Anakan] Searching siblings for RUP:', rupCode);
                if (rupCode) {
                    try {
                        const siblings = await kontrakApi.searchSiblings(rupCode);
                        console.log('[Anakan] Siblings found:', siblings);
                        if (Array.isArray(siblings) && siblings.length > 1) {
                            setNilaiItems(siblings.map(s => ({
                                nama: s.namaPaket || '',
                                nilai: String(s.nilaiKontrak || s.hps || s.paguAnggaran || 0)
                            })));
                        } else {
                            setNilaiItems(nk ? [{ nama: d.namaPaket || '', nilai: String(nk) }] : []);
                        }
                    } catch (err) {
                        console.error('[Anakan] Error:', err);
                        setNilaiItems(nk ? [{ nama: d.namaPaket || '', nilai: String(nk) }] : []);
                    }
                } else {
                    setNilaiItems(nk ? [{ nama: d.namaPaket || '', nilai: String(nk) }] : []);
                }
            }
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
            // Auto-fill No SP from No SPK: add ".a" to 2nd segment (e.g. 400.3.13/400/A3/2026 → 400.3.13/400.a/A3/2026)
            const autoNoSp = (() => {
                const spk = d.noSpk || spkData?.noSpk || '';
                if (!spk) return '';
                const parts = spk.split('/');
                if (parts.length >= 2) { parts[1] = parts[1] + '.a'; }
                return parts.join('/');
            })();
            setSpSpmkData({
                noSp: d.noSp || autoNoSp,
                tanggalSp: d.tanggalSp || tglMulai || '',
                idPaket: d.idPaket || d.kodeSirup || '',
            });
            setEditDppl({
                noDppl: d.noDppl || '',
                tanggalDppl: d.tanggalDppl || '',
                noBahpl: d.noBahpl || '',
                tanggalBahpl: d.tanggalBahpl || '',
            });
        } catch { }
    };

    const handleSaveSpk = async () => {
        if (!detail) return;
        setSaving(true);
        try {
            await kontrakApi.updatePermohonan(detail.id, { ...spkData, nilaiKontrak: Number(spkData.nilaiKontrak) || 0, nilaiItems: nilaiItems.length > 1 ? JSON.stringify(nilaiItems) : null });
            setTabSaved(prev => ({ ...prev, spk: true }));
            showToast('Data SPK berhasil disimpan');
        } catch { showToast('Gagal menyimpan SPK', true); }
        setSaving(false);
    };

    const handleSaveDppl = async () => {
        if (!detail) return;
        setSaving(true);
        try {
            await kontrakApi.updatePermohonan(detail.id, editDppl);
            setDetail(prev => ({ ...prev, ...editDppl }));
            setTabSaved(prev => ({ ...prev, lampiran: true }));
            showToast('Data DPPL/BAHPL berhasil disimpan');
        } catch { showToast('Gagal menyimpan DPPL/BAHPL', true); }
        setSaving(false);
    };

    const handleSaveSpSpmk = async () => {
        if (!detail) return;
        setSaving(true);
        try {
            await kontrakApi.updatePermohonan(detail.id, spSpmkData);
            setTabSaved(prev => ({ ...prev, sp_spmk: true }));
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

    const handleView = async (id) => {
        try {
            const res = await kontrakApi.getPermohonan(id);
            setViewDetail(res);
        } catch { showToast('Gagal memuat detail', true); }
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

            {/* ===== FULL-PAGE VIEW DETAIL (like LAKON) ===== */}
            {viewDetail ? (() => {
                const d = viewDetail;
                const p = d.perusahaan || {};
                const m = d.matrik || {};
                const infoCard = { background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 16px', border: '1px solid var(--border)' };
                const infoLabel = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 2 };
                const infoVal = { fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 };
                const sectionHeader = { background: 'var(--accent-blue)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: '0.92rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 };
                const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 };
                const grid1 = { display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 };

                return (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                            <button onClick={() => setViewDetail(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                                <ArrowLeft size={18} /> Kembali
                            </button>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>DETAIL KONTRAK</h2>
                        </div>

                        {/* Template Dokumen */}
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Template Dokumen</label>
                                    <select
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                                        value={selectedTemplate || ''}
                                        onFocus={() => { if (templates.length === 0) templateApi.list().then(t => setTemplates(t || [])).catch(() => {}); }}
                                        onChange={e => setSelectedTemplate(Number(e.target.value) || null)}
                                    >
                                        <option value="">Pilih Template</option>
                                        {templates.map(t => <option key={t.id} value={t.id}>{t.nama} {t.jenisCocok ? `(${t.jenisCocok})` : ''}</option>)}
                                    </select>
                                </div>
                                <button
                                    disabled={!selectedTemplate || generating}
                                    onClick={async () => {
                                        if (!selectedTemplate) return showToast('Pilih template terlebih dahulu', true);
                                        setGenerating(true);
                                        try {
                                            const item = { ...d, ...d.perusahaan, ...d.matrik };
                                            const result = await templateApi.generate(selectedTemplate, item, {});
                                            if (result.historyId) {
                                                const blob = await templateApi.getSplFile('docx', result.historyId);
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url; a.download = `Kontrak_${d.namaPaket || 'document'}.docx`;
                                                a.click(); URL.revokeObjectURL(url);
                                                showToast('✅ Dokumen berhasil diunduh');
                                            }
                                        } catch (e) { showToast('Gagal generate: ' + e.message, true); }
                                        setGenerating(false);
                                    }}
                                    style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: selectedTemplate ? 'var(--accent-blue)' : '#555', color: '#fff', fontWeight: 600, fontSize: '0.88rem', cursor: selectedTemplate ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <Save size={16} /> {generating ? 'Generating...' : 'Simpan Template'}
                                </button>
                            </div>
                            {!selectedTemplate && <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>⚠️ Pilih template dokumen terlebih dahulu</div>}

                            {/* Download section */}
                            <div style={{ ...sectionHeader, background: '#1e293b', marginBottom: 12 }}>📥 UNDUH DOKUMEN KONTRAK LENGKAP</div>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                <button onClick={() => { if(d.berkasPenawaranPath) window.open(d.berkasPenawaranPath, '_blank'); else showToast('Tidak ada berkas PDF', true); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Download size={14} /> Unduh PDF
                                </button>
                                <button onClick={() => { if(!selectedTemplate) { showToast('Pilih template dulu', true); return; } }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <FileText size={14} /> Unduh DOCX
                                </button>
                            </div>

                            {/* Variable Reference */}
                            <details style={{ marginTop: 16 }}>
                                <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)' }}>📋 Daftar Variabel Template (klik untuk melihat)</summary>
                                <div style={{ marginTop: 12, fontSize: '0.78rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                            <thead><tr style={{ background: 'var(--bg-primary)', textAlign: 'left' }}>
                                                <th style={{ padding: '6px 10px', border: '1px solid var(--border)' }}>Variabel</th>
                                                <th style={{ padding: '6px 10px', border: '1px solid var(--border)' }}>Keterangan</th>
                                                <th style={{ padding: '6px 10px', border: '1px solid var(--border)' }}>Contoh</th>
                                            </tr></thead>
                                            <tbody>
                                            {[
                                                ['DATA UMUM', '', ''],
                                                ['{{noMatrik}}', 'Nomor Matrik', '65'],
                                                ['{{namaPaket}}', 'Nama Paket Pekerjaan', 'Pembangunan RKB SDN...'],
                                                ['{{namaSekolah}}', 'Nama Sekolah', 'SDN Sidareja 01'],
                                                ['{{namaSekolahUpper}}', 'Nama Sekolah (HURUF BESAR)', 'SDN SIDAREJA 01'],
                                                ['{{npsn}}', 'NPSN Sekolah', '20301234'],
                                                ['{{noSpk}}', 'No SPK/Kontrak', '400.3.13/30/A3/2026'],
                                                ['{{nilaiKontrak}}', 'Nilai Kontrak (format Rp)', '85.000.000'],
                                                ['{{nilaiKontrakRaw}}', 'Nilai Kontrak (angka)', '85000000'],
                                                ['{{terbilangKontrak}}', 'Terbilang Kontrak', 'Delapan Puluh Lima Juta Rupiah'],
                                                ['{{jangkaWaktu}}', 'Jangka Waktu (angka)', '90'],
                                                ['{{jangkaWaktuText}}', 'Jangka Waktu (teks)', '90 Hari Kalender'],
                                                ['{{sumberDana}}', 'Sumber Dana', 'APBD'],
                                                ['{{tahunAnggaran}}', 'Tahun Anggaran', '2026'],
                                                ['{{metode}}', 'Metode Pengadaan', 'Non Tender'],
                                                ['{{subKegiatan}}', 'Sub Kegiatan', 'Rehabilitasi Sedang/Berat Ruang Kelas Sekolah'],
                                                ['{{noSubKegiatan}}', 'No Sub Kegiatan', ''],
                                                ['{{paguAnggaran}}', 'Pagu Anggaran (format Rp)', '100.000.000'],
                                                ['{{paguAnggaranRaw}}', 'Pagu Anggaran (angka)', '100000000'],
                                                ['{{terbilangPaguAnggaran}}', 'Terbilang Pagu Anggaran', 'Seratus juta rupiah'],
                                                ['{{paguPaket}}', 'Pagu Paket (format Rp)', '80.000.000'],
                                                ['{{hps}}', 'HPS (format Rp)', '85.000.000'],
                                                ['{{hpsRaw}}', 'HPS (angka)', '85000000'],
                                                ['{{terbilangHps}}', 'Terbilang HPS', 'Delapan puluh lima juta rupiah'],
                                                ['{{terbilangJangkaWaktu}}', 'Terbilang Jangka Waktu', 'Sembilan puluh'],
                                                ['AKTA & NOTARIS', '', ''],
                                                ['{{noAkta}}', 'Nomor Akta', 'Nomor 54'],
                                                ['{{tanggalAkta}}', 'Tanggal Akta', '19 Januari 2024'],
                                                ['{{namaNotaris}}', 'Nama Notaris', 'MELLIYA NATRATILOVA, SH, M.Kn'],
                                                ['DPPL & BAHPL', '', ''],
                                                ['{{noDppl}}', 'Nomor DPPL', 'DPPL/001/2026'],
                                                ['{{tanggalDppl}}', 'Tanggal DPPL', '04 Februari 2026'],
                                                ['{{noBahpl}}', 'Nomor BAHPL', 'BAHPL/001/2026'],
                                                ['{{tanggalBahpl}}', 'Tanggal BAHPL', '04 Februari 2026'],
                                                ['{{kodeLampiran}}', 'Kode Lampiran / Kode SiRUP', '657575'],
                                                ['PENYEDIA', '', ''],
                                                ['{{penyedia}}', 'Nama Perusahaan', 'CV. JAGAT ALIT'],
                                                ['{{namaPemilik}}', 'Nama Direktur/Pemilik', 'DINDA AURYSTA'],
                                                ['{{statusPemilik}}', 'Status Pemilik', 'Direktur'],
                                                ['{{alamatKantor}}', 'Alamat Kantor', 'Jl. Kebonmanis No.104...'],
                                                ['{{noHp}}', 'No HP Penyedia', '08123456789'],
                                                ['TANGGAL MULAI', '', ''],
                                                ['{{tanggalMulai}}', 'Tanggal Mulai (format)', '06 April 2026'],
                                                ['{{hariTanggalMulai}}', 'Hari, Tanggal Mulai', 'Senin, 06 April 2026'],
                                                ['{{terbilangTanggalMulai}}', 'Terbilang Tgl Mulai', 'senin tanggal enam bulan April tahun...'],
                                                ['{{hariMulai}}', 'Hari Mulai', 'Senin'],
                                                ['{{hariMulaiLower}}', 'Hari Mulai (kecil)', 'senin'],
                                                ['{{tglMulaiTerbilang}}', 'Tanggal Mulai Terbilang', 'enam'],
                                                ['{{bulanMulai}}', 'Bulan Mulai', 'April'],
                                                ['{{tahunMulaiTerbilang}}', 'Tahun Mulai Terbilang', 'Dua ribu dua puluh enam'],
                                                ['{{tanggalMulaiDash}}', 'Tgl Mulai (dash)', '06-04-2026'],
                                                ['TANGGAL SELESAI', '', ''],
                                                ['{{tanggalSelesai}}', 'Tanggal Selesai (format)', '06 Juli 2026'],
                                                ['{{hariTanggalSelesai}}', 'Hari, Tanggal Selesai', 'Senin, 06 Juli 2026'],
                                                ['{{terbilangTanggalSelesai}}', 'Terbilang Tgl Selesai', 'senin tanggal enam bulan Juli...'],
                                                ['{{hariSelesai}}', 'Hari Selesai', 'Senin'],
                                                ['{{tglSelesaiTerbilang}}', 'Tanggal Selesai Terbilang', 'enam'],
                                                ['{{bulanSelesai}}', 'Bulan Selesai', 'Juli'],
                                                ['{{tahunSelesaiTerbilang}}', 'Tahun Selesai Terbilang', 'Dua ribu dua puluh enam'],
                                                ['{{tanggalSelesaiDash}}', 'Tgl Selesai (dash)', '06-07-2026'],
                                                ['PCM', '', ''],
                                                ['{{noPcm}}', 'No PCM', ''],
                                                ['{{tglPcm}}', 'Tanggal PCM', ''],
                                                ['{{hariTanggalPcm}}', 'Hari, Tanggal PCM', ''],
                                                ['MC-0%', '', ''],
                                                ['{{noMc0}}', 'No MC-0%', ''],
                                                ['{{tglMc0}}', 'Tanggal MC-0%', ''],
                                                ['{{hariTanggalMc0}}', 'Hari, Tanggal MC-0%', ''],
                                                ['MC-100%', '', ''],
                                                ['{{noMc100}}', 'No MC-100%', ''],
                                                ['{{tglMc100}}', 'Tanggal MC-100%', ''],
                                                ['{{hariTanggalMc100}}', 'Hari, Tanggal MC-100%', ''],
                                                ['PEJABAT', '', ''],
                                                ['{{ppkom}}', 'Nama PPKom', 'SUNGEB, S.Sos,. M.M.'],
                                                ['{{nipPpkom}}', 'NIP PPKom', '19780908 199703 1 001'],
                                                ['{{jabatanPpkom}}', 'Jabatan PPKom', 'Pejabat Pembuat Komitmen...'],
                                                ['{{alamatPpkom}}', 'Alamat PPKom', 'Jl. Kalimantan No.51 Cilacap'],
                                                ['{{ketuaTimTeknis}}', 'Ketua Tim Teknis', 'M. TAKHMILUDDIN, ST.MT'],
                                                ['{{nipKetuaTimTeknis}}', 'NIP Ketua Tim Teknis', '19840525 200903 1 005'],
                                                ['{{sekretaris}}', 'Nama Sekretaris', ''],
                                                ['{{nipSekretaris}}', 'NIP Sekretaris', ''],
                                                ['LAINNYA', '', ''],
                                                ['{{konsultanPengawas}}', 'Konsultan Pengawas', ''],
                                                ['{{dirKonsultanPengawas}}', 'Dir. Konsultan Pengawas', ''],
                                                ['{{kepsek}}', 'Nama Kepala Sekolah', ''],
                                                ['{{nipKs}}', 'NIP Kepala Sekolah', ''],
                                                ['{{tahunTerbilang}}', 'Tahun Terbilang', 'Dua ribu dua puluh enam'],
                                                ['{{noBAST}}', 'No BAST (auto)', '400.3.13/065.n/A3/2026'],
                                            ].map((row, i) => (
                                                row[1] === '' && row[2] === '' ? (
                                                    <tr key={i}><td colSpan={3} style={{ padding: '6px 10px', background: 'rgba(59,130,246,0.1)', fontWeight: 700, color: 'var(--accent-blue)', border: '1px solid var(--border)' }}>{row[0]}</td></tr>
                                                ) : (
                                                    <tr key={i}>
                                                        <td style={{ padding: '4px 10px', border: '1px solid var(--border)', fontFamily: 'monospace', color: '#60a5fa', whiteSpace: 'nowrap' }}>{row[0]}</td>
                                                        <td style={{ padding: '4px 10px', border: '1px solid var(--border)' }}>{row[1]}</td>
                                                        <td style={{ padding: '4px 10px', border: '1px solid var(--border)', fontStyle: 'italic', opacity: 0.7 }}>{row[2]}</td>
                                                    </tr>
                                                )
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </details>
                        </div>
                        {/* INFORMASI PAKET PEKERJAAN */}
                        <div style={sectionHeader}>📋 INFORMASI PAKET PEKERJAAN</div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>KODE SIRUP</div><div style={infoVal}>{d.kodeSirup || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>NAMA PAKET</div><div style={infoVal}>{d.namaPaket || '-'}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>TANGGAL PEMBUATAN</div><div style={infoVal}>{formatDate(d.createdAt)}</div></div>
                            <div style={infoCard}><div style={infoLabel}>KLPD</div><div style={infoVal}>{d.klpd || 'Pemerintah Daerah Kabupaten Cilacap'}</div></div>
                        </div>
                        <div style={grid1}>
                            <div style={infoCard}><div style={infoLabel}>SATUAN KERJA</div><div style={infoVal}>{d.satuanKerja || 'DINAS PENDIDIKAN DAN KEBUDAYAAN KABUPATEN CILACAP'}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>JENIS PENGADAAN</div><div style={infoVal}>{d.jenisPengadaan || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>METODE PENGADAAN</div><div style={infoVal}>{d.metodePengadaan || '-'}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>TAHUN ANGGARAN</div><div style={infoVal}>{m.tahunAnggaran || new Date().getFullYear()}</div></div>
                            <div style={infoCard}><div style={infoLabel}>NILAI PAGU PAKET</div><div style={infoVal}>{formatCurrency(m.paguPaket || m.paguAnggaran)}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>NILAI PAGU ANGGARAN</div><div style={infoVal}>{formatCurrency(m.paguAnggaran)}</div></div>
                            <div style={infoCard}><div style={infoLabel}>NILAI HPS</div><div style={infoVal}>{formatCurrency(m.hps)}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>JENIS KONTRAK</div><div style={infoVal}>{d.jenisPengadaan || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>SUB KEGIATAN</div><div style={infoVal}>{m.subKegiatan || '-'}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>NOMOR KONTRAK</div><div style={infoVal}>{d.noSpk || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>NILAI KONTRAK</div><div style={infoVal}>{formatCurrency(d.nilaiKontrak)}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>TANGGAL KONTRAK</div><div style={infoVal}>{formatDate(d.tanggalMulai)}</div></div>
                            <div style={infoCard}><div style={infoLabel}>WAKTU PELAKSANAAN KONTRAK</div><div style={infoVal}>{d.waktuPenyelesaian ? `${d.waktuPenyelesaian} Hari Kalender` : '-'}</div></div>
                        </div>

                        {/* INFORMASI PENYEDIA */}
                        <div style={{ ...sectionHeader, marginTop: 24 }}>🏢 INFORMASI PENYEDIA</div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>NAMA PENYEDIA</div><div style={infoVal}>{p.namaPerusahaan || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>DIREKTUR</div><div style={infoVal}>{p.namaPemilik || '-'}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>ALAMAT PENYEDIA</div><div style={infoVal}>{p.alamatPerusahaan || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>NO. TELP</div><div style={infoVal}>{p.noTelp || '-'}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>EMAIL</div><div style={infoVal}>{p.emailPerusahaan || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>BANK</div><div style={infoVal}>{p.bank || '-'}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>NOTARIS</div><div style={infoVal}>{p.noAkta ? `Nomor ${p.noAkta}, Tanggal ${formatDate(p.tanggalAkta)}` : '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>NAMA NOTARIS</div><div style={infoVal}>{p.namaNotaris || '-'}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>NOMOR DPPL</div><div style={infoVal}>{d.noDppl || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>TANGGAL DPPL</div><div style={infoVal}>{formatDate(d.tanggalDppl)}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>NOMOR BAHPL</div><div style={infoVal}>{d.noBahpl || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>TANGGAL BAHPL</div><div style={infoVal}>{formatDate(d.tanggalBahpl)}</div></div>
                        </div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>NOMOR SPMK</div><div style={infoVal}>{d.noSp || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>TANGGAL SPMK</div><div style={infoVal}>{formatDate(d.tanggalSp)}</div></div>
                        </div>

                        {/* INFORMASI VERIFIKATOR */}
                        <div style={{ ...sectionHeader, marginTop: 24 }}>👤 INFORMASI VERIFIKATOR</div>
                        <div style={grid2}>
                            <div style={infoCard}><div style={infoLabel}>NAMA</div><div style={infoVal}>{d.verifikatorName || '-'}</div></div>
                            <div style={infoCard}><div style={infoLabel}>TANGGAL VERIFIKASI</div><div style={infoVal}>{formatDate(d.updatedAt)}</div></div>
                        </div>
                    </div>
                );
            })() : (<>

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
                                            {p.status === 'Menunggu' ? (
                                                <button onClick={() => handleDetail(p.id)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Detail</button>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleView(p.id)} title="Lihat Detail" style={{ padding: '6px 8px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Eye size={15} /></button>
                                                    <button onClick={() => handleDetail(p.id)} title="Edit Data" style={{ padding: '6px 8px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit2 size={15} /></button>
                                                </>
                                            )}
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
                const tabDone = tabSaved;
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
                                        <div style={cs}><div style={cl}>Nomor DPPL</div><input style={{ ...fieldStyle, marginTop: 4 }} value={editDppl.noDppl} onChange={e => setEditDppl(p => ({ ...p, noDppl: e.target.value }))} placeholder="Nomor DPPL" /></div>
                                        <div style={cs}><div style={cl}>Tanggal DPPL</div><input type="date" style={{ ...fieldStyle, marginTop: 4 }} value={editDppl.tanggalDppl} onChange={e => setEditDppl(p => ({ ...p, tanggalDppl: e.target.value }))} /></div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div style={cs}><div style={cl}>Nomor BAHPL</div><input style={{ ...fieldStyle, marginTop: 4 }} value={editDppl.noBahpl} onChange={e => setEditDppl(p => ({ ...p, noBahpl: e.target.value }))} placeholder="Nomor BAHPL" /></div>
                                        <div style={cs}><div style={cl}>Tanggal BAHPL</div><input type="date" style={{ ...fieldStyle, marginTop: 4 }} value={editDppl.tanggalBahpl} onChange={e => setEditDppl(p => ({ ...p, tanggalBahpl: e.target.value }))} /></div>
                                    </div>
                                    <button onClick={handleSaveDppl} disabled={saving} style={{ padding: '10px 24px', border: 'none', borderRadius: 8, background: 'var(--accent-blue)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan DPPL / BAHPL'}</button>
                                    {detail.berkasPenawaranPath && (
                                        <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Berkas Penawaran</div>
                                            <a href={detail.berkasPenawaranPath} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: '0.875rem' }}>📄 Lihat Dokumen PDF</a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SPK */}
                            {tab === 'spk' && (() => {
                                const rl = { fontSize: '0.78rem', fontWeight: 600, color: '#ef4444', marginBottom: 4 };
                                const totalNilai = nilaiItems.reduce((s, it) => s + (Number(parseSeparator(it.nilai)) || 0), 0);
                                const hpsValue = detail.matrik?.hps || 0;
                                const exceedsHps = hpsValue > 0 && totalNilai > hpsValue;
                                // Sync totalNilai to spkData
                                if (nilaiItems.length > 0 && String(totalNilai) !== String(spkData.nilaiKontrak)) {
                                    setTimeout(() => setSpkData(prev => ({ ...prev, nilaiKontrak: String(totalNilai), terbilangKontrak: numberToTerbilang(totalNilai) })), 0);
                                }
                                return (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: '0.9rem' }}>Surat Perintah Kerja</div>

                                    <h4 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>ℹ️ Data Surat Perintah Kerja</h4>
                                    <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Jenis Kontrak</div><div style={cv}>{detail.jenisPengadaan || '-'}</div></div>
                                    <div style={{ ...cs, marginBottom: 12 }}><div style={rl}>Nomor SPK</div><input style={fieldStyle} value={spkData.noSpk} onChange={e => setSpkData({ ...spkData, noSpk: e.target.value })} placeholder="400.3.13/400/A3/2026" /></div>

                                    {/* Nilai Kontrak with anakan items */}
                                    <div style={{ ...cs, marginBottom: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={rl}>Nilai Kontrak</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input style={{ ...fieldStyle, flex: 1 }} value={nilaiItems.length > 1 ? `Rp. ${formatSeparator(totalNilai)}` : (spkData.nilaiKontrak ? `Rp. ${formatSeparator(spkData.nilaiKontrak)}` : '')} onChange={e => { if (nilaiItems.length <= 1) { const raw = parseSeparator(e.target.value.replace(/^Rp\.?\s?/, '')); const tb = numberToTerbilang(raw); setSpkData({ ...spkData, nilaiKontrak: raw, terbilangKontrak: tb }); if (nilaiItems.length === 1) setNilaiItems([{ ...nilaiItems[0], nilai: raw }]); } }} readOnly={nilaiItems.length > 1} />
                                            <button onClick={() => setNilaiItems(prev => [...prev, { nama: '', nilai: '' }])} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--accent-blue)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={18} /></button>
                                        </div>
                                        {/* Anakan rows */}
                                        {nilaiItems.length > 1 && nilaiItems.map((item, idx) => (
                                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 8 }}>
                                                <input style={fieldStyle} value={item.nama} onChange={e => { const items = [...nilaiItems]; items[idx].nama = e.target.value; setNilaiItems(items); }} placeholder="Nama paket anakan" />
                                                <input style={fieldStyle} value={item.nilai ? `Rp. ${formatSeparator(item.nilai)}` : ''} onChange={e => { const raw = parseSeparator(e.target.value.replace(/^Rp\.?\s?/, '')); const items = [...nilaiItems]; items[idx].nilai = raw; setNilaiItems(items); }} placeholder="Rp. 0" />
                                                <button onClick={() => setNilaiItems(prev => prev.filter((_, i) => i !== idx))} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Minus size={18} /></button>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ ...cs, marginBottom: 12 }}>
                                        <div style={rl}>Terbilang Nilai Kontrak</div>
                                        {exceedsHps
                                            ? <div style={{ fontSize: '0.88rem', color: '#ef4444', fontWeight: 600 }}>Nilai kontrak melebihi nilai HPS: {formatSeparator(hpsValue)}</div>
                                            : <div style={cv}>{nilaiItems.length > 1 ? numberToTerbilang(totalNilai) : (spkData.terbilangKontrak || '-')}</div>}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div style={cs}><div style={rl}>Tanggal Awal</div><input type="date" style={fieldStyle} value={spkData.tanggalMulai} onChange={e => { const tgl = e.target.value; const selesai = calcTanggalSelesai(tgl, spkData.waktuPenyelesaian); setSpkData({ ...spkData, tanggalMulai: tgl, tanggalSelesai: selesai }); }} /></div>
                                        <div style={cs}><div style={rl}>Tanggal Akhir</div><input type="date" style={fieldStyle} value={spkData.tanggalSelesai} onChange={e => setSpkData({ ...spkData, tanggalSelesai: e.target.value })} /></div>
                                    </div>
                                    <div style={{ ...cs, marginBottom: 24 }}><div style={rl}>Waktu Penyelesaian</div><input style={fieldStyle} value={spkData.waktuPenyelesaian} onChange={e => { const hari = e.target.value; const selesai = calcTanggalSelesai(spkData.tanggalMulai, hari); setSpkData({ ...spkData, waktuPenyelesaian: hari, tanggalSelesai: selesai }); }} placeholder="90 hari kalender" /></div>

                                    <h4 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>ℹ️ Sistem Pembayaran</h4>
                                    <div style={{ ...cs, marginBottom: 12 }}><div style={rl}>Tata Cara Pembayaran</div><input style={fieldStyle} value={spkData.tataCaraPembayaran} onChange={e => setSpkData({ ...spkData, tataCaraPembayaran: e.target.value })} placeholder="Termin / Bulanan" /></div>
                                    <div style={{ ...cs, marginBottom: 24 }}><div style={rl}>Uang Muka</div>
                                        <select style={fieldStyle} value={spkData.uangMuka} onChange={e => setSpkData({ ...spkData, uangMuka: e.target.value })}>
                                            <option value="">Pilih Uang Muka</option>
                                            <option value="Ada Uang Muka">Ada Uang Muka</option>
                                            <option value="Tidak Ada Uang Muka">Tidak Ada Uang Muka</option>
                                        </select>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 600, fontSize: '0.92rem' }}><CheckCircle size={18} style={{ color: 'var(--accent-blue)' }} /> Validasi Kebenaran Data</div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16, paddingLeft: 4 }}>
                                        <input type="checkbox" checked={spkAgreed} onChange={e => setSpkAgreed(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                                        Data - data diatas sudah sesuai dengan ketentuan dan kebutuhan.
                                    </label>

                                    <button onClick={() => { if (spkAgreed) handleSaveSpk(); }} disabled={!spkAgreed || saving}
                                        style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 10, background: spkAgreed ? '#22c55e' : 'rgba(128,128,128,0.3)', color: '#fff', cursor: spkAgreed ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <CheckCircle size={18} /> {saving ? 'Menyimpan...' : '✓ Simpan Data Surat Perintah Kerja'}
                                    </button>
                                </div>
                                );
                            })()}

                            {/* LAMPIRAN */}
                            {tab === 'lampiran' && (() => {
                                const timData = (() => { try { return JSON.parse(detail.timPenugasan || '[]'); } catch { return []; } })();
                                const peralatanData = (() => { try { return JSON.parse(detail.peralatanUtama || '[]'); } catch { return []; } })();
                                return (
                                <div>
                                    <div style={{ background: 'var(--accent-blue)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: '0.9rem' }}>Lampiran</div>

                                    {/* Komposisi Tim */}
                                    <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>👥 KOMPOSISI TIM DAN PENUGASAN</h4>
                                    <div style={{ overflowX: 'auto', marginBottom: 24, maxWidth: '100%' }}>
                                        <table className="data-table" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                            <thead>
                                                <tr>
                                                    <th>Nama</th><th>Posisi</th><th>Status Tenaga</th><th>Pendidikan</th>
                                                    <th>Pengalaman (tahun)</th><th>Sertifikasi</th><th>Keterangan</th>
                                                    <th colSpan={12} style={{ textAlign: 'center' }}>Jadwal Pelaksanaan Kegiatan (Bulan)</th>
                                                </tr>
                                                <tr>
                                                    <th colSpan={7}></th>
                                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <th key={m} style={{ textAlign: 'center', padding: '2px 4px' }}>{m}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {timData.length > 0 ? timData.map((row, i) => (
                                                    <tr key={i}>
                                                        <td>{row.nama}</td><td>{row.posisi}</td><td>{row.statusTenaga}</td><td>{row.pendidikan}</td>
                                                        <td>{row.pengalaman}</td><td>{row.sertifikasi}</td><td>{row.keterangan}</td>
                                                        {(row.jadwal || Array(12).fill(false)).map((c, j) => <td key={j} style={{ textAlign: 'center' }}>{c ? '■' : '□'}</td>)}
                                                    </tr>
                                                )) : <tr><td colSpan={19} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Belum ada data tim</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Peralatan Utama */}
                                    <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>🔧 PERALATAN UTAMA (Apabila dipersyaratkan)</h4>
                                    <div style={{ overflowX: 'auto', marginBottom: 24, maxWidth: '100%' }}>
                                        <table className="data-table" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                            <thead><tr><th>Nama Peralatan</th><th>Merk</th><th>Type</th><th>Kapasitas</th><th>Jumlah</th><th>Kondisi</th><th>Status Kepemilikan</th><th>Keterangan</th></tr></thead>
                                            <tbody>
                                                {peralatanData.length > 0 ? peralatanData.map((row, i) => (
                                                    <tr key={i}>
                                                        <td>{row.nama}</td><td>{row.merk}</td><td>{row.type}</td><td>{row.kapasitas}</td>
                                                        <td>{row.jumlah}</td><td>{row.kondisi}</td><td>{row.statusKepemilikan}</td><td>{row.keterangan}</td>
                                                    </tr>
                                                )) : <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Belum ada data peralatan</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>

                                    {detail.berkasPenawaranPath && (
                                        <div style={{ ...cs, marginBottom: 12 }}><div style={cl}>Berkas Penawaran</div>
                                            <a href={detail.berkasPenawaranPath} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: '0.875rem' }}>📄 Lihat Dokumen PDF</a>
                                        </div>
                                    )}
                                </div>
                                );
                            })()}

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
            </>)}
        </div>
    );
};

export default ManajemenKontrak;
