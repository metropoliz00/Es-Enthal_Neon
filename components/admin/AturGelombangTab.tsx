import React, { useState, useEffect } from 'react';
import { api } from '../../src/services/api';
import { SchoolSchedule } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Save, Plus, Trash2, Calendar, Sparkles, RefreshCw } from 'lucide-react';
import { getSchoolOnly } from '../../utils/adminHelpers';

const AturGelombangTab = ({ students = [] }: { students?: any[] }) => {
    const [schedules, setSchedules] = useState<SchoolSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    // Extract Unique Schools from Students (only role: siswa)
    const uniqueSchools = React.useMemo(() => {
        const schools = new Set<string>();
        students.forEach(s => {
            const role = (s.role || 'siswa').toLowerCase();
            if (role === 'siswa') {
                const sch = getSchoolOnly(s.school || s.kelas_id || '');
                if (sch && sch !== '-' && sch.trim() !== '') {
                    schools.add(sch.trim());
                }
            }
        });
        return Array.from(schools).sort();
    }, [students]);

    // Map School to Kecamatan
    const schoolKecMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        students.forEach(s => {
            const role = (s.role || 'siswa').toLowerCase();
            if (role === 'siswa') {
                const sch = getSchoolOnly(s.school || s.kelas_id || '');
                if (sch && s.kecamatan) {
                    map[sch] = s.kecamatan;
                    if (s.school) map[s.school] = s.kecamatan;
                }
            }
        });
        return map;
    }, [students]);

    const handleAutoDetect = (currentSchedules: SchoolSchedule[] = schedules, notify = true) => {
        if (uniqueSchools.length === 0) {
            if (notify) showToast('Tidak ada data sekolah terdaftar yang ditemukan.', 'warning');
            return currentSchedules;
        }

        const existingSet = new Set(currentSchedules.map(s => getSchoolOnly(s.school)).filter(Boolean));
        const missingSchools = uniqueSchools.filter(sch => !existingSet.has(sch));

        if (missingSchools.length === 0) {
            if (notify) showToast('Semua sekolah terdaftar sudah ada dalam daftar jadwal.', 'info');
            return currentSchedules;
        }

        const newRows: SchoolSchedule[] = missingSchools.map(sch => ({
            school: sch,
            gelombang: 'Gelombang 1',
            tanggal: '',
            tanggal_selesai: ''
        }));

        const combined = [...currentSchedules, ...newRows];
        setSchedules(combined);
        if (notify) {
            showToast(`Otomatis menambahkan ${missingSchools.length} sekolah terdaftar.`, 'success');
        }
        return combined;
    };

    useEffect(() => {
        fetchSchedules();
    }, [uniqueSchools.length]);

    const fetchSchedules = async () => {
        setLoading(true);
        const data = await api.getSchoolSchedules();
        if (data.length === 0 && uniqueSchools.length > 0) {
            // Auto-populate all registered schools if schedule list is empty
            const populated = uniqueSchools.map(sch => ({
                school: sch,
                gelombang: 'Gelombang 1',
                tanggal: '',
                tanggal_selesai: ''
            }));
            setSchedules(populated);
        } else {
            setSchedules(data);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        const cleanSchedules = schedules.filter(s => s.school && s.school.trim() !== '');
        if (cleanSchedules.length === 0 && schedules.length > 0) {
            showToast('Silakan pilih sekolah untuk jadwal yang ingin disimpan.', 'warning');
            return;
        }
        const result = await api.saveSchoolSchedules(cleanSchedules);
        if (result.success) {
            setSchedules(cleanSchedules);
            showToast('Jadwal berhasil disimpan ke backend', 'success');
        } else {
            showToast('Gagal menyimpan jadwal', 'error');
        }
    };

    const addSchedule = () => {
        setSchedules([...schedules, { school: '', gelombang: '', tanggal: '', tanggal_selesai: '' }]);
    };

    const updateSchedule = (index: number, field: keyof SchoolSchedule, value: string) => {
        const newSchedules = [...schedules];
        newSchedules[index][field] = value;
        setSchedules(newSchedules);
    };

    const deleteSchedule = (index: number) => {
        setSchedules(schedules.filter((_, i) => i !== index));
    };

    const missingSchools = uniqueSchools.filter(sch => !schedules.some(s => getSchoolOnly(s.school) === sch));

    if (loading) return <div className="p-8 text-center text-slate-500 font-medium">Memuat data jadwal gelombang...</div>;

    return (
        <div className="space-y-6 fade-in">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar size={24} className="text-indigo-600"/> Atur Jadwal Gelombang
                    </h2>
                    <p className="text-sm text-slate-500">
                        Kelola jadwal ujian per sekolah/gelombang ({uniqueSchools.length} Sekolah Terdaftar).
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => handleAutoDetect(schedules, true)} 
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-100 font-bold text-sm transition"
                        title="Deteksi dan tambahkan otomatis sekolah terdaftar yang belum ada"
                    >
                        <Sparkles size={16} /> Deteksi Otomatis ({uniqueSchools.length} Sekolah)
                    </button>
                    <button 
                        onClick={handleSave} 
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-bold text-sm shadow-lg shadow-indigo-200 transition"
                    >
                        <Save size={18} /> Simpan Jadwal
                    </button>
                </div>
            </div>

            {missingSchools.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-amber-900 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                        <Sparkles size={18} className="text-amber-600 flex-shrink-0" />
                        <span>Ditemukan <strong>{missingSchools.length} sekolah terdaftar</strong> yang belum ada di tabel jadwal gelombang.</span>
                    </div>
                    <button 
                        onClick={() => handleAutoDetect(schedules, true)}
                        className="bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-amber-700 transition"
                    >
                        + Tambahkan Otomatis
                    </button>
                </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="p-3 border-b border-slate-200">Sekolah</th>
                                <th className="p-3 border-b border-slate-200">Kecamatan</th>
                                <th className="p-3 border-b border-slate-200">Gelombang</th>
                                <th className="p-3 border-b border-slate-200">Tanggal Mulai</th>
                                <th className="p-3 border-b border-slate-200">Tanggal Selesai</th>
                                <th className="p-3 border-b border-slate-200 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {schedules.map((s, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition">
                                    <td className="p-3">
                                        <select 
                                            className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 bg-white" 
                                            value={s.school} 
                                            onChange={e => updateSchedule(i, 'school', e.target.value)}
                                        >
                                            <option value="">-- Pilih Sekolah --</option>
                                            {uniqueSchools.map(sch => (
                                                <option key={sch} value={sch}>{sch}</option>
                                            ))}
                                            {/* Keep existing value if not in list (e.g. manual entry from before) */}
                                            {s.school && !uniqueSchools.includes(s.school) && (
                                                <option value={s.school}>{getSchoolOnly(s.school)}</option>
                                            )}
                                        </select>
                                    </td>
                                    <td className="p-3 text-slate-600 font-medium">
                                        {s.school ? (schoolKecMap[s.school] || '-') : '-'}
                                    </td>
                                    <td className="p-3">
                                        <select 
                                            className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 bg-white" 
                                            value={s.gelombang} 
                                            onChange={e => updateSchedule(i, 'gelombang', e.target.value)}
                                        >
                                            <option value="">-- Pilih Gelombang --</option>
                                            <option value="Gelombang 1">Gelombang 1</option>
                                            <option value="Gelombang 2">Gelombang 2</option>
                                            <option value="Gelombang 3">Gelombang 3</option>
                                        </select>
                                    </td>
                                    <td className="p-3"><input type="date" className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100" value={s.tanggal} onChange={e => updateSchedule(i, 'tanggal', e.target.value)} /></td>
                                    <td className="p-3"><input type="date" className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100" value={s.tanggal_selesai || ''} onChange={e => updateSchedule(i, 'tanggal_selesai', e.target.value)} /></td>
                                    <td className="p-3 text-center"><button onClick={() => deleteSchedule(i)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition" title="Hapus baris"><Trash2 size={18} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {schedules.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-lg mt-4 border border-dashed border-slate-200">
                        Belum ada jadwal gelombang diatur. Klik "Deteksi Otomatis" untuk memuat sekolah terdaftar.
                    </div>
                )}
                <button onClick={addSchedule} className="mt-4 text-indigo-600 flex items-center gap-2 font-bold text-sm hover:bg-indigo-50 px-4 py-2 rounded-lg transition border border-indigo-100">
                    <Plus size={18} /> Tambah Jadwal
                </button>
            </div>
        </div>
    );
};

export default AturGelombangTab;

