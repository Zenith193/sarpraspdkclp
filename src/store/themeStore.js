import { create } from 'zustand';

const getInitialTheme = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('SARDIKA-theme') || 'dark';
    }
    return 'dark';
};

const useThemeStore = create((set) => ({
    theme: getInitialTheme(),

    toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('SARDIKA-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        return { theme: newTheme };
    }),

    setTheme: (theme) => {
        localStorage.setItem('SARDIKA-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
    },
}));

export default useThemeStore;
