
import React, { useState, useMemo, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { Printer, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { api } from '../../src/services/api';
import { User, Exam } from '../../types';
import { getSubjects, getExamTypes, getExamSubjectMapping, isBereguExamType } from '../../utils/adminHelpers';

const CetakAbsensiTab = ({ currentUser, students }: { currentUser: User, students: any[] }) => {
    const { showToast } = useToast();
    const [selectedExamId, setSelectedExamId] = useState('');
    const [selectedExamType, setSelectedExamType] = useState('all'); // NEW
    const [selectedSession, setSelectedSession] = useState('');
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    
    // Config for Logos
    const [appConfig, setAppConfig] = useState<Record<string, string>>({});
    const [subjectsDb, setSubjectsDb] = useState<{id: string, label: string}[]>([]);
    const [examSubjectMapping, setExamSubjectMapping] = useState<{examTypeId: string, subjectIds: string[]}[]>([]);

    useEffect(() => {
        api.getAppConfig().then(config => {
            setAppConfig(config);
            const subjects = getSubjects(config);
            const mapping = getExamSubjectMapping(config);
            setSubjectsDb(subjects);
            setExamSubjectMapping(mapping);
            if (subjects.length > 0) {
                setSelectedExamId(subjects[0].id);
            }
        }).catch(console.error);
    }, []);

    // FILTER ONLY STUDENTS
    const studentList = useMemo(() => students.filter(s => s.role === 'siswa'), [students]);

    // NEW: Unique Exam Types
    const uniqueExamTypes = useMemo(() => {
        const types = new Set(studentList.map(s => s.exam_type).filter(Boolean));
        return Array.from(types).sort();
    }, [studentList]);

    // Filter exams based on selected exam type
    const filteredExams = useMemo(() => {
        if (selectedExamType === 'all') return subjectsDb;
        const mapping = examSubjectMapping.find(m => m.examTypeId === selectedExamType);
        if (!mapping) return subjectsDb;
        return subjectsDb.filter(s => mapping.subjectIds.includes(s.id));
    }, [subjectsDb, selectedExamType, examSubjectMapping]);

    // Auto-select first subject if current selection is invalid for the new filter
    useEffect(() => {
        if (filteredExams.length > 0) {
            const exists = filteredExams.find(s => s.id === selectedExamId);
            if (!exists) {
                setSelectedExamId(filteredExams[0].id);
            }
        } else if (filteredExams.length === 0 && selectedExamId) {
             setSelectedExamId('');
        }
    }, [filteredExams, selectedExamId]);

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
            if (currentUser.role === 'Guru') {
                if ((s.school || '').toLowerCase() !== (currentUser.kelas_id || '').toLowerCase()) return false;
            } else {
                if (filterSchool !== 'all' && s.school !== filterSchool) return false;
                if (filterKecamatan !== 'all' && (s.kecamatan || '').toLowerCase() !== filterKecamatan.toLowerCase()) return false;
            }
            if (selectedSession && s.session !== selectedSession) return false;
            if (filterClass !== 'all' && (s.kelas || '') !== filterClass) return false;
            if (selectedExamType !== 'all' && s.exam_type !== selectedExamType) return false; // NEW
            return true;
        });

        // Sort by Name
        return res.sort((a, b) => {
            const nameA = (a.fullname || a.username || '').toLowerCase();
            const nameB = (b.fullname || b.username || '').toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    }, [studentList, currentUser, filterSchool, filterKecamatan, filterClass, selectedSession, selectedExamType, sortOrder]);

    const handlePrint = () => {
        console.log("DEBUG: handlePrint - selectedExamId:", selectedExamId);
        if (filteredStudents.length === 0) return showToast("Tidak ada data siswa untuk dicetak.", "info");

        const printWindow = window.open('', '_blank');
        if (!printWindow) return showToast("Pop-up diblokir. Mohon izinkan pop-up.", "warning");

        const schoolName = currentUser.role === 'Guru' ? currentUser.kelas_id : (filterSchool !== 'all' ? filterSchool : 'Semua Sekolah');
        const kecamatanName = currentUser.role === 'Guru' ? (currentUser.kecamatan || '-') : (filterKecamatan !== 'all' ? filterKecamatan : '-');
        const sesiName = selectedSession || 'Semua Sesi';
        const className = filterClass !== 'all' ? `Kelas ${filterClass}` : '';
        const examName = subjectsDb.find(e => e.id === selectedExamId)?.label || '...........................';
        const examType = selectedExamType !== 'all' ? selectedExamType : '...........................';
        
        const dateNow = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const signatureDate = `Tuban, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        const proktorName = currentUser.nama_lengkap || "...........................";
        
        // UPDATED LOGOS from CONFIG (Transparent fallback if empty)
        const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const logoLeftUrl = appConfig['LOGO_KABUPATEN'] || transparentPixel;
        const logoRightUrl = appConfig['LOGO_SEKOLAH'] || transparentPixel;

        const isAnyBeregu = filteredStudents.some(s => isBereguExamType(s.exam_type));

        const rowsHtml = filteredStudents.map((s, idx) => {
            const isBeregu = isBereguExamType(s.exam_type);
            let nameHtml = s.fullname;
            let signatureHtml = '';
            
            if (isBeregu) {
                const parts = (s.fullname || '').split('|').map((p: string) => p.trim());
                const teamName = parts[0] || '';
                const m1 = parts[1] || '';
                const m2 = parts[2] || '';
                const m3 = parts[3] || '';
                
                nameHtml = `
                    <div style="font-weight: bold; margin-bottom: 4px;">${teamName}</div>
                    <ol style="margin: 0; padding-left: 14px; font-size: 11px; color: #444;">
                        ${m1 ? `<li>${m1}</li>` : '<li>..................</li>'}
                        ${m2 ? `<li>${m2}</li>` : '<li>..................</li>'}
                        ${m3 ? `<li>${m3}</li>` : '<li>..................</li>'}
                    </ol>
                `;
                
                signatureHtml = `
                    <table style="width: 100%; border: none !important; font-size: 9px; line-height: 1.25;">
                        <tr style="border: none !important;">
                            <td style="border: none !important; padding: 2px 0; width: 50%;">1. ....................</td>
                            <td style="border: none !important; padding: 2px 0; width: 50%;"></td>
                        </tr>
                        <tr style="border: none !important;">
                            <td style="border: none !important; padding: 2px 0;"></td>
                            <td style="border: none !important; padding: 2px 0;">2. ....................</td>
                        </tr>
                        <tr style="border: none !important;">
                            <td style="border: none !important; padding: 2px 0;">3. ....................</td>
                            <td style="border: none !important; padding: 2px 0;"></td>
                        </tr>
                    </table>
                `;
            } else {
                nameHtml = s.fullname;
                if ((idx + 1) % 2 !== 0) {
                    signatureHtml = `
                        <div style="width: 100%; text-align: left; padding-left: 10px;">${idx + 1}. ....................</div>
                    `;
                } else {
                    signatureHtml = `
                        <div style="width: 100%; text-align: right; padding-right: 10px;">${idx + 1}. ....................</div>
                    `;
                }
            }
            
            return `
                <tr>
                    <td style="text-align: center; vertical-align: middle;">${idx + 1}</td>
                    <td style="vertical-align: middle; font-family: monospace;">${s.username}</td>
                    <td style="vertical-align: middle;">${nameHtml}</td>
                    <td style="text-align: center; vertical-align: middle;">${s.kelas || '-'}</td>
                    <td style="vertical-align: middle;">${examName}</td>
                    <td style="vertical-align: middle;">${s.school || '-'}</td>
                    <td style="text-align: center; vertical-align: middle;">${s.kecamatan || '-'}</td>
                    <td style="vertical-align: middle; padding: 4px;">${signatureHtml}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cetak Absensi</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 20px; color: #000; }
                    .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px double black; padding-bottom: 10px; margin-bottom: 20px; }
                    .header-logo { height: 65px; width: auto; object-fit: contain; }
                    .header-text { text-align: center; flex: 1; }
                    .header-container h2 { margin: 0; font-size: 18px; text-transform: uppercase; line-height: 1.2; }
                    .header-container h3 { margin: 5px 0 0; font-size: 16px; font-weight: normal; }
                    .info-table { margin-bottom: 20px; font-size: 14px; width: 100%; }
                    .info-table td { padding: 4px; vertical-align: top; }
                    .main-table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    .main-table th, .main-table td { border: 1px solid black; padding: 8px; }
                    .main-table th { background-color: #f0f0f0; text-align: center; font-weight: bold; }
                    .signature-section { margin-top: 50px; float: right; width: 250px; text-align: center; font-size: 14px; }
                    @media print {
                        @page { size: A4; margin: 1.5cm; }
                        button { display: none; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    ${logoLeftUrl !== transparentPixel ? `<img src="${logoLeftUrl}" class="header-logo" />` : `<div style="width: 65px;"></div>`}
                    <div class="header-text">
                        <h2>DAFTAR HADIR PESERTA</h2>
                        <h2>${examType}</h2>
                        <h3>${schoolName} - ${kecamatanName}</h3>
                    </div>
                    ${logoRightUrl !== transparentPixel ? `<img src="${logoRightUrl}" class="header-logo" />` : `<div style="width: 65px;"></div>`}
                </div>

                <table class="info-table">
                    <tr><td width="150">Hari, Tanggal</td><td>: ${dateNow}</td></tr>
                </table>

                <table class="main-table">
                    <thead>
                        <tr>
                            <th width="40">No</th>
                            <th>Username</th>
                            <th>Nama</th>
                            <th width="60">Kelas</th>
                            <th>Mapel</th>
                            <th>Sekolah</th>
                            <th>Kecamatan</th>
                            <th width="${isAnyBeregu ? '160' : '110'}">Tanda Tangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="signature-section">
                    <p>${signatureDate}</p>
                    <p>Penanggung Jawab</p>
                    <br/><br/><br/>
                    <p><strong>${proktorName}</strong></p>
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

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
             <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-700"><Printer size={20}/> Cetak Daftar Hadir (Absensi)</h3>
             
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Jenis Ujian</label>
                         <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)}>
                            <option value="all">Semua Jenis Ujian</option>
                            {uniqueExamTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mata Pelajaran</label>
                         <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}>
                            <option value="">-- Pilih Mapel --</option>
                            {filteredExams.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                        </select>
                    </div>
                    <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Sesi</label>
                         <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                            <option value="">Semua Sesi</option>
                            <option value="Sesi 1">Sesi 1</option>
                            <option value="Sesi 2">Sesi 2</option>
                            <option value="Sesi 3">Sesi 3</option>
                            <option value="Sesi 4">Sesi 4</option>
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
                        <div className="text-xs font-bold text-slate-400">Sort Nama</div>
                    </div>
                </div>
                
                <div className="flex justify-end mt-4 pt-4 border-t border-slate-200">
                    <button onClick={handlePrint} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-slate-900 transition flex items-center gap-2 shadow-lg">
                        <Printer size={16}/> Cetak Absensi
                    </button>
                </div>
             </div>

             <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4 w-10">No</th>
                            <th className="p-4">Username</th>
                            <th className="p-4">Nama Peserta</th>
                            <th className="p-4">Kelas</th>
                            <th className="p-4">Sekolah</th>
                            <th className="p-4">Kecamatan</th>
                            <th className="p-4">Sesi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                         {filteredStudents.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Tidak ada data siswa sesuai filter.</td></tr>
                        ) : (
                            filteredStudents.map((s, idx) => (
                                <tr key={s.username} className="hover:bg-slate-50">
                                    <td className="p-4 text-center text-slate-500 font-mono">{idx+1}</td>
                                    <td className="p-4 font-mono font-bold text-slate-600">{s.username}</td>
                                    <td className="p-4 font-bold text-slate-700">
                                        {isBereguExamType(s.exam_type) ? (
                                            <div>
                                                <div className="font-extrabold text-indigo-700">{s.fullname.split('|')[0]?.trim()}</div>
                                                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1 bg-slate-50 p-1.5 rounded-md border border-slate-100 max-w-sm">
                                                    {s.fullname.split('|').slice(1).map((m: string, i: number) => (
                                                        <span key={i} className="font-medium">• {m.trim()}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            s.fullname
                                        )}
                                    </td>
                                    <td className="p-4 text-slate-600">{s.kelas || '-'}</td>
                                    <td className="p-4 text-slate-600">{s.school}</td>
                                    <td className="p-4 text-slate-600">{s.kecamatan || '-'}</td>
                                    <td className="p-4"><span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs font-bold">{s.session || '-'}</span></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
             </div>
        </div>
    );
};

export default CetakAbsensiTab;
