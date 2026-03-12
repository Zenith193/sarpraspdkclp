import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ===== DEFAULT ACCESS CONFIG =====
const DEFAULT_ACCESS = {
    admin: [
        'dashboard', 'data-sarpras', 'proposal', 'proyeksi-anggaran',
        'aktivitas', 'manajemen-pengguna', 'manajemen-template',
        'riwayat-bantuan', 'matriks-kegiatan', 'create-bast',
        'pencairan', 'manajemen-korwil', 'form-kerusakan', 'prestasi',
        'verifikasi-sarpras', 'verifikasi-proposal', 'ranking',
        'hak-akses', 'pengaturan-nas', 'countdown-settings', 'iklan'
    ],
    verifikator: [
        'dashboard', 'data-sarpras', 'proposal',
        'verifikasi-sarpras', 'verifikasi-proposal',
        'ranking', 'riwayat-bantuan',
        'manajemen-template', 'matriks-kegiatan', 'create-bast',
        'pencairan', 'form-kerusakan', 'prestasi', 'iklan'
    ],
    korwil: [
        'dashboard', 'verifikasi-sarpras', 'verifikasi-proposal',
        'ranking', 'data-sarpras', 'proposal',
        'riwayat-bantuan', 'form-kerusakan', 'iklan'
    ],
    sekolah: [
        'dashboard', 'data-sarpras', 'proposal', 'riwayat-bantuan',
        'prestasi', 'form-kerusakan', 'iklan'
    ]
};

// ===== ALL AVAILABLE MENUS PER ROLE =====
export const ALL_MENUS = {
    admin: [
        { path: 'dashboard', label: 'Dashboard' },
        { path: 'data-sarpras', label: 'Data Sarpras' },
        { path: 'proposal', label: 'Proposal' },
        { path: 'proyeksi-anggaran', label: 'Proyeksi Anggaran' },
        { path: 'aktivitas', label: 'Aktivitas Pengguna' },
        { path: 'manajemen-pengguna', label: 'Manajemen Pengguna' },
        { path: 'manajemen-template', label: 'Manajemen Template' },
        { path: 'riwayat-bantuan', label: 'Riwayat Bantuan' },
        { path: 'matriks-kegiatan', label: 'Matriks Kegiatan' },
        { path: 'create-bast', label: 'Create BAST' },
        { path: 'pencairan', label: 'Pencairan' },
        { path: 'manajemen-korwil', label: 'Manajemen Korwil' },
        { path: 'form-kerusakan', label: 'Upload Form Kerusakan' },
        { path: 'prestasi', label: 'Prestasi' },
        { path: 'verifikasi-sarpras', label: 'Verifikasi Sarpras' },
        { path: 'verifikasi-proposal', label: 'Verifikasi Proposal' },
        { path: 'ranking', label: 'Ranking & Prioritas' },
        { path: 'hak-akses', label: 'Hak Akses' },
        { path: 'pengaturan-nas', label: 'Pengaturan NAS' },
        { path: 'countdown-settings', label: 'Countdown Timer' },
        { path: 'iklan', label: 'Iklan' },
    ],
    verifikator: [
        { path: 'dashboard', label: 'Dashboard' },
        { path: 'data-sarpras', label: 'Data Sarpras' },
        { path: 'proposal', label: 'Proposal' },
        { path: 'verifikasi-sarpras', label: 'Verifikasi Sarpras' },
        { path: 'verifikasi-proposal', label: 'Verifikasi Proposal' },
        { path: 'ranking', label: 'Ranking & Prioritas' },
        { path: 'riwayat-bantuan', label: 'Riwayat Bantuan' },
        { path: 'manajemen-template', label: 'Manajemen Template' },
        { path: 'matriks-kegiatan', label: 'Matriks Kegiatan' },
        { path: 'create-bast', label: 'Create BAST' },
        { path: 'pencairan', label: 'Pencairan' },
        { path: 'form-kerusakan', label: 'Upload Form Kerusakan' },
        { path: 'prestasi', label: 'Prestasi' },
        { path: 'iklan', label: 'Iklan' },
    ],
    korwil: [
        { path: 'dashboard', label: 'Dashboard Korwil' },
        { path: 'verifikasi-sarpras', label: 'Verifikasi Sarpras' },
        { path: 'verifikasi-proposal', label: 'Verifikasi Proposal' },
        { path: 'ranking', label: 'Ranking Prioritas' },
        { path: 'data-sarpras', label: 'Data Sarpras' },
        { path: 'proposal', label: 'Data Proposal' },
        { path: 'riwayat-bantuan', label: 'Riwayat Bantuan' },
        { path: 'form-kerusakan', label: 'Form Kerusakan' },
        { path: 'iklan', label: 'Iklan' },
    ],
    sekolah: [
        { path: 'dashboard', label: 'Dashboard' },
        { path: 'data-sarpras', label: 'Data Sarpras' },
        { path: 'proposal', label: 'Proposal' },
        { path: 'riwayat-bantuan', label: 'Riwayat Bantuan' },
        { path: 'prestasi', label: 'Prestasi' },
        { path: 'form-kerusakan', label: 'Form Kerusakan' },
        { path: 'iklan', label: 'Iklan' },
    ]
};

// ===== DEFAULT NAS CONFIG =====
const DEFAULT_NAS = {
    enabled: false,
    hostname: '',
    port: 5000,
    protocol: 'https',
    username: '',
    password: '',
    folders: {
        fotoSarpras: '/SarprasData/foto/',
        dokumenBAST: '/SarprasData/bast/',
        backupDB: '/SarprasData/backup/',
        template: '/SarprasData/template/',
        formKerusakan: '/SarprasData/form-kerusakan/',
    },
    lastTestResult: null,
    lastTestTime: null
};

// ===== DEFAULT COUNTDOWN CONFIG =====
const DEFAULT_COUNTDOWN = {
    enabled: false,
    deadline: '',
    label: 'Batas Akhir Input Data Sarpras',
    affectedRoles: ['sekolah', 'korwil', 'verifikator'],
    restrictedActions: ['tambah', 'edit', 'hapus'],
};

// ===== AVAILABLE ACTIONS =====
export const AVAILABLE_ACTIONS = [
    { key: 'tambah', label: 'Tambah Data', desc: 'Menambah data baru' },
    { key: 'edit', label: 'Edit Data', desc: 'Mengubah data yang ada' },
    { key: 'hapus', label: 'Hapus Data', desc: 'Menghapus data' },
    { key: 'upload', label: 'Upload File', desc: 'Mengunggah file/foto' },
    { key: 'verifikasi', label: 'Verifikasi', desc: 'Memverifikasi data' },
];

// ===== STORE =====
const useSettingsStore = create(
    persist(
        (set, get) => ({
            accessConfig: { ...DEFAULT_ACCESS },
            nasConfig: { ...DEFAULT_NAS },
            countdownConfig: { ...DEFAULT_COUNTDOWN },

            // ===== ACCESS CONTROL =====
            isMenuAllowed: (role, menuPath) => {
                const config = get().accessConfig;
                const roleKey = role?.toLowerCase();
                if (!config[roleKey]) return false;
                return config[roleKey].includes(menuPath);
            },

            setRoleMenus: (role, menus) => set((state) => ({
                accessConfig: { ...state.accessConfig, [role]: menus }
            })),

            toggleMenuAccess: (role, menuPath) => set((state) => {
                const current = state.accessConfig[role] || [];
                const newMenus = current.includes(menuPath)
                    ? current.filter(m => m !== menuPath)
                    : [...current, menuPath];
                return { accessConfig: { ...state.accessConfig, [role]: newMenus } };
            }),

            resetAccessConfig: () => set({ accessConfig: { ...DEFAULT_ACCESS } }),

            setAccessConfig: (config) => set({ accessConfig: config }),

            // ===== NAS CONFIG =====
            updateNasConfig: (updates) => set((state) => ({
                nasConfig: { ...state.nasConfig, ...updates }
            })),

            updateNasFolder: (key, value) => set((state) => ({
                nasConfig: {
                    ...state.nasConfig,
                    folders: { ...state.nasConfig.folders, [key]: value }
                }
            })),

            setTestResult: (result) => set((state) => ({
                nasConfig: {
                    ...state.nasConfig,
                    lastTestResult: result,
                    lastTestTime: new Date().toISOString()
                }
            })),

            resetNasConfig: () => set({ nasConfig: { ...DEFAULT_NAS } }),

            // ===== COUNTDOWN TIMER =====
            updateCountdown: (updates) => set((state) => ({
                countdownConfig: { ...state.countdownConfig, ...updates }
            })),

            resetCountdown: () => set({ countdownConfig: { ...DEFAULT_COUNTDOWN } }),

            isActionRestricted: (role, action) => {
                const cfg = get().countdownConfig;
                if (!cfg.enabled || !cfg.deadline) return false;
                const roleKey = role?.toLowerCase();
                if (roleKey === 'admin') return false;
                if (!cfg.affectedRoles.includes(roleKey)) return false;
                if (!cfg.restrictedActions.includes(action)) return false;
                return new Date() > new Date(cfg.deadline);
            },
        }),
        {
            name: 'SARDIKA-settings',
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...persistedState,
                countdownConfig: {
                    ...DEFAULT_COUNTDOWN,
                    ...(persistedState?.countdownConfig || {}),
                },
                nasConfig: {
                    ...DEFAULT_NAS,
                    ...(persistedState?.nasConfig || {}),
                    folders: {
                        ...DEFAULT_NAS.folders,
                        ...(persistedState?.nasConfig?.folders || {}),
                    },
                },
                accessConfig: Object.fromEntries(
                    Object.entries(DEFAULT_ACCESS).map(([role, defaultMenus]) => {
                        const persisted = persistedState?.accessConfig?.[role];
                        if (!persisted) return [role, defaultMenus];
                        // Add any new default items not present in persisted
                        const merged = [...persisted, ...defaultMenus.filter(m => !persisted.includes(m))];
                        return [role, merged];
                    })
                ),
            }),
        }
    )
);

export default useSettingsStore;
