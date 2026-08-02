
import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { Key, RefreshCw, Save, X, Edit, Clock, Layers, ShieldCheck, Copy, Award, Calendar } from 'lucide-react';
import { api } from '../../src/services/api';
import { User, SchoolSchedule } from '../../types';
import { getSchoolOnly } from '../../utils/adminHelpers';

const RilisTokenTab = ({ currentUser, token, duration, maxQuestions, kktp, surveyDuration, refreshData, isRefreshing, schedules, students }: { currentUser: User, token: string, duration: number, maxQuestions: number, kktp: number, surveyDuration: number, refreshData: () => void, isRefreshing: boolean, schedules: SchoolSchedule[], students: any[] }) => {
    const { showToast } = useToast();
    const [localMaxQ, setLocalMaxQ] = useState(maxQuestions);
    const [localKKTP, setLocalKKTP] = useState(kktp || 75);
    const [isSavingQ, setIsSavingQ] = useState(false);
    
    // States for Token and Exam Duration editing
    const [tokenInput, setTokenInput] = useState(token);
    const [isEditingToken, setIsEditingToken] = useState(false);
    const [durationInput, setDurationInput] = useState(duration);
    const [isEditingDuration, setIsEditingDuration] = useState(false);

    const isAdminPusat = currentUser.role === 'admin';

    useEffect(() => { setLocalMaxQ(maxQuestions); }, [maxQuestions]);
    useEffect(() => { setLocalKKTP(kktp || 75); }, [kktp]);
    useEffect(() => { setTokenInput(token); }, [token]);
    useEffect(() => { setDurationInput(duration); }, [duration]);

    const schoolKecMap = useMemo(() => {
        const map: Record<string, string> = {};
        if (students) {
            students.forEach(s => {
                if (s.school && s.kecamatan) map[s.school] = s.kecamatan;
            });
        }
        return map;
    }, [students]);

    const handleSaveMaxQ = async () => {
        setIsSavingQ(true);
        try { await api.saveMaxQuestions(Number(localMaxQ)); refreshData(); showToast("Konfigurasi tersimpan.", "success"); } catch (e) { console.error(e); showToast("Gagal menyimpan.", "error"); } finally { setIsSavingQ(false); }
    };

    const handleSaveKKTP = async () => {
        setIsSavingQ(true);
        try { await api.saveKKTP(Number(localKKTP)); refreshData(); showToast("KKTP tersimpan.", "success"); } catch (e) { console.error(e); showToast("Gagal menyimpan KKTP.", "error"); } finally { setIsSavingQ(false); }
    };

    const handleUpdateToken = async () => {
        setIsSavingQ(true);
        try { await api.saveToken(tokenInput); setIsEditingToken(false); refreshData(); showToast("Token berhasil diperbarui.", "success"); } catch (e) { showToast("Gagal menyimpan token.", "error"); } finally { setIsSavingQ(false); }
    };

    const generateToken = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setTokenInput(result);
    };

    const handleUpdateDuration = async () => {
        setIsSavingQ(true);
        try { await api.saveDuration(durationInput); setIsEditingDuration(false); refreshData(); showToast("Durasi ujian disimpan.", "success"); } catch (e) { showToast("Gagal menyimpan durasi.", "error"); } finally { setIsSavingQ(false); }
    };

    return (
        <div className="flex flex-col items-center justify-center py-8 fade-in min-h-[500px] gap-8">
            {/* Header / Title */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-slate-500 text-[10px] font-bold uppercase tracking-widest border border-slate-200 shadow-sm">
                    <ShieldCheck size={12} /> Secure Exam Control
                </div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Panel Kontrol Ujian</h2>
                <p className="text-slate-400 font-medium text-sm">Kelola akses dan konfigurasi waktu ujian secara real-time.</p>
            </div>

            {/* Main Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl relative z-10">
                
                {/* Token Card */}
                <div className="bg-white rounded-[2.5rem] p-10 relative overflow-hidden shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] border border-slate-100 group hover:shadow-[0_25px_50px_-10px_rgba(0,0,0,0.08)] transition-all duration-500">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.02] transform group-hover:scale-110 transition-transform duration-700">
                        <Key size={200} className="text-slate-900"/>
                    </div>
                    
                    <div className="relative flex flex-col h-full justify-between gap-8">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2 text-slate-400 font-extrabold uppercase text-[10px] tracking-widest">
                                <span className="p-2 bg-slate-50 rounded-xl"><Key size={14}/></span> Token Akses
                            </div>
                            {isAdminPusat && (
                                <button onClick={()=>setIsEditingToken(!isEditingToken)} className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-slate-50 transition"><Edit size={16}/></button>
                            )}
                        </div>
                        
                        {isEditingToken ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center font-mono text-3xl font-black uppercase tracking-[0.2em] text-slate-700 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all shadow-inner" value={tokenInput} onChange={e=>setTokenInput(e.target.value.toUpperCase())} maxLength={6} autoFocus />
                                <div className="flex gap-2">
                                    <button onClick={generateToken} className="flex-1 bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 p-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2"><RefreshCw size={14}/> Acak</button>
                                    <button onClick={handleUpdateToken} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-bold text-xs transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"><Save size={14}/> Simpan</button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 cursor-pointer group/token select-none" onClick={() => { navigator.clipboard.writeText(token); showToast('Token disalin!', 'success'); }} title="Klik untuk salin">
                                <h3 className="text-6xl md:text-7xl font-mono font-black tracking-[0.2em] text-slate-800 group-hover/token:text-indigo-600 transition-colors">{token}</h3>
                                <div className="flex justify-center mt-4 opacity-0 group-hover/token:opacity-100 transition-all transform translate-y-2 group-hover/token:translate-y-0">
                                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-4 py-1.5 rounded-full flex items-center gap-1.5"><Copy size={10}/> Salin Token</span>
                                </div>
                            </div>
                        )}
                        
                        <div className="text-center">
                            <p className="text-xs text-slate-400 font-medium bg-slate-50 py-2 px-4 rounded-full inline-block">Token digunakan siswa untuk login ujian</p>
                        </div>
                    </div>
                </div>

                {/* Duration Card */}
                <div className="bg-white rounded-[2.5rem] p-10 relative overflow-hidden shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between group hover:shadow-[0_25px_50px_-10px_rgba(0,0,0,0.08)] transition-all duration-500">
                     <div className="absolute top-0 right-0 p-10 opacity-[0.02] transform group-hover:scale-110 transition-transform duration-700">
                        <Clock size={200} className="text-slate-900"/>
                    </div>
                    
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="flex items-center gap-2 text-slate-400 font-extrabold uppercase text-[10px] tracking-widest">
                             <span className="p-2 bg-slate-50 rounded-xl"><Clock size={14}/></span> Durasi Ujian
                        </div>
                        {isAdminPusat && !isEditingDuration && (
                            <button onClick={()=>setIsEditingDuration(true)} className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-slate-50 transition"><Edit size={16}/></button>
                        )}
                    </div>

                    <div className="text-center flex-1 flex flex-col justify-center relative z-10">
                        {isEditingDuration ? (
                            <div className="flex items-center gap-3 justify-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="relative">
                                    <input type="number" className="w-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center font-black text-4xl text-slate-700 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all shadow-inner" value={durationInput} onChange={e=>setDurationInput(Number(e.target.value))} />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase tracking-wide">Menit</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button onClick={handleUpdateDuration} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100"><Save size={16}/></button>
                                    <button onClick={()=>{setIsEditingDuration(false); setDurationInput(duration);}} className="bg-white border border-slate-200 text-slate-500 p-3 rounded-xl hover:bg-slate-50"><X size={16}/></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-7xl font-black text-slate-800 tracking-tighter">{duration}<span className="text-2xl text-slate-300 font-bold ml-1 align-top">m</span></h3>
                                <p className="text-xs text-slate-400 mt-2 font-medium bg-slate-50 py-2 px-4 rounded-full inline-block">Alokasi Waktu Pengerjaan</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Config Panels (KKTP & Limit Soal) */}
            {isAdminPusat && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                {/* KKTP Config */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-colors">
                    <div>
                        <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm"><Award size={18} className="text-emerald-500"/> Nilai KKTP <span className="text-[10px] text-slate-400 font-normal">(Khusus Sumatif)</span></h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Standar Ketuntasan Minimal.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="number" className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-50 transition-all text-slate-700" value={localKKTP} onChange={(e) => setLocalKKTP(Number(e.target.value))} placeholder="Nilai KKTP"/>
                        <button onClick={handleSaveKKTP} disabled={isSavingQ || localKKTP == kktp} className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-300 transition shadow-lg shadow-emerald-100"><Save size={16}/></button>
                    </div>
                </div>

                {/* Limit Soal Config */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between hover:border-indigo-200 transition-colors">
                    <div>
                        <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm"><Layers size={18} className="text-indigo-500"/> Limit Soal</h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Batasi jumlah soal yang tampil.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="number" className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 transition-all text-slate-700" value={localMaxQ} onChange={(e) => setLocalMaxQ(Number(e.target.value))} placeholder="Limit Soal"/>
                        <button onClick={handleSaveMaxQ} disabled={isSavingQ || localMaxQ == maxQuestions} className="p-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 disabled:bg-slate-100 disabled:text-slate-300 transition shadow-lg"><Save size={16}/></button>
                    </div>
                </div>
            </div>
            )}

            {/* New Section: Jadwal Ujian */}
            <div className="w-full max-w-4xl bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Calendar size={20}/></div>
                    <div>
                        <h4 className="font-bold text-slate-700 text-sm">Jadwal Ujian Aktif</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Informasi gelombang dan sesi ujian.</p>
                    </div>
                </div>
                
                <div className="overflow-hidden rounded-xl border border-slate-100">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="p-3 border-b border-slate-100">Sekolah</th>
                                <th className="p-3 border-b border-slate-100">Kecamatan</th>
                                <th className="p-3 border-b border-slate-100 text-center">Gelombang</th>
                                <th className="p-3 border-b border-slate-100 text-center">Mulai</th>
                                <th className="p-3 border-b border-slate-100 text-center">Selesai</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(!schedules || schedules.length === 0) ? (
                                <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic bg-slate-50/50">Belum ada jadwal diatur.</td></tr>
                            ) : (
                                schedules.map((s, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-bold text-slate-700">{getSchoolOnly(s.school)}</td>
                                        <td className="p-3 text-slate-600">{schoolKecMap[s.school] || '-'}</td>
                                        <td className="p-3 text-center text-slate-600 font-mono bg-slate-50/50">{s.gelombang}</td>
                                        <td className="p-3 text-center text-slate-600">{s.tanggal}</td>
                                        <td className="p-3 text-center text-slate-600">{s.tanggal_selesai || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <button onClick={refreshData} disabled={isRefreshing} className={`bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 px-8 py-3 rounded-full font-bold text-xs transition-all shadow-sm hover:shadow-md flex items-center gap-2 ${isRefreshing ? 'opacity-50 cursor-wait' : ''}`}>
                <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                {isRefreshing ? "Sinkronisasi Data..." : "Refresh Data Server"}
            </button>
        </div>
    )
}

export default RilisTokenTab;
