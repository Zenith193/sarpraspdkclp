import useSettingsStore from '../store/settingsStore';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

/**
 * Hook that checks countdown restrictions before actions.
 * Returns a `guard(action)` function:
 *   - Returns true if action is ALLOWED
 *   - Returns false and shows toast if action is BLOCKED
 * 
 * Also returns `isRestricted(action)` for checking without toast (e.g. to disable buttons).
 * 
 * Usage:
 *   const { guard, isRestricted } = useCountdownGuard();
 *   
 *   // In handler:
 *   const handleAdd = () => { if (!guard('tambah')) return; ... }
 *   
 *   // In JSX:
 *   <button disabled={isRestricted('tambah')}>Tambah</button>
 */
const useCountdownGuard = () => {
    const isActionRestricted = useSettingsStore(s => s.isActionRestricted);
    const user = useAuthStore(s => s.user);
    const role = user?.role;

    const isRestricted = (action) => {
        return isActionRestricted(role, action);
    };

    const guard = (action) => {
        if (isRestricted(action)) {
            toast.error(`Aksi "${action}" telah dinonaktifkan oleh admin (deadline telah lewat)`);
            return false;
        }
        return true;
    };

    return { guard, isRestricted };
};

export default useCountdownGuard;
