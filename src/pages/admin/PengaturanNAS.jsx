import { useState, useEffect } from 'react';
import { HardDrive, Save, RotateCcw, Wifi, WifiOff, FolderOpen, Server, Lock, Eye, EyeOff, RefreshCw, CheckCircle, XCircle, AlertTriangle, Shield, Database, FileText, Image, Archive, ClipboardList, ChevronRight } from 'lucide-react';
import useSettingsStore from '../../store/settingsStore';
import { settingsApi } from '../../api/index';
import toast from 'react-hot-toast';

const PROTOCOL_OPTIONS = [
    { value: 'https', label: 'HTTPS (DSM Web API)', recommended: true },
    { value: 'http', label: 'HTTP (DSM Web API)' },
    { value: 'webdav', label: 'WebDAV' },
    { value: 'smb', label: 'SMB / CIFS' },
];

const FOLDER_CONFIG = [
    { key: 'fotoSarpras', label: 'Foto Sarpras', icon: <Image size={16} />, desc: 'Auto: /{Kecamatan}/{Sekolah}/sarpras/{MasaBangunan}/{Ruang}/' },
    { key: 'dokumenBAST', label: 'Dokumen BAST', icon: <FileText size={16} />, desc: 'Auto: /{Kecamatan}/{Sekolah}/bast/' },
    { key: 'proposal', label: 'Proposal', icon: <ClipboardList size={16} />, desc: 'Auto: /{Kecamatan}/{Sekolah}/proposal/{Tahun}/' },
    { key: 'formKerusakan', label: 'Form Kerusakan', icon: <ClipboardList size={16} />, desc: 'Auto: /{Kecamatan}/{Sekolah}/kerusakan/' },
    { key: 'prestasi', label: 'Sertifikat Prestasi', icon: <Archive size={16} />, desc: 'Auto: /{Kecamatan}/{Sekolah}/prestasi/' },
    { key: 'kopSekolah', label: 'Kop Sekolah', icon: <FileText size={16} />, desc: 'Auto: /{Kecamatan}/{Sekolah}/kop-sekolah/' },
    { key: 'template', label: 'Template', icon: <Archive size={16} />, desc: '/_sistem/template/' },
    { key: 'backupDB', label: 'Backup Database', icon: <Database size={16} />, desc: '/_sistem/backup/' },
];

const PengaturanNAS = () => {
    const { nasConfig, updateNasConfig, updateNasFolder, setTestResult, resetNasConfig } = useSettingsStore();

    const [form, setForm] = useState({ ...nasConfig });
    const [showPassword, setShowPassword] = useState(false);
    const [testing, setTesting] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [nasFolders, setNasFolders] = useState([]);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [folderPickerFor, setFolderPickerFor] = useState(null);
    const [browsingPath, setBrowsingPath] = useState('/');

    useEffect(() => {
        setForm({ ...nasConfig });
    }, [nasConfig]);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const handleFolderChange = (key, value) => {
        setForm(prev => ({
            ...prev,
            folders: { ...prev.folders, [key]: value }
        }));
        setHasChanges(true);
    };

    const handleSave = () => {
        if (form.enabled && !form.hostname) {
            toast.error('Hostname NAS wajib diisi');
            return;
        }
        // Save connection config
        updateNasConfig({
            enabled: form.enabled,
            hostname: form.hostname,
            port: form.port,
            protocol: form.protocol,
            username: form.username,
            password: form.password,
        });
        // Save folder config
        Object.entries(form.folders).forEach(([key, value]) => {
            updateNasFolder(key, value);
        });
        setHasChanges(false);
        toast.success('Pengaturan NAS berhasil disimpan');
    };

    const handleReset = () => {
        resetNasConfig();
        setForm({ ...nasConfig });
        setHasChanges(false);
        toast.success('Pengaturan NAS direset ke default');
    };

    const handleTestConnection = async () => {
        if (!form.hostname) {
            toast.error('Isi hostname terlebih dahulu');
            return;
        }
        setTesting(true);

        try {
            // Save config to server first so test uses the right credentials
            await settingsApi.setNas({
                enabled: form.enabled,
                hostname: form.hostname,
                port: form.port,
                protocol: form.protocol,
                username: form.username,
                password: form.password,
            });

            // Real API test
            const result = await settingsApi.testNas();
            setTestResult(result);

            if (result.success) {
                toast.success('Koneksi NAS berhasil!');
                // Auto-load shared folders
                fetchNasFolders('/');
            } else {
                toast.error(result.message || 'Koneksi NAS gagal');
            }
        } catch (e) {
            const result = { success: false, message: e.message || 'Gagal menghubungi server' };
            setTestResult(result);
            toast.error('Koneksi NAS gagal');
        } finally {
            setTesting(false);
        }
    };

    const fetchNasFolders = async (parentPath = '/') => {
        setLoadingFolders(true);
        try {
            const res = await settingsApi.listNasFolders(parentPath);
            if (res.success && res.folders) {
                setNasFolders(res.folders);
                setBrowsingPath(parentPath);
            }
        } catch (e) {
            console.error('Failed to list NAS folders:', e);
        } finally {
            setLoadingFolders(false);
        }
    };

    const selectFolder = (folderPath) => {
        if (folderPickerFor) {
            handleFolderChange(folderPickerFor, folderPath);
            setFolderPickerFor(null);
            toast.success(`Folder dipilih: ${folderPath}`);
        } else {
            // Set as main shared folder
            handleChange('sharedFolder', folderPath);
            toast.success(`Shared folder dipilih: ${folderPath}`);
        }
    };

    const lastTest = nasConfig.lastTestResult;
    const lastTestTime = nasConfig.lastTestTime;

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Pengaturan NAS</h1>
                    <p>Konfigurasi penyimpanan NAS Synology</p>
                </div>
                <div className="page-header-right" style={{ gap: 8 }}>
                    <button className="btn btn-ghost" onClick={handleReset}><RotateCcw size={14} /> Reset</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!hasChanges}>
                        <Save size={14} /> Simpan
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* ===== LEFT COLUMN: CONNECTION ===== */}
                <div>
                    {/* Enable Toggle */}
                    <div className="table-container" style={{ padding: 20, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: form.enabled ? 'rgba(34,197,94,0.12)' : 'var(--bg-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: form.enabled ? '#22c55e' : 'var(--text-secondary)'
                                }}>
                                    <HardDrive size={20} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>NAS Synology</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {form.enabled ? 'Penyimpanan NAS aktif' : 'Penyimpanan lokal (default)'}
                                    </div>
                                </div>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, cursor: 'pointer' }}>
                                <input type="checkbox" checked={form.enabled} onChange={e => handleChange('enabled', e.target.checked)}
                                    style={{ opacity: 0, width: 0, height: 0 }} />
                                <span style={{
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                    background: form.enabled ? '#22c55e' : 'var(--bg-secondary)',
                                    borderRadius: 26, transition: '0.3s',
                                    border: `1px solid ${form.enabled ? '#22c55e' : 'var(--border-color)'}`
                                }}>
                                    <span style={{
                                        position: 'absolute', height: 20, width: 20, left: form.enabled ? 24 : 2, bottom: 2,
                                        background: '#fff', borderRadius: '50%', transition: '0.3s',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }} />
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Connection Form */}
                    <div className="table-container" style={{ padding: 20, opacity: form.enabled ? 1 : 0.5, pointerEvents: form.enabled ? 'auto' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--bg-secondary)' }}>
                            <Server size={16} style={{ color: 'var(--accent-blue)' }} />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Koneksi Server</h3>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Protocol</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                {PROTOCOL_OPTIONS.map(p => (
                                    <label key={p.value} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                                        border: `2px solid ${form.protocol === p.value ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                                        background: form.protocol === p.value ? 'rgba(59,130,246,0.06)' : 'transparent',
                                        transition: '0.2s', fontSize: '0.8rem'
                                    }}>
                                        <input type="radio" name="protocol" value={p.value}
                                            checked={form.protocol === p.value}
                                            onChange={() => handleChange('protocol', p.value)}
                                            style={{ accentColor: 'var(--accent-blue)' }} />
                                        <span style={{ fontWeight: form.protocol === p.value ? 600 : 400 }}>{p.label}</span>
                                        {p.recommended && <span style={{ fontSize: '0.6rem', background: '#d1fae5', color: '#059669', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>REC</span>}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="form-row" style={{ marginTop: 12 }}>
                            <div className="form-group" style={{ flex: 2 }}>
                                <label className="form-label">Hostname / IP Address</label>
                                <input className="form-input" placeholder="nas.example.com atau 192.168.1.100"
                                    value={form.hostname} onChange={e => handleChange('hostname', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Port</label>
                                <input className="form-input" type="number" placeholder="5000"
                                    value={form.port || ''} onChange={e => handleChange('port', parseInt(e.target.value) || 5000)} />
                            </div>
                        </div>

                        <div style={{ borderBottom: '1px dashed var(--border-color)', margin: '16px 0' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Lock size={14} style={{ color: 'var(--accent-orange)' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Kredensial</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input className="form-input" placeholder="admin"
                                value={form.username} onChange={e => handleChange('username', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input className="form-input" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                                    value={form.password} onChange={e => handleChange('password', e.target.value)}
                                    style={{ paddingRight: 40 }} />
                                <button onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4
                                    }}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Test Connection Button */}
                        <button className="btn btn-secondary" onClick={handleTestConnection} disabled={testing}
                            style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}>
                            {testing ? (
                                <><RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Testing...</>
                            ) : (
                                <><Wifi size={14} /> Test Koneksi</>
                            )}
                        </button>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </div>
                </div>

                {/* ===== RIGHT COLUMN: FOLDERS + STATUS ===== */}
                <div>
                    {/* Test Result */}
                    {lastTest && (
                        <div className="table-container" style={{
                            padding: 16, marginBottom: 16,
                            borderLeft: `4px solid ${lastTest.success ? '#22c55e' : '#ef4444'}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                {lastTest.success ? <CheckCircle size={18} style={{ color: '#22c55e' }} /> : <XCircle size={18} style={{ color: '#ef4444' }} />}
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: lastTest.success ? '#22c55e' : '#ef4444' }}>
                                    {lastTest.success ? 'Terhubung' : 'Koneksi Gagal'}
                                </span>
                                {lastTestTime && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                                        {new Date(lastTestTime).toLocaleString('id-ID')}
                                    </span>
                                )}
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{lastTest.message}</p>

                            {lastTest.success && lastTest.model && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-color)' }}>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Model</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{lastTest.model}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DSM</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{lastTest.dsm}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Disk Free</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-green)' }}>{lastTest.diskFree}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Folder Mapping */}
                    <div className="table-container" style={{ padding: 20, opacity: form.enabled ? 1 : 0.5, pointerEvents: form.enabled ? 'auto' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--bg-secondary)' }}>
                            <FolderOpen size={16} style={{ color: 'var(--accent-green)' }} />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Shared Folder</h3>
                        </div>

                        {/* Main Shared Folder */}
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label">Root Shared Folder</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="form-input" value={form.sharedFolder || ''}
                                    onChange={e => handleChange('sharedFolder', e.target.value)}
                                    placeholder="/volume1/spidol" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                                {lastTest?.success && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => { setFolderPickerFor(null); fetchNasFolders('/'); }}
                                        disabled={loadingFolders} style={{ whiteSpace: 'nowrap' }}>
                                        <FolderOpen size={14} /> Pilih
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* NAS Folder Picker (shown after successful connection) */}
                        {nasFolders.length > 0 && (
                            <div style={{
                                padding: 12, borderRadius: 8, marginBottom: 16,
                                border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                                maxHeight: 220, overflow: 'auto'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <FolderOpen size={12} />
                                    <span style={{ fontFamily: 'monospace' }}>{browsingPath}</span>
                                    {browsingPath !== '/' && (
                                        <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '2px 8px' }}
                                            onClick={() => {
                                                const parent = browsingPath.split('/').slice(0, -1).join('/') || '/';
                                                fetchNasFolders(parent);
                                            }}>← Kembali</button>
                                    )}
                                </div>
                                {loadingFolders ? (
                                    <div style={{ textAlign: 'center', padding: 16, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Memuat...
                                    </div>
                                ) : nasFolders.map(f => (
                                    <div key={f.path} style={{
                                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                        borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem',
                                        background: 'var(--bg-secondary)', marginBottom: 4,
                                        transition: 'all 0.15s'
                                    }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(59,130,246,0.08)'}
                                        onMouseLeave={e => e.target.style.background = 'var(--bg-secondary)'}
                                    >
                                        <FolderOpen size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                                        <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}>{f.name}</span>
                                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                            onClick={() => selectFolder(f.path)}>Pilih</button>
                                        <button className="btn-icon" title="Browse" style={{ padding: 2 }}
                                            onClick={() => fetchNasFolders(f.path)}>
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                            Folder akan otomatis dibuat di dalam shared folder yang dipilih sesuai skema di bawah.
                        </p>
                    </div>

                    {/* Folder Structure Diagram */}
                    <div className="table-container" style={{ padding: 20, marginTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--bg-secondary)' }}>
                            <FolderOpen size={16} style={{ color: '#f59e0b' }} />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Skema Penyimpanan</h3>
                        </div>
                        <pre style={{
                            fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.6,
                            color: 'var(--text-secondary)', margin: 0, padding: 12,
                            background: 'var(--bg-primary)', borderRadius: 8,
                            border: '1px solid var(--border-color)', overflow: 'auto'
                        }}>
                            {`📁 uploads/
├── 📁 {Kecamatan}/
│   └── 📁 {NamaSekolah}_{NPSN}/
│       ├── 📂 sarpras/
│       │   └── 📂 {Masa_Bangunan}/
│       │       └── 📂 {Nama_Ruang}/
│       │           ├── 📸 foto1.jpg
│       │           └── 📸 foto2.jpg
│       ├── 📂 proposal/
│       │   └── 📂 {Tahun}/
│       │       └── 📄 proposal.pdf
│       ├── 📂 bast/
│       │   └── 📄 bast_doc.pdf
│       ├── 📂 kerusakan/
│       │   └── 📄 form_kerusakan.pdf
│       ├── 📂 prestasi/
│       │   └── 📄 sertifikat.pdf
│       └── 📂 kop-sekolah/
│           └── 📄 kop.docx
└── 📁 _sistem/
    ├── 📂 template/
    └── 📂 backup/`}
                        </pre>
                    </div>

                    {/* Security Notice */}
                    <div style={{
                        marginTop: 16, padding: '12px 16px', borderRadius: 10,
                        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                        display: 'flex', gap: 10, alignItems: 'flex-start'
                    }}>
                        <Shield size={16} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: '#f59e0b' }}>Catatan Keamanan</strong><br />
                            Kredensial NAS disimpan secara lokal di browser. Untuk lingkungan produksi, disarankan menggunakan variabel lingkungan server atau secret manager.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PengaturanNAS;
