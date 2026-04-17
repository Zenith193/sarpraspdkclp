import { useState, useEffect, useRef, useCallback } from 'react';
import { Sun, Moon, Menu, School, Bell, Check, CheckCheck, X, Trash2 } from 'lucide-react';
import useThemeStore from '../../store/themeStore';
import useAuthStore from '../../store/authStore';
import QueueStatus from '../ui/QueueStatus';
import { notificationApi } from '../../api/index';

const Topbar = ({ onToggleSidebar, sidebarCollapsed, isMobile }) => {
    const { theme, toggleTheme } = useThemeStore();
    const user = useAuthStore(s => s.user);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showPanel, setShowPanel] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const panelRef = useRef(null);

    // Fetch unread count periodically
    useEffect(() => {
        if (!user) return;
        const fetchCount = () => {
            notificationApi.unreadCount()
                .then(r => setUnreadCount(r?.count || 0))
                .catch(() => {});
        };
        fetchCount();
        const interval = setInterval(fetchCount, 60000); // every 60s
        return () => clearInterval(interval);
    }, [user]);

    // Close panel on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setShowPanel(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const openPanel = useCallback(async () => {
        setShowPanel(prev => !prev);
        if (!showPanel) {
            setLoadingNotifs(true);
            try {
                const data = await notificationApi.list(30);
                setNotifications(Array.isArray(data) ? data : []);
            } catch { setNotifications([]); }
            finally { setLoadingNotifs(false); }
        }
    }, [showPanel]);

    const handleMarkRead = async (id) => {
        try {
            await notificationApi.markRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {}
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationApi.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true, is_read: true })));
            setUnreadCount(0);
        } catch {}
    };

    const handleDelete = async (id) => {
        try {
            await notificationApi.delete(id);
            const removed = notifications.find(n => n.id === id);
            setNotifications(prev => prev.filter(n => n.id !== id));
            if (removed && !(removed.isRead || removed.is_read)) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch {}
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'Baru saja';
        if (diffMin < 60) return `${diffMin} menit lalu`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr} jam lalu`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 7) return `${diffDay} hari lalu`;
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'error': return '#ef4444';
            case 'warning': return '#f97316';
            case 'success': return '#22c55e';
            default: return '#3b82f6';
        }
    };

    return (
        <div className={`topbar ${sidebarCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''}`}>
            <div className="topbar-left">
                <button className="topbar-toggle" onClick={onToggleSidebar}>
                    <Menu size={20} />
                </button>
                <div className="topbar-title">
                    <School size={18} />
                    <span>Sistem Aplikasi Registrasi Data Infrastruktur dan Kelengkapan Aset Pendidikan</span>
                </div>
            </div>
            <div className="topbar-right">
                <QueueStatus />

                {/* Notification Bell */}
                <div style={{ position: 'relative' }} ref={panelRef}>
                    <button className="topbar-btn" onClick={openPanel} title="Notifikasi" style={{ position: 'relative' }}>
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute', top: 2, right: 2,
                                background: '#ef4444', color: '#fff',
                                fontSize: 10, fontWeight: 700,
                                minWidth: 16, height: 16,
                                borderRadius: 10, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                padding: '0 4px', lineHeight: 1,
                                boxShadow: '0 1px 4px rgba(239,68,68,0.4)',
                            }}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Panel */}
                    {showPanel && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: 8,
                            width: 380, maxHeight: 480,
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                            zIndex: 9999, display: 'flex', flexDirection: 'column',
                            overflow: 'hidden',
                        }}>
                            {/* Header */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                            }}>
                                <span style={{ fontWeight: 700, fontSize: 15 }}>🔔 Notifikasi</span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {unreadCount > 0 && (
                                        <button onClick={handleMarkAllRead} title="Tandai semua sudah dibaca"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <CheckCheck size={14} /> Baca Semua
                                        </button>
                                    )}
                                    <button onClick={() => setShowPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}>
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* List */}
                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                {loadingNotifs ? (
                                    <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Memuat...</div>
                                ) : notifications.length === 0 ? (
                                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                                        <Bell size={28} style={{ opacity: 0.2, marginBottom: 8 }} /><br />
                                        Belum ada notifikasi
                                    </div>
                                ) : (
                                    notifications.map(n => {
                                        const isRead = n.isRead || n.is_read;
                                        return (
                                            <div key={n.id} style={{
                                                display: 'flex', gap: 10, padding: '10px 16px',
                                                borderBottom: '1px solid var(--border-color)',
                                                background: isRead ? 'transparent' : 'rgba(59,130,246,0.04)',
                                                cursor: 'pointer', transition: 'background 0.15s',
                                            }}
                                                onClick={() => !isRead && handleMarkRead(n.id)}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                                onMouseLeave={e => e.currentTarget.style.background = isRead ? 'transparent' : 'rgba(59,130,246,0.04)'}
                                            >
                                                {/* Dot indicator */}
                                                <div style={{ paddingTop: 4 }}>
                                                    <div style={{
                                                        width: 8, height: 8, borderRadius: '50%',
                                                        background: isRead ? 'transparent' : getTypeColor(n.type),
                                                        border: isRead ? '1px solid var(--border-color)' : 'none',
                                                        flexShrink: 0,
                                                    }} />
                                                </div>
                                                {/* Content */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: isRead ? 400 : 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                                                        {n.title}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {n.message}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, opacity: 0.6 }}>
                                                        {formatTime(n.createdAt || n.created_at)}
                                                    </div>
                                                </div>
                                                {/* Delete */}
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: 0.4, padding: 2, flexShrink: 0, alignSelf: 'center' }}
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button className="topbar-btn" onClick={toggleTheme} title="Ganti Tema">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
        </div>
    );
};

export default Topbar;
