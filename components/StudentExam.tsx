
import React, { useState, useEffect, useRef } from 'react';
import { Clock, Check, ChevronLeft, ChevronRight, LayoutGrid, Flag, Monitor, LogOut, Loader2, AlertTriangle, X, ShieldAlert, RotateCcw, ZoomIn, ZoomOut, Maximize, Move, HelpCircle, User, Type, Users, Bell, Edit3 } from 'lucide-react';
import { isBereguExamType } from '../utils/adminHelpers';
import LccReguBuzzerView from './LccReguBuzzerView';

const isImageUrl = (val: string | undefined | null): boolean => {
    if (!val) return false;
    const trimmed = val.trim();
    if (trimmed.startsWith('data:image/')) return true;
    if (trimmed.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i) != null) return true;
    if ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && !trimmed.includes(' ') && !trimmed.includes('\n')) {
        return true;
    }
    return false;
};
import { QuestionWithOptions, UserAnswerValue, Exam } from '../types';
import { api } from '../src/services/api';
import { useToast } from '../context/ToastContext';

interface StudentExamProps {
  exam: Exam;
  questions: QuestionWithOptions[];
  userFullName: string;
  username: string; 
  userPhoto?: string;
  startTime: number;
  examType?: string; 
  onFinish: (answers: Record<string, UserAnswerValue>, questionCount: number, questionIds: string[], isTimeout?: boolean) => Promise<void> | void;
  onExit: () => void;
}

// Utility to shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

const ImageViewer = ({ src, onClose }: { src: string; onClose: () => void }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const lastTouchDistance = useRef<number | null>(null);

    const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 5));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.5, 1));
    const handleReset = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) { setIsDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); }
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) { e.preventDefault(); setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }
    };
    const handleMouseUp = () => setIsDragging(false);

    // Touch events (simplified)
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && scale > 1) {
            setIsDragging(true);
            setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
        }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && isDragging && scale > 1) {
            setPosition({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col justify-center items-center backdrop-blur-md animate-in fade-in duration-200">
            <div className="absolute top-4 right-4 z-50">
                <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition"><X size={24} /></button>
            </div>
            <div className="w-full h-full flex items-center justify-center overflow-hidden cursor-move touch-none" 
                 onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                 onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={() => setIsDragging(false)}>
                <img src={src} className="max-w-full max-h-full object-contain transition-transform duration-100 ease-out select-none" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }} draggable={false} />
            </div>
            <div className="absolute bottom-8 flex gap-4 bg-black/50 p-2 rounded-2xl backdrop-blur-md border border-white/10">
                <button onClick={handleZoomOut} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl" disabled={scale<=1}><ZoomOut size={20}/></button>
                <button onClick={handleReset} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl"><RotateCcw size={20}/></button>
                <button onClick={handleZoomIn} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl" disabled={scale>=5}><ZoomIn size={20}/></button>
            </div>
        </div>
    );
};

const StudentExam: React.FC<StudentExamProps> = ({ exam, questions, userFullName, username, userPhoto, startTime, examType, onFinish, onExit }) => {
  const { showToast } = useToast();
  const [examQuestions, setExamQuestions] = useState<QuestionWithOptions[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswerValue>>({});
  const [doubtful, setDoubtful] = useState<Record<string, boolean>>({});
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [violationCount, setViolationCount] = useState(0);
  const [appConfig, setAppConfig] = useState<Record<string, string>>({});
  const [showBellModal, setShowBellModal] = useState(false);

  const storageKey = `cbt_answers_${username}_${exam.id}`;

  // Initialize Config & Questions
  useEffect(() => {
    api.getAppConfig().then(setAppConfig).catch(console.error);

    if (questions.length > 0) {
        const questionsWithShuffledOptions = questions.map(q => ({ ...q, options: shuffleArray(q.options) }));
        let fullyShuffled = shuffleArray(questionsWithShuffledOptions);
        if (exam.max_questions && exam.max_questions > 0) {
            fullyShuffled = fullyShuffled.slice(0, exam.max_questions);
        }
        setExamQuestions(fullyShuffled);
        
        // Load Saved State
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.answers) setAnswers(parsed.answers);
                if (parsed.doubtful) setDoubtful(parsed.doubtful);
            }
        } catch(e) { console.error("Failed load saved", e); }
    }
  }, [questions, storageKey, exam.max_questions]);

  // Auto Save
  useEffect(() => {
      if (Object.keys(answers).length > 0) {
          localStorage.setItem(storageKey, JSON.stringify({ answers, doubtful }));
      }
  }, [answers, doubtful, storageKey]);

  // Timer & Auto Submit Logic
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      // Calculate absolute time elapsed based on server-synced start time
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const totalSeconds = exam.durasi * 60;
      const remaining = Math.max(0, totalSeconds - elapsedSeconds);
      
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
          executeFinish(true);
      }
    };

    // Immediate check on mount
    updateTimer();

    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [startTime, exam.durasi]);

  const executeFinish = async (isTimeout = false) => {
    if (isSubmitting) return; // Prevent double submission
    setShowConfirmFinish(false);
    setIsSubmitting(true);
    try {
        const qIds = examQuestions.map(q => q.id);
        await onFinish(answers, examQuestions.length, qIds, isTimeout);
    } catch (error) {
        console.error("Error submitting", error);
        setIsSubmitting(false);
        showToast("Gagal kirim jawaban. Periksa koneksi.", "error");
    }
  };

  // Anti-Cheat (Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => { 
        if (document.hidden) {
             setViolationCount(prev => prev + 1);
             setIsLocked(false);
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const resumeExam = async () => {
      if (violationCount >= 3) { showToast("Terlalu banyak pelanggaran. Ujian dihentikan.", "error"); onExit(); return; }
      try {
          const el = document.documentElement;
          if (el.requestFullscreen) await el.requestFullscreen();
      } catch(e) {}
      setIsLocked(true);
  };

  const handleAnswer = (val: any, type: string, subId?: string) => {
      const qId = examQuestions[currentIdx].id;
      setAnswers(prev => {
          if (type === 'PG') return { ...prev, [qId]: val };
          if (type === 'PGK') {
              const currentArr = (prev[qId] as string[]) || [];
              if (currentArr.includes(val)) return { ...prev, [qId]: currentArr.filter(x => x !== val) };
              return { ...prev, [qId]: [...currentArr, val] };
          }
          if (type === 'BS' && subId) {
             const currentObj = (prev[qId] as Record<string, boolean>) || {};
             return { ...prev, [qId]: { ...currentObj, [subId]: val } };
          }
          if (type === 'URAIAN') {
             return { ...prev, [qId]: val };
          }
          return prev;
      });
  };

  const formatTime = (s: number) => {
      const h = Math.floor(s / 3600).toString().padStart(2, '0');
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `${h}:${m}:${sec}`;
  };

  if (examQuestions.length === 0) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  const currentQ = examQuestions[currentIdx];
  const isLast = currentIdx === examQuestions.length - 1;
  const progress = Math.round((Object.keys(answers).length / examQuestions.length) * 100);
  const schoolLogo = appConfig['LOGO_SEKOLAH'] || "https://www.image2url.com/r2/default/images/1785421698382-3855a37b-f234-40a7-8038-1fe7b308a41e.png";

  return (
    <div className={`flex flex-col h-screen bg-slate-100 font-sans overflow-hidden select-none ${!isLocked ? 'blur-sm pointer-events-none' : ''}`}>
      {zoomedImage && <ImageViewer src={zoomedImage} onClose={() => setZoomedImage(null)} />}
      {isSubmitting && (
          <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur flex items-center justify-center">
              <div className="text-center">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-2"/>
                  <p className="font-bold text-slate-700">Menyimpan Jawaban...</p>
              </div>
          </div>
      )}
      
      {/* VIOLATION OVERLAY */}
      {!isLocked && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 pointer-events-auto">
              <div className="bg-white p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
                  <ShieldAlert size={64} className="text-rose-500 mx-auto mb-4"/>
                  <h2 className="text-2xl font-black text-slate-800">Pelanggaran Terdeteksi!</h2>
                  <p className="text-slate-500 mt-2 mb-6">Anda meninggalkan layar ujian. Ini tercatat sebagai pelanggaran ({violationCount}/3).</p>
                  <button onClick={resumeExam} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition">Kembali ke Ujian</button>
              </div>
          </div>
      )}

      {/* HEADER - UPDATED BRANDING & USER IDENTITY */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-2 flex items-center justify-between shrink-0 z-20 shadow-sm relative h-auto">
          {/* LEFT: BRANDING */}
          <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-11 md:h-11 bg-white rounded-xl flex items-center justify-center shadow-md shadow-slate-200 border border-slate-100 overflow-hidden relative shrink-0">
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-white"></div>
                   {schoolLogo ? (
                       <img src={schoolLogo} className="w-full h-full object-contain p-1 relative z-10" alt="Logo" />
                   ) : (
                       <div className="font-black text-indigo-600 text-xl relative z-10">M</div>
                   )}
              </div>
              <div className="leading-tight hidden sm:block">
                  <h1 className="font-black text-lg md:text-xl text-slate-800 tracking-tighter">
                      ES <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">ENTHAL</span>
                  </h1>
                  <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-tight max-w-[150px] md:max-w-[200px]">
                      Evaluation Digital
                  </p>
              </div>
          </div>

          {/* RIGHT: TIMER, IDENTITY & TOGGLE */}
          <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full font-mono font-bold text-sm md:text-lg border shadow-sm ${timeLeft < 300 ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse' : 'bg-white border-slate-200 text-slate-700'}`}>
                  <Clock size={18} className="shrink-0"/> {formatTime(timeLeft)}
              </div>
              
              {/* USER IDENTITY */}
              <div className="hidden md:flex flex-col items-end border-r border-slate-200 pr-4 mr-1">
                  {isBereguExamType(examType) && (
                      <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1 mb-0.5">
                          <Users size={10}/> REGU LCC
                      </span>
                  )}
                  <p className="font-bold text-slate-800 text-sm">{userFullName}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{isBereguExamType(examType) ? `Regu: ${username}` : username}</p>
              </div>

              {/* SUBJECT & EXAM TYPE (Info Soal) */}
              <div className="hidden lg:flex flex-col items-end border-r border-slate-200 pr-4 mr-1">
                  <p className="font-black text-indigo-600 text-sm">{exam.nama_ujian}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{examType || 'Sumatif'}</p>
              </div>

              {/* LAYAR BEL REGU LCC BUTTON */}
              <button 
                  onClick={() => setShowBellModal(true)} 
                  className="px-3 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/25 hover:scale-105 active:scale-95 transition border border-amber-300"
                  title="Buka Layar Bel Regu LCC"
              >
                  <Bell size={16} className="animate-bounce fill-slate-950"/> 
                  <span className="hidden sm:inline">LAYAR BEL</span>
              </button>

              <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-full border border-slate-200 transition">
                  <LayoutGrid size={20}/>
              </button>
          </div>
      </header>

      {/* MAIN CONTENT - SPLIT LAYOUT */}
      <div className="flex-1 flex overflow-hidden relative">
          <main className="flex-1 overflow-y-auto bg-slate-100 p-2 md:p-4 pb-28">
              <div className="w-full h-full flex flex-col">
                  {/* Question Card - UPDATED: Constrained Max Width */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col w-full max-w-6xl mx-auto">
                      {/* Question Toolbar */}
                      <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 bg-slate-50/50 shrink-0">
                          <div className="flex items-center gap-3">
                              <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm shadow-indigo-200">Soal No. {currentIdx + 1}</span>
                              <span className="text-xs font-bold text-slate-400">/ {examQuestions.length}</span>
                          </div>
                          <div className="flex items-center gap-1">
                              <button onClick={() => setFontSize('sm')} className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold transition ${fontSize==='sm'?'bg-white shadow text-indigo-600 ring-1 ring-slate-200':'text-slate-400 hover:bg-slate-100'}`}>A-</button>
                              <button onClick={() => setFontSize('md')} className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold transition ${fontSize==='md'?'bg-white shadow text-indigo-600 ring-1 ring-slate-200':'text-slate-400 hover:bg-slate-100'}`}>A</button>
                              <button onClick={() => setFontSize('lg')} className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold transition ${fontSize==='lg'?'bg-white shadow text-indigo-600 ring-1 ring-slate-200':'text-slate-400 hover:bg-slate-100'}`}>A+</button>
                          </div>
                      </div>

                      <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
                           {/* SPLIT LAYOUT CONTAINER */}
                           <div className={`flex flex-col lg:flex-row gap-8 h-full ${fontSize==='lg'?'text-2xl':fontSize==='sm'?'text-base':'text-lg'}`}>
                                
                                {/* LEFT SIDE: IMAGE OR TEXT DESCRIPTION (If Exists) */}
                                {currentQ.gambar && (
                                    isImageUrl(currentQ.gambar) ? (
                                        <div className="lg:w-1/3 shrink-0">
                                            <div className="rounded-xl border border-slate-200 p-2 bg-slate-50 relative group shadow-sm sticky top-0">
                                                <img src={currentQ.gambar} className="w-full h-auto max-h-[500px] object-contain rounded-lg cursor-zoom-in bg-white" onClick={() => setZoomedImage(currentQ.gambar!)} />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                                                    <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 backdrop-blur-sm"><Maximize size={12}/> Perbesar Gambar</span>
                                                </div>
                                            </div>
                                            {/* Added Caption from Database */}
                                            {currentQ.caption ? (
                                                <p className="text-center text-blue-600 text-sm font-bold mt-3 leading-relaxed animate-in fade-in slide-in-from-top-2">
                                                    {currentQ.caption}
                                                </p>
                                            ) : (
                                                <p className="text-center text-slate-400 text-xs font-medium mt-2 italic">
                                                    Klik gambar untuk memperbesar
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="lg:w-1/3 shrink-0">
                                            <div className="rounded-2xl border border-indigo-200 p-5 bg-gradient-to-br from-indigo-50/80 to-blue-50/50 shadow-sm sticky top-0 space-y-3">
                                                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider border-b border-indigo-100/80 pb-2">
                                                    <Type size={14} className="text-indigo-600"/> Deskripsi / Wacana Soal
                                                </div>
                                                <div className="text-slate-800 text-sm md:text-base leading-relaxed font-normal whitespace-pre-line">
                                                    {currentQ.gambar}
                                                </div>
                                                {currentQ.caption && (
                                                    <p className="text-xs text-indigo-600 font-medium italic pt-2 border-t border-indigo-100">
                                                        {currentQ.caption}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                )}

                                {/* RIGHT SIDE: CONTENT & OPTIONS */}
                                <div className="flex-1 min-w-0">
                                    <div className="prose max-w-none text-slate-800 leading-relaxed mb-8 font-medium">
                                        {currentQ.text_soal}
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {currentQ.tipe_soal === 'PG' && (
                                            <div className="grid grid-cols-1 gap-4">
                                                {currentQ.options.map((opt, i) => {
                                                    const isSel = answers[currentQ.id] === opt.id;
                                                    return (
                                                        <div key={opt.id} onClick={() => handleAnswer(opt.id, 'PG')} 
                                                             className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 group ${isSel ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
                                                            <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-lg transition-colors border-2 ${isSel ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-500 group-hover:border-indigo-400 group-hover:text-indigo-600'}`}>
                                                                {String.fromCharCode(65 + i)}
                                                            </div>
                                                            <div className="pt-1.5 flex-1 font-medium text-slate-700">
                                                                {opt.text_jawaban.startsWith('http') ? <img src={opt.text_jawaban} className="h-24 rounded border border-slate-200" /> : opt.text_jawaban}
                                                            </div>
                                                            {isSel && <div className="bg-indigo-600 text-white rounded-full p-1 mt-1"><Check size={16} /></div>}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        
                                        {currentQ.tipe_soal === 'PGK' && currentQ.options.map((opt) => {
                                            const curr = (answers[currentQ.id] as string[]) || [];
                                            const isSel = curr.includes(opt.id);
                                            return (
                                                <div key={opt.id} onClick={() => handleAnswer(opt.id, 'PGK')} 
                                                     className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSel ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}>
                                                    <div className={`w-8 h-8 shrink-0 rounded-lg border-2 flex items-center justify-center mt-1 transition-colors ${isSel ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                                                        {isSel && <Check size={18} strokeWidth={3} />}
                                                    </div>
                                                    <div className="flex-1 font-medium text-slate-700">{opt.text_jawaban}</div>
                                                </div>
                                            )
                                        })}

                                        {/* TABEL BENAR - SALAH */}
                                        {currentQ.tipe_soal === 'BS' && (
                                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                <table className="w-full text-left">
                                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-200">
                                                        <tr>
                                                            <th className="p-4">Pernyataan</th>
                                                            <th className="p-4 w-24 text-center border-l border-slate-200">Benar</th>
                                                            <th className="p-4 w-24 text-center border-l border-slate-200">Salah</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                        {currentQ.options.map((opt, i) => {
                                                            const val = (answers[currentQ.id] as Record<string, boolean>)?.[opt.id];
                                                            return (
                                                                <tr key={opt.id} className="hover:bg-slate-50/50">
                                                                    <td className="p-4 font-medium text-slate-700">{opt.text_jawaban}</td>
                                                                    <td className="p-4 text-center border-l border-slate-100 bg-emerald-50/10">
                                                                        <label className="cursor-pointer flex justify-center items-center h-full w-full">
                                                                            <input 
                                                                                type="radio" 
                                                                                name={`bs-${currentQ.id}-${opt.id}`}
                                                                                checked={val === true}
                                                                                onChange={() => handleAnswer(true, 'BS', opt.id)}
                                                                                className="w-6 h-6 text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                                                                            />
                                                                        </label>
                                                                    </td>
                                                                    <td className="p-4 text-center border-l border-slate-100 bg-rose-50/10">
                                                                        <label className="cursor-pointer flex justify-center items-center h-full w-full">
                                                                            <input 
                                                                                type="radio" 
                                                                                name={`bs-${currentQ.id}-${opt.id}`}
                                                                                checked={val === false}
                                                                                onChange={() => handleAnswer(false, 'BS', opt.id)}
                                                                                className="w-6 h-6 text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                                                                            />
                                                                        </label>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* SOAL URAIAN / ESSAY */}
                                        {currentQ.tipe_soal === 'URAIAN' && (
                                            <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-sm">
                                                <label className="text-xs font-bold text-slate-500 uppercase block mb-3 flex items-center gap-2">
                                                    <Edit3 size={16} className="text-indigo-600"/>
                                                    Jawaban Uraian Anda:
                                                </label>
                                                <textarea
                                                    rows={6}
                                                    className="w-full outline-none font-medium text-slate-800 text-sm md:text-base leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-200 focus:bg-white resize-y transition-all"
                                                    placeholder="Tuliskan jawaban uraian Anda secara lengkap di sini..."
                                                    value={(answers[currentQ.id] as string) || ''}
                                                    onChange={(e) => handleAnswer(e.target.value, 'URAIAN')}
                                                />
                                                <p className="text-[11px] text-slate-400 mt-2 italic">Jawaban Anda akan tersimpan secara otomatis.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                           </div>
                      </div>
                  </div>
              </div>
          </main>
      </div>

      {/* FOOTER NAV - UPDATED BUTTON COLORS & ROUNDED */}
      <footer className="h-24 bg-white border-t border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0 z-30 fixed bottom-0 w-full lg:w-auto lg:static shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
          <button onClick={() => setCurrentIdx(p => Math.max(0, p - 1))} disabled={currentIdx === 0} className="px-6 py-3 rounded-full font-bold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-30 disabled:bg-slate-300 transition flex items-center gap-2 shadow-lg shadow-rose-200 disabled:shadow-none active:scale-95">
              <ChevronLeft size={20}/> Sebelumnya
          </button>
          
          <label className={`flex items-center gap-3 px-6 py-3 rounded-full cursor-pointer transition select-none border-2 active:scale-95 ${doubtful[currentQ.id] ? 'bg-amber-400 border-amber-400 text-white shadow-lg shadow-amber-200' : 'bg-white border-amber-200 text-amber-500 hover:bg-amber-50'}`}>
              <input type="checkbox" className="hidden" checked={!!doubtful[currentQ.id]} onChange={() => setDoubtful(p => ({...p, [currentQ.id]: !p[currentQ.id]}))} />
              <Flag size={20} className={doubtful[currentQ.id] ? "fill-white" : "fill-amber-500"} />
              <span className="font-bold text-sm hidden sm:inline">Ragu-ragu</span>
          </label>

          {isLast ? (
              <button onClick={() => setShowConfirmFinish(true)} className="px-8 py-3 rounded-full font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition flex items-center gap-2 active:scale-95">
                  Selesai <Check size={20}/>
              </button>
          ) : (
              <button onClick={() => setCurrentIdx(p => Math.min(examQuestions.length - 1, p + 1))} className="px-6 py-3 rounded-full font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition flex items-center gap-2 active:scale-95">
                  Selanjutnya <ChevronRight size={20}/>
              </button>
          )}
      </footer>

      {/* SIDEBAR NAVIGATION */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setIsSidebarOpen(false)} />}
      <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Navigasi Soal</h3>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-5 gap-3">
                  {examQuestions.map((q, i) => {
                      const isAns = answers[q.id];
                      const isDbt = doubtful[q.id];
                      const isAct = currentIdx === i;
                      
                      let bg = "bg-white border-slate-200 text-slate-600";
                      if (isAct) bg = "bg-indigo-600 border-indigo-600 text-white ring-2 ring-indigo-200";
                      else if (isDbt) bg = "bg-amber-400 border-amber-400 text-white";
                      else if (isAns) bg = "bg-slate-800 border-slate-800 text-white";

                      return (
                          <button key={q.id} onClick={() => { setCurrentIdx(i); setIsSidebarOpen(false); }} className={`aspect-square rounded-xl border font-bold text-sm transition-all hover:scale-105 ${bg}`}>
                              {i + 1}
                          </button>
                      )
                  })}
              </div>
          </div>
          <div className="p-4 bg-slate-50 text-xs font-medium text-slate-500 space-y-2 border-t border-slate-100">
              <div className="flex items-center gap-2"><span className="w-3 h-3 bg-indigo-600 rounded-full"></span> Sedang Dikerjakan</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 bg-slate-800 rounded-full"></span> Sudah Dijawab</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 bg-amber-400 rounded-full"></span> Ragu-ragu</div>
          </div>
      </div>

      {/* CONFIRM FINISH MODAL */}
      {showConfirmFinish && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <HelpCircle size={32}/>
                  </div>
                  <h3 className="font-black text-xl text-slate-800 mb-2">Kirim Jawaban?</h3>
                  <p className="text-slate-500 text-sm mb-6">Pastikan seluruh soal telah terjawab. Anda tidak dapat mengubah jawaban setelah ini.</p>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mb-6">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="block text-slate-400 text-xs font-bold uppercase">Terjawab</span>
                          <span className="block text-xl font-black text-slate-800">{Object.keys(answers).length}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="block text-slate-400 text-xs font-bold uppercase">Sisa</span>
                          <span className="block text-xl font-black text-slate-800">{examQuestions.length - Object.keys(answers).length}</span>
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setShowConfirmFinish(false)} className="flex-1 py-3 font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cek Lagi</button>
                      <button onClick={() => executeFinish(false)} className="flex-1 py-3 font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">Ya, Kirim</button>
                  </div>
              </div>
          </div>
      )}

      {/* LCC REGU BELL MODAL OVERLAY */}
      {showBellModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col fade-in">
              <LccReguBuzzerView 
                  currentUser={{ username, nama_lengkap: userFullName, photo_url: userPhoto, exam_type: examType } as any}
                  onBack={() => setShowBellModal(false)}
              />
          </div>
      )}
    </div>
  );
};

export default StudentExam;
