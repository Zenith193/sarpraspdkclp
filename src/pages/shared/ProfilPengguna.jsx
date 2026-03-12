import { useState, useEffect } from 'react';
import { Edit, Save, X, Upload, FileText, CheckCircle, Eye, EyeOff, Lock, Download, Trash2, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { penggunaApi, sekolahApi } from '../../api/index';
import toast from 'react-hot-toast';

const ProfilPengguna = () => {
    const user = useAuthStore(s => s.user);
    const updateProfile = useAuthStore(s => s.updateProfile);
    
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ ...user });

    // State untuk ganti password
    const [showPwSection, setShowPwSection] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const [changingPw, setChangingPw] = useState(false);

    // State untuk file upload
    const [sekolahData, setSekolahData] = useState(null);
    const [uploadingKop, setUploadingKop] = useState(false);
    const [uploadingDenah, setUploadingDenah] = useState(false);

    const isSekolah = user?.role === 'Sekolah';
    const sekolahId = user?.sekolahId;

    // Fetch sekolah data to get upload status
    useEffect(() => {
        if (sekolahId) {
            sekolahApi.getById(sekolahId).then(setSekolahData).catch(() => {});
        }
    }, [sekolahId]);

    const handleSave = () => {
        updateProfile({ ...form });
        setEditing(false);
        toast.success('Profil berhasil diperbarui');
    };

    const handleCancel = () => {
        setEditing(false);
        setForm({ ...user });
    };

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            toast.error('Password minimal 6 karakter');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('Konfirmasi password tidak cocok');
            return;
        }
        setChangingPw(true);
        try {
            await penggunaApi.changePassword(user.id, newPassword);
            toast.success('Password berhasil diubah');
            setNewPassword('');
            setConfirmPassword('');
            setShowPwSection(false);
        } catch (e) {
            toast.error(e.message || 'Gagal mengubah password');
        } finally {
            setChangingPw(false);
        }
    };

    // ===== FILE UPLOAD HANDLERS =====
    const handleUploadKop = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = null;

        const ext = file.name.split('.').pop().toLowerCase();
        if (!['doc', 'docx'].includes(ext)) {
            toast.error('Format file harus Word (.doc atau .docx)');
            return;
        }
        if (file.size > 1 * 1024 * 1024) {
            toast.error('Ukuran file maksimal 1MB');
            return;
        }

        setUploadingKop(true);
        try {
            await sekolahApi.uploadKop(sekolahId, file);
            toast.success('Kop sekolah berhasil diupload');
            const updated = await sekolahApi.getById(sekolahId);
            setSekolahData(updated);
        } catch (err) {
            toast.error(err.message || 'Gagal upload kop sekolah');
        } finally {
            setUploadingKop(false);
        }
    };

    const handleUploadDenah = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = null;

        if (file.type !== 'application/pdf') {
            toast.error('Format file harus PDF');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Ukuran file maksimal 5MB');
            return;
        }

        setUploadingDenah(true);
        try {
            await sekolahApi.uploadDenah(sekolahId, file);
            toast.success('Denah sekolah berhasil diupload');
            const updated = await sekolahApi.getById(sekolahId);
            setSekolahData(updated);
        } catch (err) {
            toast.error(err.message || 'Gagal upload denah sekolah');
        } finally {
            setUploadingDenah(false);
        }
    };

    const handleDownload = async (type) => {
        try {
            const blob = type === 'kop' 
                ? await sekolahApi.downloadKop(sekolahId)
                : await sekolahApi.downloadDenah(sekolahId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = type === 'kop' ? 'kop_sekolah' : 'denah_sekolah';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(err.message || 'Gagal download file');
        }
    };

    const handleDeleteFile = async (type) => {
        if (!confirm(`Hapus ${type === 'kop' ? 'Kop Sekolah' : 'Denah Sekolah'}?`)) return;
        try {
            if (type === 'kop') await sekolahApi.deleteKop(sekolahId);
            else await sekolahApi.deleteDenah(sekolahId);
            toast.success('File berhasil dihapus');
            const updated = await sekolahApi.getById(sekolahId);
            setSekolahData(updated);
        } catch (err) {
            toast.error(err.message || 'Gagal menghapus file');
        }
    };

    const fields = [
        { label: 'Nama Akun', key: 'namaAkun' },
        { label: 'Role', key: 'role', readOnly: true },
        { label: 'Email / NPSN', key: 'email' },
        { label: 'Nama Kepala Sekolah', key: 'kepsek' },
        { label: 'NIP', key: 'nip' },
        { label: 'No Rekening', key: 'noRek' },
        { label: 'Nama Bank', key: 'namaBank' },
        { label: 'Jumlah Rombel', key: 'rombel' },
    ];

    const renderFileSection = (type, label, accept, maxSize, uploading, hasFile) => (
        <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                <FileText size={20} style={{ color: hasFile ? 'var(--accent-green)' : 'var(--text-secondary)' }} />
                <div style={{ flex: 1 }}>
                    {hasFile ? (
                        <span style={{ fontWeight: 500, color: 'var(--accent-green)', fontSize: '0.875rem' }}>
                            <CheckCircle size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> File sudah diupload
                        </span>
                    ) : (
                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>Belum ada file</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {hasFile && (
                        <>
                            <button className="btn-icon" onClick={() => handleDownload(type)} title="Download" style={{ color: 'var(--accent-blue)' }}>
                                <Download size={16} />
                            </button>
                            <button className="btn-icon" onClick={() => handleDeleteFile(type)} title="Hapus" style={{ color: 'var(--accent-red)' }}>
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: uploading ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: uploading ? 0.6 : 1 }}>
                        {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                        <span>{uploading ? 'Uploading...' : (hasFile ? 'Ganti' : 'Upload')}</span>
                        <input type="file" accept={accept} onChange={type === 'kop' ? handleUploadKop : handleUploadDenah} style={{ display: 'none' }} disabled={uploading} />
                    </label>
                </div>
            </div>
            <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                {type === 'kop' ? '* Format Word (.doc, .docx), Maks 1MB' : '* Format PDF, Maks 5MB'}
                {' — Otomatis tersimpan ke Google Drive'}
            </small>
        </div>
    );

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Profil Pengguna</h1>
                    <p>Informasi akun Anda</p>
                </div>
                <div className="page-header-right">
                    {!editing ? (
                        <button className="btn btn-primary" onClick={() => setEditing(true)}><Edit size={16} /> Edit Profil</button>
                    ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost" onClick={handleCancel}><X size={16} /> Batal</button>
                            <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> Simpan</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="card" style={{ maxWidth: 700 }}>
                {/* Header Profil */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: 700 }}>
                        {user?.namaAkun?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.namaAkun}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{user?.role}</div>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="form-row" style={{ gap: 20 }}>
                    {fields.map(f => (
                        <div className="form-group" key={f.key}>
                            <label className="form-label">{f.label}</label>
                            {editing && !f.readOnly ? (
                                <input className="form-input" value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                            ) : (
                                <div style={{ padding: '10px 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>{user?.[f.key] || '-'}</div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Ganti Password */}
                <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPwSection ? 16 : 0 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Lock size={16} /> Ganti Password
                        </h3>
                        {!showPwSection && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowPwSection(true)}>Ubah Password</button>
                        )}
                    </div>
                    {showPwSection && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div className="form-group">
                                <label className="form-label">Password Baru</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="form-input" type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" style={{ paddingRight: 40 }} />
                                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Konfirmasi Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="form-input" type={showConfirmPw ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Ulangi password baru" style={{ paddingRight: 40 }} />
                                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            {newPassword && confirmPassword && newPassword !== confirmPassword && (
                                <small style={{ color: 'var(--accent-red)' }}>Password tidak cocok</small>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setShowPwSection(false); setNewPassword(''); setConfirmPassword(''); }}>Batal</button>
                                <button className="btn btn-primary btn-sm" onClick={handleChangePassword} disabled={changingPw || !newPassword || newPassword !== confirmPassword}>
                                    {changingPw ? 'Menyimpan...' : 'Simpan Password'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Upload Dokumen Sekolah (Hanya untuk Role Sekolah) */}
                {isSekolah && sekolahId && (
                    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: 16, fontWeight: 600 }}>Dokumen Sekolah</h3>
                        {renderFileSection('kop', 'Kop Sekolah', '.doc,.docx', '1MB', uploadingKop, !!sekolahData?.kopSekolah)}
                        {renderFileSection('denah', 'Denah Sekolah', '.pdf', '5MB', uploadingDenah, !!sekolahData?.denahSekolah)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfilPengguna;