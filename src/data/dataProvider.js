/**
 * Data Provider Hooks — replace mockData imports with API-backed data.
 * Pages can import these hooks instead of static mock data.
 *
 * Usage:
 *   // Before: import { mockSarpras, mockSekolah } from '../../data/mockData';
 *   // After:  import { useSarprasData, useSekolahData } from '../../data/dataProvider';
 *   //         const { data: sarprasData, loading, refetch } = useSarprasData();
 */
import { useState, useEffect, useCallback } from 'react';
import {
    sekolahApi, sarprasApi, proposalApi, proyeksiApi, matrikApi,
    pencairanApi, bastApi, templateApi, riwayatBantuanApi, prestasiApi,
    kerusakanApi, korwilApi, penggunaApi, aktivitasApi, dashboardApi, settingsApi
} from '../api/index';

// Auto-refresh interval (ms) — 0 = off
const DEFAULT_REFRESH_INTERVAL = 60_000; // 60 seconds

// Generic data fetching hook with optional auto-refresh
function useDataFetch(fetchFn, defaultValue = [], deps = [], autoRefreshMs = DEFAULT_REFRESH_INTERVAL) {
    const [data, setData] = useState(defaultValue);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refetch = useCallback(async (...args) => {
        setLoading(true);
        try {
            const result = await fetchFn(...args);
            const resolved = result?.data ?? result ?? defaultValue;
            setData(resolved);
            setError(null);
            return resolved;
        } catch (err) {
            setError(err.message);
            return defaultValue;
        } finally {
            setLoading(false);
        }
    }, deps);

    useEffect(() => { refetch(); }, [refetch]);

    // Auto-refresh: refetch every N ms when tab is visible
    useEffect(() => {
        if (!autoRefreshMs || autoRefreshMs <= 0) return;

        let interval;

        const start = () => {
            interval = setInterval(() => {
                if (!document.hidden) refetch();
            }, autoRefreshMs);
        };

        const handleVisibility = () => {
            if (!document.hidden) refetch(); // Refresh immediately on tab focus
        };

        start();
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [refetch, autoRefreshMs]);

    return { data, setData, loading, error, refetch };
}

// ===== SEKOLAH =====
export function useSekolahData() {
    return useDataFetch(() => sekolahApi.list({ limit: 999, onlyWithUsers: true }).then(r => r.data || r));
}

// ===== SARPRAS =====
export function useSarprasData(params = {}) {
    return useDataFetch(() => sarprasApi.list({ limit: 99999, ...params }).then(r => {
        const items = r.data || r;
        // Flatten nested structure: { sarpras: {...}, sekolahNama, sekolahNpsn, ... } → flat object
        return items.map(item => {
            if (item.sarpras) {
                return {
                    ...item.sarpras,
                    namaSekolah: item.sekolahNama || '',
                    npsn: item.sekolahNpsn || '',
                    kecamatan: item.sekolahKecamatan || '',
                    jenjang: item.sekolahJenjang || '',
                    foto: item.sarpras.foto || [],
                };
            }
            return item;
        });
    }), [], [JSON.stringify(params)]);
}

// ===== PROPOSAL =====
export function useProposalData(params = {}) {
    return useDataFetch(() => proposalApi.list({ limit: 500, ...params }).then(r => {
        const items = r.data || r;
        return items.map(item => {
            if (item.proposal) {
                return {
                    ...item.proposal,
                    namaSekolah: item.sekolahNama || '',
                    npsn: item.sekolahNpsn || '',
                    kecamatan: item.sekolahKecamatan || '',
                    jenjang: item.sekolahJenjang || '',
                };
            }
            return item;
        });
    }), [], [JSON.stringify(params)]);
}

// ===== AKTIVITAS =====
export function useAktivitasData(params = {}) {
    return useDataFetch(() => aktivitasApi.list({ limit: 200, ...params }).then(r => r.data || r), [], [JSON.stringify(params)]);
}

// ===== USERS =====
export function useUsersData(params = {}) {
    return useDataFetch(() => penggunaApi.list({ limit: 999, ...params }).then(r => r.data || r), [], [JSON.stringify(params)]);
}

// ===== RIWAYAT BANTUAN =====
export function useRiwayatBantuanData(params = {}) {
    return useDataFetch(() => riwayatBantuanApi.list({ limit: 500, ...params }).then(r => r.data || r), [], [JSON.stringify(params)]);
}

// ===== PRESTASI =====
export function usePrestasiData(params = {}) {
    return useDataFetch(() => prestasiApi.list({ limit: 500, ...params }).then(r => {
        const items = r.data || r;
        return items.map(item => {
            if (item.prestasi) {
                return {
                    ...item.prestasi,
                    namaSekolah: item.sekolahNama || '',
                    npsn: item.sekolahNpsn || '',
                    kecamatan: item.sekolahKecamatan || '',
                };
            }
            return item;
        });
    }), [], [JSON.stringify(params)]);
}

// ===== FORM KERUSAKAN =====
export function useKerusakanData(params = {}) {
    return useDataFetch(() => kerusakanApi.list({ limit: 500, ...params }).then(r => {
        const items = r.data || r;
        return items.map(item => {
            if (item.formKerusakan) {
                return {
                    ...item.formKerusakan,
                    namaSekolah: item.sekolahNama || '',
                    npsn: item.sekolahNpsn || '',
                };
            }
            return item;
        });
    }), [], [JSON.stringify(params)]);
}

// ===== KORWIL =====
export function useKorwilData() {
    return useDataFetch(() => korwilApi.list());
}

// ===== PROYEKSI ANGGARAN =====
export function useProyeksiData() {
    return useDataFetch(() => proyeksiApi.listAnggaran());
}

// ===== DASHBOARD STATS =====
export function useAdminDashboard() {
    return useDataFetch(() => dashboardApi.admin(), null);
}
export function useKorwilDashboard(kecamatan) {
    return useDataFetch(() => dashboardApi.korwil(kecamatan), null, [kecamatan]);
}
export function useSekolahDashboard() {
    return useDataFetch(() => dashboardApi.sekolah(), null);
}
