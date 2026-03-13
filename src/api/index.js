import api from './client';

export const authApi = {
    login: (email, password) => api.post('/auth/sign-in/email', { email, password }),
    register: (data) => api.post('/auth/sign-up/email', data),
    logout: () => api.post('/auth/sign-out', {}),
    getSession: () => api.get('/check-session').catch(() => api.get('/auth/get-session')),
};

export const sekolahApi = {
    list: (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/sekolah?${q}`); },
    getById: (id) => api.get(`/sekolah/${id}`),
    create: (data) => api.post('/sekolah', data),
    update: (id, data) => api.put(`/sekolah/${id}`, data),
    delete: (id) => api.delete(`/sekolah/${id}`),
    uploadKop: (id, file) => { const fd = new FormData(); fd.append('file', file); return api.upload(`/sekolah/${id}/upload-kop`, fd); },
    uploadDenah: (id, file) => { const fd = new FormData(); fd.append('file', file); return api.upload(`/sekolah/${id}/upload-denah`, fd); },
    downloadKop: (id) => fetch(`/api/sekolah/${id}/download-kop`, { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('File tidak ditemukan'); return r.blob(); }),
    downloadDenah: (id) => fetch(`/api/sekolah/${id}/download-denah`, { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('File tidak ditemukan'); return r.blob(); }),
    deleteKop: (id) => api.delete(`/sekolah/${id}/kop`),
    deleteDenah: (id) => api.delete(`/sekolah/${id}/denah`),
};

export const sarprasApi = {
    list: (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/sarpras?${q}`); },
    getById: (id) => api.get(`/sarpras/${id}`),
    create: (formData) => api.upload('/sarpras', formData),
    batchCreate: (data) => api.post('/sarpras/batch', data),
    batchCreateByNpsn: (data) => api.post('/sarpras/batch-by-npsn', data),
    update: (id, data) => api.put(`/sarpras/${id}`, data),
    delete: (id) => api.delete(`/sarpras/${id}`),
    verify: (id) => api.post(`/sarpras/${id}/verify`),
    unverify: (id) => api.post(`/sarpras/${id}/unverify`),
    batchVerify: (ids) => api.post('/sarpras/batch-verify', { ids }),
    addFoto: (id, formData) => api.upload(`/sarpras/${id}/foto`, formData),
    removeFoto: (sarprasId, fotoId) => api.delete(`/sarpras/${sarprasId}/foto/${fotoId}`),
    stats: () => api.get('/sarpras/stats'),
};

export const proposalApi = {
    list: (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/proposal?${q}`); },
    getById: (id) => api.get(`/proposal/${id}`),
    create: (data) => api.post('/proposal', data),
    update: (id, data) => api.put(`/proposal/${id}`, data),
    delete: (id) => api.delete(`/proposal/${id}`),
    updateStatus: (id, status, alasan) => api.put(`/proposal/${id}/status`, { status, alasan }),
    updateKeranjang: (id, keranjang) => api.put(`/proposal/${id}/keranjang`, { keranjang }),
    updateRanking: (id, data) => api.put(`/proposal/${id}/ranking`, data),
    batchApprove: (ids) => api.post('/proposal/batch-approve', { ids }),
    uploadPdf: (id, formData) => api.upload(`/proposal/${id}/upload`, formData, 'PUT'),
};

export const proyeksiApi = {
    listAnggaran: () => api.get('/proyeksi/anggaran'),
    createAnggaran: (data) => api.post('/proyeksi/anggaran', data),
    updateAnggaran: (id, data) => api.put(`/proyeksi/anggaran/${id}`, data),
    deleteAnggaran: (id) => api.delete(`/proyeksi/anggaran/${id}`),
    listSnp: () => api.get('/proyeksi/snp'),
    createSnp: (data) => api.post('/proyeksi/snp', data),
    updateSnp: (id, data) => api.put(`/proyeksi/snp/${id}`, data),
    deleteSnp: (id) => api.delete(`/proyeksi/snp/${id}`),
    rekap: () => api.get('/proyeksi/rekap'),
};

export const matrikApi = {
    list: (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/matrik?${q}`); },
    getById: (id) => api.get(`/matrik/${id}`),
    create: (data) => api.post('/matrik', data),
    update: (id, data) => api.put(`/matrik/${id}`, data),
    delete: (id) => api.delete(`/matrik/${id}`),
    bulkCreate: (items) => api.post('/matrik/bulk', { items }),
};

export const pencairanApi = {
    list: () => api.get('/pencairan'),
    getByMatrik: (matrikId) => api.get(`/pencairan/${matrikId}`),
    upsert: (matrikId, data) => api.put(`/pencairan/${matrikId}`, data),
};

export const bastApi = {
    list: () => api.get('/bast'),
    getById: (id) => api.get(`/bast/${id}`),
    create: (data) => api.post('/bast', data),
    update: (id, data) => api.put(`/bast/${id}`, data),
    delete: (id) => api.delete(`/bast/${id}`),
    revert: (matrikId) => api.post(`/bast/revert/${matrikId}`),
    getByNpsn: (npsn) => api.get(`/bast/by-npsn/${npsn}`),
};

export const templateApi = {
    list: () => api.get('/template'),
    create: (data) => api.upload('/template', data),
    update: (id, data) => api.upload(`/template/${id}`, data, 'PUT'),
    delete: (id) => api.delete(`/template/${id}`),
};

export const riwayatBantuanApi = {
    list: (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/riwayat-bantuan?${q}`); },
    create: (data) => api.post('/riwayat-bantuan', data),
    update: (id, data) => api.put(`/riwayat-bantuan/${id}`, data),
    delete: (id) => api.delete(`/riwayat-bantuan/${id}`),
};

export const prestasiApi = {
    list: (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/prestasi?${q}`); },
    create: (data) => api.post('/prestasi', data),
    update: (id, data) => api.put(`/prestasi/${id}`, data),
    delete: (id) => api.delete(`/prestasi/${id}`),
    verify: (id) => api.post(`/prestasi/${id}/verify`),
    reject: (id, alasan) => api.post(`/prestasi/${id}/reject`, { alasan }),
    unverify: (id) => api.post(`/prestasi/${id}/unverify`),
    listPointRules: () => api.get('/prestasi/point-rules'),
    createPointRule: (data) => api.post('/prestasi/point-rules', data),
    updatePointRule: (id, data) => api.put(`/prestasi/point-rules/${id}`, data),
    deletePointRule: (id) => api.delete(`/prestasi/point-rules/${id}`),
    rekap: () => api.get('/prestasi/rekap'),
    uploadSertifikat: (id, formData) => api.upload(`/prestasi/${id}/sertifikat`, formData),
};

export const kerusakanApi = {
    list: (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/form-kerusakan?${q}`); },
    create: (formData) => api.upload('/form-kerusakan', formData),
    uploadFile: (id, formData) => api.upload(`/form-kerusakan/${id}/upload`, formData, 'PUT'),
    delete: (id) => api.delete(`/form-kerusakan/${id}`),
    verify: (id) => api.post(`/form-kerusakan/${id}/verify`),
    reject: (id, alasan) => api.post(`/form-kerusakan/${id}/reject`, { alasan }),
    unverify: (id) => api.post(`/form-kerusakan/${id}/unverify`),
    missing: () => api.get('/form-kerusakan/missing'),
};

export const rankingApi = {
    getLock: () => api.get('/settings/ranking/lock'),
    setLock: (key, locked) => api.put('/settings/ranking/lock', { key, locked }),
    getData: (kecamatan, jenjang) => {
        const q = new URLSearchParams({ kecamatan: kecamatan || 'all', jenjang: jenjang || 'all' }).toString();
        return api.get(`/settings/ranking/data?${q}`);
    },
    saveData: (kecamatan, jenjang, items) => {
        const q = new URLSearchParams({ kecamatan: kecamatan || 'all', jenjang: jenjang || 'all' }).toString();
        return api.put(`/settings/ranking/data?${q}`, { items, kecamatan, jenjang });
    },
};

export const korwilApi = {
    list: () => api.get('/korwil'),
    assign: (data) => api.post('/korwil', data),
    update: (userId, data) => api.put(`/korwil/${userId}`, data),
    delete: (userId) => api.delete(`/korwil/${userId}`),
};

export const penggunaApi = {
    list: (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/pengguna?${q}`); },
    getById: (id) => api.get(`/pengguna/${id}`),
    batchCreate: (users) => api.post('/pengguna/batch', { users }),
    update: (id, data) => api.put(`/pengguna/${id}`, data),
    toggleActive: (id) => api.put(`/pengguna/${id}/toggle-active`),
    delete: (id) => api.delete(`/pengguna/${id}`),
    changePassword: (id, newPassword) => api.put(`/pengguna/${id}/change-password`, { newPassword }),
    uploadPhoto: (id, file) => { const fd = new FormData(); fd.append('photo', file); return api.upload(`/pengguna/${id}/photo`, fd, 'PUT'); },
};

export const aktivitasApi = {
    list: (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/aktivitas?${q}`); },
    my: () => api.get('/aktivitas/my'),
    delete: (id) => api.delete(`/aktivitas/${id}`),
};

export const settingsApi = {
    getAccess: () => api.get('/settings/access'),
    setAccess: (config) => api.put('/settings/access', config),
    saveAccess: (config) => api.put('/settings/access', config),
    resetAccess: () => api.post('/settings/access/reset'),
    getCountdown: () => api.get('/settings/countdown'),
    setCountdown: (config) => api.put('/settings/countdown', config),
    resetCountdown: () => api.post('/settings/countdown/reset'),
    getNas: () => api.get('/settings/nas'),
    setNas: (config) => api.put('/settings/nas', config),
    testNas: () => api.post('/settings/nas/test'),
    resetNas: () => api.post('/settings/nas/reset'),
    listNasFolders: (path = '/') => api.get(`/settings/nas/folders?path=${encodeURIComponent(path)}`),
    // Google Drive
    getGdrive: () => api.get('/settings/gdrive'),
    setGdrive: (config) => api.put('/settings/gdrive', config),
    testGdrive: () => api.post('/settings/gdrive/test'),
    resetGdrive: () => api.post('/settings/gdrive/reset'),
    listGdriveFolders: (parentId = '') => api.get(`/settings/gdrive/folders?parentId=${encodeURIComponent(parentId)}`),
};

export const dashboardApi = {
    admin: () => api.get('/dashboard/admin'),
    korwil: (kecamatan) => api.get(`/dashboard/korwil?kecamatan=${kecamatan}`),
    sekolah: () => api.get('/dashboard/sekolah'),
};

export const queueApi = {
    status: () => api.get('/queue/status'),
};

export const arsipDokumenApi = {
    listRekomendasi: () => api.get('/arsip-dokumen/rekomendasi'),
    createRekomendasi: (data) => api.post('/arsip-dokumen/rekomendasi', data),
    deleteRekomendasi: (id) => api.delete(`/arsip-dokumen/rekomendasi/${id}`),
    listChecklist: () => api.get('/arsip-dokumen/checklist'),
    createChecklist: (data) => api.post('/arsip-dokumen/checklist', data),
    deleteChecklist: (id) => api.delete(`/arsip-dokumen/checklist/${id}`),
};


