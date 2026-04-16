import { useEffect, useRef, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 25 * 60 * 1000; // Warning at 25 minutes (5 min before logout)
const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

/**
 * Auto-logout after 30 minutes of inactivity.
 * Listens for mouse/keyboard/scroll/touch events to reset the timer.
 */
export default function useIdleLogout() {
    const { isAuthenticated, logout } = useAuthStore();
    const timerRef = useRef(null);
    const warningRef = useRef(null);

    const handleLogout = useCallback(async () => {
        try {
            toast('Sesi Anda telah berakhir karena tidak ada aktivitas selama 30 menit', {
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

        // Show warning 5 minutes before logout
        warningRef.current = setTimeout(() => {
            toast('Anda akan logout otomatis dalam 5 menit karena tidak ada aktivitas', {
                icon: '⚠️',
                duration: 15000,
                id: 'idle-warning',
            });
        }, WARNING_MS);

        // Logout at 30 minutes
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
