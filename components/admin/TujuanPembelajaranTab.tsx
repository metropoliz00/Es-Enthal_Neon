
import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { Target, Plus, Download, Upload, Search, Edit, Trash2, Loader2, X, Save, FileText, BookOpen, Wand2 } from 'lucide-react';
import { api } from '../../src/services/api';
import { LearningObjective } from '../../types';
import * as XLSX from 'xlsx';
import { exportToExcel, getSubjects } from '../../utils/adminHelpers';
import ConfirmationModal from '../ui/ConfirmationModal';

const TujuanPembelajaranTab = () => {
    const { showToast } = useToast();
    const [subjectsDb, setSubjectsDb] = useState<{id: string, label: string}[]>([]);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [objectives, setObjectives] = useState<LearningObjective[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMapel, setFilterMapel] = useState('all');
    const [filterKelas, setFilterKelas] = useState('all');
    const [filterId, setFilterId] = useState('all'); // New State for ID Filter
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState<LearningObjective>({ id: '', mapel: '', materi: '', kelas: '', text_tujuan: '' });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const config = await api.getAppConfig();
            setSubjectsDb(getSubjects(config));

            const data = await api.getLearningObjectives();
            setObjectives(data);
        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    };

    const uniqueMapel = useMemo(() => Array.from(new Set(objectives.map(o => o.mapel).filter(Boolean))).sort(), [objectives]);
    const uniqueKelas = useMemo(() => Array.from(new Set(objectives.map(o => o.kelas).filter(Boolean))).sort(), [objectives]);
    // Extract Unique IDs for Filter
    const uniqueIds = useMemo(() => Array.from(new Set(objectives.map(o => o.id).filter(Boolean))).sort(), [objectives]);

    const filteredObjectives = useMemo(() => {
        return objectives.filter(o => {
            const matchSearch = (o.text_tujuan || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (o.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (o.mapel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (o.materi && o.materi.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchMapel = filterMapel === 'all' || o.mapel === filterMapel;
            const matchKelas = filterKelas === 'all' || o.kelas === filterKelas;
            const matchId = filterId === 'all' || o.id === filterId; // Apply ID Filter
            
            return matchSearch && matchMapel && matchKelas && matchId;
        });
    }, [objectives, searchTerm, filterMapel, filterKelas, filterId]);

    const handleEdit = (obj: LearningObjective) => {
        setFormData(obj);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        // Auto-fill Mapel and Kelas from filters if selected
        const defaultMapel = filterMapel !== 'all' ? filterMapel : '';
        const defaultKelas = filterKelas !== 'all' ? filterKelas : '';
        
        setFormData({ 
            id: '', 
            mapel: defaultMapel, 
            materi: '', 
            kelas: defaultKelas, 
            text_tujuan: '' 
        });
        setIsModalOpen(true);
    };

    const generateId = () => {
        if (!formData.mapel || !formData.kelas) {
            showToast("Pilih Mapel dan Kelas terlebih dahulu untuk generate ID.", "warning");
            return;
        }
        
        // Find Subject Code
        const subj = subjectsDb.find(s => s.label === formData.mapel);
        const code = subj ? subj.id : formData.mapel.substring(0, 3).toUpperCase();
        
        // Random number 3 digits
        const rand = Math.floor(Math.random() * 900) + 100;
        
        const newId = `TP-${code}-K${formData.kelas}-${rand}`;
        setFormData(prev => ({ ...prev, id: newId }));
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDeleteObjective = async () => {
        if (!deleteConfirmId) return;
        const id = deleteConfirmId;
        setDeleteConfirmId(null);
        const original = [...objectives];
        setObjectives(prev => prev.filter(o => o.id !== id));
        
        try {
            const res = await api.deleteLearningObjective(id);
            if (res.success) {
                showToast("Tujuan Pembelajaran berhasil dihapus", "success");
            } else {
                showToast("Gagal menghapus data dari database: " + (res.message || "Error"), "error");
                setObjectives(original);
            }
        } catch(e: any) { 
            console.error(e);
            showToast("Gagal menghapus data dari database: " + (e.message || "Error"), "error");
            setObjectives(original); // Revert on error
        } 
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await api.saveLearningObjective(formData);
            if (res.success) {
                await loadData();
                setIsModalOpen(false);
                showToast("Tujuan Pembelajaran berhasil disimpan", "success");
            } else {
                showToast("Gagal menyimpan ke database: " + (res.message || "Error"), "error");
            }
        } catch(e: any) { showToast("Gagal menyimpan: " + (e.message || "Error"), "error"); } 
        finally { setIsSaving(false); }
    };

    const downloadTemplate = () => {
        // Smart Template: Use active filters
        const defaultMapel = filterMapel !== 'all' ? filterMapel : "Matematika";
        const defaultKelas = filterKelas !== 'all' ? filterKelas : "1";
        
        // Try to generate a smart ID example
        const subj = subjectsDb.find(s => s.label === defaultMapel);
        const code = subj ? subj.id : "MTK";
        const exampleId = `TP-${code}-K${defaultKelas}-101`;

        const data = [{ 
            "ID": exampleId, 
            "Mapel": defaultMapel, 
            "Materi": "Bilangan Bulat",
            "Kelas": defaultKelas, 
            "Tujuan Pembelajaran": "Peserta didik dapat melakukan operasi..." 
        }];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template_TP");
        XLSX.writeFile(wb, "Template_Tujuan_Pembelajaran.xlsx");
    };

    const handleExport = () => {
        const exportData = filteredObjectives.map((o, i) => ({
            "No": i+1,
            "ID": o.id,
            "Mapel": o.mapel,
            "Materi": o.materi,
            "Kelas": o.kelas,
            "Tujuan Pembelajaran": o.text_tujuan
        }));
        exportToExcel(exportData, "Data_Tujuan_Pembelajaran", "TP");
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
                const ws = wb.Sheets[wb.SheetNames[0]];
                // Changed to header: 1 to get array of arrays
                const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
                
                const parsed: LearningObjective[] = [];
                // Expecting Header Row 0: ID, Mapel, Materi, Kelas, Tujuan Pembelajaran
                // Start from row 1 (actual data)
                for (let i = 1; i < data.length; i++) {
                    const row: any = data[i];
                    // Skip completely empty rows
                    if (!row || row.length === 0) continue;
                    
                    let id = String(row[0] || "").trim();
                    let mapel = String(row[1] || "").trim();
                    const materi = String(row[2] || "").trim();
                    const kelas = String(row[3] || "").trim();
                    const text_tujuan = String(row[4] || "").trim();
                    
                    // 1. Logic: Jika Mapel di Excel kosong, tapi user sedang memfilter mapel tertentu,
                    // gunakan filter tersebut sebagai mapel default.
                    if (!mapel && filterMapel !== 'all') {
                        mapel = filterMapel;
                    }

                    // Jika masih kosong (tidak ada di excel dan filter = all), skip atau beri default?
                    // Kita skip jika ID juga kosong.
                    if (!id && !mapel) continue;

                    // 2. Logic: Auto Generate ID jika kosong
                    if (!id && mapel) {
                         // Cari kode mapel dari DB Subject
                         const subj = subjectsDb.find(s => s.label.toLowerCase() === mapel.toLowerCase());
                         const code = subj ? subj.id : mapel.substring(0, 3).toUpperCase();
                         // Generate ID unik: TP-[MAPEL]-K[KELAS]-[RANDOM]
                         const kCode = kelas ? `K${kelas}` : 'KX';
                         const rand = Math.floor(Math.random() * 100000);
                         id = `TP-${code}-${kCode}-${rand}`;
                    }
                    
                    parsed.push({
                        id: id,
                        mapel: mapel,
                        materi: materi,
                        kelas: kelas,
                        text_tujuan: text_tujuan
                    });
                }
                
                if (parsed.length > 0) {
                    await api.importLearningObjectives(parsed);
                    showToast(`Berhasil impor ${parsed.length} data.`, "success");
                    await loadData();
                } else {
                    showToast("Data kosong atau format salah.", "warning");
                }
            } catch(e) { console.error(e); showToast("Gagal membaca file.", "error"); } 
            finally { setImporting(false); if(e.target) e.target.value = ''; }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-6 fade-in">
             <div className="bg-white p-6 rounded-[1.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div>
                    <h3 className="font-black text-xl text-slate-800 flex items-center gap-2"><Target size={28} className="text-indigo-600"/> Tujuan Pembelajaran (TP)</h3>
                    <p className="text-slate-400 text-sm font-medium mt-1">Kelola data capaian pembelajaran per mapel, materi, dan kelas.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button onClick={handleExport} className="bg-white text-emerald-600 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-50 transition border-2 border-emerald-100 shadow-sm active:scale-95"><FileText size={16}/> Export Excel</button>
                    <button onClick={downloadTemplate} className="bg-white text-slate-500 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition border-2 border-slate-200 active:scale-95"><Download size={16}/> Template</button>
                    <label className={`cursor-pointer bg-emerald-50 text-emerald-600 border-2 border-emerald-100 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-100 transition active:scale-95 ${importing ? 'opacity-50 cursor-wait' : ''}`}>
                        {importing ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} Import
                        <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} disabled={importing} />
                    </label>
                    <button onClick={handleAdd} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95"><Plus size={16}/> Tambah TP</button>
                </div>
             </div>

             <div className="flex flex-col md:flex-row gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Cari ID, Mapel, Materi, atau Isi Tujuan..." className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 bg-white font-bold text-slate-600" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                {/* ID FILTER */}
                <select className="p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 bg-white outline-none focus:border-indigo-500 cursor-pointer w-full md:w-48 truncate" value={filterId} onChange={e => setFilterId(e.target.value)}>
                    <option value="all">Semua ID TP</option>
                    {uniqueIds.map(id => <option key={id} value={id}>{id}</option>)}
                </select>
                <select className="p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 bg-white outline-none focus:border-indigo-500 cursor-pointer" value={filterMapel} onChange={e => setFilterMapel(e.target.value)}><option value="all">Semua Mapel</option>{uniqueMapel.map(s => <option key={s} value={s}>{s}</option>)}</select>
                <select className="p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 bg-white outline-none focus:border-indigo-500 cursor-pointer" value={filterKelas} onChange={e => setFilterKelas(e.target.value)}><option value="all">Semua Kelas</option>{uniqueKelas.map(s => <option key={s} value={s}>{s}</option>)}</select>
             </div>

             <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                 <table className="w-full text-sm text-left">
                     <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[11px]">
                         <tr>
                             <th className="p-4 w-24">ID TP</th>
                             <th className="p-4 w-40">Mata Pelajaran</th>
                             <th className="p-4 w-40">Materi</th>
                             <th className="p-4 w-24">Kelas</th>
                             <th className="p-4">Deskripsi Tujuan Pembelajaran</th>
                             <th className="p-4 text-center w-32">Aksi</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {loading ? <tr><td colSpan={6} className="p-12 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2"/> Memuat data...</td></tr> : 
                          filteredObjectives.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic">Data tidak ditemukan.</td></tr> :
                          filteredObjectives.map((o, i) => (
                             <tr key={i} className="hover:bg-slate-50 transition group">
                                 <td className="p-4 font-mono font-bold text-indigo-600 text-xs">{o.id}</td>
                                 <td className="p-4 font-bold text-slate-700">{o.mapel}</td>
                                 <td className="p-4 font-medium text-slate-600">{o.materi}</td>
                                 <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{o.kelas}</span></td>
                                 <td className="p-4 text-slate-600 leading-relaxed">{o.text_tujuan}</td>
                                 <td className="p-4 flex justify-center gap-2">
                                     <button onClick={() => handleEdit(o)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition border border-amber-100"><Edit size={14}/></button>
                                     <button onClick={() => handleDelete(o.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition border border-rose-100"><Trash2 size={14}/></button>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>

             {isModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in">
                     <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-white/20">
                         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                             <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">{formData.id && objectives.find(o=>o.id===formData.id) ? 'Edit TP' : 'Tambah TP Baru'}</h3>
                             <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={20} className="text-slate-400"/></button>
                         </div>
                         <div className="p-6 bg-slate-50/50">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">ID Tujuan (Unik)</label>
                                    <div className="flex gap-2">
                                        <input required type="text" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} placeholder="ID Tujuan (Unik)" />
                                        <button type="button" onClick={generateId} className="bg-slate-200 text-slate-600 p-3 rounded-xl hover:bg-slate-300 font-bold text-xs flex items-center gap-1 transition" title="Auto Generate ID"><Wand2 size={16}/> Auto</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Mata Pelajaran</label>
                                        <select required className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none cursor-pointer" value={formData.mapel} onChange={e => setFormData({...formData, mapel: e.target.value})}>
                                            <option value="">-- Pilih Mapel --</option>
                                            {subjectsDb.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Kelas</label>
                                        <select required className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none cursor-pointer" value={formData.kelas} onChange={e => setFormData({...formData, kelas: e.target.value})}>
                                            <option value="">-- Pilih Kelas --</option>
                                            {[1,2,3,4,5,6].map(k => <option key={k} value={String(k)}>Kelas {k}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Materi / Lingkup Materi</label>
                                    <input required type="text" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none" value={formData.materi} onChange={e => setFormData({...formData, materi: e.target.value})} placeholder="Materi / Lingkup Materi" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Deskripsi Tujuan Pembelajaran</label>
                                    <textarea required rows={4} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:border-indigo-500 outline-none resize-none leading-relaxed" value={formData.text_tujuan} onChange={e => setFormData({...formData, text_tujuan: e.target.value})} placeholder="Deskripsi Tujuan Pembelajaran" />
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl font-bold hover:bg-slate-100 transition">Batal</button>
                                    <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex justify-center items-center gap-2">{isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Simpan</button>
                                </div>
                            </form>
                         </div>
                     </div>
                 </div>
             )}

            <ConfirmationModal
                isOpen={deleteConfirmId !== null}
                onClose={() => setDeleteConfirmId(null)}
                onConfirm={confirmDeleteObjective}
                title="Hapus Tujuan Pembelajaran"
                message={`Apakah Anda yakin ingin menghapus Tujuan Pembelajaran ID: ${deleteConfirmId}?`}
                confirmText="Hapus"
                cancelText="Batal"
                type="danger"
            />
        </div>
    );
};

export default TujuanPembelajaranTab;
