
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Home, LogOut, Menu, Monitor, Group, Clock, Printer, List, Calendar, Key, FileQuestion, LayoutDashboard, BarChart3, Award, RefreshCw, X, CreditCard, Bell, CheckCircle2, ChevronRight, ChevronLeft, Loader2, Search, Target, UserCog, ClipboardList, User as UserIcon, ChevronDown, ChevronUp, Settings, Trophy } from 'lucide-react';
import { api } from '../src/services/api';
import { User } from '../types';
import OverviewTab from './admin/OverviewTab';
import AturGelombangTab from './admin/AturGelombangTab';
import KelompokTesTab from './admin/KelompokTesTab';
import AturSesiTab from './admin/AturSesiTab';
import CetakAbsensiTab from './admin/CetakAbsensiTab';
import CetakKartuTab from './admin/CetakKartuTab';
import RekapTab from './admin/RekapTab';
import RankingTab from './admin/RankingTab';
import AnalisisTab from './admin/AnalisisTab';
import StatusTesTab from './admin/StatusTesTab';
import DaftarPesertaTab from './admin/DaftarPesertaTab';
import RilisTokenTab from './admin/RilisTokenTab';
import BankSoalTab from './admin/BankSoalTab';
import TujuanPembelajaranTab from './admin/TujuanPembelajaranTab';
import KonfigurasiTab from './admin/KonfigurasiTab';
import ScoreboardLCCTab from './admin/ScoreboardLCCTab';

interface AdminDashboardProps {
    user: User;
    onLogout: () => void;
    onSwitchUser: (user: User) => void; // New Prop for User Switching
}

type TabType = 'overview' | 'rekap' | 'analisis' | 'ranking' | 'bank_soal' | 'data_user' | 'data_admin' | 'status_tes' | 'kelompok_tes' | 'rilis_token' | 'atur_sesi' | 'atur_gelombang' | 'cetak_absensi' | 'cetak_kartu' | 'tujuan_pembelajaran' | 'konfigurasi' | 'scoreboard_lcc';

const isOperator = (role: string) => ['Operator Kecamatan', 'Gugus'].includes(role);
const isJuri = (role: string) => ['Juri', 'juri'].includes(role);
const isAdmin = (role: string) => role === 'admin';
const isGuruOrProktor = (role: string) => ['Guru', 'Proktor Sekolah'].includes(role);

const checkCanAccess = (role: string, tab: TabType) => {
    if (isAdmin(role)) return true;
    if (isOperator(role)) {
        return ['overview', 'scoreboard_lcc', 'status_tes', 'rilis_token', 'kelompok_tes', 'atur_sesi', 'rekap', 'cetak_kartu', 'cetak_absensi'].includes(tab);
    }
    if (isJuri(role)) {
        return ['overview', 'scoreboard_lcc', 'rekap'].includes(tab);
    }
    if (isGuruOrProktor(role)) {
        return ['overview', 'scoreboard_lcc', 'status_tes', 'rilis_token', 'kelompok_tes', 'atur_sesi', 'data_user', 'rekap', 'analisis', 'konfigurasi', 'cetak_kartu', 'cetak_absensi'].includes(tab);
    }
    return false;
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onSwitchUser }) => {
  const [currentUserState, setCurrentUserState] = useState<User>(user);

  const canAccess = (tab: TabType) => checkCanAccess(currentUserState.role, tab);

  const [activeTab, setActiveTab] = useState<TabType>(() => {
      const savedTab = localStorage.getItem('cbt_admin_tab') as TabType;
      if (savedTab && checkCanAccess(user.role, savedTab)) return savedTab;
      return 'overview';
  });
  const [dashboardData, setDashboardData] = useState<any>({ students: [], questionsMap: {}, totalUsers: 0, token: 'TOKEN', duration: 60, maxQuestions: 0, kktp: 75, statusCounts: { OFFLINE: 0, LOGGED_IN: 0, WORKING: 0, FINISHED: 0 }, activityFeed: [], allUsers: [], schedules: [] });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // App Config for Logo
  const [appConfig, setAppConfig] = useState<Record<string, string>>({});
  const sidebarLogo = appConfig['LOGO_SEKOLAH'] || "https://www.image2url.com/r2/default/images/1785421698382-3855a37b-f234-40a7-8038-1fe7b308a41e.png";

  // Collapsible Menu State
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
      'ujian': true,
      'lomba': true,
      'user': true,
      'data': true,
      'cetak': true
  });

  const toggleGroup = (group: string) => {
      setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };
  
  const handleTabChange = (tab: TabType) => { if (canAccess(tab)) { setActiveTab(tab); localStorage.setItem('cbt_admin_tab', tab); setIsSidebarOpen(false); } };
  
  // Update Document Title based on Active Tab
  useEffect(() => {
      const tabNames: Record<TabType, string> = {
          'overview': 'Dashboard',
          'scoreboard_lcc': 'Smart Scoreboard',
          'status_tes': 'Live Status',
          'rilis_token': 'Token & Timer',
          'kelompok_tes': 'Set Ujian Aktif',
          'atur_sesi': 'Atur Sesi',
          'atur_gelombang': 'Atur Gelombang',
          'data_user': 'Data Siswa',
          'data_admin': 'Data Admin & Guru',
          'tujuan_pembelajaran': 'Tujuan Pembelajaran',
          'bank_soal': 'Bank Soal',
          'rekap': 'Rekap Nilai',
          'analisis': 'Analisis Soal',
          'ranking': 'Peringkat',
          'konfigurasi': 'Konfigurasi',
          'cetak_kartu': 'Kartu Peserta',
          'cetak_absensi': 'Absensi'
      };
      
      const menuName = tabNames[activeTab] || 'Admin Panel';
      document.title = `${menuName} | ES ENTHAL`;
  }, [activeTab]);
  
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
        const data = await api.getDashboardData();
        setDashboardData(data);
        const config = await api.getAppConfig();
        setAppConfig(config);
    } catch (e) { console.error(e); } finally { setLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const navButtonClass = (tab: TabType) => `
    flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-start px-4'} w-full py-3 my-1.5 rounded-xl font-bold transition-all duration-200 relative group
    ${!isCollapsed ? 'text-[13px] tracking-wide' : ''}
    ${activeTab === tab 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
        : 'text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm'
    }
  `;

  // Helper for Group Header
  const GroupHeader = ({ id, label }: { id: string, label: string }) => (
      !isCollapsed ? (
        <button 
            onClick={() => toggleGroup(id)} 
            className="flex items-center justify-between w-full px-4 mt-6 mb-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors text-left"
        >
            <span>{label}</span>
            {openGroups[id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
      ) : (
        <div className="h-px bg-slate-200 mx-4 my-4" title={label}></div>
      )
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-[#f8fafc] border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 w-72 bg-white' : '-translate-x-full md:static'} ${isCollapsed ? 'md:w-24' : 'md:w-72'}`}>
        <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center flex-col gap-6' : 'justify-between'}`}>
            <div className={`flex items-center gap-3 ${isCollapsed ? 'hidden' : ''}`}>
                <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-white font-black text-xl shadow-[0_10px_20px_-5px_rgba(99,102,241,0.3)] overflow-hidden border-2 border-white relative shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-200"></div>
                    <img src={sidebarLogo} className="w-full h-full object-contain p-1 relative z-10" alt="Logo" />
                </div>
                <div className="flex flex-col overflow-hidden">
                    <h1 className="font-black text-2xl text-slate-800 tracking-tighter leading-none">
                        ES <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">ENTHAL</span>
                    </h1>
                    <span className="text-[9px] font-bold text-slate-400 mt-0.5 tracking-widest uppercase leading-tight">
                        Evaluation Digital
                    </span>
                </div>
            </div>
            
            {/* Logo when collapsed */}
            <div className={`${isCollapsed ? 'block' : 'hidden'} w-10 h-10 bg-white rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md overflow-hidden border-2 border-white relative`}>
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-200"></div>
                <img src={sidebarLogo} className="w-full h-full object-contain p-1 relative z-10" alt="Logo" />
            </div>
            
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:flex text-slate-400 hover:text-indigo-600 transition-colors p-2 hover:bg-slate-100 rounded-lg justify-center"><Menu size={20}/></button>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400"><X size={22}/></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar pb-10">
             <button onClick={() => handleTabChange('overview')} className={navButtonClass('overview')} title={isCollapsed ? "Dashboard" : ""}>
                 <Home size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> 
                 {!isCollapsed && <span>Dashboard</span>}
             </button>
             
             {/* GROUP: UJIAN */}
             {canAccess('status_tes') && (
                 <>
                     <GroupHeader id="ujian" label="Ujian" />
                     {(openGroups['ujian'] || isCollapsed) && (
                         <div className={!isCollapsed ? "pl-2 border-l border-slate-200 ml-3 space-y-1" : "space-y-1"}>
                            <button onClick={() => handleTabChange('status_tes')} className={navButtonClass('status_tes')} title="Live Status">
                                <Monitor size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Live Status</span>}
                            </button>
                            {canAccess('rilis_token') && (
                                <button onClick={() => handleTabChange('rilis_token')} className={navButtonClass('rilis_token')} title="Token & Timer">
                                    <Key size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Token & Timer</span>}
                                </button>
                            )}
                            {canAccess('kelompok_tes') && (
                                <button onClick={() => handleTabChange('kelompok_tes')} className={navButtonClass('kelompok_tes')} title="Set Ujian Aktif">
                                    <Group size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Set Ujian Aktif</span>}
                                </button>
                            )}
                            {canAccess('atur_sesi') && (
                                <button onClick={() => handleTabChange('atur_sesi')} className={navButtonClass('atur_sesi')} title="Atur Sesi">
                                    <Clock size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Atur Sesi</span>}
                                </button>
                            )}
                            {isAdmin(currentUserState.role) && (
                                <button onClick={() => handleTabChange('atur_gelombang')} className={navButtonClass('atur_gelombang')} title="Atur Gelombang">
                                    <Calendar size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Atur Gelombang</span>}
                                </button>
                            )}
                         </div>
                     )}
                 </>
             )}

             {/* GROUP: LOMBA & CERDAS CERMAT */}
             <GroupHeader id="lomba" label="Lomba & Cerdas Cermat" />
             {(openGroups['lomba'] || isCollapsed) && (
                 <div className={!isCollapsed ? "pl-2 border-l border-slate-200 ml-3 space-y-1" : "space-y-1"}>
                    <button onClick={() => handleTabChange('scoreboard_lcc')} className={navButtonClass('scoreboard_lcc')} title="Smart Scoreboard">
                        <Trophy size={22} className={isCollapsed ? "" : "shrink-0 mr-3 text-amber-500"}/> {!isCollapsed && <span className="font-bold text-amber-600">Smart Scoreboard</span>}
                    </button>
                 </div>
             )}
             
             {/* GROUP: MANAJEMEN USER */}
             {canAccess('data_user') && (
                 <>
                    <GroupHeader id="user" label="Manajemen User" />
                    {(openGroups['user'] || isCollapsed) && (
                        <div className={!isCollapsed ? "pl-2 border-l border-slate-200 ml-3 space-y-1" : "space-y-1"}>
                            <button onClick={() => handleTabChange('data_user')} className={navButtonClass('data_user')} title="Data Siswa">
                                <List size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Data Siswa</span>}
                            </button>
                            {isAdmin(currentUserState.role) && (
                                <button onClick={() => handleTabChange('data_admin')} className={navButtonClass('data_admin')} title="Data Admin & Guru">
                                    <UserCog size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Data Admin & Guru</span>}
                                </button>
                            )}
                        </div>
                    )}
                 </>
             )}

             {/* GROUP: DATA & LAPORAN */}
             {(canAccess('rekap') || canAccess('analisis') || canAccess('konfigurasi') || isAdmin(currentUserState.role)) && (
                 <>
                    <GroupHeader id="data" label="Data & Laporan" />
                    {(openGroups['data'] || isCollapsed) && (
                        <div className={!isCollapsed ? "pl-2 border-l border-slate-200 ml-3 space-y-1" : "space-y-1"}>
                            {isAdmin(currentUserState.role) && (
                                <>
                                <button onClick={() => handleTabChange('tujuan_pembelajaran')} className={navButtonClass('tujuan_pembelajaran')} title="Tujuan Pembelajaran">
                                    <Target size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Tujuan Pembelajaran</span>}
                                </button>
                                <button onClick={() => handleTabChange('bank_soal')} className={navButtonClass('bank_soal')} title="Bank Soal">
                                    <FileQuestion size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Bank Soal</span>}
                                </button>
                                </>
                            )}
                            
                            {canAccess('rekap') && (
                                <button onClick={() => handleTabChange('rekap')} className={navButtonClass('rekap')} title="Rekap Nilai">
                                    <LayoutDashboard size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Rekap Nilai</span>}
                                </button>
                            )}
                            {canAccess('analisis') && (
                                <button onClick={() => handleTabChange('analisis')} className={navButtonClass('analisis')} title="Analisis Soal">
                                    <BarChart3 size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Analisis Soal</span>}
                                </button>
                            )}
                            
                            {isAdmin(currentUserState.role) && (
                                <button onClick={() => handleTabChange('ranking')} className={navButtonClass('ranking')} title="Peringkat">
                                    <Award size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Peringkat</span>}
                                </button>
                            )}
                            
                            {canAccess('konfigurasi') && (
                                <button onClick={() => handleTabChange('konfigurasi')} className={navButtonClass('konfigurasi')} title="Konfigurasi">
                                    <Settings size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Konfigurasi</span>}
                                </button>
                            )}
                        </div>
                    )}
                 </>
             )}
             
             {/* GROUP: CETAK */}
             {(canAccess('cetak_kartu') || canAccess('cetak_absensi')) && <GroupHeader id="cetak" label="Cetak" />}
             {(openGroups['cetak'] || isCollapsed) && (canAccess('cetak_kartu') || canAccess('cetak_absensi')) && (
                 <div className={!isCollapsed ? "pl-2 border-l border-slate-200 ml-3 space-y-1" : "space-y-1"}>
                    {canAccess('cetak_kartu') && (
                        <button onClick={() => handleTabChange('cetak_kartu')} className={navButtonClass('cetak_kartu')} title="Kartu Peserta">
                            <CreditCard size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Kartu Peserta</span>}
                        </button>
                    )}
                    {canAccess('cetak_absensi') && (
                        <button onClick={() => handleTabChange('cetak_absensi')} className={navButtonClass('cetak_absensi')} title="Absensi">
                            <Printer size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Absensi</span>}
                        </button>
                    )}
                 </div>
             )}
        </nav>

        <div className="p-4 border-t border-slate-200">
             <div className={`flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 border-l-4 border-l-indigo-500 shadow-sm ${isCollapsed ? 'justify-center' : ''}`}>
                 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs border-2 border-white shadow-sm shrink-0 overflow-hidden">
                     {currentUserState.photo_url ? (
                         <img src={currentUserState.photo_url} alt="Profile" className="w-full h-full rounded-full object-cover"/>
                     ) : (
                         <UserIcon size={20} className="text-slate-400" />
                     )}
                 </div>
                 {!isCollapsed && (
                     <div className="flex-1 min-w-0 text-left py-0.5 overflow-hidden">
                         {(() => {
                             const name = currentUserState.nama_lengkap || currentUserState.username || '';
                             const fontSize = name.length > 28 ? '9px' : name.length > 20 ? '10px' : name.length > 15 ? '11px' : '12px';
                             return (
                                 <p 
                                     className="font-black text-slate-700 leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
                                     style={{ fontSize }}
                                     title={name}
                                 >
                                     {name}
                                 </p>
                             );
                         })()}
                         <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider leading-tight break-words mt-0.5">
                             {currentUserState.role === 'admin' ? 'Administrator' : currentUserState.role}
                         </p>
                     </div>
                 )}
                 {!isCollapsed && (
                     <button onClick={onLogout} className="ml-auto text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition" title="Logout"><LogOut size={18}/></button>
                 )}
             </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
         <header className="flex justify-between items-center mb-8">
             <div className="flex items-center gap-4">
                 <button onClick={() => setIsSidebarOpen(true)} className="md:hidden bg-white p-2 rounded-lg shadow-sm border border-slate-200"><Menu size={20}/></button>
                 <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize">
                    {activeTab === 'overview' ? 'Dasbord Utama' : activeTab.replace(/_/g, ' ')}
                 </h2>
             </div>
             <button onClick={fetchData} disabled={isRefreshing} className="bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-2">
                 <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} /> Sync
             </button>
         </header>

         <div className="min-h-[500px]">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-[50vh]">
                    <Loader2 size={40} className="text-indigo-600 animate-spin mb-4"/>
                    <p className="text-slate-400 font-medium">Memuat Data...</p>
                </div>
            ) : (
                <>
                    {activeTab === 'overview' && <OverviewTab dashboardData={dashboardData} currentUserState={currentUserState} />}
                    {activeTab === 'status_tes' && <StatusTesTab currentUser={currentUserState} students={dashboardData.allUsers || []} refreshData={fetchData} />}
                    {activeTab === 'kelompok_tes' && <KelompokTesTab currentUser={currentUserState} students={dashboardData.allUsers || []} refreshData={fetchData} />}
                    {activeTab === 'atur_sesi' && <AturSesiTab currentUser={currentUserState} students={dashboardData.allUsers || []} refreshData={fetchData} isLoading={isRefreshing} />}
                    {activeTab === 'cetak_absensi' && <CetakAbsensiTab currentUser={currentUserState} students={dashboardData.allUsers || []} />}
                    {activeTab === 'cetak_kartu' && <CetakKartuTab currentUser={currentUserState} students={dashboardData.allUsers || []} schedules={dashboardData.schedules || []} />}
                    
                    {/* Separate Tabs based on Mode and Pass onSwitchUser */}
                    {activeTab === 'data_user' && canAccess('data_user') && (
                        <DaftarPesertaTab currentUser={currentUserState} onDataChange={fetchData} mode="siswa" onSwitchUser={onSwitchUser} />
                    )}
                    {activeTab === 'data_admin' && isAdmin(currentUserState.role) && (
                        <DaftarPesertaTab currentUser={currentUserState} onDataChange={fetchData} mode="staff" onSwitchUser={onSwitchUser} />
                    )}

                    {activeTab === 'atur_gelombang' && isAdmin(currentUserState.role) && <AturGelombangTab students={dashboardData.allUsers || []} />}
                    {activeTab === 'rilis_token' && canAccess('rilis_token') && <RilisTokenTab currentUser={currentUserState} token={dashboardData.token} duration={dashboardData.duration} maxQuestions={dashboardData.maxQuestions} kktp={dashboardData.kktp} surveyDuration={0} refreshData={fetchData} isRefreshing={isRefreshing} schedules={dashboardData.schedules || []} students={dashboardData.allUsers || []} />}
                    {activeTab === 'bank_soal' && isAdmin(currentUserState.role) && <BankSoalTab />}
                    {activeTab === 'tujuan_pembelajaran' && isAdmin(currentUserState.role) && <TujuanPembelajaranTab />}
                    
                    {/* REKAP & ANALISIS for Admin, Guru, and Juri */}
                    {activeTab === 'rekap' && canAccess('rekap') && (
                        <RekapTab students={dashboardData.allUsers} currentUser={currentUserState} />
                    )}
                    {activeTab === 'analisis' && canAccess('analisis') && (
                        <AnalisisTab currentUser={currentUserState} students={dashboardData.allUsers} />
                    )}
                    
                    {activeTab === 'ranking' && isAdmin(currentUserState.role) && <RankingTab students={dashboardData.allUsers} />}
                    
                    {/* Allow Konfigurasi for Admin, Guru, and Juri */}
                    {activeTab === 'konfigurasi' && canAccess('konfigurasi') && (
                        <KonfigurasiTab currentUser={currentUserState} />
                    )}

                    {/* SMART SCOREBOARD */}
                    {activeTab === 'scoreboard_lcc' && <ScoreboardLCCTab currentUser={currentUserState} />}
                </>
            )}
         </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
