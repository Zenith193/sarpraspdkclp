import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, Download, Plus, Edit, Trash2, ChevronLeft, ChevronRight, X, Save, AlertTriangle, FileSpreadsheet, Building, User, Briefcase, FileText, Settings, DollarSign, Calendar, Truck, PlusCircle, AlertCircle, RefreshCw, CheckSquare, Square, FileDown, Info, Printer, Clock, Phone, Columns, Eye, EyeOff, Upload } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useSekolahData } from '../../data/dataProvider';
import SearchableSelect from '../../components/ui/SearchableSelect';
import useMatrikStore, { generateNoSpk, inferJenjang, fullTerbilang, formatNumberInput, parseFormattedNumber, naturalSort, SUMBER_DANA, JENIS_PENGADAAN, METODE_PEMILIHAN, STATUS_PEMILIK } from '../../store/matrikStore';
import { matrikApi, templateApi } from '../../api/index';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// ===== CONSTANTS =====
// Dinamisasi Tahun Anggaran
const currentYear = new Date().getFullYear();
const TAHUN_ANGGARAN = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3];

const DRAFT_KEY = 'matrik_kegiatan_draft_v1';

// ===== TABLE COLUMNS =====
const TABLE_COLUMNS = [
    { key: 'noMatrik', label: 'No Matrik', required: true },
    { key: 'npsn', label: 'NPSN' },
    { key: 'namaSekolah', label: 'Nama Sekolah' },
    { key: 'subBidang', label: 'Sub Bidang' },
    { key: 'noSubKegiatan', label: 'No Sub Kegiatan' },
    { key: 'subKegiatan', label: 'Sub Kegiatan' },
    { key: 'rup', label: 'RUP' },
    { key: 'namaPaket', label: 'Nama Paket Pekerjaan', required: true },
    { key: 'paguAnggaran', label: 'Pagu Anggaran' },
    { key: 'paguPaket', label: 'Pagu Paket' },
    { key: 'hps', label: 'HPS' },
    { key: 'nilaiKontrak', label: 'Nilai Kontrak' },
    { key: 'terbilangKontrak', label: 'Terbilang Kontrak' },
    { key: 'sumberDana', label: 'Sumber Dana' },
    { key: 'metode', label: 'Metode Pemilihan' },
    { key: 'jenisPengadaan', label: 'Jenis Pengadaan' },
    { key: 'penyedia', label: 'Penyedia' },
    { key: 'namaPemilik', label: 'Nama Pemilik' },
    { key: 'statusPemilik', label: 'Status Pemilik' },
    { key: 'alamatKantor', label: 'Alamat Kantor' },
    { key: 'noSpk', label: 'No SPK' },
    { key: 'tanggalMulai', label: 'Tgl Mulai' },
    { key: 'tanggalSelesai', label: 'Tgl Selesai' },
    { key: 'jangkaWaktu', label: 'Jangka Waktu' },
    { key: 'aksi', label: 'Aksi', required: true },
];

// ===== HELPER COMPONENTS =====
const Section = ({ title, icon, children }) => (
    <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '2px solid var(--bg-secondary)', paddingBottom: 8 }}>
            <span style={{ color: 'var(--accent-blue)' }}>{icon}</span>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <div>{children}</div>
    </div>
);

const formatDate = (dateString) => {
    if (!dateString) return '-';
    if (typeof dateString === 'string' && /[a-zA-Z]/.test(dateString)) return dateString;
    let date;
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const parts = dateString.split('-');
        date = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
        date = new Date(dateString);
    }
    if (isNaN(date)) return '-';
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const MatriksKegiatan = () => {
    // ===== SHARED STORE =====
    const { matrikData, addMatrik, updateMatrik, deleteMatrik, setMatrikData,
        configSumberDana, configJenisPengadaan, configMetodePemilihan, configSubKegiatan,
        addConfigItem, removeConfigItem, updateConfigItem, resetConfigList
    } = useMatrikStore();
    const { data: sekolahList } = useSekolahData();

    // Use store config (fallback to defaults)
    const sumberDanaList = configSumberDana || SUMBER_DANA;
    const jenisPengadaanList = configJenisPengadaan || JENIS_PENGADAAN;
    const metodePemilihanList = configMetodePemilihan || METODE_PEMILIHAN;
    const subKegiatanList = configSubKegiatan || [];

    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [visibleColumns, setVisibleColumns] = useState(['noMatrik', 'namaPaket', 'npsn', 'namaSekolah', 'nilaiKontrak', 'sumberDana', 'aksi']);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [formData, setFormData] = useState({});
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [shiftConfirm, setShiftConfirm] = useState(null);
    const [batchPreview, setBatchPreview] = useState(null);
    const [batchImporting, setBatchImporting] = useState(false);
    const [settingsTab, setSettingsTab] = useState('kolom');
    const [newConfigItem, setNewConfigItem] = useState('');
    const [newSubKode, setNewSubKode] = useState('');
    const [newSubNama, setNewSubNama] = useState('');
    const [newSubJenjang, setNewSubJenjang] = useState('SD');
    const fileInputRef = useRef(null);

    // ===== LOGIC =====
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return matrikData.filter(d =>
            d.namaPaket.toLowerCase().includes(q) ||
            String(d.noMatrik).toLowerCase().includes(q) ||
            String(d.npsn).includes(q) ||
            d.namaSekolah.toLowerCase().includes(q)
        );
    }, [matrikData, search]);

    const sortedData = useMemo(() => [...filtered].sort((a, b) => naturalSort(a.noMatrik, b.noMatrik)), [filtered]);
    const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
    const paginatedData = useMemo(() => sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [sortedData, currentPage, pageSize]);

    // ===== DRAFT HANDLING =====
    const saveDraft = (stateToSave) => {
        try {
            const payload = { formData: stateToSave.formData, editTargetId: stateToSave.editTarget ? stateToSave.editTarget.id : null };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        } catch (e) { console.error("Failed to save draft", e); }
    };

    const clearDraft = () => { localStorage.removeItem(DRAFT_KEY); };

    useEffect(() => { if (showModal) { saveDraft({ formData, editTarget }); } }, [formData, editTarget, showModal]);

    const handleExport = () => {
        if (sortedData.length === 0) { toast.error("Tidak ada data."); return; }
        const exportColumns = TABLE_COLUMNS.filter(c => c.key !== 'aksi');
        let tableHTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #000000; padding: 5px; text-align: left; vertical-align: top; } th { background-color: #f2f2f2; font-weight: bold; text-align: center; }</style></head><body><table><thead><tr>${exportColumns.map(col => `<th>${col.label}</th>`).join('')}</tr></thead><tbody>`;
        sortedData.forEach(row => {
            tableHTML += '<tr>';
            exportColumns.forEach(col => {
                let value = row[col.key];
                if (['paguAnggaran', 'paguPaket', 'hps', 'nilaiKontrak'].includes(col.key)) value = formatCurrency(value);
                else if (['tanggalMulai', 'tanggalSelesai'].includes(col.key)) value = formatDate(value);
                else if (value === null || value === undefined) value = '-';
                const safeValue = String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const alignStyle = col.key === 'noSpk' ? 'text-align: left;' : (['paguAnggaran', 'paguPaket', 'hps', 'nilaiKontrak', 'jangkaWaktu'].includes(col.key) ? 'text-align: right;' : 'text-align: left;');
                tableHTML += `<td style="${alignStyle}">${safeValue}</td>`;
            });
            tableHTML += '</tr>';
        });
        tableHTML += '</tbody></table></body></html>';
        const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Data_Matrik.xls`; link.click();
        toast.success("Ekspor berhasil!");
    };

    // ===== BATCH IMPORT =====
    const TEMPLATE_COLUMNS = [
        { header: 'No Matrik*', key: 'noMatrik' },
        { header: 'NPSN', key: 'npsn' },
        { header: 'Nama Paket Pekerjaan*', key: 'namaPaket' },
        { header: 'Sub Kegiatan', key: 'subKegiatan' },
        { header: 'RUP', key: 'rup' },
        { header: 'Pagu Anggaran', key: 'paguAnggaran' },
        { header: 'Pagu Paket', key: 'paguPaket' },
        { header: 'HPS', key: 'hps' },
        { header: 'Nilai Kontrak', key: 'nilaiKontrak' },
        { header: 'Sumber Dana', key: 'sumberDana' },
        { header: 'Metode Pemilihan', key: 'metode' },
        { header: 'Jenis Pengadaan', key: 'jenisPengadaan' },
        { header: 'Penyedia', key: 'penyedia' },
        { header: 'Nama Pemilik', key: 'namaPemilik' },
        { header: 'Status Pemilik', key: 'statusPemilik' },
        { header: 'Alamat Kantor', key: 'alamatKantor' },
        { header: 'Tanggal Mulai (YYYY-MM-DD)', key: 'tanggalMulai' },
        { header: 'Jangka Waktu (HK)', key: 'jangkaWaktu' },
        { header: 'Tahun Anggaran', key: 'tahunAnggaran' },
    ];

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const headers = TEMPLATE_COLUMNS.map(c => c.header);
        // Example row
        const example = ['1', '20301453', 'Pembangunan Ruang Kelas Baru', '', '', '150000000', '100000000', '90000000', '95000000', 'APBD', 'Tender', 'Pekerjaan Konstruksi', 'CV. Contoh', 'H. Budi', 'Direktur', 'Jl. Contoh No. 1', `${currentYear}-01-15`, '90', String(currentYear)];
        const ws = XLSX.utils.aoa_to_sheet([headers, example]);
        // Set column widths
        ws['!cols'] = TEMPLATE_COLUMNS.map((_, i) => ({ wch: i === 3 ? 35 : i === 4 ? 30 : 18 }));
        XLSX.utils.book_append_sheet(wb, ws, 'Template Matrik');
        XLSX.writeFile(wb, 'Template_Batch_Matrik.xlsx');
        toast.success('Template berhasil diunduh');
    };

    const handleBatchFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                if (rows.length === 0) { toast.error('File kosong atau format salah'); return; }
                // Map rows to our format
                const parsed = rows.map((row, idx) => {
                    const mapped = {};
                    TEMPLATE_COLUMNS.forEach(col => {
                        const val = row[col.header];
                        if (val !== undefined && val !== '') mapped[col.key] = val;
                    });
                    // Auto-fill defaults
                    mapped.noMatrik = String(mapped.noMatrik || '').replace(/\s/g, '');
                    mapped.namaSekolah = mapped.namaSekolah || '-';
                    mapped.subBidang = inferJenjang(mapped.subKegiatan || '');
                    if (mapped.subKegiatan) {
                        const parts = String(mapped.subKegiatan).split(' ');
                        mapped.noSubKegiatan = parts[0] || '';
                    }
                    // Numbers
                    ['paguAnggaran', 'paguPaket', 'hps', 'nilaiKontrak'].forEach(k => {
                        mapped[k] = mapped[k] ? parseInt(String(mapped[k]).replace(/\D/g, ''), 10) || null : null;
                    });
                    mapped.jangkaWaktu = mapped.jangkaWaktu ? parseInt(mapped.jangkaWaktu, 10) || '' : '';
                    mapped.tahunAnggaran = mapped.tahunAnggaran ? parseInt(mapped.tahunAnggaran, 10) || currentYear : currentYear;
                    mapped.terbilangKontrak = mapped.nilaiKontrak ? fullTerbilang(mapped.nilaiKontrak) : '-';
                    mapped.noSpk = generateNoSpk(mapped.noMatrik, mapped.jenisPengadaan, mapped.sumberDana, mapped.tahunAnggaran);
                    // Auto-fill sekolah
                    if (mapped.npsn) {
                        const found = sekolahList.find(s => String(s.npsn) === String(mapped.npsn));
                        if (found && mapped.namaSekolah === '-') mapped.namaSekolah = found.nama;
                    }
                    // tanggal selesai
                    if (mapped.tanggalMulai && mapped.jangkaWaktu) {
                        const parts = String(mapped.tanggalMulai).split('-');
                        if (parts.length === 3) {
                            const date = new Date(parts[0], parts[1] - 1, parts[2]);
                            date.setDate(date.getDate() + parseInt(mapped.jangkaWaktu) - 1);
                            mapped.tanggalSelesai = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        }
                    }
                    mapped._rowNum = idx + 2;
                    return mapped;
                }).filter(m => m.noMatrik && m.namaPaket); // only valid rows
                if (parsed.length === 0) { toast.error('Tidak ada data valid. Pastikan kolom No Matrik* dan Nama Paket Pekerjaan* terisi.'); return; }
                setBatchPreview(parsed);
            } catch (err) {
                toast.error('Gagal membaca file: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = ''; // reset
    };

    const executeBatchImport = () => {
        if (!batchPreview?.length) return;
        setBatchImporting(true);
        let added = 0;
        batchPreview.forEach(item => {
            const { _rowNum, ...data } = item;
            addMatrik(data);
            added++;
        });
        toast.success(`${added} data berhasil diimpor`);
        setBatchPreview(null);
        setBatchImporting(false);
    };

    // ===== FORM HANDLERS =====
    const getEmptyForm = () => ({
        noMatrik: '', npsn: '', namaSekolah: '-', subBidang: '-', noSubKegiatan: '', subKegiatan: '', rup: '', namaPaket: '',
        paguAnggaran: null, paguPaket: null, hps: null, nilaiKontrak: null, terbilangKontrak: '-',
        sumberDana: '', metode: '', jenisPengadaan: '',
        penyedia: '', namaPemilik: '', statusPemilik: '', alamatKantor: '',
        noSpk: '', tanggalMulai: '', tanggalSelesai: '', jangkaWaktu: '',
        tahunAnggaran: currentYear,
        noHp: '', konsultanPengawas: '', dirKonsultanPengawas: '',
        noMc0: '', tglMc0: '', noMc100: '', tglMc100: '',
        noPcm: '', tglPcm: '',
    });

    const resetForm = () => { setFormData(getEmptyForm()); setEditTarget(null); clearDraft(); };

    const handleOpenModal = (item = null) => {
        let loadedDraft = null;
        try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) loadedDraft = JSON.parse(raw); } catch (e) { /* ignore */ }
        if (item) {
            setEditTarget(item);
            if (loadedDraft && loadedDraft.editTargetId === item.id) { setFormData(loadedDraft.formData); toast.success("Draft edit berhasil dimuat"); }
            else { setFormData({ ...item }); }
        } else {
            setEditTarget(null);
            if (loadedDraft && !loadedDraft.editTargetId && loadedDraft.formData) { setFormData(loadedDraft.formData); toast.success("Draft sebelumnya berhasil dimuat"); }
            else { resetForm(); }
        }
        setShowModal(true);
    };

    const handleAddChild = (parent) => {
        const children = matrikData.filter(d => d.noMatrik.startsWith(parent.noMatrik + ","));
        let nextIndex = 1;
        if (children.length > 0) {
            const lastChildNo = children.reduce((max, child) => {
                const parts = child.noMatrik.split(','); const suffix = parseInt(parts[parts.length - 1]);
                return suffix > max ? suffix : max;
            }, 0);
            nextIndex = lastChildNo + 1;
        }
        const newNoMatrik = `${parent.noMatrik},${nextIndex}`;
        setEditTarget(null); clearDraft();
        setFormData({
            noMatrik: newNoMatrik, npsn: parent.npsn, namaSekolah: parent.namaSekolah,
            rup: parent.rup, subKegiatan: parent.subKegiatan, noSubKegiatan: parent.noSubKegiatan, subBidang: parent.subBidang, tahunAnggaran: parent.tahunAnggaran,
            sumberDana: parent.sumberDana, metode: parent.metode, jenisPengadaan: parent.jenisPengadaan,
            penyedia: parent.penyedia, namaPemilik: parent.namaPemilik, statusPemilik: parent.statusPemilik, alamatKantor: parent.alamatKantor,
            tanggalMulai: parent.tanggalMulai || '', tanggalSelesai: parent.tanggalSelesai || '', jangkaWaktu: parent.jangkaWaktu || '',
            noSpk: generateNoSpk(newNoMatrik, parent.jenisPengadaan, parent.sumberDana, parent.tahunAnggaran),
            namaPaket: '', paguAnggaran: null, paguPaket: null, hps: null, nilaiKontrak: null, terbilangKontrak: '-'
        });
        setShowModal(true);
    };

    const handleChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };

            if (['paguAnggaran', 'paguPaket', 'hps', 'nilaiKontrak'].includes(field)) {
                const num = parseFormattedNumber(value);
                updated[field] = num;
                if (field === 'nilaiKontrak') updated.terbilangKontrak = fullTerbilang(num);
            }

            if (field === 'npsn') {
                const cleanNpsn = String(value).trim();
                const foundSchool = sekolahList.find(s => String(s.npsn) === cleanNpsn);
                if (foundSchool) { updated.namaSekolah = foundSchool.nama; }
            }

            if (field === 'noMatrik') value = value.replace(/\s/g, '');
            if (['noMatrik', 'jenisPengadaan', 'sumberDana', 'tahunAnggaran'].includes(field)) {
                updated.noSpk = generateNoSpk(field === 'noMatrik' ? value : prev.noMatrik, field === 'jenisPengadaan' ? value : prev.jenisPengadaan, field === 'sumberDana' ? value : prev.sumberDana, field === 'tahunAnggaran' ? value : prev.tahunAnggaran);
            }

            if (field === 'subKegiatan') {
                const parts = value.split(' ');
                updated.noSubKegiatan = parts[0] || '';
                updated.subBidang = inferJenjang(value);
            }

            if (field === 'tanggalMulai' || field === 'jangkaWaktu') {
                const tgl = field === 'tanggalMulai' ? value : prev.tanggalMulai;
                const hari = field === 'jangkaWaktu' ? value : prev.jangkaWaktu;
                if (tgl && hari) {
                    const numHari = parseInt(hari);
                    if (!isNaN(numHari) && numHari > 0) {
                        const parts = tgl.split('-');
                        if (parts.length === 3) {
                            const date = new Date(parts[0], parts[1] - 1, parts[2]);
                            date.setDate(date.getDate() + numHari - 1);
                            updated.tanggalSelesai = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        }
                    }
                }
            }
            return updated;
        });
    };

    // ===== LOGIC GESER & SIMPAN =====
    const checkMatrikExists = (noMatrik, excludeId) => matrikData.some(d => d.noMatrik === noMatrik && d.id !== excludeId);

    const handleSave = () => {
        if (!formData.namaPaket) { toast.error("Nama Paket wajib diisi"); return; }
        if (!formData.noMatrik) { toast.error("No Matrik wajib diisi"); return; }
        const exists = checkMatrikExists(formData.noMatrik, editTarget?.id);
        if (exists) { setShiftConfirm({ formData, editTarget }); }
        else { executeSave(formData, editTarget); }
    };

    const executeSave = (dataToSave, target) => {
        if (target) {
            updateMatrik(target.id, dataToSave);
            toast.success("Data diperbarui");
        } else {
            addMatrik(dataToSave);
            toast.success("Data ditambahkan");
        }
        setShowModal(false); setShiftConfirm(null); clearDraft();
    };

    const executeShiftAndSave = () => {
        const { formData: newFormData, editTarget: target } = shiftConfirm;
        // Build new array with shift logic
        let currentData = target ? matrikData.filter(d => d.id !== target.id) : [...matrikData];
        const targetMatrik = newFormData.noMatrik;
        const parts = targetMatrik.split(',').map(Number);
        const depth = parts.length - 1;
        const targetVal = parts[depth];
        const shiftedData = currentData.map(item => {
            const itemParts = String(item.noMatrik).split(',').map(Number);
            if (itemParts.length > depth) {
                let isSameLineage = true;
                for (let i = 0; i < depth; i++) { if (itemParts[i] !== parts[i]) { isSameLineage = false; break; } }
                if (isSameLineage && itemParts[depth] >= targetVal) {
                    itemParts[depth]++;
                    const newMatrik = itemParts.join(',');
                    const newSpk = generateNoSpk(newMatrik, item.jenisPengadaan, item.sumberDana, item.tahunAnggaran);
                    return { ...item, noMatrik: newMatrik, noSpk: newSpk };
                }
            }
            return item;
        });
        shiftedData.push({ id: target ? target.id : Date.now(), ...newFormData });
        setMatrikData(shiftedData.sort((a, b) => naturalSort(a.noMatrik, b.noMatrik)));
        toast.success("Data disimpan & struktur diperbarui");
        setShowModal(false); setShiftConfirm(null); clearDraft();
    };

    const executeDelete = () => {
        if (deleteTarget) {
            deleteMatrik(deleteTarget.id);
            toast.success("Data dihapus");
            setDeleteTarget(null);
        }
    };

    const toggleColumn = (key) => { setVisibleColumns(prev => prev.includes(key) ? (TABLE_COLUMNS.find(c => c.key === key)?.required ? prev : prev.filter(k => k !== key)) : [...prev, key]); };

    const activeCols = TABLE_COLUMNS.filter(c => visibleColumns.includes(c.key));

    // ===== TAB STATE =====
    const [activeTab, setActiveTab] = useState('matrik'); // 'matrik' | 'spl'

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left"><h1>Matriks Kegiatan</h1><p>Manajemen Paket Pekerjaan</p></div>
                <div className="page-header-right">
                    {activeTab === 'matrik' && <>
                        <button className="btn btn-secondary" onClick={() => setShowSettings(true)}><Settings size={16} /> Pengaturan</button>
                        <button className="btn btn-primary" onClick={() => handleOpenModal()}><Plus size={16} /> Tambah Paket</button>
                    </>}
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border-color)' }}>
                {[{ key: 'matrik', label: 'Matriks Kegiatan' }, { key: 'spl', label: 'SPL Isian' }].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                        padding: '10px 24px', border: 'none', background: 'transparent', cursor: 'pointer',
                        color: activeTab === tab.key ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        fontWeight: activeTab === tab.key ? 600 : 400, fontSize: '0.9rem',
                        borderBottom: activeTab === tab.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
                        marginBottom: -2, transition: 'all 0.2s',
                    }}>{tab.label}</button>
                ))}
            </div>

            {activeTab === 'matrik' && (<>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search"><Search size={16} className="search-icon" /><input placeholder="Cari matrik/paket/sekolah..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                <option value="10">10</option><option value="15">15</option><option value="50">50</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-toolbar-right" style={{ display: 'flex', gap: 8 }}>
                        <input type="file" ref={fileInputRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleBatchFile} />
                        <button className="btn btn-ghost btn-sm" onClick={handleDownloadTemplate} title="Download template Excel"><FileDown size={14} /> Template</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} title="Import batch dari Excel"><Upload size={14} /> Import Batch</button>
                        <button className="btn btn-secondary btn-sm" onClick={handleExport}><FileSpreadsheet size={14} /> Ekspor</button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead><tr>{activeCols.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead>
                        <tbody>
                            {paginatedData.map((d) => (
                                <tr key={d.id}>
                                    {activeCols.map(col => {
                                        switch (col.key) {
                                            case 'noMatrik': return <td key={col.key} style={{ fontWeight: 600, fontFamily: 'monospace' }}>{d.noMatrik}</td>;
                                            case 'npsn': return <td key={col.key} style={{ fontFamily: 'monospace' }}>{d.npsn}</td>;
                                            case 'namaSekolah': return <td key={col.key}>{d.namaSekolah}</td>;
                                            case 'paguAnggaran': case 'paguPaket': case 'hps': case 'nilaiKontrak': return <td key={col.key} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(d[col.key])}</td>;
                                            case 'tanggalMulai': case 'tanggalSelesai': return <td key={col.key}>{formatDate(d[col.key])}</td>;
                                            case 'terbilangKontrak': return <td key={col.key} style={{ fontSize: '0.75rem', fontStyle: 'italic' }} title={d.terbilangKontrak}>{d.terbilangKontrak}</td>;
                                            case 'noSpk': return <td key={col.key} style={{ textAlign: 'left', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{d.noSpk}</td>;
                                            case 'aksi': return (
                                                <td key={col.key}><div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn-icon" onClick={() => handleAddChild(d)} title={`Tambah Anakan dari ${d.noMatrik}`} style={{ color: 'var(--accent-green)' }}><PlusCircle size={16} /></button>
                                                    <button className="btn-icon" onClick={() => handleOpenModal(d)} title="Edit"><Edit size={16} /></button>
                                                    <button className="btn-icon" style={{ color: 'var(--accent-red)' }} onClick={() => setDeleteTarget(d)} title="Hapus"><Trash2 size={16} /></button>
                                                </div></td>
                                            );
                                            default: return <td key={col.key}>{d[col.key] || '-'}</td>;
                                        }
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="table-pagination">
                    <div className="table-pagination-info">Menampilkan {sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, sortedData.length)} dari {sortedData.length}</div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            {/* ===== MODAL FORM ===== */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 1100 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{editTarget ? 'Edit Paket' : 'Tambah Paket Baru'}</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '85vh', overflowY: 'auto', padding: '24px 32px' }}>
                            <div style={{ marginBottom: 24, display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                    <label className="form-label" style={{ fontSize: 12, textTransform: 'uppercase' }}>Nomor Matrik *</label>
                                    <input className="form-input" type="text" placeholder="Contoh: 1 atau 1,1" value={formData.noMatrik} onChange={e => handleChange('noMatrik', e.target.value)} style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-blue)', height: 50 }} />
                                </div>
                            </div>

                            <Section title="IDENTITAS PAKET" icon={<Briefcase size={16} />}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>NPSN (Opsional)</label>
                                        <input className="form-input" placeholder="Ketik/Paste NPSN" value={formData.npsn || ''} onChange={e => handleChange('npsn', e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ flex: 2 }}>
                                        <label>Nama Sekolah</label>
                                        <input className="form-input" placeholder="Otomatis terisi jika NPSN valid" value={formData.namaSekolah || ''} onChange={e => handleChange('namaSekolah', e.target.value)} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Sub Kegiatan</label><SearchableSelect options={subKegiatanList.map(s => `${s.kode} ${s.nama}`)} value={formData.subKegiatan} onChange={(val) => handleChange('subKegiatan', val)} placeholder="Pilih Sub Kegiatan" /></div>
                                    <div className="form-group"><label>No Sub Kegiatan</label><input className="form-input" value={formData.noSubKegiatan || '-'} disabled style={{ background: 'var(--bg-secondary)' }} /></div>
                                    <div className="form-group"><label>Sub Bidang</label><input className="form-input" value={formData.subBidang || '-'} disabled style={{ background: 'var(--bg-secondary)' }} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>RUP</label><input className="form-input" value={formData.rup || ''} onChange={e => handleChange('rup', e.target.value)} /></div>
                                    <div className="form-group" style={{ flex: 2 }}><label>Nama Paket Pekerjaan *</label><input className="form-input" value={formData.namaPaket || ''} onChange={e => handleChange('namaPaket', e.target.value)} /></div>
                                </div>
                            </Section>

                            <div style={{ borderBottom: '1px dashed var(--border-color)', margin: '16px 0' }}></div>

                            <Section title="KEUANGAN" icon={<DollarSign size={16} />}>
                                <div className="form-row">
                                    <div className="form-group"><label>Pagu Anggaran</label><input className="form-input" type="text" value={formatNumberInput(formData.paguAnggaran)} onChange={e => handleChange('paguAnggaran', e.target.value)} /></div>
                                    <div className="form-group"><label>Pagu Paket</label><input className="form-input" type="text" value={formatNumberInput(formData.paguPaket)} onChange={e => handleChange('paguPaket', e.target.value)} /></div>
                                    <div className="form-group"><label>HPS</label><input className="form-input" type="text" value={formatNumberInput(formData.hps)} onChange={e => handleChange('hps', e.target.value)} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Nilai Kontrak</label><input className="form-input" type="text" value={formatNumberInput(formData.nilaiKontrak)} onChange={e => handleChange('nilaiKontrak', e.target.value)} /></div>
                                    <div className="form-group" style={{ flex: 2 }}><label>Terbilang Kontrak</label><input className="form-input" value={formData.terbilangKontrak || '-'} disabled style={{ fontStyle: 'italic', fontSize: '0.85rem', background: 'var(--bg-secondary)' }} /></div>
                                </div>
                            </Section>

                            <div style={{ borderBottom: '1px dashed var(--border-color)', margin: '16px 0' }}></div>

                            <Section title="PENGADAAN & PENYEDIA" icon={<Truck size={16} />}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Sumber Dana</label>
                                        <select className="form-select" value={formData.sumberDana || ''} onChange={e => handleChange('sumberDana', e.target.value)}>
                                            <option value="">Pilih</option>
                                            {sumberDanaList.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Metode Pemilihan</label>
                                        <select className="form-select" value={formData.metode || ''} onChange={e => handleChange('metode', e.target.value)}>
                                            <option value="">Pilih</option>
                                            {metodePemilihanList.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Jenis Pengadaan</label>
                                        <select className="form-select" value={formData.jenisPengadaan || ''} onChange={e => handleChange('jenisPengadaan', e.target.value)}>
                                            <option value="">Pilih</option>
                                            {jenisPengadaanList.map(j => <option key={j} value={j}>{j}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Penyedia</label><input className="form-input" value={formData.penyedia || ''} onChange={e => handleChange('penyedia', e.target.value)} /></div>
                                    <div className="form-group"><label>Nama Pemilik</label><input className="form-input" value={formData.namaPemilik || ''} onChange={e => handleChange('namaPemilik', e.target.value)} /></div>
                                    <div className="form-group">
                                        <label>Status Pemilik</label>
                                        <input list="status-pemilik-list" className="form-input" value={formData.statusPemilik || ''} onChange={e => handleChange('statusPemilik', e.target.value)} placeholder="Pilih/Ketik..." />
                                        <datalist id="status-pemilik-list">{STATUS_PEMILIK.map(s => <option key={s} value={s} />)}</datalist>
                                    </div>
                                </div>
                                <div className="form-group"><label>Alamat Kantor</label><input className="form-input" value={formData.alamatKantor || ''} onChange={e => handleChange('alamatKantor', e.target.value)} /></div>
                            </Section>

                            <div style={{ borderBottom: '1px dashed var(--border-color)', margin: '16px 0' }}></div>

                            <Section title="WAKTU PELAKSANAAN" icon={<Calendar size={16} />}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Tahun Anggaran</label>
                                        <select className="form-select" value={formData.tahunAnggaran || ''} onChange={e => handleChange('tahunAnggaran', e.target.value)}>
                                            {TAHUN_ANGGARAN.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group"><label>No SPK (Otomatis)</label><input className="form-input" value={formData.noSpk || '-'} disabled style={{ background: 'var(--bg-secondary)', fontFamily: 'monospace', letterSpacing: '0.5px', textAlign: 'right' }} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Tanggal Mulai</label><input className="form-input" type="date" value={formData.tanggalMulai || ''} onChange={e => handleChange('tanggalMulai', e.target.value)} /></div>
                                    <div className="form-group"><label>Jangka Waktu (HK)</label><input className="form-input" type="number" value={formData.jangkaWaktu || ''} onChange={e => handleChange('jangkaWaktu', e.target.value)} /></div>
                                    <div className="form-group"><label>Tanggal Selesai</label><input className="form-input" type="date" value={formData.tanggalSelesai || ''} disabled style={{ background: 'var(--bg-secondary)' }} /></div>
                                </div>
                            </Section>

                            <div style={{ borderBottom: '1px dashed var(--border-color)', margin: '16px 0' }}></div>

                            <Section title="DATA SPL / MC / PCM" icon={<Phone size={16} />}>
                                <div className="form-group"><label>No HP Penyedia</label><input className="form-input" value={formData.noHp || ''} onChange={e => handleChange('noHp', e.target.value)} placeholder="Contoh: 08123456789" /></div>
                                <div className="form-row">
                                    <div className="form-group"><label>Konsultan Pengawas</label><input className="form-input" value={formData.konsultanPengawas || ''} onChange={e => handleChange('konsultanPengawas', e.target.value)} /></div>
                                    <div className="form-group"><label>Direktur Konsultan Pengawas</label><input className="form-input" value={formData.dirKonsultanPengawas || ''} onChange={e => handleChange('dirKonsultanPengawas', e.target.value)} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>No MC 0%</label><input className="form-input" value={formData.noMc0 || ''} onChange={e => handleChange('noMc0', e.target.value)} /></div>
                                    <div className="form-group"><label>Tanggal MC 0%</label><input className="form-input" type="date" value={formData.tglMc0 || ''} onChange={e => handleChange('tglMc0', e.target.value)} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>No MC 100%</label><input className="form-input" value={formData.noMc100 || ''} onChange={e => handleChange('noMc100', e.target.value)} /></div>
                                    <div className="form-group"><label>Tanggal MC 100%</label><input className="form-input" type="date" value={formData.tglMc100 || ''} onChange={e => handleChange('tglMc100', e.target.value)} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>No PCM</label><input className="form-input" value={formData.noPcm || ''} onChange={e => handleChange('noPcm', e.target.value)} /></div>
                                    <div className="form-group"><label>Tanggal PCM</label><input className="form-input" type="date" value={formData.tglPcm || ''} onChange={e => handleChange('tglPcm', e.target.value)} /></div>
                                </div>
                            </Section>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={resetForm} title="Hapus draft & kosongkan form"><RefreshCw size={14} /> Reset</button>
                            <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL KONFIRMASI GESER */}
            {shiftConfirm && (
                <div className="modal-overlay" onClick={() => setShiftConfirm(null)}>
                    <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            <AlertCircle size={48} style={{ color: 'var(--accent-orange)', marginBottom: 16 }} />
                            <h3>Nomor Matrik Sudah Ada</h3>
                            <p style={{ marginBottom: 24, color: 'var(--text-secondary)' }}>No Matrik <strong>"{shiftConfirm.formData.noMatrik}"</strong> sudah digunakan. Geser data yang ada?</p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                                <button className="btn btn-ghost" onClick={() => setShiftConfirm(null)}>Batal</button>
                                <button className="btn btn-primary" style={{ background: 'var(--accent-orange', borderColor: 'var(--accent-orange' }} onClick={executeShiftAndSave}><ChevronRight size={16} style={{ marginRight: 4 }} /> Ya, Geser & Simpan</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PENGATURAN */}
            {showSettings && (
                <div className="modal-overlay" onClick={() => setShowSettings(false)}>
                    <div className="modal" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">Pengaturan</div><button className="modal-close" onClick={() => setShowSettings(false)}><X size={18} /></button></div>
                        <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                            {/* Tabs */}
                            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border-color)', flexWrap: 'wrap' }}>
                                {[{ key: 'kolom', label: 'Kolom' }, { key: 'metode', label: 'Metode Pemilihan' }, { key: 'jenis', label: 'Jenis Pengadaan' }, { key: 'sumber', label: 'Sumber Dana' }, { key: 'subkeg', label: 'Sub Kegiatan' }].map(tab => (
                                    <button key={tab.key} onClick={() => setSettingsTab(tab.key)} style={{
                                        padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                                        color: settingsTab === tab.key ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                        fontWeight: settingsTab === tab.key ? 600 : 400, fontSize: '0.82rem',
                                        borderBottom: settingsTab === tab.key ? '2px solid var(--accent-blue)' : '2px solid transparent', marginBottom: -2,
                                    }}>{tab.label}</button>
                                ))}
                            </div>

                            {/* Tab: Kolom */}
                            {settingsTab === 'kolom' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                                    {TABLE_COLUMNS.map(col => (
                                        <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, background: 'var(--bg-secondary)', borderRadius: 4, cursor: col.required ? 'not-allowed' : 'pointer', opacity: col.required ? 0.7 : 1, fontSize: '0.75rem' }}>
                                            <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => toggleColumn(col.key)} disabled={col.required} style={{ accentColor: 'var(--accent-blue)' }} />
                                            <span>{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {/* Tab: Simple list config (Metode, Jenis, Sumber) */}
                            {['metode', 'jenis', 'sumber'].includes(settingsTab) && (() => {
                                const configMap = { metode: 'configMetodePemilihan', jenis: 'configJenisPengadaan', sumber: 'configSumberDana' };
                                const labelMap = { metode: 'Metode Pemilihan', jenis: 'Jenis Pengadaan', sumber: 'Sumber Dana' };
                                const listName = configMap[settingsTab];
                                const items = settingsTab === 'metode' ? metodePemilihanList : settingsTab === 'jenis' ? jenisPengadaanList : sumberDanaList;
                                return (
                                    <div>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                            <input className="form-input" placeholder={`Tambah ${labelMap[settingsTab]}...`}
                                                value={newConfigItem} onChange={e => setNewConfigItem(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && newConfigItem.trim()) { addConfigItem(listName, newConfigItem.trim()); setNewConfigItem(''); toast.success('Ditambahkan'); } }}
                                                style={{ flex: 1 }} />
                                            <button className="btn btn-primary btn-sm" disabled={!newConfigItem.trim()}
                                                onClick={() => { if (newConfigItem.trim()) { addConfigItem(listName, newConfigItem.trim()); setNewConfigItem(''); toast.success('Ditambahkan'); } }}>
                                                <Plus size={14} /> Tambah
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => { resetConfigList(listName); toast.success('Direset ke default'); }} title="Reset ke default">
                                                <RefreshCw size={14} />
                                            </button>
                                        </div>
                                        <table className="data-table" style={{ fontSize: '0.8rem' }}>
                                            <thead><tr><th style={{ width: 40 }}>No</th><th>Nama</th><th style={{ width: 60 }}>Aksi</th></tr></thead>
                                            <tbody>
                                                {items.map((item, i) => (
                                                    <tr key={i}>
                                                        <td>{i + 1}</td>
                                                        <td>{item}</td>
                                                        <td>
                                                            <button className="btn-icon" style={{ color: 'var(--accent-red)' }}
                                                                onClick={() => { removeConfigItem(listName, i); toast.success('Dihapus'); }} title="Hapus">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {items.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>Belum ada data</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}

                            {/* Tab: Sub Kegiatan */}
                            {settingsTab === 'subkeg' && (
                                <div>
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <input className="form-input" placeholder="No Sub Kegiatan" value={newSubKode}
                                            onChange={e => setNewSubKode(e.target.value)} style={{ width: 180 }} />
                                        <input className="form-input" placeholder="Nama Sub Kegiatan" value={newSubNama}
                                            onChange={e => setNewSubNama(e.target.value)} style={{ flex: 1 }} />
                                        <select className="form-select" value={newSubJenjang} onChange={e => setNewSubJenjang(e.target.value)} style={{ width: 80, padding: '6px 8px' }}>
                                            <option value="SD">SD</option>
                                            <option value="SMP">SMP</option>
                                        </select>
                                        <button className="btn btn-primary btn-sm" disabled={!newSubKode.trim() || !newSubNama.trim()}
                                            onClick={() => {
                                                addConfigItem('configSubKegiatan', { kode: newSubKode.trim(), nama: newSubNama.trim(), jenjang: newSubJenjang });
                                                setNewSubKode(''); setNewSubNama(''); toast.success('Ditambahkan');
                                            }}>
                                            <Plus size={14} /> Tambah
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => { resetConfigList('configSubKegiatan'); toast.success('Direset ke default'); }} title="Reset ke default">
                                            <RefreshCw size={14} />
                                        </button>
                                    </div>
                                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                                        <thead><tr><th style={{ width: 40 }}>No</th><th style={{ width: 180 }}>Kode</th><th>Nama</th><th style={{ width: 70 }}>Jenjang</th><th style={{ width: 60 }}>Aksi</th></tr></thead>
                                        <tbody>
                                            {subKegiatanList.map((item, i) => (
                                                <tr key={i}>
                                                    <td>{i + 1}</td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{item.kode}</td>
                                                    <td>{item.nama}</td>
                                                    <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: item.jenjang === 'SD' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)', color: item.jenjang === 'SD' ? 'var(--accent-blue)' : 'var(--accent-green)' }}>{item.jenjang || '-'}</span></td>
                                                    <td>
                                                        <button className="btn-icon" style={{ color: 'var(--accent-red)' }}
                                                            onClick={() => { removeConfigItem('configSubKegiatan', i); toast.success('Dihapus'); }} title="Hapus">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {subKegiatanList.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>Belum ada data</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL HAPUS */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            <AlertTriangle size={48} style={{ color: 'var(--accent-red)', marginBottom: 16 }} />
                            <h3>Hapus Paket?</h3>
                            <p style={{ marginBottom: 24, color: 'var(--text-secondary)' }}>Data <strong>{deleteTarget.namaPaket}</strong> akan dihapus permanen.</p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                                <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Batal</button>
                                <button className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }} onClick={executeDelete}>Hapus</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL BATCH IMPORT PREVIEW */}
            {batchPreview && (
                <div className="modal-overlay" onClick={() => setBatchPreview(null)}>
                    <div className="modal" style={{ maxWidth: 950 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Preview Import Batch — {batchPreview.length} data</div>
                            <button className="modal-close" onClick={() => setBatchPreview(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px 24px' }}>
                            <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Info size={14} /> Periksa data di bawah sebelum mengimpor. Kolom <b>No SPK</b> dan <b>Terbilang</b> otomatis diisi.
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table" style={{ fontSize: '0.75rem' }}>
                                    <thead><tr>
                                        <th style={{ width: 30 }}>#</th>
                                        <th>No Matrik</th>
                                        <th>NPSN</th>
                                        <th>Nama Sekolah</th>
                                        <th>Nama Paket</th>
                                        <th>Nilai Kontrak</th>
                                        <th>Sumber Dana</th>
                                        <th>Jenis Pengadaan</th>
                                        <th>No SPK</th>
                                    </tr></thead>
                                    <tbody>
                                        {batchPreview.map((item, i) => (
                                            <tr key={i}>
                                                <td>{i + 1}</td>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.noMatrik}</td>
                                                <td>{item.npsn || '-'}</td>
                                                <td>{item.namaSekolah || '-'}</td>
                                                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.namaPaket}</td>
                                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(item.nilaiKontrak)}</td>
                                                <td>{item.sumberDana || '-'}</td>
                                                <td>{item.jenisPengadaan || '-'}</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{item.noSpk || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setBatchPreview(null)}>Batal</button>
                            <button className="btn btn-primary" onClick={executeBatchImport} disabled={batchImporting}>
                                <Upload size={14} /> {batchImporting ? 'Mengimpor...' : `Import ${batchPreview.length} Data`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CLOSE MATRIK TAB */}
            </>)}

            {/* ===== SPL ISIAN TAB ===== */}
            {activeTab === 'spl' && <SplTab />}
        </div>
    );
};

// ===== SPL TAB COMPONENT =====
const SplTab = () => {
    const [splData, setSplData] = useState([]);
    const [splLoading, setSplLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [splSearch, setSplSearch] = useState('');
    const [showGuide, setShowGuide] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [verifikators, setVerifikators] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedVerifikator, setSelectedVerifikator] = useState(null);
    const [splHistory, setSplHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [showColMenu, setShowColMenu] = useState(false);

    const loadSpl = useCallback(async () => {
        setSplLoading(true);
        try {
            const data = await matrikApi.listSpl();
            setSplData(data);
        } catch (e) { toast.error('Gagal memuat data SPL'); }
        finally { setSplLoading(false); }
    }, []);

    useEffect(() => { loadSpl(); }, [loadSpl]);

    const loadTemplates = async () => {
        try { const t = await templateApi.list(); setTemplates(t); } catch { }
    };
    const loadVerifikators = async () => {
        try { const v = await matrikApi.splVerifikator(); setVerifikators(v); } catch { }
    };
    const loadHistory = async () => {
        try { const h = await matrikApi.splHistory(); setSplHistory(h); } catch { }
    };

    const filteredSpl = useMemo(() => {
        const q = splSearch.toLowerCase();
        return splData.filter(d =>
            d.namaSekolah?.toLowerCase().includes(q) ||
            d.npsn?.includes(q) ||
            d.namaPaket?.toLowerCase().includes(q) ||
            d.noMatrik?.includes(q)
        );
    }, [splData, splSearch]);

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };
    const toggleAll = () => {
        if (selectedIds.size === filteredSpl.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredSpl.map(d => d.id)));
    };

    const handleOpenGenerate = async () => {
        if (selectedIds.size === 0) { toast.error('Pilih minimal 1 matrik'); return; }
        await Promise.all([loadTemplates(), loadVerifikators()]);
        setShowGenerateModal(true);
    };

    const handleGenerate = async () => {
        if (!selectedTemplate) { toast.error('Pilih template'); return; }
        setGenerating(true);
        try {
            const selected = filteredSpl.filter(d => selectedIds.has(d.id));
            for (const item of selected) {
                const verif = verifikators.find(v => v.id === selectedVerifikator);
                await matrikApi.createSplHistory({
                    matrikId: item.id,
                    templateId: selectedTemplate,
                    namaFile: `SPL_${item.noMatrik}_${item.namaSekolah || 'dokumen'}.docx`,
                });
            }
            toast.success(`${selected.length} SPL berhasil di-generate`);
            setShowGenerateModal(false);
            setSelectedIds(new Set());
        } catch (e) { toast.error('Gagal generate SPL'); }
        finally { setGenerating(false); }
    };

    const handleOpenHistory = async () => {
        await loadHistory();
        setShowHistory(true);
    };

    const handleDeleteHistory = async (id) => {
        try {
            await matrikApi.deleteSplHistory(id);
            toast.success('Riwayat dihapus');
            loadHistory();
        } catch { toast.error('Gagal menghapus'); }
    };

    const fmtDate = (d) => {
        if (!d) return '-';
        const dt = new Date(d);
        if (isNaN(dt)) return d;
        return `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()}`;
    };

    const SPL_COLS = [
        { key: 'npsn', label: 'NPSN' },
        { key: 'namaSekolah', label: 'Nama Sekolah' },
        { key: 'namaPaket', label: 'Nama Paket Pekerjaan' },
        { key: 'nilaiKontrak', label: 'Nilai Kontrak', fmt: v => formatCurrency(v) },
        { key: 'jangkaWaktu', label: 'Jangka Waktu', fmt: v => v ? `${v} HK` : '-' },
        { key: 'noSpk', label: 'Nomor Kontrak' },
        { key: 'penyedia', label: 'Penyedia' },
        { key: 'namaPemilik', label: 'Direktur' },
        { key: 'noHp', label: 'No HP' },
        { key: 'alamatKantor', label: 'Alamat Penyedia' },
        { key: 'kepsek', label: 'Nama KS' },
        { key: 'nipKs', label: 'NIP KS' },
        { key: 'kopSekolah', label: 'Kop Sekolah', fmt: v => v ? '✅ Ada' : '❌ Belum' },
        { key: 'konsultanPengawas', label: 'Konsultan Pengawas', defaultHidden: true },
        { key: 'dirKonsultanPengawas', label: 'Dir. Konsultan', defaultHidden: true },
        { key: 'noMc0', label: 'No MC 0', defaultHidden: true },
        { key: 'tglMc0', label: 'Tgl MC 0', fmt: fmtDate, defaultHidden: true },
        { key: 'noMc100', label: 'No MC 100', defaultHidden: true },
        { key: 'tglMc100', label: 'Tgl MC 100', fmt: fmtDate, defaultHidden: true },
        { key: 'noPcm', label: 'No PCM', defaultHidden: true },
        { key: 'tglPcm', label: 'Tgl PCM', fmt: fmtDate, defaultHidden: true },
    ];

    const [visibleSplCols, setVisibleSplCols] = useState(() => {
        const cols = {};
        SPL_COLS.forEach(c => { cols[c.key] = !c.defaultHidden; });
        return cols;
    });
    const toggleSplCol = (key) => setVisibleSplCols(prev => ({ ...prev, [key]: !prev[key] }));
    const isSplColVisible = (key) => visibleSplCols[key] !== false;
    const activeSplCols = SPL_COLS.filter(c => isSplColVisible(c.key));

    return (
        <>
            {/* GUIDE */}
            <div style={{ marginBottom: 16 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowGuide(!showGuide)} style={{ gap: 6 }}>
                    <Info size={14} /> Petunjuk Pengambilan Data SPL
                </button>
                {showGuide && (
                    <div style={{ marginTop: 8, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.85rem', lineHeight: 1.8 }}>
                        <strong>📋 Petunjuk Pengambilan Data SPL:</strong>
                        <ol style={{ marginTop: 8, paddingLeft: 20 }}>
                            <li>Data diambil otomatis dari <b>Matriks Kegiatan</b> (tab pertama).</li>
                            <li><b>Nama KS</b> dan <b>NIP KS</b> diambil dari data Sekolah berdasarkan NPSN.</li>
                            <li><b>Nama Sekretaris</b> dan <b>NIP Sekretaris</b> dipilih dari akun Verifikator saat generate.</li>
                            <li>Untuk field <b>No HP, Konsultan Pengawas, MC 0/100, PCM</b> — isi melalui form Edit di tab Matriks Kegiatan (bagian "Data SPL/MC/PCM").</li>
                            <li>Matrik yang memiliki <b>anakan</b>: saat generate, data anakan otomatis diikutkan bersama matrik induknya.</li>
                            <li>Centang baris yang ingin di-generate, lalu klik tombol <b>"Generate SPL"</b>.</li>
                        </ol>
                    </div>
                )}
            </div>

            {/* TOOLBAR */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search"><Search size={16} className="search-icon" /><input placeholder="Cari NPSN, sekolah, paket..." value={splSearch} onChange={e => setSplSearch(e.target.value)} /></div>
                        {selectedIds.size > 0 && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: 600 }}>{selectedIds.size} dipilih</span>
                        )}
                    </div>
                    <div className="table-toolbar-right" style={{ gap: 8 }}>
                        {/* Column Visibility Toggle */}
                        <div style={{ position: 'relative' }}>
                            <button className="btn btn-ghost btn-sm" onClick={(e) => {
                                if (showColMenu) { setShowColMenu(false); return; }
                                setShowColMenu(true);
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTimeout(() => {
                                    const dd = document.getElementById('spl-col-menu');
                                    if (dd) { dd.style.top = `${rect.bottom + 4}px`; dd.style.right = `${window.innerWidth - rect.right}px`; }
                                }, 0);
                            }}>
                                <Columns size={14} /> Kolom
                            </button>
                            {showColMenu && (
                                <div id="spl-col-menu" style={{
                                    position: 'fixed', zIndex: 9999,
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                    borderRadius: 10, padding: '8px 0', minWidth: 200,
                                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                                    maxHeight: '60vh', overflowY: 'auto'
                                }}>
                                    <div style={{ padding: '4px 14px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tampilkan Kolom</div>
                                    {SPL_COLS.map(col => (
                                        <label key={col.key} style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '6px 14px', cursor: 'pointer', fontSize: 13,
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <input type="checkbox" checked={isSplColVisible(col.key)} onChange={() => toggleSplCol(col.key)}
                                                style={{ width: 15, height: 15, accentColor: 'var(--accent-blue)', cursor: 'pointer' }} />
                                            <span>{col.label}</span>
                                            {col.defaultHidden && <span style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>hidden</span>}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={handleOpenHistory}><Clock size={14} /> Riwayat</button>
                        <button className="btn btn-primary btn-sm" onClick={handleOpenGenerate} disabled={selectedIds.size === 0}>
                            <Printer size={14} /> Generate SPL ({selectedIds.size})
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <button onClick={toggleAll} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex' }}>
                                        {selectedIds.size === filteredSpl.length && filteredSpl.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                </th>
                                <th>No</th>
                                {activeSplCols.map(c => <th key={c.key} style={{ whiteSpace: 'nowrap' }}>{c.label}</th>)}
                                <th>Anak</th>
                            </tr>
                        </thead>
                        <tbody>
                            {splLoading ? (
                                <tr><td colSpan={activeSplCols.length + 3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Memuat data...</td></tr>
                            ) : filteredSpl.length === 0 ? (
                                <tr><td colSpan={activeSplCols.length + 3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Tidak ada data</td></tr>
                            ) : filteredSpl.map((d, i) => (
                                <tr key={d.id} style={{ background: selectedIds.has(d.id) ? 'rgba(59,130,246,0.08)' : undefined }}>
                                    <td>
                                        <button onClick={() => toggleSelect(d.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex' }}>
                                            {selectedIds.has(d.id) ? <CheckSquare size={16} style={{ color: 'var(--accent-blue)' }} /> : <Square size={16} />}
                                        </button>
                                    </td>
                                    <td>{i + 1}</td>
                                    {activeSplCols.map(c => (
                                        <td key={c.key} style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                                            {c.fmt ? c.fmt(d[c.key]) : (d[c.key] || '-')}
                                        </td>
                                    ))}
                                    <td>
                                        {d.children?.length > 0 ? (
                                            <span className="badge badge-disetujui" style={{ fontSize: 11 }}>{d.children.length} anakan</span>
                                        ) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="table-pagination">
                    <div className="table-pagination-info">Total {filteredSpl.length} data (induk)</div>
                </div>
            </div>

            {/* GENERATE MODAL */}
            {showGenerateModal && (
                <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Generate SPL</div>
                            <button className="modal-close" onClick={() => setShowGenerateModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {selectedIds.size} matrik dipilih. Matrik yang memiliki anakan akan diikutkan otomatis.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Pilih Template</label>
                                <select className="form-select" value={selectedTemplate || ''} onChange={e => setSelectedTemplate(Number(e.target.value) || null)}>
                                    <option value="">-- Pilih Template --</option>
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Sekretaris (Verifikator)</label>
                                <select className="form-select" value={selectedVerifikator || ''} onChange={e => setSelectedVerifikator(e.target.value || null)}>
                                    <option value="">-- Pilih Sekretaris --</option>
                                    {verifikators.map(v => <option key={v.id} value={v.id}>{v.name} {v.nip ? `(${v.nip})` : ''}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowGenerateModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                                {generating ? 'Memproses...' : 'Generate SPL'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* HISTORY MODAL */}
            {showHistory && (
                <div className="modal-overlay" onClick={() => setShowHistory(false)}>
                    <div className="modal" style={{ maxWidth: 750 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Riwayat Generate SPL</div>
                            <button className="modal-close" onClick={() => setShowHistory(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {splHistory.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Belum ada riwayat generate</p>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th>Matrik</th>
                                            <th>Sekolah</th>
                                            <th>Template</th>
                                            <th>File</th>
                                            <th>Tanggal</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {splHistory.map((h, i) => (
                                            <tr key={h.spl.id}>
                                                <td>{i + 1}</td>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{h.matrikNo || '-'}</td>
                                                <td>{h.namaSekolah || '-'}</td>
                                                <td>{h.templateNama || '-'}</td>
                                                <td style={{ fontSize: '0.8rem' }}>{h.spl.namaFile || '-'}</td>
                                                <td style={{ fontSize: '0.8rem' }}>{fmtDate(h.spl.createdAt)}</td>
                                                <td>
                                                    <button className="btn-icon" style={{ color: 'var(--accent-red)' }} onClick={() => handleDeleteHistory(h.spl.id)} title="Hapus">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MatriksKegiatan;