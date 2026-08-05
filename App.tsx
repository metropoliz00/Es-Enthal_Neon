
import React, { useState, useEffect } from 'react';
import { User, Exam, QuestionWithOptions } from './types';
import { Key, User as UserIcon, AlertCircle, LogOut, Check, Eye, EyeOff, Loader2, Clock, ShieldCheck, PlayCircle, GraduationCap, LogIn, ChevronRight, BookOpen, Fingerprint, Users, Trophy, Bell, Laptop, Sparkles, Radio } from 'lucide-react';
import StudentExam from './components/StudentExam';
import AdminDashboard from './components/AdminDashboard';
import ScoreboardLCCTab from './components/admin/ScoreboardLCCTab';
import LccReguBuzzerView from './components/LccReguBuzzerView';
import { api } from './src/services/api';
import { useToast } from './context/ToastContext';
import { isBereguExamType } from './utils/adminHelpers';
import { motion, AnimatePresence } from 'motion/react';
import { soundFx } from './utils/scoreboardAudio';

type ViewState = 'login' | 'babak_selection' | 'confirm' | 'exam' | 'result' | 'admin' | 'regu_bell';

// Elegant Loading Overlay
const LoadingOverlay = ({ message }: { message: string }) => (
  <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center fade-in">
    <div className="relative mb-6">
      <div className="w-16 h-16 border-4 border-slate-100 rounded-full"></div>
      <div className="w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
    </div>
    <h3 className="text-slate-800 font-bold text-lg tracking-tight mb-1">{message}</h3>
    <p className="text-slate-400 text-xs font-medium animate-pulse">Mohon tunggu sebentar...</p>
  </div>
);

const isAdminPanelRole = (role?: string) => {
  if (!role) return false;
  return role.toLowerCase() !== 'siswa';
};

function App() {
  const { showToast } = useToast();

  // Check if standalone display parameter or hash is present for Projector or Regu Bell
  const displayParam = new URLSearchParams(window.location.search).get('display');
  const hashParam = window.location.hash;
  if (displayParam === 'scoreboard' || hashParam === '#/scoreboard') {
    return <ScoreboardLCCTab forceScoreboardMode={true} />;
  }
  if (displayParam === 'regu' || displayParam === 'bell' || hashParam === '#/regu' || hashParam === '#/bell') {
    return <LccReguBuzzerView />;
  }

  const [view, setView] = useState<ViewState>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [examList, setExamList] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  
  const [inputToken, setInputToken] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '', rememberMe: false });
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Memuat...');
  const [errorMsg, setErrorMsg] = useState('');
  const [startTime, setStartTime] = useState<number>(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [appConfig, setAppConfig] = useState<Record<string, string>>({});
  
  // Load Global Config on Mount (For Login Logo & Favicon)
  useEffect(() => {
      api.getAppConfig().then(config => {
          setAppConfig(config);
          // Set Favicon dynamically
          const favicon = config['FAVICON_URL'] || config['LOGO_SEKOLAH'] || 'https://www.image2url.com/r2/default/images/1785421698382-3855a37b-f234-40a7-8038-1fe7b308a41e.png';
          if (favicon) {
             let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
             if (!link) {
                 link = document.createElement('link');
                 link.rel = 'icon';
                 document.head.appendChild(link);
             }
             link.href = favicon;
          }
      }).catch(console.error);
  }, []);

  // Restore Session
  useEffect(() => {
    // Check Session Storage first (non-persistent)
    let savedUser = sessionStorage.getItem('cbt_user');
    
    // If not found, check Local Storage (persistent)
    if (!savedUser) {
        savedUser = localStorage.getItem('cbt_user');
    }

    if (savedUser) {
        try {
            const parsedUser = JSON.parse(savedUser);
            setCurrentUser(parsedUser);
            
            // Check for admin/staff roles vs student
            if (isAdminPanelRole(parsedUser.role)) {
                setView('admin');
            } else {
                const isReguAccount = parsedUser.username.toLowerCase().includes('regu') || parsedUser.username.toLowerCase().includes('team') || isBereguExamType(parsedUser.exam_type);
                if (isReguAccount) {
                    setView('babak_selection');
                } else {
                    setView('confirm');
                }
                api.getExams().then(allExams => {
                    let filteredExams = allExams;
                    if (parsedUser.active_exam && parsedUser.active_exam !== '-' && parsedUser.active_exam !== '') {
                        filteredExams = filteredExams.filter(e => e.nama_ujian === parsedUser.active_exam);
                    } else {
                        filteredExams = [];
                    }
                    setExamList(filteredExams);
                    if (filteredExams.length > 0) setSelectedExamId(filteredExams[0].id);
                }).catch(console.error);
            }
        } catch (e) {
            console.error("Failed to restore session", e);
            localStorage.removeItem('cbt_user');
            sessionStorage.removeItem('cbt_user');
        }
    }
  }, []);

  const enterFullscreen = async () => {
      const el = document.documentElement;
      if (!document.fullscreenElement) {
          try {
              if (el.requestFullscreen) await el.requestFullscreen();
              // @ts-ignore
              else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
              // @ts-ignore
              else if (el.msRequestFullscreen) await el.msRequestFullscreen();
          } catch (e) {
              console.warn("Auto-fullscreen blocked by browser.");
          }
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    enterFullscreen();
    setLoading(true);
    setLoadingMessage('Mengautentikasi...');
    setErrorMsg('');
    try {
        const { user, error } = await api.login(loginForm.username.trim(), loginForm.password.trim());
        if (user) {
            setCurrentUser(user);
            
            if (loginForm.rememberMe) {
                localStorage.setItem('cbt_user', JSON.stringify(user));
            } else {
                sessionStorage.setItem('cbt_user', JSON.stringify(user));
            }

            // Check for admin/staff roles vs student
            if (isAdminPanelRole(user.role)) {
                setView('admin');
            } else {
                setLoadingMessage('Menyiapkan Data Ujian...');
                const allExams = await api.getExams();
                let filteredExams = allExams;
                
                if (user.active_exam && user.active_exam !== '-' && user.active_exam !== '') {
                    filteredExams = filteredExams.filter(e => e.nama_ujian === user.active_exam);
                } else {
                    filteredExams = [];
                }
                setExamList(filteredExams);
                if (filteredExams.length > 0) setSelectedExamId(filteredExams[0].id); else setSelectedExamId('');
                
                const isReguAccount = user.username.toLowerCase().includes('regu') || user.username.toLowerCase().includes('team') || isBereguExamType(user.exam_type);
                if (isReguAccount) {
                    setView('babak_selection');
                } else {
                    setView('confirm');
                }
            }
        } else {
            setErrorMsg(error || 'ID Pengguna atau Kata Sandi salah.');
        }
    } catch (err: any) {
        setErrorMsg('Gagal terhubung ke server.');
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  // --- NEW: Handle User Switching without Reload ---
  const handleSwitchUser = async (targetUser: User) => {
      setLoading(true);
      setLoadingMessage(`Masuk sebagai ${targetUser.nama_lengkap}...`);
      
      // 1. Update Storage
      localStorage.setItem('cbt_user', JSON.stringify(targetUser));
      sessionStorage.setItem('cbt_user', JSON.stringify(targetUser));
      localStorage.removeItem('cbt_admin_tab'); 

      // 2. Update State
      setCurrentUser(targetUser);

      // 3. Determine View based on Role
      if (isAdminPanelRole(targetUser.role)) {
          setView('admin');
          setLoading(false);
      } else {
          // Logic for Student View
          try {
              const allExams = await api.getExams();
              let filteredExams = allExams;
              
              if (targetUser.active_exam && targetUser.active_exam !== '-' && targetUser.active_exam !== '') {
                  filteredExams = filteredExams.filter(e => e.nama_ujian === targetUser.active_exam);
              } else {
                  filteredExams = [];
              }
              setExamList(filteredExams);
              if (filteredExams.length > 0) setSelectedExamId(filteredExams[0].id); else setSelectedExamId('');
              
              const isReguAccount = targetUser.username.toLowerCase().includes('regu') || targetUser.username.toLowerCase().includes('team') || isBereguExamType(targetUser.exam_type);
              if (isReguAccount) {
                  setView('babak_selection');
              } else {
                  setView('confirm');
              }
          } catch (e) {
              console.error(e);
              showToast("Gagal memuat data ujian untuk user ini.", "error");
          } finally {
              setLoading(false);
          }
      }
  };

  const handleVerifyToken = async () => {
      enterFullscreen();
      if (!inputToken) { setErrorMsg('Masukkan token ujian.'); return; }
      
      // Check if there's an existing session first
      const storageKeyTime = `cbt_start_${currentUser?.username}_${selectedExamId}`;
      const savedTime = localStorage.getItem(storageKeyTime);
      if (savedTime) {
          // Skip token check if resuming
          setShowConfirmModal(true);
          return;
      }

      setLoading(true);
      setLoadingMessage('Verifikasi Token...');
      setErrorMsg('');
      try {
          const serverToken = await api.getServerToken();
          if (inputToken.toUpperCase() !== serverToken.toUpperCase()) { setErrorMsg('Token tidak valid!'); setLoading(false); return; }
          setShowConfirmModal(true);
      } catch (e) { console.error(e); setErrorMsg('Gagal verifikasi token.'); } finally { setLoading(false); }
  };

  const handleStartExam = async () => {
    if (!currentUser) return;
    
    const selectedExam = examList.find(e => e.id === selectedExamId);
    if (!selectedExam) return;
    const examName = selectedExam.nama_ujian;

    setLoading(true);
    setLoadingMessage('Mengunduh Soal...');
    try {
        const storageKeyTime = `cbt_start_${currentUser.username}_${selectedExamId}`;
        const savedTime = localStorage.getItem(storageKeyTime);
        let activeStartTime = 0;

        if (savedTime) {
            // RESUME SESSION
            activeStartTime = parseInt(savedTime);
            console.log("Resuming exam from:", new Date(activeStartTime).toLocaleTimeString());
        } else {
            // NEW SESSION
            const serverToken = await api.getServerToken();
            if (inputToken.toUpperCase() !== serverToken.toUpperCase()) { 
                setErrorMsg('Token Invalid!'); setShowConfirmModal(false); setLoading(false); return; 
            }
            // Use examName for API
            const res = await api.startExam(currentUser.username, currentUser.nama_lengkap, examName);
            activeStartTime = res.startTime || Date.now();
            localStorage.setItem(storageKeyTime, activeStartTime.toString());
        }
        
        // Use examName for API
        let qData = await api.getQuestions(examName);
        
        // --- NEW: FILTER BY TP IF ASSIGNED ---
        if (currentUser.active_tp && currentUser.active_tp !== '-' && currentUser.active_tp !== '') {
            const originalCount = qData.length;
            qData = qData.filter(q => q.tp_id === currentUser.active_tp);
            console.log(`Filtered questions by TP [${currentUser.active_tp}]: ${originalCount} -> ${qData.length}`);
        }
        // -------------------------------------

        if (qData.length === 0) { setErrorMsg('Soal belum tersedia untuk ujian/TP ini.'); setShowConfirmModal(false); setLoading(false); return; }
        
        enterFullscreen();
        setQuestions(qData);
        setStartTime(activeStartTime);
        setErrorMsg('');
        setView('exam');
    } catch (err) { console.error(err); setErrorMsg('Gagal memuat soal. Coba lagi.'); setShowConfirmModal(false); } finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('cbt_user');
    localStorage.removeItem('cbt_admin_tab'); 
    sessionStorage.removeItem('cbt_user');
    setCurrentUser(null);
    setLoginForm({ username: '', password: '', rememberMe: false });
    setInputToken('');
    setErrorMsg('');
    setQuestions([]);
    setShowPassword(false);
    setShowConfirmModal(false);
    setView('login');
  };

  const handleFinishExam = async (answers: any, displayedQuestionCount: number, questionIds: string[], isTimeout: boolean = false) => {
    if (!currentUser || !selectedExamId) return;
    
    const selectedExam = examList.find(e => e.id === selectedExamId);
    if (!selectedExam) return;
    const examName = selectedExam.nama_ujian;

    setLoading(true);
    setLoadingMessage(isTimeout ? 'Waktu Habis. Menyimpan...' : 'Mengunggah Jawaban...');
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
    try {
        const lsKeyAnswers = `cbt_answers_${currentUser.username}_${selectedExamId}`;
        const lsKeyTime = `cbt_start_${currentUser.username}_${selectedExamId}`;
        
        // Clear local storage on finish
        localStorage.removeItem(lsKeyAnswers);
        localStorage.removeItem(lsKeyTime);

        await api.submitExam({
            user: currentUser,
            subject: examName, // Use examName
            answers,
            startTime,
            displayedQuestionCount,
            questionIds
        });
        
        if (isTimeout) {
            showToast("Waktu Ujian Habis. Jawaban tersimpan otomatis.", "warning");
            // Reset state and redirect to login
            localStorage.removeItem('cbt_user');
            localStorage.removeItem('cbt_admin_tab'); 
            sessionStorage.removeItem('cbt_user');
            setCurrentUser(null);
            setLoginForm({ username: '', password: '', rememberMe: false });
            setInputToken('');
            setErrorMsg('');
            setQuestions([]);
            setShowPassword(false);
            setShowConfirmModal(false);
            setView('login');
        } else {
            setView('result');
        }
    } catch (err) { showToast("Gagal kirim jawaban. Coba lagi.", "error"); console.error(err); } finally { setLoading(false); }
  };

  const selectedExam = examList.find(e => e.id === selectedExamId);
  const hasSession = currentUser?.session && currentUser.session !== '-' && currentUser.session.trim() !== '' && currentUser.session !== 'undefined';

  const schoolName = appConfig['SCHOOL_NAME'] || "EXAMORA DEVELOPMENT ASSESMENT";
  const schoolTagline = appConfig['SCHOOL_TAGLINE'] || "Digital Assessment for Future";
  const rawFooterCopyright = appConfig['FOOTER_COPYRIGHT'] || "© 2026 | Dev. MeyGa";
  const footerCopyright = rawFooterCopyright.includes("EXAMORA") ? "© 2026 | Dev. MeyGa" : rawFooterCopyright;
  const footerInfo = appConfig['FOOTER_INFO'] || "Secure Browser";
  const schoolLogo = appConfig['LOGO_SEKOLAH'] || "https://www.image2url.com/r2/default/images/1785421698382-3855a37b-f234-40a7-8038-1fe7b308a41e.png";

  // --- VIEW: BABAK SELECTION ---
  if (view === 'babak_selection') {
      return (
          <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between relative overflow-hidden select-none">
              {/* Dynamic Glowing Ambient Background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                  <motion.div 
                      animate={{
                          scale: [1, 1.2, 1],
                          x: [0, 50, 0],
                          y: [0, -50, 0],
                      }}
                      transition={{
                          duration: 15,
                          repeat: Infinity,
                          ease: "easeInOut"
                      }}
                      className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-indigo-600/15 rounded-full blur-[140px]"
                  />
                  <motion.div 
                      animate={{
                          scale: [1, 1.3, 1],
                          x: [0, -80, 0],
                          y: [0, 60, 0],
                      }}
                      transition={{
                          duration: 18,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: 1
                      }}
                      className="absolute -bottom-[15%] -right-[15%] w-[60%] h-[60%] bg-amber-500/15 rounded-full blur-[140px]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25"></div>
              </div>

              {/* HEADER AREA */}
              <header className="relative z-10 px-6 md:px-12 py-5 bg-slate-900/60 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3.5">
                      {schoolLogo ? (
                          <img src={schoolLogo} className="h-10 w-auto object-contain bg-white/10 p-1.5 rounded-xl border border-white/10" alt="Logo" />
                      ) : (
                          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md font-bold">
                              E
                          </div>
                      )}
                      <div>
                          <h1 className="font-black text-sm md:text-base tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-slate-100 to-amber-200 uppercase leading-none">
                              ES ENTHAL
                          </h1>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                              Digital Assessment System
                          </p>
                      </div>
                  </div>

                  {/* Identity pill / Welcome badge */}
                  <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/60 py-1.5 px-4 rounded-full shadow-inner max-w-xs md:max-w-md">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                      <span className="text-xs font-semibold text-slate-300 truncate hidden md:inline">
                          Regu Terkoneksi: <span className="font-black text-amber-400">{currentUser?.nama_lengkap}</span>
                      </span>
                      <span className="text-xs font-black text-amber-400 truncate md:hidden">
                          {currentUser?.nama_lengkap}
                      </span>
                  </div>
              </header>

              {/* MAIN CONTENT DASHBOARD */}
              <main className="relative z-10 flex-1 flex flex-col items-center justify-center py-10 px-4 md:px-8 max-w-6xl mx-auto w-full gap-8">
                  {/* Title Section */}
                  <motion.div 
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6 }}
                      className="text-center space-y-3"
                  >
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black rounded-full uppercase tracking-widest text-center mx-auto">
                          <Trophy size={14} className="animate-pulse" /> Babak Pemilihan Kompetisi LCC
                      </div>
                      <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                          Selamat Datang di <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-indigo-400 uppercase drop-shadow-sm">Layar Babak LCC</span>
                      </h2>
                      <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto font-medium leading-relaxed">
                          Halo, <span className="text-amber-400 font-extrabold">{currentUser?.nama_lengkap}</span> ({currentUser?.kelas_id || 'SD'}). Silakan pilih menu babak di bawah ini sesuai instruksi dari Panitia atau Juri.
                      </p>
                  </motion.div>

                  {/* Two Main Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl pt-2">
                      {/* CARD BABAK I */}
                      <motion.div 
                          initial={{ opacity: 0, x: -30 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileHover={{ scale: 1.03 }}
                          transition={{ type: "spring", stiffness: 300 }}
                          onMouseEnter={() => soundFx.playTick()}
                          onClick={() => {
                              soundFx.playCorrect();
                              setView('confirm');
                          }}
                          className="group relative cursor-pointer bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-2 border-indigo-500/30 hover:border-indigo-500 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-[0_0_50px_rgba(99,102,241,0.25)] h-[360px]"
                      >
                          {/* Top lighting effect */}
                          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />
                          <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-600/10 rounded-full blur-2xl group-hover:bg-indigo-600/20 transition-all duration-500" />

                          <div className="space-y-6">
                              {/* Glowing Icon Container */}
                              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/30 group-hover:bg-indigo-500/20 transition-all group-hover:scale-110 duration-300 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                                  <Laptop size={32} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                              </div>

                              <div>
                                  <span className="text-[11px] font-black uppercase text-indigo-400 tracking-widest block mb-1">
                                      KOMPETISI SESI UTAMA
                                  </span>
                                  <h3 className="text-2xl font-black text-white group-hover:text-indigo-300 transition-colors">
                                      BABAK I
                                  </h3>
                                  <p className="text-xs text-slate-400 font-medium mt-1">
                                      Computer Based Test (CBT)
                                  </p>
                              </div>

                              {/* Features checklist */}
                              <ul className="space-y-2 text-xs font-semibold text-slate-400">
                                  <li className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                      Tes Mandiri Tertulis Digital
                                  </li>
                                  <li className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                      Pilihan Ganda & Isian Singkat
                                  </li>
                                  <li className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                      Jawaban Tersimpan Otomatis
                                  </li>
                              </ul>
                          </div>

                          {/* Futuristic action button */}
                          <div className="pt-4 border-t border-slate-900 flex items-center justify-between text-indigo-400 font-black text-sm tracking-wider">
                              <span>MULAI UJIAN CBT</span>
                              <div className="p-2 bg-indigo-500/10 rounded-full group-hover:bg-indigo-500 text-white group-hover:translate-x-1.5 transition-all duration-300 shadow-sm border border-indigo-500/20">
                                  <ChevronRight size={16} />
                              </div>
                          </div>
                      </motion.div>

                      {/* CARD BABAK II */}
                      <motion.div 
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileHover={{ scale: 1.03 }}
                          transition={{ type: "spring", stiffness: 300 }}
                          onMouseEnter={() => soundFx.playTick()}
                          onClick={() => {
                              soundFx.playBell();
                              setView('regu_bell');
                          }}
                          className="group relative cursor-pointer bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-2 border-amber-500/30 hover:border-amber-500 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-[0_0_50px_rgba(245,158,11,0.25)] h-[360px]"
                      >
                          {/* Top lighting effect */}
                          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-80" />
                          <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all duration-500" />

                          <div className="space-y-6">
                              {/* Glowing Icon Container */}
                              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/30 group-hover:bg-amber-500/20 transition-all group-hover:scale-110 duration-300 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                                  <Bell size={32} className="text-amber-400 group-hover:text-amber-300 transition-colors" />
                              </div>

                              <div>
                                  <span className="text-[11px] font-black uppercase text-amber-400 tracking-widest block mb-1">
                                      KOMPETISI REBUTAN / INTERAKTIF
                                  </span>
                                  <h3 className="text-2xl font-black text-white group-hover:text-amber-300 transition-colors">
                                      BABAK II
                                  </h3>
                                  <p className="text-xs text-slate-400 font-medium mt-1">
                                      Cerdas Cermat (Smart Buzzer)
                                  </p>
                              </div>

                              {/* Features checklist */}
                              <ul className="space-y-2 text-xs font-semibold text-slate-400">
                                  <li className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      Layar Bel Regu LCC Interaktif
                                  </li>
                                  <li className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      Sistem Lock Bel / Buzzer Instant
                                  </li>
                                  <li className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      Live Synchronized Scoreboard
                                  </li>
                              </ul>
                          </div>

                          {/* Futuristic action button */}
                          <div className="pt-4 border-t border-slate-900 flex items-center justify-between text-amber-400 font-black text-sm tracking-wider">
                              <span>BUKA LAYAR BEL LCC</span>
                              <div className="p-2 bg-amber-500/10 rounded-full group-hover:bg-amber-500 text-slate-950 group-hover:translate-x-1.5 transition-all duration-300 shadow-sm border border-amber-500/20">
                                  <ChevronRight size={16} />
                              </div>
                          </div>
                      </motion.div>
                  </div>
              </main>

              {/* FOOTER AREA */}
              <footer className="relative z-10 px-6 py-6 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-950/80">
                  <button 
                      onClick={() => {
                          localStorage.removeItem('cbt_user');
                          sessionStorage.removeItem('cbt_user');
                          setCurrentUser(null);
                          setView('login');
                      }}
                      onMouseEnter={() => soundFx.playTick()}
                      className="text-xs font-bold text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 px-4 py-2 rounded-full inline-flex items-center gap-2 border border-transparent hover:border-rose-500/20 active:scale-95"
                  >
                      <LogOut size={14} /> Keluar & Kembali ke Login
                  </button>

                  <div className="text-center md:text-right text-[10px] md:text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      {footerCopyright} — {footerInfo}
                  </div>
              </footer>
          </div>
      );
  }

  // --- VIEW: LOGIN ---
  if (view === 'login') {
    return (
        <>
            {loading && <LoadingOverlay message={loadingMessage} />}
            <div className="min-h-screen flex font-sans bg-white overflow-hidden relative" onClick={enterFullscreen}>
                {/* Left Side - Brand / Visual */}
                <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-12 text-white group">
                    {/* Background Image & Overlay */}
                    <div className="absolute inset-0 z-0">
                         <img 
                            src="http://1.bp.blogspot.com/-kXFbVTyWQko/VCPunGaQFPI/AAAAAAAADTY/dJ5ACPw6eHk/s1600/Anak-anak-SD-berdiskusi-di-depan-perangkat-komputer.jpg" 
                            className="w-full h-full object-cover opacity-30 transition-transform duration-1000 ease-out group-hover:scale-110"
                         />
                         <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/90 via-indigo-900/50 to-indigo-900/30 mix-blend-multiply"></div>
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                             {/* 3D Effect for Main Brand Logo */}
                             {schoolLogo ? (
                                 <div className="relative transform hover:scale-105 transition-transform duration-300">
                                     {/* Glow Effect */}
                                     <div className="absolute inset-0 bg-white/20 blur-xl rounded-full"></div>
                                     <img 
                                        src={schoolLogo} 
                                        className="w-20 h-20 object-contain relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] animate-float filter brightness-110" 
                                        alt="Logo Sekolah" 
                                     />
                                 </div>
                             ) : (
                                 <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg">
                                    <GraduationCap size={32} className="text-white drop-shadow-md"/>
                                 </div>
                             )}
                             <div>
                                <span className="font-bold text-lg tracking-wide uppercase opacity-90 block leading-tight">{schoolName}</span>
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-white to-sky-300 drop-shadow-sm mt-1 block">
                                    {schoolTagline}
                                </span>
                             </div>
                        </div>
                        <h1 className="text-7xl font-black tracking-tighter mb-4 leading-none drop-shadow-2xl">
                            ES <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-white">ENTHAL</span>
                        </h1>
                        <p className="text-indigo-200 text-sm font-normal tracking-wide mt-2 inline-block">
                            E-Student Evaluation Network for Testing, Analytics, and Learning
                        </p>
                        <p className="text-indigo-100/80 text-sm mt-6 font-light leading-relaxed max-w-md">Platform Assesment Berbasis Digital yang aman, transparan, dan terintegrasi untuk mengukur perkembangan kemampuan akademik secara akurat.</p>
                    </div>

                    <div className="relative z-10 flex gap-4 text-xs font-medium text-indigo-200 uppercase tracking-widest">
                        <span>{footerCopyright}</span>
                        <span>•</span>
                        <span>{footerInfo}</span>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-slate-50 relative">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100 rounded-full blur-[80px] opacity-60 pointer-events-none"></div>
                     
                     <div className="w-full max-w-md bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 relative z-10">
                        <div className="mb-10 text-center lg:text-left">
                            
                            {/* 3D Container for Form Logo */}
                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-[0_15px_35px_-10px_rgba(0,0,0,0.2)] border-[5px] border-white mx-auto relative overflow-hidden group perspective-1000">
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-200 shadow-inner"></div>
                                {schoolLogo ? (
                                    <img 
                                        src={schoolLogo} 
                                        className="w-full h-full object-contain p-2 relative z-10 drop-shadow-lg transform transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" 
                                        alt="Logo" 
                                    />
                                ) : (
                                    <span className="font-black text-3xl text-slate-300 relative z-10">M</span>
                                )}
                            </div>

                            <div className="text-center mb-8 lg:hidden">
                                <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-tight">{schoolName}</h1>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{schoolTagline}</p>
                            </div>

                            <h2 className="text-3xl font-black text-slate-800 tracking-tighter leading-none mb-1 lg:hidden text-center">
                                ES <span className="text-indigo-600">ENTHAL</span>
                            </h2>
                            <p className="text-xs font-normal text-slate-400 mb-8 lg:hidden text-center">
                                E-Student Evaluation Network for Testing, Analytics, and Learning
                            </p>
                            
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Selamat Datang</h3>
                            <p className="text-slate-500 text-sm">Silakan masuk menggunakan akun Anda untuk memulai sesi.</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide ml-1">Username</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                        <UserIcon size={18}/>
                                    </div>
                                    <input 
                                        type="text" 
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-slate-800 placeholder-slate-300 text-sm" 
                                        value={loginForm.username} 
                                        onChange={e=>setLoginForm({...loginForm, username:e.target.value})} 
                                        placeholder="Username" 
                                        required 
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                        <Key size={18}/>
                                    </div>
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-slate-800 placeholder-slate-300 text-sm" 
                                        value={loginForm.password} 
                                        onChange={e=>setLoginForm({...loginForm, password:e.target.value})} 
                                        placeholder="Password" 
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                                        {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input 
                                    type="checkbox" 
                                    id="rememberMe" 
                                    checked={loginForm.rememberMe}
                                    onChange={e => setLoginForm({...loginForm, rememberMe: e.target.checked})}
                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                />
                                <label htmlFor="rememberMe" className="text-xs font-medium text-slate-600 cursor-pointer select-none">
                                    Ingat Saya
                                </label>
                            </div>

                            {errorMsg && (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-xs font-bold animate-shake">
                                    <AlertCircle size={16} className="shrink-0"/>
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <button 
                                disabled={loading} 
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-xl shadow-indigo-200 transition-all transform active:scale-[0.98] flex justify-center items-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 size={20} className="animate-spin" /> : <>Login <LogIn size={18} /></>}
                            </button>
                        </form>
                     </div>
                </div>
            </div>
        </>
    );
  }

  // --- VIEW: ADMIN ---
  // Pass handleSwitchUser to AdminDashboard
  if (view === 'admin' && currentUser) { return <AdminDashboard user={currentUser} onLogout={handleLogout} onSwitchUser={handleSwitchUser} />; }

  // --- VIEW: CONFIRMATION ---
  if (view === 'confirm') {
    return (
        <>
            {loading && <LoadingOverlay message={loadingMessage} />}
            <div className="min-h-screen bg-slate-50 font-sans flex flex-col fade-in" onClick={enterFullscreen}>
                {/* Navbar */}
                <nav className="bg-white border-b border-slate-200 px-4 md:px-8 h-16 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">
                             <Fingerprint size={18} />
                         </div>
                         <span className="font-bold text-slate-800 text-lg tracking-tight hidden md:block">Konfirmasi Data</span>
                    </div>
                    <button onClick={handleLogout} className="text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2">
                        <LogOut size={16}/> Keluar
                    </button>
                </nav>

                <div className="flex-1 p-4 md:p-8 flex items-center justify-center">
                    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Profile Card */}
                        <div className="md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
                            {isBereguExamType(currentUser?.exam_type) && (
                                <div className="mb-3 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs rounded-full shadow-sm flex items-center gap-1.5 animate-pulse">
                                    <Users size={14}/> Kategori Ujian Beregu (LCC)
                                </div>
                            )}
                            <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-indigo-500 to-violet-500 mb-4 shadow-lg overflow-hidden relative">
                                {currentUser?.photo_url ? (
                                    <img src={currentUser.photo_url} className="w-full h-full rounded-full object-cover border-4 border-white bg-white" alt="Profile" />
                                ) : (
                                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-indigo-200 border-4 border-white">
                                        {isBereguExamType(currentUser?.exam_type) ? <Users size={56} className="text-amber-500"/> : <UserIcon size={56}/>}
                                    </div>
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 leading-tight mb-1">
                                {currentUser?.nama_lengkap}
                            </h2>
                            <p className="text-slate-400 text-sm font-medium mb-4">{currentUser?.username}</p>
                            
                            <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-100 text-left space-y-3">
                                <div>
                                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                                        {isBereguExamType(currentUser?.exam_type) ? "Nama Regu / Tim" : "Nama Peserta"}
                                    </p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{currentUser?.nama_lengkap}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                                        {isBereguExamType(currentUser?.exam_type) ? "Asal Sekolah / Instansi" : "Sekolah"}
                                    </p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{currentUser?.kelas_id}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Kecamatan</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{currentUser?.kecamatan || '-'}</p>
                                </div>
                            </div>

                            {/* Layar Bel Regu LCC Button */}
                            <button 
                                onClick={() => setView('regu_bell')}
                                className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2 border border-amber-300 uppercase tracking-wide"
                            >
                                <Bell size={18} className="animate-bounce fill-slate-950" /> Buka Layar Bel Regu LCC
                            </button>
                        </div>

                        {/* Exam Details Card */}
                        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                                <BookOpen size={180} />
                            </div>

                            <div className="relative z-10">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <ShieldCheck className="text-emerald-500" size={20}/>
                                    Informasi Ujian
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Mata Pelajaran</label>
                                        {examList.length > 0 ? (
                                            <div className="flex items-center gap-3 mt-1">
                                                <select className="bg-transparent text-lg md:text-xl font-black text-indigo-700 outline-none w-full cursor-pointer" value={selectedExamId} onChange={e=>setSelectedExamId(e.target.value)} disabled={examList.length === 1}>
                                                    {examList.map(s=><option key={s.id} value={s.id}>{s.nama_ujian}</option>)}
                                                </select>
                                                {examList.length > 1 && <ChevronRight size={16} className="text-slate-400 rotate-90"/>}
                                            </div>
                                        ) : (
                                            <div className="text-rose-500 font-bold mt-1 flex items-center gap-2"><AlertCircle size={16}/> Tidak ada ujian aktif.</div>
                                        )}
                                        {/* Show Active TP if exists */}
                                        {currentUser?.active_tp && currentUser.active_tp !== '-' && (
                                            <div className="mt-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block">
                                                TP: {currentUser.active_tp}
                                            </div>
                                        )}
                                    </div>

                                    {/* Added: Jenis Ujian Display */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Jenis Ujian</label>
                                        <p className="text-lg font-bold text-indigo-600 mt-1">{currentUser?.exam_type || '-'}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Sesi</label>
                                            <p className="text-lg font-bold text-slate-700 mt-1">{currentUser?.session || '-'}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Durasi</label>
                                            <p className="text-lg font-bold text-slate-700 mt-1 flex items-center gap-2">
                                                <Clock size={18} className="text-slate-400"/> {selectedExam ? `${selectedExam.durasi} Menit` : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-8 pt-6 border-t border-slate-100 relative z-10">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-3">Token Ujian</label>
                                {hasSession ? (
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <input 
                                            type="text" 
                                            className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl p-4 text-center font-mono text-2xl font-bold tracking-[0.3em] uppercase focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder-slate-300"
                                            placeholder="Token Ujian" 
                                            maxLength={6} 
                                            value={inputToken} 
                                            onChange={e=> { setInputToken(e.target.value.toUpperCase()); setErrorMsg(''); }} 
                                        />
                                        <button 
                                            onClick={handleVerifyToken} 
                                            disabled={loading || examList.length === 0}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            <PlayCircle size={20} /> {localStorage.getItem(`cbt_start_${currentUser?.username}_${selectedExamId}`) ? "Lanjutkan" : "Mulai Ujian"}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-orange-50 border border-orange-100 text-orange-600 rounded-xl text-sm font-bold flex items-center gap-2">
                                        <Clock size={18} /> Anda belum memiliki jadwal sesi ujian. Hubungi Proktor.
                                    </div>
                                )}
                                {errorMsg && <p className="text-rose-600 text-sm font-bold mt-3 flex items-center gap-2 animate-shake"><AlertCircle size={16}/> {errorMsg}</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONFIRM MODAL */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-slate-900/60 backdrop-blur-sm fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center border border-white/20">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-100">
                            <Check size={40} strokeWidth={4} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Token Valid!</h3>
                        <p className="text-slate-500 mb-8 text-sm leading-relaxed">Waktu akan berjalan mundur otomatis setelah Anda menekan tombol mulai.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition">Batal</button>
                            <button onClick={handleStartExam} className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition">Mulai</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
  }

  // --- VIEW: REGU BELL ---
  if (view === 'regu_bell') {
    const handleBack = () => {
        const isReguAccount = currentUser?.username.toLowerCase().includes('regu') || currentUser?.username.toLowerCase().includes('team') || isBereguExamType(currentUser?.exam_type);
        setView(isReguAccount ? 'babak_selection' : 'confirm');
    };
    return <LccReguBuzzerView currentUser={currentUser || undefined} onBack={handleBack} />;
  }

  // --- VIEW: EXAM ---
  if (view === 'exam' && currentUser && selectedExam) {
    return (
        <StudentExam 
            exam={selectedExam}
            questions={questions}
            userFullName={currentUser.nama_lengkap}
            username={currentUser.username}
            userPhoto={currentUser.photo_url}
            startTime={startTime}
            examType={currentUser.exam_type || 'Sumatif'}
            onFinish={handleFinishExam}
            onExit={handleLogout}
        />
    );
  }

  // --- VIEW: RESULT ---
  if (view === 'result') {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans fade-in">
            <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl max-w-lg w-full border border-slate-200 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-green-500"></div>
                <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-emerald-100 shadow-lg animate-bounce-slow">
                    <Check size={48} strokeWidth={4} />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Ujian Selesai!</h2>
                <p className="text-slate-500 mb-8 font-medium">Jawaban Anda telah berhasil disimpan ke sistem.</p>
                
                <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                    <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Peserta</p>
                        <p className="text-lg font-bold text-slate-800">{currentUser?.nama_lengkap}</p>
                    </div>
                    <div className="h-px bg-slate-200 w-1/2 mx-auto my-4"></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mata Pelajaran</p>
                        <p className="text-lg font-bold text-indigo-600">{selectedExam?.nama_ujian}</p>
                    </div>
                </div>

                <button onClick={handleLogout} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition shadow-lg flex items-center justify-center gap-2">
                    <LogOut size={18} /> KELUAR
                </button>
            </div>
            <p className="mt-8 text-slate-400 text-xs font-bold tracking-widest uppercase">{footerCopyright}</p>
        </div>
      );
  }

  return null;
}

export default App;
