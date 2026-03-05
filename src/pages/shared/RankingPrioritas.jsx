import { useState, useMemo, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Star, Lock } from 'lucide-react';
import { useProposalData } from '../../data/dataProvider';
import useAuthStore from '../../store/authStore';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';

const RankingPrioritas = ({ lockable = false }) => {
    const user = useAuthStore(s => s.user);
    const { data: proposalList } = useProposalData();
    const [proposals, setProposals] = useState([]);
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        if (proposalList.length) setProposals([...proposalList].sort((a, b) => (b.bintang || 0) - (a.bintang || 0)));
    }, [proposalList]);

    const handleRank = (id, dir) => {
        if (locked) return;
        const idx = proposals.findIndex(p => p.id === id);
        if (dir === 'up' && idx > 0) {
            const arr = [...proposals];
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
            setProposals(arr);
        } else if (dir === 'down' && idx < proposals.length - 1) {
            const arr = [...proposals];
            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
            setProposals(arr);
        }
    };

    const handleLock = () => {
        setLocked(!locked);
        toast.success(locked ? 'Ranking dibuka kembali' : 'Ranking telah dikunci!', { style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' } });
    };

    const handleSetStars = (id, stars) => {
        if (locked) return;
        setProposals(proposals.map(p => p.id === id ? { ...p, bintang: stars } : p));
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Ranking Prioritas</h1>
                    <p>Atur urutan prioritas proposal berdasarkan urgensi</p>
                </div>
                <div className="page-header-right">
                    {lockable && (
                        <button className={`btn ${locked ? 'btn-danger' : 'btn-primary'}`} onClick={handleLock}>
                            <Lock size={16} /> {locked ? 'Buka Kunci' : 'Kunci Ranking'}
                        </button>
                    )}
                </div>
            </div>
            <div className="table-container">
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr><th>Rank</th><th>Sekolah</th><th>Kecamatan</th><th>Sub Kegiatan</th><th>Nilai</th><th>Prioritas</th><th>Urutan</th></tr>
                        </thead>
                        <tbody>
                            {proposals.map((p, i) => (
                                <tr key={p.id} style={locked ? { opacity: 0.7 } : {}}>
                                    <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{i + 1}</td>
                                    <td>{p.namaSekolah}</td>
                                    <td>{p.kecamatan}</td>
                                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.subKegiatan}</td>
                                    <td>{formatCurrency(p.nilaiPengajuan)}</td>
                                    <td>
                                        <div className="star-rating">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <span key={s} className={`star ${s <= p.bintang ? 'filled' : ''}`} onClick={() => handleSetStars(p.id, s)} style={{ cursor: locked ? 'default' : 'pointer' }}>★</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" onClick={() => handleRank(p.id, 'up')} disabled={locked || i === 0} title="Naik">▲</button>
                                            <button className="btn-icon" onClick={() => handleRank(p.id, 'down')} disabled={locked || i === proposals.length - 1} title="Turun">▼</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
export default RankingPrioritas;
