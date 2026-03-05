import { useState, useMemo, useEffect } from 'react';
import { Search, Download, Plus, Edit, Trash2, ChevronLeft, ChevronRight, X, Save, AlertTriangle, FileSpreadsheet, Building, User, Briefcase, FileText, Settings, DollarSign, Calendar, Truck, PlusCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { SUB_KEGIATAN } from '../../utils/constants';
import { useSekolahData } from '../../data/dataProvider';
import SearchableSelect from '../../components/ui/SearchableSelect';
import useMatrikStore, { generateNoSpk, inferJenjang, fullTerbilang, formatNumberInput, parseFormattedNumber, naturalSort, SUMBER_DANA, JENIS_PENGADAAN, METODE_PEMILIHAN, STATUS_PEMILIK } from '../../store/matrikStore';
import toast from 'react-hot-toast';

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
    const { matrikData, addMatrik, updateMatrik, deleteMatrik, setMatrikData } = useMatrikStore();
    const { data: sekolahList } = useSekolahData();

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

    // ===== FORM HANDLERS =====
    const getEmptyForm = () => ({
        noMatrik: '', npsn: '', namaSekolah: '-', subBidang: '-', noSubKegiatan: '', subKegiatan: '', rup: '', namaPaket: '',
        paguAnggaran: null, paguPaket: null, hps: null, nilaiKontrak: null, terbilangKontrak: '-',
        sumberDana: '', metode: '', jenisPengadaan: '',
        penyedia: '', namaPemilik: '', statusPemilik: '', alamatKantor: '',
        noSpk: '', tanggalMulai: '', tanggalSelesai: '', jangkaWaktu: '',
        tahunAnggaran: currentYear
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

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left"><h1>Matriks Kegiatan</h1><p>Manajemen Paket Pekerjaan</p></div>
                <div className="page-header-right">
                    <button className="btn btn-secondary" onClick={() => setShowSettings(true)}><Settings size={16} /> Pengaturan</button>
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}><Plus size={16} /> Tambah Paket</button>
                </div>
            </div>

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
                    <div className="table-toolbar-right">
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
                                    <div className="form-group"><label>Sub Kegiatan</label><SearchableSelect options={SUB_KEGIATAN.map(s => `${s.kode} ${s.nama}`)} value={formData.subKegiatan} onChange={(val) => handleChange('subKegiatan', val)} placeholder="Pilih Sub Kegiatan" /></div>
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
                                            {SUMBER_DANA.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Metode Pemilihan</label>
                                        <select className="form-select" value={formData.metode || ''} onChange={e => handleChange('metode', e.target.value)}>
                                            <option value="">Pilih</option>
                                            {METODE_PEMILIHAN.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Jenis Pengadaan</label>
                                        <select className="form-select" value={formData.jenisPengadaan || ''} onChange={e => handleChange('jenisPengadaan', e.target.value)}>
                                            <option value="">Pilih</option>
                                            {JENIS_PENGADAAN.map(j => <option key={j} value={j}>{j}</option>)}
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
                        <div className="modal-header"><div className="modal-title">Pengaturan Kolom</div><button className="modal-close" onClick={() => setShowSettings(false)}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                                {TABLE_COLUMNS.map(col => (
                                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, background: 'var(--bg-secondary)', borderRadius: 4, cursor: col.required ? 'not-allowed' : 'pointer', opacity: col.required ? 0.7 : 1, fontSize: '0.75rem' }}>
                                        <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => toggleColumn(col.key)} disabled={col.required} style={{ accentColor: 'var(--accent-blue)' }} />
                                        <span>{col.label}</span>
                                    </label>
                                ))}
                            </div>
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
        </div>
    );
};

export default MatriksKegiatan;