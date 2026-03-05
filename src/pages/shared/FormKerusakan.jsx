import { Eye, Download } from 'lucide-react';

const FormKerusakan = () => (
    <div>
        <div className="page-header">
            <div className="page-header-left">
                <h1>Form Kerusakan</h1>
                <p>Form kerusakan dari Dinas</p>
            </div>
        </div>
        <div className="table-container">
            <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr><th>No</th><th>NPSN</th><th>Nama Sekolah</th><th>Masa Bangunan</th><th>Dokumen</th><th>Aksi</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1</td><td>20301001</td><td>SDN 01 Kroya</td><td>Bangunan A</td>
                            <td><span className="badge badge-baik">PDF Tersedia</span></td>
                            <td><div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-sm btn-secondary"><Eye size={14} /> Lihat</button>
                                <button className="btn btn-sm btn-secondary"><Download size={14} /> Unduh</button>
                            </div></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);
export default FormKerusakan;
