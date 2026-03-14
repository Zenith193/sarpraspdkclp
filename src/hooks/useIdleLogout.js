import { useEffect, useRef, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

/**
 * Auto-logout after 5 minutes of inactivity.
 * Listens for mouse/keyboard/scroll/touch events to reset the timer.
 */
export default function useIdleLogout() {
    const { isAuthenticated, logout } = useAuthStore();
    const timerRef = useRef(null);
    const warningRef = useRef(null);

    const handleLogout = useCallback(async () => {
        try {
            toast('Sesi Anda telah berakhir karena tidak ada aktivitas selama 5 menit', {
                icon: '⏱️',
                duration: 5000,
            });
            await logout();
            window.location.href = '/login';
        } catch {
            window.location.href = '/login';
        }
    }, [logout]);

    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);

        if (!isAuthenticated) return;

        // Show warning at 4 minutes (1 minute before logout)
        warningRef.current = setTimeout(() => {
            toast('Anda akan logout otomatis dalam 1 menit karena tidak ada aktivitas', {
                icon: '⚠️',
                duration: 10000,
                id: 'idle-warning',
            });
        }, 4 * 60 * 1000);

        // Logout at 5 minutes
        timerRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS);
    }, [isAuthenticated, handleLogout]);

    useEffect(() => {
        if (!isAuthenticated) return;

        // Set initial timer
        resetTimer();

        // Listen for activity events
        EVENTS.forEach(event => window.addEventListener(event, resetTimer, { passive: true }));

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (warningRef.current) clearTimeout(warningRef.current);
            EVENTS.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [isAuthenticated, resetTimer]);
}
