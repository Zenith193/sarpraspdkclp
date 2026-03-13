import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search, Download, Eye, Edit, Trash2, X, Star, ChevronLeft, ChevronRight, Upload, Columns, FileSpreadsheet, FileText, FileDown, ChevronDown, Save, Image, MapPin, Building2, AlertTriangle, CheckCircle, Filter, AlertOctagon, UploadCloud } from 'lucide-react';
import { useSarprasData, useSekolahData, useKorwilData } from '../../data/dataProvider';
import { KECAMATAN, JENJANG, KONDISI, JENIS_PRASARANA, MASA_BANGUNAN, LANTAI_OPTIONS } from '../../utils/constants';
import { formatNumber } from '../../utils/formatters';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import SearchableSelect from '../../components/ui/SearchableSelect';
import useAuthStore from '../../store/authStore';
import { safeStr } from '../../utils/safeStr';
import useCountdownGuard from '../../hooks/useCountdownGuard';
import { sarprasApi, sekolahApi } from '../../api/index';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const PER_PAGE_OPTIONS = [10, 15, 50, 100];
const BINTANG_OPTIONS = ['Ya', 'Tidak'];
// Format luas: ceil 2 desimal, koma, hapus trailing zero
const fmtLuas = (v) => { const n = Math.ceil(v * 100) / 100; return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ','); };

const DataSarpras = ({ readOnly = false }) => {
    const user = useAuthStore(s => s.user);
    const { guard, isRestricted } = useCountdownGuard();
    const canAccessPriority = user?.role === 'Admin' || user?.role === 'Verifikator';

    const { data: sekolahList } = useSekolahData();
    const { data: sarprasList, loading: sarprasLoading, refetch: refetchSarpras } = useSarprasData();
    const { data: korwilList } = useKorwilData();
    const isKorwil = (user?.role || '').toLowerCase() === 'korwil';

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
        if (sarprasList.length) {
            let list = sarprasList.map(d => ({ ...d, bintang: d.bintang || 0, foto: d.foto || [] }));
            // For korwil: filter by assigned kecamatan + jenjang
            if (isKorwil && myKorwilAssignment) {
                list = list.filter(s =>
                    myKorwilAssignment.kecamatan.includes(s.kecamatan) &&
                    s.jenjang === myKorwilAssignment.jenjang
                );
            }
            setData(list);
        }
    }, [sarprasList, isKorwil, myKorwilAssignment]);
    const [search, setSearch] = useState('');
    const [headerFilters, setHeaderFilters] = useState({ jenjang: '', kecamatan: '', kondisi: '', jenisPrasarana: '', bintang: '' });
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(15);

    // Column visibility
    const defaultCols = ['no', ...(canAccessPriority ? ['bintang'] : []), 'namaSekolah', 'npsn', 'jenjang', 'kecamatan', 'masaBangunan', 'jenisPrasarana', 'namaRuang', 'lantai', 'panjang', 'lebar', 'luas', 'kondisi', 'keterangan', 'lastFotoAt', 'foto', 'aksi'];
    const [visibleCols, setVisibleCols] = useState(defaultCols);
    const [showColPicker, setShowColPicker] = useState(false);
    const colPickerRef = useRef(null);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [viewItem, setViewItem] = useState(null);
    const [photoIdx, setPhotoIdx] = useState(0);
    const [photoModal, setPhotoModal] = useState(null);

    // Batch input state
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchRows, setBatchRows] = useState([]);
    const [isBatchImporting, setIsBatchImporting] = useState(false);
    const batchFileRef = useRef(null);

    // Delete Confirmation State
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    // Track deleted photo IDs during edit (to delete from server on save)
    const [deletedPhotoIds, setDeletedPhotoIds] = useState([]);

    // Export & Filter panel
    const [showExport, setShowExport] = useState(false);
    const exportRef = useRef(null);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const filterPanelRef = useRef(null);

    // Click outside to close panels
    useEffect(() => {
        const handler = (e) => {
            if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) setShowFilterPanel(false);
            if (colPickerRef.current && !colPickerRef.current.contains(e.target)) setShowColPicker(false);
            if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Form state
    const [formSekolah, setFormSekolah] = useState('');

    useEffect(() => {
        if (sekolahList?.length === 1 && !formSekolah && !editItem) {
            setFormSekolah(sekolahList[0].nama);
        }
    }, [sekolahList, formSekolah, editItem]);

    const [formData, setFormData] = useState({
        masaBangunan: 'A', jenisPrasarana: JENIS_PRASARANA[0], namaRuang: '',
        lantai: 1, panjang: '', lebar: '', kondisi: KONDISI[0], keterangan: ''
    });
    const [formPhotos, setFormPhotos] = useState([]);
    const fileInputRef = useRef(null);

    // ===== COLUMN DEFINITIONS =====
    const ALL_COLUMNS = useMemo(() => [
        { key: 'no', label: 'No', alwaysVisible: true, width: 40 },
        ...(canAccessPriority ? [{ key: 'bintang', label: '★', filterable: true, filterLabel: 'Prioritas', filterType: 'select', filterOptions: BINTANG_OPTIONS, width: 42 }] : []),
        { key: 'namaSekolah', label: 'Nama Sekolah', width: 150 },
        { key: 'npsn', label: 'NPSN', width: 80 },
        { key: 'jenjang', label: 'Jenjang', filterable: true, filterLabel: 'Jenjang', filterType: 'select', filterOptions: JENJANG, width: 70 },
        { key: 'kecamatan', label: 'Kecamatan', filterable: true, filterLabel: 'Kecamatan', filterType: 'searchable', filterOptions: KECAMATAN, width: 110 },
        { key: 'masaBangunan', label: 'Masa', width: 50 },
        { key: 'jenisPrasarana', label: 'Jenis Prasarana', filterable: true, filterLabel: 'Jenis Prasarana', filterType: 'searchable', filterOptions: JENIS_PRASARANA, width: 120 },
        { key: 'namaRuang', label: 'Nama Ruang', width: 110 },
        { key: 'lantai', label: 'Lt', width: 36 },
        { key: 'panjang', label: 'P(m)', width: 48 },
        { key: 'lebar', label: 'L(m)', width: 48 },
        { key: 'luas', label: 'Luas', width: 52 },
        { key: 'kondisi', label: 'Kondisi', filterable: true, filterLabel: 'Kondisi', filterType: 'select', filterOptions: KONDISI, width: 100 },
        { key: 'keterangan', label: 'Keterangan', width: 120 },
        { key: 'lastFotoAt', label: 'Update Foto', width: 110 },
        { key: 'foto', label: 'Foto', width: 52 },
        { key: 'aksi', label: 'Aksi', alwaysVisible: true, width: 90 },
    ], [canAccessPriority]);

    // ===== FILTERING =====
    const filtered = useMemo(() => {
        return data.filter(s => {
            if (search) {
                const q = search.toLowerCase();
                if (!s.namaSekolah.toLowerCase().includes(q) && !s.npsn.includes(q) && !s.namaRuang.toLowerCase().includes(q)) return false;
            }
            if (headerFilters.kecamatan && s.kecamatan !== headerFilters.kecamatan) return false;
            if (headerFilters.jenjang && s.jenjang !== headerFilters.jenjang) return false;
            if (headerFilters.kondisi && s.kondisi !== headerFilters.kondisi) return false;
            if (headerFilters.jenisPrasarana && s.jenisPrasarana !== headerFilters.jenisPrasarana) return false;
            if (canAccessPriority && headerFilters.bintang === 'Ya' && s.bintang === 0) return false;
            if (canAccessPriority && headerFilters.bintang === 'Tidak' && s.bintang !== 0) return false;
            return true;
        });
    }, [data, search, headerFilters, canAccessPriority]);

    const paged = filtered.slice((page - 1) * perPage, page * perPage);
    const totalPages = Math.ceil(filtered.length / perPage) || 1;

    // ===== RECAP STATS =====
    const recapStats = useMemo(() => {
        const total = filtered.length;
        const sekolahSet = new Set(filtered.map(s => s.npsn));
        const baik = filtered.filter(s => s.kondisi === 'BAIK').length;
        const rr = filtered.filter(s => s.kondisi === 'RUSAK RINGAN').length;
        const rs = filtered.filter(s => s.kondisi === 'RUSAK SEDANG').length;
        const rb = filtered.filter(s => s.kondisi === 'RUSAK BERAT').length;
        const totalPrioritas = filtered.filter(s => s.bintang > 0).length;
        return { total, sekolah: sekolahSet.size, baik, rr, rs, rb, totalPrioritas };
    }, [filtered]);

    // ===== EXPORT COLUMNS =====
    const exportCols = [
        { header: 'No', accessor: (_, i) => i + 1 },
        { header: 'Nama Sekolah', key: 'namaSekolah' },
        { header: 'NPSN', key: 'npsn' },
        { header: 'Jenjang', key: 'jenjang' },
        { header: 'Kecamatan', key: 'kecamatan' },
        { header: 'Masa Bangunan', key: 'masaBangunan' },
        { header: 'Jenis Prasarana', key: 'jenisPrasarana' },
        { header: 'Nama Ruang', key: 'namaRuang' },
        { header: 'Lantai', key: 'lantai' },
        { header: 'Panjang (m)', key: 'panjang' },
        { header: 'Lebar (m)', key: 'lebar' },
        { header: 'Luas (m²)', key: 'luas' },
        { header: 'Kondisi', key: 'kondisi' },
        { header: 'Keterangan', key: 'keterangan' },
        ...(canAccessPriority ? [{ header: 'Prioritas (★)', key: 'bintang' }] : []),
    ];

    // ===== COLUMN VISIBILITY =====
    const toggleCol = (key) => {
        const col = ALL_COLUMNS.find(c => c.key === key);
        if (col?.alwaysVisible) return;
        setVisibleCols(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
    };
    const activeColumns = ALL_COLUMNS.filter(c => visibleCols.includes(c.key) && (c.key !== 'aksi' || !readOnly));

    // ===== STAR PRIORITY =====
    const handleStar = async (e, item) => {
        e.stopPropagation();
        if (!canAccessPriority) return;
        const newBintang = item.bintang ? 0 : 1;
        // Optimistic update
        setData(prev => prev.map(d => d.id === item.id ? { ...d, bintang: newBintang } : d));
        try {
            await sarprasApi.update(item.id, { bintang: newBintang });
            toast.success(newBintang ? 'Ditandai prioritas' : 'Prioritas dihapus', { duration: 1500 });
        } catch (e) {
            // Revert on error
            setData(prev => prev.map(d => d.id === item.id ? { ...d, bintang: item.bintang } : d));
            toast.error('Gagal memperbarui prioritas: ' + (e.message || 'Unknown error'));
        }
    };

    const getConditionBadge = (kondisi) => {
        const map = { 'BAIK': 'badge-baik', 'RUSAK RINGAN': 'badge-rusak-ringan', 'RUSAK SEDANG': 'badge-rusak-sedang', 'RUSAK BERAT': 'badge-rusak-berat' };
        return <span className={`badge ${map[kondisi] || ''}`}>{kondisi}</span>;
    };

    // ===== GEOTAGGING READER =====
    const readGeoTag = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const view = new DataView(e.target.result);
                    if (view.getUint16(0) !== 0xFFD8) { resolve(null); return; }
                    let offset = 2;
                    while (offset < view.byteLength) {
                        const marker = view.getUint16(offset);
                        if (marker === 0xFFE1) {
                            const exifData = parseExifGPS(view, offset + 4);
                            resolve(exifData);
                            return;
                        }
                        offset += 2 + view.getUint16(offset + 2);
                    }
                    resolve(null);
                } catch { resolve(null); }
            };
            reader.readAsArrayBuffer(file.slice(0, 131072));
        });
    };

    const parseExifGPS = (view, start) => {
        try {
            const exifStr = String.fromCharCode(view.getUint8(start), view.getUint8(start + 1), view.getUint8(start + 2), view.getUint8(start + 3));
            if (exifStr !== 'Exif') return null;
            const tiffStart = start + 6;
            const bigEndian = view.getUint16(tiffStart) === 0x4D4D;
            const getU16 = (o) => view.getUint16(o, !bigEndian);
            const getU32 = (o) => view.getUint32(o, !bigEndian);
            const ifdOffset = getU32(tiffStart + 4);
            const ifdStart = tiffStart + ifdOffset;
            const entries = getU16(ifdStart);
            let gpsOffset = null;
            for (let i = 0; i < entries; i++) {
                const tag = getU16(ifdStart + 2 + i * 12);
                if (tag === 0x8825) {
                    gpsOffset = getU32(ifdStart + 2 + i * 12 + 8);
                    break;
                }
            }
            if (!gpsOffset) return null;
            const gpsIfd = tiffStart + gpsOffset;
            const gpsEntries = getU16(gpsIfd);
            let lat = null, lng = null, latRef = 'N', lngRef = 'E';
            for (let i = 0; i < gpsEntries; i++) {
                const entryOff = gpsIfd + 2 + i * 12;
                const tag = getU16(entryOff);
                if (tag === 1) latRef = String.fromCharCode(view.getUint8(entryOff + 8));
                if (tag === 3) lngRef = String.fromCharCode(view.getUint8(entryOff + 8));
                if (tag === 2 || tag === 4) {
                    const valOff = tiffStart + getU32(entryOff + 8);
                    const d = getU32(valOff) / getU32(valOff + 4);
                    const m = getU32(valOff + 8) / getU32(valOff + 12);
                    const s = getU32(valOff + 16) / getU32(valOff + 20);
                    const dd = d + m / 60 + s / 3600;
                    if (tag === 2) lat = dd;
                    if (tag === 4) lng = dd;
                }
            }
            if (lat !== null && lng !== null) {
                return { lat: latRef === 'S' ? -lat : lat, lng: lngRef === 'W' ? -lng : lng };
            }
            return null;
        } catch { return null; }
    };

    // ===== FILE UPLOAD =====
    const handleFileUpload = async (e) => {
        if (!guard('upload')) return;
        const files = Array.from(e.target.files);
        const maxFiles = 5 - formPhotos.length;
        const toAdd = files.slice(0, maxFiles);
        const oversized = toAdd.filter(f => f.size > 512000);
        if (oversized.length) toast.error(`${oversized.length} file melebihi 500KB`);
        const valid = toAdd.filter(f => f.size <= 512000);

        let rejectedCount = 0;
        for (const file of valid) {
            const geo = await readGeoTag(file);
            if (!geo) {
                rejectedCount++;
                continue;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                setFormPhotos(prev => [...prev, {
                    name: file.name,
                    url: ev.target.result,
                    geo: geo,
                    size: file.size,
                }]);
            };
            reader.readAsDataURL(file);
        }
        if (rejectedCount > 0) {
            toast.error(`${rejectedCount} foto ditolak karena tidak memiliki data geotagging. Pastikan GPS aktif saat memotret.`);
        }
        e.target.value = '';
    };

    const removePhoto = (idx) => {
        setFormPhotos(prev => {
            const removed = prev[idx];
            // If this is an existing server photo (has id), track it for deletion
            if (removed && removed.id && editItem) {
                setDeletedPhotoIds(ids => [...ids, removed.id]);
            }
            return prev.filter((_, i) => i !== idx);
        });
    };

    // ===== FORM HANDLERS =====
    const resetForm = () => {
        setFormSekolah('');
        setFormData({ masaBangunan: 'A', jenisPrasarana: JENIS_PRASARANA[0], namaRuang: '', lantai: 1, panjang: '', lebar: '', kondisi: KONDISI[0], keterangan: '' });
        setFormPhotos([]);
        setDeletedPhotoIds([]);
    };

    const handleSave = async () => {
        if (!guard(editItem ? 'edit' : 'tambah')) return;
        const sekolah = sekolahList.find(s => s.nama === formSekolah);
        if (!sekolah) { toast.error('Pilih sekolah terlebih dahulu'); return; }
        if (!formData.namaRuang) { toast.error('Nama ruang harus diisi'); return; }
        const panjang = parseFloat(formData.panjang) || 0;
        const lebar = parseFloat(formData.lebar) || 0;
        if (!panjang || !lebar) { toast.error('Panjang dan lebar harus diisi'); return; }
        if (!editItem && formPhotos.length < 5) { toast.error('Wajib upload 5 foto dengan geotagging'); return; }

        try {
            toast.loading(editItem ? 'Memperbarui data...' : 'Menyimpan data...', { id: 'save' });

            if (editItem) {
                const updateData = {
                    namaRuang: formData.namaRuang,
                    lantai: formData.lantai,
                    panjang,
                    lebar,
                    kondisi: formData.kondisi,
                    keterangan: formData.keterangan,
                    masaBangunan: formData.masaBangunan,
                    jenisPrasarana: formData.jenisPrasarana,
                };
                await sarprasApi.update(editItem.id, updateData);

                // Delete removed photos from server first
                for (const fotoId of deletedPhotoIds) {
                    try {
                        await sarprasApi.removeFoto(editItem.id, fotoId);
                    } catch (e) {
                        console.warn('Failed to delete photo', fotoId, e);
                    }
                }

                // Then upload new photos (only base64 data URLs)
                for (const photo of formPhotos) {
                    if (photo.url && photo.url.startsWith('data:')) {
                        const fData = new FormData();
                        const blob = await (await fetch(photo.url)).blob();
                        fData.append('foto', blob, photo.name);
                        if (photo.geo?.lat) fData.append('geoLat', photo.geo.lat);
                        if (photo.geo?.lng) fData.append('geoLng', photo.geo.lng);
                        await sarprasApi.addFoto(editItem.id, fData);
                    }
                }
                toast.success('Data berhasil diperbarui. Foto sedang diproses ke GDrive...', { id: 'save', duration: 4000 });
            } else {
                const fData = new FormData();
                fData.append('sekolahId', sekolah.id);
                fData.append('namaRuang', formData.namaRuang);
                fData.append('lantai', formData.lantai);
                fData.append('panjang', panjang);
                fData.append('lebar', lebar);
                fData.append('kondisi', formData.kondisi);
                fData.append('keterangan', formData.keterangan);
                fData.append('masaBangunan', formData.masaBangunan);
                fData.append('jenisPrasarana', formData.jenisPrasarana);
                // Sekolah info for storage folder hierarchy
                if (sekolah.kecamatan) fData.append('kecamatan', sekolah.kecamatan);
                if (sekolah.nama) fData.append('namaSekolah', sekolah.nama);
                if (sekolah.npsn) fData.append('npsn', sekolah.npsn);

                for (const photo of formPhotos) {
                    const blob = await (await fetch(photo.url)).blob();
                    fData.append('fotos', blob, photo.name);
                    if (photo.geo?.lat) fData.append(`geo_lat_${photo.name}`, photo.geo.lat);
                    if (photo.geo?.lng) fData.append(`geo_lng_${photo.name}`, photo.geo.lng);
                }

                await sarprasApi.create(fData);
                toast.success('Data berhasil disimpan. Foto sedang diproses ke GDrive...', { id: 'save', duration: 4000 });
            }

            setShowAddModal(false);
            setEditItem(null);
            resetForm();
            if (refetchSarpras) refetchSarpras();
        } catch (e) {
            toast.error(e.message || 'Gagal menyimpan data', { id: 'save' });
        }
    };

    // ===== BATCH HANDLERS =====
    const handleBatchDownloadTemplate = () => {
        const templateData = [
            { 'NPSN': '20301234', 'Masa Bangunan': 'A', 'Jenis Prasarana': 'Ruang Kelas', 'Nama Ruang': 'Ruang Kelas 1', 'Lantai': 1, 'Panjang': 7, 'Lebar': 8, 'Kondisi': 'BAIK', 'Keterangan': '' },
            { 'NPSN': '20301234', 'Masa Bangunan': 'A', 'Jenis Prasarana': 'Ruang Kelas', 'Nama Ruang': 'Ruang Kelas 2', 'Lantai': 1, 'Panjang': 7, 'Lebar': 8, 'Kondisi': 'RUSAK RINGAN', 'Keterangan': 'Atap bocor' },
            { 'NPSN': '20301234', 'Masa Bangunan': 'B', 'Jenis Prasarana': 'Toilet', 'Nama Ruang': 'Toilet Siswa 1', 'Lantai': 1, 'Panjang': 2, 'Lebar': 1.5, 'Kondisi': 'BAIK', 'Keterangan': '' },
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        ws['!cols'] = [
            { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 20 },
            { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 20 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template_Sarpras');
        XLSX.writeFile(wb, 'Template_Batch_Sarpras.xlsx');
    };

    const handleBatchFileImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsBatchImporting(true);
        toast.loading('Membaca file Excel...', { id: 'batch-import' });
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            if (jsonData.length === 0) {
                toast.error('File Excel kosong', { id: 'batch-import' });
                return;
            }

            // Parse Excel → raw items dengan NPSN (server akan resolve ke sekolahId)
            const items = jsonData.map((origRow, index) => {
                const row = {};
                for (const key in origRow) row[key.toLowerCase().trim()] = origRow[key];
                return {
                    npsn: (row['npsn'] || '').toString().trim(),
                    masaBangunan: (row['masa bangunan'] || row['masa'] || row['masabangunan'] || row['masa_bangunan'] || '').toString().trim(),
                    jenisPrasarana: (row['jenis prasarana'] || row['jenisprasarana'] || row['jenis'] || row['jenis_prasarana'] || '').toString().trim() || 'Ruang Kelas',
                    namaRuang: (row['nama ruang'] || row['namaruang'] || row['ruang'] || row['nama_ruang'] || '').toString().trim().replace(/\//g, '') || `Ruang ${index + 1}`,
                    lantai: parseInt(row['lantai'] || row['lt'] || 1) || 1,
                    panjang: parseFloat(row['panjang'] || row['p'] || 0) || 0,
                    lebar: parseFloat(row['lebar'] || row['l'] || 0) || 0,
                    kondisi: (row['kondisi'] || 'BAIK').toString().trim().toUpperCase(),
                    keterangan: (row['keterangan'] || row['ket'] || '').toString().trim(),
                };
            });

            // Kirim ke server per chunk 500 (server resolve NPSN dari DB)
            const CHUNK_SIZE = 500;
            const total = items.length;
            let totalSaved = 0;
            let totalSkipped = 0;
            let allSkippedNpsn = new Set();

            toast.loading(`Menyimpan 0/${total} data...`, { id: 'batch-import' });

            for (let i = 0; i < items.length; i += CHUNK_SIZE) {
                const chunk = items.slice(i, i + CHUNK_SIZE);
                const res = await sarprasApi.batchCreateByNpsn({ items: chunk });
                totalSaved += res.count || 0;
                totalSkipped += res.skipped || 0;
                if (res.skippedNpsn) res.skippedNpsn.forEach(n => allSkippedNpsn.add(n));
                toast.loading(`Menyimpan ${totalSaved}/${total} data...`, { id: 'batch-import' });
            }

            if (totalSkipped > 0) {
                const npsnList = [...allSkippedNpsn].slice(0, 10).join(', ');
                toast(`${totalSaved} disimpan, ${totalSkipped} dilewati.\nNPSN tidak ditemukan: ${npsnList}${allSkippedNpsn.size > 10 ? '...' : ''}`, { id: 'batch-import', icon: '⚠️', duration: 8000 });
            } else {
                toast.success(`${totalSaved} data sarpras berhasil disimpan`, { id: 'batch-import' });
            }
            if (refetchSarpras) refetchSarpras();
        } catch (err) {
            toast.error(err.message || 'Gagal membaca file', { id: 'batch-import' });
        } finally {
            setIsBatchImporting(false);
            if (batchFileRef.current) batchFileRef.current.value = '';
        }
    };

    const saveBatchRows = async (rows) => {
        if (rows.length === 0) { toast.error('Tidak ada data untuk disimpan'); return; }

        // Group by sekolahId
        const groups = {};
        rows.forEach(r => {
            if (!groups[r.sekolahId]) groups[r.sekolahId] = [];
            groups[r.sekolahId].push(r);
        });

        const CHUNK_SIZE = 500;
        const total = rows.length;
        let totalSaved = 0;

        try {
            toast.loading(`Menyimpan 0/${total} data...`, { id: 'batch-save' });

            for (const [sekolahId, items] of Object.entries(groups)) {
                for (let i = 0; i < items.length; i += CHUNK_SIZE) {
                    const chunk = items.slice(i, i + CHUNK_SIZE);
                    const res = await sarprasApi.batchCreate({ sekolahId: Number(sekolahId), items: chunk });
                    totalSaved += res.count || chunk.length;
                    toast.loading(`Menyimpan ${totalSaved}/${total} data...`, { id: 'batch-save' });
                }
            }

            toast.success(`${totalSaved} data sarpras berhasil disimpan`, { id: 'batch-save' });
            if (refetchSarpras) refetchSarpras();
        } catch (e) {
            toast.error(`Gagal di ${totalSaved}/${total}: ${e.message}`, { id: 'batch-save', duration: 5000 });
        }
    };

    const handleEdit = (item) => {
        if (!guard('edit')) return;
        setEditItem(item);
        setFormSekolah(item.namaSekolah);
        setFormData({ masaBangunan: item.masaBangunan, jenisPrasarana: item.jenisPrasarana, namaRuang: item.namaRuang, lantai: item.lantai, panjang: item.panjang, lebar: item.lebar, kondisi: item.kondisi, keterangan: item.keterangan });
        setFormPhotos(item.foto || []);
        setDeletedPhotoIds([]);
        setShowAddModal(true);
    };

    // ===== UPDATED DELETE HANDLER =====
    const performDelete = async () => {
        try {
            toast.loading('Menghapus data...', { id: 'delete' });
            await sarprasApi.delete(deleteConfirm.id);
            toast.success('Data berhasil dihapus. File GDrive sedang dihapus...', { id: 'delete', duration: 4000 });
            setDeleteConfirm(null);
            if (refetchSarpras) refetchSarpras();
        } catch (e) {
            toast.error(e.message || 'Gagal menghapus data', { id: 'delete' });
        }
    };

    const handleExport = (format) => {
        try {
            if (format === 'excel') { exportToExcel(filtered, exportCols, 'data_sarpras'); toast.success('Berhasil ekspor Excel'); }
            else if (format === 'csv') { exportToCSV(filtered, exportCols, 'data_sarpras'); toast.success('Berhasil ekspor CSV'); }
            else if (format === 'pdf') { exportToPDF(filtered, exportCols, 'data_sarpras', 'Data Sarana Prasarana'); toast.success('Berhasil ekspor PDF'); }
        } catch (err) { toast.error('Gagal ekspor: ' + err.message); }
        setShowExport(false);
    };

    const schoolNames = sekolahList.map(s => s.nama);
    const renderSchoolOption = (name) => {
        const sch = sekolahList.find(s => s.nama === name);
        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span>{name}</span>
                {sch && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{safeStr(sch.npsn)} • {safeStr(sch.kecamatan)}</span>}
            </div>
        );
    };

    const filterableColumns = ALL_COLUMNS.filter(c => c.filterable);
    const activeFilterCount = Object.values(headerFilters).filter(v => v).length;

    const renderCell = (col, item, idx) => {
        switch (col.key) {
            case 'no': return (page - 1) * perPage + idx + 1;
            case 'foto': {
                const photos = item.foto || [];
                if (photos.length === 0) return <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}><Image size={14} /></div>;
                return (
                    <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => { setPhotoModal(item); setPhotoIdx(0); }}>
                        <img src={photos[0].url} alt=""
                            onError={(e) => { if (photos[0].proxyUrl && e.target.src !== photos[0].proxyUrl) e.target.src = photos[0].proxyUrl; }}
                            style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
                        {photos.length > 1 && (
                            <span style={{ position: 'absolute', bottom: -2, right: -4, background: 'var(--accent-blue)', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '1px 4px', borderRadius: 'var(--radius-full)', lineHeight: 1.3 }}>+{photos.length - 1}</span>
                        )}
                    </div>
                );
            }
            case 'namaSekolah': return <div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.namaSekolah}</div>;
            case 'kondisi': return getConditionBadge(item.kondisi);
            case 'keterangan': return <div style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.keterangan}</div>;
            case 'lastFotoAt': return item.lastFotoAt ? <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(item.lastFotoAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span> : <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>-</span>;
            case 'jenisPrasarana': return <div style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.jenisPrasarana}</div>;
            case 'bintang':
                return (
                    <button type="button"
                        style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: item.bintang ? 'var(--accent-yellow)' : 'var(--border-color)', transition: 'all 150ms', padding: '4px 6px', lineHeight: 1, borderRadius: '4px', outline: 'none' }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.transform = 'scale(1.2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                        onClick={(e) => handleStar(e, item)} title={item.bintang ? 'Hapus prioritas' : 'Tandai prioritas'}>★</button>
                );
            case 'aksi':
                return (
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => { setViewItem(item); setPhotoIdx(0); }} title="Lihat"><Eye size={16} /></button>
                        {!readOnly && <button className="btn-icon" onClick={() => handleEdit(item)} title="Edit"><Edit size={16} /></button>}
                        {!readOnly && (
                            <button
                                className="btn-icon"
                                onClick={() => {
                                    if (!guard('hapus')) return;
                                    setDeleteConfirm(item);
                                }}
                                title="Hapus"
                                style={{ color: 'var(--accent-red)' }}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                );
            case 'panjang': return String(item.panjang ?? 0).replace('.', ',');
            case 'lebar': return String(item.lebar ?? 0).replace('.', ',');
            case 'luas': return fmtLuas(item.luas || (item.panjang || 0) * (item.lebar || 0));
            default: return item[col.key] ?? '-';
        }
    };

    const getPaginationRange = () => {
        const range = [];
        const maxShow = 5;
        let start = Math.max(1, page - Math.floor(maxShow / 2));
        let end = Math.min(totalPages, start + maxShow - 1);
        if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
        for (let i = start; i <= end; i++) range.push(i);
        return range;
    };

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Data Sarpras</h1>
                    <p>Kelola data sarana dan prasarana sekolah</p>
                </div>
                <div className="page-header-right">
                    {!readOnly && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" onClick={() => { if (!guard('tambah')) return; resetForm(); setEditItem(null); setShowAddModal(true); }} disabled={isRestricted('tambah')}
                                style={isRestricted('tambah') ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
                                <Plus size={16} /> Tambah Data
                            </button>
                            {user?.role !== 'Sekolah' && (
                            <>
                            <button className="btn btn-outline" onClick={handleBatchDownloadTemplate} title="Unduh Template Excel">
                                <FileDown size={16} /> Template Excel
                            </button>
                            <button className="btn btn-outline" onClick={() => batchFileRef.current?.click()} disabled={isBatchImporting} title="Import dari Excel" style={{ background: 'var(--accent-green, #22c55e)', color: '#fff', borderColor: 'var(--accent-green, #22c55e)' }}>
                                <UploadCloud size={16} /> {isBatchImporting ? 'Membaca...' : 'Import Batch'}
                            </button>
                            <input type="file" ref={batchFileRef} onChange={handleBatchFileImport} accept=".xlsx, .xls, .csv" style={{ display: 'none' }} />
                            </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ===== RECAP STATS CARDS ===== */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card total">
                    <div className="stat-label"><Building2 size={14} style={{ color: 'var(--accent-blue)' }} /> Total Data</div>
                    <div className="stat-value">{formatNumber(recapStats.total)}</div>
                </div>
                {user?.role !== 'Sekolah' && (
                <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
                    <div className="stat-label"><Building2 size={14} style={{ color: 'var(--accent-purple)' }} /> Jumlah Sekolah</div>
                    <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>{formatNumber(recapStats.sekolah)}</div>
                </div>
                )}
                <div className="stat-card baik">
                    <div className="stat-label"><CheckCircle size={14} style={{ color: 'var(--status-baik)' }} /> Baik</div>
                    <div className="stat-value" style={{ color: 'var(--status-baik)' }}>{formatNumber(recapStats.baik)}</div>
                </div>
                <div className="stat-card rusak-ringan">
                    <div className="stat-label"><AlertTriangle size={14} style={{ color: 'var(--status-rusak-ringan)' }} /> Rusak Ringan</div>
                    <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{formatNumber(recapStats.rr)}</div>
                </div>
                <div className="stat-card rusak-sedang">
                    <div className="stat-label"><AlertTriangle size={14} style={{ color: 'var(--status-rusak-sedang)' }} /> Rusak Sedang</div>
                    <div className="stat-value" style={{ color: 'var(--accent-orange)' }}>{formatNumber(recapStats.rs)}</div>
                </div>
                <div className="stat-card rusak-berat">
                    <div className="stat-label"><AlertTriangle size={14} style={{ color: 'var(--status-rusak-berat)' }} /> Rusak Berat</div>
                    <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{formatNumber(recapStats.rb)}</div>
                </div>
                {canAccessPriority && (
                    <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-yellow)' }}>
                        <div className="stat-label"><Star size={14} style={{ color: 'var(--accent-yellow)' }} /> Total Prioritas</div>
                        <div className="stat-value" style={{ color: 'var(--accent-yellow)' }}>{formatNumber(recapStats.totalPrioritas)}</div>
                    </div>
                )}
            </div>

            {/* ===== TABLE ===== */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari nama sekolah, NPSN, ruang..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                        </div>

                        <div style={{ position: 'relative' }} ref={filterPanelRef}>
                            <button className={`btn ${activeFilterCount > 0 ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setShowFilterPanel(!showFilterPanel)}>
                                <Filter size={14} /> Filter {activeFilterCount > 0 && <span style={{ background: '#fff', color: 'var(--accent-blue)', borderRadius: 'var(--radius-full)', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, marginLeft: 2 }}>{activeFilterCount}</span>}
                            </button>

                            {showFilterPanel && (
                                <div className="dropdown-menu" style={{
                                    left: '100%',
                                    top: 0,
                                    marginLeft: 8,
                                    bottom: 'auto',
                                    right: 'auto',
                                    minWidth: 900,
                                    maxWidth: 950,
                                    padding: 16,
                                    zIndex: 50
                                }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Filter Data</span>
                                        {activeFilterCount > 0 && (
                                            <button style={{ fontSize: '0.7rem', color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer' }}
                                                onClick={() => { setHeaderFilters({ jenjang: '', kecamatan: '', kondisi: '', jenisPrasarana: '', bintang: '' }); setPage(1); }}>Reset Filter</button>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 16px' }}>
                                        {filterableColumns.map(col => (
                                            <div key={col.key}>
                                                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{col.filterLabel || col.label}</label>
                                                {col.filterType === 'searchable' ? (
                                                    <SearchableSelect
                                                        options={col.filterOptions}
                                                        value={headerFilters[col.key] || ''}
                                                        onChange={v => { setHeaderFilters(prev => ({ ...prev, [col.key]: v })); setPage(1); }}
                                                        placeholder={`Semua ${col.filterLabel || col.label}`}
                                                        searchPlaceholder={`Cari ${col.filterLabel || col.label}...`}
                                                    />
                                                ) : (
                                                    <select
                                                        value={headerFilters[col.key] || ''}
                                                        onChange={e => { setHeaderFilters(prev => ({ ...prev, [col.key]: e.target.value })); setPage(1); }}
                                                        style={{ width: '100%', padding: '7px 10px', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
                                                        <option value="">Semua</option>
                                                        {col.filterOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Tampil
                            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            data
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <div style={{ position: 'relative' }} ref={colPickerRef}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowColPicker(!showColPicker)}>
                                <Columns size={14} /> Kolom
                            </button>
                            {showColPicker && (
                                <div className="dropdown-menu" style={{ left: 'auto', right: 0, minWidth: 200, maxHeight: 320, overflowY: 'auto' }}>
                                    {ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => (
                                        <label key={col.key} className="dropdown-item" style={{ cursor: 'pointer', gap: 8, fontSize: '0.8rem' }}>
                                            <input type="checkbox" checked={visibleCols.includes(col.key)}
                                                onChange={() => toggleCol(col.key)} style={{ accentColor: 'var(--accent-blue)' }} />
                                            {col.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="export-dropdown" ref={exportRef}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(!showExport)}>
                                <Download size={14} /> Ekspor <ChevronDown size={12} />
                            </button>
                            {showExport && (
                                <div className="dropdown-menu">
                                    <button className="dropdown-item" onClick={() => handleExport('excel')}>
                                        <span className="export-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}><FileSpreadsheet size={14} /></span>
                                        Excel (.xlsx)
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExport('csv')}>
                                        <span className="export-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}><FileDown size={14} /></span>
                                        CSV
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExport('pdf')}>
                                        <span className="export-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}><FileText size={14} /></span>
                                        PDF
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.75rem', tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
                        <thead>
                            <tr>
                                {activeColumns.map(col => (
                                    <th key={col.key} style={{ textAlign: 'center', verticalAlign: 'middle', width: col.width, padding: '8px 6px', whiteSpace: 'nowrap' }}>{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paged.map((item, i) => (
                                <tr key={item.id}>
                                    {activeColumns.map(col => (
                                        <td key={col.key} style={{ textAlign: ['no', 'lantai', 'panjang', 'lebar', 'luas', 'foto', 'bintang', 'masaBangunan'].includes(col.key) ? 'center' : undefined, padding: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {renderCell(col, item, i)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {paged.length === 0 && (
                                <tr><td colSpan={activeColumns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Tidak ada data ditemukan</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="table-pagination">
                    <div className="table-pagination-info" style={{ fontSize: '0.8rem' }}>Menampilkan {filtered.length > 0 ? (page - 1) * perPage + 1 : 0}-{Math.min(page * perPage, filtered.length)} dari {filtered.length} data</div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setPage(1)} disabled={page === 1}>«</button>
                        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>‹</button>
                        {getPaginationRange().map(p => (
                            <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
                        ))}
                        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>›</button>
                        <button onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
                    </div>
                </div>
            </div>

            {/* ===== ADD / EDIT MODAL ===== */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditItem(null); resetForm(); }}>
                    <div className="modal" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{editItem ? 'Edit Data Sarpras' : 'Tambah Data Sarpras'}</div>
                            <button className="modal-close" onClick={() => { setShowAddModal(false); setEditItem(null); resetForm(); }}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            {/* Form content remains the same */}
                            <div className="form-group">
                                <label className="form-label">Cari Sekolah *</label>
                                <SearchableSelect
                                    options={schoolNames}
                                    value={formSekolah}
                                    onChange={setFormSekolah}
                                    placeholder="-- Pilih Sekolah --"
                                    searchPlaceholder="Ketik nama sekolah atau NPSN..."
                                    size="xl"
                                    renderOption={renderSchoolOption}
                                />
                            </div>
                            {formSekolah && (() => {
                                const sch = sekolahList.find(s => s.nama === formSekolah);
                                return sch && (
                                    <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.06)', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                        <span><b>NPSN:</b> {safeStr(sch.npsn)}</span>
                                        <span><b>Kecamatan:</b> {safeStr(sch.kecamatan)}</span>
                                        <span><b>Jenjang:</b> {safeStr(sch.jenjang)}</span>
                                        <span><b>Kepala Sekolah:</b> {sch.kepsek}</span>
                                    </div>
                                );
                            })()}

                            {formSekolah && (
                                <>
                                    <div className="form-row-3">
                                        <div className="form-group">
                                            <label className="form-label">Masa Bangunan</label>
                                            <select className="form-select" value={formData.masaBangunan} onChange={e => setFormData({ ...formData, masaBangunan: e.target.value })}>
                                                {MASA_BANGUNAN.map(m => <option key={m} value={m}>Bangunan {m}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Jenis Prasarana</label>
                                            <select className="form-select" value={formData.jenisPrasarana} onChange={e => setFormData({ ...formData, jenisPrasarana: e.target.value })}>
                                                {JENIS_PRASARANA.map(j => <option key={j} value={j}>{j}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Lantai</label>
                                            <select className="form-select" value={formData.lantai} onChange={e => setFormData({ ...formData, lantai: parseInt(e.target.value) })}>
                                                {LANTAI_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Nama Ruang *</label>
                                        <input className="form-input" value={formData.namaRuang} onChange={e => { const v = e.target.value.replace(/\//g, ''); setFormData({ ...formData, namaRuang: v }); }} placeholder="Contoh: Ruang Kelas 1A" />
                                    </div>
                                    <div className="form-row-3">
                                        <div className="form-group">
                                            <label className="form-label">Panjang (m) *</label>
                                            <input className="form-input" type="number" step="0.01" value={formData.panjang} onChange={e => setFormData({ ...formData, panjang: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Lebar (m) *</label>
                                            <input className="form-input" type="number" step="0.01" value={formData.lebar} onChange={e => setFormData({ ...formData, lebar: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Luas (m²)</label>
                                            <input className="form-input" readOnly value={fmtLuas((parseFloat(formData.panjang) || 0) * (parseFloat(formData.lebar) || 0))} style={{ background: 'var(--bg-primary)' }} />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Kondisi</label>
                                            <select className="form-select" value={formData.kondisi} onChange={e => setFormData({ ...formData, kondisi: e.target.value })}>
                                                {KONDISI.map(k => <option key={k} value={k}>{k}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Keterangan</label>
                                            <input className="form-input" value={formData.keterangan} onChange={e => setFormData({ ...formData, keterangan: e.target.value })} placeholder="Keterangan kerusakan" />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Foto (Maks. 5 × 500KB) — Foto dengan geotagging akan otomatis terbaca <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                                        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
                                        <div className="file-upload" onClick={() => formPhotos.length < 5 && fileInputRef.current.click()}
                                            style={{ opacity: formPhotos.length >= 5 ? 0.5 : 1, cursor: formPhotos.length >= 5 ? 'not-allowed' : 'pointer' }}>
                                            <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: 6 }} />
                                            <div className="file-upload-text">{formPhotos.length >= 5 ? 'Maksimum 5 foto tercapai' : 'Klik untuk upload foto'}</div>
                                            <div className="file-upload-limit" style={{ fontSize: '0.75rem' }}>{formPhotos.length}/5 foto • Maks 500KB per file</div>
                                        </div>
                                        {formPhotos.length > 0 && (
                                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {formPhotos.map((p, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem' }}>
                                                        <img src={p.url} alt={p.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', display: 'flex', gap: 8, marginTop: 2 }}>
                                                                <span>{(p.size / 1024).toFixed(0)} KB</span>
                                                                {p.geo ? (
                                                                    <a href={`https://www.google.com/maps?q=${p.geo.lat},${p.geo.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                                                                        <MapPin size={10} /> {p.geo.lat.toFixed(5)}, {p.geo.lng.toFixed(5)}
                                                                    </a>
                                                                ) : (
                                                                    <span style={{ color: 'var(--accent-orange)' }}>Tidak ada geotagging</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button onClick={() => removePhoto(i)}
                                                            style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => { setShowAddModal(false); setEditItem(null); resetForm(); }}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!formSekolah}>
                                <Save size={14} /> {editItem ? 'Simpan Perubahan' : 'Simpan Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== VIEW DETAIL MODAL ===== */}
            {viewItem && (
                <div className="modal-overlay" onClick={() => setViewItem(null)}>
                    <div className="modal" style={{ maxWidth: '94vw', width: '94vw', maxHeight: 'calc(100vh - 80px)', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Detail Sarpras</div>
                            <button className="modal-close" onClick={() => setViewItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                            {viewItem.foto && viewItem.foto.length > 0 ? (
                                <div style={{ marginBottom: 20, flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                    <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000', flex: '1 1 auto', minHeight: 450, maxHeight: 'calc(100vh - 350px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img src={viewItem.foto[photoIdx]?.url} alt={`Foto ${photoIdx + 1}`}
                                            onError={(e) => { const f = viewItem.foto[photoIdx]; if (f?.proxyUrl && e.target.src !== f.proxyUrl) e.target.src = f.proxyUrl; }}
                                            style={{ maxHeight: '100%', maxWidth: '100%', width: '100%', height: '100%', objectFit: 'contain', cursor: 'zoom-in' }}
                                            onClick={() => { setPhotoModal(viewItem); }} />
                                        {viewItem.foto.length > 1 && (
                                            <>
                                                <button onClick={() => setPhotoIdx(p => p > 0 ? p - 1 : viewItem.foto.length - 1)}
                                                    style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                    <ChevronLeft size={18} />
                                                </button>
                                                <button onClick={() => setPhotoIdx(p => p < viewItem.foto.length - 1 ? p + 1 : 0)}
                                                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                    <ChevronRight size={18} />
                                                </button>
                                            </>
                                        )}
                                        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem' }}>
                                            {photoIdx + 1} / {viewItem.foto.length}
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                        <span style={{ fontWeight: 500 }}>{viewItem.foto[photoIdx]?.name || `Foto ${photoIdx + 1}`}</span>
                                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span>{viewItem.namaRuang} • {viewItem.jenisPrasarana}</span>
                                            {viewItem.foto[photoIdx]?.geo && (
                                                <a href={`https://www.google.com/maps?q=${viewItem.foto[photoIdx].geo.lat},${viewItem.foto[photoIdx].geo.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 3, marginLeft: 8, textDecoration: 'none' }}>
                                                    <MapPin size={10} /> {viewItem.foto[photoIdx].geo.lat.toFixed(5)}, {viewItem.foto[photoIdx].geo.lng.toFixed(5)}
                                                </a>
                                            )}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', paddingBottom: 6, flexShrink: 0 }}>
                                        {viewItem.foto.map((f, i) => (
                                            <div key={i} onClick={() => setPhotoIdx(i)}
                                                style={{ width: 72, height: 72, minWidth: 72, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: i === photoIdx ? '2px solid var(--accent-blue)' : '2px solid transparent', cursor: 'pointer', opacity: i === photoIdx ? 1 : 0.6, transition: 'all 150ms' }}>
                                                <img src={f.url} alt={f.name} onError={(e) => { if (f.proxyUrl && e.target.src !== f.proxyUrl) e.target.src = f.proxyUrl; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)', marginBottom: 20, color: 'var(--text-secondary)', gap: 8 }}>
                                    <Image size={20} /> Belum ada foto
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Nama Sekolah</div><div style={{ fontWeight: 500 }}>{viewItem.namaSekolah}</div></div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>NPSN</div><div>{safeStr(viewItem.npsn)}</div></div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Jenjang</div><div>{safeStr(viewItem.jenjang)}</div></div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Kecamatan</div><div>{safeStr(viewItem.kecamatan)}</div></div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Masa Bangunan</div><div>Bangunan {viewItem.masaBangunan}</div></div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Jenis Prasarana</div><div>{viewItem.jenisPrasarana}</div></div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Nama Ruang</div><div style={{ fontWeight: 500 }}>{viewItem.namaRuang}</div></div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Lantai</div><div>{viewItem.lantai}</div></div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Ukuran (P × L)</div><div>{String(viewItem.panjang).replace('.', ',')} m × {String(viewItem.lebar).replace('.', ',')} m = <b>{fmtLuas(viewItem.luas || viewItem.panjang * viewItem.lebar)} m²</b></div></div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Kondisi</div>{getConditionBadge(viewItem.kondisi)}</div>
                                <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Keterangan</div><div>{viewItem.keterangan || '-'}</div></div>
                                {canAccessPriority && (
                                    <div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Prioritas</div>
                                        <span style={{ fontSize: '1.25rem', color: viewItem.bintang ? 'var(--accent-yellow)' : 'var(--border-color)' }}>★</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 6 }}>{viewItem.bintang ? 'Ditandai prioritas' : 'Tidak diprioritaskan'}</span>
                                    </div>
                                )}
                            </div>
                        </div>
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

                            <h3 style={{ fontSize: '1.15rem', marginBottom: 8, color: 'var(--text-primary)' }}>Hapus Data Sarpras?</h3>
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
                                <div style={{ fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>{deleteConfirm.namaRuang}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{deleteConfirm.namaSekolah} - {deleteConfirm.jenisPrasarana}</div>
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

            {/* ===== PHOTO LIGHTBOX from Table Thumbnails ===== */}
            {photoModal && !viewItem && (
                <div className="modal-overlay" onClick={() => setPhotoModal(null)} style={{ background: 'rgba(0,0,0,0.92)', zIndex: 9999, padding: '12px' }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPhotoModal(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 20, transition: 'background 200ms' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}><X size={22} /></button>

                        <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            <img src={photoModal.foto[photoIdx]?.url} alt="" onError={(e) => { const f = photoModal.foto[photoIdx]; if (f?.proxyUrl && e.target.src !== f.proxyUrl) e.target.src = f.proxyUrl; }} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} />

                            {photoModal.foto.length > 1 && (
                                <>
                                    <button onClick={() => setPhotoIdx(p => p > 0 ? p - 1 : photoModal.foto.length - 1)}
                                        style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 15, transition: 'all 200ms', backdropFilter: 'blur(4px)' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}>
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button onClick={() => setPhotoIdx(p => p < photoModal.foto.length - 1 ? p + 1 : 0)}
                                        style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 15, transition: 'all 200ms', backdropFilter: 'blur(4px)' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}>
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}

                            {photoModal.foto.length > 1 && (
                                <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '5px 16px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 500, backdropFilter: 'blur(4px)' }}>
                                    {photoIdx + 1} / {photoModal.foto.length}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: 10, padding: '10px 16px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
                            <div>
                                <b>{photoModal.namaRuang}</b> • {photoModal.jenisPrasarana} • {photoModal.namaSekolah}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span>{photoIdx + 1}/{photoModal.foto.length}</span>
                                {photoModal.foto[photoIdx]?.geo && (
                                    <a href={`https://www.google.com/maps?q=${photoModal.foto[photoIdx].geo.lat},${photoModal.foto[photoIdx].geo.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                                        <MapPin size={11} /> {photoModal.foto[photoIdx].geo.lat.toFixed(5)}, {photoModal.foto[photoIdx].geo.lng.toFixed(5)}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== BATCH PREVIEW MODAL ===== */}
            {showBatchModal && batchRows.length > 0 && (
                <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, width: '95vw' }}>
                        <div className="modal-header">
                            <div className="modal-title">Preview Import Batch Sarpras ({batchRows.length} data)</div>
                            <button className="modal-close" onClick={() => setShowBatchModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table" style={{ fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 36 }}>No</th>
                                            <th style={{ width: 100 }}>NPSN</th>
                                            <th style={{ width: 160 }}>Nama Sekolah</th>
                                            <th style={{ width: 80 }}>Kecamatan</th>
                                            <th style={{ width: 50 }}>Masa</th>
                                            <th style={{ width: 130 }}>Jenis Prasarana</th>
                                            <th style={{ width: 140 }}>Nama Ruang</th>
                                            <th style={{ width: 36 }}>Lt</th>
                                            <th style={{ width: 55 }}>P(m)</th>
                                            <th style={{ width: 55 }}>L(m)</th>
                                            <th style={{ width: 55 }}>Luas</th>
                                            <th style={{ width: 100 }}>Kondisi</th>
                                            <th style={{ width: 110 }}>Ket</th>
                                            <th style={{ width: 36 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batchRows.map((row, idx) => (
                                            <tr key={idx}>
                                                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                                <td>{row.npsn}</td>
                                                <td><div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.namaSekolah}</div></td>
                                                <td>{row.kecamatan}</td>
                                                <td style={{ textAlign: 'center' }}>{row.masaBangunan}</td>
                                                <td><div style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.jenisPrasarana}</div></td>
                                                <td>{row.namaRuang}</td>
                                                <td style={{ textAlign: 'center' }}>{row.lantai}</td>
                                                <td style={{ textAlign: 'right' }}>{String(row.panjang).replace('.', ',')}</td>
                                                <td style={{ textAlign: 'right' }}>{String(row.lebar).replace('.', ',')}</td>
                                                <td style={{ textAlign: 'right' }}>{fmtLuas(row.panjang * row.lebar)}</td>
                                                <td>{row.kondisi}</td>
                                                <td><div style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.keterangan}</div></td>
                                                <td>
                                                    <button className="btn-icon" onClick={() => setBatchRows(prev => prev.filter((_, i) => i !== idx))} title="Hapus baris" style={{ color: 'var(--accent-red)', padding: 2 }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {batchRows.length} data dari {[...new Set(batchRows.map(r => r.npsn))].length} sekolah • Foto bisa ditambahkan setelah data tersimpan
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowBatchModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleBatchSave}>
                                <Save size={16} /> Simpan Semua ({batchRows.length} data)
                            </button>
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
        </div>
    );
};

export default DataSarpras;