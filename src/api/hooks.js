import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for fetching data from the API with loading/error states.
 * @param {Function} fetchFn - async function that returns data
 * @param {Array} deps - dependencies to re-fetch on (default: [])
 */
export function useApi(fetchFn, deps = []) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchFn();
            setData(result);
        } catch (err) {
            setError(err.message || 'Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    }, deps);

    useEffect(() => { refetch(); }, [refetch]);

    return { data, loading, error, refetch, setData };
}

/**
 * Hook for mutations (create/update/delete) with loading state.
 * @param {Function} mutationFn - async function(args)
 */
export function useMutation(mutationFn) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const mutate = async (...args) => {
        setLoading(true);
        setError(null);
        try {
            const result = await mutationFn(...args);
            setLoading(false);
            return result;
        } catch (err) {
            setError(err.message || 'Gagal');
            setLoading(false);
            throw err;
        }
    };

    return { mutate, loading, error };
}
