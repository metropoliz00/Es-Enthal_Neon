
import React, { useMemo, useState } from 'react';
import { School, Users, PlayCircle, CheckCircle2, AlertCircle, Key, Activity, Calendar, MapPin, Clock, Database, BookOpen, UserX, Search, BarChart3, Filter, ChevronDown, ChevronUp, UserCog, Shield } from 'lucide-react';
import { User } from '../../types';
import { SimpleDonutChart, getSchoolOnly } from '../../utils/adminHelpers';

interface OverviewTabProps {
    dashboardData: any;
    currentUserState: User;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ dashboardData, currentUserState }) => {
    const [schoolSearch, setSchoolSearch] = useState('');
    const [kecamatanFilter, setKecamatanFilter] = useState('all');
    const [examTypeFilter, setExamTypeFilter] = useState('all');
    const [schoolFilter, setSchoolFilter] = useState('all');
    // Default collapsed set to TRUE
    const [isDbCollapsed, setIsDbCollapsed] = useState(true);

    // Create a User Lookup Map for Real-time Data in Feed
    const userLookup = useMemo(() => {
        const map: Record<string, any> = {};
        if (dashboardData.allUsers) {
            dashboardData.allUsers.forEach((u: any) => {
                map[u.username] = u;
            });
        }
        return map;
    }, [dashboardData.allUsers]);

    // FILTER ONLY STUDENTS FOR MAIN STATS
    const studentUsers = useMemo(() => {
        return (dashboardData.allUsers || []).filter((u: any) => u.role === 'siswa');
    }, [dashboardData.allUsers]);

    // NEW: Filter active exam students
    const activeExamStudents = useMemo(() => {
        return studentUsers.filter((u: any) => u.active_exam && u.active_exam !== '-');
    }, [studentUsers]);

    // NEW: Count active exams
    const activeExams = useMemo(() => {
        const exams = new Set(activeExamStudents.map((u: any) => u.active_exam));
        return Array.from(exams);
    }, [activeExamStudents]);

    // FILTER ADMIN/GURU FOR INFO
    const staffUsers = useMemo(() => {
        return (dashboardData.allUsers || []).filter((u: any) => u.role !== 'siswa');
    }, [dashboardData.allUsers]);

    const stats = useMemo(() => {
        let counts = { OFFLINE: 0, LOGGED_IN: 0, WORKING: 0, FINISHED: 0 };
        let total = activeExamStudents.length;

        if (currentUserState.role === 'Guru') {
            const mySchool = (currentUserState.kelas_id || '').toLowerCase();
            const schoolStudents = activeExamStudents.filter((u: any) => {
                const matchSchool = (u.school || '').toLowerCase() === mySchool;
                // Strict Class Filter if Guru has class assigned (Use u.kelas direct from DB)
                const matchClass = !currentUserState.kelas || currentUserState.kelas === '-' || currentUserState.kelas === '' ? true : u.kelas === currentUserState.kelas;
                return matchSchool && matchClass;
            });
            
            const localCounts = { OFFLINE: 0, LOGGED_IN: 0, WORKING: 0, FINISHED: 0 };
            schoolStudents.forEach((u: any) => {
                const status = (u.status || 'OFFLINE') as keyof typeof localCounts;
                if (localCounts[status] !== undefined) {
                    localCounts[status]++;
                }
            });

            counts = localCounts;
            total = schoolStudents.length;
        } else {
            // Admin Pusat sees all students stats
            activeExamStudents.forEach((u: any) => {
                const status = (u.status || 'OFFLINE') as keyof typeof counts;
                if (counts[status] !== undefined) {
                    counts[status]++;
                }
            });
        }

        return { counts, total };
    }, [activeExamStudents, currentUserState]);

    // Extract Unique Kecamatans for Filter (From Students)
    const uniqueKecamatans = useMemo(() => {
        if (!studentUsers) return [];
        const kecs = new Set(studentUsers.map((u: any) => u.kecamatan).filter((k: any) => k && k !== '-'));
        return Array.from(kecs).sort();
    }, [studentUsers]);

    // Extract Unique Schools for Filter
    const uniqueSchoolList = useMemo(() => {
        if (!studentUsers) return [];
        const schools = new Set(studentUsers.map((u: any) => getSchoolOnly(u.school)).filter((s: any) => s && s !== '-' && s.trim() !== ''));
        return Array.from(schools).sort();
    }, [studentUsers]);

    // Extract Unique Exam Types - FROM DB EXAM_TYPE
    const uniqueExamTypes = useMemo(() => {
        if (!studentUsers) return [];
        const types = new Set<string>();
        studentUsers.forEach((u: any) => {
            const type = u.exam_type;
            if (type && type !== '-') types.add(type);
        });
        return Array.from(types).sort();
    }, [studentUsers]);

    // Calculate Stats Per Exam Type/School for Admin Pusat (Only Students)
    const examTypeStats = useMemo(() => {
        if (currentUserState.role !== 'admin' || !studentUsers) return [];

        // Key by School+ExamType to differentiate exam types within same school
        const groupMap: Record<string, { name: string, examType: string, kecamatan: string, total: number, offline: number, login: number, working: number, finished: number }> = {};

        studentUsers.forEach((u: any) => {
            const schoolName = getSchoolOnly(u.school || 'Tanpa Sekolah');
            const examType = u.exam_type || '-';
            const groupKey = `${schoolName}_${examType}`; // Unique key
            
            if (!groupMap[groupKey]) {
                groupMap[groupKey] = { 
                    name: schoolName,
                    examType: examType,
                    kecamatan: u.kecamatan || '-',
                    total: 0, offline: 0, login: 0, working: 0, finished: 0 
                };
            }
            
            groupMap[groupKey].total++;
            
            const status = u.status || 'OFFLINE';
            if (status === 'OFFLINE') groupMap[groupKey].offline++;
            else if (status === 'LOGGED_IN') groupMap[groupKey].login++;
            else if (status === 'WORKING') groupMap[groupKey].working++;
            else if (status === 'FINISHED') groupMap[groupKey].finished++;
        });

        let results = Object.values(groupMap).sort((a, b) => b.total - a.total);

        // Apply Filters
        if (kecamatanFilter !== 'all') {
            results = results.filter(s => (s.kecamatan || '').toLowerCase() === kecamatanFilter.toLowerCase());
        }

        if (schoolFilter !== 'all') {
            results = results.filter(s => s.name === schoolFilter);
        }

        if (examTypeFilter !== 'all') { // This should be examTypeFilter now
            results = results.filter(s => s.examType === examTypeFilter);
        }

        if (schoolSearch) {
            const lowerSearch = schoolSearch.toLowerCase();
            results = results.filter(s => s.name.toLowerCase().includes(lowerSearch));
        }

        return results;
    }, [studentUsers, currentUserState.role, schoolSearch, kecamatanFilter, schoolFilter, examTypeFilter]);

    const { OFFLINE, LOGGED_IN, WORKING, FINISHED } = stats.counts;
    const displayTotalStudents = stats.total;
    const totalStatus = OFFLINE + LOGGED_IN + WORKING + FINISHED;
    
    // Duration Calculation
    const examDuration = Number(dashboardData.duration) || 0;
    
    const statusData = [
        { value: OFFLINE, color: '#e2e8f0', label: 'Belum Login' },
        { value: LOGGED_IN, color: '#facc15', label: 'Login' },
        { value: WORKING, color: '#3b82f6', label: 'Mengerjakan' },
        { value: FINISHED, color: '#10b981', label: 'Selesai' },
    ];
    
    const filteredFeed = useMemo(() => {
        const feed = dashboardData.activityFeed || [];
        if (currentUserState.role === 'Guru') {
            const mySchool = (currentUserState.kelas_id || '').trim().toLowerCase();
            return feed.filter((log: any) => (log.school || '').trim().toLowerCase() === mySchool);
        }
        return feed;
    }, [dashboardData.activityFeed, currentUserState]);

    const mySchedule = useMemo(() => {
        if (currentUserState.role === 'Guru' && dashboardData.schedules) {
            const mySchoolName = (currentUserState.kelas_id || '').trim().toLowerCase();
            return dashboardData.schedules.find((s:any) => (s.school || '').trim().toLowerCase() === mySchoolName);
        }
        return null;
    }, [currentUserState, dashboardData.schedules]);

    const uniqueSchoolsCount = uniqueSchoolList.length;

    const formatDateFull = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            return date.toLocaleDateString('id-ID', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });
        }
        return dateStr;
    };

    const dbSubjects = dashboardData.subjects || [];

    return (
    <div className="space-y-6 fade-in max-w-7xl mx-auto">
        <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                Selamat Datang, <span className="text-2xl text-indigo-600 block sm:inline mt-1 sm:mt-0">{currentUserState.nama_lengkap || currentUserState.username}</span>
            </h1>
            <p className="text-slate-500 font-medium mt-1">
                Pantau perkembangan dan statistik asesmen siswa secara real-time.
            </p>
        </div>

        {currentUserState.role === 'Guru' && (
            <div className="bg-white border-l-4 border-blue-600 px-6 py-4 rounded-r-xl shadow-sm flex items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg"><School size={20}/></div>
                    <div>
                        <h3 className="font-bold text-sm uppercase tracking-wide text-slate-700">Mode Guru</h3>
                        <p className="text-sm text-slate-500">Sekolah: <b>{currentUserState.kelas_id}</b> {currentUserState.kelas && currentUserState.kelas !== '-' ? `(Kelas ${currentUserState.kelas})` : '(Semua Kelas)'}</p>
                    </div>
                </div>
            </div>
        )}

        {currentUserState.role === 'Guru' && mySchedule && (
            <div className="bg-gradient-to-r from-blue-700 to-red-600 text-white p-8 rounded-3xl shadow-xl flex flex-col lg:flex-row justify-between items-center gap-8 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                 <div className="flex items-center gap-5 border-b lg:border-b-0 border-white/20 pb-6 lg:pb-0 w-full lg:w-auto relative z-10">
                    <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm"><Calendar size={32}/></div>
                    <div>
                         <h2 className="text-2xl font-black tracking-tight">Jadwal Ujian Aktif</h2>
                         <p className="opacity-90 text-sm font-medium">Jadwal pelaksanaan ujian untuk sekolah Anda.</p>
                    </div>
                 </div>
                 <div className="flex flex-wrap gap-4 text-center justify-center w-full lg:w-auto relative z-10">
                    <div className="bg-black/20 px-6 py-4 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col justify-center min-w-[200px]">
                        <p className="text-[10px] uppercase font-bold text-blue-100 mb-1">Tanggal</p>
                        <div className="font-bold text-white text-lg">
                            {mySchedule.tanggal_selesai && mySchedule.tanggal_selesai !== mySchedule.tanggal ? (
                                <div className="leading-tight">
                                    <span>{formatDateFull(mySchedule.tanggal)}</span>
                                    <span className="text-xs opacity-70 mx-1">s/d</span>
                                    <span>{formatDateFull(mySchedule.tanggal_selesai)}</span>
                                </div>
                            ) : (
                                <span>{formatDateFull(mySchedule.tanggal)}</span>
                            )}
                        </div>
                    </div>
                    <div className="bg-white text-blue-900 px-6 py-4 rounded-2xl shadow-lg min-w-[120px] flex flex-col justify-center">
                        <p className="text-[10px] uppercase font-bold text-blue-400 mb-1">Gelombang</p>
                        <p className="text-xl font-black">{mySchedule.gelombang}</p>
                    </div>
                    <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/20 backdrop-blur-md min-w-[120px] flex flex-col justify-center">
                        <p className="text-[10px] uppercase font-bold text-white/70 mb-1 flex items-center justify-center gap-1"><Clock size={10}/> Durasi</p>
                        <p className="text-xl font-black text-white">{examDuration}m</p>
                    </div>
                 </div>
            </div>
        )}

        <div className={`grid grid-cols-1 md:grid-cols-2 ${currentUserState.role === 'admin' ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-6`}>
            {currentUserState.role === 'admin' && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">Jumlah Jenis Ujian Aktif</p>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-800 mt-1">{activeExams.length}</h3>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-xl text-orange-500"><School size={28}/></div>
                </div>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
                <div><p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">Siswa pada Ujian Aktif</p><h3 className="text-2xl md:text-3xl font-black text-slate-800 mt-1">{displayTotalStudents}</h3></div>
                <div className="bg-slate-100 p-3 rounded-xl text-slate-600"><Users size={28}/></div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
                <div><p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">Belum Login</p><h3 className="text-2xl md:text-3xl font-black text-slate-500 mt-1">{OFFLINE}</h3></div>
                <div className="bg-slate-100 p-3 rounded-xl text-slate-500"><UserX size={28}/></div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
                <div><p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">Sedang Ujian</p><h3 className="text-2xl md:text-3xl font-black text-blue-600 mt-1">{WORKING}</h3></div>
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><PlayCircle size={28}/></div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
                <div><p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">Ujian Selesai</p><h3 className="text-2xl md:text-3xl font-black text-emerald-600 mt-1">{FINISHED}</h3></div>
                <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600"><CheckCircle2 size={28}/></div>
            </div>
        </div>

        {/* Extra Card for Admin/Guru Count (Only for Admin Pusat) */}
        {currentUserState.role === 'admin' && (
            <div className="bg-white p-6 rounded-2xl shadow-lg shadow-slate-200/40 border border-slate-100 flex items-center justify-between relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none opacity-60"></div>
                <div className="flex items-center gap-5 relative z-10">
                    <div className="p-4 bg-white text-indigo-600 rounded-2xl border-2 border-indigo-50 shadow-sm group-hover:scale-110 transition-transform duration-300 flex items-center justify-center">
                        <UserCog size={32}/>
                    </div>
                    <div>
                        <h4 className="font-black text-xl text-slate-800 tracking-tight">Admin dan Guru</h4>
                        <p className="text-slate-500 text-xs font-medium mt-1 max-w-[250px]">Total akun Admin dan Guru yang terdaftar dan aktif dalam sistem.</p>
                    </div>
                </div>
                <div className="text-right relative z-10">
                    <div className="flex items-baseline gap-1 justify-end">
                        <span className="text-4xl font-black text-slate-800">{staffUsers.length}</span>
                        <span className="text-sm font-bold text-slate-400">User</span>
                    </div>
                    <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] uppercase font-bold tracking-wider rounded-full border border-indigo-100 mt-1">
                        Terverifikasi
                    </span>
                </div>
            </div>
        )}

        {/* Database Subject Status Section with Collapse */}
        {currentUserState.role === 'admin' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                        <Database size={18} className="text-indigo-600"/>
                        <h4 className="font-bold text-slate-700 text-sm">Status Database Mata Pelajaran</h4>
                    </div>
                    <button onClick={() => setIsDbCollapsed(!isDbCollapsed)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition">
                        {isDbCollapsed ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}
                    </button>
                </div>
                
                {!isDbCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {dbSubjects.length > 0 ? (
                            dbSubjects.map((sub: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-lg border border-slate-200 text-indigo-600"><BookOpen size={16}/></div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">{sub.name}</p>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tersinkronisasi</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-slate-700">{sub.count}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">Soal</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-3 text-center text-slate-400 text-xs italic py-4">Memeriksa ketersediaan database mapel...</div>
                        )}
                    </div>
                )}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
                <h3 className="text-slate-800 font-bold mb-8 text-sm uppercase tracking-wide w-full border-b pb-4">Statistik Siswa</h3>
                <SimpleDonutChart data={statusData} />
                <div className="grid grid-cols-2 gap-4 mt-8 w-full text-xs font-bold text-slate-500">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-200 rounded-full"></div> Belum Login ({totalStatus > 0 ? Math.round((OFFLINE/totalStatus)*100) : 0}%)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-400 rounded-full"></div> Login ({totalStatus > 0 ? Math.round((LOGGED_IN/totalStatus)*100) : 0}%)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> Mengerjakan ({totalStatus > 0 ? Math.round((WORKING/totalStatus)*100) : 0}%)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> Selesai ({totalStatus > 0 ? Math.round((FINISHED/totalStatus)*100) : 0}%)</div>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 col-span-2">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Activity size={20} className="text-blue-600"/> Aktivitas Real-time</h3>
                <div className="space-y-0 h-[350px] overflow-y-auto custom-scrollbar pr-2">
                    {filteredFeed && filteredFeed.length > 0 ? (
                        filteredFeed.map((log: any, i: number) => {
                            let icon = <AlertCircle size={18}/>;
                            let bgClass = "bg-slate-50 border-slate-100";
                            let statusText = "Unknown";
                            let textClass = "text-slate-600";
                            
                            if (log.action === 'LOGIN') {
                                icon = <Key size={18}/>;
                                bgClass = "bg-yellow-50 border-yellow-100";
                                textClass = "text-yellow-700";
                                statusText = "Login";
                            } else if (log.action === 'START') {
                                icon = <PlayCircle size={18}/>;
                                bgClass = "bg-blue-50 border-blue-100";
                                textClass = "text-blue-700";
                                statusText = "Mengerjakan";
                            } else if (log.action === 'FINISH') {
                                icon = <CheckCircle2 size={18}/>;
                                bgClass = "bg-emerald-50 border-emerald-100";
                                textClass = "text-emerald-700";
                                statusText = "Selesai";
                            }

                            const hasSubject = log.subject && log.subject !== '-' && log.subject !== 'Success';
                            
                            // REALTIME DATA LOOKUP (Ensure School implies Kecamatan)
                            const userDetail = userLookup[log.username];
                            const currentSchool = getSchoolOnly(userDetail?.school || log.school || '-');
                            const currentKecamatan = userDetail?.kecamatan || log.kecamatan || '-';
                            const currentName = userDetail?.fullname || log.fullname || log.username;

                            return (
                                <div key={i} className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-xl transition border-b border-slate-50 last:border-0 group">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${bgClass} ${textClass}`}>
                                        {icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            {/* NAMA LENGKAP */}
                                            <p className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{currentName}</p>
                                            <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2 bg-slate-100 px-2 py-0.5 rounded">{new Date(log.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit', hour12: false})}</span>
                                        </div>
                                        
                                        <div className="text-xs text-slate-500 mb-2 flex flex-col gap-1">
                                            {/* SEKOLAH */}
                                            <div className="flex items-center gap-2" title="Sekolah">
                                                <School size={12} className="text-slate-400 shrink-0"/>
                                                <span className="truncate font-semibold">{currentSchool}</span>
                                            </div>
                                            {/* KECAMATAN */}
                                            <div className="flex items-center gap-2" title="Kecamatan">
                                                <MapPin size={12} className="text-slate-400 shrink-0"/>
                                                <span className="truncate font-medium">{currentKecamatan}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${bgClass} ${textClass} border`}>
                                                {statusText}
                                            </span>
                                            {hasSubject && (
                                                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-white text-slate-600 border border-slate-200">
                                                    {log.subject}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 italic">
                            <Activity size={40} className="mb-3 opacity-10"/>
                            Belum ada aktivitas tercatat.
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Class Statistics Table for Admin Pusat */}
        {currentUserState.role === 'admin' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 border border-indigo-100"><BarChart3 size={20}/></div>
                        <div>
                            <h3 className="font-bold text-slate-800">Statistik Per Kelas / Sekolah</h3>
                            <p className="text-xs text-slate-500">Rekapitulasi status peserta (Siswa) berdasarkan kelas (database) atau sekolah.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto flex-wrap justify-end">
                        <div className="relative group w-full sm:w-32">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <select 
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 font-bold text-slate-700 transition-all bg-slate-50 focus:bg-white cursor-pointer appearance-none"
                                value={examTypeFilter}
                                onChange={e => setExamTypeFilter(e.target.value)}
                            >
                                <option value="all">Semua Jenis Ujian</option>
                                {uniqueExamTypes.map((c:any) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="relative group w-full sm:w-40">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <select 
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 font-bold text-slate-700 transition-all bg-slate-50 focus:bg-white cursor-pointer appearance-none"
                                value={schoolFilter}
                                onChange={e => {
                                    const val = e.target.value;
                                    setSchoolFilter(val);
                                    if (val !== 'all') {
                                        const found = studentUsers.find((s:any) => s.school === val);
                                        if (found && found.kecamatan) setKecamatanFilter(found.kecamatan);
                                    }
                                }}
                            >
                                <option value="all">Semua Sekolah</option>
                                {uniqueSchoolList.map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="relative group w-full sm:w-40">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <select 
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 font-bold text-slate-700 transition-all bg-slate-50 focus:bg-white cursor-pointer appearance-none"
                                value={kecamatanFilter}
                                onChange={e => setKecamatanFilter(e.target.value)}
                            >
                                <option value="all">Semua Kecamatan</option>
                                {uniqueKecamatans.map((k:any) => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <div className="relative group w-full sm:w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <input 
                                type="text" 
                                placeholder="Cari Nama Sekolah..." 
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 font-bold text-slate-700 placeholder-slate-400 transition-all bg-slate-50 focus:bg-white" 
                                value={schoolSearch} 
                                onChange={e => setSchoolSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto max-h-[500px] custom-scrollbar rounded-xl border border-slate-100">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50 font-bold text-slate-500 uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 border-b border-slate-200 text-center w-16">Jenis Ujian</th>
                                <th className="p-4 border-b border-slate-200">Sekolah & Kecamatan</th>
                                <th className="p-4 border-b border-slate-200 text-center">Total Siswa</th>
                                <th className="p-4 border-b border-slate-200 text-center text-slate-400">Belum Login</th>
                                <th className="p-4 border-b border-slate-200 text-center text-yellow-600">Login</th>
                                <th className="p-4 border-b border-slate-200 text-center text-blue-600">Mengerjakan</th>
                                <th className="p-4 border-b border-slate-200 text-center text-emerald-600">Selesai</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {examTypeStats.length > 0 ? (
                                examTypeStats.map((stat, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-center font-bold text-indigo-600 bg-indigo-50/20">{stat.examType}</td>
                                        <td className="p-4 font-bold text-slate-700">
                                            {getSchoolOnly(stat.name)}
                                            <div className="text-[10px] font-medium text-slate-400 mt-0.5 uppercase tracking-wide">
                                                {stat.kecamatan}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center font-bold text-slate-800 bg-slate-50">{stat.total}</td>
                                        <td className="p-4 text-center font-mono text-slate-400">{stat.offline}</td>
                                        <td className="p-4 text-center font-mono text-yellow-600 font-bold bg-yellow-50/50">{stat.login}</td>
                                        <td className="p-4 text-center font-mono text-blue-600 font-bold bg-blue-50/50">{stat.working}</td>
                                        <td className="p-4 text-center font-mono text-emerald-600 font-bold bg-emerald-50/50">{stat.finished}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">Tidak ada data ditemukan.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
    );
};

export default OverviewTab;
