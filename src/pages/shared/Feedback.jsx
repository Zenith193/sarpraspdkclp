import { useState } from 'react';
import { MessageSquarePlus, Send, Image, X, CheckCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { feedbackApi } from '../../api/index';
import toast from 'react-hot-toast';

const Feedback = () => {
    const user = useAuthStore(s => s.user);
    const [isiGagasan, setIsiGagasan] = useState('');
    const [foto, setFoto] = useState(null);
    const [preview, setPreview] = useState(null);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleFoto = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            toast.error('Ukuran foto maksimal 500KB');
            e.target.value = '';
            return;
        }
        setFoto(file);
        setPreview(URL.createObjectURL(file));
    };

    const removeFoto = () => {
        setFoto(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
    };

    const handleSubmit = async () => {
        if (!isiGagasan.trim()) {
            toast.error('Isi Gagasan wajib diisi');
            return;
        }
        setSending(true);
        try {
            const fd = new FormData();
            fd.append('isiGagasan', isiGagasan.trim());
            if (foto) fd.append('foto', foto);
            await feedbackApi.submit(fd);
            toast.success('Feedback berhasil dikirim! Terima kasih atas masukan Anda.');
            setIsiGagasan('');
            removeFoto();
            setSent(true);
        } catch (err) {
            toast.error(err?.message || 'Gagal mengirim feedback');
        }
        setSending(false);
    };

    if (sent) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <CheckCircle size={40} style={{ color: '#22c55e' }} />
                    </div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Terima Kasih!</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 400, margin: '0 auto 20px' }}>
                        Feedback Anda telah berhasil dikirim ke Admin. Masukan Anda sangat berarti bagi kami.
                    </p>
                    <button onClick={() => setSent(false)} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                        <MessageSquarePlus size={16} /> Kirim Feedback Lain
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <MessageSquarePlus size={24} /> Feedback & Gagasan
                    </h1>
                    <p>Sampaikan masukan, saran, atau gagasan Anda kepada Admin</p>
                </div>
            </div>

            <div style={{ maxWidth: 640, margin: '0 auto' }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 28 }}>
                    {/* Auto-filled fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Nama Akun</label>
                            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.9rem', color: 'var(--text-primary)', opacity: 0.7 }}>
                                {user?.namaAkun || user?.name || '-'}
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Email</label>
                            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.9rem', color: 'var(--text-primary)', opacity: 0.7 }}>
                                {user?.email || '-'}
                            </div>
                        </div>
                    </div>

                    {/* Isi Gagasan */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            Isi Gagasan <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea
                            value={isiGagasan}
                            onChange={e => setIsiGagasan(e.target.value)}
                            placeholder="Tulis masukan, saran, atau gagasan Anda di sini..."
                            rows={6}
                            style={{
                                width: '100%', padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-input)',
                                borderRadius: 8, fontSize: '0.9rem', color: 'var(--text-primary)', resize: 'vertical', minHeight: 120,
                                fontFamily: 'inherit', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Upload Foto */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            Upload Foto <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>(opsional, maks 500KB)</span>
                        </label>
                        {preview ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img src={preview} alt="Preview" style={{ maxWidth: 200, maxHeight: 150, borderRadius: 8, border: '1px solid var(--border-color)' }} />
                                <button onClick={removeFoto} style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <label style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                                background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)',
                                borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)',
                                transition: 'border-color 0.2s',
                            }}>
                                <Image size={18} /> Pilih foto...
                                <input type="file" accept="image/*" onChange={handleFoto} style={{ display: 'none' }} />
                            </label>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={sending || !isiGagasan.trim()}
                        className="btn btn-primary"
                        style={{
                            width: '100%', padding: '14px 0', fontSize: '1rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            opacity: !isiGagasan.trim() ? 0.5 : 1,
                        }}
                    >
                        <Send size={18} /> {sending ? 'Mengirim...' : 'Kirim Feedback'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Feedback;
