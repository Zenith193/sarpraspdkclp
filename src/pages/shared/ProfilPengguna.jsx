import { useState } from 'react';
import { Edit, Save, X, Upload, FileText, CheckCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const ProfilPengguna = () => {
    const user = useAuthStore(s => s.user);
    const updateProfile = useAuthStore(s => s.updateProfile);
    
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ ...user });
    
    // State khusus untuk file upload
    const [kopFile, setKopFile] = useState(null);
    const [existingKop, setExistingKop] = useState(user?.kopSekolah || null);

    const isSekolah = user?.role === 'Sekolah';

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validasi Tipe File (Hanya Word)
        const validTypes = [
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
        ];
        if (!validTypes.includes(file.type)) {
            toast.error('Format file harus Word (.doc atau .docx)');
            return;
        }

        // Validasi Ukuran File (Maks 1MB)
        if (file.size > 1024 * 1024) {
            toast.error('Ukuran file maksimal 1MB');
            return;
        }

        setKopFile(file);
        toast.success('File siap diunggah');
    };

    const handleSave = () => {
        // Simulasi upload file: jika ada file baru, gunakan nama file tersebut
        const newKopSekolah = kopFile ? kopFile.name : existingKop;
        
        updateProfile({ ...form, kopSekolah: newKopSekolah });
        
        // Update state lokal untuk tampilan
        setExistingKop(newKopSekolah);
        setKopFile(null); // Reset input file setelah simpan
        
        setEditing(false);
        toast.success('Profil berhasil diperbarui');
    };

    const handleCancel = () => {
        setEditing(false);
        setForm({ ...user }); // Reset form text
        setKopFile(null); // Reset file input
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

                {/* Upload Kop Sekolah (Hanya untuk Role Sekolah) */}
                {isSekolah && (
                    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: 16, fontWeight: 600 }}>Dokumen Resmi</h3>
                        <div className="form-group">
                            <label className="form-label">Kop Sekolah (Format Word, Maks 1MB)</label>
                            
                            {!editing ? (
                                // Mode View
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                                    <FileText size={20} style={{ color: 'var(--accent-blue)' }} />
                                    <div style={{ flex: 1 }}>
                                        {existingKop ? (
                                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{existingKop}</span>
                                        ) : (
                                            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Belum ada file diunggah</span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                // Mode Edit
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            <Upload size={14} />
                                            <span>Pilih File</span>
                                            <input 
                                                type="file" 
                                                accept=".doc,.docx" 
                                                onChange={handleFileChange} 
                                                style={{ display: 'none' }} 
                                            />
                                        </label>
                                        
                                        {kopFile ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontSize: '0.875rem' }}>
                                                <CheckCircle size={16} />
                                                <span>{kopFile.name}</span>
                                            </div>
                                        ) : existingKop ? (
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                File saat ini: <strong>{existingKop}</strong>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Belum ada file dipilih</span>
                                        )}
                                    </div>
                                    <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                        * Hanya menerima file dengan ekstensi .doc atau .docx. Ukuran maksimal 1MB.
                                    </small>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfilPengguna;