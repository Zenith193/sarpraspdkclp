import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CountdownBanner from '../ui/CountdownBanner';

const MOBILE_BREAKPOINT = 1279;

const AppLayout = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);
    const location = useLocation();

    // Track screen size
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
            setIsMobile(mobile);
            if (mobile) {
                // On mobile: close sidebar overlay when resizing down
                setSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-close sidebar on route change (mobile)
    useEffect(() => {
        if (isMobile) setSidebarOpen(false);
    }, [location.pathname, isMobile]);

    // Toggle handler
    const handleToggle = useCallback(() => {
        if (isMobile) {
            setSidebarOpen(prev => !prev);
        } else {
            setSidebarCollapsed(prev => !prev);
        }
    }, [isMobile]);

    // Close sidebar when clicking overlay
    const handleOverlayClick = useCallback(() => {
        setSidebarOpen(false);
    }, []);

    // On mobile, never apply collapsed margin
    const mainContentStyle = {};
    if (!isMobile && sidebarCollapsed) {
        mainContentStyle.marginLeft = 'var(--sidebar-collapsed-width)';
    } else if (isMobile) {
        mainContentStyle.marginLeft = 0;
    }

    return (
        <div className="app-layout">
            <Sidebar
                collapsed={isMobile ? false : sidebarCollapsed}
                onToggle={handleToggle}
                className={sidebarOpen ? 'open' : ''}
            />
            {sidebarOpen && (
                <div className="sidebar-overlay active" onClick={handleOverlayClick} />
            )}
            <div style={{ flex: 1 }}>
                <Topbar onToggleSidebar={handleToggle} sidebarCollapsed={!isMobile && sidebarCollapsed} isMobile={isMobile} />
                <div className="main-content" style={mainContentStyle}>
                    <CountdownBanner />
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default AppLayout;
