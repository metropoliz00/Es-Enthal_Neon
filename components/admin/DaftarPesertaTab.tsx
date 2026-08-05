
import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { Users, FileText, Download, Upload, Loader2, Plus, Search, Edit, Trash2, X, Camera, Save, User as UserIcon, Check, Wand2, UserCog, Database, LogIn, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { api } from '../../src/services/api';
import { User } from '../../types';
import * as XLSX from 'xlsx';
import { exportToExcel, getExamTypes, isBereguExamType, TeamMemberBadge, getSchoolOnly } from '../../utils/adminHelpers';
import ConfirmationModal from '../ui/ConfirmationModal';

interface DaftarPesertaTabProps {
    currentUser: User;
    onDataChange: () => void;
    mode?: 'siswa' | 'staff'; // Mode to filter user types
    onSwitchUser?: (user: User) => void; 
}

const DaftarPesertaTab = ({ currentUser, onDataChange, mode = 'siswa', onSwitchUser }: DaftarPesertaTabProps) => {
    const { showToast } = useToast();
    const [users, setUsers] = useState<any[]>([]);
    const [appConfig, setAppConfig] = useState<Record<string, string>>({});
    const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);
    const [loginAsTargetUser, setLoginAsTargetUser] = useState<any | null>(null);
    const [examTypes, setExamTypes] = useState<{ id: string, label: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all'); 
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKelas, setFilterKelas] = useState('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Beregu state fields
    const [bereguTeamName, setBereguTeamName] = useState('');
    const [bereguMember1, setBereguMember1] = useState('');
    const [bereguMember2, setBereguMember2] = useState('');
    const [bereguMember3, setBereguMember3] = useState('');
    
    // Form data matches DB structure exactly
    const [formData, setFormData] = useState<{
        id: string; display_id?: string; username: string; password: string; fullname: string; role: string; 
        school: string; kelas: string; kecamatan: string; gender: string; photo?: string; photo_url?: string;
        exam_type: string;
    }>({ id: '', display_id: '', username: '', password: '', fullname: '', role: 'siswa', school: '', kelas: '', kecamatan: '', gender: 'L', photo: '', photo_url: '', exam_type: '' });
    
    // Reload users when mode changes
    useEffect(() => { 
        loadUsers(); 
        loadExamTypes();
    }, [mode]);

    // Automatic split for Beregu when exam type changes
    useEffect(() => {
        if (isModalOpen && isBereguExamType(formData.exam_type) && formData.fullname) {
            const parts = (formData.fullname || '').split('|').map((p: string) => p.trim());
            setBereguTeamName(parts[0] || '');
            setBereguMember1(parts[1] || '');
            setBereguMember2(parts[2] || '');
            setBereguMember3(parts[3] || '');
        }
    }, [formData.exam_type, isModalOpen]);

    const loadExamTypes = async () => {
        try {
            const config = await api.getAppConfig();
            setAppConfig(config);
            const types = getExamTypes(config);
            setExamTypes(types);
        } catch (e) {
            console.error("Failed to load exam types", e);
        }
    };

    // Automatic exam_type set based on selected role
    useEffect(() => {
        if (formData.role === 'Juri' || formData.role === 'juri' || formData.role === 'Operator Kecamatan') {
            if (formData.exam_type !== 'LCC') {
                setFormData(prev => ({ ...prev, exam_type: 'LCC' }));
            }
        } else if (formData.role === 'Proktor Sekolah') {
            if (formData.exam_type !== 'OSN' && formData.exam_type !== 'TKA') {
                setFormData(prev => ({ ...prev, exam_type: 'OSN' }));
            }
        }
    }, [formData.role]);
    
    const loadUsers = async () => { 
        setLoading(true); 
        try { 
            const data = await api.getUsers(); 
            // Filter by mode immediately upon load
            const filteredData = data.filter(u => mode === 'siswa' ? u.role === 'siswa' : (u.role === 'admin' || u.role === 'Guru' || u.role === 'Juri' || u.role === 'juri' || u.role === 'Operator Kecamatan' || u.role === 'Proktor Sekolah'));
            
            // Sort by created_at to ensure consistent numbering
            filteredData.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

            let counters: any = { admin: 0, Guru: 0, Juri: 0, 'Operator Kecamatan': 0, 'Proktor Sekolah': 0, siswa: {} };

            // Map data securely. API returns 'fullname', 'school', 'gender' directly from DB.
            const mappedData = filteredData.map(u => {
                let display_id = '';
                if (u.role === 'admin') {
                    counters.admin++;
                    display_id = `ADM-${String(counters.admin).padStart(2, '0')}`;
                } else if (u.role === 'Guru') {
                    counters.Guru++;
                    display_id = `GUR-${String(counters.Guru).padStart(2, '0')}`;
                } else if (u.role === 'Juri' || u.role === 'juri') {
                    counters.Juri++;
                    display_id = `JUR-${String(counters.Juri).padStart(2, '0')}`;
                } else if (u.role === 'Operator Kecamatan') {
                    counters['Operator Kecamatan']++;
                    display_id = `OPK-${String(counters['Operator Kecamatan']).padStart(2, '0')}`;
                } else if (u.role === 'Proktor Sekolah') {
                    counters['Proktor Sekolah']++;
                    display_id = `PRK-${String(counters['Proktor Sekolah']).padStart(2, '0')}`;
                } else {
                    const et = u.exam_type || 'NA';
                    if (!counters.siswa[et]) counters.siswa[et] = 0;
                    counters.siswa[et]++;
                    display_id = `SIS-${et}-${String(counters.siswa[et]).padStart(2, '0')}`;
                }

                const cleanSchool = getSchoolOnly(u.school || u.kelas_id || '');
                const cleanKelas = u.kelas || (u.school && u.school.includes(' | ') ? u.school.split(' | ')[0].trim() : '');
                return {
                    ...u,
                    school: cleanSchool, 
                    kelas: cleanKelas,
                    fullname: u.fullname || u.nama_lengkap || '', 
                    gender: u.gender || u.jenis_kelamin || 'L',
                    display_id
                };
            });
            setUsers(mappedData); 
        } catch(e) { console.error(e); } 
        finally { setLoading(false); } 
    };

    const handleDelete = (username: string) => { 
        setDeleteUserConfirm(username);
    };

    const confirmDeleteUserAction = async () => {
        if (!deleteUserConfirm) return;
        const username = deleteUserConfirm;
        setDeleteUserConfirm(null);
        setLoading(true); 
        try { 
            const res = await api.deleteUser(username); 
            if (res.success) {
                showToast("User berhasil dihapus.", "success");
                setUsers(prev => prev.filter(u => u.username !== username)); 
                onDataChange(); 
            } else {
                showToast("Gagal menghapus user. User tidak ditemukan.", "error");
            }
        } catch (e) { console.error(e); showToast("Terjadi kesalahan saat menghapus user.", "error"); } 
        finally { setLoading(false); } 
    };
    
    const handleEdit = (user: any) => { 
        let gugusVal = user.kelas || '';
        let schoolVal = getSchoolOnly(user.school || '');
        if (user.school && user.school.includes(' | ')) {
            const parts = user.school.split(' | ');
            if (!gugusVal) gugusVal = parts[0].trim();
            schoolVal = parts[1].trim();
        }

        setFormData({ 
            id: user.id || '', 
            display_id: user.display_id || '',
            username: user.username, 
            password: user.password, 
            fullname: user.fullname, 
            role: user.role, 
            school: schoolVal, 
            kelas: gugusVal,   
            kecamatan: user.kecamatan || '', 
            gender: user.gender || 'L',
            photo: '', 
            photo_url: user.photo_url || '',
            exam_type: user.exam_type || ''
        }); 
        
        if (isBereguExamType(user.exam_type)) {
            const parts = (user.fullname || '').split('|').map((p: string) => p.trim());
            setBereguTeamName(parts[0] || '');
            setBereguMember1(parts[1] || '');
            setBereguMember2(parts[2] || '');
            setBereguMember3(parts[3] || '');
        } else {
            setBereguTeamName('');
            setBereguMember1('');
            setBereguMember2('');
            setBereguMember3('');
        }
        setIsModalOpen(true); 
    };

    // --- FITUR LOGIN SEBAGAI USER LAIN (IMPERSONATION) ---
    const handleLoginAs = (targetUser: any) => {
        setLoginAsTargetUser(targetUser);
    };

    const confirmLoginAsAction = () => {
        if (!loginAsTargetUser) return;
        const targetUser = loginAsTargetUser;
        setLoginAsTargetUser(null);

        const userSession: User = {
            id: targetUser.id,
            username: targetUser.username,
            password: targetUser.password,
            role: targetUser.role as any,
            nama_lengkap: targetUser.fullname, 
            kelas_id: targetUser.school,
            kelas: targetUser.kelas,
            kecamatan: targetUser.kecamatan,
            jenis_kelamin: targetUser.gender,
            photo_url: targetUser.photo_url,
            active_exam: targetUser.active_exam || '',
            session: targetUser.session || '',
            active_tp: targetUser.active_tp || '',
            exam_type: targetUser.exam_type || ''
        };

        const sessionStr = JSON.stringify(userSession);
        localStorage.setItem('cbt_user', sessionStr);
        sessionStorage.setItem('cbt_user', sessionStr);
        localStorage.removeItem('cbt_admin_tab');

        if (onSwitchUser) {
            onSwitchUser(userSession);
        } else {
            window.location.href = '/';
        }
    };
    
    const getNextTeamName = (existingUsers: any[]) => {
        const teamNames = existingUsers
            .filter(u => isBereguExamType(u.exam_type))
            .map(u => (u.fullname || '').split('|')[0].trim());
        
        for (let i = 0; i < 26; i++) {
            const char = String.fromCharCode(65 + i);
            const candidate = `Regu ${char}`;
            if (!teamNames.includes(candidate)) {
                return candidate;
            }
        }
        return "Regu A";
    };

    const handleAdd = () => { 
        setFormData({ 
            id: '', 
            display_id: '',
            username: '', 
            password: '', 
            fullname: '', 
            role: mode === 'siswa' ? 'siswa' : 'Guru', 
            school: currentUser.role === 'Guru' ? currentUser.kelas_id : '', 
            kelas: '', 
            kecamatan: currentUser.role === 'Guru' ? (currentUser.kecamatan || '') : '', 
            gender: 'L', 
            photo: '', 
            photo_url: '',
            exam_type: currentUser.role === 'Operator Kecamatan' ? 'LCC' : currentUser.role === 'Proktor Sekolah' ? 'OSN' : ''
        }); 
        setBereguTeamName(getNextTeamName(users));
        setBereguMember1('');
        setBereguMember2('');
        setBereguMember3('');
        setIsModalOpen(true); 
    };
    
    const handleSave = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        setIsSaving(true); 
        try { 
            let finalFormData = { ...formData };
            if (formData.role === 'siswa' && isBereguExamType(formData.exam_type)) {
                // Combine team name and members with separator "|"
                const combined = [bereguTeamName, bereguMember1, bereguMember2, bereguMember3]
                    .map(s => s.trim())
                    .filter(Boolean)
                    .join(' | ');
                finalFormData.fullname = combined;

                finalFormData.school = getSchoolOnly(formData.school);
                finalFormData.kelas = formData.kelas ? formData.kelas.trim() : '';
            }
            const res = await api.saveUser(finalFormData); 
            if (!res.success) {
                showToast("Gagal menyimpan data: " + res.message, "error");
            } else {
                await loadUsers(); 
                setIsModalOpen(false); 
                onDataChange(); 
                showToast("Data berhasil disimpan", "success");
            }
        } catch (e) { 
            console.error(e); 
            showToast("Terjadi kesalahan sistem.", "error"); 
        } finally { 
            setIsSaving(false); 
        } 
    };
    
    const handleToggleExamType = async (user: any, typeId: string) => {
        if (isSaving) return;
        
        // If already active, deactivate. Otherwise activate this one.
        const newType = user.exam_type === typeId ? '' : typeId;
        
        // Optimistic update
        setUsers(prev => prev.map(u => u.username === user.username ? { ...u, exam_type: newType } : u));
        
        try {
            // Use saveUser but only update exam_type. 
            // In this app, saveUser takes the whole object.
            const updatedUser = {
                ...user,
                exam_type: newType
            };
            await api.saveUser(updatedUser);
            showToast(`Jenis ujian ${user.fullname} diperbarui.`, "success");
        } catch (e) {
            console.error(e);
            showToast("Gagal memperbarui jenis ujian.", "error");
            // Rollback
            setUsers(prev => prev.map(u => u.username === user.username ? { ...u, exam_type: user.exam_type } : u));
        }
    };

    const uniqueSchools = useMemo<string[]>(() => { const schools = new Set(users.map(u => getSchoolOnly(u.school)).filter(Boolean)); return Array.from(schools).sort() as string[]; }, [users]);
    const uniqueClasses = useMemo<string[]>(() => { const classes = new Set(users.map(u => u.kelas).filter(Boolean)); return Array.from(classes).sort() as string[]; }, [users]);
    
    const filteredUsers = useMemo(() => { 
        let res = users; 
        if (filterRole !== 'all') res = res.filter(u => u.role === filterRole); 
        if (filterSchool !== 'all') res = res.filter(u => u.school === filterSchool); 
        if (filterKelas && filterKelas.toLowerCase() !== 'all') {
            const lower = filterKelas.toLowerCase();
            res = res.filter(u => u.kelas && u.kelas.toLowerCase().includes(lower));
        }
        if (searchTerm) { 
            const lower = searchTerm.toLowerCase(); 
            res = res.filter(u => 
                (u.username || '').toLowerCase().includes(lower) || 
                (u.fullname || '').toLowerCase().includes(lower) || 
                (u.school && u.school.toLowerCase().includes(lower)) || 
                (u.id && u.id.toLowerCase().includes(lower))
            ); 
        } 
        if (currentUser.role === 'Guru') res = res.filter(u => u.role === 'siswa' && (u.school || '').toLowerCase() === (currentUser.kelas_id || '').toLowerCase()); 
        if (['Operator Kecamatan', 'Gugus', 'Juri', 'juri'].includes(currentUser.role)) {
            res = res.filter(u => {
                if (u.role !== 'siswa') return false;
                if (currentUser.kecamatan && currentUser.kecamatan.toLowerCase() !== 'all' && currentUser.kecamatan !== '-') {
                    if ((u.kecamatan || '').toLowerCase() !== currentUser.kecamatan.toLowerCase()) return false;
                }
                if (currentUser.kelas && currentUser.kelas.toLowerCase() !== 'all' && currentUser.kelas !== '-') {
                    if ((u.kelas || '').toLowerCase() !== currentUser.kelas.toLowerCase()) return false;
                }
                return true;
            });
        }
        if (currentUser.role === 'Proktor Sekolah') res = res.filter(u => u.role === 'siswa' && (u.exam_type === 'OSN' || u.exam_type === 'TKA')); 
        
        // Sort by Name
        return res.sort((a, b) => {
            const nameA = (a.fullname || a.username || '').toLowerCase();
            const nameB = (b.fullname || b.username || '').toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    }, [users, filterRole, filterSchool, filterKelas, searchTerm, currentUser, sortOrder]);
    
    // ... (Export logic unchanged) ...
    const handleExport = () => { 
        const dataToExport = filteredUsers.map((u) => {
            const row: any = {
                "ID": u.display_id || u.id, // Export display_id if available
                "PhotoURL": u.photo_url,    // 2 
                "Username": u.username,     // 3
                "Password": u.password,     // 4
                "Nama Lengkap": u.fullname, // 5
                "Jenis Kelamin": u.gender,  // 6
                "Role": u.role,             // 7
            };
            // UNIFIED: Both modes export 'Kelas' to ensure data integrity
            row["Kelas"] = u.kelas; 
            row["Sekolah"] = getSchoolOnly(u.school);      // 9
            row["Kecamatan"] = u.kecamatan; // 10
            return row;
        }); 
        exportToExcel(dataToExport, mode === 'siswa' ? "DB_Siswa_UI_Format" : "DB_Admin_UI_Format", "Sheet1"); 
    };
    
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (!e.target.files || e.target.files.length === 0) return; 
        setIsImporting(true); 
        const file = e.target.files[0]; 
        const reader = new FileReader(); 
        reader.onload = async (evt) => { 
            try { 
                const bstr = evt.target?.result; 
                const wb = XLSX.read(bstr, { type: 'binary' }); 
                const wsName = wb.SheetNames[0]; 
                const ws = wb.Sheets[wsName]; 
                
                const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }); 
                const parsedUsers = []; 
                
                for (let i = 1; i < data.length; i++) { 
                    const row: any = data[i]; 
                    if (!row[2]) continue; 
                    
                    parsedUsers.push({ 
                        id: String(row[0] || (mode === 'siswa' ? 'SIS-' : 'ADM-') + Math.floor(Math.random()*100000)),
                        photo_url: String(row[1] || ''), 
                        username: String(row[2]), 
                        password: String(row[3]), 
                        fullname: String(row[4]), 
                        gender: String(row[5] || 'L').toUpperCase(),
                        role: String(row[6] || (mode === 'siswa' ? 'siswa' : 'Guru')), 
                        kelas: String(row[7] || ''), // Unified column 7
                        school: String(row[8] || ''), 
                        kecamatan: String(row[9] || '') 
                    }); 
                } 
                
                if (parsedUsers.length > 0) { 
                    await api.importUsers(parsedUsers); 
                    showToast(`Berhasil mengimpor ${parsedUsers.length} data ke database.`, "success"); 
                    await loadUsers(); 
                    onDataChange(); 
                } else { 
                    showToast(`Data tidak ditemukan. Pastikan format Excel sesuai Template.`, "warning"); 
                } 
            } catch (err) { 
                console.error(err); 
                showToast("Gagal membaca file Excel.", "error"); 
            } finally { 
                setIsImporting(false); 
                if (e.target) e.target.value = ''; 
            } 
        }; 
        reader.readAsBinaryString(file); 
    };
    
    // ... (Template download and image change unchanged) ...
    const downloadTemplate = () => { 
        const rowData: any = { 
            "ID": "AUTO", 
            "PhotoURL": "", 
            "Username": "user01", 
            "Password": "123", 
            "Nama Lengkap": mode === 'siswa' ? "Nama Siswa" : "Nama Guru", 
            "Jenis Kelamin": "L",
            "Role": mode === 'siswa' ? "siswa" : "Guru", 
        };
        // UNIFIED TEMPLATE COLUMN
        rowData["Kelas"] = mode === 'siswa' ? "6" : "6"; // Default numeric for both
        rowData["Sekolah"] = "SDN CONTOH";
        rowData["Kecamatan"] = "KOTA";
        const ws = XLSX.utils.json_to_sheet([ rowData ]); 
        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "Template_DB"); 
        XLSX.writeFile(wb, `Template_DB_${mode === 'siswa' ? 'Siswa' : 'Admin_Guru'}.xlsx`); 
    };
    
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { showToast("Ukuran file maksimal 2MB", "warning"); return; }
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxSize = 500;
                    let width = img.width; let height = img.height;
                    if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
                    canvas.width = Math.floor(width); canvas.height = Math.floor(height);
                    if (ctx) { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); const dataUrl = canvas.toDataURL('image/jpeg', 0.9); setFormData(prev => ({ ...prev, photo: dataUrl })); }
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const title = mode === 'siswa' ? "Data Siswa" : "Data Admin dan Guru";
    const icon = mode === 'siswa' ? <Database size={24} className="text-indigo-600"/> : <UserCog size={24} className="text-indigo-600"/>;

    return (
        <div className="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-6 fade-in space-y-6">
             {/* Header */}
             <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-100 pb-6">
                 <div>
                     <h3 className="font-black text-2xl text-slate-800 flex items-center gap-2">{icon} {title}</h3>
                     <p className="text-slate-400 text-sm font-medium mt-1">Total {filteredUsers.length} data.</p>
                 </div>
                 <div className="flex flex-wrap gap-3">
                    <button onClick={handleExport} className="bg-white text-emerald-600 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-50 transition border-2 border-emerald-100 shadow-sm active:scale-95"><FileText size={16}/> Export</button>
                    {currentUser.role === 'admin' && (
                        <>
                        <button onClick={downloadTemplate} className="bg-white text-slate-500 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition border-2 border-slate-200 active:scale-95"><Download size={16}/> Template</button>
                        <label className={`cursor-pointer bg-emerald-50 text-emerald-600 border-2 border-emerald-100 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-100 transition active:scale-95 ${isImporting ? 'opacity-50 cursor-wait' : ''}`}>
                            {isImporting ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} Import
                            <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} disabled={isImporting} />
                        </label>
                        </>
                    )}
                    <button onClick={handleAdd} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95"><Plus size={16}/> Tambah</button>
                 </div>
             </div>
             
             {/* Filter Bar */}
             <div className="flex flex-col md:flex-row gap-4 bg-slate-50/50 p-1 rounded-2xl">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    <input type="text" placeholder="Cari ID, Username, Nama..." className="w-full pl-11 pr-4 py-3 border-2 border-slate-100 rounded-xl text-sm outline-none focus:border-indigo-500 bg-white font-bold text-slate-600 transition-colors" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                {currentUser.role === 'admin' && (
                    <>
                    <select className="p-3 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-500 outline-none focus:border-indigo-500 bg-white cursor-pointer hover:border-slate-300 appearance-none" value={filterSchool} onChange={e => setFilterSchool(e.target.value)}><option value="all">Semua Sekolah</option>{uniqueSchools.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    {/* Unified Filter Kelas/Gugus for both modes */}
                    <input type="text" placeholder="Filter Kelas/Gugus (ketik 'all' untuk semua)" className="w-full md:w-auto p-3 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 bg-white" value={filterKelas} onChange={e => setFilterKelas(e.target.value)} />
                    </>
                )}
                <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')} className="p-3 bg-white border-2 border-slate-100 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition shadow-sm w-[50px] flex items-center justify-center" title={sortOrder === 'asc' ? "Urutkan Z-A" : "Urutkan A-Z"}>
                    {sortOrder === 'asc' ? <ArrowDownAZ size={20}/> : <ArrowUpZA size={20}/>}
                </button>
             </div>

             {/* DATABASE TABLE STRUCTURE */}
             <div className="overflow-x-auto rounded-2xl border border-slate-100">
                 <table className="w-full text-xs text-left whitespace-nowrap">
                     <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                         <tr>
                             <th className="p-4 border-r border-slate-200 min-w-[80px]">ID</th>
                             <th className="p-4 border-r border-slate-200 text-center w-16">Foto</th>
                             <th className="p-4 border-r border-slate-200">Username</th>
                             <th className="p-4 border-r border-slate-200">Password</th>
                             <th className="p-4 border-r border-slate-200 min-w-[200px]">Nama Lengkap</th>
                             <th className="p-4 border-r border-slate-200 text-center">L/P</th>
                             <th className="p-4 border-r border-slate-200">Role</th>
                             <th className="p-4 border-r border-slate-200 text-center">Kelas</th>
                             <th className="p-4 border-r border-slate-200">Sekolah</th>
                             <th className="p-4 border-r border-slate-200">Kecamatan</th>
                             <th className="p-4 border-r border-slate-200 min-w-[150px]">Jenis Ujian</th>
                             <th className="p-4 text-center">Aksi</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 bg-white">
                         {loading ? (<tr><td colSpan={12} className="p-12 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2"/> Sinkronisasi Database...</td></tr>) : filteredUsers.length === 0 ? (<tr><td colSpan={12} className="p-12 text-center text-slate-400 italic">Data tidak ditemukan.</td></tr>) : (filteredUsers.map((u, i) => (
                         <tr key={i} className="hover:bg-slate-50 transition group">
                             <td className="p-3 border-r border-slate-100 font-mono text-slate-400 font-bold">{u.display_id}</td>
                             <td className="p-3 border-r border-slate-100 text-center">
                                 <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                                     {(() => {
                                         const isBeregu = isBereguExamType(u.exam_type);
                                         const logoRegu = u.photo_url || appConfig['LOGO_SEKOLAH'] || appConfig['LOGO_KABUPATEN'];
                                         if (isBeregu) {
                                             return logoRegu ? (
                                                 <img src={logoRegu} className="w-full h-full object-contain p-0.5" alt="Logo Regu" />
                                             ) : (
                                                 <UserIcon size={16} />
                                             );
                                         }
                                         return u.photo_url ? (
                                             <img src={u.photo_url} className="w-full h-full object-cover" alt="Foto" />
                                         ) : (
                                             <UserIcon size={16} />
                                         );
                                     })()}
                                 </div>
                             </td>
                             <td className="p-3 border-r border-slate-100 font-mono text-indigo-600 font-bold">{u.username}</td>
                             <td className="p-3 border-r border-slate-100 font-mono text-slate-400">{u.password || '***'}</td>
                             <td className="p-3 border-r border-slate-100 font-bold text-slate-700">
                                 {isBereguExamType(u.exam_type) ? (
                                     <TeamMemberBadge rawName={u.fullname} theme="indigo" size="sm" align="left" />
                                 ) : (
                                     u.fullname
                                 )}
                             </td>
                             <td className="p-3 border-r border-slate-100 text-center font-bold text-slate-500">{u.gender || 'L'}</td>
                             <td className="p-3 border-r border-slate-100">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${u.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-100' : u.role === 'Guru' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                    {u.role}
                                </span>
                             </td>
                             <td className="p-3 border-r border-slate-100 text-center font-bold text-slate-600">
                                 {/* Display numeric class for both Student and Guru */}
                                 {u.kelas || '-'}
                             </td>
                             <td className="p-3 border-r border-slate-100 text-slate-600 font-medium">{getSchoolOnly(u.school) || '-'}</td>
                             <td className="p-3 border-r border-slate-100 text-slate-500">{u.kecamatan || '-'}</td>
                             <td className="p-3 border-r border-slate-100">
                                 <div className="flex flex-wrap gap-1.5">
                                     {u.exam_type ? (
                                         <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-indigo-600 text-white border border-indigo-600 shadow-sm">
                                             {examTypes.find(t => t.id === u.exam_type)?.label || u.exam_type}
                                         </span>
                                     ) : (
                                         <span className="text-slate-300 italic text-[10px]">Belum diatur</span>
                                     )}
                                 </div>
                             </td>
                             <td className="p-3 flex justify-center gap-2">
                                 {/* SUPER ADMIN LOGIN AS FEATURE (Works for both Students and Teachers lists) */}
                                 {currentUser.role === 'admin' && (
                                     <button 
                                        onClick={() => handleLoginAs(u)} 
                                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 border border-indigo-100 transition shadow-sm"
                                        title="Masuk sebagai user ini"
                                     >
                                         <LogIn size={14}/>
                                     </button>
                                 )}
                                 <button onClick={() => handleEdit(u)} className="p-1.5 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 border border-amber-100 transition"><Edit size={14}/></button>
                                 <button onClick={() => handleDelete(u.username)} className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 border border-rose-100 transition"><Trash2 size={14}/></button>
                             </td>
                         </tr>)))}
                     </tbody>
                 </table>
             </div>

             {isModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in">
                     <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col border border-white/20 transform scale-100 transition-all">
                         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
                             <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">{formData.id ? 'Edit Data Database' : 'Tambah Data Baru'}</h3>
                             <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                         </div>
                         <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div className="flex items-center gap-6">
                                    <div className="relative group shrink-0">
                                        <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-200 flex items-center justify-center text-slate-400">
                                            {(() => {
                                                const isBeregu = isBereguExamType(formData.exam_type);
                                                const defaultLogo = appConfig['LOGO_SEKOLAH'] || appConfig['LOGO_KABUPATEN'];
                                                const displayImg = formData.photo || formData.photo_url || (isBeregu ? defaultLogo : '');
                                                if (displayImg) {
                                                    return <img src={displayImg} className={`w-full h-full ${isBeregu ? 'object-contain p-1' : 'object-cover'}`} alt="Foto/Logo" />;
                                                }
                                                return <UserIcon size={40} className="text-slate-300" />;
                                            })()}
                                        </div>
                                        <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-indigo-700 shadow-md border-2 border-white" title="Unggah File Foto/Logo"><Upload size={12}/><input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageChange} /></label>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">ID (Otomatis)</label>
                                            <input disabled type="text" className="w-full p-2.5 bg-slate-100 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-500 font-mono" value={formData.display_id || 'Otomatis'} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">
                                                {isBereguExamType(formData.exam_type) ? 'URL Logo Regu (Opsional)' : 'URL Foto (Opsional)'}
                                            </label>
                                            <input 
                                                type="text" 
                                                className="w-full p-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-500" 
                                                value={formData.photo_url || ''} 
                                                onChange={e => setFormData({ ...formData, photo_url: e.target.value })} 
                                                placeholder="https://..." 
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username</label><input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password</label><input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
                                </div>
                                <div>
                                    {formData.role === 'siswa' && isBereguExamType(formData.exam_type) ? (
                                        <div className="space-y-3 p-4 bg-amber-50/40 rounded-2xl border border-amber-200/60">
                                            <div className="flex justify-between items-center">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Nama Regu / Tim</label>
                                                <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                                                    Format Beregu (LCC)
                                                </span>
                                            </div>
                                            <input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={bereguTeamName} onChange={e => setBereguTeamName(e.target.value)} placeholder="Contoh: Regu A" />
                                            
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Anggota 1 (Ketua)</label>
                                                <input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={bereguMember1} onChange={e => setBereguMember1(e.target.value)} placeholder="Nama Anggota 1" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Anggota 2</label>
                                                <input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={bereguMember2} onChange={e => setBereguMember2(e.target.value)} placeholder="Nama Anggota 2" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Anggota 3</label>
                                                <input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={bereguMember3} onChange={e => setBereguMember3(e.target.value)} placeholder="Nama Anggota 3" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Nama Lengkap</label>
                                            </div>
                                            <input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.fullname} onChange={e => setFormData({...formData, fullname: e.target.value})} placeholder="Nama Lengkap" />
                                        </div>
                                    )}
                                </div>
                                <div className={`grid ${!(mode === 'siswa' && isBereguExamType(formData.exam_type)) ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role</label>
                                        <select className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} disabled={currentUser.role !== 'admin' || mode === 'siswa'}>
                                            {mode === 'siswa' ? <option value="siswa">Siswa</option> : <><option value="Guru">Guru</option><option value="Juri">Juri LCC</option><option value="Operator Kecamatan">Operator Kecamatan / Gugus</option><option value="Proktor Sekolah">Proktor Sekolah</option><option value="admin">Admin Pusat</option></>}
                                        </select>
                                    </div>
                                    {!(mode === 'siswa' && isBereguExamType(formData.exam_type)) && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Jenis Kelamin (L/P)</label>
                                            <select className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}><option value="L">L</option><option value="P">P</option></select>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Unified Class Selector / Gugus for BOTH Student and Staff */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                        {( (mode === 'siswa' && isBereguExamType(formData.exam_type)) || (['Operator Kecamatan', 'Gugus', 'Juri'].includes(formData.role) && formData.exam_type === 'LCC') ) ? 'Nama Gugus' : (mode === 'siswa' ? 'Kelas Siswa' : 'Kelas Ampuan (Kosongkan jika semua kelas)')}
                                    </label>
                                    {( (mode === 'siswa' && isBereguExamType(formData.exam_type)) || (['Operator Kecamatan', 'Gugus', 'Juri'].includes(formData.role) && formData.exam_type === 'LCC') ) ? (
                                        <input 
                                            type="text" 
                                            className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" 
                                            value={formData.kelas} 
                                            onChange={e => setFormData({...formData, kelas: e.target.value})} 
                                            placeholder="Contoh: Gugus 1" 
                                            required
                                        />
                                    ) : (
                                        <select className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.kelas} onChange={e => setFormData({...formData, kelas: e.target.value})}>
                                            <option value="">-- Pilih Kelas --</option>
                                            {/* Allow "All Classes" for Guru Mapel/Admin */}
                                            {mode !== 'siswa' && <option value="">Semua Kelas</option>}
                                            {[1,2,3,4,5,6].map(k => <option key={k} value={String(k)}>Kelas {k}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Jenis Ujian</label>
                                    <select 
                                        className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" 
                                        value={formData.exam_type} 
                                        onChange={e => setFormData({...formData, exam_type: e.target.value})}
                                        disabled={currentUser.role === 'Operator Kecamatan'}
                                    >
                                        {currentUser.role === 'Operator Kecamatan' ? (
                                            <option value="LCC">Lomba Cerdas Cermat</option>
                                        ) : currentUser.role === 'Proktor Sekolah' ? (
                                            <>
                                                <option value="OSN">OSN</option>
                                                <option value="TKA">TKA</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="">-- Tidak Ada --</option>
                                                {examTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                            </>
                                        )}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sekolah</label><input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.school} onChange={e => setFormData({...formData, school: e.target.value})} placeholder="Nama Sekolah" /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Kecamatan</label><input type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.kecamatan} onChange={e => setFormData({...formData, kecamatan: e.target.value})} placeholder="Kecamatan"/></div>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 border-2 border-slate-200 text-slate-500 rounded-xl font-bold hover:bg-slate-100 transition">Batal</button>
                                    <button type="submit" disabled={isSaving} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex justify-center items-center gap-2">{isSaving ? <Loader2 size={20} className="animate-spin"/> : <Check size={20}/>} Simpan</button>
                                </div>
                            </form>
                         </div>
                     </div>
                 </div>
             )}

            <ConfirmationModal
                isOpen={deleteUserConfirm !== null}
                onClose={() => setDeleteUserConfirm(null)}
                onConfirm={confirmDeleteUserAction}
                title="Hapus Pengguna"
                message={`Apakah Anda yakin ingin menghapus user ${deleteUserConfirm} dari Database?`}
                confirmText="Hapus"
                cancelText="Batal"
                type="danger"
            />

            <ConfirmationModal
                isOpen={loginAsTargetUser !== null}
                onClose={() => setLoginAsTargetUser(null)}
                onConfirm={confirmLoginAsAction}
                title="Masuk Sebagai Pengguna"
                message={loginAsTargetUser ? `Masuk sebagai ${loginAsTargetUser.fullname} (${loginAsTargetUser.role === 'siswa' ? 'Siswa' : loginAsTargetUser.role === 'Guru' ? 'Guru' : 'Admin'})?\n\nSesi Admin Anda akan berakhir sementara.` : ''}
                confirmText="Ya, Masuk"
                cancelText="Batal"
                type="warning"
            />
        </div>
    );
};

export default DaftarPesertaTab;
