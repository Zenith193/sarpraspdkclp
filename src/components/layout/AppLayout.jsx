import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CountdownBanner from '../ui/CountdownBanner';

const AppLayout = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="app-layout">
            <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
            <div style={{ flex: 1 }}>
                <Topbar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
                <div className="main-content" style={{ marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : undefined }}>
                    <CountdownBanner />
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default AppLayout;

