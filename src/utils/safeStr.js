/**
 * Safe string renderer — prevents React error #31 when objects are passed as React children.
 * If value is an object (e.g. {kode, nama, jenjang}), extracts a readable string from it.
 */
export const safeStr = (v) => {
    if (v == null) return '';
    if (typeof v === 'object') return v.nama || v.name || v.label || v.kode || JSON.stringify(v);
    return String(v);
};
