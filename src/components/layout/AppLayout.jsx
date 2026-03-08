import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CountdownBanner from '../ui/CountdownBanner';

const AppLayout = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    // Auto-close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    // Toggle handler
    const handleToggle = () => {
        if (window.innerWidth <= 1279) {
            setSidebarOpen(!sidebarOpen);
        } else {
            setSidebarCollapsed(!sidebarCollapsed);
        }
    };

    return (
        <div className="app-layout">
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={handleToggle}
                className={sidebarOpen ? 'open' : ''}
            />
            {sidebarOpen && (
                <div className="sidebar-overlay active" onClick={() => setSidebarOpen(false)} />
            )}
            <div style={{ flex: 1 }}>
                <Topbar onToggleSidebar={handleToggle} />
                <div className="main-content" style={{ marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : undefined }}>
                    <CountdownBanner />
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default AppLayout;

