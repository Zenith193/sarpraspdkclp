import { Sun, Moon, Menu, School } from 'lucide-react';
import useThemeStore from '../../store/themeStore';

const Topbar = ({ onToggleSidebar }) => {
    const { theme, toggleTheme } = useThemeStore();

    return (
        <div className="topbar">
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
                <button className="topbar-btn" onClick={toggleTheme} title="Ganti Tema">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
        </div>
    );
};

export default Topbar;
