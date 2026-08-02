
import React, { useState, useMemo, useEffect } from 'react';
import { Printer, RefreshCw, ChevronDown, ChevronUp, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { User } from '../../types';
import { api } from '../../src/services/api';
import { getSubjects, isBereguExamType, parseTeamAndMembers, formatTwoWords } from '../../utils/adminHelpers';
import { useToast } from '../../context/ToastContext';

const CetakKartuTab = ({ currentUser, students, schedules }: { currentUser: User, students: any[], schedules: any[] }) => {
    const { showToast } = useToast();
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterExamType, setFilterExamType] = useState('all'); // Changed from filterSession
    const [filterClass, setFilterClass] = useState('all');
    const [showAll, setShowAll] = useState(false);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    
    const [localStudents, setLocalStudents] = useState<any[]>(students);
    const [isLoading, setIsLoading] = useState(false);
    const [appConfig, setAppConfig] = useState<Record<string, string>>({});
    const [subjects, setSubjects] = useState<{ id: string, label: string }[]>([]);

    useEffect(() => {
        const fetchFullData = async () => {
            setIsLoading(true);
            try {
                const data = await api.getUsers();
                if (Array.isArray(data) && data.length > 0) {
                    setLocalStudents(data);
                }
                const config = await api.getAppConfig();
                setAppConfig(config);
                const loadedSubjects = getSubjects(config);
                setSubjects(loadedSubjects);
            } catch (e) {
                console.error("Failed to load full student data or config for cards", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFullData();
    }, []);

    // FILTER ONLY STUDENTS
    const studentList = useMemo(() => localStudents.filter(s => s.role === 'siswa'), [localStudents]);

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

    // NEW: Unique Exam Types for Filter
    const uniqueExamTypes = useMemo(() => {
        const types = new Set(studentList.map(s => s.exam_type).filter(Boolean));
        return Array.from(types).sort();
    }, [studentList]);

    const filteredStudents = useMemo(() => {
        let res = studentList.filter(s => {
            if (currentUser.role === 'Guru') {
                if ((s.school || '').toLowerCase() !== (currentUser.kelas_id || '').toLowerCase()) return false;
            } else {
                if (filterSchool !== 'all' && s.school !== filterSchool) return false;
                if (filterKecamatan !== 'all' && (s.kecamatan || '').toLowerCase() !== filterKecamatan.toLowerCase()) return false;
            }
            // CHANGED: Filter by Exam Type instead of Session
            if (filterExamType !== 'all' && s.exam_type !== filterExamType) return false;
            
            if (filterClass !== 'all' && (s.kelas || '') !== filterClass) return false;
            return true;
        });

        // Sort by Name
        return res.sort((a, b) => {
            const nameA = (a.fullname || a.username || '').toLowerCase();
            const nameB = (b.fullname || b.username || '').toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    }, [studentList, currentUser, filterSchool, filterKecamatan, filterExamType, filterClass, sortOrder]);

    // UPDATED LOGOS from CONFIG (Transparent fallback if empty)
    const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const logoLeftUrl = appConfig['LOGO_KABUPATEN'] || transparentPixel;
    const logoRightUrl = appConfig['LOGO_SEKOLAH'] || transparentPixel;

    const handlePrint = () => {
        if (filteredStudents.length === 0) return showToast("Tidak ada data siswa untuk dicetak.", "warning");

        const printWindow = window.open('', '_blank');
        if (!printWindow) return showToast("Pop-up terblokir. Mohon izinkan pop-up di browser Anda.", "error");

        const proktorName = currentUser.nama_lengkap || "...........................";
        
        const cardsHtml = filteredStudents.map((s) => {
            const subjectLabel = s.active_exam && s.active_exam !== '-' ? s.active_exam : '..................';
            const isBeregu = isBereguExamType(s.exam_type);
            const displayExamType = isBeregu ? 'LOMBA CERDAS CERMAT' : (s.exam_type || 'ASSESMENT SUMATIF');
            const eventOrganizer = appConfig['SCHOOL_NAME'] || 'EXAMORA DEVELOPMENT ASSESMENT';
            const displaySchoolHeader = isBeregu
                ? `${eventOrganizer}${s.kecamatan && s.kecamatan !== '-' ? ` - ${s.kecamatan}` : ''}`
                : `${s.school || '-'} - ${s.kecamatan || '-'}`;

            let infoRowsHtml = '';
            
            if (isBeregu) {
                const { reguTitle, members } = parseTeamAndMembers(s.fullname);
                const m1 = members[0] ? formatTwoWords(members[0]) : '..................';
                const m2 = members[1] ? formatTwoWords(members[1]) : '..................';
                const m3 = members[2] ? formatTwoWords(members[2]) : '..................';
                infoRowsHtml = `
                    <tr><td width="65">Nama Regu</td><td>: <b>${reguTitle}</b></td></tr>
                    <tr>
                        <td style="vertical-align: top;">Anggota</td>
                        <td style="vertical-align: top;">: 
                            <table style="display: inline-table; border-collapse: collapse; font-size: 7.2pt; line-height: 1.25; vertical-align: top; margin-left: 2px;">
                                <tr><td style="width: 14px; font-weight: bold; color: #475569; vertical-align: top;">1.</td><td style="font-weight: 600; color: #0f172a; vertical-align: top;">${m1}</td></tr>
                                <tr><td style="width: 14px; font-weight: bold; color: #475569; vertical-align: top;">2.</td><td style="font-weight: 600; color: #0f172a; vertical-align: top;">${m2}</td></tr>
                                <tr><td style="width: 14px; font-weight: bold; color: #475569; vertical-align: top;">3.</td><td style="font-weight: 600; color: #0f172a; vertical-align: top;">${m3}</td></tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td>Gugus</td><td>: ${s.kelas || '-'}</td></tr>
                `;
            } else {
                infoRowsHtml = `
                    <tr><td width="65">Nama</td><td>: <b>${s.fullname}</b></td></tr>
                    <tr><td>Kelas</td><td>: ${s.kelas || '-'}</td></tr>
                    <tr><td>Mata Pelajaran</td><td>: <b>${subjectLabel}</b></td></tr>
                `;
            }
            
            return `
            <div class="card">
                <div class="card-header">
                    <img src="${logoLeftUrl}" class="logo" />
                    <div class="header-text">
                        <h2>KARTU PESERTA</h2>
                        <p class="title-sub">${displayExamType}</p>
                        <p class="school-name">${displaySchoolHeader}</p>
                    </div>
                    <img src="${logoRightUrl}" class="logo" />
                </div>
                <div class="card-body">
                    <div class="info-col">
                        <table class="info-table">
                            ${infoRowsHtml}
                            <tr><td>Sesi</td><td>: ${s.session || '-'}</td></tr>
                            <tr><td>Username</td><td>: <b>${s.username}</b></td></tr>
                            <tr><td>Password</td><td>: <b>${s.password || '-'}</b></td></tr>
                        </table>
                    </div>
                    <div class="photo-col">
                        <div class="photo-box">
                            ${isBeregu 
                                ? `<img src="${s.photo_url || logoRightUrl}" style="width:100%; height:100%; object-fit:contain; padding:2px;" alt="Logo Regu" />`
                                : (s.photo_url 
                                    ? `<img src="${s.photo_url}" style="width:100%; height:100%; object-fit:cover;" />` 
                                    : `<span style="font-size:8pt; color:#ccc; text-align:center;">FOTO<br>3x4</span>`
                                  )
                            }
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <div class="signature">
                        <p>Penanggung Jawab</p>
                        <div class="sig-space"></div>
                        <p class="proktor-name"><b>${proktorName}</b></p>
                    </div>
                </div>
            </div>
        `}).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cetak Kartu Peserta</title>
                <style>
                    @page { size: A4 portrait; margin: 4mm; }
                    body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; background: #eee; }
                    .page-container {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 2mm;
                        width: 100%;
                        max-width: 202mm;
                        margin: 0 auto;
                    }
                    .card {
                        background: white;
                        border: 1px solid #000;
                        width: 100mm;
                        height: 68mm;
                        padding: 5px;
                        box-sizing: border-box;
                        position: relative;
                        page-break-inside: avoid;
                        display: flex;
                        flex-direction: column;
                    }
                    .card-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-bottom: 2px double #000;
                        padding-bottom: 3px;
                        margin-bottom: 4px;
                        height: 15mm;
                    }
                    .logo { height: 12mm; width: auto; object-fit: contain; }
                    .header-text { text-align: center; flex: 1; padding: 0 2px; }
                    .header-text h2 { font-size: 11pt; margin: 0; font-weight: bold; line-height: 1.1; }
                    .header-text .title-sub { font-size: 9.5pt; margin: 1px 0 0; font-weight: bold; line-height: 1.1; }
                    .header-text .school-name { font-size: 7.5pt; margin: 1px 0 0; font-style: italic; font-weight: 600; line-height: 1.1; word-break: break-word; }
                    
                    .card-body { 
                        display: flex; 
                        flex: 1; 
                        gap: 5px; 
                        padding-top: 2px;
                    }
                    .info-col { flex: 1; }
                    .info-table { width: 100%; font-size: 8pt; border-collapse: collapse; line-height: 1.25; }
                    .info-table td { padding: 1px 1px; vertical-align: top; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55mm; }
                    
                    .photo-col { width: 22mm; display: flex; justify-content: center; align-items: flex-start; padding-top: 0; }
                    .photo-box {
                        width: 20mm; height: 26mm;
                        border: 1px solid #999;
                        display: flex; align-items: center; justify-content: center;
                    }

                    .card-footer {
                        position: absolute;
                        bottom: 6px;
                        right: 55px;
                        width: 160px;
                        text-align: center;
                    }
                    .signature {
                        font-size: 9pt;
                    }
                    .signature p { margin: 0; }
                    .signature .proktor-name {
                        font-size: 7pt; 
                        line-height: 1.2;
                    }
                    .sig-space { height: 15px; }

                    @media print {
                        body { background: white; }
                        .page-container { gap: 2mm; }
                    }
                </style>
            </head>
            <body>
                <div class="page-container">
                    ${cardsHtml}
                </div>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const displayedStudents = showAll ? filteredStudents : filteredStudents.slice(0, 12);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
             <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-lg flex items-center gap-2 text-slate-700"><Printer size={20}/> Cetak Kartu Peserta</h3>
                 {isLoading && <span className="text-xs text-indigo-600 font-bold flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> Mengambil Data...</span>}
             </div>
             
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    {/* CHANGED: Filter Jenis Ujian instead of Session */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Jenis Ujian</label>
                        <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" value={filterExamType} onChange={e => setFilterExamType(e.target.value)}>
                            <option value="all">Semua Jenis Ujian</option>
                            {uniqueExamTypes.map((t:any) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {currentUser.role === 'admin' && (
                        <>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Kecamatan</label>
                            <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" value={filterKecamatan} onChange={e => setFilterKecamatan(e.target.value)}>
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
                                {uniqueSchools.map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        </>
                    )}

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Kelas</label>
                        <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                            <option value="all">Semua Kelas</option>
                            {uniqueClasses.map((s:any) => <option key={s} value={s}>Kelas {s}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2 items-center">
                        <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')} className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition shadow-sm h-[38px] flex items-center justify-center" title={sortOrder === 'asc' ? "Urutkan Z-A" : "Urutkan A-Z"}>
                            {sortOrder === 'asc' ? <ArrowDownAZ size={18}/> : <ArrowUpZA size={18}/>}
                        </button>
                    </div>
                </div>
                
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
                    <div className="text-xs text-slate-500">
                        Siap cetak: <b>{filteredStudents.length}</b> kartu.
                    </div>
                    <button onClick={handlePrint} disabled={isLoading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg disabled:opacity-50">
                        <Printer size={16}/> Print Kartu
                    </button>
                </div>
             </div>

             <div className="border border-slate-200 rounded-lg p-4 bg-slate-100 overflow-y-auto max-h-[700px]">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-center max-w-[800px] mx-auto">
                     {displayedStudents.map((s, idx) => {
                        const isBeregu = isBereguExamType(s.exam_type);
                        const displayExamType = isBeregu ? 'LOMBA CERDAS CERMAT' : (s.exam_type || 'ASSESMENT SUMATIF');
                        const eventOrganizer = appConfig['SCHOOL_NAME'] || 'EXAMORA DEVELOPMENT ASSESMENT';
                        const displaySchoolHeader = isBeregu
                            ? `${eventOrganizer}${s.kecamatan && s.kecamatan !== '-' ? ` - ${s.kecamatan}` : ''}`
                            : `${s.school || '-'} - ${s.kecamatan || '-'}`;

                        return (
                            <div key={idx} className="bg-white border border-slate-400 p-1.5 rounded-sm shadow-sm flex flex-col gap-1 relative text-[10px] mx-auto overflow-hidden" 
                                 style={{ width: '378px', height: '257px', fontFamily: 'Arial, sans-serif' }}>
                                <div className="flex justify-between items-center border-b-2 border-double border-slate-800 pb-1 mb-1 h-[57px]">
                                    <img src={logoLeftUrl} className="h-[46px] w-auto object-contain pl-1" alt="Logo"/>
                                    <div className="text-center flex-1 leading-tight px-1">
                                        <h4 className="font-bold text-[13px]">KARTU PESERTA</h4>
                                        <p className="text-[9.5px] font-bold">{displayExamType}</p>
                                        <p className="text-[8.5px] italic mt-0.5 leading-tight font-semibold text-slate-800 w-full text-center px-0.5 break-words">{displaySchoolHeader}</p>
                                    </div>
                                    <img src={logoRightUrl} className="h-[46px] w-auto object-contain pr-1" alt="Logo"/>
                                </div>
                                
                                <div className="flex gap-2 flex-1 pt-1 px-1">
                                    <div className="flex-1">
                                        <table className="w-full text-[11px] leading-[1.25]">
                                            <tbody>
                                                {isBeregu ? (
                                                    (() => {
                                                        const { reguTitle, members } = parseTeamAndMembers(s.fullname);
                                                        const m1 = members[0] ? formatTwoWords(members[0]) : '..................';
                                                        const m2 = members[1] ? formatTwoWords(members[1]) : '..................';
                                                        const m3 = members[2] ? formatTwoWords(members[2]) : '..................';
                                                        return (
                                                            <>
                                                                <tr><td className="w-16">Nama Regu</td><td>: <b>{reguTitle}</b></td></tr>
                                                                <tr>
                                                                    <td className="align-top">Anggota</td>
                                                                    <td className="align-top">: 
                                                                        <table className="inline-table border-collapse text-[9.5px] leading-tight align-top ml-0.5">
                                                                            <tbody>
                                                                                <tr><td className="w-3.5 font-bold text-slate-600 align-top">1.</td><td className="font-semibold text-slate-800 align-top">{m1}</td></tr>
                                                                                <tr><td className="w-3.5 font-bold text-slate-600 align-top">2.</td><td className="font-semibold text-slate-800 align-top">{m2}</td></tr>
                                                                                <tr><td className="w-3.5 font-bold text-slate-600 align-top">3.</td><td className="font-semibold text-slate-800 align-top">{m3}</td></tr>
                                                                            </tbody>
                                                                        </table>
                                                                    </td>
                                                                </tr>
                                                                <tr><td>Gugus</td><td>: {s.kelas || '-'}</td></tr>
                                                            </>
                                                        );
                                                    })()
                                                ) : (
                                                    <>
                                                        <tr><td className="w-16">Nama</td><td>: <b>{s.fullname}</b></td></tr>
                                                        <tr><td>Kelas</td><td>: {s.kelas || '-'}</td></tr>
                                                        <tr><td>Mata Pelajaran</td><td>: <b>{s.active_exam && s.active_exam !== '-' ? s.active_exam : '..................'}</b></td></tr>
                                                    </>
                                                )}
                                                <tr><td>Sesi</td><td>: {s.session || '-'}</td></tr>
                                                <tr><td>Username</td><td>: <b>{s.username}</b></td></tr>
                                                <tr><td>Password</td><td>: <b>{s.password || '-'}</b></td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="w-[83px] flex flex-col items-center">
                                        <div className="w-[76px] h-[98px] border border-slate-400 bg-slate-50 flex items-center justify-center text-[9px] text-slate-400 overflow-hidden">
                                            {isBeregu ? (
                                                <img src={s.photo_url || logoRightUrl} className="w-full h-full object-contain p-1" alt="Logo Regu"/>
                                            ) : s.photo_url ? (
                                                <img src={s.photo_url} className="w-full h-full object-cover"/>
                                            ) : (
                                                <span className="text-center leading-tight">FOTO<br/>3x4</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute bottom-2 right-16 text-[10px] text-center w-[160px]">
                                    <p>Penanggung Jawab</p>
                                    <div className="h-8"></div>
                                    <p className="font-bold leading-tight text-[9px]">{currentUser.nama_lengkap}</p>
                                </div>
                            </div>
                        );
                    })}
                 </div>
                 
                 {filteredStudents.length > 12 && (
                     <div className="mt-8 flex justify-center pb-4">
                         <button onClick={() => setShowAll(!showAll)} className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full font-bold text-xs hover:bg-slate-50 transition shadow-sm flex items-center gap-2 group">
                            {showAll ? (<>Tutup Tampilan <ChevronUp size={16}/></>) : (<>Lihat Semua <ChevronDown size={16}/></>)}
                         </button>
                     </div>
                 )}
             </div>
        </div>
    );
};

export default CetakKartuTab;
