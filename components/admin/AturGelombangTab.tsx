import React, { useState, useEffect } from 'react';
import { api } from '../../src/services/api';
import { SchoolSchedule } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Save, Plus, Trash2, Calendar, Clock } from 'lucide-react';
import { getSchoolOnly } from '../../utils/adminHelpers';

const AturGelombangTab = ({ students = [] }: { students?: any[] }) => {
    const [schedules, setSchedules] = useState<SchoolSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    // Extract Unique Schools from Students
    const uniqueSchools = React.useMemo(() => {
        const schools = new Set(students.filter(s => s.role === 'siswa' && s.school).map(s => getSchoolOnly(s.school)));
        return Array.from(schools).sort() as string[];
    }, [students]);

    // Map School to Kecamatan
    const schoolKecMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        students.forEach(s => {
            if (s.school && s.kecamatan) {
                map[s.school] = s.kecamatan;
                map[getSchoolOnly(s.school)] = s.kecamatan;
            }
        });
        return map;
    }, [students]);

    useEffect(() => {
        fetchSchedules();
    }, []);

    const fetchSchedules = async () => {
        setLoading(true);
        const data = await api.getSchoolSchedules();
        setSchedules(data);
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

    if (loading) return <div className="p-8 text-center">Memuat data...</div>;

    return (
        <div className="space-y-6 fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Calendar size={24} className="text-indigo-600"/> Atur Jadwal Gelombang</h2>
                    <p className="text-sm text-slate-500">Kelola jadwal ujian per sekolah/gelombang.</p>
                </div>
                <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-bold text-sm shadow-lg shadow-indigo-200">
                    <Save size={18} /> Simpan Jadwal
                </button>
            </div>

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
                                    <td className="p-3 text-center"><button onClick={() => deleteSchedule(i)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition"><Trash2 size={18} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {schedules.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-lg mt-4 border border-dashed border-slate-200">
                        Belum ada jadwal gelombang diatur.
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
