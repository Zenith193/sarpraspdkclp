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
        'hak-akses', 'pengaturan-nas', 'countdown-settings', 'iklan',
        'manajemen-penyedia', 'manajemen-kontrak', 'monitoring-realisasi',
        'feedback'
    ],
    verifikator: [
        'dashboard', 'data-sarpras', 'proposal',
        'verifikasi-sarpras', 'verifikasi-proposal',
        'ranking', 'riwayat-bantuan',
        'manajemen-template', 'matriks-kegiatan', 'create-bast',
        'pencairan', 'form-kerusakan', 'prestasi', 'iklan',
        'manajemen-penyedia', 'manajemen-kontrak', 'monitoring-realisasi',
        'feedback'
    ],
    korwil: [
        'dashboard', 'verifikasi-sarpras', 'verifikasi-proposal',
        'ranking', 'data-sarpras', 'proposal',
        'riwayat-bantuan', 'form-kerusakan', 'iklan', 'feedback'
    ],
    sekolah: [
        'dashboard', 'data-sarpras', 'proposal', 'riwayat-bantuan',
        'prestasi', 'form-kerusakan', 'iklan', 'feedback'
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
        { path: 'manajemen-penyedia', label: 'Manajemen Penyedia' },
        { path: 'manajemen-kontrak', label: 'Manajemen Kontrak' },
        { path: 'monitoring-realisasi', label: 'Monitoring Realisasi' },
        { path: 'feedback', label: 'Feedback' },
    ],
    verifikator: [
        { path: 'dashboard', label: 'Dashboard' },
        { path: 'data-sarpras', label: 'Data Sarpras' },
        { path: 'proposal', label: 'Proposal' },
        { path: 'proyeksi-anggaran', label: 'Proyeksi Anggaran' },
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
        { path: 'manajemen-penyedia', label: 'Manajemen Penyedia' },
        { path: 'manajemen-kontrak', label: 'Manajemen Kontrak' },
        { path: 'monitoring-realisasi', label: 'Monitoring Realisasi' },
        { path: 'feedback', label: 'Feedback' },
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
        { path: 'feedback', label: 'Feedback' },
    ],
    sekolah: [
        { path: 'dashboard', label: 'Dashboard' },
        { path: 'data-sarpras', label: 'Data Sarpras' },
        { path: 'proposal', label: 'Proposal' },
        { path: 'riwayat-bantuan', label: 'Riwayat Bantuan' },
        { path: 'prestasi', label: 'Prestasi' },
        { path: 'form-kerusakan', label: 'Form Kerusakan' },
        { path: 'iklan', label: 'Iklan' },
        { path: 'feedback', label: 'Feedback' },
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

// ===== MULTI-TIMER COUNTDOWN (array of timers) =====
// Each timer has: id, enabled, deadline, label, affectedRoles, restrictedActions, filterJenjang, filterKecamatan
const DEFAULT_COUNTDOWN_TIMERS = [];

// ===== AVAILABLE ACTIONS =====
export const AVAILABLE_ACTIONS = [
    { key: 'tambah', label: 'Tambah Data', desc: 'Menambah data baru' },
    { key: 'edit', label: 'Edit Data', desc: 'Mengubah data yang ada' },
    { key: 'hapus', label: 'Hapus Data', desc: 'Menghapus data' },
    { key: 'upload', label: 'Upload File', desc: 'Mengunggah file/foto' },
    { key: 'verifikasi', label: 'Verifikasi', desc: 'Memverifikasi data' },
];

// Helper to create a new timer with defaults
export const createNewTimer = (overrides = {}) => ({
    id: Date.now().toString(),
    enabled: true,
    deadline: '',
    label: 'Batas Akhir Input Data',
    affectedRoles: ['sekolah', 'korwil', 'verifikator'],
    restrictedActions: ['tambah', 'edit', 'hapus'],
    filterJenjang: [],
    filterKecamatan: [],
    ...overrides,
});

// ===== STORE =====
const useSettingsStore = create(
    persist(
        (set, get) => ({
            accessConfig: { ...DEFAULT_ACCESS },
            nasConfig: { ...DEFAULT_NAS },
            // Multi-timer: array of timer configs
            countdownTimers: [...DEFAULT_COUNTDOWN_TIMERS],
            // Legacy compat: single countdownConfig for old components
            get countdownConfig() {
                const timers = get().countdownTimers;
                if (timers.length === 0) return { enabled: false, deadline: '', label: '', affectedRoles: [], restrictedActions: [], filterJenjang: [], filterKecamatan: [] };
                // Return first enabled timer or first timer
                return timers.find(t => t.enabled) || timers[0];
            },

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

            // ===== MULTI-TIMER COUNTDOWN =====
            setCountdownTimers: (timers) => set({ countdownTimers: timers }),

            addCountdownTimer: (timer) => set((state) => ({
                countdownTimers: [...state.countdownTimers, timer]
            })),

            updateCountdownTimer: (id, updates) => set((state) => ({
                countdownTimers: state.countdownTimers.map(t =>
                    t.id === id ? { ...t, ...updates } : t
                )
            })),

            removeCountdownTimer: (id) => set((state) => ({
                countdownTimers: state.countdownTimers.filter(t => t.id !== id)
            })),

            toggleCountdownTimer: (id) => set((state) => ({
                countdownTimers: state.countdownTimers.map(t =>
                    t.id === id ? { ...t, enabled: !t.enabled } : t
                )
            })),

            resetCountdownTimers: () => set({ countdownTimers: [] }),

            // Legacy compat: updateCountdown — if called with old single-object format, migrate
            updateCountdown: (cfg) => {
                if (cfg && Array.isArray(cfg.timers)) {
                    // New multi-timer format from server
                    set({ countdownTimers: cfg.timers });
                } else if (cfg && cfg.enabled !== undefined && !cfg.id) {
                    // Old single-timer format — migrate to array
                    const existing = get().countdownTimers;
                    if (existing.length === 0) {
                        set({ countdownTimers: [{ ...cfg, id: 'legacy' }] });
                    } else {
                        set({ countdownTimers: existing.map((t, i) => i === 0 ? { ...t, ...cfg } : t) });
                    }
                }
            },
            resetCountdown: () => set({ countdownTimers: [] }),

            // ===== ACTION RESTRICTION CHECK (checks ALL enabled timers) =====
            isActionRestricted: (role, action, userJenjang, userKecamatan) => {
                const timers = get().countdownTimers;
                const roleKey = role?.toLowerCase();
                if (roleKey === 'admin') return false;

                for (const cfg of timers) {
                    if (!cfg.enabled || !cfg.deadline) continue;
                    if (!cfg.affectedRoles.includes(roleKey)) continue;
                    if (!cfg.restrictedActions.includes(action)) continue;
                    // Check jenjang filter
                    if (cfg.filterJenjang && cfg.filterJenjang.length > 0 && userJenjang) {
                        if (!cfg.filterJenjang.includes(userJenjang)) continue;
                    }
                    // Check kecamatan filter
                    if (cfg.filterKecamatan && cfg.filterKecamatan.length > 0 && userKecamatan) {
                        if (!cfg.filterKecamatan.includes(userKecamatan)) continue;
                    }
                    // If deadline has passed, action is restricted
                    if (new Date() > new Date(cfg.deadline)) return true;
                }
                return false;
            },
        }),
        {
            name: 'SARDIKA-settings',
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...persistedState,
                countdownTimers: persistedState?.countdownTimers || [],
                nasConfig: {
                    ...DEFAULT_NAS,
                    ...(persistedState?.nasConfig || {}),
                    folders: {
                        ...DEFAULT_NAS.folders,
                        ...(persistedState?.nasConfig?.folders || {}),
                    },
                },
                accessConfig: persistedState?.accessConfig || { ...DEFAULT_ACCESS },
            }),
        }
    )
);

export default useSettingsStore;
