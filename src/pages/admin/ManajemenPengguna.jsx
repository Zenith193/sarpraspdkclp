import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Download, Edit, Trash2, Eye, Plus, X, UserX, KeyRound, Filter, Save, EyeOff, CheckCircle, XCircle, UserCheck, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, Upload, FileDown, UploadCloud, MoreVertical, Columns } from 'lucide-react';
import { useUsersData } from '../../data/dataProvider';
import { JENIS_AKUN, KECAMATAN, JENJANG } from '../../utils/constants';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { penggunaApi, sekolahApi } from '../../api/index';

const ManajemenPengguna = () => {
    const { data: usersFromApi, loading: usersLoading, refetch } = useUsersData();

    const [users, setUsers] = useState([]);

    // Refs for batch import
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        if (usersFromApi.length) setUsers(usersFromApi.map(u => ({
            ...u,
            namaAkun: u.namaAkun || u.name || u.email,
            alamat: u.alamat || '',
            kepsek: u.kepsek || '',
            nip: u.nip || '',
            noRek: u.noRek || '',
            namaBank: u.namaBank || '',
            rombel: u.rombel || 0,
            kopSekolah: u.kopSekolah || null,
            jenjang: u.jenjang || '',
            kecamatan: u.kecamatan || '',
            npsn: u.npsn || '',
            statusSekolah: u.statusSekolah || 'Negeri',
        })));
    }, [usersFromApi]);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterJenjang, setFilterJenjang] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // State untuk Modal Form
    const [modalState, setModalState] = useState({ type: '', data: null });
    const [formData, setFormData] = useState({});
    const [showPassword, setShowPassword] = useState(false);

    // State untuk Modal Konfirmasi
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', data: null });

    // ===== STATE PAGINASI =====
    const [perPage, setPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // ===== STATE KOLOM & AKSI DROPDOWN =====
    const ALL_COLUMNS = [
        { key: 'no', label: 'No', alwaysVisible: true },
        { key: 'namaAkun', label: 'Nama Akun', alwaysVisible: true },
        { key: 'role', label: 'Role' },
        { key: 'email', label: 'Email / NPSN' },
        { key: 'password', label: 'Password', defaultHidden: true },
        { key: 'jenjang', label: 'Jenjang' },
        { key: 'kecamatan', label: 'Kecamatan' },
        { key: 'kepsek', label: 'Kepala Sekolah', defaultHidden: true },
        { key: 'nip', label: 'NIP', defaultHidden: true },
        { key: 'status', label: 'Status' },
    ];
    const [visibleCols, setVisibleCols] = useState(() => {
        const cols = {};
        ALL_COLUMNS.forEach(c => { cols[c.key] = !c.defaultHidden; });
        return cols;
    });
    const [showColMenu, setShowColMenu] = useState(false);
    const [openActionId, setOpenActionId] = useState(null);
    const actionDropdownRef = useRef(null);
    const colMenuRef = useRef(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target)) setOpenActionId(null);
            if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const toggleCol = (key) => setVisibleCols(prev => ({ ...prev, [key]: !prev[key] }));
    const isColVisible = (key) => visibleCols[key] !== false;

    // Filter Logic
    const filtered = useMemo(() => {
        return users.filter(u => {
            const q = search.toLowerCase();
            const matchSearch = u.namaAkun.toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.npsn || '').includes(q) ||
                (u.kepsek || '').toLowerCase().includes(q) ||
                (u.alamat || '').toLowerCase().includes(q);
            const matchRole = filterRole ? u.role === filterRole : true;
            const matchJenjang = filterJenjang ? u.jenjang === filterJenjang : true;
            return matchSearch && matchRole && matchJenjang;
        });
    }, [users, search, filterRole, filterJenjang]);

    // ===== LOGIC PAGINASI =====
    const totalPages = Math.ceil(filtered.length / perPage) || 1;

    const pagedData = useMemo(() => {
        const start = (currentPage - 1) * perPage;
        const end = start + perPage;
        return filtered.slice(start, end);
    }, [filtered, currentPage, perPage]);

    // Reset halaman ke 1 jika filter atau jumlah data berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterRole, filterJenjang, perPage]);

    // ===== HANDLERS =====
    const handleBatchImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        toast.loading("Membaca file Excel...", { id: 'import' });
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            if (jsonData.length === 0) {
                toast.error("File Excel kosong", { id: 'import' });
                return;
            }

            const usersToCreate = [];
            jsonData.forEach((origRow, index) => {
                // Normalize keys: lowercase and trim
                const row = {};
                for (const key in origRow) {
                    row[key.toLowerCase().trim()] = origRow[key];
                }

                const name = row['nama'] || row['nama sekolah'] || row['nama akun'] || row['namasekolah'];
                const role = row['role'] || row['peran'] || row['hak akses'] || 'Sekolah';
                let email = row['email'] || row['username'] || row['surel'];
                const npsn = row['npsn'] ? row['npsn'].toString() : null;

                // Jika role Sekolah dan email kosong tapi NPSN ada, pakai NPSN sebagai email/username
                if (!email && npsn && role.toString().toLowerCase() === 'sekolah') {
                    email = npsn;
                }

                const password = row['password'] || row['kata sandi'] || row['katasandi'] || '12345678';

                if (!name || !email) {
                    console.warn(`Baris ${index + 2} dilewati: Kolom Nama atau Email/NPSN kosong`);
                    return; // Skip this row instead of throwing an error
                }

                usersToCreate.push({
                    name: name.toString(),
                    email: email.toString(),
                    password: String(password),
                    role: role.toString(),
                    npsn: npsn,
                    jenjang: row['jenjang'] ? row['jenjang'].toString() : undefined,
                    kecamatan: row['kecamatan'] ? row['kecamatan'].toString() : undefined,
                    statusSekolah: row['status'] || row['status sekolah'] ? (row['status'] || row['status sekolah']).toString() : undefined,
                    alamat: row['alamat'] || row['alamat sekolah'] ? (row['alamat'] || row['alamat sekolah']).toString() : undefined,
                    kepsek: row['kepala sekolah'] || row['kepsek'] || row['nama kepsek'] ? (row['kepala sekolah'] || row['kepsek'] || row['nama kepsek']).toString() : undefined,
                    nip: row['nip'] || row['nip kepsek'] ? (row['nip'] || row['nip kepsek']).toString() : undefined,
                    noRek: row['no rekening'] || row['norek'] || row['rekening'] ? (row['no rekening'] || row['norek'] || row['rekening']).toString() : undefined,
                    namaBank: row['bank'] || row['nama bank'] ? (row['bank'] || row['nama bank']).toString() : undefined,
                    rombel: row['rombel'] || row['jumlah rombel'] ? parseInt(row['rombel'] || row['jumlah rombel']) : undefined,
                });
            });

            if (usersToCreate.length === 0) {
                toast.error("Tidak ada data valid yang bisa diimpor", { id: 'import' });
                setIsImporting(false);
                return;
            }

            toast.loading(`Mengimpor ${usersToCreate.length} pengguna...`, { id: 'import' });
            const result = await penggunaApi.batchCreate(usersToCreate);

            if (result.successCount > 0) {
                toast.success(`${result.successCount} pengguna berhasil ditambahkan`, { id: 'import' });
                if (refetch) refetch();
            } else {
                toast.error("Gagal menambahkan pengguna", { id: 'import' });
            }
            if (result.failCount > 0) {
                console.warn(`${result.failCount} pengguna gagal ditambahkan`, result.results.filter(r => !r.success));
                toast.error(`${result.failCount} pengguna gagal ditambahkan. Periksa console log.`, { duration: 5000 });
            }
        } catch (error) {
            toast.error(error.message || "Gagal membaca atau mengimpor file", { id: 'import' });
            console.error(error);
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            { "Nama": "SDN 1 Contoh", "Role": "Sekolah", "NPSN": "12345678", "Jenjang": "SD", "Kecamatan": "Kroya", "Status": "Negeri", "Alamat": "Jalan Raya Kroya", "Kepala Sekolah": "Budi, S.Pd", "NIP": "198001012005011001", "No Rekening": "123456789", "Bank": "BPD Jateng", "Rombel": 6, "Email": "", "Password": "password123" },
            { "Nama": "Admin Pusat", "Role": "Admin", "NPSN": "", "Jenjang": "", "Kecamatan": "", "Status": "", "Alamat": "", "Kepala Sekolah": "", "NIP": "", "No Rekening": "", "Bank": "", "Rombel": "", "Email": "admin@example.com", "Password": "password123" },
            { "Nama": "Korwil A", "Role": "Korwil", "NPSN": "", "Jenjang": "", "Kecamatan": "", "Status": "", "Alamat": "", "Kepala Sekolah": "", "NIP": "", "No Rekening": "", "Bank": "", "Rombel": "", "Email": "korwila@example.com", "Password": "password123" },
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        ws['!cols'] = [
            { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 8 },
            { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 20 },
            { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 8 },
            { wch: 20 }, { wch: 15 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template_Pengguna");
        XLSX.writeFile(wb, "Template_Batch_Pengguna.xlsx");
    };

    const openModal = (type, user = null) => {
        if (type === 'add') {
            setFormData({
                namaAkun: '', email: '', role: JENIS_AKUN[0],
                alamat: '', password: '', aktif: true,
                noRek: '', namaBank: '', rombel: 0, kepsek: '', nip: '',
                kopSekolah: null, jenjang: '', kecamatan: ''
            });
        } else {
            setFormData({ ...user });
            // Fetch sekolah data for document paths (kop, denah)
            if ((type === 'view' || type === 'edit') && user?.sekolahId) {
                sekolahApi.getById(user.sekolahId).then(sch => {
                    setFormData(prev => ({
                        ...prev,
                        kopSekolahPath: sch?.kopSekolah || null,
                        denahSekolahPath: sch?.denahSekolah || null,
                    }));
                }).catch(() => {});
            }
        }
        setModalState({ type, data: user });
        setShowPassword(false);
    };

    const closeModal = () => {
        setModalState({ type: '', data: null });
        setFormData({});
    };

    // Handler untuk Upload File
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validasi Ukuran (Max 2MB)
        const maxSize = 2 * 1024 * 1024; // 2MB in bytes
        if (file.size > maxSize) {
            toast.error("Ukuran file maksimal 2MB!");
            e.target.value = null; // Reset input
            return;
        }

        // Validasi Tipe (Image)
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Format file harus gambar (PNG, JPG, JPEG, WEBP)!");
            e.target.value = null; // Reset input
            return;
        }

        // Simulasi menyimpan file. Di aplikasi nyata, ini akan diupload ke server/cloud storage.
        // Di sini kita simpan object file atau nama file saja untuk demo.
        const fileInfo = {
            name: file.name,
            size: (file.size / 1024).toFixed(2) + ' KB',
            // Untuk demo, kita bisa buat object URL sementara jika mau preview, 
            // tapi untuk Word lebih baik simpan path/nama saja.
            file: file
        };

        setFormData(prev => ({ ...prev, kopSekolah: fileInfo }));
        toast.success("File berhasil dimuat");
    };

    const handleSave = async () => {
        if (!formData.namaAkun || !formData.role) {
            toast.error("Nama Akun dan Role wajib diisi!");
            return;
        }

        toast.loading("Menyimpan...", { id: 'save' });
        try {
            if (modalState.type === 'add') {
                const npsn = formData.email || Math.floor(Math.random() * 10000000).toString();
                const userPayload = {
                    name: formData.namaAkun.toString(),
                    email: formData.email ? formData.email.toString() : npsn.toString(),
                    password: formData.password || '12345678',
                    role: formData.role.toString(),
                    npsn: npsn.toString(),
                    jenjang: formData.jenjang,
                    kecamatan: formData.kecamatan,
                    alamat: formData.alamat,
                    kepsek: formData.kepsek,
                    nip: formData.nip,
                    noRek: formData.noRek,
                    namaBank: formData.namaBank,
                    rombel: formData.rombel ? parseInt(formData.rombel) : 0,
                };

                const result = await penggunaApi.batchCreate([userPayload]);
                if (result.successCount > 0) {
                    toast.success("Pengguna baru berhasil ditambahkan", { id: 'save' });
                    if (refetch) refetch();
                } else {
                    toast.error(result.results[0]?.error || "Gagal menambahkan pengguna", { id: 'save' });
                }
            } else if (modalState.type === 'edit') {
                await penggunaApi.update(formData.id, {
                    name: formData.namaAkun,
                    role: formData.role,
                    jenjang: formData.jenjang,
                    kecamatan: formData.kecamatan,
                    alamat: formData.alamat,
                    kepsek: formData.kepsek,
                    nip: formData.nip,
                    noRek: formData.noRek,
                    namaBank: formData.namaBank,
                    rombel: formData.rombel ? parseInt(formData.rombel) : 0,
                });
                toast.success("Data pengguna berhasil diperbarui", { id: 'save' });
                if (refetch) refetch();
            } else if (modalState.type === 'reset') {
                if (!formData.password || formData.password.length < 6) {
                    toast.error('Password minimal 6 karakter', { id: 'save' });
                    return;
                }
                await penggunaApi.changePassword(formData.id, formData.password);
                toast.success('Password berhasil direset', { id: 'save' });
                if (refetch) refetch();
            }
            closeModal();
        } catch (e) {
            toast.error(e.message || "Gagal menyimpan data", { id: 'save' });
        }
    };

    const requestAction = (type, user) => {
        setConfirmModal({ isOpen: true, type, data: user });
    };

    const executeConfirmedAction = async () => {
        const { type, data } = confirmModal;

        try {
            if (type === 'delete') {
                await penggunaApi.delete(data.id);
                toast.success(`Pengguna "${data.namaAkun}" berhasil dihapus`);
            } else if (type === 'status') {
                await penggunaApi.toggleActive(data.id);
                toast.success(`Status akun berhasil diubah`);
            }
            if (refetch) refetch();
        } catch (e) {
            toast.error(e.message || "Gagal memproses aksi");
        }

        setConfirmModal({ isOpen: false, type: '', data: null });
    };

    // ===== EXPORT HANDLERS =====
    const handleExport = (format) => {
        const exportColumns = [
            { header: 'No', accessor: (_, i) => i + 1 },
            { header: 'Nama Akun', key: 'namaAkun' },
            { header: 'Role', key: 'role' },
            { header: 'Email/NPSN', key: 'email' },
            { header: 'Alamat', key: 'alamat' },
            { header: 'Kepala Sekolah', key: 'kepsek' },
            { header: 'NIP', key: 'nip' },
            { header: 'Jumlah Rombel', key: 'rombel' },
            { header: 'No Rekening', key: 'noRek' },
            { header: 'Nama Bank', key: 'namaBank' },
            { header: 'Status', accessor: (row) => row.aktif ? 'Aktif' : 'Nonaktif' }
        ];

        try {
            if (format === 'excel') {
                exportToExcel(filtered, exportColumns, 'data_pengguna_lengkap');
                toast.success('Ekspor Excel berhasil');
            } else if (format === 'pdf') {
                exportToPDF(filtered, exportColumns, 'data_pengguna_lengkap', 'Laporan Data Pengguna');
                toast.success('Ekspor PDF berhasil');
            }
        } catch (err) {
            toast.error('Gagal mengekspor data');
            console.error(err);
        }
    };

    // ===== KONFIGURASI MODAL KONFIRMASI =====
    const getConfirmConfig = () => {
        const { type, data } = confirmModal;
        if (!type) return {};

        if (type === 'delete') {
            return {
                title: 'Hapus Pengguna?',
                message: `Data pengguna <strong>"${data?.namaAkun}"</strong> akan dihapus permanen.`,
                icon: <Trash2 size={32} strokeWidth={1.5} />,
                iconBg: 'rgba(239, 68, 68, 0.1)',
                iconColor: 'var(--accent-red)',
                btnText: 'Ya, Hapus',
                btnColor: 'var(--accent-red)',
            };
        }

        if (type === 'status') {
            const willBeActive = !data?.aktif;
            return willBeActive ? {
                title: 'Aktifkan Akun?',
                message: `Akun <strong>"${data?.namaAkun}"</strong> akan diaktifkan kembali.`,
                icon: <UserCheck size={32} strokeWidth={1.5} />,
                iconBg: 'rgba(34, 197, 94, 0.1)',
                iconColor: 'var(--accent-green)',
                btnText: 'Ya, Aktifkan',
                btnColor: 'var(--accent-green)',
            } : {
                title: 'Nonaktifkan Akun?',
                message: `Akun <strong>"${data?.namaAkun}"</strong> akan dinonaktifkan.`,
                icon: <UserX size={32} strokeWidth={1.5} />,
                iconBg: 'rgba(234, 179, 8, 0.1)',
                iconColor: '#eab308',
                btnText: 'Ya, Nonaktifkan',
                btnColor: '#eab308',
            };
        }
        return {};
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Manajemen Pengguna</h1>
                    <p>Kelola akun pengguna sistem lengkap</p>
                </div>
                <div className="page-header-right" style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-outline" onClick={handleDownloadTemplate} title="Unduh Template Excel">
                        <FileDown size={16} /> Template Excel
                    </button>
                    <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting} title="Import dari Excel">
                        <UploadCloud size={16} /> {isImporting ? 'Mengimpor...' : 'Import Batch'}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleBatchImport} accept=".xlsx, .xls, .csv" style={{ display: 'none' }} />
                    <button className="btn btn-primary" onClick={() => openModal('add')}><Plus size={16} /> Tambah Pengguna</button>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari nama, email, alamat..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select
                                value={perPage}
                                onChange={(e) => setPerPage(Number(e.target.value))}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                            >
                                <option value="10">10</option>
                                <option value="15">15</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </div>

                        <button className={`btn ${(filterRole || filterJenjang) ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setShowFilters(!showFilters)}>
                            <Filter size={14} /> Filter {(filterRole || filterJenjang) && <span style={{ marginLeft: 4, background: '#fff', color: 'var(--accent-blue)', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{(filterRole ? 1 : 0) + (filterJenjang ? 1 : 0)}</span>}
                        </button>

                        {/* Column Visibility Toggle */}
                        <div style={{ position: 'relative' }} ref={colMenuRef}>
                            <button className="btn btn-ghost btn-sm" onClick={(e) => {
                                if (showColMenu) { setShowColMenu(false); return; }
                                setShowColMenu(true);
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTimeout(() => {
                                    const dd = document.getElementById('col-menu-dd');
                                    if (dd) {
                                        dd.style.top = `${rect.bottom + 4}px`;
                                        dd.style.left = `${rect.left}px`;
                                    }
                                }, 0);
                            }}>
                                <Columns size={14} /> Kolom
                            </button>
                            {showColMenu && (
                                <div id="col-menu-dd" style={{
                                    position: 'fixed', top: 'auto', left: 'auto', zIndex: 9999,
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                    borderRadius: 10, padding: '8px 0', minWidth: 200,
                                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                                    maxHeight: '70vh', overflowY: 'auto'
                                }}>
                                    <div style={{ padding: '4px 14px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tampilkan Kolom</div>
                                    {ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => (
                                        <label key={col.key} style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '6px 14px', cursor: 'pointer', fontSize: 13,
                                            transition: 'background 0.15s'
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <input type="checkbox" checked={isColVisible(col.key)} onChange={() => toggleCol(col.key)}
                                                style={{ width: 15, height: 15, accentColor: 'var(--accent-blue)', cursor: 'pointer' }} />
                                            <span>{col.label}</span>
                                            {col.defaultHidden && <span style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3 }}>hidden</span>}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('excel')}><FileSpreadsheet size={14} /> Excel</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}><FileText size={14} /> PDF</button>
                    </div>
                </div>

                {showFilters && (
                    <div className="filter-bar" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ minWidth: 160 }}>
                            <option value="">Semua Role</option>
                            {JENIS_AKUN.map(j => <option key={j} value={j}>{j}</option>)}
                        </select>
                        <select value={filterJenjang} onChange={e => setFilterJenjang(e.target.value)} style={{ minWidth: 160 }}>
                            <option value="">Semua Jenjang</option>
                            {JENJANG.map(j => <option key={j} value={j}>{j}</option>)}
                        </select>
                        {(filterRole || filterJenjang) && <button className="btn btn-ghost btn-sm" onClick={() => { setFilterRole(''); setFilterJenjang(''); }}>Reset</button>}
                    </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Nama Akun</th>
                                {isColVisible('role') && <th>Role</th>}
                                {isColVisible('email') && <th>Email / NPSN</th>}
                                {isColVisible('password') && <th>Password</th>}
                                {isColVisible('jenjang') && <th>Jenjang</th>}
                                {isColVisible('kecamatan') && <th>Kecamatan</th>}
                                {isColVisible('kepsek') && <th>Kepala Sekolah</th>}
                                {isColVisible('nip') && <th>NIP</th>}
                                {isColVisible('status') && <th>Status</th>}
                                <th style={{ width: 50 }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedData.map((u, i) => (
                                <tr key={u.id}>
                                    <td>{(currentPage - 1) * perPage + i + 1}</td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{u.namaAkun}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.alamat}</div>
                                    </td>
                                    {isColVisible('role') && <td><span className="badge badge-disetujui">{u.role}</span></td>}
                                    {isColVisible('email') && <td><div>{u.npsn || (u.email?.replace('@SARDIKA.cilacapkab.go.id', '') || '-')}</div></td>}
                                    {isColVisible('password') && <td>
                                        <span style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{u.plainPassword || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontFamily: 'inherit' }}>-</span>}</span>
                                    </td>}
                                    {isColVisible('jenjang') && <td>{(u.role === 'Korwil' || u.role === 'Sekolah') ? (u.jenjang || '-') : '-'}</td>}
                                    {isColVisible('kecamatan') && <td>{(u.role === 'Korwil' || u.role === 'Sekolah') ? (u.kecamatan || '-') : '-'}</td>}
                                    {isColVisible('kepsek') && <td>{u.kepsek || '-'}</td>}
                                    {isColVisible('nip') && <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{u.nip || '-'}</td>}
                                    {isColVisible('status') && <td>
                                        {u.aktif ?
                                            <span className="badge badge-baik"><CheckCircle size={12} style={{ marginRight: 4 }} /> Aktif</span> :
                                            <span className="badge badge-ditolak"><XCircle size={12} style={{ marginRight: 4 }} /> Nonaktif</span>
                                        }
                                    </td>}
                                    <td>
                                        <div style={{ position: 'relative' }} ref={openActionId === u.id ? actionDropdownRef : null}>
                                            <button className="btn-icon" onClick={(e) => {
                                                e.stopPropagation();
                                                if (openActionId === u.id) { setOpenActionId(null); return; }
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const spaceBelow = window.innerHeight - rect.bottom;
                                                const openUp = spaceBelow < 250;
                                                setOpenActionId(u.id);
                                                // Store position for fixed dropdown
                                                setTimeout(() => {
                                                    const dd = document.getElementById(`action-dd-${u.id}`);
                                                    if (dd) {
                                                        dd.style.top = openUp ? 'auto' : `${rect.bottom + 4}px`;
                                                        dd.style.bottom = openUp ? `${window.innerHeight - rect.top + 4}px` : 'auto';
                                                        dd.style.right = `${window.innerWidth - rect.right}px`;
                                                    }
                                                }, 0);
                                            }}
                                                style={{ padding: '4px 6px', borderRadius: 8 }}>
                                                <MoreVertical size={16} />
                                            </button>
                                            {openActionId === u.id && (
                                                <div id={`action-dd-${u.id}`} style={{
                                                    position: 'fixed', zIndex: 9999,
                                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                                    borderRadius: 10, padding: '4px 0', minWidth: 170,
                                                    boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                                                    animation: 'fadeIn 0.15s ease'
                                                }}>
                                                    {[
                                                        { icon: <Eye size={14} />, label: 'Lihat Detail', color: 'var(--text-primary)', onClick: () => { openModal('view', u); setOpenActionId(null); } },
                                                        { icon: <Edit size={14} />, label: 'Edit Data', color: 'var(--text-primary)', onClick: () => { openModal('edit', u); setOpenActionId(null); } },
                                                        { icon: <KeyRound size={14} />, label: 'Reset Password', color: '#eab308', onClick: () => { openModal('reset', u); setOpenActionId(null); } },
                                                        { icon: u.aktif ? <UserX size={14} /> : <UserCheck size={14} />, label: u.aktif ? 'Nonaktifkan' : 'Aktifkan', color: u.aktif ? 'var(--text-secondary)' : 'var(--accent-green)', onClick: () => { requestAction('status', u); setOpenActionId(null); } },
                                                        { divider: true },
                                                        { icon: <Trash2 size={14} />, label: 'Hapus', color: 'var(--accent-red)', onClick: () => { requestAction('delete', u); setOpenActionId(null); } },
                                                    ].map((item, idx) => item.divider ? (
                                                        <div key={idx} style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
                                                    ) : (
                                                        <button key={idx} onClick={item.onClick} style={{
                                                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                                            padding: '8px 14px', border: 'none', background: 'transparent',
                                                            color: item.color, fontSize: 13, cursor: 'pointer',
                                                            transition: 'background 0.15s', textAlign: 'left'
                                                        }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            {item.icon} {item.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pagedData.length === 0 && (
                                <tr>
                                    <td colSpan={ALL_COLUMNS.length + 1} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                        Tidak ada data ditemukan
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="table-pagination">
                    <div className="table-pagination-info">
                        Menampilkan {filtered.length > 0 ? (currentPage - 1) * perPage + 1 : 0}-{Math.min(currentPage * perPage, filtered.length)} dari {filtered.length} data
                    </div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem' }}>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ===== MODAL FORM (View, Edit, Add, Reset) ===== */}
            {modalState.type && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" style={{ maxWidth: modalState.type === 'view' ? '650px' : '550px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">
                                {modalState.type === 'view' && 'Detail Lengkap Pengguna'}
                                {modalState.type === 'edit' && 'Edit Data Pengguna'}
                                {modalState.type === 'add' && 'Tambah Pengguna Baru'}
                                {modalState.type === 'reset' && 'Reset Password'}
                            </div>
                            <button className="modal-close" onClick={closeModal}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            {modalState.type === 'view' && formData && (
                                <div style={{ display: 'grid', gap: '1.5rem' }}>
                                    <div>
                                        <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>Informasi Dasar</h4>
                                        <div className="form-row">
                                            <div className="form-group"><label className="form-label">Nama Akun</label><div style={{ fontWeight: 500 }}>{formData.namaAkun}</div></div>
                                            <div className="form-group"><label className="form-label">Role</label><div><span className="badge badge-disetujui">{formData.role}</span></div></div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group"><label className="form-label">Email / NPSN</label><div>{formData.npsn || (formData.email?.replace('@SARDIKA.cilacapkab.go.id', '') || '-')}</div></div>
                                            <div className="form-group"><label className="form-label">Status</label><div>{formData.aktif ? 'Aktif' : 'Nonaktif'}</div></div>
                                        </div>
                                        <div className="form-group"><label className="form-label">Alamat</label><div>{formData.alamat || '-'}</div></div>
                                        {(formData.role === 'Korwil' || formData.role === 'Sekolah') && (
                                            <div className="form-row" style={{ marginTop: 8 }}>
                                                <div className="form-group"><label className="form-label">Jenjang</label><div>{formData.jenjang || '-'}</div></div>
                                                <div className="form-group"><label className="form-label">Kecamatan</label><div>{formData.kecamatan || '-'}</div></div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>Informasi Sekolah</h4>
                                        <div className="form-row">
                                            <div className="form-group"><label className="form-label">Kepala Sekolah</label><div>{formData.kepsek || '-'}</div></div>
                                            <div className="form-group"><label className="form-label">NIP</label><div>{formData.nip || '-'}</div></div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Jumlah Rombel</label>
                                            <div style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{formData.rombel || 0} Rombel</div>
                                        </div>

                                        {/* FILE KOP SEKOLAH - VIEW */}
                                        <div className="form-group">
                                            <label className="form-label">Kop Sekolah (Gambar)</label>
                                            {formData.kopSekolahPath ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                                    <FileText size={18} style={{ color: 'var(--accent-green)' }} />
                                                    <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--accent-green)' }}>File sudah diupload</span>
                                                    <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={async () => { try { const blob = await sekolahApi.downloadKop(formData.sekolahId); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'kop_sekolah'; a.click(); URL.revokeObjectURL(url); } catch { toast.error('Gagal download'); } }}>
                                                        <FileDown size={12} style={{ marginRight: 4 }} /> Unduh
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Belum ada file diunggah</div>
                                            )}
                                        </div>
                                        {/* FILE DENAH SEKOLAH - VIEW */}
                                        <div className="form-group">
                                            <label className="form-label">Denah Sekolah (PDF)</label>
                                            {formData.denahSekolahPath ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                                    <FileText size={18} style={{ color: 'var(--accent-green)' }} />
                                                    <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--accent-green)' }}>File sudah diupload</span>
                                                    <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={async () => { try { const blob = await sekolahApi.downloadDenah(formData.sekolahId); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'denah_sekolah'; a.click(); URL.revokeObjectURL(url); } catch { toast.error('Gagal download'); } }}>
                                                        <FileDown size={12} style={{ marginRight: 4 }} /> Unduh
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Belum ada file diunggah</div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>Informasi Keuangan</h4>
                                        <div className="form-row">
                                            <div className="form-group"><label className="form-label">No Rekening</label><div style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{formData.noRek || '-'}</div></div>
                                            <div className="form-group"><label className="form-label">Nama Bank</label><div>{formData.namaBank || '-'}</div></div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>Keamanan</h4>
                                        <div className="form-group">
                                            <label className="form-label">Password</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                                <span style={{ fontFamily: 'monospace', letterSpacing: 2 }}>
                                                    {showPassword ? (formData.plainPassword || formData.npsn || '-') : '••••••••••'}
                                                </span>
                                                <button className="btn-icon" onClick={() => setShowPassword(!showPassword)} style={{ marginLeft: 'auto' }}>
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(modalState.type === 'edit' || modalState.type === 'add') && (
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Nama Akun</label>
                                            <input className="form-input" value={formData.namaAkun || ''} onChange={e => setFormData({ ...formData, namaAkun: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Role</label>
                                            <select className="form-select" value={formData.role || ''} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                                {JENIS_AKUN.map(j => <option key={j} value={j}>{j}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email / NPSN</label>
                                        <input className="form-input" value={formData.email || formData.npsn || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Alamat</label>
                                        <textarea className="form-input" rows={2} value={formData.alamat || ''} onChange={e => setFormData({ ...formData, alamat: e.target.value })}></textarea>
                                    </div>

                                    {/* Jenjang & Kecamatan - for Korwil/Sekolah */}
                                    {(formData.role === 'Korwil' || formData.role === 'Sekolah') && (
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Jenjang</label>
                                                <select className="form-select" value={formData.jenjang || ''} onChange={e => setFormData({ ...formData, jenjang: e.target.value })}>
                                                    <option value="">-- Pilih Jenjang --</option>
                                                    {JENJANG.map(j => <option key={j} value={j}>{j}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Kecamatan</label>
                                                <select className="form-select" value={formData.kecamatan || ''} onChange={e => setFormData({ ...formData, kecamatan: e.target.value })}>
                                                    <option value="">-- Pilih Kecamatan --</option>
                                                    {KECAMATAN.map(k => <option key={k} value={k}>{k}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem' }}>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Kepala Sekolah</label>
                                                <input className="form-input" value={formData.kepsek || ''} onChange={e => setFormData({ ...formData, kepsek: e.target.value })} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">NIP</label>
                                                <input className="form-input" value={formData.nip || ''} onChange={e => setFormData({ ...formData, nip: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Jumlah Rombel</label>
                                                <input className="form-input" type="number" value={formData.rombel || 0} onChange={e => setFormData({ ...formData, rombel: parseInt(e.target.value) })} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">No Rekening</label>
                                                <input className="form-input" value={formData.noRek || ''} onChange={e => setFormData({ ...formData, noRek: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Nama Bank</label>
                                            <input className="form-input" value={formData.namaBank || ''} onChange={e => setFormData({ ...formData, namaBank: e.target.value })} />
                                        </div>

                                        {/* FILE UPLOAD KOP SEKOLAH - FORM */}
                                        <div className="form-group">
                                            <label className="form-label">Kop Sekolah (Format Gambar, Max 2MB)</label>
                                            <small style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 2, marginBottom: 8, lineHeight: 1.4 }}>
                                                📐 Ukuran ideal: <strong>1950 × 500 px</strong> (atau minimal 1200px lebar). Format: JPG/PNG. Pastikan lebar gambar proporsional agar kop tampil penuh di dokumen SPL.
                                            </small>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                <input
                                                    type="file"
                                                    id="kop-upload"
                                                    accept=".png,.jpg,.jpeg,.webp"
                                                    onChange={handleFileUpload}
                                                    style={{ display: 'none' }}
                                                />
                                                <label htmlFor="kop-upload" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                                    <Upload size={14} style={{ marginRight: 4 }} /> Pilih File
                                                </label>
                                                {formData.kopSekolah ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                                        <FileText size={14} style={{ color: 'var(--accent-blue)' }} />
                                                        <span style={{ fontSize: '0.8rem' }}>{formData.kopSekolah.name}</span>
                                                        <button
                                                            className="btn-icon"
                                                            style={{ padding: 2 }}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setFormData({ ...formData, kopSekolah: null })
                                                            }}
                                                        >
                                                            <X size={12} style={{ color: 'var(--accent-red)' }} />
                                                        </button>
                                                    </div>
                                                ) : formData.kopSekolahPath ? (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                                                        ✅ Sudah ada (upload baru untuk mengganti)
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                        Tidak ada file dipilih
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                    </div>

                                    {modalState.type === 'add' && (
                                        <div className="form-group">
                                            <label className="form-label">Password Awal</label>
                                            <input className="form-input" type="password" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Minimal 6 karakter" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {modalState.type === 'reset' && formData && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                        <KeyRound size={28} />
                                    </div>
                                    <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                        Reset password untuk pengguna: <br /><strong>{formData.namaAkun}</strong>
                                    </p>
                                    <div className="form-group" style={{ textAlign: 'left' }}>
                                        <label className="form-label">Password Baru</label>
                                        <input className="form-input" type="text" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Masukkan password baru" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {modalState.type !== 'view' && (
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={closeModal}>Batal</button>
                                <button className="btn btn-primary" onClick={handleSave}>
                                    <Save size={14} /> Simpan
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== ATTRACTIVE CONFIRMATION MODAL ===== */}
            {confirmModal.isOpen && (
                <div className="modal-overlay" onClick={() => setConfirmModal({ isOpen: false, type: '', data: null })}>
                    <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: '50%',
                                background: getConfirmConfig().iconBg,
                                color: getConfirmConfig().iconColor,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                {getConfirmConfig().icon}
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                                {getConfirmConfig().title}
                            </h3>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: getConfirmConfig().message }}>
                            </p>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={() => setConfirmModal({ isOpen: false, type: '', data: null })} style={{ minWidth: 100 }}>Batal</button>
                                <button className="btn btn-primary" onClick={executeConfirmedAction} style={{ minWidth: 120, background: getConfirmConfig().btnColor, borderColor: getConfirmConfig().btnColor }}>
                                    {getConfirmConfig().btnText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManajemenPengguna;