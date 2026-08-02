
import React, { useState, useMemo, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { LayoutDashboard, FileText, Loader2, RefreshCw, Printer, Grid, List, Edit3, Save, Upload, AlertCircle } from 'lucide-react';
import { api } from '../../src/services/api';
import { exportToExcel, formatDurationToText, getSubjects } from '../../utils/adminHelpers';
import { User, ExternalGrade } from '../../types';
import * as XLSX from 'xlsx';

interface RekapTabProps {
    students: any[];
    currentUser: User;
}

const RekapTab = ({ students, currentUser }: RekapTabProps) => {
    const { showToast } = useToast();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [filterSubject, setFilterSubject] = useState('all');
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
    const [globalConfig, setGlobalConfig] = useState<Record<string, string>>({});
    const [examTypes, setExamTypes] = useState<string[]>(['Sumatif 1', 'Sumatif 2', 'Sumatif 3', 'Sumatif 4', 'Sumatif Akhir Semester']);
    const [subjectsDb, setSubjectsDb] = useState<{id: string, label: string}[]>([]);
    
    // Manual Edit State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedCells, setEditedCells] = useState<Record<string, { val: string, changed: boolean }>>({}); 
    // Key: username_columnKey (e.g. "user123_sumatif1")

    // Create a robust map of users for quick lookup (Case Insensitive Key)
    const userMap = useMemo(() => {
        const map: Record<string, any> = {};
        students.forEach(s => {
            if (s.username) {
                map[String(s.username).toLowerCase().trim()] = s;
            }
        });
        return map;
    }, [students]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.getRecap();
            // Sort by timestamp descending (newest first) to prioritize latest scores in Matrix view
            const sorted = res.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setData(sorted);
            const config = await api.getAppConfig();
            setGlobalConfig(config);
            setSubjectsDb(getSubjects(config));
            if (config['EXAM_TYPES']) {
                try {
                    const parsed = JSON.parse(config['EXAM_TYPES']);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setExamTypes(parsed);
                    }
                } catch (e) {
                    console.error("Failed to parse EXAM_TYPES", e);
                }
            }
        } catch (e) {
            console.error("Failed to load recap data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Pre-fill filter for Guru if needed
        if (currentUser.role === 'Guru') {
            if (currentUser.kelas && currentUser.kelas !== '-') {
                setFilterClass(currentUser.kelas);
            }
        }
    }, [currentUser]);

    // Extract Unique Options from Loaded Data & Students (Filtered for Guru)
    const uniqueSchools = useMemo(() => {
        const schools = new Set(data.map(d => d.sekolah).filter(Boolean));
        students.forEach(s => { if(s.school) schools.add(s.school); });
        return Array.from(schools).sort();
    }, [data, students]);

    const uniqueKecamatans = useMemo(() => {
        const kecs = new Set(students.map(s => s.kecamatan).filter(Boolean).filter(k => k !== '-'));
        return Array.from(kecs).sort();
    }, [students]);

    const uniqueClasses = useMemo(() => {
        const classes = new Set(students.map(s => s.kelas).filter(Boolean));
        return Array.from(classes).sort((a: any, b: any) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [students]);

    const uniqueSubjects = useMemo(() => {
        const subjs = new Set(data.map(d => d.exam_id).filter(Boolean));
        return Array.from(subjs).sort();
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(d => {
            // Lookup user details securely
            const usernameKey = String(d.username).toLowerCase().trim();
            const userProfile = userMap[usernameKey];
            
            // Safety check: if user not found in student list, maybe ignore or process partially?
            if (currentUser.role === 'Guru' && !userProfile) return false;

            const userKec = userProfile?.kecamatan || '-';
            const userKelas = userProfile?.kelas || '-';
            
            // GURU SPECIFIC FILTER LOGIC
            if (currentUser.role === 'Guru') {
                const mySchool = (currentUser.kelas_id || '').toLowerCase();
                const studentSchool = (d.sekolah || userProfile?.school || '').toLowerCase();
                
                // 1. Must match School
                if (studentSchool !== mySchool) return false;

                // 2. If Guru has specific class, Must match Class
                if (currentUser.kelas && currentUser.kelas !== '-' && currentUser.kelas !== '') {
                    if (userKelas !== currentUser.kelas) return false;
                }
            }

            // Standard Filters
            const matchSchool = filterSchool === 'all' || (d.sekolah && d.sekolah.toLowerCase() === filterSchool.toLowerCase());
            const matchKecamatan = filterKecamatan === 'all' || (userKec && userKec.toLowerCase() === filterKecamatan.toLowerCase());
            const matchClass = filterClass === 'all' || (userKelas === filterClass);
            
            // For Matrix View, we filter subject differently (substring match for grouping)
            // For List View, we filter strictly
            const matchSubject = viewMode === 'matrix' 
                ? (filterSubject === 'all' || (d.exam_id || '').toLowerCase().includes(filterSubject.toLowerCase()))
                : (filterSubject === 'all' || d.exam_id === filterSubject);

            return matchSchool && matchKecamatan && matchClass && matchSubject;
        });
    }, [data, filterSchool, filterKecamatan, filterClass, filterSubject, userMap, currentUser, viewMode]);

    // MATRIX VIEW LOGIC (LEGER) with MERGING (Auto + Manual + Edits)
    const matrixData = useMemo(() => {
        if (viewMode !== 'matrix' || filterSubject === 'all') return [];

        const studentRows: Record<string, any> = {};

        // 1. Get all eligible students first (even if they haven't taken the exam)
        const eligibleStudents = students.filter(s => {
            if (s.role !== 'siswa') return false;
            // Apply current filters
            if (currentUser.role === 'Guru') {
                const mySchool = (currentUser.kelas_id || '').toLowerCase();
                if ((s.school || '').toLowerCase() !== mySchool) return false;
                if (currentUser.kelas && currentUser.kelas !== '-' && s.kelas !== currentUser.kelas) return false;
            } else {
                if (filterSchool !== 'all' && s.school !== filterSchool) return false;
                if (filterKecamatan !== 'all' && (s.kecamatan || '').toLowerCase() !== filterKecamatan.toLowerCase()) return false;
            }
            if (filterClass !== 'all' && s.kelas !== filterClass) return false;
            return true;
        });

        // 2. Init Rows
        eligibleStudents.forEach(s => {
            const row: any = {
                username: s.username,
                nama: s.fullname,
                kelas: s.kelas,
                avg: 0,
                scoreCount: 0,
                totalScore: 0
            };
            examTypes.forEach(t => {
                row[t] = '-';
            });
            studentRows[s.username] = row;
        });

        // 3. Map Scores (Pivoting Logic)
        // This takes data from the 'rekap' (filteredData) and maps it to columns based on 'exam_type'
        filteredData.forEach(d => {
            const row = studentRows[d.username];
            if (row) {
                const score = parseFloat(d.nilai) || 0;
                
                // LOGIC: Map Exam Type to Column Key
                let colKey = '';
                
                // Fallback to user profile exam type if missing in result (Legacy Support)
                const userProfile = userMap[String(d.username).toLowerCase().trim()];
                const rawExamType = d.exam_type || userProfile?.exam_type || '';
                
                // Direct match first
                if (examTypes.includes(rawExamType)) {
                    colKey = rawExamType;
                } else {
                    // Try case-insensitive match
                    const eType = rawExamType.toLowerCase().trim();
                    const matchedType = examTypes.find(t => t.toLowerCase().trim() === eType);
                    if (matchedType) {
                        colKey = matchedType;
                    } else if (eType) {
                        // Legacy regex matching if no direct match found
                        if (/sumatif\s*1|ph\s*1|lingkup materi\s*1|lm\s*1/.test(eType)) colKey = examTypes.find(t => t.toLowerCase().includes('sumatif 1')) || '';
                        else if (/sumatif\s*2|ph\s*2|lingkup materi\s*2|lm\s*2/.test(eType)) colKey = examTypes.find(t => t.toLowerCase().includes('sumatif 2')) || '';
                        else if (/sumatif\s*3|ph\s*3|lingkup materi\s*3|lm\s*3|sts|pts|tengah semester/.test(eType)) colKey = examTypes.find(t => t.toLowerCase().includes('sumatif 3')) || '';
                        else if (/sumatif\s*4|ph\s*4|lingkup materi\s*4|lm\s*4/.test(eType)) colKey = examTypes.find(t => t.toLowerCase().includes('sumatif 4')) || '';
                        else if (/sas|pas|uas|akhir semester|sumatif akhir/.test(eType)) colKey = examTypes.find(t => t.toLowerCase().includes('akhir')) || '';
                    }
                }
                
                // Fallback: Jika Exam Type kosong, coba gunakan Nama Mapel (Legacy support)
                if (!colKey && !rawExamType) {
                    const mapelLower = (d.mapel || '').toLowerCase();
                    if (mapelLower.includes('sumatif 1')) colKey = examTypes.find(t => t.toLowerCase().includes('sumatif 1')) || '';
                    else if (mapelLower.includes('sumatif 2')) colKey = examTypes.find(t => t.toLowerCase().includes('sumatif 2')) || '';
                    else if (mapelLower.includes('sumatif 3')) colKey = examTypes.find(t => t.toLowerCase().includes('sumatif 3')) || '';
                    else if (mapelLower.includes('sumatif 4')) colKey = examTypes.find(t => t.toLowerCase().includes('sumatif 4')) || '';
                    else if (mapelLower.includes('akhir') || mapelLower.includes('sas')) colKey = examTypes.find(t => t.toLowerCase().includes('akhir')) || '';
                }
                
                // Override score if colKey determined
                if (colKey && examTypes.includes(colKey)) {
                    // Check if there is an edit in progress
                    const editKey = `${d.username}_${colKey}`;
                    if (editedCells[editKey]) {
                        row[colKey] = editedCells[editKey].val;
                    } else {
                        // Priority to latest data. Data is sorted newest first.
                        // Only set if not already set (meaning we found the most recent one first).
                        if (row[colKey] === '-') {
                            row[colKey] = score;
                        }
                    }
                }
            }
        });

        // 4. Calculate Final Average based on populated columns
        Object.values(studentRows).forEach((row: any) => {
            let sum = 0;
            let count = 0;
            examTypes.forEach(k => {
                const val = parseFloat(row[k]);
                if (!isNaN(val)) {
                    sum += val;
                    count++;
                }
            });
            row.avg = count > 0 ? (sum / count).toFixed(2) : 0;
        });

        return Object.values(studentRows).sort((a: any, b: any) => a.nama.localeCompare(b.nama));

    }, [filteredData, students, viewMode, filterSubject, filterClass, filterSchool, filterKecamatan, currentUser, editedCells, userMap, examTypes]);

    // Handle Manual Input Change
    const handleCellChange = (username: string, field: string, value: string) => {
        setEditedCells(prev => ({
            ...prev,
            [`${username}_${field}`]: { val: value, changed: true }
        }));
    };

    // Save Manual Edits
    const saveManualEdits = async () => {
        const changes: ExternalGrade[] = [];
        Object.keys(editedCells).forEach(key => {
            const [username, ...fieldParts] = key.split('_');
            const field = fieldParts.join('_'); // Rejoin in case examType has underscores
            const val = parseFloat(editedCells[key].val);
            if (!isNaN(val)) {
                changes.push({
                    username,
                    mapel: filterSubject, // Must filter by specific subject to edit
                    exam_type: field,
                    nilai: val
                });
            }
        });

        if (changes.length === 0) return setIsEditMode(false);

        setIsSaving(true);
        try {
            await api.saveExternalGrades(changes);
            showToast("Nilai berhasil disimpan.", "success");
            setEditedCells({});
            setIsEditMode(false);
            fetchData();
        } catch (e) {
            console.error(e);
            showToast("Gagal menyimpan nilai.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
                
                const parsedGrades: ExternalGrade[] = [];
                // Expect Header Row: Username, Mapel, Jenis Ujian, Nilai
                for (let i = 1; i < rawData.length; i++) {
                    const row: any = rawData[i];
                    if (!row[0]) continue;
                    
                    parsedGrades.push({
                        username: String(row[0]),
                        mapel: String(row[1]),
                        exam_type: String(row[2]),
                        nilai: parseFloat(row[3]) || 0
                    });
                }

                if (parsedGrades.length > 0) {
                    setLoading(true);
                    await api.saveExternalGrades(parsedGrades);
                    showToast(`Berhasil mengimpor ${parsedGrades.length} nilai.`, "success");
                    fetchData();
                } else {
                    showToast("Data kosong.", "info");
                }
            } catch (err) {
                console.error(err);
                showToast("Gagal membaca file Excel.", "error");
            } finally {
                if (e.target) e.target.value = '';
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const downloadImportTemplate = () => {
        const rows = [
            { "Username": "user01", "Mapel": "Matematika", "Jenis Ujian": examTypes[0] || "Sumatif 1", "Nilai": 90 },
            { "Username": "user01", "Mapel": "Matematika", "Jenis Ujian": examTypes[1] || "Sumatif Akhir Semester", "Nilai": 85 }
        ];
        exportToExcel(rows, "Template_Import_Nilai", "Template");
    };

    const handleExport = () => {
        if (viewMode === 'matrix') {
            const exportData = matrixData.map((d, i) => {
                const row: any = {
                    "No": i + 1,
                    "Username": d.username,
                    "Nama Murid": d.nama
                };
                examTypes.forEach(t => {
                    row[t] = d[t];
                });
                row["Nilai Akhir"] = d.avg;
                return row;
            });
            exportToExcel(exportData, `Rekap_Nilai_Sumatif_${filterSubject || 'Semua'}`);
        } else {
            const exportData = filteredData.map((d, i) => {
                const usernameKey = String(d.username).toLowerCase().trim();
                const userProfile = userMap[usernameKey];
                return {
                    "No": i + 1,
                    "Waktu Submit": new Date(d.timestamp).toLocaleString('id-ID'),
                    "Username": d.username,
                    "Nama Peserta": d.nama,
                    "Kelas": userProfile?.kelas || '-',
                    "Sekolah": d.sekolah,
                    "Kecamatan": userProfile?.kecamatan || '-',
                    "Mata Pelajaran": d.mapel,
                    // Export uses Fallback logic
                    "Jenis Ujian": d.exam_type || userProfile?.exam_type || '-',
                    "Nilai Akhir": parseFloat(d.nilai) || 0,
                    "Durasi": formatDurationToText(d.durasi)
                };
            });
            exportToExcel(exportData, `Rekap_Nilai_${filterSubject === 'all' ? 'Semua' : filterSubject}`);
        }
    };

    const handlePrintMatrix = () => {
        if (matrixData.length === 0) return showToast("Tidak ada data untuk dicetak.", "info");
        
        const displayMapel = filterSubject === 'all' ? 'Semua Mata Pelajaran' : filterSubject;
        const displayKelas = filterClass === 'all' ? 'Semua Kelas' : filterClass;
        const displayTahun = globalConfig['ACADEMIC_YEAR'] || '2025/2026';
        const displaySchool = globalConfig['SCHOOL_NAME'] || (currentUser.kelas_id || '...........................');
        
        // Determine the dominant exam type for this view to pick the right signature
        // If they are viewing all, we just pick the first one or a default
        let dominantExamType = examTypes[0] || 'Sumatif 1';
        
        // Signature Variables
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
                if (signatories[dominantExamType]) {
                    const sig = signatories[dominantExamType];
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

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const rowsHtml = matrixData.map((d, i) => `
            <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td style="font-family: monospace;">${d.username}</td>
                <td>${d.nama}</td>
                ${examTypes.map(t => `<td style="text-align: center;">${d[t]}</td>`).join('')}
                <td style="text-align: center; font-weight: bold;">${d.avg}</td>
            </tr>
        `).join('');

        const headersHtml = examTypes.map(t => `<th width="70">${t}</th>`).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Rekap Nilai Sumatif</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm; }
                    body { font-family: Arial, sans-serif; font-size: 10pt; }
                    .header { text-align: center; margin-bottom: 20px; font-weight: bold; text-transform: uppercase; }
                    .meta { margin-bottom: 15px; width: 100%; }
                    .meta td { padding: 2px 10px 2px 0; }
                    table.data { width: 100%; border-collapse: collapse; }
                    table.data th, table.data td { border: 1px solid #000; padding: 5px; }
                    table.data th { background-color: #f0f0f0; text-align: center; }
                    .footer { margin-top: 40px; display: flex; justify-content: space-between; padding: 0 50px; page-break-inside: avoid; }
                    .signature-box { text-align: center; width: 250px; }
                    .signature-space { height: 80px; }
                    .sig-name { font-weight: bold; text-decoration: underline; margin-bottom: 2px; }
                    .sig-nip { margin-top: 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2 style="margin: 0; font-size: 16pt;">Rekap Nilai Sumatif</h2>
                    <h3 style="margin: 5px 0 0; font-size: 12pt;">${displaySchool}</h3>
                </div>
                <table class="meta">
                    <tr><td width="150">Mata Pelajaran</td><td>: ${displayMapel}</td></tr>
                    <tr><td>Kelas</td><td>: ${displayKelas}</td></tr>
                    <tr><td>Tahun Ajaran</td><td>: ${displayTahun}</td></tr>
                </table>
                <table class="data">
                    <thead>
                        <tr>
                            <th width="40">No</th>
                            <th>Username</th>
                            <th>Nama Murid</th>
                            ${headersHtml}
                            <th width="80">Nilai Akhir</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
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
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const isGuruClassLocked = currentUser.role === 'Guru' && currentUser.kelas && currentUser.kelas !== '-';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h3 className="font-bold text-lg flex items-center gap-2"><LayoutDashboard size={20}/> Rekapitulasi Nilai</h3>
                    <p className="text-xs text-slate-400">Data nilai tersinkronisasi dari Database Hasil Ujian.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto flex-wrap items-center">
                     
                     {/* View Toggle */}
                     <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-md flex items-center gap-2 text-xs font-bold transition ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            <List size={16}/> Tabel
                        </button>
                        <button onClick={() => setViewMode('matrix')} className={`p-2 rounded-md flex items-center gap-2 text-xs font-bold transition ${viewMode === 'matrix' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            <Grid size={16}/> Leger
                        </button>
                     </div>

                     <button onClick={fetchData} className="p-2.5 rounded-lg bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition" title="Refresh Data">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                     </button>
                     
                     {/* SUBJECT FILTER */}
                     {viewMode === 'matrix' ? (
                         <select
                            className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 min-w-[200px] cursor-pointer"
                            value={filterSubject}
                            onChange={e => setFilterSubject(e.target.value)}
                         >
                            <option value="all">-- Pilih Mata Pelajaran --</option>
                            {subjectsDb.map((s) => (
                                <option key={s.id} value={s.label}>{s.label}</option>
                            ))}
                         </select>
                     ) : (
                         <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                            <option value="all">Semua Mata Pelajaran</option>
                            {uniqueSubjects.map((s:any) => <option key={s} value={s}>{s}</option>)}
                         </select>
                     )}
                     
                     {!isGuruClassLocked && (
                         <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                            <option value="all">Semua Kelas</option>
                            {uniqueClasses.map((s:any) => <option key={s} value={s}>Kelas {s}</option>)}
                         </select>
                     )}

                     {currentUser.role !== 'Guru' && (
                         <>
                         <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer" value={filterKecamatan} onChange={e => setFilterKecamatan(e.target.value)}>
                            <option value="all">Semua Kecamatan</option>
                            {uniqueKecamatans.map((s:any) => <option key={s} value={s}>{s}</option>)}
                         </select>
                         <select 
                            className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer max-w-[150px]" 
                            value={filterSchool} 
                            onChange={e => {
                                const val = e.target.value;
                                setFilterSchool(val);
                                if (val !== 'all') {
                                    // Find student from that school to get Kecamatan
                                    const found = students.find((s:any) => s.school === val);
                                    if (found && found.kecamatan) setFilterKecamatan(found.kecamatan);
                                }
                            }}
                         >
                            <option value="all">Semua Sekolah</option>
                            {uniqueSchools.map((s:any) => <option key={s} value={s}>{s}</option>)}
                         </select>
                         </>
                     )}
                     
                     {/* MATRIX ACTION BUTTONS */}
                     {viewMode === 'matrix' && matrixData.length > 0 && (
                         <>
                            <button onClick={handlePrintMatrix} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition shadow-lg active:scale-95">
                                <Printer size={16}/> Cetak
                            </button>
                            <button onClick={() => isEditMode ? saveManualEdits() : setIsEditMode(true)} disabled={isSaving} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg active:scale-95 ${isEditMode ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                                {isSaving ? <Loader2 size={16} className="animate-spin"/> : isEditMode ? <Save size={16}/> : <Edit3 size={16}/>}
                                {isEditMode ? 'Simpan Edit' : 'Edit Manual'}
                            </button>
                         </>
                     )}

                     {/* IMPORT BUTTON */}
                     <div className="relative group">
                        <label className="bg-white text-emerald-600 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-50 transition cursor-pointer shadow-sm active:scale-95">
                            <Upload size={16}/> Import Nilai
                            <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} />
                        </label>
                        <div className="absolute right-0 top-full mt-2 hidden group-hover:block z-20">
                            <button onClick={downloadImportTemplate} className="bg-slate-800 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap">Download Template</button>
                        </div>
                     </div>

                     <button onClick={handleExport} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 active:scale-95">
                        <FileText size={16}/> Export Excel
                     </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Loader2 className="animate-spin mb-2" size={32}/> 
                        <span className="font-bold">Mengolah Data...</span>
                    </div>
                ) : viewMode === 'matrix' ? (
                    /* MATRIX VIEW TABLE */
                    filterSubject === 'all' ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Grid className="mb-2 opacity-20" size={48}/>
                            <span className="font-bold">Silakan Pilih Mata Pelajaran pada menu dropdown untuk melihat Leger.</span>
                        </div>
                    ) : (
                        <div>
                            {isEditMode && <div className="bg-amber-50 p-2 text-center text-xs font-bold text-amber-700 border-b border-amber-200">Mode Edit Aktif - Silakan ubah nilai dan klik Simpan.</div>}
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-slate-50 font-bold text-slate-600 uppercase text-xs sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-4 w-12 text-center border-b border-slate-200">No</th>
                                        <th className="p-4 border-b border-slate-200">Username</th>
                                        <th className="p-4 border-b border-slate-200">Nama Murid</th>
                                        {examTypes.map((t, idx) => (
                                            <th key={idx} className={`p-4 text-center border-b border-slate-200 ${idx % 2 === 0 ? 'bg-indigo-50/30' : 'bg-purple-50/30'}`}>{t}</th>
                                        ))}
                                        <th className="p-4 text-center border-b border-slate-200 bg-emerald-50/30 font-black">Nilai Akhir</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {matrixData.length === 0 ? (
                                        <tr><td colSpan={4 + examTypes.length} className="p-12 text-center text-slate-400 italic">Data tidak ditemukan untuk mapel "{filterSubject}".</td></tr>
                                    ) : matrixData.map((d: any, i: number) => {
                                        const renderCell = (field: string, val: any) => {
                                            const key = `${d.username}_${field}`;
                                            const displayVal = editedCells[key]?.changed ? editedCells[key].val : val;
                                            
                                            if (isEditMode) {
                                                return (
                                                    <input 
                                                        type="number" 
                                                        className="w-16 p-1 text-center border rounded border-slate-300 focus:border-indigo-500 outline-none bg-white text-sm font-bold"
                                                        value={displayVal === '-' ? '' : displayVal}
                                                        onChange={(e) => handleCellChange(d.username, field, e.target.value)}
                                                        placeholder="-"
                                                    />
                                                );
                                            }
                                            return displayVal;
                                        };

                                        return (
                                        <tr key={i} className="hover:bg-slate-50 transition group">
                                            <td className="p-4 text-center text-slate-500">{i + 1}</td>
                                            <td className="p-4 font-mono text-slate-500 font-bold text-xs">{d.username}</td>
                                            <td className="p-4 font-bold text-slate-700">{d.nama}</td>
                                            {examTypes.map((t, idx) => (
                                                <td key={idx} className="p-4 text-center text-slate-600">{renderCell(t, d[t])}</td>
                                            ))}
                                            <td className="p-4 text-center font-black text-emerald-600 bg-emerald-50/10">{d.avg}</td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    /* LIST VIEW TABLE (Existing) */
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50 font-bold text-slate-600 uppercase text-xs sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 text-center border-b border-slate-200">No</th>
                                <th className="p-4 border-b border-slate-200">Waktu Submit</th>
                                <th className="p-4 border-b border-slate-200">Username</th>
                                <th className="p-4 border-b border-slate-200">Nama Peserta</th>
                                <th className="p-4 text-center border-b border-slate-200">Jenis Ujian</th>
                                <th className="p-4 border-b border-slate-200">Sekolah</th>
                                <th className="p-4 border-b border-slate-200">Kecamatan</th>
                                <th className="p-4 text-center bg-indigo-50/50 border-b border-l border-slate-200">Mata Pelajaran</th>
                                <th className="p-4 text-center border-b border-l border-slate-200 bg-emerald-50/50">Nilai Akhir</th>
                                <th className="p-4 text-center border-b border-slate-200">Durasi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.length === 0 ? (
                                <tr><td colSpan={10} className="p-12 text-center text-slate-400 italic">Data tidak ditemukan untuk filter ini.</td></tr>
                            ) : (
                                filteredData.map((d, i) => {
                                    const usernameKey = String(d.username).toLowerCase().trim();
                                    const userProfile = userMap[usernameKey];
                                    const userKec = userProfile?.kecamatan || '-';
                                    
                                    // Use User Profile's Exam Type as fallback if Result's exam type is missing (legacy data)
                                    const displayExamType = d.exam_type || userProfile?.exam_type || '-';

                                    return (
                                    <tr key={i} className="hover:bg-slate-50 transition group">
                                        <td className="p-4 text-center text-slate-500">{i + 1}</td>
                                        <td className="p-4 text-xs text-slate-500 font-mono">
                                            {new Date(d.timestamp).toLocaleDateString('id-ID')} <br/>
                                            <span className="text-[10px] opacity-70">{new Date(d.timestamp).toLocaleTimeString('id-ID')}</span>
                                        </td>
                                        <td className="p-4 font-mono text-slate-600 font-bold text-xs">{d.username}</td>
                                        <td className="p-4 font-bold text-slate-700">{d.nama}</td>
                                        <td className="p-4 text-center border-l border-slate-100 bg-blue-50/10 text-xs text-slate-600 font-medium">
                                            {displayExamType}
                                        </td>
                                        <td className="p-4 text-slate-600 text-xs">{d.sekolah}</td>
                                        <td className="p-4 text-slate-600 text-xs">{userKec}</td>
                                        <td className="p-4 text-center border-l border-slate-100 bg-indigo-50/10 font-bold text-indigo-700 text-xs">
                                            {d.exam_id}
                                        </td>
                                        <td className="p-4 text-center border-l border-slate-100 bg-emerald-50/10">
                                            <span className="text-lg font-black text-emerald-600">{d.nilai}</span>
                                        </td>
                                        <td className="p-4 text-center text-xs text-slate-500 font-mono">
                                            {formatDurationToText(d.durasi)}
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-2">
                <span>{viewMode === 'matrix' ? `Menampilkan ${matrixData.length} siswa` : `Total Data: ${filteredData.length} record`}</span>
                <span className="text-right">Database Hasil Ujian (Realtime) & Import</span>
            </div>
        </div>
    );
};

export default RekapTab;
