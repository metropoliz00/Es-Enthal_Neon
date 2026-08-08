
import React, { useState, useMemo } from 'react';
import { Clock, Search, Save, Loader2, Filter, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { api } from '../../src/services/api';
import { User } from '../../types';
import { useToast } from '../../context/ToastContext';
import { parseTeamAndMembers } from '../../utils/adminHelpers';

const AturSesiTab = ({ currentUser, students, refreshData, isLoading }: { currentUser: User, students: any[], refreshData: () => void, isLoading: boolean }) => {
    const { showToast } = useToast();
    const [sessionInput, setSessionInput] = useState('Sesi 1');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // FILTER ONLY STUDENTS
    const studentList = useMemo(() => students.filter(s => s.role === 'siswa'), [students]);

    const uniqueSchools = useMemo(() => {
        const schools = new Set(studentList.map(s => s.school).filter(Boolean));
        return Array.from(schools).sort() as string[];
    }, [studentList]);

    const uniqueKecamatans = useMemo(() => {
        const kecs = new Set(studentList.map(s => s.kecamatan).filter(Boolean).filter(k => k !== '-'));
        return Array.from(kecs).sort();
    }, [studentList]);

    const uniqueClasses = useMemo(() => {
        const classes = new Set(studentList.map(s => s.kelas).filter(Boolean));
        return Array.from(classes).sort((a: any, b: any) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [studentList]);

    const filteredStudents = useMemo(() => {
        let res = studentList.filter(s => {
            const matchName = (s.fullname || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (s.username || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            if (currentUser.role === 'Guru') {
                return matchName && (s.school || '').toLowerCase() === (currentUser.kelas_id || '').toLowerCase();
            }
            
            let matchFilter = true;
            if (filterSchool !== 'all') matchFilter = matchFilter && s.school === filterSchool;
            if (filterKecamatan !== 'all') matchFilter = matchFilter && (s.kecamatan || '').toLowerCase() === filterKecamatan.toLowerCase();
            if (filterClass !== 'all') matchFilter = matchFilter && (s.kelas || '') === filterClass;

            return matchName && matchFilter;
        });

        // Sort by Name
        return res.sort((a, b) => {
            const nameA = (a.fullname || a.username || '').toLowerCase();
            const nameB = (b.fullname || b.username || '').toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    }, [studentList, searchTerm, currentUser, filterSchool, filterKecamatan, filterClass, sortOrder]);

    const handleSave = async () => {
        if (!sessionInput) return showToast("Pilih sesi terlebih dahulu", "warning");
        if (selectedUsers.size === 0) return showToast("Pilih siswa terlebih dahulu", "warning");
        const updates = Array.from(selectedUsers).map(u => ({ username: String(u), session: sessionInput }));
        const res = await api.updateUserSessions(updates);
        if (res.success) {
            showToast("Sesi berhasil diupdate", "success");
        } else {
            showToast("Gagal mengupdate sesi", "error");
        }
        refreshData();
        setSelectedUsers(new Set());
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) setSelectedUsers(new Set(filteredStudents.map(s => s.username)));
        else setSelectedUsers(new Set());
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-700"><Clock size={20}/> Atur Sesi Ujian</h3>
            <div className="flex flex-col xl:flex-row gap-4 mb-6">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Set Sesi</label>
                        <select className="p-2 border border-slate-200 rounded-lg bg-slate-50 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100" value={sessionInput} onChange={e => setSessionInput(e.target.value)}>
                            <option value="">-- Pilih Sesi --</option>
                            <option value="Sesi 1">Sesi 1</option>
                            <option value="Sesi 2">Sesi 2</option>
                            <option value="Sesi 3">Sesi 3</option>
                            <option value="Sesi 4">Sesi 4</option>
                        </select>
                    </div>
                    {currentUser.role === 'admin' && (
                        <>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Filter Kecamatan</label>
                            <select 
                                className="p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
                                value={filterKecamatan}
                                onChange={e => setFilterKecamatan(e.target.value)}
                            >
                                <option value="all">Semua Kecamatan</option>
                                {uniqueKecamatans.map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Filter Sekolah</label>
                            <select 
                                className="p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
                                value={filterSchool}
                                onChange={e => {
                                    const val = e.target.value;
                                    setFilterSchool(val);
                                    if (val !== 'all') {
                                        const found = studentList.find(s => s.school === val);
                                        if (found && found.kecamatan) setFilterKecamatan(found.kecamatan);
                                    }
                                }}
                            >
                                <option value="all">Semua Sekolah</option>
                                {uniqueSchools.map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        </>
                    )}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Filter Kelas</label>
                        <div className="relative">
                            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <select 
                                className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
                                value={filterClass}
                                onChange={e => setFilterClass(e.target.value)}
                            >
                                <option value="all">Semua Kelas</option>
                                {uniqueClasses.map((s:any) => <option key={s} value={s}>Kelas {s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 lg:col-span-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Cari Peserta</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input type="text" placeholder="Cari Peserta..." className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-full outline-none focus:ring-2 focus:ring-indigo-100" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition shadow-sm w-10 flex items-center justify-center" title={sortOrder === 'asc' ? "Urutkan Z-A" : "Urutkan A-Z"}>
                                {sortOrder === 'asc' ? <ArrowDownAZ size={18}/> : <ArrowUpZA size={18}/>}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex items-end gap-2">
                    <button onClick={handleSave} disabled={isLoading} className="h-[38px] px-6 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2 whitespace-nowrap">
                        {isLoading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Atur Sesi
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4 w-10"><input type="checkbox" onChange={e => toggleSelectAll(e.target.checked)} checked={filteredStudents.length > 0 && selectedUsers.size === filteredStudents.length} /></th>
                            <th className="p-4">Username</th>
                            <th className="p-4">Nama Lengkap</th>
                            <th className="p-4 text-center">Kelas</th>
                            <th className="p-4">Sekolah</th>
                            <th className="p-4">Kecamatan</th>
                            <th className="p-4 text-center">Jenis Ujian</th>
                            <th className="p-4 text-center">Sesi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredStudents.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-400 italic">Tidak ada siswa yang cocok dengan filter.</td></tr>
                        ) : filteredStudents.map(s => (
                            <tr key={s.username} className="hover:bg-slate-50 transition">
                                <td className="p-4">
                                    <input type="checkbox" checked={selectedUsers.has(s.username)} onChange={() => {
                                        const newSet = new Set(selectedUsers);
                                        if (newSet.has(s.username)) newSet.delete(s.username);
                                        else newSet.add(s.username);
                                        setSelectedUsers(newSet);
                                    }}/>
                                </td>
                                <td className="p-4 font-mono text-slate-500 font-bold">{s.username}</td>
                                <td className="p-4 font-bold text-slate-700">
                                    {((s.exam_type || '').toUpperCase().includes('LCC') || 
                                      (s.exam_type || '').toUpperCase().includes('CERDAS') || 
                                      (s.username || '').toLowerCase().startsWith('regu_') || 
                                      (s.username || '').toLowerCase().startsWith('team_') ||
                                      (s.active_exam || '').toUpperCase().includes('LCC') ||
                                      (s.active_exam || '').toUpperCase().includes('CERDAS')) ? (
                                        (() => {
                                            const { reguTitle, members } = parseTeamAndMembers(s.fullname || s.nama_lengkap || s.username);
                                            return (
                                                <div className="flex flex-col gap-1.5 text-xs py-1">
                                                    <div className="font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 shadow-sm max-w-max uppercase tracking-wide">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                                        {reguTitle}
                                                    </div>
                                                    {members && members.length > 0 ? (
                                                        <ol className="list-none pl-1 space-y-1 text-slate-600 font-semibold mt-1">
                                                            {members.map((m: string, idx: number) => (
                                                                <li key={idx} className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-mono font-black text-indigo-500 bg-indigo-50/80 border border-indigo-100/50 w-4 h-4 rounded-full flex items-center justify-center shadow-2xs">{idx + 1}</span>
                                                                    <span className="text-slate-700 font-medium">{m}</span>
                                                                </li>
                                                            ))}
                                                        </ol>
                                                    ) : null}
                                                </div>
                                            );
                                        })()
                                    ) : (
                                        s.fullname
                                    )}
                                </td>
                                <td className="p-4 text-center">{s.kelas || '-'}</td>
                                <td className="p-4 text-slate-600">{s.school}</td>
                                <td className="p-4 text-slate-600">{s.kecamatan || '-'}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${s.exam_type ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {s.exam_type || '-'}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${s.session ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {s.session || 'Belum Diatur'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 text-xs text-slate-400 flex justify-between">
                <span>Total Siswa: {filteredStudents.length}</span>
                <span>Terpilih: {selectedUsers.size}</span>
            </div>
        </div>
    );
};

export default AturSesiTab;
