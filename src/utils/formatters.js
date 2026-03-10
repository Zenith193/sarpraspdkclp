export const formatCurrency = (value) => {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(value).replace('IDR', 'Rp.');
};

export const formatNumber = (value) => {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('id-ID').format(value);
};

export const formatDate = (date) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(date));
};

export const formatDateTime = (date) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    }).format(new Date(date));
};

export const formatLuas = (panjang, lebar) => {
    if (!panjang || !lebar) return '0.00';
    return (panjang * lebar).toFixed(2);
};

export const formatShortCurrency = (value) => {
    if (!value && value !== 0) return '-';
    if (value >= 1_000_000_000_000) return `Rp ${(value / 1_000_000_000_000).toFixed(1)} T`;
    if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
    if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} Jt`;
    return formatCurrency(value);
};
