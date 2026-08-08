
import React, { useState, useMemo, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { Group, Search, Save, Loader2, Filter, Target, ListChecks, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { api } from '../../src/services/api';
import { User, Exam, LearningObjective } from '../../types';
import { getSubjects, getExamTypes, getExamSubjectMapping, getSchoolOnly, parseTeamAndMembers } from '../../utils/adminHelpers';

const KelompokTesTab = ({ currentUser, students, refreshData }: { currentUser: User, students: any[], refreshData: () => void }) => {
    const { showToast } = useToast();
    // Logic TP
    const [tps, setTps] = useState<LearningObjective[]>([]);
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedTp, setSelectedTp] = useState('');
    const [selectedPaket, setSelectedPaket] = useState('');
    const [pakets, setPakets] = useState<string[]>([]);
    
    // Logic Exam Type
    const [examTypes, setExamTypes] = useState<{id: string, label: string}[]>([]);
    const [selectedExamType, setSelectedExamType] = useState('');
    const [selectedSumatifType, setSelectedSumatifType] = useState('Sumatif 1');
    const [examSubjectMapping, setExamSubjectMapping] = useState<{examTypeId: string, subjectIds: string[]}[]>([]);
    const [subjectsDb, setSubjectsDb] = useState<{id: string, label: string}[]>([]);
    
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [loadingTps, setLoadingTps] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        const loadInitial = async () => {
            const [tpData, config] = await Promise.all([
                api.getLearningObjectives(),
                api.getAppConfig()
            ]);
            setTps(tpData);
            
            const types = getExamTypes(config);
            const mapping = getExamSubjectMapping(config);
            const subjects = getSubjects(config);
            
            setExamTypes(types);
            setExamSubjectMapping(mapping);
            setSubjectsDb(subjects);
            
            if (types.length > 0) {
                setSelectedExamType(types[0].id);
            }
        };
        loadInitial();
    }, []);

    // STRICTLY FILTER FOR STUDENTS ONLY
    const studentList = useMemo(() => {
        return students.filter(s => s.role === 'siswa');
    }, [students]);

    const uniqueSchools = useMemo(() => {
        const schools = new Set(studentList.map(s => getSchoolOnly(s.school)).filter(Boolean));
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

    const filteredSubjects = useMemo(() => {
        const mapping = examSubjectMapping.find(m => m.examTypeId === selectedExamType);
        if (!mapping || mapping.subjectIds.length === 0) return subjectsDb;
        
        return subjectsDb.filter(s => mapping.subjectIds.includes(s.id));
    }, [subjectsDb, selectedExamType, examSubjectMapping]);

    const filteredTps = useMemo(() => {
        if (!selectedExam) return [];
        // Match TP Mapel with selectedExam (which is now the Subject Label)
        const examNameLower = selectedExam.toLowerCase();
        
        return tps.filter(tp => {
            return examNameLower.includes((tp.mapel || '').toLowerCase());
        });
    }, [selectedExam, tps]);

    // Reset selected TP and Paket when exam or exam type changes
    useEffect(() => {
        setSelectedTp('');
        setSelectedPaket('');
    }, [selectedExam, selectedExamType]);

    // Load Packets when Exam changes
    useEffect(() => {
        if (!selectedExam) {
            setPakets([]);
            return;
        }
        const loadPakets = async () => {
            try {
                const questions = await api.getRawQuestions(selectedExam);
                const uniquePakets = Array.from(new Set(questions.map(q => q.kode_paket).filter(Boolean))).sort();
                setPakets(uniquePakets as string[]);
            } catch (e) {
                console.error("Error loading pakets", e);
            }
        };
        loadPakets();
    }, [selectedExam]);

    const filteredStudents = useMemo(() => {
        let res = studentList.filter(s => {
            const matchName = (s.fullname || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (s.username || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            if (currentUser.role === 'Guru') {
                return matchName && (s.school || '').toLowerCase() === (currentUser.kelas_id || '').toLowerCase();
            }
            
            let matchFilter = true;
            if (filterSchool !== 'all') matchFilter = matchFilter && (s.school === filterSchool || getSchoolOnly(s.school) === filterSchool);
            if (filterKecamatan !== 'all') matchFilter = matchFilter && (s.kecamatan || '').toLowerCase() === filterKecamatan.toLowerCase();
            if (filterClass !== 'all') matchFilter = matchFilter && (s.kelas || '') === filterClass;

            // Filter by Exam Type if selected
            if (selectedExamType) {
                const targetType = selectedExamType === 'SUMATIF' ? selectedSumatifType : selectedExamType;
                matchFilter = matchFilter && (s.exam_type === targetType);
            }

            return matchName && matchFilter;
        });

        // Sort by Name
        return res.sort((a, b) => {
            const nameA = (a.fullname || a.username || '').toLowerCase();
            const nameB = (b.fullname || b.username || '').toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    }, [studentList, searchTerm, currentUser, filterSchool, filterKecamatan, filterClass, sortOrder, selectedExamType, selectedSumatifType]);

    const handleSave = async () => {
        if (!selectedExam) return showToast("Pilih ujian terlebih dahulu", "info");
        if (selectedUsers.size === 0) return showToast("Pilih siswa", "info");
        
        setLoading(true);
        try {
            // Pass selectedTp and selectedExamType to API
            const isSumatif = (selectedExamType || '').toUpperCase().includes('SUMATIF');
            const tpToSave = isSumatif ? selectedTp : '';
            const paketToSave = !isSumatif ? selectedPaket : '';
            const finalExamType = selectedExamType === 'SUMATIF' ? selectedSumatifType : selectedExamType;
            
            const res = await api.assignTestGroup(
                Array.from(selectedUsers).map(String), 
                selectedExam, 
                '', 
                tpToSave,
                finalExamType,
                paketToSave
            );
            if (res.success) {
                showToast("Berhasil set ujian aktif, TP, dan jenis ujian.", "success");
                refreshData();
                setSelectedUsers(new Set());
            } else {
                showToast("Gagal menyimpan ke database: " + (res.message || "Database Error"), "error");
            }
        } catch(e: any) { console.error(e); showToast("Gagal menyimpan ke database: " + (e.message || "Error"), "error"); }
        setLoading(false);
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) setSelectedUsers(new Set(filteredStudents.map(s => s.username)));
        else setSelectedUsers(new Set());
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-700"><Group size={20}/> Kelompok Tes (Set Ujian Aktif)</h3>
            
            <div className="flex flex-col gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* SELECT EXAM TYPE (NEW) */}
                    <div className="lg:col-span-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Jenis Ujian</label>
                         <div className="relative">
                             <ListChecks className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                             <select className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-indigo-700" value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)}>
                                {examTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                         </div>
                    </div>

                    {/* SELECT EXAM */}
                    <div className="lg:col-span-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pilih Ujian (Mapel)</label>
                         <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-indigo-700" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
                            <option value="">-- Pilih Ujian --</option>
                            {filteredSubjects.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                        </select>
                    </div>

                    {/* SELECT SUMATIF TYPE - ONLY SHOW FOR SUMATIF */}
                    {selectedExamType === 'SUMATIF' && (
                        <div className="lg:col-span-1">
                             <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Jenis Sumatif</label>
                             <select 
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-indigo-700" 
                                value={selectedSumatifType} 
                                onChange={e => setSelectedSumatifType(e.target.value)}
                             >
                                <option value="Sumatif 1">Sumatif 1</option>
                                <option value="Sumatif 2">Sumatif 2</option>
                                <option value="Sumatif 3">Sumatif 3</option>
                                <option value="Sumatif 4">Sumatif 4</option>
                                <option value="Sumatif Akhir Semester">Sumatif Akhir Semester</option>
                            </select>
                        </div>
                    )}

                    {/* SELECT TP or PAKET */}
                    {(selectedExamType || '').toUpperCase().includes('SUMATIF') ? (
                        <div className="lg:col-span-1">
                             <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pilih Tujuan Pembelajaran (TP)</label>
                             <div className="relative">
                                 <Target className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                 <select 
                                    className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-indigo-700" 
                                    value={selectedTp} 
                                    onChange={e => setSelectedTp(e.target.value)}
                                    disabled={!selectedExam || filteredTps.length === 0}
                                 >
                                    <option value="">-- Semua TP (Default) --</option>
                                    {filteredTps.map(tp => (
                                        <option key={tp.id} value={tp.id}>
                                            {tp.id} - {tp.materi ? tp.materi.substring(0, 30) + (tp.materi.length>30?'...':'') : 'Tanpa Materi'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {selectedExam && filteredTps.length === 0 && !loadingTps && (
                                <p className="text-[9px] text-orange-500 mt-1 italic">*Belum ada data TP untuk mapel ini.</p>
                            )}
                        </div>
                    ) : (
                        <div className="lg:col-span-1">
                             <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pilih Paket Soal</label>
                             <div className="relative">
                                 <Target className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                 <select 
                                    className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-indigo-700" 
                                    value={selectedPaket} 
                                    onChange={e => setSelectedPaket(e.target.value)}
                                    disabled={!selectedExam || pakets.length === 0}
                                 >
                                    <option value="">-- Pilih Paket --</option>
                                    {pakets.map(p => (
                                        <option key={p} value={p}>Paket {p}</option>
                                    ))}
                                </select>
                            </div>
                            {selectedExam && pakets.length === 0 && (
                                <p className="text-[9px] text-orange-500 mt-1 italic">*Belum ada paket soal untuk mapel ini.</p>
                            )}
                        </div>
                    )}
                    
                    {currentUser.role === 'admin' && (
                        <>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Kecamatan</label>
                            <select 
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
                                value={filterKecamatan}
                                onChange={e => setFilterKecamatan(e.target.value)}
                            >
                                <option value="all">Semua Kecamatan</option>
                                {uniqueKecamatans.map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Sekolah</label>
                            <select 
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
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
                                {uniqueSchools.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        </>
                    )}

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Kelas</label>
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
                    
                    <div className="lg:col-span-3 flex items-end gap-2">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cari Peserta</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input type="text" placeholder="Cari Username atau Nama..." className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-full outline-none focus:ring-2 focus:ring-indigo-100" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')} className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition shadow-sm h-[38px] w-[38px] flex items-center justify-center" title={sortOrder === 'asc' ? "Urutkan Z-A" : "Urutkan A-Z"}>
                            {sortOrder === 'asc' ? <ArrowDownAZ size={18}/> : <ArrowUpZA size={18}/>}
                        </button>
                    </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-200 pt-4 mt-2">
                     <div className="text-xs text-slate-500 font-bold">
                        Terpilih: {selectedUsers.size} Siswa
                     </div>
                     <button onClick={handleSave} disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2">
                        {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Simpan Kelompok
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4 w-10"><input type="checkbox" onChange={e => toggleSelectAll(e.target.checked)} checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedUsers.has(s.username))}/></th>
                            <th className="p-4">Username</th>
                            <th className="p-4">Nama Lengkap</th>
                            <th className="p-4 text-center">Kelas</th>
                            <th className="p-4">Sekolah</th>
                            <th className="p-4">Kecamatan</th>
                            <th className="p-4 text-center">Ujian Aktif</th>
                            <th className="p-4 text-center">Jenis Ujian</th>
                            <th className="p-4 text-center">Active TP / Paket</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredStudents.length === 0 ? (
                            <tr><td colSpan={9} className="p-8 text-center text-slate-400 italic">Tidak ada siswa yang cocok dengan filter.</td></tr>
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
                                                            {members.map((m, idx) => (
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
                                <td className="p-4 text-slate-600">{getSchoolOnly(s.school)}</td>
                                <td className="p-4 text-slate-600">{s.kecamatan || '-'}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${s.active_exam && s.active_exam !== '-' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {s.active_exam && s.active_exam !== '-' ? s.active_exam : 'Tidak Ada'}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    {s.exam_type ? (
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 whitespace-nowrap">{s.exam_type}</span>
                                    ) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex flex-wrap gap-1 justify-center items-center">
                                        {s.active_tp && (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100" title={s.active_tp}>{s.active_tp}</span>
                                        )}
                                        {s.active_paket && (
                                            <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-1 rounded border border-pink-100">Paket {s.active_paket}</span>
                                        )}
                                        {!s.active_tp && !s.active_paket && <span className="text-slate-300">-</span>}
                                    </div>
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

export default KelompokTesTab;
