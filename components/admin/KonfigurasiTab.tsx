
import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { Save, Loader2, Building, UserSquare, Calendar, Shield, School, UserCircle, Briefcase, Lock, Upload, Image as ImageIcon, AlertCircle, Plus, Trash2, ListChecks, BookOpen, ChevronDown, ChevronUp, Database, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../src/services/api';
import { User } from '../../types';
import { getSubjects, getExamTypes, getExamSubjectMapping } from '../../utils/adminHelpers';
import ConfirmationModal from '../ui/ConfirmationModal';

const KonfigurasiTab = ({ currentUser }: { currentUser: User }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDeleteExamTypeModal, setShowDeleteExamTypeModal] = useState(false);

    const [dbHealth, setDbHealth] = useState<{
        status: string;
        database: string;
        hasEnv: boolean;
        time?: string;
        error?: string;
        message?: string;
    } | null>(null);
    const [checkingDb, setCheckingDb] = useState(false);

    const runCheckDb = async () => {
        setCheckingDb(true);
        const result = await api.checkDatabaseConnection();
        setDbHealth(result);
        setCheckingDb(false);
    };

    useEffect(() => {
        runCheckDb();
    }, []);
    
    const [formData, setFormData] = useState({
        schoolName: '',
        schoolTagline: '',
        footerCopyright: '',
        footerInfo: '',
        principalName: '',
        principalNip: '',
        teacherName: '',
        teacherNip: '',
        teacherPosition: '',
        gradeLevel: '', 
        semester: '',   
        academicYear: '',
        logoKabupaten: '', 
        logoSekolah: '',
        faviconUrl: '',
        examTypes: [] as { id: string, label: string }[],
        examTypesStatus: {} as Record<string, boolean>,
        examSignatories: {} as Record<string, { leftTitle: string, leftName: string, leftNip: string, rightTitle: string, rightName: string, rightNip: string }>,
        examSubjects: {} as Record<string, string[]>,
        subjectsDb: [] as { id: string, label: string }[]
    });

    const [newExamType, setNewExamType] = useState('');
    const [newSubjectId, setNewSubjectId] = useState('');
    const [newSubjectLabel, setNewSubjectLabel] = useState('');
    const [isExamTypesOpen, setIsExamTypesOpen] = useState(false);
    const [selectedExamTypeId, setSelectedExamTypeId] = useState<string>('');

    // New states for collapsible sections
    const [isLogoOpen, setIsLogoOpen] = useState(false);
    const [isSchoolDataOpen, setIsSchoolDataOpen] = useState(false);
    const [isSubjectsOpen, setIsSubjectsOpen] = useState(false);

    const isGuru = currentUser.role === 'Guru';
    // Logic: If user has specific class assigned in DB, lock it.
    const userClass = currentUser.kelas && currentUser.kelas !== '-' ? currentUser.kelas : '';

    useEffect(() => {
        const fetchConfig = async () => {
            setLoading(true);
            try {
                // 1. Fetch Global Config (Defaults & Logos)
                const globalConfig = await api.getAppConfig();
                
                // 2. Fetch User Specific Config (Overrides)
                const userConfig = await api.getUserConfig(currentUser.username);
                
                // Merge Logic
                const mergedConfig = { ...globalConfig, ...userConfig };

                const lockedName = currentUser.nama_lengkap;
                const lockedNip = currentUser.username;
                
                // Auto-generate default position, but allow override from config
                const defaultPosition = currentUser.kelas && currentUser.kelas !== '-' ? `Guru Kelas ${currentUser.kelas}` : 'Guru Kelas';

                let parsedSignatories = {};
                if (globalConfig['EXAM_SIGNATORIES']) {
                    try {
                        parsedSignatories = JSON.parse(globalConfig['EXAM_SIGNATORIES']);
                    } catch (e) {
                        console.error("Failed to parse EXAM_SIGNATORIES", e);
                    }
                }

                let parsedStatus = {};
                if (globalConfig['EXAM_TYPES_STATUS']) {
                    try {
                        parsedStatus = JSON.parse(globalConfig['EXAM_TYPES_STATUS']);
                    } catch (e) {
                        console.error("Failed to parse EXAM_TYPES_STATUS", e);
                    }
                }

                const mapping = getExamSubjectMapping(globalConfig);
                // Fetch ALL types (active & inactive) for configuration
                const types = getExamTypes(globalConfig, false);
                const subjectsRecord = mapping.reduce((acc: any, curr: any) => { acc[curr.examTypeId] = curr.subjectIds; return acc; }, {});

                const rawFooterCopyright = mergedConfig['FOOTER_COPYRIGHT'] || '© 2026 | Dev. MeyGa';
                const footerCopyrightVal = rawFooterCopyright.includes('EXAMORA') ? '© 2026 | Dev. MeyGa' : rawFooterCopyright;

                setFormData({
                    schoolName: mergedConfig['SCHOOL_NAME'] || '',
                    schoolTagline: mergedConfig['SCHOOL_TAGLINE'] || '',
                    footerCopyright: footerCopyrightVal,
                    footerInfo: mergedConfig['FOOTER_INFO'] || 'Secure Browser',
                    principalName: mergedConfig['PRINCIPAL_NAME'] || '',
                    principalNip: mergedConfig['PRINCIPAL_NIP'] || '',
                    
                    teacherName: lockedName || mergedConfig['TEACHER_NAME'] || '',
                    teacherNip: lockedNip || mergedConfig['TEACHER_NIP'] || '',
                    // UPDATED: Prioritize saved config, fallback to default
                    teacherPosition: mergedConfig['TEACHER_POSITION'] || defaultPosition,
                    
                    // If user has specific class, force it. Otherwise use config or default '1'
                    gradeLevel: userClass || mergedConfig['GRADE_LEVEL'] || '1',
                    
                    semester: mergedConfig['SEMESTER'] || '1 (Ganjil)',
                    academicYear: mergedConfig['ACADEMIC_YEAR'] || '2025/2026',
                    
                    logoKabupaten: globalConfig['LOGO_KABUPATEN'] || '',
                    logoSekolah: globalConfig['LOGO_SEKOLAH'] || '',
                    faviconUrl: globalConfig['FAVICON_URL'] || 'https://image2url.com/r2/default/images/1772981483268-6fdcb4fb-dc32-43a1-b310-74b8dbd8e9b7.png',
                    examTypes: types,
                    examTypesStatus: parsedStatus,
                    examSignatories: parsedSignatories,
                    examSubjects: subjectsRecord,
                    subjectsDb: getSubjects(globalConfig)
                });

                if (types.length > 0 && !selectedExamTypeId) {
                    setSelectedExamTypeId(types[0].id);
                }
            } catch(e) {
                console.error("Failed to load config", e);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [currentUser, userClass]);

    // Helper to resize image to Base64 (Max Height 150px to save storage)
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoKabupaten' | 'logoSekolah' | 'faviconUrl') => {
        if (isGuru) return; // Security check
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { showToast("Ukuran file maksimal 2MB", "error"); return; }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxHeight = 150; // Limit height for logos
                    
                    let width = img.width;
                    let height = img.height;
                    
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                    
                    canvas.width = Math.floor(width);
                    canvas.height = Math.floor(height);
                    
                    if (ctx) { 
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                        const dataUrl = canvas.toDataURL('image/png', 0.8); 
                        setFormData(prev => ({ ...prev, [field]: dataUrl })); 
                    }
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. SAVE TO GLOBAL CONFIG (Sekolah & Logos) - Only Admin
            if (!isGuru) {
                const mappingArray = Object.entries(formData.examSubjects).map(([key, val]) => ({ examTypeId: key, subjectIds: val }));
                const globalPayload = {
                    'SCHOOL_NAME': formData.schoolName,
                    'SCHOOL_TAGLINE': formData.schoolTagline,
                    'FOOTER_COPYRIGHT': formData.footerCopyright,
                    'FOOTER_INFO': formData.footerInfo,
                    'LOGO_KABUPATEN': formData.logoKabupaten,
                    'LOGO_SEKOLAH': formData.logoSekolah,
                    'FAVICON_URL': formData.faviconUrl,
                    'ACADEMIC_YEAR': formData.academicYear,
                    'EXAM_TYPES_DB': JSON.stringify(formData.examTypes),
                    'EXAM_TYPES_STATUS': JSON.stringify(formData.examTypesStatus),
                    'EXAM_SIGNATORIES': JSON.stringify(formData.examSignatories),
                    'EXAM_SUBJECT_MAPPING_DB': JSON.stringify(mappingArray),
                    'SUBJECTS_DB': JSON.stringify(formData.subjectsDb)
                };
                const resGlobal = await api.saveBatchConfig(globalPayload);
                if (!resGlobal.success) {
                    showToast("Gagal menyimpan ke database: " + (resGlobal.message || "Error"), "error");
                    setSaving(false);
                    return;
                }
            }

            // 2. SAVE TO USER CONFIG (Personal Data)
            // Prepare User Payload
            const userPayload: Record<string, string> = {
                'TEACHER_NAME': formData.teacherName,
                'TEACHER_NIP': formData.teacherNip,
                'TEACHER_POSITION': formData.teacherPosition,
                'GRADE_LEVEL': formData.gradeLevel,
                'SEMESTER': formData.semester,
            };

            // If Admin, they can also set Principal info for themselves/Global context if implemented
            // If Guru, they cannot change Principal info, so we don't save it to their config to allow Global fallback
            if (!isGuru) {
                userPayload['PRINCIPAL_NAME'] = formData.principalName;
                userPayload['PRINCIPAL_NIP'] = formData.principalNip;
            }

            const resUser = await api.saveUserConfig(currentUser.username, userPayload);
            if (!resUser.success) {
                showToast("Gagal menyimpan ke database: " + (resUser.message || "Error"), "error");
                setSaving(false);
                return;
            }
            
            showToast(isGuru ? "Konfigurasi guru berhasil disimpan." : "Konfigurasi instansi berhasil disimpan.", "success");
        } catch(e) {
            console.error(e);
            showToast("Gagal menyimpan konfigurasi.", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 size={40} className="text-indigo-600 animate-spin mb-4"/>
                <p className="text-slate-500 font-bold">Memuat Konfigurasi...</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                <div>
                    <h3 className="font-black text-2xl text-slate-800 flex items-center gap-3">
                        <Shield size={28} className="text-indigo-600"/> Konfigurasi {isGuru ? 'Guru' : 'Instansi'}
                    </h3>
                    <p className="text-slate-500 font-medium text-sm mt-1">
                        {isGuru ? 'Pengaturan data laporan dan identitas guru.' : 'Pengaturan data sekolah, logo, dan pimpinan.'}
                    </p>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Simpan Perubahan
                </button>
            </div>

            <div className="space-y-8">
                
                {/* DATABASE NEON CONNECTION STATUS BANNER */}
                {dbHealth?.database === 'connected' ? (
                    <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 flex items-center justify-between gap-3 text-emerald-900 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                                <Database size={22} className="text-emerald-600" />
                            </div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Connected
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={runCheckDb}
                            disabled={checkingDb}
                            title="Cek Ulang Koneksi"
                            className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold shadow-xs shrink-0 active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={checkingDb ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">Cek Koneksi</span>
                        </button>
                    </div>
                ) : (
                    <div className="p-5 rounded-2xl border bg-amber-50 border-amber-200 text-amber-900 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-xl mt-0.5 bg-amber-500/10 text-amber-600">
                                    <Database size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-extrabold text-base">
                                            Status Koneksi Database
                                        </h4>
                                        {checkingDb ? (
                                            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                                                <Loader2 size={12} className="animate-spin" /> Memeriksa...
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                <XCircle size={13} /> Belum Terhubung
                                            </span>
                                        )}
                                    </div>
                                    
                                    <p className="text-xs font-medium mt-1 opacity-90 leading-relaxed">
                                        Database Supabase belum terhubung. Silakan atur variabel lingkungan Supabase Anda.
                                    </p>

                                    <div className="mt-3 p-3 bg-white/90 rounded-xl border border-amber-200 text-xs space-y-2 text-slate-800 shadow-sm">
                                        <p className="font-bold text-amber-900 flex items-center gap-1">
                                            <AlertCircle size={14} className="text-amber-600" />
                                            Petunjuk Menghubungkan Supabase:
                                        </p>
                                        {dbHealth?.error && (
                                            <p className="font-mono text-[11px] bg-rose-50 text-rose-800 p-2 rounded border border-rose-200 break-all">
                                                Detail Error: {dbHealth.error}
                                            </p>
                                        )}
                                        <ol className="list-decimal list-inside space-y-1.5 text-slate-700 font-medium text-[11px]">
                                            <li>Buka dashboard Supabase Anda di <strong>supabase.com</strong> &gt; <strong>Project Settings</strong> &gt; <strong>API</strong>.</li>
                                            <li>Salin <strong>Project URL</strong> dan <strong>anon / public key</strong>.</li>
                                            <li>Buka menu <strong>Settings</strong> &gt; <strong>Secrets / Environment Variables</strong> di AI Studio (atau di Netlify/Vercel).</li>
                                            <li>Tambahkan 2 variabel utama:
                                                <ul className="list-disc list-inside ml-4 mt-0.5 space-y-0.5 text-slate-800 font-mono text-[10px]">
                                                    <li><code>SUPABASE_URL</code></li>
                                                    <li><code>SUPABASE_ANON_KEY</code></li>
                                                </ul>
                                            </li>
                                            <li>Jalankan script SQL dari file <code>supabase_schema.sql</code> di SQL Editor Supabase Anda.</li>
                                            <li>Klik tombol <strong>Cek Ulang Koneksi</strong> setelah menambahkan variabel.</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={runCheckDb}
                                disabled={checkingDb}
                                className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 shrink-0 active:scale-95 disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={checkingDb ? 'animate-spin' : ''} />
                                Cek Ulang Koneksi
                            </button>
                        </div>
                    </div>
                )}

                {/* Section 0: LOGO UPLOAD */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                    {isGuru && (
                        <div className="absolute top-0 right-0 bg-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-slate-300 flex items-center gap-1">
                            <Lock size={10} /> Read Only
                        </div>
                    )}
                    <div 
                        className="flex justify-between items-center cursor-pointer mb-4"
                        onClick={() => setIsLogoOpen(!isLogoOpen)}
                    >
                        <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
                            <ImageIcon size={18} className="text-purple-500"/> Logo Instansi
                        </h4>
                        {isLogoOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                    </div>
                    
                    {isLogoOpen && (
                        <div className="grid grid-cols-3 gap-4 fade-in">
                            {/* Logo Kabupaten */}
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Logo Kabupaten</span>
                                <div className={`relative w-24 h-24 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden group ${isGuru ? 'opacity-80' : ''}`}>
                                    {formData.logoKabupaten ? (
                                        <img src={formData.logoKabupaten} className="w-full h-full object-contain p-2" alt="Kabupaten" />
                                    ) : (
                                        <ImageIcon className="text-slate-300" size={24}/>
                                    )}
                                    {!isGuru && (
                                        <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-[10px] font-bold">
                                            <Upload size={16} className="mb-1"/> Ubah
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logoKabupaten')} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Logo Sekolah */}
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Logo Sekolah</span>
                                <div className={`relative w-24 h-24 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden group ${isGuru ? 'opacity-80' : ''}`}>
                                    {formData.logoSekolah ? (
                                        <img src={formData.logoSekolah} className="w-full h-full object-contain p-2" alt="Sekolah" />
                                    ) : (
                                        <School className="text-slate-300" size={24}/>
                                    )}
                                    {!isGuru && (
                                        <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-[10px] font-bold">
                                            <Upload size={16} className="mb-1"/> Ubah
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logoSekolah')} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Favicon */}
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Favicon</span>
                                <div className={`relative w-24 h-24 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden group ${isGuru ? 'opacity-80' : ''}`}>
                                    {formData.faviconUrl ? (
                                        <img src={formData.faviconUrl} className="w-full h-full object-contain p-2" alt="Favicon" />
                                    ) : (
                                        <ImageIcon className="text-slate-300" size={24}/>
                                    )}
                                    {!isGuru && (
                                        <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-[10px] font-bold">
                                            <Upload size={16} className="mb-1"/> Ubah
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'faviconUrl')} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Section 1: Data Sekolah */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                    {isGuru && (
                        <div className="absolute top-0 right-0 bg-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-slate-300 flex items-center gap-1">
                            <Lock size={10} /> Data Terkunci
                        </div>
                    )}
                    <div 
                        className="flex justify-between items-center cursor-pointer mb-4"
                        onClick={() => setIsSchoolDataOpen(!isSchoolDataOpen)}
                    >
                        <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
                            <School size={18} className="text-blue-500"/> Data Sekolah & Akademik
                        </h4>
                        {isSchoolDataOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                    </div>
                    
                    {isSchoolDataOpen && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Sekolah</label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                    <input 
                                        type="text" 
                                        className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                        placeholder="Contoh: EXAMORA DEVELOPMENT ASSESMENT"
                                        value={formData.schoolName}
                                        onChange={e => setFormData({...formData, schoolName: e.target.value})}
                                        readOnly={isGuru}
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Slogan / Tagline Sekolah</label>
                                <div className="relative">
                                    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                    <input 
                                        type="text" 
                                        className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                        placeholder="Contoh: Digital Assessment for Future"
                                        value={formData.schoolTagline}
                                        onChange={e => setFormData({...formData, schoolTagline: e.target.value})}
                                        readOnly={isGuru}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Teks Copyright Footer</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                    <input 
                                        type="text" 
                                        className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                        placeholder="Contoh: © 2026 | Dev. MeyGa"
                                        value={formData.footerCopyright}
                                        onChange={e => setFormData({...formData, footerCopyright: e.target.value})}
                                        readOnly={isGuru}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Teks Info Footer</label>
                                <div className="relative">
                                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                    <input 
                                        type="text" 
                                        className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                        placeholder="Contoh: Secure Browser"
                                        value={formData.footerInfo}
                                        onChange={e => setFormData({...formData, footerInfo: e.target.value})}
                                        readOnly={isGuru}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tahun Ajaran</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                    <input 
                                        type="text" 
                                        className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                        placeholder="Contoh: 2025/2026"
                                        value={formData.academicYear}
                                        onChange={e => setFormData({...formData, academicYear: e.target.value})}
                                        readOnly={isGuru}
                                    />
                                </div>
                            </div>
                            
                            {/* SPLIT CLASS & SEMESTER */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Kelas</label>
                                    <input 
                                        type="text"
                                        className={`w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all text-center ${!!userClass ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500'}`}
                                        placeholder="1, 2, 3..."
                                        value={formData.gradeLevel}
                                        onChange={e => setFormData({...formData, gradeLevel: e.target.value})}
                                        readOnly={!!userClass}
                                    />
                                    {!!userClass && <span className="text-[9px] text-slate-400 mt-1 block">*Otomatis dari Database</span>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Semester</label>
                                    <select 
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none transition-all bg-white cursor-pointer appearance-none"
                                        value={formData.semester}
                                        onChange={e => setFormData({...formData, semester: e.target.value})}
                                    >
                                        <option>1 (Ganjil)</option>
                                        <option>2 (Genap)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Section 1.5: Jenis Ujian */}
                {!isGuru && (
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                        <div 
                            className="flex justify-between items-center cursor-pointer"
                            onClick={() => setIsExamTypesOpen(!isExamTypesOpen)}
                        >
                            <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
                                <ListChecks size={18} className="text-indigo-500"/> Jenis Ujian (Kategori)
                            </h4>
                            {isExamTypesOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                        </div>
                        
                        {isExamTypesOpen && (
                            <div className="space-y-4 mt-4">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" 
                                        placeholder="Tambah Jenis Ujian Baru (Misal: OSN, TKA)"
                                        value={newExamType}
                                        onChange={e => setNewExamType(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (newExamType.trim() && !formData.examTypes.find(t => t.id === newExamType.trim())) {
                                                    const newId = newExamType.trim();
                                                    setFormData(prev => ({...prev, examTypes: [...prev.examTypes, { id: newId, label: newId }]}));
                                                    setNewExamType('');
                                                    setSelectedExamTypeId(newId);
                                                }
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={() => {
                                            if (newExamType.trim() && !formData.examTypes.find(t => t.id === newExamType.trim())) {
                                                const newId = newExamType.trim();
                                                setFormData(prev => ({...prev, examTypes: [...prev.examTypes, { id: newId, label: newId }]}));
                                                setNewExamType('');
                                                setSelectedExamTypeId(newId);
                                            }
                                        }}
                                        className="bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2"
                                    >
                                        <Plus size={18}/> Tambah
                                    </button>
                                </div>
                                
                                <div className="bg-white border border-slate-200 rounded-xl p-4">
                                    <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pilih Kategori untuk Dikonfigurasi</label>
                                            <select 
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-indigo-700 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                                                value={selectedExamTypeId}
                                                onChange={e => setSelectedExamTypeId(e.target.value)}
                                            >
                                                <option value="">-- Pilih Kategori --</option>
                                                {formData.examTypes.map(t => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.label} {formData.examTypesStatus[t.id] === false ? '(Non-Aktif)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {selectedExamTypeId && (
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${formData.examTypesStatus[selectedExamTypeId] !== false ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            examTypesStatus: {
                                                                ...prev.examTypesStatus,
                                                                [selectedExamTypeId]: !(prev.examTypesStatus[selectedExamTypeId] !== false)
                                                            }
                                                        }));
                                                    }}
                                                >
                                                    <div className={`w-8 h-4 rounded-full relative transition-colors ${formData.examTypesStatus[selectedExamTypeId] !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${formData.examTypesStatus[selectedExamTypeId] !== false ? 'left-[18px]' : 'left-0.5'}`}></div>
                                                    </div>
                                                    <span className="text-xs font-bold uppercase">
                                                        {formData.examTypesStatus[selectedExamTypeId] !== false ? 'Aktif' : 'Non-Aktif'}
                                                    </span>
                                                </div>

                                                <button 
                                                    onClick={() => setShowDeleteExamTypeModal(true)}
                                                    className="bg-rose-50 text-rose-600 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-rose-100 transition flex items-center gap-2 border border-rose-100"
                                                >
                                                    <Trash2 size={16}/> Hapus
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {selectedExamTypeId ? (
                                        <div className="fade-in space-y-6">
                                            {formData.examTypes.filter(t => t.id === selectedExamTypeId).map((type) => (
                                                <div key={type.id} className="space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                                        <div>
                                                            <p className="text-xs font-black text-indigo-600 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                                <UserCircle size={14}/> Tanda Tangan Kiri
                                                            </p>
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Jabatan</label>
                                                                    <input type="text" placeholder="Jabatan" className="w-full text-sm font-bold p-3 border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none" value={formData.examSignatories[type.id]?.leftTitle || ''} onChange={e => setFormData(prev => ({...prev, examSignatories: {...prev.examSignatories, [type.id]: {...(prev.examSignatories[type.id] || {}), leftTitle: e.target.value}}}))} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nama Lengkap</label>
                                                                    <input type="text" placeholder="Nama Lengkap" className="w-full text-sm font-bold p-3 border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none" value={formData.examSignatories[type.id]?.leftName || ''} onChange={e => setFormData(prev => ({...prev, examSignatories: {...prev.examSignatories, [type.id]: {...(prev.examSignatories[type.id] || {}), leftName: e.target.value}}}))} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">NIP</label>
                                                                    <input type="text" placeholder="NIP" className="w-full text-sm font-bold p-3 border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none" value={formData.examSignatories[type.id]?.leftNip || ''} onChange={e => setFormData(prev => ({...prev, examSignatories: {...prev.examSignatories, [type.id]: {...(prev.examSignatories[type.id] || {}), leftNip: e.target.value}}}))} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-indigo-600 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                                <UserCircle size={14}/> Tanda Tangan Kanan
                                                            </p>
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Jabatan</label>
                                                                    <input type="text" placeholder="Jabatan" className="w-full text-sm font-bold p-3 border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none" value={formData.examSignatories[type.id]?.rightTitle || ''} onChange={e => setFormData(prev => ({...prev, examSignatories: {...prev.examSignatories, [type.id]: {...(prev.examSignatories[type.id] || {}), rightTitle: e.target.value}}}))} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nama Lengkap</label>
                                                                    <input type="text" placeholder="Nama Lengkap" className="w-full text-sm font-bold p-3 border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none" value={formData.examSignatories[type.id]?.rightName || ''} onChange={e => setFormData(prev => ({...prev, examSignatories: {...prev.examSignatories, [type.id]: {...(prev.examSignatories[type.id] || {}), rightName: e.target.value}}}))} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">NIP</label>
                                                                    <input type="text" placeholder="NIP" className="w-full text-sm font-bold p-3 border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none" value={formData.examSignatories[type.id]?.rightNip || ''} onChange={e => setFormData(prev => ({...prev, examSignatories: {...prev.examSignatories, [type.id]: {...(prev.examSignatories[type.id] || {}), rightNip: e.target.value}}}))} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                                        <p className="text-xs font-black text-indigo-600 mb-4 uppercase tracking-wider flex items-center gap-2">
                                                            <BookOpen size={14}/> Mata Pelajaran Khusus
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 mb-3 font-medium italic">*Pilih mata pelajaran yang berlaku untuk kategori ini. Jika kosong, semua mapel akan muncul.</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {formData.subjectsDb.map(subj => {
                                                                const isSelected = formData.examSubjects[type.id]?.includes(subj.id);
                                                                return (
                                                                    <button
                                                                        key={subj.id}
                                                                        onClick={() => {
                                                                            setFormData(prev => {
                                                                                const currentSubjects = prev.examSubjects[type.id] || [];
                                                                                const newSubjects = isSelected 
                                                                                    ? currentSubjects.filter(s => s !== subj.id)
                                                                                    : [...currentSubjects, subj.id];
                                                                                return {
                                                                                    ...prev,
                                                                                    examSubjects: {
                                                                                        ...prev.examSubjects,
                                                                                        [type.id]: newSubjects
                                                                                    }
                                                                                };
                                                                            });
                                                                        }}
                                                                        className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                                                                    >
                                                                        {subj.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                            <ListChecks size={40} className="mx-auto text-slate-300 mb-3"/>
                                            <p className="text-slate-400 font-bold text-sm">Pilih kategori ujian di atas untuk mulai konfigurasi.</p>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Jenis ujian ini akan muncul pada pilihan saat mengatur ujian aktif dan pada kolom rekapitulasi nilai (Leger).</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Section 1.6: Mata Pelajaran */}
                {!isGuru && (
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                        <div 
                            className="flex justify-between items-center cursor-pointer mb-4"
                            onClick={() => setIsSubjectsOpen(!isSubjectsOpen)}
                        >
                            <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
                                <BookOpen size={18} className="text-emerald-500"/> Mata Pelajaran
                            </h4>
                            {isSubjectsOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                        </div>
                        
                        {isSubjectsOpen && (
                            <div className="space-y-4 fade-in">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        className="w-1/3 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 uppercase" 
                                        placeholder="Kode (Misal: IPA)"
                                        value={newSubjectId}
                                        onChange={e => setNewSubjectId(e.target.value.toUpperCase())}
                                    />
                                    <input 
                                        type="text" 
                                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" 
                                        placeholder="Nama Mata Pelajaran (Misal: Ilmu Pengetahuan Alam)"
                                        value={newSubjectLabel}
                                        onChange={e => setNewSubjectLabel(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (newSubjectId.trim() && newSubjectLabel.trim() && !formData.subjectsDb.find(s => s.id === newSubjectId.trim())) {
                                                    setFormData(prev => ({...prev, subjectsDb: [...prev.subjectsDb, { id: newSubjectId.trim(), label: newSubjectLabel.trim() }]}));
                                                    setNewSubjectId('');
                                                    setNewSubjectLabel('');
                                                }
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={() => {
                                            if (newSubjectId.trim() && newSubjectLabel.trim() && !formData.subjectsDb.find(s => s.id === newSubjectId.trim())) {
                                                setFormData(prev => ({...prev, subjectsDb: [...prev.subjectsDb, { id: newSubjectId.trim(), label: newSubjectLabel.trim() }]}));
                                                setNewSubjectId('');
                                                setNewSubjectLabel('');
                                            }
                                        }}
                                        className="bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center gap-2"
                                    >
                                        <Plus size={18}/> Tambah
                                    </button>
                                </div>
                                
                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                    <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                        {formData.subjectsDb.map((subj, idx) => (
                                            <li key={idx} className="flex justify-between items-center p-4 hover:bg-slate-50 transition">
                                                <div>
                                                    <span className="font-bold text-slate-700">{subj.label}</span>
                                                    <span className="text-xs text-slate-400 ml-2 font-mono bg-slate-100 px-2 py-1 rounded">{subj.id}</span>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev, 
                                                            subjectsDb: prev.subjectsDb.filter(s => s.id !== subj.id)
                                                        }));
                                                    }}
                                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg transition"
                                                >
                                                    <Trash2 size={18}/>
                                                </button>
                                            </li>
                                        ))}
                                        {formData.subjectsDb.length === 0 && (
                                            <li className="p-4 text-center text-slate-400 font-medium text-sm">Belum ada mata pelajaran.</li>
                                        )}
                                    </ul>
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Daftar mata pelajaran ini akan digunakan di seluruh aplikasi (Bank Soal, Hasil Ujian, Rekapitulasi).</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Section 2: Data Kepala Sekolah */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                    {isGuru && (
                        <div className="absolute top-0 right-0 bg-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-slate-300 flex items-center gap-1">
                            <Lock size={10} /> Data Terkunci
                        </div>
                    )}
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <UserSquare size={18} className="text-emerald-500"/> Kepala Sekolah
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Kepala Sekolah</label>
                            <div className="relative">
                                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                    placeholder="Nama Lengkap & Gelar"
                                    value={formData.principalName}
                                    onChange={e => setFormData({...formData, principalName: e.target.value})}
                                    readOnly={isGuru}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">NIP Kepala Sekolah</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                    placeholder="NIP"
                                    value={formData.principalNip}
                                    onChange={e => setFormData({...formData, principalNip: e.target.value})}
                                    readOnly={isGuru}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: Data Guru (With Auto-Lock Logic) */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                    {(currentUser.nama_lengkap || currentUser.username) && (
                        <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-amber-200 flex items-center gap-1">
                            <Lock size={10} /> Data Terkunci (Sesuai Login)
                        </div>
                    )}
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <UserSquare size={18} className="text-amber-500"/> Guru Kelas / Mapel
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Jabatan Guru</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    // UPDATED: Allow editing for Teacher Position even if user has a class assigned
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                    placeholder="Contoh: Guru Kelas 1 atau Guru PAI"
                                    value={formData.teacherPosition}
                                    onChange={e => setFormData({...formData, teacherPosition: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Guru</label>
                            <div className="relative">
                                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${!!currentUser.nama_lengkap ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
                                    placeholder="Nama Lengkap & Gelar"
                                    value={formData.teacherName}
                                    onChange={e => setFormData({...formData, teacherName: e.target.value})}
                                    disabled={!!currentUser.nama_lengkap}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">NIP Guru</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${!!currentUser.username ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
                                    placeholder="NIP"
                                    value={formData.teacherNip}
                                    onChange={e => setFormData({...formData, teacherNip: e.target.value})}
                                    disabled={!!currentUser.username}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showDeleteExamTypeModal}
                onClose={() => setShowDeleteExamTypeModal(false)}
                onConfirm={() => {
                    if (selectedExamTypeId) {
                        setFormData(prev => {
                            const newSignatories = { ...prev.examSignatories };
                            delete newSignatories[selectedExamTypeId];
                            const newExamSubjects = { ...prev.examSubjects };
                            delete newExamSubjects[selectedExamTypeId];
                            const newStatus = { ...prev.examTypesStatus };
                            delete newStatus[selectedExamTypeId];
                            
                            return {
                                ...prev, 
                                examTypes: prev.examTypes.filter(t => t.id !== selectedExamTypeId),
                                examSignatories: newSignatories,
                                examSubjects: newExamSubjects,
                                examTypesStatus: newStatus
                            };
                        });
                        showToast(`Kategori ${selectedExamTypeId} berhasil dihapus`, 'success');
                        setSelectedExamTypeId('');
                    }
                }}
                title="Hapus Kategori Ujian"
                message={`Apakah Anda yakin ingin menghapus kategori "${selectedExamTypeId}"? Seluruh pengaturan terkait kategori ini akan dihapus.`}
                confirmText="Hapus"
                cancelText="Batal"
                type="danger"
            />
        </div>
    );
};

export default KonfigurasiTab;
