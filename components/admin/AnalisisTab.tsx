
import React, { useState, useMemo, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { BarChart3, FileText, Loader2, Filter, AlertCircle, Printer, Settings, Target, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { api } from '../../src/services/api';
import { Exam, User, LearningObjective } from '../../types';

const AnalisisTab = ({ currentUser, students }: { currentUser: User, students: any[] }) => {
    const { showToast } = useToast();
    const [tps, setTps] = useState<LearningObjective[]>([]);
    const [selectedExam, setSelectedExam] = useState('');
    
    // Data States
    const [resultsData, setResultsData] = useState<any[]>([]);
    const [questionsData, setQuestionsData] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [loadingTps, setLoadingTps] = useState(false);
    
    // Global Config State (Loaded from API)
    const [globalConfig, setGlobalConfig] = useState<Record<string, string>>({});
    const [subjectsDb, setSubjectsDb] = useState<{id: string, label: string}[]>([]);

    // Local Filter & Config States
    const [filterClass, setFilterClass] = useState('all'); // Filter Table
    const [tpId, setTpId] = useState(''); // ID TP Selection
    const [tpInput, setTpInput] = useState(''); // Deskripsi TP
    const [materiInput, setMateriInput] = useState(''); // Materi
    const [kktp, setKktp] = useState(75); // KKTP Logic (Default 75) - Will be updated from config
    const [showConfig, setShowConfig] = useState(true); // Default open to encourage selection
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Helper Maps
    const userMap = useMemo(() => {
        const map: Record<string, any> = {};
        students.forEach(s => map[s.username] = s);
        return map;
    }, [students]);

    useEffect(() => { 
        // Load TPs
        setLoadingTps(true);
        api.getLearningObjectives().then(res => {
            setTps(res);
            setLoadingTps(false);
        });
        
        // Load Configs (Global + User Specific for Guru)
        const loadConfigs = async () => {
            try {
                const gConfig = await api.getAppConfig();
                
                // Update KKTP from Server Config if available
                if (gConfig['KKTP']) {
                    const serverKktp = Number(gConfig['KKTP']);
                    if (!isNaN(serverKktp)) {
                        setKktp(serverKktp);
                    }
                }

                // Load Subjects from Config
                if (gConfig['SUBJECTS_DB']) {
                    try {
                        const parsed = JSON.parse(gConfig['SUBJECTS_DB']);
                        if (Array.isArray(parsed)) setSubjectsDb(parsed);
                    } catch (e) { console.error("Failed to parse SUBJECTS_DB", e); }
                }

                let combinedConfig = { ...gConfig };
                
                // If Guru, merge with personal config to get specific Jabatan/Settings
                if (currentUser.role === 'Guru') {
                    const uConfig = await api.getUserConfig(currentUser.username);
                    combinedConfig = { ...combinedConfig, ...uConfig };
                }
                setGlobalConfig(combinedConfig);
            } catch (e) {
                console.error("Config load error", e);
            }
        };
        loadConfigs();
        
        // Auto set filter class for Guru if locked
        if (currentUser.role === 'Guru' && currentUser.kelas && currentUser.kelas !== '-') {
            setFilterClass(currentUser.kelas);
        }
    }, [currentUser]);

    // Filter TPs based on selected Exam (Mapel)
    const relevantTps = useMemo(() => {
        if (!selectedExam) return [];
        const examName = selectedExam; // selectedExam is now the Label
        // Match TP Mapel exactly
        return tps.filter(t => t.mapel === examName);
    }, [tps, selectedExam]);

    // Load Data when Exam Selected
    useEffect(() => {
        if (!selectedExam) {
            setResultsData([]);
            setQuestionsData([]);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const qData = await api.getQuestions(selectedExam);
                
                // Use Global MAX_QUESTIONS if available
                let finalQuestions = qData;
                const globalMax = globalConfig['MAX_QUESTIONS'] ? parseInt(globalConfig['MAX_QUESTIONS']) : 0;
                
                if (globalMax > 0) {
                    finalQuestions = qData.slice(0, globalMax);
                }
                setQuestionsData(finalQuestions);

                // RESET INPUTS (Logic: Deskripsi tidak muncul sebelum ID TP dipilih)
                // Ini memaksa user memilih TP ulang saat ganti mapel
                setTpId('');
                setTpInput('');
                setMateriInput('');
                // If not Guru, reset class filter when mapel changes
                if (!(currentUser.role === 'Guru' && currentUser.kelas)) {
                    setFilterClass('all');
                }
                
                // Auto open config panel if mapel changed
                setShowConfig(true);

                const rData = await api.getAnalysis(selectedExam);
                setResultsData(rData);
            } catch (e) {
                console.error("Failed to load analysis data", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedExam, globalConfig]); // Removed 'tps' from dep to prevent loop, 'tps' is loaded once

    // FILTER ONLY STUDENTS FOR CLASS LIST (Requirement: Users only, no admins)
    const uniqueClasses = useMemo(() => {
        const studentOnly = students.filter(s => s.role === 'siswa');
        const classes = new Set(studentOnly.map(s => s.kelas).filter(Boolean));
        return Array.from(classes).sort((a: any, b: any) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [students]);

    // Check if exam is Sumatif based on questions
    const isSumatif = useMemo(() => questionsData.some(q => (q.jenis_ujian || '').toUpperCase().includes('SUMATIF')), [questionsData]);

    // Process Data
    const processedData = useMemo(() => {
        // Filter Students
        const filtered = resultsData.filter(d => {
            const user = userMap[d.username];
            // Strict check: User must exist and be a student (role siswa)
            if (!user || user.role !== 'siswa') return false;

            const userKelas = user.kelas || '-';
            
            // GURU SPECIFIC LOGIC
            if (currentUser.role === 'Guru') {
                const mySchool = (currentUser.kelas_id || '').toLowerCase();
                const studentSchool = (user.school || '').toLowerCase();
                if (studentSchool !== mySchool) return false;

                if (currentUser.kelas && currentUser.kelas !== '-' && currentUser.kelas !== '') {
                    if (userKelas !== currentUser.kelas) return false;
                }
            }
            
            // Logic Filter Kelas
            const classMatch = filterClass === 'all' || (userKelas === filterClass);
            
            return classMatch;
        });

        // Parse JSON and Calculate Mastery
        let rows = filtered.map(d => {
            let ansMap = {};
            try {
                ansMap = typeof d.analisis === 'string' ? JSON.parse(d.analisis) : d.analisis || {};
            } catch (e) { console.error("JSON Parse Error", e); }
            
            const score = parseFloat(d.nilai) || 0;
            
            // LOGIKA KETUNTASAN:
            // Hanya berlaku untuk SUMATIF
            // Jika nilai >= KKTP -> Tuntas -> Pengayaan
            // Jika nilai < KKTP -> Tidak Tuntas -> Remidi
            let isTuntas = true;
            let ketuntasan = "-";
            let rekomendasi = "-";

            if (isSumatif) {
                isTuntas = score >= kktp;
                ketuntasan = isTuntas ? "Tuntas" : "Tidak Tuntas";
                rekomendasi = isTuntas ? "Pengayaan" : "Remidi";
            }

            return { 
                ...d, 
                ansMap,
                score,
                isTuntas,
                ketuntasan,
                rekomendasi
            };
        });

        // Sort by Name
        rows = rows.sort((a, b) => {
            const nameA = (a.nama || a.username || '').toLowerCase();
            const nameB = (b.nama || b.username || '').toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });

        // Calculate Stats Per Question (Item Difficulty)
        const questionStats: Record<string, { correct: number, total: number }> = {};
        questionsData.forEach(q => { questionStats[q.id] = { correct: 0, total: 0 }; });

        rows.forEach(row => {
            questionsData.forEach(q => {
                const isCorrect = row.ansMap[q.id] === 1;
                if (questionStats[q.id]) {
                    questionStats[q.id].total++;
                    if (isCorrect) questionStats[q.id].correct++;
                }
            });
        });

        return { rows, questionStats };
    }, [resultsData, questionsData, filterClass, userMap, kktp, currentUser, sortOrder, isSumatif]);

    const { rows, questionStats } = processedData;

    // Requirement: Check if config is complete to show dashboard
    const isConfigComplete = selectedExam && (!isSumatif || (tpId && tpInput));
    const isGuruClassLocked = currentUser.role === 'Guru' && currentUser.kelas && currentUser.kelas !== '-';

    // Helper variables for UI and Print
    const representativeStudent = rows.length > 0 ? userMap[rows[0].username] : null;
    const displayJenisUjian = representativeStudent?.exam_type || '-';
    const displaySchool = globalConfig['SCHOOL_NAME'] || (representativeStudent?.school) || '...........................';
    const displayMapel = selectedExam;
    const displayKelas = filterClass !== 'all' ? filterClass : 'Semua Kelas';
    const displaySemester = globalConfig['SEMESTER'] || '1 (Ganjil)';
    const displayTahun = globalConfig['ACADEMIC_YEAR'] || '2025/2026';

    // Signature Variables (Sync with Print logic)
    let kepSekName = globalConfig['PRINCIPAL_NAME'] || '...........................';
    let kepSekNip = globalConfig['PRINCIPAL_NIP'] || '-';
    let kepSekTitle = 'Kepala Sekolah';
    let guruName = globalConfig['TEACHER_NAME'] || '...........................';
    let guruNip = globalConfig['TEACHER_NIP'] || '-';
    let guruJabatan = globalConfig['TEACHER_POSITION'] || 'Guru Kelas';

    if (currentUser.role === 'Guru') {
        guruName = currentUser.nama_lengkap;
        guruNip = currentUser.username;
        if (!globalConfig['TEACHER_POSITION'] && currentUser.kelas && currentUser.kelas !== '-') {
            guruJabatan = `Guru Kelas ${currentUser.kelas}`;
        }
    }

    if (globalConfig['EXAM_SIGNATORIES']) {
        try {
            const signatories = JSON.parse(globalConfig['EXAM_SIGNATORIES']);
            if (signatories[displayJenisUjian]) {
                const sig = signatories[displayJenisUjian];
                kepSekTitle = sig.leftTitle || kepSekTitle;
                kepSekName = sig.leftName || kepSekName;
                kepSekNip = sig.leftNip || kepSekNip;
                guruJabatan = sig.rightTitle || guruJabatan;
                guruName = sig.rightName || guruName;
                guruNip = sig.rightNip || guruNip;
            }
        } catch (e) {
            console.error("Failed to parse EXAM_SIGNATORIES", e);
        }
    }

    const dateNow = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // CSS Style Object for WYSIWYG
    const styles = {
        container: { fontFamily: 'Arial, sans-serif', fontSize: '9pt', color: '#000', backgroundColor: '#fff', width: '100%', boxSizing: 'border-box' as const },
        headerTitle: { textAlign: 'center' as const, fontWeight: 'bold', fontSize: '14pt', marginBottom: '5px', textTransform: 'uppercase' as const, lineHeight: '1.2' },
        headerSubtitle: { textAlign: 'center' as const, fontWeight: 'bold', fontSize: '12pt', marginBottom: '20px', textTransform: 'uppercase' as const, borderBottom: '3px double #000', paddingBottom: '10px' },
        metaContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', fontSize: '9pt' },
        metaTable: { fontSize: '9pt', width: '100%', marginBottom: '15px' },
        metaTdLabel: { fontWeight: 'bold', width: '140px', padding: '2px 5px', verticalAlign: 'top' as const },
        metaTdVal: { padding: '2px 5px', verticalAlign: 'top' as const },
        dataTable: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: '20px', fontSize: '9pt', tableLayout: 'auto' as const },
        th: { backgroundColor: '#f0f0f0', border: '1px solid #000', padding: '4px 2px', textAlign: 'center' as const, fontWeight: 'bold' },
        td: { border: '1px solid #000', padding: '3px', verticalAlign: 'middle' as const },
        tdCenter: { border: '1px solid #000', padding: '3px', textAlign: 'center' as const, verticalAlign: 'middle' as const },
        tdAns: { border: '1px solid #000', padding: '0', textAlign: 'center' as const, minWidth: '20px' },
        footer: { display: 'flex', justifyContent: 'space-between', marginTop: '20px', fontSize: '11pt', pageBreakInside: 'avoid' as const },
        sigBox: { textAlign: 'center' as const, width: '250px', lineHeight: '1.2' },
        sigSpace: { height: '60px' },
        sigName: { fontWeight: 'bold', textDecoration: 'underline', marginBottom: '2px', fontSize: '11pt' },
        sigNip: { fontSize: '10pt' }
    };

    // Generate HTML String for Print (Must match WYSIWYG component below)
    const generateHtmlReport = () => {
        const tableHeaderCols = questionsData.map((q, i) => `<th class="col-ans">${i+1}</th>`).join('');
        
        const tableRows = rows.map((r, i) => {
            const cells = questionsData.map(q => {
                const val = r.ansMap[q.id];
                const bg = val === 1 ? '#d1fae5' : val === 0 ? '#fee2e2' : '#ffffff';
                return `<td class="col-ans" style="background-color: ${bg};">${val === 1 ? '1' : val === 0 ? '0' : '-'}</td>`;
            }).join('');

            return `
                <tr>
                    <td style="text-align: center;">${i+1}</td>
                    <td class="col-name">${r.nama}</td>
                    <td style="text-align: center;">${r.score}</td>
                    ${cells}
                    <td style="text-align: center; color: ${isSumatif ? (r.isTuntas ? 'green' : 'red') : 'black'}; font-weight: bold;">${r.ketuntasan}</td>
                    <td style="text-align: center; color: ${isSumatif ? (r.isTuntas ? 'blue' : 'orange') : 'black'};">${r.rekomendasi}</td>
                </tr>
            `;
        }).join('');

        // BOTTOM STATS ROWS
        const correctRow = questionsData.map(q => `<td class="col-ans" style="font-weight:bold;">${questionStats[q.id].correct}</td>`).join('');
        const incorrectRow = questionsData.map(q => `<td class="col-ans" style="font-weight:bold; color:red;">${questionStats[q.id].total - questionStats[q.id].correct}</td>`).join('');
        const percentRow = questionsData.map(q => {
            const stats = questionStats[q.id];
            const pct = stats.total > 0 ? Math.round((stats.correct/stats.total)*100) : 0;
            return `<td class="col-ans" style="font-weight:bold;">${pct}%</td>`;
        }).join('');
        
        const diffRow = questionsData.map(q => {
            const stats = questionStats[q.id];
            const pct = stats.total > 0 ? Math.round((stats.correct/stats.total)*100) : 0;
            let label = "Sd";
            let color = "blue";
            if (pct > 70) { label = "M"; color = "green"; }
            else if (pct < 30) { label = "S"; color = "red"; }
            return `<td class="col-ans" style="font-weight:bold; color:${color};">${label}</td>`;
        }).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Analisis Hasil Asesmen Sumatif</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm; }
                    body { font-family: 'Arial', sans-serif; padding: 0; margin: 0; font-size: 9pt; color: #000; }
                    .container { width: 100%; }
                    .header-title { text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 5px; text-transform: uppercase; line-height: 1.2; }
                    .header-subtitle { text-align: center; font-weight: bold; font-size: 12pt; margin-bottom: 20px; text-transform: uppercase; border-bottom: 3px double #000; padding-bottom: 10px; }
                    .meta-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; font-size: 9pt; }
                    .meta-table td { padding: 2px 5px; vertical-align: top; }
                    .meta-label { font-weight: bold; width: 140px; white-space: nowrap; }
                    .tp-container { display: flex; align-items: flex-start; gap: 4px; }
                    .tp-desc { max-width: 550px; text-align: justify; line-height: 1.2; }
                    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt; table-layout: auto; }
                    table.data-table th, table.data-table td { border: 1px solid #000; padding: 3px; vertical-align: middle; }
                    table.data-table th { background-color: #f0f0f0; text-align: center; font-weight: bold; padding: 4px 2px; }
                    .col-no { width: 25px; text-align: center; }
                    .col-name { width: 140px; } 
                    .col-score { width: 35px; text-align: center; }
                    .col-ans { width: 20px; min-width: 20px; max-width: 20px; text-align: center; font-size: 9pt; padding: 0; overflow: hidden; }
                    .col-status { width: 60px; text-align: center; }
                    .col-rec { width: 60px; text-align: center; }
                    .footer { display: flex; justify-content: space-between; margin-top: 20px; page-break-inside: avoid; font-size: 11pt; }
                    .signature-box { text-align: center; width: 250px; line-height: 1.2; }
                    .signature-box p { margin: 0; }
                    .signature-space { height: 60px; }
                    .sig-name { font-weight: bold; font-size: 11pt; margin-bottom: 2px; text-decoration: underline; } 
                    .sig-nip { font-size: 10pt; }
                    .bg-gray { background-color: #f9fafb; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header-title">Analisis Hasil Asesmen ${displayJenisUjian}</div>
                    <div class="header-subtitle">${displaySchool}</div>
                    <div class="meta-container">
                        <table class="meta-table">
                            <tr><td class="meta-label">Jenis Ujian</td><td>: ${displayJenisUjian}</td></tr>
                            <tr><td class="meta-label">Mata Pelajaran</td><td>: ${displayMapel}</td></tr>
                            ${isSumatif ? `<tr><td class="meta-label">Tujuan Pembelajaran</td><td><div class="tp-container"><span>:</span><div class="tp-desc">${tpInput || '-'}</div></div></td></tr>` : ''}
                        </table>
                        <table class="meta-table">
                            ${isSumatif ? `<tr><td class="meta-label">Materi</td><td>: ${materiInput || '-'}</td></tr>` : ''}
                            <tr><td class="meta-label">Kelas / Semester</td><td>: ${displayKelas} / ${displaySemester}</td></tr>
                            <tr><td class="meta-label">Tahun Ajaran</td><td>: ${displayTahun}</td></tr>
                        </table>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th class="col-no" rowspan="2">No</th>
                                <th class="col-name" rowspan="2">Nama Peserta Didik</th>
                                <th class="col-score" rowspan="2">Nilai</th>
                                <th colspan="${questionsData.length}">Analisis Butir Soal</th>
                                <th class="col-status" rowspan="2">Ketuntasan</th>
                                <th class="col-rec" rowspan="2">Rekomendasi</th>
                            </tr>
                            <tr>${tableHeaderCols}</tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                        <tfoot>
                            <tr class="bg-gray"><td colspan="3" class="text-align:right font-bold" style="text-align:right; padding-right:10px;">Jumlah Benar</td>${correctRow}<td colspan="2"></td></tr>
                            <tr class="bg-gray"><td colspan="3" class="text-align:right font-bold" style="text-align:right; padding-right:10px;">Jumlah Salah</td>${incorrectRow}<td colspan="2"></td></tr>
                            <tr class="bg-gray"><td colspan="3" class="text-align:right font-bold" style="text-align:right; padding-right:10px;">Prosentase Benar</td>${percentRow}<td colspan="2"></td></tr>
                            <tr class="bg-gray"><td colspan="3" class="text-align:right font-bold" style="text-align:right; padding-right:10px;">Tingkat Kesukaran</td>${diffRow}<td colspan="2"></td></tr>
                        </tfoot>
                    </table>
                    <div class="footer">
                        <div class="signature-box">
                            <p>Mengetahui,</p><p>${kepSekTitle}</p><div class="signature-space"></div>
                            <p class="sig-name">${kepSekName}</p><p class="sig-nip">NIP. ${kepSekNip}</p>
                        </div>
                        <div class="signature-box">
                            <p>Tuban, ${dateNow}</p><p>${guruJabatan}</p><div class="signature-space"></div>
                            <p class="sig-name">${guruName}</p><p class="sig-nip">NIP. ${guruNip}</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    const handlePrint = () => {
        if (!isConfigComplete || rows.length === 0) return showToast("Data belum lengkap atau kosong.", "info");
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const content = generateHtmlReport();
        printWindow.document.write(content + `<script>window.onload = function() { window.print(); }</script>`);
        printWindow.document.close();
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
            {/* Header Control */}
            <div className="flex flex-col gap-6 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><BarChart3 size={20} className="text-indigo-600"/> Analisis Hasil Asesmen</h3>
                        <p className="text-xs text-slate-400">Pilih Ujian dan TP untuk melihat analisis butir soal.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <button onClick={() => setShowConfig(!showConfig)} className={`p-2.5 rounded-lg border transition flex items-center gap-2 text-xs font-bold ${showConfig ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} ${!isConfigComplete && selectedExam ? 'animate-pulse ring-2 ring-indigo-300' : ''}`}>
                            <Settings size={16}/> Konfigurasi
                        </button>
                        <div className="h-8 w-px bg-slate-200 mx-1"></div>
                        <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 min-w-[200px]" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
                            <option value="">-- Pilih Mapel / Ujian --</option>
                            {subjectsDb.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                        </select>
                        {isConfigComplete && rows.length > 0 && (
                            <button onClick={handlePrint} className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95">
                                <Printer size={16}/> Cetak
                            </button>
                        )}
                        <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')} className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition shadow-sm h-[38px] w-[38px] flex items-center justify-center" title={sortOrder === 'asc' ? "Urutkan Z-A" : "Urutkan A-Z"}>
                            {sortOrder === 'asc' ? <ArrowDownAZ size={18}/> : <ArrowUpZA size={18}/>}
                        </button>
                    </div>
                </div>

                {/* Configuration Panel */}
                {showConfig && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
                        <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2"><FileText size={16}/> Filter & Atribut Laporan</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* TP Configuration */}
                            {isSumatif && (
                                <div className="lg:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tujuan Pembelajaran (TP)</label>
                                    <div className="flex gap-2">
                                        <div className="relative w-1/3">
                                            <Target className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                                            <select className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm font-bold focus:border-indigo-500 outline-none bg-white truncate cursor-pointer text-indigo-700" value={tpId} onChange={(e) => {
                                                    const id = e.target.value;
                                                    setTpId(id);
                                                    const selected = tps.find(t => t.id === id);
                                                    if (selected) {
                                                        setTpInput(selected.text_tujuan);
                                                        if(selected.materi) setMateriInput(selected.materi);
                                                        if(selected.kelas) setFilterClass(selected.kelas);
                                                    } else {
                                                        setTpInput(''); setMateriInput('');
                                                        if (!isGuruClassLocked) setFilterClass('all');
                                                    }
                                                }} disabled={!selectedExam}>
                                                <option value="">Pilih ID TP</option>
                                                {relevantTps.map(t => (<option key={t.id} value={t.id}>{t.id}</option>))}
                                            </select>
                                        </div>
                                        <input type="text" readOnly className="w-2/3 p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none bg-slate-100 text-slate-600 cursor-not-allowed" value={tpInput} placeholder="Deskripsi Tujuan Pembelajaran" />
                                    </div>
                                    {selectedExam && relevantTps.length === 0 && !loadingTps && (
                                        <p className="text-[9px] text-orange-500 mt-1 italic">* Tidak ada data TP untuk Mapel ini. Tambahkan di menu Data Laporan {'>'} Tujuan Pembelajaran.</p>
                                    )}
                                </div>
                            )}
                            {/* Materi Configuration */}
                            {isSumatif && (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Materi</label>
                                    <input type="text" readOnly className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium outline-none bg-slate-100 text-slate-600 cursor-not-allowed" value={materiInput} placeholder="Materi" />
                                </div>
                            )}
                            {/* Class Filter */}
                            {!isGuruClassLocked && (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Filter Kelas Siswa</label>
                                    <select className={`w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:border-indigo-500 bg-white ${tpId ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} value={filterClass} onChange={e => setFilterClass(e.target.value)} disabled={!!tpId}>
                                        <option value="all">Semua Kelas</option>
                                        {uniqueClasses.map((s:any) => (<option key={s} value={s}>{s}</option>))}
                                    </select>
                                    {tpId && <p className="text-[9px] text-indigo-500 mt-0.5 italic flex items-center gap-1">* Terkunci sesuai ID TP</p>}
                                </div>
                            )}
                        </div>
                        <div className="mt-3 text-[10px] text-slate-400 italic">
                            * Data Sekolah, Kepala Sekolah, dan Guru diambil otomatis dari menu <b>Konfigurasi</b>. KKTP Aktif: {kktp}
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN CONTENT AREA - PAPER SIMULATION */}
            {!selectedExam ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Filter size={40} className="text-slate-300 mb-2"/>
                    <p className="text-slate-400 font-medium">Pilih Ujian (Mata Pelajaran) terlebih dahulu.</p>
                </div>
            ) : !isConfigComplete ? (
                <div className="flex flex-col items-center justify-center py-20 bg-orange-50 rounded-2xl border-2 border-orange-100">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                        <Target size={32} className="text-orange-500"/>
                    </div>
                    <h3 className="text-lg font-black text-orange-700 mb-2">Konfigurasi Belum Lengkap</h3>
                    <p className="text-orange-600/80 font-medium text-sm text-center max-w-md px-4">
                        Dasbord analisis terkunci. Silakan pilih <b>ID Tujuan Pembelajaran (TP)</b> pada panel Konfigurasi di atas untuk menampilkan hasil.
                    </p>
                </div>
            ) : loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 size={40} className="text-indigo-600 animate-spin mb-4"/>
                    <p className="text-slate-500 font-bold">Sedang mengambil data dari database...</p>
                </div>
            ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
                    <AlertCircle size={40} className="text-slate-300 mb-2"/>
                    <p className="text-slate-400 font-medium">Belum ada data nilai masuk untuk filter ini.</p>
                </div>
            ) : (
                <div className="w-full bg-slate-200 p-4 md:p-8 rounded-xl border border-slate-300 overflow-auto flex justify-center">
                    {/* A4 Landscape Container Simulation */}
                    <div style={styles.container} className="shadow-2xl text-black shrink-0 box-border p-[10mm] w-[297mm] min-h-[210mm]">
                        
                        {/* 1. Header Title */}
                        <div style={styles.headerTitle}>ANALISIS HASIL ASESMEN {displayJenisUjian.toUpperCase()}</div>
                        <div style={styles.headerSubtitle}>{displaySchool}</div>

                        {/* 2. Identity Meta Data */}
                        <div style={styles.metaContainer}>
                            <table style={styles.metaTable}>
                                <tbody>
                                    <tr><td style={styles.metaTdLabel}>Jenis Ujian</td><td style={styles.metaTdVal}>: {displayJenisUjian}</td></tr>
                                    <tr><td style={styles.metaTdLabel}>Mata Pelajaran</td><td style={styles.metaTdVal}>: {displayMapel}</td></tr>
                                    {isSumatif && (
                                        <tr>
                                            <td style={styles.metaTdLabel}>Tujuan Pembelajaran</td>
                                            <td style={styles.metaTdVal}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                                    <span>:</span>
                                                    <div style={{ maxWidth: '550px', textAlign: 'justify', lineHeight: '1.2' }}>{tpInput || '-'}</div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            <table style={styles.metaTable}>
                                <tbody>
                                    {isSumatif && (
                                        <tr><td style={styles.metaTdLabel}>Materi</td><td style={styles.metaTdVal}>: {materiInput || '-'}</td></tr>
                                    )}
                                    <tr><td style={styles.metaTdLabel}>Kelas / Semester</td><td style={styles.metaTdVal}>: {displayKelas} / {displaySemester}</td></tr>
                                    <tr><td style={styles.metaTdLabel}>Tahun Ajaran</td><td style={styles.metaTdVal}>: {displayTahun}</td></tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 3. Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th style={{ ...styles.th, width: '25px' }} rowSpan={2}>No</th>
                                        <th style={{ ...styles.th, width: '140px' }} rowSpan={2}>Nama Peserta Didik</th>
                                        <th style={{ ...styles.th, width: '35px' }} rowSpan={2}>Nilai</th>
                                        <th style={styles.th} colSpan={questionsData.length}>Analisis Butir Soal</th>
                                        <th style={{ ...styles.th, width: '60px' }} rowSpan={2}>Ketuntasan</th>
                                        <th style={{ ...styles.th, width: '60px' }} rowSpan={2}>Rekomendasi</th>
                                    </tr>
                                    <tr>
                                        {questionsData.map((q, idx) => (
                                            <th key={q.id} style={{ ...styles.th, width: '20px', fontSize: '9pt' }} title={q.text_soal}>{idx + 1}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((d, i) => (
                                        <tr key={i}>
                                            <td style={styles.tdCenter}>{i + 1}</td>
                                            <td style={{ ...styles.td, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{d.nama}</td>
                                            <td style={styles.tdCenter}>{d.score}</td>
                                            {questionsData.map(q => {
                                                const val = d.ansMap[q.id];
                                                const bg = val === 1 ? '#d1fae5' : val === 0 ? '#fee2e2' : '#ffffff';
                                                return (<td key={q.id} style={{ ...styles.tdAns, backgroundColor: bg }}>{val === 1 ? '1' : val === 0 ? '0' : '-'}</td>);
                                            })}
                                            <td style={{ ...styles.tdCenter, fontWeight: 'bold', color: isSumatif ? (d.isTuntas ? 'green' : 'red') : 'black' }}>{d.ketuntasan}</td>
                                            <td style={{ ...styles.tdCenter, color: isSumatif ? (d.isTuntas ? 'blue' : 'orange') : 'black' }}>{d.rekomendasi}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot style={{ backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
                                    <tr>
                                        <td colSpan={3} style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', paddingRight: '10px' }}>Jumlah Benar</td>
                                        {questionsData.map(q => <td key={q.id} style={styles.tdCenter}>{questionStats[q.id].correct}</td>)}
                                        <td colSpan={2} style={{ border: '1px solid #000' }}></td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', paddingRight: '10px' }}>Jumlah Salah</td>
                                        {questionsData.map(q => <td key={q.id} style={{ ...styles.tdCenter, color: 'red' }}>{questionStats[q.id].total - questionStats[q.id].correct}</td>)}
                                        <td colSpan={2} style={{ border: '1px solid #000' }}></td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', paddingRight: '10px' }}>Prosentase Benar</td>
                                        {questionsData.map(q => {
                                            const percent = questionStats[q.id].total > 0 ? Math.round((questionStats[q.id].correct / questionStats[q.id].total) * 100) : 0;
                                            return <td key={q.id} style={styles.tdCenter}>{percent}%</td>
                                        })}
                                        <td colSpan={2} style={{ border: '1px solid #000' }}></td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', paddingRight: '10px' }}>Tingkat Kesukaran</td>
                                        {questionsData.map(q => {
                                            const percent = questionStats[q.id].total > 0 ? Math.round((questionStats[q.id].correct / questionStats[q.id].total) * 100) : 0;
                                            let label = "Sd", color = "blue";
                                            if (percent > 70) { label = "M"; color = "green"; }
                                            else if (percent < 30) { label = "S"; color = "red"; }
                                            return <td key={q.id} style={{ ...styles.tdCenter, color: color }}>{label}</td>
                                        })}
                                        <td colSpan={2} style={{ border: '1px solid #000' }}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* 4. Signature Section */}
                        <div style={styles.footer}>
                            <div style={styles.sigBox}>
                                <p style={{ margin: 0 }}>Mengetahui,</p>
                                <p style={{ margin: 0 }}>{kepSekTitle}</p>
                                <div style={styles.sigSpace}></div>
                                <p style={styles.sigName}>{kepSekName}</p>
                                <p style={styles.sigNip}>NIP. {kepSekNip}</p>
                            </div>
                            <div style={styles.sigBox}>
                                <p style={{ margin: 0 }}>Tuban, {dateNow}</p>
                                <p style={{ margin: 0 }}>{guruJabatan}</p>
                                <div style={styles.sigSpace}></div>
                                <p style={styles.sigName}>{guruName}</p>
                                <p style={styles.sigNip}>NIP. {guruNip}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalisisTab;
