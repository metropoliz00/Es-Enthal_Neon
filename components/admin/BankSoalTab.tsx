
import React, { useState, useEffect, useMemo } from 'react';
import { FileQuestion, Download, Upload, Loader2, Plus, Edit, Trash2, X, Save, Image as ImageIcon, CheckCircle2, ChevronDown, ChevronUp, Target, Layout, Type, FileSpreadsheet } from 'lucide-react';
import { api } from '../../src/services/api';
import { QuestionRow, LearningObjective } from '../../types';
import * as XLSX from 'xlsx';
import { exportToExcel, getSubjects, getExamTypes, getExamSubjectMapping } from '../../utils/adminHelpers';
import { useToast } from '../../context/ToastContext';
import ConfirmationModal from '../ui/ConfirmationModal';

const BankSoalTab = () => {
    const { showToast } = useToast();
    const [subjectsDb, setSubjectsDb] = useState<{id: string, label: string}[]>([]);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [examTypes, setExamTypes] = useState<{id: string, label: string}[]>([]); // Store Exam Types
    const [examSubjectMapping, setExamSubjectMapping] = useState<{examTypeId: string, subjectIds: string[]}[]>([]); // Store Mapping
    const [selectedSubject, setSelectedSubject] = useState('');
    const [questions, setQuestions] = useState<QuestionRow[]>([]);
    const [tps, setTps] = useState<LearningObjective[]>([]); // Store all TPs
    const [savingCardId, setSavingCardId] = useState<string | null>(null);
    const [loadingData, setLoadingData] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [isModalSaved, setIsModalSaved] = useState(false);
    const [currentQ, setCurrentQ] = useState<QuestionRow | null>(null);
    const [importing, setImporting] = useState(false);
    
    // Filters
    const [filterKelas, setFilterKelas] = useState('all');
    const [filterTp, setFilterTp] = useState('all');
    const [filterJenisUjian, setFilterJenisUjian] = useState('all'); // New Filter

    useEffect(() => {
        const loadInitial = async () => {
            const config = await api.getAppConfig();
            const subjects = getSubjects(config);
            const types = getExamTypes(config);
            const mapping = getExamSubjectMapping(config);
            setSubjectsDb(subjects);
            setExamTypes(types);
            setExamSubjectMapping(mapping);
            if (subjects.length > 0) {
                setSelectedSubject(subjects[0].label);
            }

            // Load TPs for linking
            const tpData = await api.getLearningObjectives();
            setTps(tpData);
        };
        loadInitial();
    }, []);

    // Derived Subjects based on Exam Type Filter
    const availableSubjects = useMemo(() => {
        if (filterJenisUjian === 'all') return subjectsDb;
        const mapping = examSubjectMapping.find(m => m.examTypeId === filterJenisUjian);
        if (!mapping) return subjectsDb;
        return subjectsDb.filter(s => mapping.subjectIds.includes(s.id));
    }, [subjectsDb, filterJenisUjian, examSubjectMapping]);

    // Auto-select first subject if current selection is invalid for the new filter
    useEffect(() => {
        if (availableSubjects.length > 0) {
            const exists = availableSubjects.find(s => s.label === selectedSubject);
            if (!exists) {
                setSelectedSubject(availableSubjects[0].label);
            }
        } else if (availableSubjects.length === 0 && selectedSubject) {
             setSelectedSubject('');
        }
    }, [availableSubjects, selectedSubject]);

    useEffect(() => {
        if (!selectedSubject) return;
        const loadQ = async () => {
            setLoadingData(true);
            try {
                const data = await api.getRawQuestions(selectedSubject);
                setQuestions(data);
            } catch(e) { console.error(e); }
            finally { setLoadingData(false); }
        };
        loadQ();
    }, [selectedSubject]);

    // Reset TP filter when Subject or Class filter changes
    useEffect(() => {
        setFilterTp('all');
    }, [selectedSubject, filterKelas, filterJenisUjian]);

    // Filtered & Sorted Questions List
    const filteredQuestions = useMemo(() => {
        let res = questions;
        
        // Filter Kelas
        if (filterKelas !== 'all') {
            res = res.filter(q => q.kelas === filterKelas);
        }

        // Filter TP
        if (filterTp !== 'all') {
            res = res.filter(q => q.tp_id === filterTp);
        }

        // Filter Jenis Ujian
        if (filterJenisUjian !== 'all') {
            if (filterJenisUjian === 'SUMATIF') {
                res = res.filter(q => (q.jenis_ujian || '').toUpperCase().includes('SUMATIF'));
            } else {
                res = res.filter(q => q.jenis_ujian === filterJenisUjian);
            }
        }

        // Default ID Sort (Numeric aware for Q1, Q2, Q10)
        return [...res].sort((a, b) => {
            return a.id.localeCompare(b.id, undefined, { numeric: true });
        });
    }, [questions, filterKelas, filterTp, filterJenisUjian]);

    // Available Classes derived from questions
    const uniqueClasses = useMemo(() => {
        const classes = new Set(questions.map(q => q.kelas).filter(Boolean));
        return Array.from(classes).sort();
    }, [questions]);

    // Available TPs for the selected Subject (Main Filter)
    const tpsForFilter = useMemo(() => {
        if (!selectedSubject) return [];
        let filtered = tps.filter(t => t.mapel === selectedSubject);
        if (filterKelas !== 'all') {
            filtered = filtered.filter(t => t.kelas === filterKelas);
        }
        return filtered;
    }, [tps, selectedSubject, filterKelas]);

    // Available TPs for the selected Subject (and selected Class in Modal)
    const availableTps = useMemo(() => {
        if (!currentQ || !selectedSubject) return [];
        let filtered = tps.filter(t => t.mapel === selectedSubject);
        if (currentQ.kelas) {
            filtered = filtered.filter(t => t.kelas === currentQ.kelas);
        }
        return filtered;
    }, [tps, selectedSubject, currentQ?.kelas]);

    const getNextQuestionId = (qList: QuestionRow[]) => {
        if (!qList || qList.length === 0) return 'Q1';
        let maxNum = 0;
        qList.forEach(q => {
            if (!q.id) return;
            const match = q.id.match(/\d+/);
            if (match) {
                const num = parseInt(match[0], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        const nextNum = maxNum > 0 ? maxNum + 1 : qList.length + 1;
        return `Q${nextNum}`;
    };

    const handleEdit = (q: QuestionRow) => {
        setIsModalSaved(false);
        setCurrentQ({
            ...q,
            mapel: q.mapel || selectedSubject
        });
        setModalOpen(true);
    };

    const handleAddNew = () => {
        setIsModalSaved(false);
        setCurrentQ({
            id: getNextQuestionId(questions),
            text_soal: '',
            tipe_soal: 'PG',
            gambar: '',
            caption: '', // Init Caption
            opsi_a: '',
            opsi_b: '',
            opsi_c: '',
            opsi_d: '',
            kunci_jawaban: '',
            bobot: 10,
            kelas: filterKelas !== 'all' ? filterKelas : '',
            tp_id: '',
            jenis_ujian: filterJenisUjian !== 'all' ? filterJenisUjian : '', // Init Jenis Ujian
            kode_paket: '', // Init Kode Paket
            mapel: selectedSubject || (subjectsDb[0]?.label || 'Pengetahuan Umum')
        });
        setModalOpen(true);
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDeleteQuestion = async () => {
        if (!deleteConfirmId) return;
        setLoadingData(true);
        try {
            const res = await api.deleteQuestion(selectedSubject, deleteConfirmId);
            if (res.success) {
                showToast("Soal berhasil dihapus!", "success");
            } else {
                showToast(`Gagal menghapus dari database: ${res.message || 'Error'}`, "warning");
            }
        } catch (err: any) {
            showToast(`Gagal menghapus: ${err.message || 'Error'}`, "error");
        } finally {
            setQuestions(prev => prev.filter(q => q.id !== deleteConfirmId));
            setLoadingData(false);
            setDeleteConfirmId(null);
        }
    };

    const handleSaveSingleCard = async (q: QuestionRow) => {
        setSavingCardId(q.id);
        try {
            const finalQ = { ...q, kunci_jawaban: (q.kunci_jawaban || '').toUpperCase() };
            const res = await api.saveQuestion(selectedSubject, finalQ);
            if (res.success) {
                showToast(`Soal (${q.id}) berhasil disimpan ke database!`, "success");
            } else {
                showToast(`Gagal menyimpan soal (${q.id}): ${res.message}`, "error");
            }
        } catch (err: any) {
            showToast(`Gagal menyimpan: ${err.message || 'Error'}`, "error");
        } finally {
            setSavingCardId(null);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentQ) return;

        // If form is already saved, clicking the button triggers "Tambah Soal Baru"
        if (isModalSaved) {
            setCurrentQ({
                id: getNextQuestionId(questions),
                text_soal: '',
                tipe_soal: 'PG',
                gambar: '',
                caption: '',
                opsi_a: '',
                opsi_b: '',
                opsi_c: '',
                opsi_d: '',
                kunci_jawaban: 'A',
                bobot: 10,
                kelas: filterKelas !== 'all' ? filterKelas : '',
                tp_id: '',
                jenis_ujian: filterJenisUjian !== 'all' ? filterJenisUjian : '',
                kode_paket: '',
                mapel: selectedSubject || (subjectsDb[0]?.label || 'Pengetahuan Umum')
            });
            setIsModalSaved(false);
            showToast("Form dibersihkan. Siap untuk input soal baru!", "info");
            return;
        }

        setLoadingData(true);
        const finalQ = { ...currentQ, kunci_jawaban: (currentQ.kunci_jawaban || '').toUpperCase() };
        const targetMapel = currentQ.mapel || selectedSubject;
        const res = await api.saveQuestion(targetMapel, finalQ);
        if (res.success) {
            showToast("Soal berhasil disimpan ke database!", "success");
            setIsModalSaved(true);
        } else {
            showToast(`Gagal menyimpan soal: ${res.message}`, "error");
        }
        const data = await api.getRawQuestions(selectedSubject);
        setQuestions(data);
        setLoadingData(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setImporting(true);
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsName = wb.SheetNames[0];
                const ws = wb.Sheets[wsName];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
                
                if (data.length < 2) {
                     showToast("File kosong atau format salah.", "error");
                     setImporting(false);
                     return;
                }

                const headers = (data[0] as string[]).map(h => String(h || "").trim());
                const findHeader = (...names: string[]) => {
                    for (const name of names) {
                        const idx = headers.findIndex(h => {
                            const lowerH = h.toLowerCase();
                            const lowerN = name.toLowerCase();
                            return lowerH === lowerN || lowerH.includes(lowerN);
                        });
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };

                const idxId = findHeader("ID Soal", "ID", "No Soal", "Nomor Soal", "No.", "No");
                const idxText = findHeader("Teks Soal", "Pertanyaan / Soal", "Pertanyaan", "Teks", "Soal");
                const idxTipe = findHeader("Tipe Soal (PG/PGK/BS)", "Tipe Soal", "Tipe", "Jenis Soal");
                const idxGambar = findHeader("Link Gambar / Teks Deskripsi", "Link Gambar", "Gambar", "Foto", "Url Gambar");
                const idxCaption = findHeader("Keterangan Gambar / Teks Deskripsi", "Caption (Keterangan Gambar)", "Caption", "Keterangan Gambar", "Keterangan", "Deskripsi Gambar", "Deskripsi");
                const idxOpsiA = findHeader("Opsi A", "Pilihan A", "A");
                const idxOpsiB = findHeader("Opsi B", "Pilihan B", "B");
                const idxOpsiC = findHeader("Opsi C", "Pilihan C", "C");
                const idxOpsiD = findHeader("Opsi D", "Pilihan D", "D");
                const idxKunci = findHeader("Kunci Jawaban", "Kunci", "Jawaban Benar", "Jawaban");
                const idxBobot = findHeader("Bobot", "Poin", "Nilai");
                const idxKelas = findHeader("Kelas");
                const idxTp = findHeader("ID TP", "TP", "Tujuan Pembelajaran");
                const idxJenis = findHeader("Jenis Ujian", "Ujian", "Kategori Ujian");
                const idxPaket = findHeader("Kode Paket Soal", "Kode Paket", "Paket");
                const idxMapel = findHeader("Kategori Mapel", "Mapel", "Mata Pelajaran", "Kategori");

                const useHeaders = idxText !== -1 || idxId !== -1;

                const parsedQuestions: QuestionRow[] = [];
                for (let i = 1; i < data.length; i++) {
                    const row: any = data[i];
                    if (!row || row.length === 0) continue;
                    
                    if (useHeaders) {
                        const val = (idx: number) => (idx !== -1 && row[idx] !== undefined) ? String(row[idx]).trim() : "";
                        
                        const textSoal = val(idxText);
                        const rowId = val(idxId) || `Q${i}`;
                        
                        if (!textSoal && !val(idxOpsiA)) continue;

                        const jenisUjian = val(idxJenis).toUpperCase();
                        
                        parsedQuestions.push({
                            id: rowId,
                            text_soal: textSoal || "Soal " + i,
                            tipe_soal: (val(idxTipe).toUpperCase() as any) || "PG",
                            gambar: val(idxGambar),
                            opsi_a: val(idxOpsiA),
                            opsi_b: val(idxOpsiB),
                            opsi_c: val(idxOpsiC),
                            opsi_d: val(idxOpsiD),
                            kunci_jawaban: val(idxKunci).toUpperCase(),
                            bobot: Number(val(idxBobot)) || 10,
                            kelas: val(idxKelas),
                            tp_id: jenisUjian.includes('SUMATIF') ? val(idxTp) : "",
                            caption: val(idxCaption),
                            jenis_ujian: jenisUjian,
                            kode_paket: val(idxPaket),
                            mapel: val(idxMapel) || selectedSubject
                        });
                    } else {
                        if (!row[0] && !row[1]) continue;
                        // Check if row[9] or row[8] looks like kunci_jawaban to determine positional offset
                        const isNewFormat = String(row[9] || "").length === 1 && "ABCD".includes(String(row[9] || "").toUpperCase());
                        if (isNewFormat) {
                            parsedQuestions.push({
                                id: String(row[0] || `Q${i}`),
                                gambar: String(row[1] || ""),
                                caption: String(row[2] || ""), 
                                text_soal: String(row[3] || `Soal ${i}`),
                                tipe_soal: (String(row[4] || "PG").toUpperCase() as any),
                                opsi_a: String(row[5] || ""),
                                opsi_b: String(row[6] || ""),
                                opsi_c: String(row[7] || ""),
                                opsi_d: String(row[8] || ""),
                                kunci_jawaban: String(row[9] || "").toUpperCase(),
                                bobot: Number(row[10] || 10),
                                kelas: String(row[11] || ""),
                                tp_id: String(row[13] || "").toUpperCase().includes('SUMATIF') ? String(row[12] || "") : "",
                                jenis_ujian: String(row[13] || "").toUpperCase(), 
                                kode_paket: String(row[14] || ""),
                                mapel: String(row[15] || selectedSubject)
                            });
                        } else {
                            parsedQuestions.push({
                                id: String(row[0] || `Q${i}`),
                                text_soal: String(row[1] || `Soal ${i}`),
                                tipe_soal: (String(row[2] || "PG").toUpperCase() as any),
                                gambar: String(row[3] || ""),
                                opsi_a: String(row[4] || ""),
                                opsi_b: String(row[5] || ""),
                                opsi_c: String(row[6] || ""),
                                opsi_d: String(row[7] || ""),
                                kunci_jawaban: String(row[8] || "").toUpperCase(),
                                bobot: Number(row[9] || 10),
                                kelas: String(row[10] || ""),
                                tp_id: String(row[13] || "").toUpperCase().includes('SUMATIF') ? String(row[11] || "") : "",
                                caption: String(row[12] || ""), 
                                jenis_ujian: String(row[13] || "").toUpperCase(), 
                                kode_paket: String(row[14] || ""),
                                mapel: String(row[15] || selectedSubject)
                            });
                        }
                    }
                }

                // --- VALIDASI STRUKTUR & JENIS UJIAN BERDASARKAN FILTER JENIS UJIAN ---
                if (filterJenisUjian !== 'all') {
                    const targetJenis = filterJenisUjian.toUpperCase();
                    const isTargetSumatif = targetJenis.includes('SUMATIF');

                    // 1. Cek struktur khusus SUMATIF (wajib ada kolom 'ID TP' jika menggunakan header)
                    if (isTargetSumatif && useHeaders && idxTp === -1) {
                        showToast("Gagal Upload: Struktur file tidak sesuai untuk Jenis Ujian SUMATIF (kolom 'ID TP' tidak ditemukan).", "error");
                        setImporting(false);
                        return;
                    }

                    // 2. Cek kesesuaian jenis_ujian di dalam baris file dengan filter yang dipilih
                    const invalidTypesSet = new Set<string>();
                    for (const q of parsedQuestions) {
                        if (q.jenis_ujian && q.jenis_ujian.trim() !== '') {
                            const rowJenis = q.jenis_ujian.trim().toUpperCase();
                            if (isTargetSumatif) {
                                if (!rowJenis.includes('SUMATIF')) {
                                    invalidTypesSet.add(rowJenis);
                                }
                            } else {
                                if (rowJenis !== targetJenis) {
                                    invalidTypesSet.add(rowJenis);
                                }
                            }
                        }
                    }

                    if (invalidTypesSet.size > 0) {
                        const invalidList = Array.from(invalidTypesSet).join(', ');
                        showToast(`Gagal Upload: Jenis Ujian pada file (${invalidList}) tidak sesuai dengan Jenis Ujian yang dipilih (${filterJenisUjian}).`, "error");
                        setImporting(false);
                        return;
                    }

                    // Auto-fill jenis_ujian pada baris yang kosong agar sesuai dengan filterJenisUjian
                    parsedQuestions.forEach(q => {
                        if (!q.jenis_ujian) {
                            q.jenis_ujian = filterJenisUjian;
                        }
                    });
                } else {
                    // Jika filter 'all' dipilih, pastikan jenis_ujian di dalam file seragam
                    const fileTypesSet = new Set<string>();
                    parsedQuestions.forEach(q => {
                        if (q.jenis_ujian && q.jenis_ujian.trim() !== '') {
                            fileTypesSet.add(q.jenis_ujian.trim().toUpperCase());
                        }
                    });

                    if (fileTypesSet.size > 1) {
                        showToast("Gagal Upload: File memuat lebih dari satu Jenis Ujian yang berbeda. Silakan pilih Jenis Ujian spesifik di filter terlebih dahulu.", "error");
                        setImporting(false);
                        return;
                    }
                }

                if (parsedQuestions.length > 0) {
                     const res = await api.importQuestions(selectedSubject, parsedQuestions);
                     if (res.success) {
                         showToast(`Berhasil mengimpor ${parsedQuestions.length} soal ke database.`, "success");
                     } else {
                         showToast(`Gagal mengimpor soal: ${res.message}`, "error");
                     }
                     setLoadingData(true);
                     const freshData = await api.getRawQuestions(selectedSubject);
                     setQuestions(freshData);
                     setLoadingData(false);
                } else {
                    showToast("Tidak ada data soal yang ditemukan dalam file.", "warning");
                }

            } catch (err) {
                console.error(err);
                showToast("Gagal membaca file Excel.", "error");
            } finally {
                setImporting(false);
                if (e.target) e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- GENERIC IMAGE UPLOAD LOGIC ---
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: keyof QuestionRow) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { showToast("Ukuran file terlalu besar. Maksimal 2MB", "warning"); return; }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxSize = 800; 
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
                    else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
                    
                    canvas.width = Math.floor(width); 
                    canvas.height = Math.floor(height);
                    
                    if (ctx) { 
                        ctx.fillStyle = "#FFFFFF"; 
                        ctx.fillRect(0, 0, canvas.width, canvas.height); 
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.8); 
                        setCurrentQ(prev => prev ? ({ ...prev, [field]: dataUrl }) : null); 
                    }
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const isImage = (val: string) => {
        if (!val) return false;
        const trimmed = val.trim();
        if (trimmed.startsWith('data:image/')) return true;
        if (trimmed.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i) != null) return true;
        if ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && !trimmed.includes(' ') && !trimmed.includes('\n')) return true;
        return false;
    };

    const renderOptionInput = (label: string, field: 'opsi_a' | 'opsi_b' | 'opsi_c' | 'opsi_d') => {
        if (!currentQ) return null;
        return (
            <div className="group bg-white p-2 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase group-focus-within:text-indigo-500 transition-colors">{label}</label>
                    <label className="cursor-pointer text-[10px] text-indigo-500 hover:text-indigo-700 font-bold flex items-center gap-1">
                        <Upload size={10}/> Img
                        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleImageUpload(e, field)} />
                    </label>
                </div>
                <div className="flex gap-2">
                    {isImage(currentQ[field]) && (
                        <div className="relative w-8 h-8 bg-slate-50 border border-slate-100 rounded flex items-center justify-center overflow-hidden shrink-0">
                            <img src={currentQ[field]} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                    )}
                    <input 
                        type="text" 
                        className="w-full bg-transparent font-medium text-slate-700 outline-none text-xs" 
                        value={currentQ[field]} 
                        onChange={e => setCurrentQ({...currentQ, [field]: e.target.value})} 
                        placeholder={label} 
                    />
                </div>
            </div>
        );
    };

    const downloadTemplate = () => {
        const defaultJenisUjian = filterJenisUjian !== 'all' ? filterJenisUjian : "SUMATIF";
        const isSumatif = defaultJenisUjian.toUpperCase().includes('SUMATIF');
        const rows = [
            { 
                "ID Soal": "Q1", 
                "Link Gambar / Teks Deskripsi": "", 
                "Keterangan Gambar / Teks Deskripsi": "Deskripsi / keterangan gambar...",
                "Teks Soal": "Contoh Soal...", 
                "Tipe Soal (PG/PGK/BS)": "PG", 
                "Opsi A": "A", 
                "Opsi B": "B", 
                "Opsi C": "C", 
                "Opsi D": "D", 
                "Kunci Jawaban": "A", 
                "Bobot": 10, 
                "Kelas": "1", 
                ...(isSumatif ? { "ID TP": "TP-01" } : {}),
                "Jenis Ujian": defaultJenisUjian, 
                "Kode Paket Soal": "A",
                "Kategori Mapel": selectedSubject 
            }
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `Template_Soal_${selectedSubject}.xlsx`);
    };

    const handleExportExcel = () => {
        if (!filteredQuestions || filteredQuestions.length === 0) {
            showToast("Tidak ada data soal yang dapat dieksport.", "warning");
            return;
        }

        const exportData = filteredQuestions.map(q => ({
            "ID Soal": q.id,
            "Link Gambar / Teks Deskripsi": q.gambar || '',
            "Keterangan Gambar / Teks Deskripsi": q.caption || '',
            "Teks Soal": q.text_soal || '',
            "Tipe Soal (PG/PGK/BS)": q.tipe_soal || 'PG',
            "Opsi A": q.opsi_a || '',
            "Opsi B": q.opsi_b || '',
            "Opsi C": q.opsi_c || '',
            "Opsi D": q.opsi_d || '',
            "Kunci Jawaban": q.kunci_jawaban || '',
            "Bobot": q.bobot ?? 10,
            "Kelas": q.kelas || '',
            "ID TP": q.tp_id || '',
            "Jenis Ujian": q.jenis_ujian || (filterJenisUjian !== 'all' ? filterJenisUjian : ''),
            "Kode Paket Soal": q.kode_paket || '',
            "Kategori Mapel": q.mapel || selectedSubject || ''
        }));

        const cleanSubject = (selectedSubject || 'Soal').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanJenis = (filterJenisUjian !== 'all' ? filterJenisUjian : 'Semua').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `Export_Soal_${cleanSubject}_${cleanJenis}`;

        exportToExcel(exportData, fileName, "Bank Soal");
        showToast(`Berhasil mengeksport ${exportData.length} soal ke Excel!`, "success");
    };

    return (
        <div className="space-y-6 fade-in max-w-full mx-auto">
             {/* Header Control */}
             <div className="bg-white p-6 rounded-[1.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-3.5 rounded-2xl shadow-lg shadow-indigo-200"><FileQuestion size={28}/></div>
                    <div>
                        <h3 className="font-black text-xl text-slate-800">Bank Soal</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jenis Ujian:</span>
                            <select 
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1 outline-none cursor-pointer"
                                value={filterJenisUjian}
                                onChange={e => setFilterJenisUjian(e.target.value)}
                            >
                                <option value="all">Semua</option>
                                {examTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>

                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-0 sm:ml-2">Database:</span>
                            <select 
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1 outline-none cursor-pointer"
                                value={selectedSubject}
                                onChange={e => setSelectedSubject(e.target.value)}
                            >
                                {availableSubjects.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                            </select>
                            
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-0 sm:ml-2">Kelas:</span>
                            <select 
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1 outline-none cursor-pointer"
                                value={filterKelas}
                                onChange={e => setFilterKelas(e.target.value)}
                            >
                                <option value="all">Semua</option>
                                {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            {filterJenisUjian === 'SUMATIF' && (
                                <>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-0 sm:ml-2">Filter TP:</span>
                                    <select 
                                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1 outline-none cursor-pointer max-w-[150px]"
                                        value={filterTp}
                                        onChange={e => setFilterTp(e.target.value)}
                                    >
                                        <option value="all">Semua TP</option>
                                        {tpsForFilter.map(tp => (
                                            <option key={tp.id} value={tp.id}>
                                                {tp.id}
                                            </option>
                                        ))}
                                    </select>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={downloadTemplate} className="bg-white text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition border-2 border-slate-200 active:scale-95" title="Download Template Excel">
                        <Download size={16}/> Template
                    </button>

                    <button onClick={handleExportExcel} className="bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition active:scale-95 shadow-sm" title="Export Data Soal Terfilter ke Excel">
                        <FileSpreadsheet size={16}/> Export Excel
                    </button>

                    <label className={`cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-95 ${importing ? 'opacity-50 cursor-wait' : ''}`}>
                        {importing ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}
                        {importing ? "Mengimpor..." : "Import Excel"}
                        <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" disabled={importing} />
                    </label>

                    <button onClick={handleAddNew} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95">
                        <Plus size={16}/> Tambah Soal
                    </button>
                </div>
             </div>

             {/* Question List */}
             <div className="space-y-4">
                {loadingData ? (
                     <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="relative mb-4">
                            <div className="w-16 h-16 border-4 border-slate-100 rounded-full"></div>
                            <div className="w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                        </div>
                        <span className="text-sm font-bold text-slate-400 animate-pulse">Menyiapkan Data Soal...</span>
                    </div>
                ) : filteredQuestions.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 italic font-medium bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                        <FileQuestion size={48} className="mx-auto mb-4 opacity-20"/>
                        Belum ada soal di database mapel ini atau tidak cocok dengan filter.
                    </div>
                ) : (
                    filteredQuestions.map((q, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all group overflow-hidden">
                            <div className="p-5 flex items-start gap-4">
                                <div className="bg-slate-100 text-slate-500 font-mono font-bold text-xs p-2 rounded-lg min-w-[3rem] text-center border border-slate-200 h-fit" title={`ID: ${q.id}`}>
                                    No. {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 pr-4">
                                            <div className="text-slate-800 font-medium text-sm leading-relaxed mb-2">{q.text_soal}</div>
                                            {q.gambar && (
                                                isImage(q.gambar) ? (
                                                    <div className="mt-2 mb-3">
                                                        <img 
                                                            src={q.gambar} 
                                                            alt="Soal" 
                                                            className="h-24 w-auto object-contain rounded-lg border border-slate-200 bg-slate-50 shadow-sm"
                                                            loading="lazy" 
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 mb-3 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-slate-700 text-xs font-normal leading-relaxed">
                                                        <span className="font-bold text-indigo-600 block text-[10px] uppercase mb-1 flex items-center gap-1">
                                                            <Type size={12}/> Deskripsi / Wacana Soal:
                                                        </span>
                                                        <div className="whitespace-pre-line">{q.gambar}</div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button onClick={() => handleEdit(q)} className="p-2 text-amber-500 bg-amber-50 hover:bg-amber-100 rounded-xl transition" title="Edit Soal"><Edit size={16}/></button>
                                            <button onClick={() => handleDelete(q.id)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition" title="Hapus Soal"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                    
                                    {/* Answer Options Display */}
                                    {(q.opsi_a || q.opsi_b || q.opsi_c || q.opsi_d) && (
                                        <div className="mt-2 mb-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600">
                                                {q.opsi_a && (
                                                    <div className={`flex items-start gap-2 ${q.kunci_jawaban.includes('A') ? 'font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-1.5 -mx-1.5' : ''}`}>
                                                        <span className="font-bold opacity-70 w-3 shrink-0 mt-0.5">A.</span>
                                                        <div className="flex-1 break-words leading-snug">{isImage(q.opsi_a) ? <span className="italic flex items-center gap-1 text-[10px] text-indigo-500"><ImageIcon size={10}/> (Gambar)</span> : q.opsi_a}</div>
                                                        {q.kunci_jawaban.includes('A') && <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5"/>}
                                                    </div>
                                                )}
                                                {q.opsi_b && (
                                                    <div className={`flex items-start gap-2 ${q.kunci_jawaban.includes('B') ? 'font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-1.5 -mx-1.5' : ''}`}>
                                                        <span className="font-bold opacity-70 w-3 shrink-0 mt-0.5">B.</span>
                                                        <div className="flex-1 break-words leading-snug">{isImage(q.opsi_b) ? <span className="italic flex items-center gap-1 text-[10px] text-indigo-500"><ImageIcon size={10}/> (Gambar)</span> : q.opsi_b}</div>
                                                        {q.kunci_jawaban.includes('B') && <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5"/>}
                                                    </div>
                                                )}
                                                {q.opsi_c && (
                                                    <div className={`flex items-start gap-2 ${q.kunci_jawaban.includes('C') ? 'font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-1.5 -mx-1.5' : ''}`}>
                                                        <span className="font-bold opacity-70 w-3 shrink-0 mt-0.5">C.</span>
                                                        <div className="flex-1 break-words leading-snug">{isImage(q.opsi_c) ? <span className="italic flex items-center gap-1 text-[10px] text-indigo-500"><ImageIcon size={10}/> (Gambar)</span> : q.opsi_c}</div>
                                                        {q.kunci_jawaban.includes('C') && <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5"/>}
                                                    </div>
                                                )}
                                                {q.opsi_d && (
                                                    <div className={`flex items-start gap-2 ${q.kunci_jawaban.includes('D') ? 'font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-1.5 -mx-1.5' : ''}`}>
                                                        <span className="font-bold opacity-70 w-3 shrink-0 mt-0.5">D.</span>
                                                        <div className="flex-1 break-words leading-snug">{isImage(q.opsi_d) ? <span className="italic flex items-center gap-1 text-[10px] text-indigo-500"><ImageIcon size={10}/> (Gambar)</span> : q.opsi_d}</div>
                                                        {q.kunci_jawaban.includes('D') && <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5"/>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${q.tipe_soal === 'PG' ? 'bg-blue-50 text-blue-600 border-blue-100' : q.tipe_soal === 'URAIAN' ? 'bg-amber-50 text-amber-700 border-amber-200 font-black' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>{q.tipe_soal}</span>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">Bobot: {q.bobot}</span>
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Kunci: {q.kunci_jawaban}</span>
                                        {q.kelas && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Kelas: {q.kelas}</span>}
                                        {q.tp_id && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1"><Target size={10}/> {q.tp_id}</span>}
                                        {q.jenis_ujian && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">{q.jenis_ujian}</span>}
                                        {q.kode_paket && <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded border border-pink-100">Paket: {q.kode_paket}</span>}
                                        {q.gambar && (
                                            isImage(q.gambar) ? (
                                                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><ImageIcon size={10}/> Gambar</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1"><Type size={10}/> Deskripsi Soal</span>
                                            )
                                        )}
                                        {q.caption && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 truncate max-w-[150px]">Ket: {q.caption}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
             </div>
             
             {/* EDIT MODAL - FULL EXPANDED BOX (Wide & Spacious, Zero Internal Scroll on Desktop) */}
             {modalOpen && currentQ && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
                     <div className="bg-white w-full max-w-[98vw] 2xl:max-w-[1700px] max-h-[96vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 relative">
                        
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <div>
                                <h3 className="font-black text-xl md:text-2xl text-slate-800 flex items-center gap-3">
                                    <span className={`p-2 rounded-xl ${currentQ.id ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        <Layout size={22}/>
                                    </span> 
                                    {currentQ.id ? 'Editor Soal' : 'Buat Soal Baru'}
                                </h3>
                                <p className="text-xs text-slate-400 font-bold ml-12 mt-0.5">
                                    Mata Pelajaran: <span className="text-indigo-600 font-extrabold">{selectedSubject}</span>
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setModalOpen(false)} className="px-5 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition border border-transparent hover:border-slate-200 text-xs">Batal</button>
                                <button type="submit" form="qForm" disabled={loadingData} className="px-6 py-2 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 text-xs">
                                    {loadingData ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Simpan Soal
                                </button>
                            </div>
                        </div>

                        {/* Body - CLEAN 2-COLUMN GRID */}
                        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4 md:p-6 custom-scrollbar">
                            <form id="qForm" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-5 content-start">
                                
                                {/* LEFT COLUMN (Span 6): ID Soal, Link Gambar, Keterangan, Teks Soal, Tipe Soal */}
                                <div className="lg:col-span-6 flex flex-col gap-3.5">

                                    {/* 1. ID Soal */}
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1 flex items-center justify-between">
                                            <span>ID Soal</span>
                                            <span className="text-[9px] text-slate-400 font-normal">Wajib diisi</span>
                                        </label>
                                        <input required type="text" className="w-full font-mono font-bold text-slate-800 text-sm outline-none bg-transparent" value={currentQ.id} onChange={e => setCurrentQ({...currentQ, id: e.target.value})} placeholder="Contoh: Q1, Q2..." />
                                    </div>

                                    {/* 2 & 3. Link Gambar & Keterangan (Caption) */}
                                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                                        {/* 2. Link Gambar / Teks Deskripsi */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">
                                                    Link Gambar / Teks Deskripsi
                                                </label>
                                                {currentQ.gambar && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isImage(currentQ.gambar) ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-700'}`}>
                                                        {isImage(currentQ.gambar) ? 'Gambar (URL)' : 'Teks Wacana'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <div className="w-9 h-9 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
                                                    {isImage(currentQ.gambar) ? <img src={currentQ.gambar} className="w-full h-full object-cover"/> : currentQ.gambar ? <Type size={16} className="text-indigo-600"/> : <ImageIcon size={16} className="text-slate-400"/>}
                                                </div>
                                                <textarea 
                                                    rows={2}
                                                    className="flex-1 bg-slate-50 p-2 rounded-lg text-xs font-medium outline-none text-slate-700 placeholder-slate-400 border border-transparent focus:border-indigo-200 focus:bg-white transition-all resize-y" 
                                                    value={currentQ.gambar} 
                                                    onChange={e => setCurrentQ({...currentQ, gambar: e.target.value})} 
                                                    placeholder="URL Gambar (http/https) atau Teks Deskripsi Wacana..." 
                                                />
                                                <label className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg cursor-pointer hover:bg-indigo-100 transition shrink-0" title="Upload Gambar Dari Perangkat">
                                                    <Upload size={16}/>
                                                    <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'gambar')} />
                                                </label>
                                            </div>
                                        </div>

                                        {/* 3. Keterangan Gambar / Teks Deskripsi (Caption) */}
                                        <div className="border-t border-slate-100 pt-2.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                                Keterangan Gambar / Teks Deskripsi (Caption)
                                            </label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-slate-50 p-2 rounded-lg text-xs font-medium outline-none text-slate-700 placeholder-slate-300 border border-transparent focus:border-indigo-200 focus:bg-white transition-all" 
                                                value={currentQ.caption || ''} 
                                                onChange={e => setCurrentQ({...currentQ, caption: e.target.value})} 
                                                placeholder="Catatan/keterangan tambahan di bawah gambar..." 
                                            />
                                        </div>
                                    </div>

                                    {/* 4. Teks Soal / Pertanyaan */}
                                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-[160px]">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                            Teks Soal / Pertanyaan
                                        </label>
                                        <textarea 
                                            required 
                                            className="flex-1 w-full bg-slate-50/50 p-3 rounded-lg outline-none resize-y font-medium text-slate-800 leading-relaxed text-sm border border-slate-100 focus:border-indigo-300 focus:bg-white transition-all min-h-[110px]" 
                                            value={currentQ.text_soal} 
                                            onChange={e => setCurrentQ({...currentQ, text_soal: e.target.value})} 
                                            placeholder="Ketikkan isi pertanyaan atau soal di sini..."
                                        />
                                    </div>

                                    {/* 5. Tipe Soal */}
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                            Tipe Soal (PG / PGK / BS / URAIAN)
                                        </label>
                                        <select 
                                            className="w-full font-bold text-slate-700 text-sm outline-none bg-transparent cursor-pointer" 
                                            value={currentQ.tipe_soal} 
                                            onChange={e => setCurrentQ({...currentQ, tipe_soal: e.target.value as any})}
                                        >
                                            <option value="PG">PG - Pilihan Ganda Tunggal</option>
                                            <option value="PGK">PGK - Pilihan Ganda Kompleks (Banyak Jawaban)</option>
                                            <option value="BS">BS - Benar / Salah</option>
                                            <option value="URAIAN">URAIAN - Soal Uraian / Isian / Essay</option>
                                        </select>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN (Span 6): Opsi, Kunci, Bobot, Kelas, ID TP, Jenis Ujian, Kode Paket, Kategori Mapel */}
                                <div className="lg:col-span-6 flex flex-col gap-3.5">

                                    {/* 6, 7, 8, 9. Opsi A, Opsi B, Opsi C, Opsi D */}
                                    {currentQ.tipe_soal === 'URAIAN' ? (
                                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm text-xs text-amber-800">
                                            <p className="font-bold mb-1 flex items-center gap-1.5 text-amber-900">
                                                <Type size={14}/> Soal Uraian / Isian / Essay
                                            </p>
                                            <p className="text-[11px] leading-relaxed text-amber-700">
                                                Opsi pilihan jawaban (A, B, C, D) tidak diperlukan untuk soal Uraian. Isikan pembahasan / kunci acuan / rubrik penilaian pada kolom <strong>Kunci Jawaban / Rubrik Acuan</strong>.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                                Pilihan Jawaban (Opsi A, B, C, D)
                                            </label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                                {renderOptionInput("Opsi A", 'opsi_a')}
                                                {renderOptionInput("Opsi B", 'opsi_b')}
                                                {renderOptionInput("Opsi C", 'opsi_c')}
                                                {currentQ.tipe_soal !== 'PGK' && renderOptionInput("Opsi D", 'opsi_d')}
                                            </div>
                                        </div>
                                    )}

                                    {/* 10. Kunci Jawaban & 11. Bobot Nilai */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* 10. Kunci Jawaban */}
                                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200/80 shadow-sm">
                                            <label className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">
                                                {currentQ.tipe_soal === 'URAIAN' ? 'Rubrik / Kunci Acuan' : 'Kunci Jawaban'}
                                            </label>
                                            <input 
                                                required={currentQ.tipe_soal !== 'URAIAN'}
                                                type="text" 
                                                className="w-full bg-transparent font-mono font-bold text-sm text-emerald-800 outline-none placeholder-emerald-300" 
                                                value={currentQ.kunci_jawaban} 
                                                onChange={e => setCurrentQ({...currentQ, kunci_jawaban: e.target.value})} 
                                                placeholder={currentQ.tipe_soal === 'URAIAN' ? "Kata kunci / jawaban acuan..." : "Contoh: A"} 
                                            />
                                            <p className="text-[9px] font-medium text-emerald-600 mt-0.5">
                                                {currentQ.tipe_soal === 'URAIAN' ? 'Pedoman / kata kunci jawaban acuan guru' : 'PG: A | PGK: A,B | B/S: B,S,B'}
                                            </p>
                                        </div>

                                        {/* 11. Bobot Nilai */}
                                        <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200/80 shadow-sm">
                                            <label className="text-[10px] font-bold text-indigo-700 uppercase block mb-1">
                                                Bobot Nilai
                                            </label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-transparent font-black text-xl text-indigo-800 outline-none placeholder-indigo-300" 
                                                value={currentQ.bobot} 
                                                onChange={e => setCurrentQ({...currentQ, bobot: Number(e.target.value)})} 
                                                placeholder="10" 
                                            />
                                            <p className="text-[9px] font-medium text-indigo-500 mt-0.5">Poin standar soal (cth: 10)</p>
                                        </div>
                                    </div>

                                    {/* 12. Kelas & 13. ID TP */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* 12. Kelas */}
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                                Kelas
                                            </label>
                                            <input 
                                                type="text" 
                                                className="w-full font-bold text-slate-700 text-xs outline-none bg-transparent" 
                                                value={currentQ.kelas || ''} 
                                                onChange={e => setCurrentQ({...currentQ, kelas: e.target.value})} 
                                                placeholder="Contoh: 1, 2, 3..." 
                                            />
                                        </div>

                                        {/* 13. ID TP (Tujuan Pembelajaran) */}
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1 truncate">
                                                ID TP {(currentQ.jenis_ujian || '').toUpperCase().includes('SUMATIF') ? '(Sumatif)' : ''}
                                            </label>
                                            <select 
                                                className="w-full font-bold text-slate-700 text-xs outline-none bg-transparent cursor-pointer truncate" 
                                                value={currentQ.tp_id || ''} 
                                                onChange={e => setCurrentQ({...currentQ, tp_id: e.target.value})}
                                            >
                                                <option value="">-- Tanpa / Pilih TP --</option>
                                                {availableTps.map(tp => (
                                                    <option key={tp.id} value={tp.id}>{tp.id} - {tp.materi}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* 14. Jenis Ujian (+ Jenis Sumatif jika Sumatif) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                                Jenis Ujian
                                            </label>
                                            <select 
                                                className="w-full font-bold text-slate-700 text-xs outline-none bg-transparent cursor-pointer" 
                                                value={(currentQ.jenis_ujian || '').toUpperCase().includes('SUMATIF') ? 'SUMATIF' : (currentQ.jenis_ujian || '')} 
                                                onChange={e => {
                                                    const newJenisUjian = e.target.value;
                                                    setCurrentQ({
                                                        ...currentQ, 
                                                        jenis_ujian: newJenisUjian === 'SUMATIF' ? 'Sumatif 1' : newJenisUjian,
                                                        tp_id: newJenisUjian === 'SUMATIF' ? currentQ.tp_id : ''
                                                    });
                                                }}
                                            >
                                                <option value="">-- Pilih Jenis Ujian --</option>
                                                {examTypes.map(t => (
                                                    <option key={t.id} value={t.id}>{t.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {(currentQ.jenis_ujian || '').toUpperCase().includes('SUMATIF') && (
                                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Kategori Sumatif</label>
                                                <select 
                                                    className="w-full font-bold text-slate-700 text-xs outline-none bg-transparent cursor-pointer" 
                                                    value={currentQ.jenis_ujian || 'Sumatif 1'} 
                                                    onChange={e => setCurrentQ({...currentQ, jenis_ujian: e.target.value})}
                                                >
                                                    <option value="Sumatif 1">Sumatif 1</option>
                                                    <option value="Sumatif 2">Sumatif 2</option>
                                                    <option value="Sumatif 3">Sumatif 3</option>
                                                    <option value="Sumatif 4">Sumatif 4</option>
                                                    <option value="Sumatif Akhir Semester">Sumatif Akhir Semester</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {/* 15. Kode Paket Soal & 16. Kategori Mapel */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* 15. Kode Paket Soal */}
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                                Kode Paket Soal
                                            </label>
                                            <input 
                                                type="text" 
                                                className="w-full font-bold text-slate-700 text-xs outline-none bg-transparent" 
                                                value={currentQ.kode_paket || ''} 
                                                onChange={e => setCurrentQ({...currentQ, kode_paket: e.target.value})} 
                                                placeholder="Contoh: A, B, UTAMA..." 
                                            />
                                        </div>

                                        {/* 16. Kategori Mapel */}
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                                Kategori Mapel
                                            </label>
                                            <select 
                                                className="w-full font-bold text-slate-700 text-xs outline-none bg-transparent cursor-pointer truncate" 
                                                value={currentQ.mapel || selectedSubject} 
                                                onChange={e => setCurrentQ({...currentQ, mapel: e.target.value})}
                                            >
                                                {subjectsDb.map(s => (
                                                    <option key={s.id || s.label} value={s.label}>{s.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Bottom Action Footer */}
                                    <div className="flex gap-3 pt-2 mt-auto">
                                        <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition text-xs cursor-pointer">
                                            Tutup
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={loadingData} 
                                            className={`flex-1 py-2.5 rounded-xl font-bold text-white transition text-xs flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                                                isModalSaved 
                                                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200' 
                                                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                            }`}
                                        >
                                            {loadingData ? (
                                                <Loader2 size={16} className="animate-spin"/>
                                            ) : isModalSaved ? (
                                                <>
                                                    <Plus size={16}/> Tambah Soal
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={16}/> Simpan Soal
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                            </form>
                        </div>
                     </div>
                 </div>
             )}

            <ConfirmationModal
                isOpen={deleteConfirmId !== null}
                onClose={() => setDeleteConfirmId(null)}
                onConfirm={confirmDeleteQuestion}
                title="Hapus Soal"
                message={`Apakah Anda yakin ingin menghapus soal ID: ${deleteConfirmId}? Soal yang dihapus tidak dapat dikembalikan.`}
                confirmText="Hapus"
                cancelText="Batal"
                type="danger"
            />
        </div>
    );
};

export default BankSoalTab;
