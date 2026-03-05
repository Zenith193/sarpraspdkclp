import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Download, Eye, Edit, FileSpreadsheet, FileDown, FileText, ChevronDown, ChevronLeft, ChevronRight, Package, Wallet, Save, X, CheckCircle, Clock, Printer, RotateCcw, AlertTriangle, FileCheck } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import useMatrikStore, { naturalSort, formatNumberInput, parseFormattedNumber, fullTerbilang, generateNoBAST } from '../../store/matrikStore';
import { useSekolahData } from '../../data/dataProvider';
import toast from 'react-hot-toast';

// ===== Helpers =====
const currentYear = new Date().getFullYear();

const getKepsekInfo = (npsn, sekolahList) => {
    const s = (sekolahList || []).find(sk => sk.npsn === npsn);
    return s ? { kepsek: s.kepsek, nipKepsek: s.nip, namaSekolah: s.nama } : { kepsek: '-', nipKepsek: '-', namaSekolah: '-' };
};

const computeNilaiBAST = (item, allMatrik, overrides = {}) => {
    const kontrak = overrides.nilaiKontrak ?? item.nilaiKontrak ?? 0;
    const honor = overrides.honor ?? item.honor ?? 0;

    if (item.jenisPengadaan !== 'Pekerjaan Konstruksi') {
        return kontrak;
    }
    let total = kontrak;
    const konstruksiName = (item.namaPaket || '').toLowerCase();
    allMatrik.forEach(m => {
        if (m.id === item.id) return;
        const mName = (m.namaPaket || '').toLowerCase();
        if (m.jenisPengadaan === 'Jasa Konsultansi Perencanaan') {
            if (mName.includes(konstruksiName) || konstruksiName.includes(mName.replace('jasa konsultansi perencanaan', '').trim())) {
                total += m.nilaiKontrak || 0;
            }
        }
        if (m.jenisPengadaan === 'Jasa Konsultansi Pengawasan') {
            if (mName.includes(konstruksiName) || konstruksiName.includes(mName.replace('jasa konsultansi pengawasan', '').trim())) {
                total += m.nilaiKontrak || 0;
            }
        }
    });
    total += honor;
    return total;
};

const formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch (e) { return '-'; }
};

// ===== PDF Template Generator =====
const generateBASTDocument = (item, template) => {
    const win = window.open('', '_blank', 'width=800,height=1000');
    if (!win) { toast.error('Popup diblokir. Izinkan popup untuk generate BAST.'); return; }

    const headerLines = (template?.header || 'BERITA ACARA SERAH TERIMA').split('\n');

    const html = `<!DOCTYPE html>
<html><head><title>BAST - ${item.noBAST}</title>
<style>
  @media print { body { margin: 0; } @page { margin: 1.5cm; } }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; padding: 40px; color: #000; max-width: 800px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #000; padding-bottom: 15px; }
  .header h2 { margin: 0; font-size: 16pt; letter-spacing: 2px; }
  .header h3 { margin: 5px 0 0; font-size: 13pt; font-weight: normal; }
  .template-label { text-align: center; font-size: 10pt; color: #666; margin-bottom: 10px; }
  .nomor { text-align: center; margin: 20px 0; font-weight: bold; font-size: 13pt; }
  table.info { width: 100%; border-collapse: collapse; margin: 15px 0; }
  table.info td { padding: 4px 8px; vertical-align: top; }
  table.info td:first-child { width: 200px; font-weight: 500; }
  .section { margin: 20px 0; }
  .section-title { font-weight: bold; margin-bottom: 8px; text-decoration: underline; }
  .nilai-box { border: 1px solid #000; padding: 12px 16px; margin: 15px 0; background: #f9f9f9; }
  .nilai-box .total { font-size: 14pt; font-weight: bold; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
  .ttd-container { display: flex; justify-content: space-between; margin-top: 60px; }
  .ttd-box { text-align: center; width: 45%; }
  .ttd-box .line { border-bottom: 1px solid #000; height: 60px; margin: 10px 0; }
  .print-btn { position: fixed; top: 10px; right: 10px; padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; z-index: 999; }
  .print-btn:hover { background: #1d4ed8; }
  @media print { .print-btn { display: none; } }
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
<div class="template-label">Template: ${template?.nama || 'Default'}</div>
<div class="header">
  ${headerLines.map((line, i) => i === 0 ? `<h2>${line}</h2>` : `<h3>${line}</h3>`).join('\n  ')}
</div>
<div class="nomor">Nomor : ${item.noBAST}</div>
<div class="section">
  <p>Pada hari ini, kami yang bertanda tangan di bawah ini :</p>
  <table class="info">
    <tr><td>Nama Paket</td><td>: ${item.namaPaket}</td></tr>
    <tr><td>No. Matrik</td><td>: ${item.noMatrik}</td></tr>
    <tr><td>NPSN</td><td>: ${item.npsn}</td></tr>
    <tr><td>Nama Sekolah</td><td>: ${item.namaSekolah}</td></tr>
    <tr><td>Kepala Sekolah</td><td>: ${item.kepsek}</td></tr>
    <tr><td>NIP</td><td>: ${item.nipKepsek}</td></tr>
    <tr><td>Penyedia</td><td>: ${item.penyedia || '-'}</td></tr>
    <tr><td>Sumber Dana</td><td>: ${item.sumberDana || '-'}</td></tr>
    <tr><td>Jenis Pengadaan</td><td>: ${item.jenisPengadaan || '-'}</td></tr>
    <tr><td>Volume</td><td>: ${item.volume || '-'}</td></tr>
  </table>
</div>
<div class="section">
  <div class="section-title">Nilai BAST</div>
  <div class="nilai-box">
    <div>Nilai Kontrak : ${formatCurrency(item.nilaiKontrak || 0)}</div>
    ${item.honor ? `<div>Honor : ${formatCurrency(item.honor)}</div>` : ''}
    <div class="total">Total Nilai BAST : ${formatCurrency(item.nilaiBAST)}</div>
    <div style="font-style:italic;font-size:11pt;margin-top:4px">(${item.terbilangBAST})</div>
  </div>
</div>
<div class="section">
  <p>Demikian Berita Acara Serah Terima ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
</div>
<div class="ttd-container">
  <div class="ttd-box">
    <div><strong>PIHAK PERTAMA</strong></div>
    <div>Penyedia Jasa</div>
    <div class="line"></div>
    <div><strong>${item.penyedia || '...................'}</strong></div>
  </div>
  <div class="ttd-box">
    <div><strong>PIHAK KEDUA</strong></div>
    <div>Kepala Sekolah</div>
    <div class="line"></div>
    <div><strong>${item.kepsek}</strong></div>
    <div>NIP. ${item.nipKepsek}</div>
  </div>
</div>
</body></html>`;

    win.document.write(html);
    win.document.close();
};

// ===== COMPONENT =====
const CreateBAST = () => {
    const { matrikData, bastData, bastTemplates, addBAST, updateBAST, revertBAST } = useMatrikStore();
    const { data: sekolahList } = useSekolahData();

    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewItem, setViewItem] = useState(null);
    const [editItem, setEditItem] = useState(null);
    const [revertTarget, setRevertTarget] = useState(null);
    const [showExport, setShowExport] = useState(false);
    const exportRef = useRef(null);

    // Generate dialog state
    const [generateTarget, setGenerateTarget] = useState(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);

    // Edit form
    const [editForm, setEditForm] = useState({});

    useEffect(() => {
        const handler = (e) => {
            if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Lookup: which matrikIds have been generated
    const generatedMap = useMemo(() => {
        const map = {};
        bastData.forEach(b => { map[b.matrikId] = b; });
        return map;
    }, [bastData]);

    // Count BAST per matrikId for .n numbering
    const bastCountMap = useMemo(() => {
        const map = {};
        bastData.forEach(b => { map[b.matrikId] = (map[b.matrikId] || 0) + 1; });
        return map;
    }, [bastData]);

    // ===== Build enriched BAST data from ALL matrik entries =====
    const enrichedData = useMemo(() => {
        return matrikData
            .slice()
            .sort((a, b) => naturalSort(String(a.noMatrik), String(b.noMatrik)))
            .map(m => {
                const info = getKepsekInfo(m.npsn, sekolahList);
                const bast = generatedMap[m.id];
                const overrides = bast ? { nilaiKontrak: bast.nilaiKontrak, honor: bast.honor } : {};
                const nilaiBAST = computeNilaiBAST(m, matrikData, overrides);
                const n = bast?.bastN || 1;
                return {
                    ...m,
                    kepsek: info.kepsek,
                    nipKepsek: info.nipKepsek,
                    namaSekolah: m.namaSekolah || info.namaSekolah,
                    noBAST: generateNoBAST(m.noMatrik, m.jenisPengadaan, m.sumberDana, m.tahunAnggaran || currentYear, n),
                    nilaiBAST,
                    nilaiKontrak: bast?.nilaiKontrak ?? m.nilaiKontrak,
                    honor: bast?.honor ?? m.honor ?? 0,
                    terbilangBAST: fullTerbilang(nilaiBAST),
                    volume: bast?.volume || '',
                    isGenerated: !!bast,
                    bastId: bast?.id,
                    bastN: n,
                    templateNama: bast?.templateNama || null,
                    tanggalGenerate: bast?.tanggalGenerate || null,
                };
            });
    }, [matrikData, generatedMap]);

    // ===== STATS =====
    const stats = useMemo(() => {
        const totalNilaiBAST = enrichedData.reduce((sum, d) => sum + d.nilaiBAST, 0);
        const totalMatrik = enrichedData.length;
        const generated = enrichedData.filter(d => d.isGenerated).length;
        return { totalMatrik, totalNilaiBAST, generated };
    }, [enrichedData]);

    // ===== FILTER =====
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return enrichedData;
        return enrichedData.filter(d =>
            d.namaPaket?.toLowerCase().includes(q) ||
            d.noMatrik?.toLowerCase().includes(q) ||
            d.npsn?.includes(q) ||
            d.namaSekolah?.toLowerCase().includes(q) ||
            d.kepsek?.toLowerCase().includes(q) ||
            d.noBAST?.toLowerCase().includes(q)
        );
    }, [enrichedData, search]);

    // ===== PAGINATION =====
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const pagedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    useEffect(() => { setCurrentPage(1); }, [search, pageSize]);

    // ===== GENERATE BAST =====
    const handleOpenGenerate = (item) => {
        setGenerateTarget(item);
        // Auto-select matching template
        const match = bastTemplates.find(t =>
            item.jenisPengadaan?.includes(t.jenisCocok) || t.jenisCocok?.includes(item.jenisPengadaan?.split(' ')[0])
        );
        setSelectedTemplateId(match?.id || bastTemplates[0]?.id || null);
    };

    const handleConfirmGenerate = () => {
        if (!generateTarget) return;
        const template = bastTemplates.find(t => t.id === selectedTemplateId);
        const item = generateTarget;
        const n = (bastCountMap[item.id] || 0) + 1;
        const noBAST = generateNoBAST(item.noMatrik, item.jenisPengadaan, item.sumberDana, item.tahunAnggaran || currentYear, n);

        const bastEntry = {
            matrikId: item.id,
            npsn: item.npsn,
            namaSekolah: item.namaSekolah,
            namaPaket: item.namaPaket,
            noMatrik: item.noMatrik,
            noBAST,
            kepsek: item.kepsek,
            nipKepsek: item.nipKepsek,
            nilaiBAST: item.nilaiBAST,
            nilaiKontrak: item.nilaiKontrak,
            volume: item.volume || '',
            honor: item.honor || 0,
            jenisPengadaan: item.jenisPengadaan,
            sumberDana: item.sumberDana,
            penyedia: item.penyedia,
            terbilangBAST: item.terbilangBAST,
            tanggalGenerate: new Date().toISOString(),
            templateId: selectedTemplateId,
            templateNama: template?.nama || 'Default',
            bastN: n,
        };

        addBAST(bastEntry);
        toast.success(`BAST ${noBAST} berhasil di-generate!`);
        setGenerateTarget(null);

        // Open PDF template
        generateBASTDocument({ ...item, noBAST, bastN: n }, template);
    };

    // ===== REVERT =====
    const handleRevert = () => {
        if (!revertTarget) return;
        revertBAST(revertTarget.id);
        toast.success(`BAST ${revertTarget.noBAST} dikembalikan ke "Belum"`);
        setRevertTarget(null);
    };

    // ===== EDIT =====
    const handleOpenEdit = (item) => {
        setEditItem(item);
        setEditForm({
            volume: item.volume || '',
            honor: item.honor || 0,
            nilaiKontrak: item.nilaiKontrak || 0,
            keterangan: '',
        });
    };

    const handleSaveEdit = () => {
        if (!editItem) return;
        const newNilai = computeNilaiBAST(editItem, matrikData, { nilaiKontrak: editForm.nilaiKontrak, honor: editForm.honor });

        // Update matrik honor if changed (original source)
        if (editForm.honor !== (editItem.honor || 0)) {
            useMatrikStore.getState().updateMatrik(editItem.id, { honor: editForm.honor });
        }

        // Update bastData if generated
        if (editItem.bastId) {
            updateBAST(editItem.bastId, {
                volume: editForm.volume,
                honor: editForm.honor,
                nilaiKontrak: editForm.nilaiKontrak,
                nilaiBAST: newNilai,
                terbilangBAST: fullTerbilang(newNilai),
            });
        }

        toast.success('Data BAST berhasil diperbarui');
        setEditItem(null);
    };

    // ===== EXPORT =====
    const EXPORT_COLS = [
        { key: 'noMatrik', header: 'No Matrik' },
        { key: 'namaPaket', header: 'Nama Paket Pekerjaan' },
        { key: 'npsn', header: 'NPSN' },
        { key: 'kepsek', header: 'Kepala Sekolah' },
        { key: 'nipKepsek', header: 'NIP' },
        { key: 'noBAST', header: 'Nomor BAST' },
        { key: 'volume', header: 'Volume' },
        { key: 'nilaiBAST', header: 'Nilai BAST' },
    ];

    const handleExport = (format) => {
        try {
            if (format === 'excel') exportToExcel(filtered, EXPORT_COLS, 'bast');
            else if (format === 'csv') exportToCSV(filtered, EXPORT_COLS, 'bast');
            else if (format === 'pdf') exportToPDF(filtered, EXPORT_COLS, 'bast', 'Data BAST');
            toast.success(`Berhasil ekspor ${format.toUpperCase()}`);
        } catch (err) { toast.error('Gagal ekspor'); }
        setShowExport(false);
    };

    const isAnakan = (noMatrik) => String(noMatrik || '').includes(',');

    return (
        <div>
            {/* ===== STATS ===== */}
            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <Package size={14} style={{ marginRight: 4 }} /> Total Matrik
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>{stats.totalMatrik}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <Wallet size={14} style={{ marginRight: 4 }} /> Total Nilai BAST
                    </div>
                    <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: '1.25rem' }}>{formatCurrency(stats.totalNilaiBAST)}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <CheckCircle size={14} style={{ marginRight: 4 }} /> Sudah Generate
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>{stats.generated} / {stats.totalMatrik}</div>
                </div>
            </div>

            {/* ===== PAGE HEADER ===== */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>BAST</h1>
                    <p>Berita Acara Serah Terima — Generate &amp; kelola data BAST</p>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari paket, NPSN, sekolah, kepsek..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                <option value="10">10</option><option value="15">15</option><option value="50">50</option><option value="100">100</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="export-dropdown" ref={exportRef}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(!showExport)}>
                                <Download size={14} /> Ekspor <ChevronDown size={12} />
                            </button>
                            {showExport && (
                                <div className="dropdown-menu">
                                    <button className="dropdown-item" onClick={() => handleExport('excel')}><FileSpreadsheet size={14} /> Excel</button>
                                    <button className="dropdown-item" onClick={() => handleExport('csv')}><FileDown size={14} /> CSV</button>
                                    <button className="dropdown-item" onClick={() => handleExport('pdf')}><FileText size={14} /> PDF</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ whiteSpace: 'nowrap', width: 40 }}>No</th>
                                <th style={{ whiteSpace: 'nowrap' }}>No Matrik</th>
                                <th style={{ whiteSpace: 'nowrap', minWidth: 200 }}>Nama Paket</th>
                                <th style={{ whiteSpace: 'nowrap' }}>NPSN</th>
                                <th style={{ whiteSpace: 'nowrap', minWidth: 140 }}>Kepala Sekolah</th>
                                <th style={{ whiteSpace: 'nowrap' }}>NIP</th>
                                <th style={{ whiteSpace: 'nowrap', minWidth: 180 }}>Nomor BAST</th>
                                <th style={{ whiteSpace: 'nowrap', width: 80 }}>Volume</th>
                                <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>Nilai BAST</th>
                                <th style={{ whiteSpace: 'nowrap', textAlign: 'center', width: 90 }}>Status</th>
                                <th style={{ whiteSpace: 'nowrap', width: 140 }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedData.map((d, i) => {
                                const anakan = isAnakan(d.noMatrik);
                                return (
                                    <tr key={d.id} style={{
                                        background: anakan ? 'var(--bg-secondary)' : undefined,
                                        fontSize: '0.85rem'
                                    }}>
                                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                        <td style={{ fontFamily: 'monospace', fontWeight: anakan ? 400 : 700, paddingLeft: anakan ? 24 : undefined }}>
                                            {anakan ? '└ ' : ''}{d.noMatrik}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{d.namaPaket}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{d.jenisPengadaan}</div>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{d.npsn || '-'}</td>
                                        <td style={{ fontSize: '0.82rem' }}>{d.kepsek}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{d.nipKepsek}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{d.noBAST}</td>
                                        <td style={{ fontSize: '0.82rem', textAlign: 'center' }}>{d.volume || '-'}</td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: d.jenisPengadaan === 'Pekerjaan Konstruksi' ? 700 : 400, color: d.jenisPengadaan === 'Pekerjaan Konstruksi' ? 'var(--accent-green)' : undefined }}>
                                            {formatCurrency(d.nilaiBAST)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {d.isGenerated ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 600, background: '#d1fae5', color: '#059669' }}>
                                                    <CheckCircle size={12} /> Generated
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 600, background: '#fef3c7', color: '#d97706' }}>
                                                    <Clock size={12} /> Belum
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                                                {!d.isGenerated ? (
                                                    <button className="btn btn-primary btn-sm" onClick={() => handleOpenGenerate(d)} title="Generate BAST"
                                                        style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                                                        <Printer size={12} /> Generate
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button className="btn-icon" onClick={() => {
                                                            const tpl = bastTemplates.find(t => t.id === (generatedMap[d.id]?.templateId));
                                                            generateBASTDocument(d, tpl);
                                                        }} title="Cetak Ulang" style={{ color: 'var(--accent-blue)' }}>
                                                            <Printer size={16} />
                                                        </button>
                                                        <button className="btn-icon" onClick={() => setRevertTarget(d)} title="Kembalikan ke Belum" style={{ color: 'var(--accent-orange, #f59e0b)' }}>
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    </>
                                                )}
                                                <button className="btn-icon" onClick={() => handleOpenEdit(d)} title="Edit"><Edit size={16} /></button>
                                                <button className="btn-icon" onClick={() => setViewItem(d)} title="Detail"><Eye size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {pagedData.length === 0 && (
                                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, fontSize: '0.9rem' }}>
                                    Tidak ada data. Tambahkan paket di Matriks Kegiatan.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="table-pagination">
                    <div className="table-pagination-info">
                        Menampilkan {filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} data
                    </div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem' }}>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            {/* ===== GENERATE DIALOG (Pilih Template) ===== */}
            {generateTarget && (
                <div className="modal-overlay" onClick={() => setGenerateTarget(null)}>
                    <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Pilih Template BAST</div>
                            <button className="modal-close" onClick={() => setGenerateTarget(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                                <strong>{generateTarget.namaPaket}</strong>
                                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                                    Matrik: {generateTarget.noMatrik} • {generateTarget.jenisPengadaan}
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                    Nilai BAST: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(generateTarget.nilaiBAST)}</strong>
                                </div>
                            </div>

                            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Pilih Template:</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {bastTemplates.map(t => (
                                    <label key={t.id} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12,
                                        borderRadius: 8, cursor: 'pointer',
                                        border: selectedTemplateId === t.id ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                                        background: selectedTemplateId === t.id ? 'rgba(59,130,246,0.05)' : 'var(--bg-primary)',
                                        transition: 'all 0.15s'
                                    }}>
                                        <input type="radio" name="template" checked={selectedTemplateId === t.id}
                                            onChange={() => setSelectedTemplateId(t.id)}
                                            style={{ marginTop: 3 }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <FileCheck size={14} /> {t.nama}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{t.deskripsi}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setGenerateTarget(null)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleConfirmGenerate} disabled={!selectedTemplateId}>
                                <Printer size={14} /> Generate BAST
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== REVERT CONFIRMATION ===== */}
            {revertTarget && (
                <div className="modal-overlay" onClick={() => setRevertTarget(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <RotateCcw size={32} strokeWidth={1.5} />
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 8 }}>Kembalikan ke "Belum"?</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                                BAST <strong>"{revertTarget.noBAST}"</strong> akan dikembalikan ke status "Belum Generate".
                            </p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
                                Data akan dihapus dari Riwayat Bantuan dan bisa di-generate ulang.
                            </p>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={() => setRevertTarget(null)} style={{ minWidth: 100 }}>Batal</button>
                                <button className="btn btn-primary" onClick={handleRevert}
                                    style={{ minWidth: 100, background: '#f59e0b', borderColor: '#f59e0b' }}>
                                    <RotateCcw size={14} /> Kembalikan
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== EDIT MODAL ===== */}
            {editItem && (
                <div className="modal-overlay" onClick={() => setEditItem(null)}>
                    <div className="modal" style={{ maxWidth: 550 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Edit Data BAST</div>
                            <button className="modal-close" onClick={() => setEditItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                                <strong>{editItem.namaPaket}</strong>
                                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Matrik: {editItem.noMatrik} • {editItem.namaSekolah}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>No BAST: {editItem.noBAST}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                                <div className="form-group">
                                    <label className="form-label">Volume</label>
                                    <input className="form-input" value={editForm.volume} onChange={e => setEditForm({ ...editForm, volume: e.target.value })} placeholder="Contoh: 1 Paket" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nilai Kontrak / Jasa (Rp)</label>
                                    <input className="form-input" type="text"
                                        value={formatNumberInput(editForm.nilaiKontrak)}
                                        onChange={e => setEditForm({ ...editForm, nilaiKontrak: parseFormattedNumber(e.target.value) || 0 })} />
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                        Asal matrik: {formatCurrency(editItem.nilaiKontrak || 0)}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Honor (Rp)</label>
                                    <input className="form-input" type="text"
                                        value={formatNumberInput(editForm.honor)}
                                        onChange={e => setEditForm({ ...editForm, honor: parseFormattedNumber(e.target.value) || 0 })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Preview Nilai BAST</label>
                                    <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontWeight: 600, color: 'var(--accent-green)', fontSize: '0.9rem' }}>
                                        {formatCurrency(computeNilaiBAST(editItem, matrikData, { nilaiKontrak: editForm.nilaiKontrak, honor: editForm.honor }))}
                                    </div>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label">Catatan Revisi</label>
                                <textarea className="form-input" rows={2} value={editForm.keterangan} onChange={e => setEditForm({ ...editForm, keterangan: e.target.value })} placeholder="Alasan revisi (opsional)..." style={{ resize: 'vertical' }} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setEditItem(null)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSaveEdit}><Save size={14} /> Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== VIEW DETAIL MODAL ===== */}
            {viewItem && (
                <div className="modal-overlay" onClick={() => setViewItem(null)}>
                    <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Detail BAST</div>
                            <button className="modal-close" onClick={() => setViewItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                                {[
                                    { label: 'No Matrik', value: viewItem.noMatrik },
                                    { label: 'Nomor BAST', value: viewItem.noBAST },
                                    { label: 'Nama Paket', value: viewItem.namaPaket },
                                    { label: 'Jenis Pengadaan', value: viewItem.jenisPengadaan },
                                    { label: 'NPSN', value: viewItem.npsn },
                                    { label: 'Sekolah', value: viewItem.namaSekolah },
                                    { label: 'Kepala Sekolah', value: viewItem.kepsek },
                                    { label: 'NIP', value: viewItem.nipKepsek },
                                    { label: 'Volume', value: viewItem.volume || '-' },
                                    { label: 'Nilai Kontrak', value: formatCurrency(viewItem.nilaiKontrak) },
                                    { label: 'Honor', value: formatCurrency(viewItem.honor || 0) },
                                    { label: 'Template', value: viewItem.templateNama || '-' },
                                    { label: 'Status', value: viewItem.isGenerated ? `Generated (${formatDateShort(viewItem.tanggalGenerate)})` : 'Belum Generate' },
                                ].map(item => (
                                    <div key={item.label}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{item.label}</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.value || '-'}</div>
                                    </div>
                                ))}
                            </div>

                            {viewItem.jenisPengadaan === 'Pekerjaan Konstruksi' && (
                                <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 10 }}>Rincian Nilai BAST</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                            <span>Nilai Kontrak Konstruksi</span>
                                            <span style={{ fontWeight: 500 }}>{formatCurrency(viewItem.nilaiKontrak)}</span>
                                        </div>
                                        {matrikData.filter(m => {
                                            if (m.id === viewItem.id) return false;
                                            const base = (viewItem.namaPaket || '').toLowerCase();
                                            const mName = (m.namaPaket || '').toLowerCase();
                                            return (m.jenisPengadaan === 'Jasa Konsultansi Perencanaan' || m.jenisPengadaan === 'Jasa Konsultansi Pengawasan') &&
                                                (mName.includes(base) || base.includes(mName.replace('jasa konsultansi perencanaan', '').replace('jasa konsultansi pengawasan', '').trim()));
                                        }).map(m => (
                                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>{m.jenisPengadaan}</span>
                                                <span style={{ fontWeight: 500 }}>{formatCurrency(m.nilaiKontrak)}</span>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Honor</span>
                                            <span style={{ fontWeight: 500 }}>{formatCurrency(viewItem.honor || 0)}</span>
                                        </div>
                                        <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9rem' }}>
                                            <span>Total Nilai BAST</span>
                                            <span style={{ color: 'var(--accent-green)' }}>{formatCurrency(viewItem.nilaiBAST)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Terbilang</div>
                                <div style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>{viewItem.terbilangBAST}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateBAST;