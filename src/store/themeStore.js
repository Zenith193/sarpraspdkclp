import { create } from 'zustand';

const getInitialTheme = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('spidol-theme') || 'dark';
    }
    return 'dark';
};

const useThemeStore = create((set) => ({
    theme: getInitialTheme(),

    toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('spidol-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        return { theme: newTheme };
    }),

    setTheme: (theme) => {
        localStorage.setItem('spidol-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
    },
}));

export default useThemeStore;
