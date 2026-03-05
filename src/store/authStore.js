import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/index';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loading: false,

      login: async (email, password) => {
        set({ loading: true });
        try {
          const result = await authApi.login(email, password);
          if (result?.user) {
            // Normalize user data from Better Auth to match frontend expectations
            const user = {
              ...result.user,
              // Capitalize role: 'admin' → 'Admin', 'verifikator' → 'Verifikator'
              role: result.user.role ? result.user.role.charAt(0).toUpperCase() + result.user.role.slice(1) : 'Sekolah',
              namaAkun: result.user.name || result.user.namaAkun || result.user.email,
            };
            set({ user, isAuthenticated: true, loading: false });
            return user;
          }
          set({ loading: false });
          return null;
        } catch (err) {
          set({ loading: false });
          throw err;
        }
      },

      logout: async () => {
        try { await authApi.logout(); } catch (e) { /* ignore */ }
        set({ user: null, isAuthenticated: false });
      },

      checkSession: async () => {
        try {
          const result = await authApi.getSession();
          if (result?.user) {
            const user = {
              ...result.user,
              role: result.user.role ? result.user.role.charAt(0).toUpperCase() + result.user.role.slice(1) : 'Sekolah',
              namaAkun: result.user.name || result.user.namaAkun || result.user.email,
            };
            set({ user, isAuthenticated: true });
            return user;
          }
          set({ user: null, isAuthenticated: false });
          return null;
        } catch (e) {
          set({ user: null, isAuthenticated: false });
          return null;
        }
      },

      updateProfile: (updates) => set((state) => ({
        user: { ...state.user, ...updates }
      })),
    }),
    {
      name: 'spidol-auth',
    }
  )
);

export default useAuthStore;
