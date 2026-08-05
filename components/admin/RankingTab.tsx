
import React, { useState, useMemo, useEffect } from 'react';
import { Award, FileText, Loader2, BookOpen, Filter, Trophy, Star, Layers, Sparkles } from 'lucide-react';
import { api } from '../../src/services/api';
import { exportToExcel, getPredicateBadge, TeamMemberBadge, syncTeamsWithParticipants, getSchoolOnly, getExamTypes } from '../../utils/adminHelpers';

const RankingTab = ({ students }: { students: any[] }) => {
    const [selectedExamType, setSelectedExamType] = useState<string>('all');
    const [data, setData] = useState<any[]>([]); // CBT recap data
    const [lccTeams, setLccTeams] = useState<any[]>([]); // LCC Teams data
    const [globalConfig, setGlobalConfig] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [filterSubject, setFilterSubject] = useState('');
    
    // User Map for quick lookup of profile data (Kecamatan, etc)
    const userMap = useMemo(() => {
        const map: Record<string, any> = {};
        students.forEach(s => {
            if (s.username) {
                map[String(s.username).toLowerCase().trim()] = s;
            }
        });
        return map;
    }, [students]);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.getRecap(),
            api.getLccTeams(),
            api.getAppConfig()
        ]).then(([recapRes, lccRes, configRes]) => { 
            setData(recapRes || []);
            setLccTeams(lccRes || []);
            setGlobalConfig(configRes || {});
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, []);

    // Extract dynamic Exam Types list
    const examTypeOptions = useMemo(() => {
        const configuredTypes = getExamTypes(globalConfig); // Array of { id, label }
        
        // Base list with default 'all'
        const result: { id: string; label: string }[] = [
            { id: 'all', label: 'Semua Ujian (CBT Umum)' }
        ];

        const addedIds = new Set<string>(['all']);

        // Add configured types
        configuredTypes.forEach(t => {
            const key = t.id.toUpperCase();
            if (!addedIds.has(key)) {
                addedIds.add(key);
                if (t.id === 'LCC') {
                    result.push({ id: 'LCC', label: 'LCC - Lomba Cerdas Cermat (Babak I & II)' });
                } else {
                    result.push({ id: t.id, label: t.label || t.id });
                }
            }
        });

        // Gather any extra jenis_ujian from recap data
        data.forEach(d => {
            const j = (d.jenis_ujian || d.exams?.jenis_ujian || '').trim();
            if (j) {
                const key = j.toUpperCase();
                if (!addedIds.has(key)) {
                    addedIds.add(key);
                    result.push({ id: j, label: j });
                }
            }
        });

        return result;
    }, [globalConfig, data]);

    const isLccMode = useMemo(() => {
        const lower = selectedExamType.toLowerCase();
        return lower === 'lcc' || lower.includes('cerdas cermat');
    }, [selectedExamType]);
    
    // Extract Unique Filter Options
    const uniqueKecamatans = useMemo(() => {
        const kecs = new Set(students.map(s => s.kecamatan).filter(Boolean).filter(k => k !== '-'));
        return Array.from(kecs).sort();
    }, [students]);
    
    const uniqueSchools = useMemo(() => {
        const schools = new Set(data.map(d => d.sekolah).filter(Boolean));
        lccTeams.forEach(t => {
            if (t.school) schools.add(t.school);
        });
        return Array.from(schools).sort();
    }, [data, lccTeams]);

    const uniqueClasses = useMemo(() => {
        const classes = new Set(students.map(s => s.kelas).filter(Boolean));
        return Array.from(classes).sort((a: any, b: any) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [students]);

    // Extract Unique Subjects from Results
    const uniqueSubjects = useMemo(() => {
        const subjects = new Set(data.map(d => d.mapel).filter(Boolean));
        return Array.from(subjects).sort();
    }, [data]);
    
    // 1. FILTER & SORT CBT DATA
    const filteredData = useMemo(() => {
        let res = data;

        // Filter by selectedExamType if specific and not LCC
        if (selectedExamType !== 'all' && !isLccMode) {
            const targetType = selectedExamType.toLowerCase().trim();
            res = res.filter(d => {
                const j = (d.jenis_ujian || d.exams?.jenis_ujian || '').toLowerCase().trim();
                const m = (d.mapel || '').toLowerCase().trim();
                return j.includes(targetType) || targetType.includes(j) || m.includes(targetType);
            });
        }

        // Filter by Subject
        if (filterSubject) {
            res = res.filter(d => (d.mapel || '').toLowerCase() === filterSubject.toLowerCase());
        }

        // Filter by School, Kecamatan, & Class
        res = res.filter(d => {
            const uname = String(d.username || d.user_id || '').toLowerCase().trim();
            const userProfile = userMap[uname];
            const userKecamatan = userProfile?.kecamatan || d.kecamatan || '-';
            const userKelas = userProfile?.kelas || d.kelas || '-';
            const userSchool = d.sekolah || userProfile?.school || '-';
            
            const kecMatch = filterKecamatan === 'all' || (userKecamatan && userKecamatan.toLowerCase() === filterKecamatan.toLowerCase());
            const schoolMatch = filterSchool === 'all' || (userSchool && userSchool.toLowerCase() === filterSchool.toLowerCase());
            const classMatch = filterClass === 'all' || (String(userKelas) === String(filterClass));
            
            return kecMatch && schoolMatch && classMatch;
        });

        // Sort by Score (Desc)
        return [...res].sort((a, b) => {
            const scoreA = parseFloat(a.nilai) || parseFloat(a.score) || 0;
            const scoreB = parseFloat(b.nilai) || parseFloat(b.score) || 0;
            return scoreB - scoreA;
        });
    }, [data, selectedExamType, isLccMode, filterSubject, filterKecamatan, filterSchool, filterClass, userMap]);

    // 2. AGGREGATE & RANK LCC DATA
    const lccRankingData = useMemo(() => {
        const studentCbtScores: Record<string, number> = {};
        const studentNameScores: Record<string, number> = {};
        
        data.forEach((r: any) => {
            const uname = (r.user_id || r.username || '').toLowerCase().trim();
            const score = parseFloat(r.nilai) || 0;
            if (uname) {
                if (!studentCbtScores[uname] || score > studentCbtScores[uname]) {
                    studentCbtScores[uname] = score;
                }
            }
            
            const studentInfo = students.find(s => (s.username || '').toLowerCase().trim() === uname);
            if (studentInfo) {
                const fullName = (studentInfo.nama_lengkap || studentInfo.fullname || '').toLowerCase().trim();
                if (fullName) {
                    if (!studentNameScores[fullName] || score > studentNameScores[fullName]) {
                        studentNameScores[fullName] = score;
                    }
                }
            }
        });

        const nameToUsername: Record<string, string> = {};
        students.forEach(s => {
            const fullName = (s.nama_lengkap || s.fullname || '').toLowerCase().trim();
            if (fullName && s.username) {
                nameToUsername[fullName] = String(s.username).toLowerCase().trim();
            }
        });

        const syncedLccTeams = syncTeamsWithParticipants(lccTeams, students);

        const computed = syncedLccTeams.map(team => {
            let babak1Score = 0;
            const babak2Score = parseFloat(team.score) || 0;
            
            if (team.members && Array.isArray(team.members) && team.members.length > 0) {
                team.members.forEach((member: string) => {
                    const cleanMember = String(member).toLowerCase().trim();
                    if (cleanMember) {
                        if (studentNameScores[cleanMember] !== undefined) {
                            babak1Score += studentNameScores[cleanMember];
                        } else {
                            const mappedUname = nameToUsername[cleanMember];
                            if (mappedUname && studentCbtScores[mappedUname] !== undefined) {
                                babak1Score += studentCbtScores[mappedUname];
                            }
                        }
                    }
                });
            }

            const cleanTeamId = String(team.id).toLowerCase().replace(/^team_/, '').trim();
            if (babak1Score === 0) {
                if (studentCbtScores[cleanTeamId] !== undefined) {
                    babak1Score = studentCbtScores[cleanTeamId];
                } else if (studentCbtScores[String(team.id).toLowerCase().trim()] !== undefined) {
                    babak1Score = studentCbtScores[String(team.id).toLowerCase().trim()];
                }
            }

            if (babak1Score === 0) {
                const cleanTeamName = String(team.name).toLowerCase().trim();
                if (studentNameScores[cleanTeamName] !== undefined) {
                    babak1Score = studentNameScores[cleanTeamName];
                } else {
                    const matchedUname = nameToUsername[cleanTeamName];
                    if (matchedUname && studentCbtScores[matchedUname] !== undefined) {
                        babak1Score = studentCbtScores[matchedUname];
                    }
                }
            }

            const totalScore = babak1Score + babak2Score;

            return {
                ...team,
                babak1Score,
                babak2Score,
                totalScore,
            };
        });

        return computed.sort((a, b) => b.totalScore - a.totalScore);
    }, [data, lccTeams, students]);

    // Apply Filters to LCC Ranking
    const filteredLccData = useMemo(() => {
        return lccRankingData.filter(team => {
            const schoolMatch = filterSchool === 'all' || (team.school && team.school.toLowerCase() === filterSchool.toLowerCase());
            
            let kecMatch = filterKecamatan === 'all';
            if (filterKecamatan !== 'all') {
                const matchKec = students.some(s => 
                    s.kecamatan && s.kecamatan.toLowerCase() === filterKecamatan.toLowerCase() &&
                    ((team.school && s.school === team.school) || (team.members && team.members.includes(s.nama_lengkap || s.fullname)))
                );
                kecMatch = matchKec;
            }
            
            return schoolMatch && kecMatch;
        });
    }, [lccRankingData, filterSchool, filterKecamatan, students]);

    const handleExport = () => {
        if (isLccMode) {
            const exportRows = filteredLccData.map((d, i) => ({
                'Peringkat': i + 1,
                'Nama Regu': d.name,
                'Asal Sekolah': d.school || '-',
                'Anggota Regu': d.members ? d.members.join(', ') : '',
                'Nilai BABAK I (CBT)': d.babak1Score,
                'Nilai BABAK II (LCC)': d.babak2Score,
                'Jumlah Nilai': d.totalScore
            }));
            exportToExcel(exportRows, `Ranking_LCC_Gabungan_Babak_1_dan_2`);
        } else {
            const exportRows = filteredData.map((d, i) => ({
                'Peringkat': i + 1,
                'Nama': d.nama || d.username,
                'Username': d.username,
                'Kelas': userMap[String(d.username).toLowerCase().trim()]?.kelas || '-',
                'Sekolah': d.sekolah || '-',
                'Kecamatan': userMap[String(d.username).toLowerCase().trim()]?.kecamatan || '-',
                'Mata Pelajaran': d.mapel || '-',
                'Jenis Ujian': d.jenis_ujian || d.exams?.jenis_ujian || '-',
                'Nilai': parseFloat(d.nilai) || 0,
                'Predikat': parseFloat(d.nilai) >= 75 ? 'Tuntas' : 'Belum Tuntas'
            }));
            exportToExcel(exportRows, `Ranking_Ujian_${selectedExamType}_${filterSubject || 'All'}`);
        }
    };
    
    return (
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 fade-in p-6 space-y-6">
            
            {/* HEADER WITH JENIS UJIAN DROPDOWN */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        {isLccMode ? (
                            <Trophy size={24} className="text-amber-500 animate-pulse" />
                        ) : (
                            <Award size={24} className="text-indigo-600" />
                        )}
                        <span>Peringkat Hasil Ujian</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                        Pilih jenis ujian dari dropdown untuk menampilkan daftar peringkat nilai peserta.
                    </p>
                </div>

                {/* DROPDOWN JENIS UJIAN */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <label className="text-xs font-black text-slate-700 whitespace-nowrap flex items-center gap-1.5 bg-indigo-50/80 text-indigo-800 px-3 py-2 rounded-xl border border-indigo-100">
                        <Layers size={15} className="text-indigo-600" />
                        <span>Jenis Ujian:</span>
                    </label>
                    <select
                        value={selectedExamType}
                        onChange={(e) => setSelectedExamType(e.target.value)}
                        className="border-2 border-indigo-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm font-extrabold bg-white text-slate-800 shadow-sm cursor-pointer outline-none w-full md:w-72 transition hover:border-indigo-300"
                    >
                        {examTypeOptions.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* FILTER CONTROLS BAR */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Filter Tampilan:</span>
                    {isLccMode && (
                        <span className="bg-amber-100 text-amber-800 text-[11px] font-black px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                            <Sparkles size={12} /> Mode Gabungan LCC (Babak I + II)
                        </span>
                    )}
                </div>
                
                <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto flex-wrap">
                    {/* Render CBT-only Filters */}
                    {!isLccMode && (
                        <>
                            {/* Subject Filter */}
                            <div className="relative">
                                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <select 
                                    className="pl-9 pr-4 py-2 border-2 border-indigo-100 rounded-lg text-sm font-bold bg-indigo-50/50 text-indigo-700 outline-none focus:border-indigo-500 cursor-pointer w-full md:w-48" 
                                    value={filterSubject} 
                                    onChange={e => setFilterSubject(e.target.value)}
                                >
                                    <option value="">Semua Mata Pelajaran</option>
                                    {uniqueSubjects.map((s:any) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Class Filter */}
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                                <select 
                                    className="pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer w-full md:w-36"
                                    value={filterClass}
                                    onChange={e => setFilterClass(e.target.value)}
                                >
                                    <option value="all">Semua Kelas</option>
                                    {uniqueClasses.map((s:any) => <option key={s} value={s}>Kelas {s}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    {/* School and Kecamatan filters */}
                    <select 
                        className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer min-w-[140px]" 
                        value={filterKecamatan} 
                        onChange={e => setFilterKecamatan(e.target.value)}
                    >
                        <option value="all">Semua Kecamatan</option>
                        {uniqueKecamatans.map((s:any) => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select 
                        className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer max-w-[200px]" 
                        value={filterSchool} 
                        onChange={e => {
                            const val = e.target.value;
                            setFilterSchool(val);
                            if (val !== 'all') {
                                const found = students.find((s:any) => s.school === val);
                                if (found && found.kecamatan) setFilterKecamatan(found.kecamatan);
                            }
                        }}
                    >
                        <option value="all">Semua Sekolah</option>
                        {uniqueSchools.map((s:any) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    
                    <button 
                        onClick={handleExport} 
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 active:scale-95"
                    >
                        <FileText size={16}/> Export Excel
                    </button>
                </div>
            </div>

            {/* DATA TABLE */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-inner">
                <table className="w-full text-xs md:text-sm text-left border-collapse">
                    <thead className="bg-slate-50 font-bold text-slate-600 uppercase text-[10px] md:text-xs">
                        {!isLccMode ? (
                            <tr>
                                <th className="p-3 md:p-4 text-center w-16">Rank</th>
                                <th className="p-3 md:p-4">Nama Peserta</th>
                                <th className="p-3 md:p-4 text-center">Kelas</th>
                                <th className="p-3 md:p-4">Sekolah</th>
                                <th className="p-3 md:p-4">Kecamatan</th>
                                <th className="p-3 md:p-4">Mata Pelajaran</th>
                                <th className="p-3 md:p-4 text-center bg-indigo-50/50 border-l border-slate-200">Nilai</th>
                                <th className="p-3 md:p-4 text-center border-l border-slate-200">Predikat</th>
                            </tr>
                        ) : (
                            <tr>
                                <th className="p-3 md:p-4 text-center w-20">Peringkat</th>
                                <th className="p-3 md:p-4">Nama Regu / Anggota</th>
                                <th className="p-3 md:p-4">Sekolah</th>
                                <th className="p-3 md:p-4 text-center bg-indigo-50/30 border-l border-slate-200">Babak I (CBT)</th>
                                <th className="p-3 md:p-4 text-center bg-amber-50/30 border-l border-slate-200">Babak II (LCC)</th>
                                <th className="p-3 md:p-4 text-center bg-emerald-50 border-l-2 border-slate-200 font-black text-emerald-800">Total Nilai</th>
                            </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={!isLccMode ? 8 : 6} className="p-12 text-center text-slate-400 font-bold">
                                    <Loader2 className="animate-spin inline mr-2 text-indigo-600"/> Memuat data peringkat...
                                </td>
                            </tr>
                        ) : (!isLccMode ? filteredData : filteredLccData).length === 0 ? (
                            <tr>
                                <td colSpan={!isLccMode ? 8 : 6} className="p-12 text-center text-slate-400 italic font-medium bg-slate-50/50">
                                    Data peringkat tidak ditemukan untuk jenis ujian dan filter ini.
                                </td>
                            </tr>
                        ) : (
                            (!isLccMode ? filteredData : filteredLccData).map((d, i) => {
                                if (!isLccMode) {
                                    const score = parseFloat(d.nilai) || parseFloat(d.score) || 0;
                                    const uname = String(d.username || d.user_id || '').toLowerCase().trim();
                                    const userObj = userMap[uname];
                                    return (
                                        <tr key={i} className="border-b hover:bg-slate-50 transition duration-150">
                                            <td className="p-2 md:p-4 font-bold text-center text-slate-500">
                                                <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center mx-auto text-xs md:text-sm ${
                                                    i === 0 ? 'bg-amber-100 text-amber-700 font-black shadow-sm ring-2 ring-amber-50' : 
                                                    i === 1 ? 'bg-slate-200 text-slate-700 font-black shadow-sm' : 
                                                    i === 2 ? 'bg-amber-50 text-amber-800 font-black shadow-sm' : 'bg-slate-100'
                                                }`}>
                                                    {i + 1}
                                                </div>
                                            </td>
                                            <td className="p-2 md:p-4">
                                                <div className="font-extrabold text-slate-700 text-xs md:text-sm">{d.nama || userObj?.nama_lengkap || d.username}</div>
                                                <div className="text-[9px] md:text-[10px] text-slate-400 font-mono font-bold mt-0.5">{d.username}</div>
                                            </td>
                                            <td className="p-2 md:p-4 text-center text-slate-600 font-extrabold text-xs">
                                                {userObj?.kelas || d.kelas || '-'}
                                            </td>
                                            <td className="p-2 md:p-4 text-slate-600 font-semibold text-xs md:text-sm">{d.sekolah || userObj?.school || '-'}</td>
                                            <td className="p-2 md:p-4 text-slate-600 text-xs md:text-sm font-semibold">{userObj?.kecamatan || d.kecamatan || '-'}</td>
                                            <td className="p-2 md:p-4 text-slate-600">
                                                <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-black uppercase border border-slate-200 whitespace-nowrap">
                                                    {d.mapel || '-'}
                                                </span>
                                            </td>
                                            <td className="p-2 md:p-4 text-center font-black text-indigo-700 text-sm md:text-base border-l border-slate-100 bg-indigo-50/20">
                                                {score}
                                            </td>
                                            <td className="p-2 md:p-4 text-center border-l border-slate-100">
                                                {getPredicateBadge(score)}
                                            </td>
                                        </tr>
                                    );
                                } else {
                                    // RENDER LCC GABUNGAN ROWS (BABAK I + II)
                                    return (
                                        <tr key={d.id || i} className="border-b hover:bg-slate-50/80 transition duration-150">
                                            <td className="p-3 md:p-4 font-black text-center">
                                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mx-auto text-sm md:text-base ${
                                                    i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white font-black shadow-md ring-4 ring-yellow-100/50' : 
                                                    i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white font-black shadow-md ring-4 ring-slate-100/50' : 
                                                    i === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600 text-white font-black shadow-md ring-4 ring-orange-100/50' : 
                                                    'bg-slate-100 text-slate-600 font-bold border border-slate-200'
                                                }`}>
                                                    {i + 1}
                                                </div>
                                            </td>
                                            <td className="p-3 md:p-4 max-w-xs md:max-w-md">
                                                <div className="flex items-start gap-2">
                                                    {i < 3 && <Star size={18} className="text-amber-500 fill-amber-400 animate-pulse shrink-0 mt-1"/>}
                                                    <TeamMemberBadge rawName={d.name} members={d.members} theme="amber" size="md" align="left" />
                                                </div>
                                            </td>
                                            <td className="p-3 md:p-4 text-slate-600 font-bold text-xs md:text-sm">
                                                {getSchoolOnly(d.school) || '-'}
                                            </td>
                                            <td className="p-3 md:p-4 text-center font-bold text-slate-600 border-l border-slate-100 bg-indigo-50/5 text-xs md:text-sm">
                                                {d.babak1Score}
                                            </td>
                                            <td className="p-3 md:p-4 text-center font-bold text-slate-600 border-l border-slate-100 bg-amber-50/5 text-xs md:text-sm">
                                                {d.babak2Score}
                                            </td>
                                            <td className="p-3 md:p-4 text-center font-black text-emerald-700 text-sm md:text-lg border-l-2 border-slate-200 bg-emerald-50/30">
                                                {d.totalScore}
                                            </td>
                                        </tr>
                                    );
                                }
                            })
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 font-semibold gap-2">
                <span>
                    Menampilkan {(!isLccMode ? filteredData : filteredLccData).length} {!isLccMode ? 'Siswa' : 'Regu'}
                </span>
                {!isLccMode && filterSubject && <span>Mapel Aktif: {filterSubject}</span>}
                {isLccMode && <span className="text-amber-600 font-black">LCC Combined Scoreboard Mode</span>}
            </div>
        </div>
    );
};

export default RankingTab;
