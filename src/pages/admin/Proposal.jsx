import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search, Download, Eye, Edit, Trash2, X, Filter, Star, FileSpreadsheet, FileText, Save, Printer, FileCheck, FilePlus, Archive, AlertOctagon, Upload, CheckCircle, RotateCcw, MoreHorizontal, Columns } from 'lucide-react';
import { useProposalData, useSekolahData, useUsersData, useKorwilData } from '../../data/dataProvider';
import { proposalApi, arsipDokumenApi } from '../../api/index';
import { KECAMATAN, JENJANG, SUB_KEGIATAN, KERANJANG, STATUS_PROPOSAL } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import { exportToExcel, exportToCSV, exportToPDF, exportToExcelMultiSheet } from '../../utils/exportUtils';
import * as XLSX from 'xlsx';
import SearchableSelect from '../../components/ui/SearchableSelect';
import useAuthStore from '../../store/authStore';
import useCountdownGuard from '../../hooks/useCountdownGuard';
import toast from 'react-hot-toast';
import { safeStr } from '../../utils/safeStr';

const INITIAL_FORM_DATA = {
    subKegiatan: SUB_KEGIATAN[0]?.nama || '',
    nilaiPengajuan: '',
    target: '',
    keterangan: '',
    status: 'Menunggu Verifikasi',
    keranjang: '',
    noAgendaSurat: '',
    tanggalSurat: ''
};

const INITIAL_CHECKLIST_ITEMS = [
    { id: 1, indikator: 'Ijin Operasional dan Pendirian dari Instansi', status: '-', keterangan: '' },
    { id: 2, indikator: 'Akta Notaris (berisi AD / ART, Tujuan, Program Kerja Lembaga, dll)', status: '-', keterangan: '' },
    { id: 3, indikator: 'SK Menkumham (bila ada)', status: '-', keterangan: '' },
    { id: 4, indikator: 'NPSN', status: '-', keterangan: '' },
    { id: 5, indikator: 'Profil Sekolah (data lembaga, data pendidik, data siswa, data sarpras, denah sekolah)', status: '-', keterangan: '' },
    { id: 6, indikator: 'Foto Papan Lembaga, Foto Kegiatan KBM, dan foto lahan bagi usulan pembangunan/foto ruang yang rusak bagi usulan rehabilitasi (GPS map Camera)', status: '-', keterangan: '' },
    { id: 7, indikator: 'Surat Keterangan Domisili badan atau lembaga dari kepala desa / lurah yang diketahui Camat', status: '-', keterangan: '' },
    { id: 8, indikator: 'Surat Pernyataan Tidak terjadi konflik kepengurusan yang ditandatangani ketua yayasan', status: '-', keterangan: '' },
    { id: 9, indikator: 'Surat Keterangan / pernyataan penggunaan Tanah (milik yayasan, tanah wakaf disampiri surat tidak keberatan dari ahli waris lain, hak guna pakai / milik desa)', status: '-', keterangan: '' },
    { id: 10, indikator: 'Pernah mendapat bantuan Hibah tahun berapa / berupa apa?', status: '-', keterangan: '' },
    { id: 11, indikator: 'Rencana Anggaran Biaya (RAB)', status: '-', keterangan: '' },
    { id: 12, indikator: 'Nomor Pokok Wajib Pajak (NPWP)', status: '-', keterangan: '' },
    { id: 13, indikator: 'Rekening atas nama sekolah yang masih aktif (bukan rek BOP)', status: '-', keterangan: '' },
    { id: 14, indikator: 'Denah Sekolah', status: '-', keterangan: '' },
];

const INITIAL_REKOMENDASI = {
    namaSekolah: '', kecamatan: '', jenjang: '', subKegiatan: '', perihal: '',
    nilai: '', target: '', noAgenda: '', suratMasuk: '', tanggalSurat: '', nomorSurat: '', kondisi: '', sumber: ''
};

const Proposal = ({ readOnly = false }) => {
    const user = useAuthStore(s => s.user);
    const { guard, isRestricted } = useCountdownGuard();
    const isAdmin = user?.role === 'Admin';
    const isAdminOrVerifikator = user?.role === 'Admin' || user?.role === 'Verifikator';
    const isKorwil = (user?.role || '').toLowerCase() === 'korwil';
    const canManageKeranjang = user?.role === 'Admin' || user?.role === 'Verifikator';
    const canVerify = user?.role === 'Admin' || user?.role === 'Verifikator' || isKorwil;
    const isSekolahOrKorwil = user?.role === 'Sekolah' || isKorwil;
    const isSekolah = user?.role === 'Sekolah';

    const { data: sekolahList } = useSekolahData();
    const { data: usersList } = useUsersData();
    const { data: proposalList, loading: proposalLoading, refetch: refetchProposal } = useProposalData();
    const { data: korwilList } = useKorwilData();

    // Get korwil assignment (kecamatan + jenjang)
    const myKorwilAssignment = useMemo(() => {
        if (!isKorwil || !korwilList || !user) return null;
        const myRows = korwilList.filter(row => {
            const ka = row.korwilAssignment || row;
            return String(ka.userId) === String(user.id);
        });
        if (myRows.length === 0) return null;
        const kecList = [];
        let jenj = '';
        myRows.forEach(row => {
            const ka = row.korwilAssignment || row;
            if (ka.kecamatan && !kecList.includes(ka.kecamatan)) kecList.push(ka.kecamatan);
            if (ka.jenjang) jenj = ka.jenjang;
        });
        return { kecamatan: kecList, jenjang: jenj };
    }, [isKorwil, korwilList, user]);

    const [data, setData] = useState([]);

    useEffect(() => {
        if (proposalList.length) {
            let list = proposalList.map(d => ({ ...d, bintang: d.bintang || 0 }));
            // For korwil: filter by assigned kecamatan + jenjang
            if (isKorwil && myKorwilAssignment) {
                list = list.filter(p =>
                    myKorwilAssignment.kecamatan.includes(p.kecamatan) &&
                    p.jenjang === myKorwilAssignment.jenjang
                );
            }
            setData(list);
        }
    }, [proposalList, isKorwil, myKorwilAssignment]);

    // State untuk Rekomendasi & Checklist
    const [rekomendasiList, setRekomendasiList] = useState([]);
    const [checklistList, setChecklistList] = useState([]);
    const [showDaftarModal, setShowDaftarModal] = useState(false);
    const [daftarTab, setDaftarTab] = useState('rekomendasi');

    // Load arsip dokumen from API on mount
    useEffect(() => {
        arsipDokumenApi.listRekomendasi().then(res => {
            if (Array.isArray(res)) setRekomendasiList(res);
            else if (res?.data && Array.isArray(res.data)) setRekomendasiList(res.data);
        }).catch(() => {});
        arsipDokumenApi.listChecklist().then(res => {
            if (Array.isArray(res)) setChecklistList(res);
            else if (res?.data && Array.isArray(res.data)) setChecklistList(res.data);
        }).catch(() => {});
    }, []);

    const [search, setSearch] = useState('');
    const [headerFilters, setHeaderFilters] = useState({ kecamatan: '', jenjang: '', keranjang: '', bintang: '' });
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const filterPanelRef = useRef(null);

    // Modals
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [viewItem, setViewItem] = useState(null);

    // State untuk Konfirmasi Hapus
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Checklist & Rekomendasi State
    const [showChecklist, setShowChecklist] = useState(false);
    const [checklistForm, setChecklistForm] = useState({
        sekolah: null, alamat: '', jenisUsulan: '', items: INITIAL_CHECKLIST_ITEMS, verifikators: []
    });
    const [showRekomendasi, setShowRekomendasi] = useState(false);
    const [rekomendasiForm, setRekomendasiForm] = useState(INITIAL_REKOMENDASI);

    // Form State
    const [formSekolah, setFormSekolah] = useState('');
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);

    // Auto-select school for sekolah role
    useEffect(() => {
        if (isSekolah && sekolahList?.length >= 1 && !formSekolah) {
            setFormSekolah(sekolahList[0].nama);
        }
    }, [isSekolah, sekolahList, formSekolah]);

    // Effects
    const actionDropdownRef = React.useRef(null);
    useEffect(() => {
        const handler = (e) => {
            if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) setShowFilterPanel(false);
            if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false);
            // Close action dropdown only if click is outside the dropdown and outside the trigger button
            if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target) && !e.target.closest('.btn-icon')) {
                setOpenActionId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Pagination State
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    // Batch import state
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchData, setBatchData] = useState([]);
    const [batchImporting, setBatchImporting] = useState(false);
    const [realisasiModal, setRealisasiModal] = useState(null);
    const [proposalTab, setProposalTab] = useState('aktif'); // 'aktif' | 'realisasi'
    const [realisasiPage, setRealisasiPage] = useState(1);
    const [realisasiPerPage, setRealisasiPerPage] = useState(10);
    const [hiddenCols, setHiddenCols] = useState(['npsn', 'prioritas']);
    const [showColMenu, setShowColMenu] = useState(false);
    const [openActionId, setOpenActionId] = useState(null);
    const [actionPos, setActionPos] = useState({ top: 0, left: 0 });
    const colMenuRef = React.useRef(null);
    const toggleCol = (col) => setHiddenCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
    const handleActionClick = (e, id) => {
        if (openActionId === id) { setOpenActionId(null); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const dropdownHeight = 220; // estimated max height
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4;
        setActionPos({ top, left: rect.right - 170 });
        setOpenActionId(id);
    };

    // ===== FILTERING =====
    const filtered = useMemo(() => {
        return data.filter(p => {
            if (isKorwil && p.jenjang !== 'SD') return false;
            if (search) {
                const q = search.toLowerCase();
                if (!p.namaSekolah.toLowerCase().includes(q) && !p.npsn.includes(q)) return false;
            }
            if (headerFilters.kecamatan && p.kecamatan !== headerFilters.kecamatan) return false;
            if (headerFilters.jenjang && p.jenjang !== headerFilters.jenjang) return false;
            if ((canManageKeranjang || isKorwil) && headerFilters.keranjang && p.keranjang !== headerFilters.keranjang) return false;
            if (headerFilters.bintang === 'Ya' && p.bintang !== 1) return false;
            return true;
        });
    }, [data, search, headerFilters, canManageKeranjang, isKorwil]);

    // Split into aktif vs terealisasi (any non-null statusUsulan = terealisasi)
    const filteredAktif = useMemo(() => filtered.filter(p => !p.statusUsulan), [filtered]);
    const filteredRealisasi = useMemo(() => filtered.filter(p => !!p.statusUsulan), [filtered]);

    // Summary stats (count ALL proposals)
    const stats = useMemo(() => {
        const src = filtered;
        const uniqueSchools = new Set(src.map(p => p.npsn)).size;
        const totalPengajuan = src.reduce((sum, p) => sum + (Number(p.nilaiPengajuan) || 0), 0);
        const aktifCount = filteredAktif.length;
        const realisasiCount = filteredRealisasi.length;
        const totalAktif = filteredAktif.reduce((sum, p) => sum + (Number(p.nilaiPengajuan) || 0), 0);
        const totalRealisasi = filteredRealisasi.reduce((sum, p) => sum + (Number(p.nilaiPengajuan) || 0), 0);
        return { jumlahProposal: src.length, jumlahSekolah: uniqueSchools, totalPengajuan, aktifCount, realisasiCount, totalAktif, totalRealisasi };
    }, [filtered, filteredAktif, filteredRealisasi]);

    const paged = useMemo(() => {
        return filteredAktif.slice((page - 1) * perPage, page * perPage);
    }, [filteredAktif, page, perPage]);

    const totalPages = Math.ceil(filteredAktif.length / perPage) || 1;

    // ===== HANDLERS =====
    const resetForm = () => { setFormSekolah(''); setFormData(INITIAL_FORM_DATA); setEditItem(null); };

    const handleOpenModal = (item = null) => {
        if (item) {
            if (!guard('edit')) return;
            setEditItem(item); setFormSekolah(item.namaSekolah || '');
            setFormData({ ...INITIAL_FORM_DATA, ...item, nilaiPengajuan: item.nilaiPengajuan || '' });
        } else {
            if (!guard('tambah')) return;
            resetForm();
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        const rawValue = String(formData.nilaiPengajuan).replace(/\./g, '');
        if (!formData.subKegiatan) { toast.error('Sub Kegiatan wajib diisi'); return; }
        if (!rawValue || parseFloat(rawValue) <= 0) { toast.error('Nilai pengajuan harus lebih dari 0'); return; }
        if (!formData.target?.trim()) { toast.error('Target wajib diisi'); return; }
        if (!formData.keterangan?.trim()) { toast.error('Keterangan wajib diisi'); return; }
        if (!editItem && !formData.proposalFile) { toast.error('Upload Proposal (PDF) wajib diisi'); return; }
        setSaving(true);
        const pdfFile = formData.proposalFile;
        const payload = { ...formData, nilaiPengajuan: parseFloat(rawValue) };
        // Convert empty date strings to null to avoid PostgreSQL error
        if (!payload.tanggalSurat) payload.tanggalSurat = null;
        // Remove file from JSON payload (uploaded separately)
        delete payload.proposalFile;
        try {
            let proposalId;
            if (editItem) {
                // When Sekolah edits a rejected/revised proposal, reset status to re-enter verification queue
                if (isSekolah && (editItem.status === 'Ditolak' || editItem.status === 'Revisi')) {
                    payload.status = 'Menunggu Verifikasi';
                    payload.keranjang = 'Keranjang Usulan Sekolah';
                }
                await proposalApi.update(editItem.id, payload);
                proposalId = editItem.id;
                toast.success('Proposal berhasil diperbarui');
            } else {
                const sekolah = sekolahList.find(s => s.nama === formSekolah);
                if (!sekolah) { toast.error('Pilih sekolah terlebih dahulu'); return; }
                const result = await proposalApi.create({ ...payload, sekolahId: sekolah.id });
                proposalId = result?.id;
                toast.success('Proposal berhasil ditambahkan');
            }
            // Upload PDF file if selected
            if (pdfFile && proposalId) {
                const fd = new FormData();
                fd.append('file', pdfFile);
                await proposalApi.uploadPdf(proposalId, fd);
                toast.success('PDF berhasil diupload (sinkronisasi GDrive sedang berjalan)');
            }
            await refetchProposal();
            setShowModal(false); resetForm();
        } catch (err) {
            toast.error(err?.message || 'Gagal menyimpan proposal');
        } finally {
            setSaving(false);
        }
    };

    // ===== UPDATED DELETE HANDLER =====
    const performDelete = async () => {
        try {
            await proposalApi.delete(deleteConfirm.id);
            toast.success('Proposal berhasil dihapus');
            setDeleteConfirm(null);
            await refetchProposal();
        } catch (err) {
            toast.error(err?.message || 'Gagal menghapus proposal');
        }
    };

    const handleStar = (id) => {
        if (!isAdmin) return;
        setData(prev => prev.map(d => {
            if (d.id === id) return { ...d, bintang: d.bintang === 1 ? 0 : 1 };
            return d;
        }));
        // Also update viewItem if open
        if (viewItem && viewItem.id === id) {
            setViewItem(prev => ({ ...prev, bintang: prev.bintang === 1 ? 0 : 1 }));
        }
    };

    // Handlers Checklist & Rekomendasi
    const handleOpenChecklist = () => {
        // Auto-populate current user as verifikator if role is Verifikator or Korwil
        const autoVerifikators = (user?.role === 'Verifikator' || user?.role === 'Korwil')
            ? [{ id: Date.now(), userId: user.id, nama: user.name || '', nip: user.nip || '-' }]
            : [];
        setChecklistForm({
            sekolah: null, alamat: '', jenisUsulan: '',
            items: INITIAL_CHECKLIST_ITEMS.map(i => ({ ...i, id: Date.now() + Math.random() })),
            verifikators: autoVerifikators
        });
        setShowChecklist(true);
    };

    const handleChecklistSchoolChange = (nama) => {
        const sch = sekolahList.find(s => s.nama === nama);
        setChecklistForm(prev => ({ ...prev, sekolah: sch, alamat: sch?.alamat || '' }));
    };

    const handleSaveRekomendasi = async () => {
        if (!rekomendasiForm.namaSekolah) { toast.error('Nama sekolah wajib diisi'); return; }
        try {
            const saved = await arsipDokumenApi.createRekomendasi(rekomendasiForm);
            setRekomendasiList(prev => [saved, ...prev]);
            toast.success('Rekomendasi berhasil disimpan');
            setShowRekomendasi(false);
            setRekomendasiForm(INITIAL_REKOMENDASI);
        } catch (err) {
            toast.error(err?.message || 'Gagal menyimpan rekomendasi');
        }
    };

    const handleSaveChecklist = async () => {
        if (!checklistForm.sekolah) { toast.error('Sekolah wajib dipilih'); return; }
        try {
            const payload = {
                sekolahNama: checklistForm.sekolah.nama,
                sekolahAlamat: checklistForm.sekolah.alamat || checklistForm.alamat,
                jenisUsulan: checklistForm.jenisUsulan,
                items: checklistForm.items,
                verifikators: checklistForm.verifikators,
            };
            const saved = await arsipDokumenApi.createChecklist(payload);
            // Keep sekolah object for print
            saved._sekolah = checklistForm.sekolah;
            setChecklistList(prev => [saved, ...prev]);
            toast.success('Checklist berhasil disimpan');
            setShowChecklist(false);
        } catch (err) {
            toast.error(err?.message || 'Gagal menyimpan checklist');
        }
    };

    const handlePrintChecklist = () => {
        const sch = checklistForm.sekolah;
        const tahun = new Date().getFullYear();
        const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const now = new Date();
        const tanggal = `${now.getDate()} ${bulanIndo[now.getMonth()]} ${now.getFullYear()}`;
        const rows = checklistForm.items.map((item, i) =>
            `<tr><td style="text-align:center;padding:6px;border:1px solid #000">${i + 1}</td><td style="padding:6px;border:1px solid #000">${item.indikator}</td><td style="text-align:center;padding:6px;border:1px solid #000">${item.status === 'Ada' ? '✓' : ''}</td><td style="text-align:center;padding:6px;border:1px solid #000">${item.status === 'Tidak Ada' ? '✓' : ''}</td><td style="padding:6px;border:1px solid #000">${item.keterangan || ''}</td></tr>`
        ).join('');
        const verSection = checklistForm.verifikators.length > 0
            ? checklistForm.verifikators.map(v =>
                `<div style="text-align:left;margin-top:80px;min-width:300px"><div style="font-size:12pt">Cilacap, ${tanggal}</div><div style="font-size:12pt;margin-top:4px">Verifikator</div><div style="height:150px"></div><div style="text-decoration:underline;font-weight:bold;font-size:14pt">${v.nama || '...........................'}</div><div style="font-size:12pt;margin-top:4px">NIP. ${v.nip || '...........................'}</div></div>`
            ).join('')
            : `<div style="text-align:left;margin-top:80px;min-width:300px"><div style="font-size:12pt">Cilacap, ${tanggal}</div><div style="font-size:12pt;margin-top:4px">Verifikator</div><div style="height:150px"></div><div style="text-decoration:underline;font-weight:bold;font-size:14pt">.............................</div><div style="font-size:12pt;margin-top:4px">NIP. .............................</div></div>`;
        const html = `<!DOCTYPE html><html><head><title>Instrumen Verifikasi Proposal</title><style>@page{size:A4;margin:2cm}body{font-family:'Times New Roman',serif;font-size:12pt;color:#000}table{width:100%;border-collapse:collapse}th{padding:6px;border:1px solid #000;background:#f0f0f0;font-weight:bold}</style></head><body>
        <div style="text-align:center;margin-bottom:24px"><h3 style="margin:0">INSTRUMEN VERIFIKASI PROPOSAL</h3><h3 style="margin:4px 0">PENGAJUAN DANA HIBAH TAHUN ${tahun}</h3></div>
        <div style="margin-bottom:16px"><table style="border:none"><tr><td style="border:none;width:200px">1. Nama Lembaga / Sekolah</td><td style="border:none">: ${sch?.nama || '...........................'}</td></tr><tr><td style="border:none">2. Alamat</td><td style="border:none">: ${sch?.alamat || checklistForm.alamat || '...........................'}</td></tr><tr><td style="border:none">3. Jenis Usulan</td><td style="border:none">: ${checklistForm.jenisUsulan || '...........................'}</td></tr></table></div>
        <table><thead><tr><th rowspan="2" style="width:30px">NO</th><th rowspan="2">INDIATOR / URAIAN</th><th colspan="2">HASIL</th><th rowspan="2">KETERANGAN</th></tr><tr><th style="width:60px">ADA</th><th style="width:60px">TIDAK ADA</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="margin-top:24px"><p><b>Kesimpulan / Catatan :</b></p><p>1. ............................................................................................................</p><p>2. ............................................................................................................</p><p>dst.</p></div>
        <div style="display:flex;justify-content:flex-end;margin-top:20px">${verSection}</div>
        </body></html>`;
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
    };

    const handlePrintSavedChecklist = (item) => {
        const schName = item._sekolah?.nama || item.sekolahNama || '...........................';
        const tahun = new Date(item.createdAt).getFullYear();
        const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const dt = new Date(item.createdAt);
        const tanggal = `${dt.getDate()} ${bulanIndo[dt.getMonth()]} ${dt.getFullYear()}`;
        const rows = (item.items || []).map((it, i) =>
            `<tr><td style="text-align:center;padding:6px;border:1px solid #000">${i + 1}</td><td style="padding:6px;border:1px solid #000">${it.indikator}</td><td style="text-align:center;padding:6px;border:1px solid #000">${it.status === 'Ada' ? '✓' : ''}</td><td style="text-align:center;padding:6px;border:1px solid #000">${it.status === 'Tidak Ada' ? '✓' : ''}</td><td style="padding:6px;border:1px solid #000">${it.keterangan || ''}</td></tr>`
        ).join('');
        const verSection = (item.verifikators || []).length > 0
            ? item.verifikators.map(v =>
                `<div style="text-align:left;margin-top:80px;min-width:300px"><div style="font-size:12pt">Cilacap, ${tanggal}</div><div style="font-size:12pt;margin-top:4px">Verifikator</div><div style="height:150px"></div><div style="text-decoration:underline;font-weight:bold;font-size:14pt">${v.nama || '...........................'}</div><div style="font-size:12pt;margin-top:4px">NIP. ${v.nip || '...........................'}</div></div>`
            ).join('')
            : `<div style="text-align:left;margin-top:80px;min-width:300px"><div style="font-size:12pt">Cilacap, ${tanggal}</div><div style="font-size:12pt;margin-top:4px">Verifikator</div><div style="height:150px"></div><div style="text-decoration:underline;font-weight:bold;font-size:14pt">.............................</div><div style="font-size:12pt;margin-top:4px">NIP. .............................</div></div>`;
        const html = `<!DOCTYPE html><html><head><title>Instrumen Verifikasi Proposal</title><style>@page{size:A4;margin:2cm}body{font-family:'Times New Roman',serif;font-size:12pt;color:#000}table{width:100%;border-collapse:collapse}th{padding:6px;border:1px solid #000;background:#f0f0f0;font-weight:bold}</style></head><body>
        <div style="text-align:center;margin-bottom:24px"><h3 style="margin:0">INSTRUMEN VERIFIKASI PROPOSAL</h3><h3 style="margin:4px 0">PENGAJUAN DANA HIBAH TAHUN ${tahun}</h3></div>
        <div style="margin-bottom:16px"><table style="border:none"><tr><td style="border:none;width:200px">1. Nama Lembaga / Sekolah</td><td style="border:none">: ${schName}</td></tr><tr><td style="border:none">2. Alamat</td><td style="border:none">: ${item._sekolah?.alamat || item.sekolahAlamat || '...........................'}</td></tr><tr><td style="border:none">3. Jenis Usulan</td><td style="border:none">: ${item.jenisUsulan || '...........................'}</td></tr></table></div>
        <table><thead><tr><th rowspan="2" style="width:30px">NO</th><th rowspan="2">INDIATOR / URAIAN</th><th colspan="2">HASIL</th><th rowspan="2">KETERANGAN</th></tr><tr><th style="width:60px">ADA</th><th style="width:60px">TIDAK ADA</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="margin-top:24px"><p><b>Kesimpulan / Catatan :</b></p><p>1. ............................................................................................................</p><p>2. ............................................................................................................</p><p>dst.</p></div>
        <div style="display:flex;justify-content:flex-end;margin-top:20px">${verSection}</div>
        </body></html>`;
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
    };

    const handleOpenRekomendasi = () => { setRekomendasiForm(INITIAL_REKOMENDASI); setShowRekomendasi(true); };
    const handleRekomendasiSchoolChange = (nama) => {
        const sch = sekolahList.find(s => s.nama === nama);
        setRekomendasiForm(prev => ({ ...prev, namaSekolah: nama, kecamatan: sch?.kecamatan || '', jenjang: sch?.jenjang || '' }));
    };
    const handleRekomendasiChange = (field, value) => setRekomendasiForm(prev => ({ ...prev, [field]: value }));

    // ===== HELPERS =====
    const getStatusBadge = (status) => {
        const map = { 'Menunggu Verifikasi': 'badge-menunggu', 'Disetujui': 'badge-disetujui', 'Ditolak': 'badge-ditolak', 'Revisi': 'badge-revisi' };
        return <span className={`badge ${map[status] || ''}`}>{status}</span>;
    };

    const renderPriorityStar = (isStarred, itemId) => (
        <span className={`star ${isStarred ? 'filled' : ''}`}
            style={{ fontSize: 20, cursor: isAdmin ? 'pointer' : 'default', color: isStarred ? 'var(--accent-yellow)' : 'var(--border-color)', transition: 'color 150ms' }}
            onClick={() => handleStar(itemId)}>★</span>
    );

    const schoolNames = useMemo(() => sekolahList.map(s => s.nama), [sekolahList]);
    const renderSchoolOption = (name) => {
        const sch = sekolahList.find(s => s.nama === name);
        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span>{name}</span>
                {sch && <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{sch.npsn}</span>}
            </div>
        );
    };
    const selectedSchoolData = useMemo(() => sekolahList.find(s => s.nama === formSekolah), [formSekolah]);

    const handleExport = (format) => {
        const exportCols = [{ header: 'No', accessor: (_, i) => i + 1 }, { header: 'Nama Sekolah', key: 'namaSekolah' }, { header: 'NPSN', key: 'npsn' }, { header: 'Kecamatan', key: 'kecamatan' }, { header: 'Sub Kegiatan', key: 'subKegiatan' }, { header: 'Nilai Pengajuan', key: 'nilaiPengajuan' }, { header: 'Target', key: 'target' }, { header: 'Status', key: 'status' }, { header: 'Keranjang', key: 'keranjang' }, { header: 'Keterangan', key: 'keterangan' }];
        try {
            if (format === 'excel') {
                const sheets = [{ sheetName: 'Proposal Aktif', data: filteredAktif, columns: exportCols }];
                if (filteredRealisasi.length > 0) sheets.push({ sheetName: 'Terealisasi', data: filteredRealisasi, columns: exportCols });
                exportToExcelMultiSheet(sheets, 'data_proposal');
            } else if (format === 'csv') exportToCSV(filteredAktif, exportCols, 'data_proposal');
            else if (format === 'pdf') exportToPDF(filteredAktif, exportCols, 'data_proposal', 'Data Proposal');
            toast.success(`Berhasil ekspor ${format.toUpperCase()}`);
        } catch (err) { toast.error('Gagal ekspor'); }
    };

    const handleRealisasi = (item) => {
        setRealisasiModal({ item, namaBantuan: '' });
    };

    const confirmRealisasi = async () => {
        if (!realisasiModal) return;
        const { item, namaBantuan } = realisasiModal;
        if (!namaBantuan.trim()) { toast.error('Nama bantuan wajib diisi'); return; }
        try {
            await proposalApi.update(item.id, { statusUsulan: namaBantuan.trim() });
            setData(prev => prev.map(d => d.id === item.id ? { ...d, statusUsulan: namaBantuan.trim() } : d));
            toast.success('Proposal dipindahkan ke Terealisasi');
            setRealisasiModal(null);
        } catch (err) { toast.error('Gagal memindahkan proposal'); }
    };

    const handleUnrealisasi = async (item) => {
        try {
            await proposalApi.update(item.id, { statusUsulan: null });
            setData(prev => prev.map(d => d.id === item.id ? { ...d, statusUsulan: null } : d));
            toast.success('Proposal dikembalikan ke aktif');
        } catch (err) { toast.error('Gagal mengembalikan proposal'); }
    };

    // Batch import handlers
    const handleBatchFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });
            setBatchData(jsonData);
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const handleBatchImport = async () => {
        if (!batchData.length) return;
        setBatchImporting(true);
        try {
            const items = batchData.map(row => ({
                npsn: String(row['NPSN'] || row['npsn'] || '').trim(),
                subKegiatan: row['Sub Kegiatan'] || row['subKegiatan'] || '',
                nilaiPengajuan: Number(String(row['Nilai Pengajuan'] || row['nilaiPengajuan'] || '0').replace(/\./g, '')) || 0,
                target: row['Target'] || row['target'] || '',
                keterangan: row['Keterangan'] || row['keterangan'] || '',
            }));
            const result = await proposalApi.batchCreate({ items });
            toast.success(`${result.created}/${result.total} proposal berhasil diimport`);
            if (result.errors?.length) result.errors.slice(0, 5).forEach(e => toast.error(e));
            setShowBatchModal(false);
            setBatchData([]);
            refetchProposal();
        } catch (err) { toast.error(err?.message || 'Gagal import batch'); }
        finally { setBatchImporting(false); }
    };

    const downloadBatchTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['NPSN', 'Sub Kegiatan', 'Nilai Pengajuan', 'Target', 'Keterangan'],
            ['20301170', 'Pengadaan Mebel Sekolah SD', '50000000', '1 lokal', 'Mebel rusak berat'],
            ['20301171', 'Rehabilitasi Sedang/Berat Ruang Kelas Sekolah SD', '200000000', '2 ruang', 'Atap bocor'],
        ]);
        ws['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'template_batch_proposal.xlsx');
    };

    const activeFilterCount = Object.values(headerFilters).filter(v => v).length;

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left"><h1>Proposal</h1><p>Total {filteredAktif.length} proposal aktif{filteredRealisasi.length > 0 ? `, ${filteredRealisasi.length} terealisasi` : ''}</p></div>
                <div className="page-header-right" style={{ display: 'flex', gap: 8 }}>
                    {isAdminOrVerifikator && (<button className="btn btn-secondary" onClick={() => setShowBatchModal(true)}><Upload size={16} /> Import Batch</button>)}
                    {!readOnly && (<button className="btn btn-primary" onClick={() => handleOpenModal()} disabled={isRestricted('tambah')} style={isRestricted('tambah') ? { opacity: 0.5, cursor: 'not-allowed' } : {}}><Plus size={16} /> Tambah Proposal</button>)}
                </div>
            </div>

            {/* Summary Stat Cards */}
            {!isSekolah && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Jumlah Proposal</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{stats.jumlahProposal}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                            <span style={{ color: 'var(--accent-blue)' }}>{stats.aktifCount} aktif</span> · <span style={{ color: 'var(--accent-green)' }}>{stats.realisasiCount} terealisasi</span>
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Jumlah Sekolah Pengaju</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-blue)', marginTop: 4 }}>{stats.jumlahSekolah}</div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Total Aktif</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-blue)', marginTop: 4 }}>{formatCurrency(stats.totalAktif)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{stats.aktifCount} proposal</div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Total Realisasi</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#06b6d4', marginTop: 4 }}>{formatCurrency(stats.totalRealisasi)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{stats.realisasiCount} proposal</div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Total Pengajuan</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-green)', marginTop: 4 }}>{formatCurrency(stats.totalPengajuan)}</div>
                    </div>
                </div>
            )}

            {canManageKeranjang && (
                <div className="keranjang-tabs">
                    <button className={`keranjang-tab ${headerFilters.keranjang === '' ? 'active' : ''}`} onClick={() => { setHeaderFilters(prev => ({ ...prev, keranjang: '' })); setPage(1); }}>Semua</button>
                    {KERANJANG.map(k => (<button key={k} className={`keranjang-tab ${headerFilters.keranjang === k ? 'active' : ''}`} onClick={() => { setHeaderFilters(prev => ({ ...prev, keranjang: k })); setPage(1); }}>{k.replace('Keranjang Usulan ', '')}</button>))}
                </div>
            )}

            {/* ===== PROPOSAL TABS ===== */}
            {isAdminOrVerifikator && (
                <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-color)', marginBottom: 0 }}>
                    <button
                        onClick={() => setProposalTab('aktif')}
                        style={{
                            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                            color: proposalTab === 'aktif' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            borderBottom: proposalTab === 'aktif' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                            marginBottom: -2,
                        }}
                    >
                        <FileSpreadsheet size={16} /> Proposal Aktif
                        <span style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 11 }}>{filteredAktif.length}</span>
                    </button>
                    <button
                        onClick={() => setProposalTab('realisasi')}
                        style={{
                            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                            color: proposalTab === 'realisasi' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            borderBottom: proposalTab === 'realisasi' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                            marginBottom: -2,
                        }}
                    >
                        <CheckCircle size={16} /> Terealisasi
                        <span style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 11 }}>{filteredRealisasi.length}</span>
                    </button>
                </div>
            )}

            {/* ===== TAB: PROPOSAL AKTIF ===== */}
            {proposalTab === 'aktif' && (
            <div className="table-container" style={{ borderTopLeftRadius: 0, borderTopRightRadius: isAdminOrVerifikator ? 0 : undefined }}>
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search"><Search size={16} className="search-icon" /><input placeholder="Cari nama sekolah, NPSN..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Tampil
                            <select
                                value={perPage}
                                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                            >
                                <option value="10">10</option>
                                <option value="15">15</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                            data
                        </div>

                        {!isSekolah && (
                        <div style={{ position: 'relative' }} ref={filterPanelRef}>
                            <button className={`btn ${activeFilterCount > 0 ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setShowFilterPanel(!showFilterPanel)}><Filter size={14} /> Filter {activeFilterCount > 0 && <span style={{ background: '#fff', color: 'var(--accent-blue)', borderRadius: 'var(--radius-full)', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, marginLeft: 2 }}>{activeFilterCount}</span>}</button>
                            {showFilterPanel && (<div className="dropdown-menu" style={{ right: 0, top: '100%', marginTop: 4, minWidth: 400, padding: 16, zIndex: 50 }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}><div><label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Kecamatan</label><SearchableSelect options={KECAMATAN} value={headerFilters.kecamatan} onChange={v => { setHeaderFilters(prev => ({ ...prev, kecamatan: v })); setPage(1); }} placeholder="Semua" /></div><div><label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Jenjang</label><select className="form-select" value={headerFilters.jenjang} onChange={e => { setHeaderFilters(prev => ({ ...prev, jenjang: e.target.value })); setPage(1); }}><option value="">Semua</option>{JENJANG.map(j => <option key={j} value={j}>{j}</option>)}</select></div>{isAdmin && (<div><label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Prioritas</label><select className="form-select" value={headerFilters.bintang} onChange={e => { setHeaderFilters(prev => ({ ...prev, bintang: e.target.value })); setPage(1); }}><option value="">Semua</option><option value="Ya">Berbintang</option></select></div>)}</div></div>)}
                        </div>
                        )}
                    </div>
                    <div className="table-toolbar-right">
                        {isAdminOrVerifikator && (
                            <>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowDaftarModal(true)}><Archive size={14} /> Daftar Dokumen</button>
                                <button className="btn btn-secondary btn-sm" onClick={handleOpenRekomendasi}><FilePlus size={14} /> Rekomendasi</button>
                                <button className="btn btn-secondary btn-sm" onClick={handleOpenChecklist}><FileCheck size={14} /> Checklist</button>
                            </>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('excel')}><FileSpreadsheet size={14} /> Excel</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}><FileText size={14} /> PDF</button>
                        {/* Column Visibility Toggle */}
                        <div style={{ position: 'relative' }} ref={colMenuRef}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowColMenu(!showColMenu)} title="Kolom"><Columns size={14} /> Kolom</button>
                            {showColMenu && (
                                <div className="dropdown-menu" style={{ right: 0, top: '100%', marginTop: 4, minWidth: 180, padding: 8, zIndex: 50 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 8px', fontWeight: 600, marginBottom: 4 }}>Tampilkan Kolom</div>
                                    {[
                                        { key: 'npsn', label: 'NPSN', show: !isSekolah },
                                        { key: 'kecamatan', label: 'Kecamatan', show: !isSekolah },
                                        { key: 'subKegiatan', label: 'Sub Kegiatan', show: true },
                                        { key: 'nilai', label: 'Nilai Pengajuan', show: true },
                                        { key: 'target', label: 'Target', show: true },
                                        { key: 'status', label: 'Status', show: true },
                                        { key: 'prioritas', label: 'Prioritas', show: isAdmin },
                                        { key: 'keranjang', label: 'Keranjang', show: canManageKeranjang },
                                    ].filter(c => c.show).map(c => (
                                        <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                                            <input type="checkbox" checked={!hiddenCols.includes(c.key)} onChange={() => toggleCol(c.key)} style={{ accentColor: 'var(--accent-blue)', width: 14, height: 14 }} />
                                            {c.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Nama Sekolah</th>
                                {!isSekolah && !hiddenCols.includes('npsn') && <th>NPSN</th>}
                                {!isSekolah && !hiddenCols.includes('kecamatan') && <th>Kecamatan</th>}
                                {!hiddenCols.includes('subKegiatan') && <th>Sub Kegiatan</th>}
                                {!hiddenCols.includes('nilai') && <th>Nilai Pengajuan</th>}
                                {!hiddenCols.includes('target') && <th>Target</th>}
                                {!hiddenCols.includes('status') && <th>Status</th>}
                                {isAdmin && !hiddenCols.includes('prioritas') && <th>Prioritas</th>}
                                {canManageKeranjang && !hiddenCols.includes('keranjang') && <th>Keranjang</th>}
                                <th style={{ width: 50 }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paged.map((item, i) => (
                                <tr key={item.id}>
                                    <td>{(page - 1) * perPage + i + 1}</td>
                                    <td style={{ minWidth: 180, whiteSpace: 'normal' }}>{safeStr(item.namaSekolah)}</td>
                                    {!isSekolah && !hiddenCols.includes('npsn') && <td>{safeStr(item.npsn)}</td>}
                                    {!isSekolah && !hiddenCols.includes('kecamatan') && <td>{safeStr(item.kecamatan)}</td>}
                                    {!hiddenCols.includes('subKegiatan') && <td style={{ minWidth: 220, whiteSpace: 'normal' }}>{item.subKegiatan}</td>}
                                    {!hiddenCols.includes('nilai') && <td style={{ whiteSpace: 'nowrap' }}>{formatCurrency(item.nilaiPengajuan)}</td>}
                                    {!hiddenCols.includes('target') && <td>{item.target}</td>}
                                    {!hiddenCols.includes('status') && <td>{getStatusBadge(item.status)}</td>}
                                    {isAdmin && !hiddenCols.includes('prioritas') && <td>{renderPriorityStar(item.bintang === 1, item.id)}</td>}
                                    {canManageKeranjang && !hiddenCols.includes('keranjang') && (
                                        <td>
                                            <span className="badge badge-disetujui" style={{ fontSize: 10 }}>
                                                {item.keranjang?.replace('Keranjang Usulan ', '') || '-'}
                                            </span>
                                        </td>
                                    )}
                                    <td>
                                        <button className="btn-icon" onClick={(e) => handleActionClick(e, item.id)} title="Aksi">
                                            <MoreHorizontal size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {paged.length === 0 && (
                                <tr>
                                    <td colSpan={99} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                        Tidak ada data ditemukan
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Fixed-position action dropdown (outside overflow container) */}
                {openActionId && (() => {
                    const item = paged.find(p => p.id === openActionId);
                    if (!item) return null;
                    return (
                        <div ref={actionDropdownRef} className="dropdown-menu" style={{ position: 'fixed', top: actionPos.top, left: actionPos.left, minWidth: 170, padding: 4, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                            <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)', borderRadius: 6 }} className="dropdown-item" onClick={() => { setViewItem(item); setOpenActionId(null); }}>
                                <Eye size={14} /> Lihat Detail
                            </button>
                            {!readOnly && (isAdminOrVerifikator || (isSekolah && (item.status === 'Ditolak' || item.status === 'Revisi'))) && (
                                <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)', borderRadius: 6 }} className="dropdown-item" onClick={() => { handleOpenModal(item); setOpenActionId(null); }}>
                                    <Edit size={14} /> Edit
                                </button>
                            )}
                            {isAdmin && (
                                <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: item.bintang === 1 ? 'var(--accent-yellow)' : 'var(--text-primary)', borderRadius: 6 }} className="dropdown-item" onClick={() => { handleStar(item.id); setOpenActionId(null); }}>
                                    <Star size={14} fill={item.bintang === 1 ? 'currentColor' : 'none'} /> {item.bintang === 1 ? 'Hapus Prioritas' : 'Tandai Prioritas'}
                                </button>
                            )}
                            {isAdmin && item.status === 'Disetujui' && (
                                <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--accent-green)', borderRadius: 6 }} className="dropdown-item" onClick={() => { handleRealisasi(item); setOpenActionId(null); }}>
                                    <CheckCircle size={14} /> Terealisasi
                                </button>
                            )}
                            {!readOnly && isAdmin && (
                                <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--accent-red)', borderRadius: 6 }} className="dropdown-item" onClick={() => { if (!guard('hapus')) return; setDeleteConfirm(item); setOpenActionId(null); }}>
                                    <Trash2 size={14} /> Hapus
                                </button>
                            )}
                        </div>
                    );
                })()}
                <div className="table-pagination">
                    <div className="table-pagination-info">Menampilkan {Math.min((page - 1) * perPage + 1, filteredAktif.length)}-{Math.min(page * perPage, filteredAktif.length)} dari {filteredAktif.length}</div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>‹</button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (<button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>))}
                        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>›</button>
                    </div>
                </div>
            </div>
            )}

            {/* ===== TAB: TEREALISASI ===== */}
            {proposalTab === 'realisasi' && isAdminOrVerifikator && (
                <div className="table-container" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                    <div className="table-toolbar">
                        <div className="table-toolbar-left">
                            <div className="table-search"><Search size={16} className="search-icon" /><input placeholder="Cari proposal terealisasi..." value={search} onChange={e => { setSearch(e.target.value); setRealisasiPage(1); }} /></div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Tampil
                                <select
                                    value={realisasiPerPage}
                                    onChange={(e) => { setRealisasiPerPage(Number(e.target.value)); setRealisasiPage(1); }}
                                    style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                                >
                                    <option value="10">10</option>
                                    <option value="15">15</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                                data
                            </div>

                            {!isSekolah && (
                            <div style={{ position: 'relative' }} ref={filterPanelRef}>
                                <button className={`btn ${activeFilterCount > 0 ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setShowFilterPanel(!showFilterPanel)}><Filter size={14} /> Filter {activeFilterCount > 0 && <span style={{ background: '#fff', color: 'var(--accent-blue)', borderRadius: 'var(--radius-full)', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, marginLeft: 2 }}>{activeFilterCount}</span>}</button>
                                {showFilterPanel && (<div className="dropdown-menu" style={{ right: 0, top: '100%', marginTop: 4, minWidth: 400, padding: 16, zIndex: 50 }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}><div><label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Kecamatan</label><SearchableSelect options={KECAMATAN} value={headerFilters.kecamatan} onChange={v => { setHeaderFilters(prev => ({ ...prev, kecamatan: v })); setRealisasiPage(1); }} placeholder="Semua" /></div><div><label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Jenjang</label><select className="form-select" value={headerFilters.jenjang} onChange={e => { setHeaderFilters(prev => ({ ...prev, jenjang: e.target.value })); setRealisasiPage(1); }}><option value="">Semua</option>{JENJANG.map(j => <option key={j} value={j}>{j}</option>)}</select></div></div></div>)}
                            </div>
                            )}
                        </div>
                        <div className="table-toolbar-right">
                            <button className="btn btn-secondary btn-sm" onClick={() => handleExport('excel')}><FileSpreadsheet size={14} /> Excel</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}><FileText size={14} /> PDF</button>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr><th>No</th><th>Nama Sekolah</th><th>NPSN</th><th>Kecamatan</th><th>Sub Kegiatan</th><th>Nilai Pengajuan</th><th>Target</th><th>Nama Bantuan</th><th>Aksi</th></tr>
                            </thead>
                            <tbody>
                                {filteredRealisasi.slice((realisasiPage - 1) * realisasiPerPage, realisasiPage * realisasiPerPage).map((item, i) => (
                                    <tr key={item.id}>
                                        <td>{(realisasiPage - 1) * realisasiPerPage + i + 1}</td>
                                        <td>{item.namaSekolah}</td>
                                        <td>{item.npsn}</td>
                                        <td>{item.kecamatan}</td>
                                        <td style={{ maxWidth: 220, whiteSpace: 'normal' }}>{item.subKegiatan}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatCurrency(item.nilaiPengajuan)}</td>
                                        <td>{item.target}</td>
                                        <td><span className="badge badge-disetujui">{item.statusUsulan}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-icon" onClick={() => setViewItem(item)} title="Detail"><Eye size={16} /></button>
                                                {isAdmin && (
                                                    <button className="btn-icon" onClick={() => handleUnrealisasi(item)} title="Kembalikan ke Aktif" style={{ color: 'var(--accent-blue)' }}><RotateCcw size={16} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredRealisasi.length === 0 && (
                                    <tr><td colSpan={99} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Belum ada proposal terealisasi</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {(() => { const rTotalPages = Math.ceil(filteredRealisasi.length / realisasiPerPage) || 1; return (
                        <div className="table-pagination">
                            <div className="table-pagination-info">Menampilkan {Math.min((realisasiPage - 1) * realisasiPerPage + 1, filteredRealisasi.length)}-{Math.min(realisasiPage * realisasiPerPage, filteredRealisasi.length)} dari {filteredRealisasi.length}</div>
                            <div className="table-pagination-controls">
                                <button onClick={() => setRealisasiPage(Math.max(1, realisasiPage - 1))} disabled={realisasiPage === 1}>‹</button>
                                {Array.from({ length: Math.min(rTotalPages, 5) }, (_, i) => i + 1).map(p => (<button key={p} className={p === realisasiPage ? 'active' : ''} onClick={() => setRealisasiPage(p)}>{p}</button>))}
                                <button onClick={() => setRealisasiPage(Math.min(rTotalPages, realisasiPage + 1))} disabled={realisasiPage === rTotalPages}>›</button>
                            </div>
                        </div>
                    ); })()}
                </div>
            )}

            {/* ===== MODAL PROPOSAL (ADD/EDIT) ===== */}
            {showModal && (
                <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
                    <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">{editItem ? 'Edit Proposal' : 'Tambah Proposal'}</div><button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nama Sekolah *</label>
                                {editItem || isSekolah ? (<input className="form-input" value={formSekolah} disabled style={{ background: 'var(--bg-secondary)' }} />) : (<SearchableSelect options={schoolNames} value={formSekolah} onChange={setFormSekolah} placeholder="-- Pilih Sekolah --" renderOption={renderSchoolOption} />)}
                            </div>
                            {selectedSchoolData && (<div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.06)', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 20, flexWrap: 'wrap' }}><span><b>NPSN:</b> {safeStr(selectedSchoolData.npsn)}</span><span><b>Kecamatan:</b> {safeStr(selectedSchoolData.kecamatan)}</span><span><b>Jenjang:</b> {safeStr(selectedSchoolData.jenjang)}</span>{selectedSchoolData.kepsek && <span><b>Kepala Sekolah:</b> {safeStr(selectedSchoolData.kepsek)}</span>}</div>)}

                            <div className="form-row">
                                <div className="form-group"><label className="form-label">Sub Kegiatan *</label><select className="form-select" value={formData.subKegiatan || ''} onChange={e => setFormData({ ...formData, subKegiatan: e.target.value })}>{SUB_KEGIATAN.filter(s => !selectedSchoolData?.jenjang || s.jenjang === selectedSchoolData.jenjang).map(s => <option key={s.kode} value={s.nama}>{s.nama}</option>)}</select></div>
                                {isAdminOrVerifikator && (<div className="form-group"><label className="form-label">Status</label><select className="form-select" value={formData.status || ''} onChange={e => setFormData({ ...formData, status: e.target.value })}>{STATUS_PROPOSAL.map(s => <option key={s} value={s}>{s}</option>)}</select></div>)}
                            </div>

                            {isAdminOrVerifikator && editItem && (
                                <div className="form-group">
                                    <label className="form-label">Keranjang Usulan</label>
                                    <select className="form-select" value={formData.keranjang || ''} onChange={e => setFormData({ ...formData, keranjang: e.target.value })}>
                                        <option value="">Belum Ditetapkan</option>
                                        {KERANJANG.map(k => <option key={k} value={k}>{k}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="form-row"><div className="form-group"><label className="form-label">Nilai Pengajuan (Rp) *</label><input className="form-input" type="text" inputMode="numeric" value={formData.nilaiPengajuan ? String(formData.nilaiPengajuan).replace(/\./g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) setFormData({ ...formData, nilaiPengajuan: raw }); }} placeholder="Contoh: 50.000.000" /></div><div className="form-group"><label className="form-label">Target *</label><input className="form-input" value={formData.target || ''} onChange={e => setFormData({ ...formData, target: e.target.value })} /></div></div>
                            <div className="form-group"><label className="form-label">Keterangan *</label><textarea className="form-input" rows={2} value={formData.keterangan || ''} onChange={e => setFormData({ ...formData, keterangan: e.target.value })}></textarea></div>

                            {/* Upload Soft File Proposal (PDF) */}
                            <div className="form-group">
                                <label className="form-label">Upload Proposal (PDF) *</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', flexShrink: 0 }}>
                                        <Upload size={14} style={{ marginRight: 4 }} /> {formData.proposalFile || editItem?.fileName ? 'Ganti File' : 'Pilih File'}
                                        <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (!f) return; if (f.type !== 'application/pdf') { toast.error('Hanya file PDF!'); e.target.value = null; return; } if (f.size > 5*1024*1024) { toast.error('Maks 5MB'); e.target.value = null; return; } setFormData({ ...formData, proposalFile: f }); }} />
                                    </label>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {formData.proposalFile ? (
                                            <span style={{ color: 'var(--accent-green)' }}><FileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{formData.proposalFile.name}</span>
                                        ) : editItem?.fileName ? (
                                            <span style={{ color: 'var(--accent-blue)' }}><FileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{editItem.fileName} (tersimpan)</span>
                                        ) : 'Belum ada file'}
                                    </span>
                                </div>
                                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Format PDF, maksimal 5MB</small>
                            </div>

                            {isAdminOrVerifikator && (<div className="form-row"><div className="form-group"><label className="form-label">No Agenda Surat</label><input className="form-input" value={formData.noAgendaSurat || ''} onChange={e => setFormData({ ...formData, noAgendaSurat: e.target.value })} /></div><div className="form-group"><label className="form-label">Tanggal Surat</label><input className="form-input" type="date" value={formData.tanggalSurat || ''} onChange={e => setFormData({ ...formData, tanggalSurat: e.target.value })} /></div></div>)}
                        </div>
                        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>Batal</button><button className="btn btn-primary" onClick={handleSave} disabled={saving || (!editItem && !formSekolah)}>{saving ? <><span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite', marginRight: 6, verticalAlign: 'middle' }} /> Menyimpan...</> : <><Save size={14} /> Simpan</>}</button></div>
                    </div>
                </div>
            )}

            {/* ===== MODAL VIEW ===== */}
            {viewItem && (
                <div className="modal-overlay" onClick={() => setViewItem(null)}>
                    <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">Detail Proposal</div><button className="modal-close" onClick={() => setViewItem(null)}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div className="form-row"><div className="form-group"><label className="form-label">Nama Sekolah</label><div style={{ fontWeight: 500 }}>{safeStr(viewItem.namaSekolah)}</div></div><div className="form-group"><label className="form-label">NPSN</label><div>{safeStr(viewItem.npsn)}</div></div></div>
                            <div className="form-row"><div className="form-group"><label className="form-label">Kecamatan</label><div>{safeStr(viewItem.kecamatan)}</div></div>{isAdminOrVerifikator && <div className="form-group"><label className="form-label">Status</label><div>{getStatusBadge(viewItem.status)}</div></div>}</div>
                            <div className="form-group"><label className="form-label">Sub Kegiatan</label><div>{viewItem.subKegiatan}</div></div>
                            {(canManageKeranjang || isKorwil) && (<div className="form-group"><label className="form-label">Keranjang</label><div>{viewItem.keranjang || 'Belum Ditetapkan'}</div></div>)}
                            <div className="form-row"><div className="form-group"><label className="form-label">Nilai Pengajuan</label><div style={{ fontWeight: 600, color: 'var(--accent-green)', fontSize: 16 }}>{formatCurrency(viewItem.nilaiPengajuan)}</div></div><div className="form-group"><label className="form-label">Target</label><div>{viewItem.target}</div></div></div>
                            <div className="form-group"><label className="form-label">Keterangan</label><div>{viewItem.keterangan || '-'}</div></div>
                            {/* File Proposal PDF */}
                            <div className="form-group">
                                <label className="form-label">File Proposal</label>
                                {viewItem.fileName ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FileText size={16} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                                        <a
                                            href={`/api/file/proposal-doc/${viewItem.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: 'var(--accent-green)', textDecoration: 'underline', cursor: 'pointer', fontSize: 14 }}
                                        >
                                            {viewItem.fileName}
                                        </a>
                                    </div>
                                ) : (
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Belum ada file</div>
                                )}
                            </div>
                            {/* Tanggal Pengajuan */}
                            <div className="form-group">
                                <label className="form-label">Tanggal Pengajuan</label>
                                <div style={{ fontSize: 13 }}>
                                    {viewItem.createdAt ? new Date(viewItem.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' pukul ' + new Date(viewItem.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </div>
                            </div>
                            {isAdmin && <div className="form-group"><label className="form-label">Prioritas</label><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 28, cursor: 'pointer', color: viewItem.bintang === 1 ? 'var(--accent-yellow)' : 'var(--border-color)', transition: 'color 150ms, transform 150ms', display: 'inline-block' }} onClick={() => handleStar(viewItem.id)} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>★</span><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{viewItem.bintang === 1 ? 'Diprioritaskan (klik untuk hapus)' : 'Klik untuk tandai prioritas'}</span></div></div>}
                            {/* Show reason for Revisi/Ditolak */}
                            {viewItem.alasanRevisi && (viewItem.status === 'Ditolak' || viewItem.status === 'Revisi') && (
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: 8,
                                    background: viewItem.status === 'Revisi' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                    border: `1px solid ${viewItem.status === 'Revisi' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                    marginTop: 8
                                }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: viewItem.status === 'Revisi' ? '#f59e0b' : '#ef4444', marginBottom: 4 }}>
                                        {viewItem.status === 'Revisi' ? '📝 Catatan Revisi' : '❌ Alasan Penolakan'}
                                    </div>
                                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{viewItem.alasanRevisi}</div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setViewItem(null)}>Tutup</button>{!readOnly && (isAdminOrVerifikator || (isSekolah && (viewItem.status === 'Ditolak' || viewItem.status === 'Revisi'))) && <button className="btn btn-primary" onClick={() => { setViewItem(null); handleOpenModal(viewItem); }}><Edit size={14} /> Edit Data</button>}</div>
                    </div>
                </div>
            )}

            {/* ===== CUSTOM DELETE CONFIRMATION MODAL ===== */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            {/* Animated Icon Container */}
                            <div style={{
                                width: 64,
                                height: 64,
                                borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: 'var(--accent-red)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px',
                                animation: 'pulse 2s infinite'
                            }}>
                                <AlertOctagon size={32} strokeWidth={1.5} />
                            </div>

                            <h3 style={{ fontSize: '1.15rem', marginBottom: 8, color: 'var(--text-primary)' }}>Hapus Data Proposal?</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                                Data yang dihapus tidak dapat dikembalikan.
                            </p>

                            {/* Preview Data */}
                            <div style={{
                                background: 'var(--bg-secondary)',
                                padding: '12px',
                                borderRadius: 'var(--radius-md)',
                                margin: '16px 0 24px',
                                textAlign: 'left',
                                border: '1px solid var(--border-color)'
                            }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Item yang akan dihapus:</div>
                                <div style={{ fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>{deleteConfirm.namaSekolah}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                    <span>{deleteConfirm.subKegiatan}</span>
                                    <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{formatCurrency(deleteConfirm.nilaiPengajuan)}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => setDeleteConfirm(null)}
                                    style={{ minWidth: 100 }}
                                >
                                    Batal
                                </button>
                                <button
                                    className="btn"
                                    onClick={performDelete}
                                    style={{
                                        minWidth: 100,
                                        background: 'var(--accent-red)',
                                        color: '#fff',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6
                                    }}
                                >
                                    <Trash2 size={14} /> Ya, Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL CHECKLIST PROPOSAL ===== */}
            {showChecklist && (
                <div className="modal-overlay" onClick={() => setShowChecklist(false)}>
                    <div className="modal" style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">Checklist Proposal - Instrumen Verifikasi Proposal</div><button className="modal-close" onClick={() => setShowChecklist(false)}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                                <div className="form-group"><label className="form-label">Cari Sekolah</label><SearchableSelect options={schoolNames} value={checklistForm.sekolah?.nama || ''} onChange={handleChecklistSchoolChange} placeholder="Ketik nama sekolah..." /></div>
                                <div className="form-group"><label className="form-label">Jenis Usulan</label><input className="form-input" placeholder="Ketik jenis usulan..." value={checklistForm.jenisUsulan} onChange={e => setChecklistForm(prev => ({ ...prev, jenisUsulan: e.target.value }))} /></div>
                            </div>
                            <div className="form-group"><label className="form-label">Alamat</label><input className="form-input" value={checklistForm.alamat} readOnly placeholder="Alamat sekolah" /></div>
                            <h4 style={{ marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Tabel Verifikasi</h4>
                            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                                <table className="data-table" style={{ margin: 0 }}>
                                    <thead><tr><th style={{ width: 40 }}>No</th><th style={{ width: 300 }}>Indikator</th><th style={{ width: 120 }}>Ada/Tidak Ada</th><th>Keterangan</th><th style={{ width: 40 }}>Aksi</th></tr></thead>
                                    <tbody>
                                        {checklistForm.items.map((item, i) => (
                                            <tr key={item.id}>
                                                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                                                <td><input className="form-input" style={{ border: 'none', background: 'transparent', padding: '4px' }} value={item.indikator} onChange={e => setChecklistForm(prev => ({ ...prev, items: prev.items.map(it => it.id === item.id ? { ...it, indikator: e.target.value } : it) }))} /></td>
                                                <td><select className="form-select" style={{ height: 32, fontSize: 12 }} value={item.status} onChange={e => setChecklistForm(prev => ({ ...prev, items: prev.items.map(it => it.id === item.id ? { ...it, status: e.target.value } : it) }))}><option value="-">-</option><option value="Ada">Ada</option><option value="Tidak Ada">Tidak Ada</option></select></td>
                                                <td><input className="form-input" style={{ border: 'none', background: 'transparent', padding: '4px' }} placeholder="Keterangan..." value={item.keterangan} onChange={e => setChecklistForm(prev => ({ ...prev, items: prev.items.map(it => it.id === item.id ? { ...it, keterangan: e.target.value } : it) }))} /></td>
                                                <td style={{ textAlign: 'center' }}><button className="btn-icon" onClick={() => setChecklistForm(prev => ({ ...prev, items: prev.items.filter(it => it.id !== item.id) }))} style={{ color: 'var(--accent-red)' }}><Trash2 size={14} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setChecklistForm(prev => ({ ...prev, items: [...prev.items, { id: Date.now(), indikator: '', status: '-', keterangan: '' }] }))}><Plus size={14} /> Tambah Baris</button>

                            <h4 style={{ marginTop: 24, marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>TTD Verifikator</h4>
                            {checklistForm.verifikators.map((ver, i) => (
                                <div key={ver.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 12, marginBottom: 12, alignItems: 'center' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Nama Verifikator {i + 1}</label><select className="form-select" value={ver.userId} onChange={e => { const user = usersList.find(u => u.id === e.target.value); setChecklistForm(prev => ({ ...prev, verifikators: prev.verifikators.map(v => v.id === ver.id ? { ...v, userId: e.target.value, nama: user?.name || '', nip: user?.nip || '-' } : v) })); }}><option value="">Pilih verifikator...</option>{usersList.filter(u => u.role === 'Verifikator' || u.role === 'verifikator').map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}</select></div>
                                    <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">NIP</label><input className="form-input" value={ver.nip} readOnly placeholder="NIP otomatis terisi" /></div>
                                    <button className="btn-icon" onClick={() => setChecklistForm(prev => ({ ...prev, verifikators: prev.verifikators.filter(v => v.id !== ver.id) }))} style={{ color: 'var(--accent-red)', marginTop: 24 }}><Trash2 size={14} /></button>
                                </div>
                            ))}
                            <button className="btn btn-ghost btn-sm" onClick={() => setChecklistForm(prev => ({ ...prev, verifikators: [...prev.verifikators, { id: Date.now(), userId: '', nama: '', nip: '' }] }))}><Plus size={14} /> Tambah Verifikator</button>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowChecklist(false)}>Batal</button>
                            <button className="btn btn-secondary" onClick={handlePrintChecklist}><Printer size={14} /> Cetak</button>
                            <button className="btn btn-primary" onClick={handleSaveChecklist}><Save size={14} /> Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL REKOMENDASI ===== */}
            {showRekomendasi && (
                <div className="modal-overlay" onClick={() => setShowRekomendasi(false)}>
                    <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">Form Rekomendasi</div><button className="modal-close" onClick={() => setShowRekomendasi(false)}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group"><label className="form-label">Nama Sekolah</label><SearchableSelect options={schoolNames} value={rekomendasiForm.namaSekolah} onChange={handleRekomendasiSchoolChange} placeholder="Cari Sekolah..." /></div>
                                <div className="form-group"><label className="form-label">Kecamatan</label><input className="form-input" value={rekomendasiForm.kecamatan} readOnly placeholder="Otomatis terisi" /></div>
                                <div className="form-group"><label className="form-label">Sub Kegiatan</label><select className="form-select" value={rekomendasiForm.subKegiatan} onChange={e => handleRekomendasiChange('subKegiatan', e.target.value)}><option value="">Pilih Sub Kegiatan</option>{SUB_KEGIATAN.filter(s => !rekomendasiForm.jenjang || s.jenjang === rekomendasiForm.jenjang).map(s => <option key={s.kode} value={s.nama}>{s.nama}</option>)}</select></div>
                                <div className="form-group"><label className="form-label">Perihal</label><input className="form-input" placeholder="Isi perihal..." value={rekomendasiForm.perihal} onChange={e => handleRekomendasiChange('perihal', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Jenjang</label><input className="form-input" value={rekomendasiForm.jenjang} readOnly placeholder="Otomatis terisi" /></div>
                                <div className="form-group"><label className="form-label">Nilai (Rp)</label><input className="form-input" type="text" inputMode="numeric" placeholder="Contoh: 50.000.000" value={rekomendasiForm.nilai ? String(rekomendasiForm.nilai).replace(/\./g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) handleRekomendasiChange('nilai', raw); }} /></div>
                                <div className="form-group"><label className="form-label">Target</label><input className="form-input" placeholder="Contoh: 1 Unit" value={rekomendasiForm.target} onChange={e => handleRekomendasiChange('target', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">No Agenda</label><input className="form-input" placeholder="Nomor Agenda" value={rekomendasiForm.noAgenda} onChange={e => handleRekomendasiChange('noAgenda', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Surat Masuk</label><input className="form-input" placeholder="Sumber surat masuk" value={rekomendasiForm.suratMasuk} onChange={e => handleRekomendasiChange('suratMasuk', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Tanggal Surat</label><input className="form-input" type="date" value={rekomendasiForm.tanggalSurat} onChange={e => handleRekomendasiChange('tanggalSurat', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Nomor Surat</label><input className="form-input" placeholder="Nomor surat" value={rekomendasiForm.nomorSurat} onChange={e => handleRekomendasiChange('nomorSurat', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Sumber</label><input className="form-input" placeholder="Sumber dana/keterangan" value={rekomendasiForm.sumber} onChange={e => handleRekomendasiChange('sumber', e.target.value)} /></div>
                            </div>
                            <div className="form-group" style={{ marginTop: 16 }}><label className="form-label">Kondisi Sebenarnya</label><textarea className="form-input" rows={4} placeholder="Deskripsi kondisi sebenarnya di lapangan..." value={rekomendasiForm.kondisi} onChange={e => handleRekomendasiChange('kondisi', e.target.value)}></textarea></div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowRekomendasi(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSaveRekomendasi}><Save size={14} /> Simpan Rekomendasi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL DAFTAR DOKUMEN ===== */}
            {showDaftarModal && (
                <div className="modal-overlay" onClick={() => setShowDaftarModal(false)}>
                    <div className="modal" style={{ maxWidth: 1100, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Arsip Dokumen Terbit</div>
                            <button className="modal-close" onClick={() => setShowDaftarModal(false)}><X size={18} /></button>
                        </div>

                        <div style={{ padding: '0 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setDaftarTab('rekomendasi')}
                                style={{ padding: '0.75rem 0', borderBottom: daftarTab === 'rekomendasi' ? '2px solid var(--accent-blue)' : 'none', color: daftarTab === 'rekomendasi' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <FileText size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Daftar Rekomendasi
                            </button>
                            <button
                                onClick={() => setDaftarTab('checklist')}
                                style={{ padding: '0.75rem 0', borderBottom: daftarTab === 'checklist' ? '2px solid var(--accent-blue)' : 'none', color: daftarTab === 'checklist' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <FileCheck size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Daftar Checklist
                            </button>
                        </div>

                        <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 140px)' }}>
                            {daftarTab === 'rekomendasi' && (
                                <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th>Nama Sekolah</th>
                                            <th>Kecamatan</th>
                                            <th>Sub Kegiatan</th>
                                            <th>Perihal</th>
                                            <th>Jenjang</th>
                                            <th>Nilai</th>
                                            <th>Target</th>
                                            <th>No Agenda</th>
                                            <th>Surat Masuk</th>
                                            <th>Tanggal Surat</th>
                                            <th>Nomor Surat</th>
                                            <th>Kondisi Sebenarnya</th>
                                            <th>Sumber</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rekomendasiList.length === 0 ? (
                                            <tr><td colSpan={15} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Belum ada data rekomendasi.</td></tr>
                                        ) : (
                                            rekomendasiList.map((item, i) => (
                                                <tr key={item.id}>
                                                    <td>{i + 1}</td>
                                                    <td>{item.namaSekolah}</td>
                                                    <td>{item.kecamatan}</td>
                                                    <td>{item.subKegiatan}</td>
                                                    <td>{item.perihal}</td>
                                                    <td>{item.jenjang}</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(item.nilai)}</td>
                                                    <td>{item.target}</td>
                                                    <td>{item.noAgenda}</td>
                                                    <td>{item.suratMasuk}</td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{item.tanggalSurat}</td>
                                                    <td>{item.nomorSurat}</td>
                                                    <td>{item.kondisi}</td>
                                                    <td>{item.sumber}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button className="btn-icon" title="Hapus" style={{ color: 'var(--accent-red)' }} onClick={async () => { try { await arsipDokumenApi.deleteRekomendasi(item.id); setRekomendasiList(prev => prev.filter(d => d.id !== item.id)); toast.success('Rekomendasi dihapus'); } catch { toast.error('Gagal menghapus'); } }}><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            )}

                            {daftarTab === 'checklist' && (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th>Tanggal</th>
                                            <th>Nama Sekolah</th>
                                            <th>Jenis Usulan</th>
                                            <th>Jumlah Indikator</th>
                                            <th>Verifikator</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {checklistList.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Belum ada data checklist.</td></tr>
                                        ) : (
                                            checklistList.map((item, i) => (
                                                <tr key={item.id}>
                                                    <td>{i + 1}</td>
                                                    <td>{new Date(item.createdAt).toLocaleDateString('id-ID')}</td>
                                                    <td>{item._sekolah?.nama || item.sekolahNama || '-'}</td>
                                                    <td>{item.jenisUsulan || '-'}</td>
                                                    <td>{item.items?.length || 0} Item</td>
                                                    <td>{item.verifikators?.length || 0} Orang</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button className="btn-icon" title="Cetak" onClick={() => handlePrintSavedChecklist(item)}><Printer size={16} /></button>
                                                            <button className="btn-icon" title="Hapus" style={{ color: 'var(--accent-red)' }} onClick={async () => { try { await arsipDokumenApi.deleteChecklist(item.id); setChecklistList(prev => prev.filter(d => d.id !== item.id)); toast.success('Checklist dihapus'); } catch { toast.error('Gagal menghapus'); } }}><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Global style for pulse animation */}
            <style>{`
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
            `}</style>

            {/* ===== REALISASI MODAL ===== */}
            {realisasiModal && (
                <div className="modal-overlay" onClick={() => setRealisasiModal(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">Tandai Terealisasi</div><button className="modal-close" onClick={() => setRealisasiModal(null)}><X size={18} /></button></div>
                        <div className="modal-body">
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                Proposal <strong>{realisasiModal.item?.namaSekolah}</strong> akan dipindahkan ke tabel terealisasi.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Nama Bantuan *</label>
                                <input
                                    className="form-input"
                                    placeholder="Contoh: APBD 2025, DAK 2025, Hibah Provinsi..."
                                    value={realisasiModal.namaBantuan}
                                    onChange={e => setRealisasiModal(prev => ({ ...prev, namaBantuan: e.target.value }))}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setRealisasiModal(null)}>Batal</button>
                            <button className="btn btn-primary" onClick={confirmRealisasi} disabled={!realisasiModal.namaBantuan?.trim()}>
                                <CheckCircle size={14} /> Konfirmasi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== BATCH IMPORT MODAL ===== */}
            {showBatchModal && (
                <div className="modal-overlay" onClick={() => { setShowBatchModal(false); setBatchData([]); }}>
                    <div className="modal" style={{ maxWidth: 800, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">Import Batch Proposal</div><button className="modal-close" onClick={() => { setShowBatchModal(false); setBatchData([]); }}><X size={18} /></button></div>
                        <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 140px)' }}>
                            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                                <button className="btn btn-secondary" onClick={downloadBatchTemplate}><Download size={14} /> Download Template</button>
                                <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <Upload size={14} /> Upload File Excel
                                    <input type="file" accept=".xlsx,.xls" onChange={handleBatchFileUpload} hidden />
                                </label>
                            </div>
                            {batchData.length > 0 && (
                                <>
                                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>{batchData.length} data siap diimport:</p>
                                    <div style={{ overflowX: 'auto', maxHeight: 400, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                        <table className="data-table" style={{ margin: 0 }}>
                                            <thead>
                                                <tr><th>No</th><th>NPSN</th><th>Sub Kegiatan</th><th>Nilai Pengajuan</th><th>Target</th><th>Keterangan</th></tr>
                                            </thead>
                                            <tbody>
                                                {batchData.map((row, i) => (
                                                    <tr key={i}>
                                                        <td>{i + 1}</td>
                                                        <td>{row['NPSN'] || row['npsn'] || '-'}</td>
                                                        <td>{row['Sub Kegiatan'] || row['subKegiatan'] || '-'}</td>
                                                        <td>{row['Nilai Pengajuan'] || row['nilaiPengajuan'] || '-'}</td>
                                                        <td>{row['Target'] || row['target'] || '-'}</td>
                                                        <td>{row['Keterangan'] || row['keterangan'] || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => { setShowBatchModal(false); setBatchData([]); }}>Batal</button>
                            <button className="btn btn-primary" onClick={handleBatchImport} disabled={!batchData.length || batchImporting}>
                                {batchImporting ? 'Mengimport...' : `Import ${batchData.length} Proposal`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Proposal;