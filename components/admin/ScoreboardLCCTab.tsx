import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    Trophy, Play, Pause, RotateCcw, Plus, Minus, Volume2, VolumeX, Maximize, Minimize, 
    Settings, Clock, Bell, Users, ShieldAlert, CheckCircle2, XCircle, ArrowRight, 
    Download, Upload, FileSpreadsheet, FileText, RefreshCw, Lock, Unlock, Zap, 
    Sparkles, Radio, Award, AlertCircle, History, Undo, Redo, Eye, EyeOff, Monitor, ChevronRight, ChevronLeft, HelpCircle,
    ExternalLink, Tv, Copy, X, LogOut, BookOpen, Edit3, Trash2, Check, Search, FileUp, Save, Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import { soundFx } from '../../utils/scoreboardAudio';
import { useToast } from '../../context/ToastContext';
import { User } from '../../types';
import { api } from '../../src/services/api';
import { TeamMemberBadge, parseTeamAndMembers, syncTeamsWithParticipants, getSubjects } from '../../utils/adminHelpers';
import ConfirmationModal from '../ui/ConfirmationModal';

export interface LccTeam {
    id: string;
    name: string;
    school: string;
    gugus?: string;
    score: number;
    color: string;
    logo?: string;
    correctCount: number;
    wrongCount: number;
    members?: string[];
}

export interface ScoreHistoryLog {
    id: string;
    timestamp: string;
    teamId: string;
    teamName: string;
    delta: number;
    newScore: number;
    reason: string;
    category?: string;
}

export interface LccQuestion {
    id: string;
    nomorSoal: number;
    babak: string;
    soal: string;
    referensiJawaban: string;
    poin: number;
    kategori?: string;
}

export interface LccConfig {
    namaLomba: string;
    tema: string;
    namaBabak: string;
    nomorSoal: number;
    statusSoal: 'Wajib' | 'Lempar' | 'Rebutan';
    durasiTimer: number; // in seconds
    runningText: string;
    logoUrl: string;
    nilaiWajib: number;
    nilaiLempar: number;
    nilaiRebutan: number;
    penguranganSalah: number;
    bonusPoint: number;
    tambahSkorSteps: number[];
    kurangSkorSteps: number[];
    tampilkanSoalKeProjector: boolean;
    activeGugus?: string;
}

const DEFAULT_TEAMS: LccTeam[] = [];

const DEFAULT_QUESTIONS: LccQuestion[] = [];

const DEFAULT_CONFIG: LccConfig = {
    namaLomba: 'LOMBA CERDAS CERMAT TINGKAT KABUPATEN',
    tema: 'Menuju Generasi Emas Cerdas, Tangkas, & Berkarakter',
    namaBabak: 'Babak Penyisihan',
    nomorSoal: 1,
    statusSoal: 'Wajib',
    durasiTimer: 60,
    runningText: 'Selamat Bertanding di Lomba Cerdas Cermat - Junjung Tinggi Sportivitas! Raih Prestasi Terbaik!',
    logoUrl: 'https://www.image2url.com/r2/default/images/1785421698382-3855a37b-f234-40a7-8038-1fe7b308a41e.png',
    nilaiWajib: 100,
    nilaiLempar: 50,
    nilaiRebutan: 100,
    penguranganSalah: 50,
    bonusPoint: 10,
    tambahSkorSteps: [5, 10, 20, 25, 50, 100],
    kurangSkorSteps: [5, 10, 20, 50, 100],
    tampilkanSoalKeProjector: true,
    activeGugus: 'all',
};

interface FloatingAnim {
    id: string;
    teamId: string;
    text: string;
    type: 'plus' | 'minus';
}

interface ScoreboardLCCTabProps {
    forceScoreboardMode?: boolean;
    currentUser?: User;
}

export const ScoreboardLCCTab: React.FC<ScoreboardLCCTabProps> = ({ forceScoreboardMode = false, currentUser }) => {
    const { showToast } = useToast();
    const userRoleLower = (currentUser?.role || '').toLowerCase();
    const isJuri = userRoleLower === 'juri';
    const isOperatorLimited = !['admin', 'guru'].includes(userRoleLower) && (
        userRoleLower.includes('operator') || 
        userRoleLower.includes('gugus') || 
        userRoleLower.includes('kecamatan')
    );

    // Helper to parse Gugus from team school
    const getTeamGugus = (t: LccTeam) => {
        if (!t.school) return '';
        if (t.school.includes(' | ')) {
            return t.school.split(' | ')[0].trim();
        }
        return '';
    };

    const getTeamSchoolOnly = (t: LccTeam) => {
        if (!t.school) return '';
        if (t.school.includes(' | ')) {
            return t.school.split(' | ')[1].trim();
        }
        return t.school;
    };

    const getTeamNameOnly = (t: LccTeam) => {
        if (!t.name) return '';
        let name = t.name.split('|')[0].trim();
        name = name.replace(/\s*\([^)]*\)/g, '').trim();
        return name;
    };

    // MODE: 'operator' | 'scoreboard'
    const [viewMode, setViewMode] = useState<'operator' | 'scoreboard'>(forceScoreboardMode ? 'scoreboard' : 'operator');
    const [showProjectorGuideModal, setShowProjectorGuideModal] = useState<boolean>(false);

    // PROJECTOR WINDOW HANDLERS
    const openProjectorWindow = () => {
        const displayUrl = window.location.origin + window.location.pathname + '?display=scoreboard';
        window.open(displayUrl, 'LCC_Projector_Display', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
        showToast('Scoreboard LCC dibuka di Jendela Baru! Geser jendela tersebut ke Layar LCD Proyektor.', 'success');
    };

    const copyProjectorUrl = () => {
        const displayUrl = window.location.origin + window.location.pathname + '?display=scoreboard';
        navigator.clipboard.writeText(displayUrl);
        showToast('Link Tampilan Proyektor berhasil disalin!', 'success');
    };

    const handleExitScoreboard = () => {
        if (forceScoreboardMode) {
            window.close();
        } else {
            setViewMode('operator');
        }
    };

    // CONFIG & DATA STATE (Strictly Supabase Database synchronized)
    const [config, setConfig] = useState<LccConfig>(DEFAULT_CONFIG);
    const [teams, setTeams] = useState<LccTeam[]>([]);
    const [history, setHistory] = useState<ScoreHistoryLog[]>([]);
    const [questions, setQuestions] = useState<LccQuestion[]>([]);
    const [isInitialLoaded, setIsInitialLoaded] = useState<boolean>(false);

    const [tambahSkorStr, setTambahSkorStr] = useState((config.tambahSkorSteps || [5, 10, 20, 25, 50, 100]).join(', '));
    const [kurangSkorStr, setKurangSkorStr] = useState((config.kurangSkorSteps || [5, 10, 20, 50, 100]).join(', '));
    const [penguranganSalahStr, setPenguranganSalahStr] = useState(String(config.penguranganSalah || 0));
    const [bonusPointStr, setBonusPointStr] = useState(String(config.bonusPoint || 0));

    const availableGugus = Array.from(new Set(
        teams.map(getTeamGugus).filter(Boolean)
    ));

    const activeGugus = config.activeGugus || 'all';

    const displayedTeams = activeGugus === 'all'
        ? teams
        : teams.filter(t => getTeamGugus(t).toLowerCase() === activeGugus.toLowerCase());

    const [showAnswerJuri, setShowAnswerJuri] = useState<boolean>(true);
    const [isQuestionCardOpen, setIsQuestionCardOpen] = useState<boolean>(true);
    const [customScoreInputs, setCustomScoreInputs] = useState<{ [teamId: string]: string }>({});
    const [questionSearch, setQuestionSearch] = useState<string>('');
    const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
    const [savingLccId, setSavingLccId] = useState<string | null>(null);
    const [isFormSaved, setIsFormSaved] = useState<boolean>(false);
    const [deleteConfirmQuestionId, setDeleteConfirmQuestionId] = useState<string | null>(null);
    const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);
    const [resetScoreTeamId, setResetScoreTeamId] = useState<string | null>(null);
    const [showResetAllDataModal, setShowResetAllDataModal] = useState<boolean>(false);
    const [deleteConfirmTeamId, setDeleteConfirmTeamId] = useState<string | null>(null);
    const [isTeamSelectorModalOpen, setIsTeamSelectorModalOpen] = useState<boolean>(false);
    const [candidateTeams, setCandidateTeams] = useState<LccTeam[]>([]);
    const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
    const [questionForm, setQuestionForm] = useState({
        nomorSoal: 1,
        babak: 'Babak Penyisihan - Soal Wajib',
        soal: '',
        referensiJawaban: '',
        poin: 100,
        kategori: 'Pengetahuan Umum'
    });

    // Auto calculate next question number when questions load or change
    useEffect(() => {
        if (!editingQuestionId && !isFormSaved && (!questionForm.soal || !questionForm.soal.trim())) {
            const maxNum = questions.length > 0 ? Math.max(0, ...questions.map(q => q.nomorSoal || 0)) : 0;
            setQuestionForm(prev => ({ ...prev, nomorSoal: maxNum + 1 }));
        }
    }, [questions, editingQuestionId, isFormSaved]);

    // TIMER STATE
    const [timeLeft, setTimeLeft] = useState<number>(config.durasiTimer);
    const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
    const [isTimeout, setIsTimeout] = useState<boolean>(false);

    // BUZZER STATE
    const [isBuzzerOpen, setIsBuzzerOpen] = useState<boolean>(false);
    const [lockedTeamId, setLockedTeamId] = useState<string | null>(null);
    const [lockedTime, setLockedTime] = useState<string | null>(null);

    // LEMPAR TANGKAP STATE
    const [failingTeamId, setFailingTeamId] = useState<string>('');

    // FLOATING ANIMATIONS
    const [floatingAnims, setFloatingAnims] = useState<FloatingAnim[]>([]);
    const [shakingTeamId, setShakingTeamId] = useState<string | null>(null);

    // SYSTEM STATES
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [clockTime, setClockTime] = useState<string>('');
    const [activeTabOperator, setActiveTabOperator] = useState<'control' | 'soal' | 'settings' | 'history' | 'export'>('control');
    const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
    const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
    const [isSavingQuestions, setIsSavingQuestions] = useState<boolean>(false);

    // Enforce allowed tabs for Operator Gugus / Operator Kecamatan
    useEffect(() => {
        if (isOperatorLimited && activeTabOperator !== 'control' && activeTabOperator !== 'history') {
            setActiveTabOperator('control');
        }
    }, [isOperatorLimited, activeTabOperator]);

    // Sync Broadcast Channel across windows/tabs
    const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
        if (typeof BroadcastChannel !== 'undefined') {
            broadcastChannelRef.current = new BroadcastChannel('lcc_scoreboard_sync');
            broadcastChannelRef.current.onmessage = (event) => {
                if (event.data && event.data.type === 'SYNC_STATE') {
                    const { config: c, teams: t, questions: q, timeLeft: tl, isTimerRunning: tr, isTimeout: to, isBuzzerOpen: bo, lockedTeamId: lt } = event.data.payload;
                    if (c) setConfig(c);
                    if (t) setTeams(t);
                    if (q) setQuestions(q);
                    if (typeof tl === 'number') setTimeLeft(tl);
                    if (typeof tr === 'boolean') setIsTimerRunning(tr);
                    if (typeof to === 'boolean') setIsTimeout(to);
                    if (typeof bo === 'boolean') setIsBuzzerOpen(bo);
                    if (lt !== undefined) setLockedTeamId(lt);
                } else if (event.data && event.data.type === 'TRIGGER_BUZZER') {
                    const { teamId } = event.data.payload || {};
                    if (teamId) {
                        triggerBuzzer(teamId);
                    }
                }
            };
        }
        return () => {
            broadcastChannelRef.current?.close();
        };
    }, []);

    const syncStateToOtherTabs = (newStateOverrides?: any) => {
        const payload = {
            config,
            teams,
            questions,
            timeLeft,
            isTimerRunning,
            isTimeout,
            isBuzzerOpen,
            lockedTeamId,
            ...newStateOverrides
        };
        broadcastChannelRef.current?.postMessage({ type: 'SYNC_STATE', payload });
    };

    useEffect(() => {
        (async () => {
            try {
                const dbConfig = await api.getLccConfig();
                if (dbConfig) {
                    setConfig(prev => ({ ...prev, ...dbConfig }));
                } else {
                    await api.saveLccConfig(DEFAULT_CONFIG);
                }

                const [dbTeams, usersData] = await Promise.all([
                    api.getLccTeams(),
                    api.getUsers()
                ]);
                const students = usersData ? usersData.filter((u: any) => u.role?.toLowerCase() === 'siswa') : [];

                if (dbTeams && dbTeams.length > 0) {
                    const synced = syncTeamsWithParticipants(dbTeams, students);
                    setTeams(synced);
                } else {
                    setTeams(DEFAULT_TEAMS);
                    await api.saveLccTeams(DEFAULT_TEAMS);
                }

                const dbQuestions = await api.getLccQuestions();
                if (dbQuestions && dbQuestions.length > 0) {
                    setQuestions(dbQuestions);
                }

                const dbHistory = await api.getLccHistory();
                if (dbHistory) setHistory(dbHistory);

                setIsInitialLoaded(true);
            } catch (e) {
                console.error("Failed to load LCC data from Supabase", e);
                setIsInitialLoaded(true);
            }
        })();
    }, []);

    // Sync config changes to Supabase and localStorage
    useEffect(() => {
        if (!isInitialLoaded) return;
        api.saveLccConfig(config);
        localStorage.setItem('lcc_scoreboard_config', JSON.stringify(config));
        syncStateToOtherTabs();
    }, [config, isInitialLoaded]);

    // Sync teams changes to Supabase and localStorage
    useEffect(() => {
        if (!isInitialLoaded) return;
        api.saveLccTeams(teams);
        localStorage.setItem('lcc_scoreboard_teams', JSON.stringify(teams));
        syncStateToOtherTabs();
    }, [teams, isInitialLoaded]);

    // Sync questions changes to Supabase and localStorage
    useEffect(() => {
        if (!isInitialLoaded) return;
        if (questions && questions.length > 0) {
            localStorage.setItem('lcc_questions', JSON.stringify(questions));
        } else {
            localStorage.removeItem('lcc_questions');
        }
        api.saveLccQuestions(questions);
        syncStateToOtherTabs();
    }, [questions, isInitialLoaded]);

    // Sync history changes to Supabase and localStorage
    useEffect(() => {
        if (!isInitialLoaded) return;
        if (history && history.length > 0) {
            localStorage.setItem('lcc_scoreboard_history', JSON.stringify(history));
        } else {
            localStorage.removeItem('lcc_scoreboard_history');
        }
        api.saveLccHistory(history);
        syncStateToOtherTabs();
    }, [history, isInitialLoaded]);

    // Silent background auto-refresh every 5 seconds & storage sync for multi-juri and projector real-time consistency
    useEffect(() => {
        if (!isInitialLoaded) return;
        const silentCheckAndRefresh = async () => {
            try {
                // 1. Sync via localStorage for instant local window/tab consistency
                const savedConfigStr = localStorage.getItem('lcc_scoreboard_config');
                const savedTeamsStr = localStorage.getItem('lcc_scoreboard_teams');
                const savedHistoryStr = localStorage.getItem('lcc_scoreboard_history');
                const savedQuestionsStr = localStorage.getItem('lcc_questions');

                if (savedConfigStr) {
                    const parsedConfig = JSON.parse(savedConfigStr);
                    setConfig(prev => JSON.stringify(prev) !== savedConfigStr ? { ...prev, ...parsedConfig } : prev);
                }
                if (savedTeamsStr) {
                    const parsedTeams = JSON.parse(savedTeamsStr);
                    setTeams(prev => JSON.stringify(prev) !== savedTeamsStr ? parsedTeams : prev);
                }
                if (savedHistoryStr) {
                    const parsedHistory = JSON.parse(savedHistoryStr);
                    setHistory(prev => JSON.stringify(prev) !== savedHistoryStr ? parsedHistory : prev);
                }
                if (savedQuestionsStr) {
                    const parsedQuestions = JSON.parse(savedQuestionsStr);
                    setQuestions(prev => JSON.stringify(prev) !== savedQuestionsStr ? parsedQuestions : prev);
                }

                // 2. Cross-device Database Synchronization (Supabase)
                // Fetch the latest LCC state to synchronize other active screens/judges
                const dbConfig = await api.getLccConfig();
                if (dbConfig) {
                    const dbConfigStr = JSON.stringify(dbConfig);
                    setConfig(prev => {
                        if (JSON.stringify(prev) !== dbConfigStr) {
                            return { ...prev, ...dbConfig };
                        }
                        return prev;
                    });
                }

                const [dbTeams, usersData] = await Promise.all([
                    api.getLccTeams(),
                    api.getUsers()
                ]);
                if (dbTeams && usersData) {
                    const students = usersData.filter((u: any) => u.role?.toLowerCase() === 'siswa');
                    const synced = syncTeamsWithParticipants(dbTeams, students);
                    const dbTeamsStr = JSON.stringify(synced);
                    setTeams(prev => {
                        if (JSON.stringify(prev) !== dbTeamsStr) {
                            return synced;
                        }
                        return prev;
                    });
                }

                const dbHistory = await api.getLccHistory();
                if (dbHistory) {
                    const dbHistoryStr = JSON.stringify(dbHistory);
                    setHistory(prev => {
                        if (JSON.stringify(prev) !== dbHistoryStr) {
                            return dbHistory;
                        }
                        return prev;
                    });
                }
            } catch (e) {
                console.error("Silent background database sync error", e);
            }
        };

        const interval = setInterval(silentCheckAndRefresh, 5000);

        const handleStorageEvent = (e: StorageEvent) => {
            if (e.key === 'lcc_scoreboard_config' && e.newValue) {
                try { setConfig(prev => ({ ...prev, ...JSON.parse(e.newValue!) })); } catch (err) {}
            }
            if (e.key === 'lcc_scoreboard_teams' && e.newValue) {
                try { setTeams(JSON.parse(e.newValue)); } catch (err) {}
            }
            if (e.key === 'lcc_scoreboard_history' && e.newValue) {
                try { setHistory(JSON.parse(e.newValue)); } catch (err) {}
            }
            if (e.key === 'lcc_questions' && e.newValue) {
                try { setQuestions(JSON.parse(e.newValue)); } catch (err) {}
            }
            if (e.key === 'lcc_buzzer_trigger' && e.newValue) {
                try {
                    const payload = JSON.parse(e.newValue);
                    if (payload.teamId) {
                        triggerBuzzer(payload.teamId);
                    }
                } catch (err) {}
            }
        };

        window.addEventListener('storage', handleStorageEvent);
        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorageEvent);
        };
    }, [isInitialLoaded]);

    // Live Clock
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setClockTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        };
        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, []);

    // Timer Interval
    useEffect(() => {
        let interval: any = null;
        if (isTimerRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        setIsTimerRunning(false);
                        setIsTimeout(true);
                        soundFx.playTimeout();
                        syncStateToOtherTabs({ timeLeft: 0, isTimerRunning: false, isTimeout: true });
                        return 0;
                    }
                    if (prev <= 5) {
                        soundFx.playTick();
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, timeLeft]);

    // Mute sound sync
    useEffect(() => {
        soundFx.setMute(isMuted);
    }, [isMuted]);

    // Highest score calculation
    const maxScore = displayedTeams.length > 0 ? Math.max(...displayedTeams.map(t => t.score)) : 0;
    const leadingTeamIds = maxScore > 0 
        ? displayedTeams.filter(t => t.score === maxScore).map(t => t.id) 
        : [];

    // SCORE OPERATIONS
    const updateScore = (teamId: string, delta: number, reason: string) => {
        setTeams(prevTeams => {
            const newTeams = prevTeams.map(t => {
                if (t.id === teamId) {
                    const newScore = t.score + delta;
                    const newCorrect = delta > 0 ? t.correctCount + 1 : t.correctCount;
                    const newWrong = delta < 0 ? t.wrongCount + 1 : t.wrongCount;
                    return { ...t, score: newScore, correctCount: newCorrect, wrongCount: newWrong };
                }
                return t;
            });
            return newTeams;
        });

        const targetTeam = teams.find(t => t.id === teamId);
        const teamName = targetTeam ? targetTeam.name : teamId;

        // Sound & Animation FX
        if (delta > 0) {
            soundFx.playCorrect();
            confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
            triggerFloatingAnim(teamId, `+${delta}`, 'plus');
        } else if (delta < 0) {
            soundFx.playWrong();
            triggerFloatingAnim(teamId, `${delta}`, 'minus');
            setShakingTeamId(teamId);
            setTimeout(() => setShakingTeamId(null), 600);
        }

        // Add to history
        const newLog: ScoreHistoryLog = {
            id: 'log_' + Date.now(),
            timestamp: new Date().toLocaleTimeString('id-ID'),
            teamId,
            teamName,
            delta,
            newScore: (targetTeam?.score || 0) + delta,
            reason: reason || (delta > 0 ? 'Penambahan Skor' : 'Pengurangan Skor'),
            category: config.statusSoal
        };
        setHistory(prev => [newLog, ...prev]);

        showToast(`${teamName}: ${delta > 0 ? '+' + delta : delta} point (${reason})`, delta > 0 ? 'success' : 'warning');
    };

    const triggerFloatingAnim = (teamId: string, text: string, type: 'plus' | 'minus') => {
        const animId = 'anim_' + Date.now() + Math.random();
        setFloatingAnims(prev => [...prev, { id: animId, teamId, text, type }]);
        setTimeout(() => {
            setFloatingAnims(prev => prev.filter(a => a.id !== animId));
        }, 1200);
    };

    // ACTIVE QUESTION FOR CURRENT NUMBER
    const currentActiveQuestion = questions.find(q => q.nomorSoal === config.nomorSoal);

    // CUSTOM SCORE APPLY HANDLER
    const handleApplyCustomScore = (teamId: string, isPositive: boolean) => {
        const rawVal = customScoreInputs[teamId] || '';
        const parsedVal = parseInt(rawVal);
        if (isNaN(parsedVal) || parsedVal === 0) {
            showToast('Masukkan jumlah poin yang valid (angka)!', 'warning');
            return;
        }
        const delta = isPositive ? Math.abs(parsedVal) : -Math.abs(parsedVal);
        updateScore(teamId, delta, `Custom Adjustment Soal ${config.nomorSoal}`);
        setCustomScoreInputs(prev => ({ ...prev, [teamId]: '' }));
    };

    // OPEN TEAM SELECTOR MODAL FROM PARTICIPANT LIST
    const openTeamSelector = async () => {
        try {
            showToast('Memuat daftar peserta dari database...', 'info');
            const [usersData, recapData] = await Promise.all([
                api.getUsers(),
                api.getRecap()
            ]);
            const students = usersData.filter(u => u.role?.toLowerCase() === 'siswa');
            if (students.length === 0) {
                showToast('Tidak ada data peserta (siswa) ditemukan!', 'warning');
                return;
            }

            const studentScores: Record<string, number> = {};
            recapData.forEach((r: any) => {
                const uname = r.user_id || r.username;
                const score = parseFloat(r.nilai) || 0;
                if (uname) {
                    if (!studentScores[uname] || score > studentScores[uname]) {
                        studentScores[uname] = score;
                    }
                }
            });

            const explicitRegus = students.filter(s => {
                const et = (s.exam_type || '').toUpperCase();
                const un = (s.username || '').toLowerCase();
                return et.includes('LCC') || et.includes('CERDAS') || un.startsWith('regu_') || un.startsWith('team_');
            });

            const generatedCandidates: LccTeam[] = [];
            const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
            let teamIndex = 0;

            if (explicitRegus.length > 0) {
                explicitRegus.forEach(regu => {
                    const score = studentScores[regu.username] || 0;
                    const schoolName = regu.school || regu.kelas_id || 'Sekolah';
                    
                    const rawFullName = (regu.fullname || regu.nama_lengkap || regu.username || '').trim();
                    const { reguTitle, members: extractedMembers } = parseTeamAndMembers(rawFullName);
                    
                    let cleanTeamName = reguTitle;
                    if (!cleanTeamName.toUpperCase().includes('REGU') && !cleanTeamName.toUpperCase().includes('TEAM')) {
                        cleanTeamName = `REGU ${cleanTeamName}`;
                    }

                    const finalMembers = extractedMembers.length > 0 
                        ? extractedMembers 
                        : (regu.members && Array.isArray(regu.members) && regu.members.length > 0 ? regu.members : [rawFullName]);

                    generatedCandidates.push({
                        id: `team_${regu.username}`,
                        name: cleanTeamName,
                        school: schoolName,
                        gugus: regu.gugus || regu.kelas_id || '',
                        score: Math.round(score),
                        color: colors[teamIndex % colors.length],
                        logo: regu.photo_url || '',
                        correctCount: 0,
                        wrongCount: 0,
                        members: finalMembers
                    });
                    teamIndex++;
                });
            } else {
                const schoolMap: Record<string, any[]> = {};
                students.forEach(s => {
                    const schoolName = s.school || s.kelas_id || 'Sekolah Umum';
                    if (!schoolMap[schoolName]) {
                        schoolMap[schoolName] = [];
                    }
                    schoolMap[schoolName].push({
                        ...s,
                        score: studentScores[s.username] || 0
                    });
                });

                Object.entries(schoolMap).forEach(([schoolName, schoolStudents]) => {
                    schoolStudents.sort((a, b) => b.score - a.score);
                    for (let i = 0; i < schoolStudents.length; i += 3) {
                        const batch = schoolStudents.slice(i, i + 3);
                        const reguLetter = String.fromCharCode(65 + Math.floor(i / 3));
                        const reguName = `REGU ${reguLetter} (${schoolName})`;
                        const teamId = `regu_${schoolName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${reguLetter}`;
                        
                        const totalScore = batch.reduce((sum, st) => sum + st.score, 0);
                        const memberNames = batch.map(st => st.nama_lengkap || st.fullname || st.username);

                        generatedCandidates.push({
                            id: teamId,
                            name: reguName,
                            school: schoolName,
                            gugus: batch[0].gugus || schoolName,
                            score: Math.round(totalScore),
                            color: colors[teamIndex % colors.length],
                            logo: '',
                            correctCount: 0,
                            wrongCount: 0,
                            members: memberNames
                        });
                        teamIndex++;
                    }
                });
            }

            setCandidateTeams(generatedCandidates);
            setSelectedCandidateIds(generatedCandidates.map(c => c.id));
            setIsTeamSelectorModalOpen(true);
        } catch (err: any) {
            showToast('Gagal memuat data peserta: ' + (err?.message || err), 'error');
        }
    };

    const handleImportSelectedTeams = () => {
        const chosen = candidateTeams.filter(c => selectedCandidateIds.includes(c.id));
        if (chosen.length === 0) {
            showToast('Pilih minimal 1 regu untuk ditarik ke scoreboard!', 'warning');
            return;
        }
        setTeams(chosen);
        setIsTeamSelectorModalOpen(false);
        showToast(`Berhasil menarik ${chosen.length} regu dari daftar peserta!`, 'success');
    };

    // SYNC TEAMS & SCORES FROM CBT EXAM RESULTS (Supports explicit Regu accounts or grouping 3 students per school)
    const syncTeamsFromCBT = async () => {
        try {
            showToast('Mengambil data peserta & hasil ujian CBT...', 'info');
            const [usersData, recapData] = await Promise.all([
                api.getUsers(),
                api.getRecap()
            ]);

            const students = usersData.filter(u => u.role?.toLowerCase() === 'siswa');
            if (students.length === 0) {
                showToast('Tidak ada data peserta ditemukan!', 'warning');
                return;
            }

            const studentScores: Record<string, number> = {};
            recapData.forEach((r: any) => {
                const uname = r.user_id || r.username;
                const score = parseFloat(r.nilai) || 0;
                if (uname) {
                    if (!studentScores[uname] || score > studentScores[uname]) {
                        studentScores[uname] = score;
                    }
                }
            });

            // Check if there are explicit LCC / Regu accounts (e.g. exam_type === 'LCC' or username starting with 'regu_' or 'team_')
            const explicitRegus = students.filter(s => {
                const et = (s.exam_type || '').toUpperCase();
                const un = (s.username || '').toLowerCase();
                return et.includes('LCC') || et.includes('CERDAS') || un.startsWith('regu_') || un.startsWith('team_');
            });

            const newTeams: LccTeam[] = [];
            const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
            let teamIndex = 0;

            if (explicitRegus.length > 0) {
                // Use explicit Regu accounts directly as teams
                explicitRegus.forEach(regu => {
                    const score = studentScores[regu.username] || 0;
                    const schoolName = regu.school || regu.kelas_id || 'Sekolah';
                    
                    const rawFullName = (regu.fullname || regu.nama_lengkap || regu.username || '').trim();
                    const { reguTitle, members: extractedMembers } = parseTeamAndMembers(rawFullName);
                    
                    let cleanTeamName = reguTitle;
                    if (!cleanTeamName.toUpperCase().includes('REGU') && !cleanTeamName.toUpperCase().includes('TEAM')) {
                        cleanTeamName = `REGU ${cleanTeamName}`;
                    }

                    const finalMembers = extractedMembers.length > 0 
                        ? extractedMembers 
                        : (regu.members && Array.isArray(regu.members) && regu.members.length > 0 ? regu.members : [rawFullName]);

                    newTeams.push({
                        id: `team_${regu.username}`,
                        name: cleanTeamName,
                        school: schoolName,
                        score: Math.round(score),
                        color: colors[teamIndex % colors.length],
                        logo: regu.photo_url || '',
                        correctCount: 0,
                        wrongCount: 0,
                        members: finalMembers
                    });
                    teamIndex++;
                });
            } else {
                // Fallback: Group regular students 3 by 3 per school
                const schoolMap: Record<string, any[]> = {};
                students.forEach(s => {
                    const schoolName = s.school || s.kelas_id || 'Sekolah Umum';
                    if (!schoolMap[schoolName]) {
                        schoolMap[schoolName] = [];
                    }
                    schoolMap[schoolName].push({
                        ...s,
                        score: studentScores[s.username] || 0
                    });
                });

                Object.entries(schoolMap).forEach(([schoolName, schoolStudents]) => {
                    schoolStudents.sort((a, b) => b.score - a.score);

                    for (let i = 0; i < schoolStudents.length; i += 3) {
                        const batch = schoolStudents.slice(i, i + 3);
                        const reguLetter = String.fromCharCode(65 + Math.floor(i / 3));
                        const reguName = `REGU ${reguLetter} (${schoolName})`;
                        const teamId = `regu_${schoolName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${reguLetter}`;
                        
                        const totalScore = batch.reduce((sum, st) => sum + st.score, 0);
                        const memberNames = batch.map(st => st.nama_lengkap || st.fullname || st.username);

                        newTeams.push({
                            id: teamId,
                            name: reguName,
                            school: schoolName,
                            score: Math.round(totalScore),
                            color: colors[teamIndex % colors.length],
                            logo: '',
                            correctCount: 0,
                            wrongCount: 0,
                            members: memberNames
                        });
                        teamIndex++;
                    }
                });
            }

            if (newTeams.length === 0) {
                showToast('Tidak ada regu yang dapat dibentuk dari data peserta.', 'warning');
                return;
            }

            setTeams(newTeams);
            showToast(`Berhasil menyinkronkan ${newTeams.length} Regu & Skor dari Hasil Ujian CBT!`, 'success');
        } catch (e) {
            console.error('Sync CBT error:', e);
            showToast('Gagal menyinkronkan regu dari hasil ujian CBT.', 'error');
        }
    };

    // EXCEL TEMPLATE DOWNLOAD FOR LCC QUESTIONS
    const downloadExcelTemplate = () => {
        const templateData = [
            {
                'Nomor Soal': 1,
                'Babak': 'Babak Penyisihan - Soal Wajib',
                'Pertanyaan / Soal': 'Apa nama ibu kota Provinsi Jawa Timur?',
                'Referensi Jawaban': 'Surabaya',
                'Poin': 100,
                'Kategori': 'Pengetahuan Umum'
            },
            {
                'Nomor Soal': 2,
                'Babak': 'Babak Penyisihan - Soal Wajib',
                'Pertanyaan / Soal': 'Siapakah pencipta lagu kebangsaan Indonesia Raya?',
                'Referensi Jawaban': 'Wage Rudolf Soepratman (W.R. Soepratman)',
                'Poin': 100,
                'Kategori': 'Pengetahuan Umum'
            },
            {
                'Nomor Soal': 3,
                'Babak': 'Babak Rebutan',
                'Pertanyaan / Soal': 'Berapakah hasil dari 25 x 4 + 150?',
                'Referensi Jawaban': '250',
                'Poin': 100,
                'Kategori': 'Matematika'
            }
        ];
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Soal LCC');
        XLSX.writeFile(workbook, 'Template_Soal_LCC.xlsx');
        showToast('Template Excel Soal LCC berhasil diunduh!', 'success');
    };

    // EXCEL IMPORT FOR QUESTIONS
    const importQuestionsFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsName = wb.SheetNames[0];
                const ws = wb.Sheets[wsName];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                if (!data || data.length === 0) {
                    showToast('File Excel kosong atau tidak terbaca!', 'error');
                    return;
                }

                const importedQuestions: LccQuestion[] = data.map((row, index) => {
                    const nomor = row['Nomor Soal'] || row['Nomor'] || row['No'] || (index + 1);
                    const babak = row['Babak'] || row['Babak / Kategori'] || config.namaBabak || 'Babak Penyisihan';
                    const soal = row['Pertanyaan / Soal'] || row['Pertanyaan'] || row['Soal'] || row['Teks Soal'] || '';
                    const jawaban = row['Referensi Jawaban'] || row['Kunci Jawaban'] || row['Jawaban'] || row['Referensi'] || '';
                    const poinVal = parseInt(String(row['Poin'] || row['Nilai'] || row['Poin Soal'] || '')) || config.nilaiWajib;
                    const kategori = row['Kategori'] || row['Mapel'] || 'Umum';

                    return {
                        id: 'q_' + Date.now() + '_' + index,
                        nomorSoal: parseInt(String(nomor)) || (index + 1),
                        babak: String(babak),
                        soal: String(soal),
                        referensiJawaban: String(jawaban),
                        poin: poinVal,
                        kategori: String(kategori)
                    };
                }).filter(q => q.soal.trim().length > 0);

                if (importedQuestions.length === 0) {
                    showToast('Tidak ada soal valid dalam file Excel! Pastikan kolom Pertanyaan / Soal terisi.', 'error');
                    return;
                }

                // Sort questions by nomorSoal
                importedQuestions.sort((a, b) => a.nomorSoal - b.nomorSoal);
                
                setQuestions(importedQuestions);
                const saveRes = await api.saveLccQuestions(importedQuestions);
                if (saveRes.success) {
                    showToast(`Berhasil mengimpor & menyimpan ${importedQuestions.length} soal ke database!`, 'success');
                } else {
                    showToast(`Soal diimpor (${importedQuestions.length} soal) namun gagal disimpan ke database.`, 'warning');
                }
            } catch (err) {
                console.error('Import error:', err);
                showToast('Gagal mengimpor file Excel. Pastikan format file sesuai.', 'error');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    // EXPORT QUESTIONS TO EXCEL
    const exportQuestionsToExcel = () => {
        if (questions.length === 0) {
            showToast('Belum ada soal untuk diexport!', 'warning');
            return;
        }
        const exportData = questions.map(q => ({
            'Nomor Soal': q.nomorSoal,
            'Babak': q.babak,
            'Kategori': q.kategori || '-',
            'Pertanyaan / Soal': q.soal,
            'Referensi Jawaban': q.referensiJawaban,
            'Poin': q.poin
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Soal LCC');
        XLSX.writeFile(workbook, `Bank_Soal_LCC_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Bank soal LCC berhasil diexport ke Excel!', 'success');
    };

    const handleSaveSingleLccQuestion = async (q: LccQuestion) => {
        setSavingLccId(q.id);
        try {
            const res = await api.saveLccQuestion(q);
            if (res.success) {
                showToast(`Soal ${q.nomorSoal} berhasil disimpan ke database!`, 'success');
            } else {
                const errorDetail = res.error?.message || res.error?.details || 'Database Error';
                showToast(`Gagal menyimpan soal ${q.nomorSoal}: ${errorDetail}`, 'error');
            }
        } catch (err: any) {
            showToast(`Gagal menyimpan: ${err.message || 'Koneksi error'}`, 'error');
        } finally {
            setSavingLccId(null);
        }
    };

    const updateQuestionForm = (updates: Partial<typeof questionForm>) => {
        setQuestionForm(prev => ({ ...prev, ...updates }));
        setIsFormSaved(false);
    };

    // SAVE SINGLE QUESTION
    const handleSaveQuestion = async (e: React.FormEvent) => {
        e.preventDefault();

        // If form is already saved, clicking the button triggers "Tambah Soal Baru"
        if (isFormSaved) {
            const maxNum = Math.max(0, ...questions.map(q => q.nomorSoal), questionForm.nomorSoal);
            setEditingQuestionId(null);
            setQuestionForm({
                nomorSoal: maxNum + 1,
                babak: config.namaBabak,
                soal: '',
                referensiJawaban: '',
                poin: config.nilaiWajib,
                kategori: 'Pengetahuan Umum'
            });
            setIsFormSaved(false);
            showToast('Form dibersihkan. Siap untuk input soal baru!', 'info');
            return;
        }

        if (!questionForm.soal.trim()) {
            showToast('Isi pertanyaan / soal terlebih dahulu!', 'warning');
            return;
        }

        if (editingQuestionId) {
            const updatedQ = {
                id: editingQuestionId,
                nomorSoal: questionForm.nomorSoal,
                babak: questionForm.babak,
                soal: questionForm.soal,
                referensiJawaban: questionForm.referensiJawaban,
                poin: questionForm.poin,
                kategori: questionForm.kategori
            };
            setQuestions(prev => prev.map(q => q.id === editingQuestionId ? updatedQ : q));
            try {
                const res = await api.saveLccQuestion(updatedQ);
                if (res.success) {
                    showToast(`Soal ${questionForm.nomorSoal} berhasil diperbarui di database!`, 'success');
                    setIsFormSaved(true);
                } else {
                    const errorDetail = res.error?.message || res.error?.details || 'Database Error/Permission denied';
                    showToast(`Gagal memperbarui soal di database: ${errorDetail}`, 'error');
                }
            } catch (err: any) {
                console.error("Gagal memperbarui soal di database", err);
                showToast(`Gagal menyimpan perubahan ke database: ${err.message || 'Koneksi error'}`, 'error');
            }
        } else {
            const newQ: LccQuestion = {
                id: 'q_' + Date.now(),
                nomorSoal: questionForm.nomorSoal,
                babak: questionForm.babak || config.namaBabak,
                soal: questionForm.soal,
                referensiJawaban: questionForm.referensiJawaban,
                poin: questionForm.poin,
                kategori: questionForm.kategori
            };
            setQuestions(prev => [...prev, newQ]);
            try {
                const res = await api.saveLccQuestion(newQ);
                if (res.success) {
                    showToast(`Soal ${questionForm.nomorSoal} berhasil disimpan ke database!`, 'success');
                    setIsFormSaved(true);
                } else {
                    const errorDetail = res.error?.message || res.error?.details || 'Database Error/Permission denied';
                    showToast(`Gagal menambahkan soal ke database: ${errorDetail}`, 'error');
                }
            } catch (err: any) {
                console.error("Gagal menambahkan soal ke database", err);
                showToast(`Gagal menyimpan soal baru ke database: ${err.message || 'Koneksi error'}`, 'error');
            }
        }
    };

    // EDIT QUESTION
    const startEditQuestion = (q: LccQuestion) => {
        setEditingQuestionId(q.id);
        setIsFormSaved(false);
        setQuestionForm({
            nomorSoal: q.nomorSoal,
            babak: q.babak,
            soal: q.soal,
            referensiJawaban: q.referensiJawaban,
            poin: q.poin,
            kategori: q.kategori || 'Pengetahuan Umum'
        });
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    // DELETE QUESTION
    const handleDeleteQuestion = (id: string) => {
        setDeleteConfirmQuestionId(id);
    };

    const confirmDeleteQuestion = async () => {
        if (!deleteConfirmQuestionId) return;
        const id = deleteConfirmQuestionId;
        setQuestions(prev => prev.filter(q => q.id !== id));
        try {
            const res = await api.deleteLccQuestion(id);
            if (res.success) {
                showToast('Soal berhasil dihapus', 'info');
            } else {
                const errorDetail = res.error?.message || res.error?.details || 'Database Error/Permission denied';
                showToast(`Gagal menghapus soal dari database: ${errorDetail}`, 'error');
            }
        } catch (err: any) {
            console.error("Gagal menghapus soal dari database", err);
            showToast(`Gagal menghapus soal dari database: ${err.message || 'Koneksi error'}`, 'error');
        }
        setDeleteConfirmQuestionId(null);
    };

    // CLEAR ALL QUESTIONS
    const handleClearAllQuestions = () => {
        setShowClearAllModal(true);
    };

    const confirmClearAllQuestions = async () => {
        setShowClearAllModal(false);
        const oldQuestions = [...questions];
        setQuestions([]);
        try {
            let failCount = 0;
            let lastError = '';
            for (const q of oldQuestions) {
                const res = await api.deleteLccQuestion(q.id);
                if (!res.success) {
                    failCount++;
                    lastError = res.error?.message || res.error?.details || 'Database error';
                }
            }
            if (failCount === 0) {
                showToast('Semua soal telah dihapus', 'warning');
            } else {
                showToast(`Gagal menghapus ${failCount} soal dari database! Detail: ${lastError}`, 'error');
            }
        } catch (err: any) {
            console.error("Gagal menghapus semua soal dari database", err);
            showToast(`Gagal menghapus beberapa soal dari database: ${err.message || 'Koneksi error'}`, 'error');
        }
    };

    const resetScoreTeam = (teamId: string) => {
        setResetScoreTeamId(teamId);
    };

    const confirmResetScoreTeam = () => {
        if (!resetScoreTeamId) return;
        const teamId = resetScoreTeamId;
        const targetTeam = teams.find(t => t.id === teamId);
        if (targetTeam) {
            setTeams(prev => prev.map(t => t.id === teamId ? { ...t, score: 0, correctCount: 0, wrongCount: 0 } : t));
            showToast(`Skor ${targetTeam.name} diriset ke 0`, 'info');
        }
        setResetScoreTeamId(null);
    };

    const confirmDeleteTeam = async () => {
        if (!deleteConfirmTeamId) return;
        const id = deleteConfirmTeamId;
        const targetTeam = teams.find(t => t.id === id);
        
        try {
            console.log("Deleting team ID:", id);
            const res = await api.deleteLccTeam(id);
            console.log("Delete LCC team result:", res);
            if (res.success) {
                setTeams(prev => prev.filter(t => t.id !== id));
                if (targetTeam) {
                    showToast(`Regu ${targetTeam.name} berhasil dihapus dari database!`, 'success');
                    // Delete the user account as well
                    const username = targetTeam.name.replace(/\s+/g, '').toLowerCase() + '_lcc';
                    console.log("Attempting to delete associated user account:", username);
                    api.deleteUser(username).then(userRes => {
                        console.log("Delete user account result:", userRes);
                    }).catch(err => {
                        console.error("Failed to delete associated user account:", err);
                    });
                }
            } else {
                console.error("Failed to delete LCC team:", res.error);
                const errorMessage = res.error?.message || 
                                     (typeof res.error === 'string' ? res.error : JSON.stringify(res.error) || "Database error");
                showToast(`Gagal menghapus regu dari database: ${errorMessage}`, 'error');
            }
        } catch (err: any) {
            console.error("Error deleting team:", err);
            showToast(`Gagal menghapus regu: ${err.message || 'Error'}`, 'error');
        }
        
        setDeleteConfirmTeamId(null);
    };

    const handleUndo = () => {
        if (history.length === 0) {
            showToast('Tidak ada riwayat untuk di-undo', 'info');
            return;
        }
        const lastLog = history[0];
        setTeams(prev => prev.map(t => {
            if (t.id === lastLog.teamId) {
                return { 
                    ...t, 
                    score: t.score - lastLog.delta,
                    correctCount: lastLog.delta > 0 ? Math.max(0, t.correctCount - 1) : t.correctCount,
                    wrongCount: lastLog.delta < 0 ? Math.max(0, t.wrongCount - 1) : t.wrongCount
                };
            }
            return t;
        }));
        setHistory(prev => prev.slice(1));
        showToast(`Undo: ${lastLog.teamName} (${lastLog.delta > 0 ? '-' : '+'}${Math.abs(lastLog.delta)})`, 'info');
    };

    const handleSaveAllSettings = async () => {
        setIsSavingSettings(true);
        try {
            const resConfig = await api.saveLccConfig(config);
            const resTeams = await api.saveLccTeams(teams);
            if (resConfig.success && resTeams.success) {
                showToast('Pengaturan & Daftar Regu berhasil disimpan ke database!', 'success');
            } else {
                const errorMsgs: string[] = [];
                if (!resConfig.success) {
                    errorMsgs.push(`Config: ${resConfig.error?.message || resConfig.error?.details || 'Database Error/Permission denied'}`);
                }
                if (!resTeams.success) {
                    errorMsgs.push(`Regu: ${resTeams.error?.message || resTeams.error?.details || 'Database Error/Permission denied'}`);
                }
                showToast(`Gagal menyimpan ke database! Detail: ${errorMsgs.join(' | ')}`, 'error');
            }
        } catch (error: any) {
            console.error("Error saving settings to database:", error);
            showToast(`Terjadi kesalahan saat menyimpan pengaturan: ${error.message || 'Koneksi error'}`, 'error');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleSaveAllQuestions = async () => {
        setIsSavingQuestions(true);
        try {
            const res = await api.saveLccQuestions(questions);
            if (res.success) {
                showToast('Semua Soal berhasil disimpan ke database!', 'success');
            } else {
                const errorDetail = res.error?.message || res.error?.details || 'Database Error/Permission denied';
                showToast(`Gagal menyimpan soal ke database! Detail: ${errorDetail}`, 'error');
            }
        } catch (error: any) {
            console.error("Error saving questions to database:", error);
            showToast(`Terjadi kesalahan saat menyimpan soal: ${error.message || 'Koneksi error'}`, 'error');
        } finally {
            setIsSavingQuestions(false);
        }
    };

    // TIMER CONTROLS
    const startTimer = () => {
        if (timeLeft <= 0) setTimeLeft(config.durasiTimer);
        setIsTimerRunning(true);
        setIsTimeout(false);
        syncStateToOtherTabs({ isTimerRunning: true, isTimeout: false });
    };

    const pauseTimer = () => {
        setIsTimerRunning(false);
        syncStateToOtherTabs({ isTimerRunning: false });
    };

    const resetTimer = () => {
        setIsTimerRunning(false);
        setTimeLeft(config.durasiTimer);
        setIsTimeout(false);
        syncStateToOtherTabs({ isTimerRunning: false, timeLeft: config.durasiTimer, isTimeout: false });
    };

    const adjustTime = (seconds: number) => {
        setTimeLeft(prev => Math.max(0, prev + seconds));
    };

    // BUZZER CONTROLS
    const openBuzzer = () => {
        setIsBuzzerOpen(true);
        setLockedTeamId(null);
        setLockedTime(null);
        showToast('BUZZER DIBUKA! Menunggu regu menekan buzzer...', 'info');
        syncStateToOtherTabs({ isBuzzerOpen: true, lockedTeamId: null });
    };

    const triggerBuzzer = (teamId: string) => {
        if (lockedTeamId === teamId) return;
        setLockedTeamId(teamId);
        setIsBuzzerOpen(false);
        const timeStr = new Date().toLocaleTimeString('id-ID') + '.' + new Date().getMilliseconds().toString().padStart(3, '0');
        setLockedTime(timeStr);
        soundFx.playBell();
        soundFx.playBuzzer();

        const team = teams.find(t => t.id === teamId);
        showToast(`🔔 BUZZER! ${team?.name} menekan bel paling cepat!`, 'success');
        syncStateToOtherTabs({ isBuzzerOpen: false, lockedTeamId: teamId });
    };

    // KEYBOARD SHORTCUTS
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input or textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
                return;
            }

            if (e.code === 'Space') {
                e.preventDefault();
                if (isTimerRunning) pauseTimer();
                else startTimer();
            } else if (e.key === 'r' || e.key === 'R') {
                resetTimer();
            } else if (e.key === 'b' || e.key === 'B') {
                openBuzzer();
            } else if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
                const idx = parseInt(e.key) - 1;
                if (teams[idx]) {
                    triggerBuzzer(teams[idx].id);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isTimerRunning, isBuzzerOpen, lockedTeamId, teams, history]);

    // EXPORT HANDLERS
    const exportExcel = () => {
        const data = teams.map((t, idx) => ({
            'Peringkat': idx + 1,
            'Nama Regu': t.name,
            'Asal Sekolah': t.school,
            'Total Skor': t.score,
            'Jumlah Benar': t.correctCount,
            'Jumlah Salah': t.wrongCount
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Hasil Skor LCC');

        // History Sheet
        const historyData = history.map(h => ({
            'Waktu': h.timestamp,
            'Regu': h.teamName,
            'Perubahan': h.delta > 0 ? `+${h.delta}` : `${h.delta}`,
            'Skor Akhir': h.newScore,
            'Kategori': h.category || '-',
            'Keterangan': h.reason
        }));
        const wsHist = XLSX.utils.json_to_sheet(historyData);
        XLSX.utils.book_append_sheet(wb, wsHist, 'Riwayat Skor');

        XLSX.writeFile(wb, `Hasil_Skor_LCC_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Berhasil mengeksport data ke Excel', 'success');
    };

    const backupDataJSON = () => {
        const data = { config, teams, history };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_lcc_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        showToast('Berhasil mengunduh file backup JSON', 'success');
    };

    const restoreDataJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (parsed.config) setConfig(parsed.config);
                if (parsed.teams) setTeams(parsed.teams);
                if (parsed.history) setHistory(parsed.history);
                showToast('Data berhasil direstore dari backup', 'success');
            } catch (err) {
                showToast('Format file backup JSON tidak valid', 'error');
            }
        };
        reader.readAsText(file);
    };

    const resetAllData = () => {
        setShowResetAllDataModal(true);
    };

    const confirmResetAllData = () => {
        setShowResetAllDataModal(false);
        setTeams(DEFAULT_TEAMS);
        setConfig(DEFAULT_CONFIG);
        setHistory([]);
        setTimeLeft(DEFAULT_CONFIG.durasiTimer);
        setIsTimerRunning(false);
        setIsTimeout(false);
        setLockedTeamId(null);
        showToast('Seluruh data LCC telah diriset ke awal', 'info');
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen().catch(err => console.error(err));
        }
    };

    // Render Fullscreen Presentation Scoreboard View
    if (viewMode === 'scoreboard') {
        const isQuestionActiveOnProjector = !!(config.tampilkanSoalKeProjector && currentActiveQuestion);
        return createPortal(
            <div className={`fixed inset-0 z-[99999] bg-slate-950 text-white font-sans overflow-x-hidden ${isQuestionActiveOnProjector ? 'overflow-hidden' : 'overflow-y-auto'} flex flex-col justify-between select-none w-screen h-screen min-h-screen`}>
                {/* Animated Background Gradient FX */}
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-indigo-950/50 to-slate-950 pointer-events-none"></div>
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

                {/* TOP HEADER */}
                <header className="relative z-10 px-6 md:px-8 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md shadow-lg shrink-0">
                    {/* Left: Logo & Title */}
                    <div className="flex items-center gap-4 md:gap-5">
                        {config.logoUrl && (
                            <img src={config.logoUrl} alt="Logo" className="h-10 md:h-14 w-auto object-contain bg-white/10 p-1.5 rounded-xl border border-white/20 shadow-md" />
                        )}
                        <div>
                            <h1 className="text-lg md:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 drop-shadow-sm uppercase">
                                SMART SCOREBOARD
                            </h1>
                            <p className="text-[11px] md:text-sm font-semibold text-slate-300 tracking-wide uppercase">
                                {config.namaLomba}
                            </p>
                        </div>
                    </div>

                    {/* Center: Status & Babak Soal */}
                    <div className="hidden md:flex flex-col items-center">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-widest">
                                {config.namaBabak}
                            </span>
                            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-widest">
                                Soal {config.nomorSoal}
                            </span>
                        </div>
                        <div className={`text-xs font-black uppercase tracking-widest px-4 py-1 rounded-full border ${
                            config.statusSoal === 'Wajib' ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' :
                            config.statusSoal === 'Lempar' ? 'bg-purple-600/20 text-purple-300 border-purple-500/40' :
                            'bg-rose-600/20 text-rose-300 border-rose-500/40 animate-pulse'
                        }`}>
                            Status: Soal {config.statusSoal}
                        </div>
                    </div>

                    {/* Right: Digital Clock & Exit Button */}
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="text-right mr-1">
                            <div className="font-mono font-black text-lg md:text-2xl text-amber-400 tracking-widest drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                                {clockTime}
                            </div>
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">WIB</span>
                        </div>

                        <button 
                            onClick={toggleFullscreen}
                            className="p-2 md:p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition shadow-md flex items-center gap-1 text-xs font-bold"
                            title="Layar Penuh (Fullscreen F11)"
                        >
                            <Maximize size={18}/>
                        </button>

                        <button 
                            onClick={handleExitScoreboard}
                            className="px-3 py-2 md:px-3.5 md:py-2.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl border border-rose-500/60 transition shadow-md flex items-center gap-1.5 text-xs font-extrabold active:scale-95"
                            title="Keluar Tampilan Scoreboard"
                        >
                            <LogOut size={16}/> Keluar
                        </button>
                    </div>
                </header>

                {/* MAIN CONTENT CENTER */}
                <main className={`relative z-10 flex-1 px-6 md:px-10 flex flex-col justify-center max-w-7xl mx-auto w-full my-auto ${isQuestionActiveOnProjector ? 'py-2 gap-2' : 'py-4 md:py-6 gap-4'}`}>
                    {/* PROJECTOR QUESTION DISPLAY (IF ENABLED) */}
                    {isQuestionActiveOnProjector && currentActiveQuestion && (
                        <div className="w-full max-w-4xl mx-auto mb-2 p-3 md:p-4 bg-slate-900/90 border border-indigo-500/50 rounded-2xl backdrop-blur-md shadow-[0_0_30px_rgba(99,102,241,0.25)] text-center animate-fadeIn shrink-0">
                            <div className="flex items-center justify-center gap-2 mb-1.5">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-black bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 uppercase tracking-widest">
                                    {currentActiveQuestion.babak || config.namaBabak}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-black bg-amber-500/30 text-amber-200 border border-amber-500/40 uppercase tracking-widest">
                                    SOAL {currentActiveQuestion.nomorSoal}
                                </span>
                                {currentActiveQuestion.kategori && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-black bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-widest">
                                        {currentActiveQuestion.kategori}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm md:text-xl lg:text-2xl font-extrabold text-white leading-relaxed drop-shadow-sm">
                                "{currentActiveQuestion.soal}"
                            </p>
                        </div>
                    )}

                    {/* TIMER & BUZZER ALERT BAR */}
                    <div className={`flex flex-col items-center justify-center shrink-0 ${isQuestionActiveOnProjector ? 'mb-2' : 'mb-4 md:mb-6'}`}>
                        {/* BIG TIMER DISPLAY */}
                        <div className="relative flex items-center justify-center">
                            <div className={`transition-all flex items-center gap-3 md:gap-4 ${
                                isQuestionActiveOnProjector 
                                    ? 'px-6 py-1.5 rounded-xl border-2 backdrop-blur-xl' 
                                    : 'px-8 md:px-12 py-2 md:py-3 rounded-2xl border-2 backdrop-blur-xl'
                            } ${
                                isTimeout 
                                    ? 'bg-rose-950/80 border-rose-500 text-rose-400 shadow-[0_0_50px_rgba(244,63,94,0.6)] animate-bounce' 
                                    : isTimerRunning 
                                    ? 'bg-slate-900/80 border-indigo-500/60 text-white shadow-[0_0_30px_rgba(99,102,241,0.3)]' 
                                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                            }`}>
                                <Clock size={isQuestionActiveOnProjector ? 24 : 32} className={isTimerRunning ? "animate-spin text-indigo-400" : isTimeout ? "text-rose-500" : "text-slate-500"} />
                                <div className={`font-mono font-black tracking-widest drop-shadow-md ${isQuestionActiveOnProjector ? 'text-2xl md:text-4xl' : 'text-4xl md:text-6xl'}`}>
                                    {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </div>
                            </div>
                        </div>

                        {/* BUZZER STATUS ALERT */}
                        {isBuzzerOpen && (
                            <div className="mt-1.5 px-5 py-1 bg-emerald-500/20 border border-emerald-500/50 rounded-full text-emerald-300 font-extrabold text-[10px] md:text-xs uppercase tracking-widest animate-pulse flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                <Radio size={14} className="animate-ping"/> BUZZER TERBUKA! TEKAN BUZZER SEKARANG!
                            </div>
                        )}

                        {lockedTeamId && (
                            <div className="mt-1.5 px-5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs md:text-base rounded-full shadow-[0_0_30px_rgba(245,158,11,0.6)] animate-bounce flex items-center gap-2 border-2 border-yellow-200">
                                <Zap size={16} className="fill-current text-yellow-200"/> 
                                {teams.find(t => t.id === lockedTeamId)?.name} MENEKAN BUZZER TERCEPAT!
                            </div>
                        )}
                    </div>

                    {/* TEAM CARDS CONTAINER (2 to 5 columns responsive) */}
                    <div className={`grid gap-3 md:gap-4 items-stretch my-auto w-full ${
                        displayedTeams.length === 2 ? 'grid-cols-2 max-w-4xl mx-auto' :
                        displayedTeams.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
                        displayedTeams.length === 4 ? 'grid-cols-2 md:grid-cols-4' :
                        'grid-cols-2 md:grid-cols-5'
                    }`}>
                        {displayedTeams.map((team) => {
                            const isLeading = leadingTeamIds.includes(team.id);
                            const isLocked = lockedTeamId === team.id;
                            const anims = floatingAnims.filter(a => a.teamId === team.id);

                            return (
                                <div 
                                    key={team.id}
                                    style={{ borderColor: team.color }}
                                    className={`relative flex flex-col justify-between transition-all duration-300 border-2 backdrop-blur-xl ${
                                        isQuestionActiveOnProjector ? 'rounded-2xl p-3 md:p-4' : 'rounded-3xl p-4 md:p-6'
                                    } ${
                                        shakingTeamId === team.id ? 'animate-shake' : ''
                                    } ${
                                        isLocked
                                            ? 'bg-gradient-to-b from-amber-500/40 via-orange-600/50 to-slate-900 border-4 border-amber-400 ring-8 ring-amber-400/50 shadow-[0_0_90px_rgba(251,191,36,1)] scale-[1.04] z-30 animate-pulse'
                                            : isLeading 
                                            ? 'bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-900/90 shadow-[0_0_40px_rgba(251,191,36,0.35)] border-amber-400 scale-[1.02] md:scale-[1.03] z-20' 
                                            : 'bg-slate-900/60 border-slate-800 shadow-xl'
                                    }`}
                                >
                                    {/* FLOATING SCORE ANIMATION */}
                                    {anims.map(a => (
                                        <div 
                                            key={a.id}
                                            className={`absolute -top-10 left-1/2 -translate-x-1/2 font-black text-3xl md:text-4xl animate-float-up pointer-events-none drop-shadow-lg ${
                                                a.type === 'plus' ? 'text-emerald-400' : 'text-rose-500'
                                            }`}
                                        >
                                            {a.text}
                                        </div>
                                    ))}

                                    {/* BUZZER LOCK BLINKING BADGE */}
                                    {isLocked && (
                                        <div className={`absolute left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 rounded-full font-black tracking-wider flex items-center gap-1.5 shadow-[0_0_30px_rgba(251,191,36,1)] border-2 border-white uppercase animate-bounce z-40 ${
                                            isQuestionActiveOnProjector ? '-top-3 px-3 py-0.5 text-[9px]' : '-top-5 px-4 py-1.5 text-xs'
                                        }`}>
                                            <Zap size={isQuestionActiveOnProjector ? 11 : 15} className="fill-current text-slate-950 animate-pulse"/> 🔔 BUZZER TERCEPAT!
                                        </div>
                                    )}

                                    {/* HIGHEST SCORE / LEADER CROWN BADGE */}
                                    {isLeading && (
                                        <div className={`absolute left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 rounded-full font-black tracking-wider flex items-center gap-1.5 shadow-lg border border-yellow-200 uppercase animate-pulse ${
                                            isQuestionActiveOnProjector ? '-top-3 px-3 py-0.5 text-[9px]' : '-top-5 px-4 py-1 text-xs'
                                        }`}>
                                            <Trophy size={isQuestionActiveOnProjector ? 10 : 14} className="fill-current text-slate-950"/> SKOR HIGHEST
                                        </div>
                                    )}

                                    {/* CARD HEADER */}
                                    <div className="text-center pt-2 flex flex-col items-center">
                                        <div className={`mx-auto mb-2 rounded-2xl bg-white/10 p-2 border border-white/20 flex items-center justify-center overflow-hidden shadow-inner ${
                                            isQuestionActiveOnProjector ? 'w-10 h-10' : 'w-14 h-14 md:w-16 md:h-16'
                                        }`}>
                                            {team.logo ? (
                                                <img src={team.logo} alt={team.name} className="w-full h-full object-contain" />
                                            ) : (
                                                <Users size={isQuestionActiveOnProjector ? 20 : 32} style={{ color: team.color }} />
                                            )}
                                        </div>
                                        
                                        <TeamMemberBadge 
                                            rawName={team.name} 
                                            members={team.members} 
                                            theme="dark" 
                                            size={isQuestionActiveOnProjector ? "sm" : "md"} 
                                            align="center"
                                            customColor={team.color}
                                        />

                                        <p className="text-[10px] font-semibold text-slate-400 truncate mt-1">
                                            {getTeamSchoolOnly(team) || '-'} {getTeamGugus(team) ? `(${getTeamGugus(team)})` : ''}
                                        </p>
                                    </div>

                                    {/* DIGITAL SCORE DISPLAY */}
                                    <div className={`text-center ${isQuestionActiveOnProjector ? 'my-2' : 'my-4 md:my-6'}`}>
                                        <div className={`inline-block bg-slate-950/80 rounded-2xl border border-slate-800 shadow-inner w-full ${
                                            isQuestionActiveOnProjector ? 'px-3 py-1.5' : 'px-4 md:px-6 py-3 md:py-4'
                                        }`}>
                                            <span className={`font-mono font-black tracking-wider leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] ${
                                                isQuestionActiveOnProjector ? 'text-3xl md:text-4xl lg:text-5xl' : 'text-4xl md:text-6xl lg:text-7xl'
                                            } ${
                                                team.score < 0 ? 'text-rose-500' : 'text-white'
                                            }`}>
                                                {team.score}
                                            </span>
                                        </div>
                                    </div>

                                    {/* STATS FOOTER */}
                                    <div className="flex justify-around items-center pt-2 border-t border-slate-800/80 text-[10px] md:text-xs font-bold text-slate-400">
                                        <div className="flex items-center gap-1 text-emerald-400">
                                            <CheckCircle2 size={isQuestionActiveOnProjector ? 12 : 14}/> {team.correctCount}
                                        </div>
                                        <div className="flex items-center gap-1 text-rose-400">
                                            <XCircle size={isQuestionActiveOnProjector ? 12 : 14}/> {team.wrongCount}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>

                {/* RUNNING TEXT FOOTER */}
                <footer className="relative z-10 bg-slate-900/90 border-t border-slate-800/80 py-2.5 px-6 flex items-center overflow-hidden shrink-0">
                    <div className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-lg uppercase shrink-0 mr-4 tracking-wider flex items-center gap-1 shadow-sm">
                        <Sparkles size={14}/> INFO
                    </div>
                    <div className="overflow-hidden whitespace-nowrap w-full">
                        <div className="inline-block animate-marquee font-bold text-sm text-slate-300 tracking-wide">
                            {config.runningText}
                        </div>
                    </div>
                </footer>
            </div>,
            document.body
        );
    }

    // OPERATOR CONTROL PANEL VIEW
    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-16">
            {/* TOP BAR */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-black shadow-md">
                            <Trophy size={20}/>
                        </div>
                        <div>
                            <h1 className="font-black text-lg text-slate-800 leading-tight">
                                {isJuri ? 'PANEL JURI SMART SCOREBOARD' : 'PANEL OPERATOR SMART SCOREBOARD'}
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                {isJuri ? `Mode Juri LCC (${currentUser?.nama_lengkap || 'Juri'}) — Sync 5s Active` : 'Lomba Cerdas Cermat Control Center'}
                            </p>
                        </div>
                    </div>

                    {/* TOP CONTROLS & NAVIGATION TABS */}
                    <div className="flex flex-wrap items-center gap-2">
                        {!isJuri ? (
                            <>
                                <button 
                                    onClick={openProjectorWindow}
                                    className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-black text-xs shadow-md shadow-amber-200 flex items-center gap-1.5 transition active:scale-95"
                                    title="Buka Scoreboard di Jendela Baru untuk ditarik ke LCD Proyektor"
                                >
                                    <ExternalLink size={16}/> Buka di Window Baru (Proyektor)
                                </button>

                                <button 
                                    onClick={() => setViewMode('scoreboard')}
                                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-slate-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                                    title="Pratinjau Layar Scoreboard di Tab Saat Ini"
                                >
                                    <Monitor size={16}/> Preview Scoreboard
                                </button>

                                <button 
                                    onClick={() => setShowProjectorGuideModal(true)}
                                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                                    title="Panduan Koneksi LCD Proyektor & Dual Monitor"
                                >
                                    <Tv size={16}/> Panduan Proyektor
                                </button>

                                <button 
                                    onClick={copyProjectorUrl}
                                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
                                    title="Salin Direct Link Proyektor"
                                >
                                    <Copy size={18}/>
                                </button>
                            </>
                        ) : (
                            <span className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs">
                                <Users size={14} className="text-amber-600"/> Akun Juri (Sinkronisasi Otomatis Active)
                            </span>
                        )}

                        <button 
                            onClick={toggleFullscreen}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
                            title="Fullscreen Mode"
                        >
                            <Maximize size={18}/>
                        </button>
                        <button 
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-2 rounded-xl transition ${isMuted ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            title={isMuted ? "Suara Dimatikan" : "Suara Aktif"}
                        >
                            {isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
                        </button>
                        <button 
                            onClick={() => setShowShortcutsModal(true)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
                            title="Petunjuk Shortcut Keyboard"
                        >
                            <HelpCircle size={18}/>
                        </button>
                    </div>
                </div>

                {/* OPERATOR TABS */}
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-stretch md:items-center justify-between border-t border-slate-100 gap-2">
                    <div className="flex gap-2 overflow-x-auto py-1 md:py-0">
                        {[
                            { id: 'control', label: 'Panel Kontrol Utama', icon: Trophy },
                            { id: 'soal', label: 'Bank Soal & Referensi Jawaban', icon: BookOpen },
                            { id: 'settings', label: 'Pengaturan Lomba & Nilai', icon: Settings },
                            { id: 'history', label: 'Riwayat Skor Log', icon: History },
                            { id: 'export', label: 'Export & Backup', icon: Download },
                        ]
                        .filter(tab => !isOperatorLimited || (tab.id === 'control' || tab.id === 'history'))
                        .map(tab => {
                            const Icon = tab.icon;
                            const active = activeTabOperator === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTabOperator(tab.id as any)}
                                    className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
                                        active 
                                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <Icon size={16}/> {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Gugus / Cluster Filter Dropdown */}
                    <div className="py-2 md:py-0 flex items-center justify-between md:justify-end gap-2 border-t md:border-t-0 border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                            <Users size={12} className="text-indigo-500"/> FILTER AKTIF GUGUS:
                        </label>
                        <select
                            value={activeGugus}
                            onChange={(e) => {
                                const val = e.target.value;
                                setConfig(prev => ({ ...prev, activeGugus: val }));
                            }}
                            className="p-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[150px] transition"
                        >
                            <option value="all">Semua Gugus ({teams.length} Regu)</option>
                            {availableGugus.map(gug => (
                                <option key={gug} value={gug}>
                                    {gug} ({teams.filter(t => getTeamGugus(t).toLowerCase() === gug.toLowerCase()).length} Regu)
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="max-w-7xl mx-auto px-4 pt-6 space-y-6">

                {/* ==================== TAB 1: KONTROL UTAMA ==================== */}
                {activeTabOperator === 'control' && (
                    <div className="space-y-6">

                        {/* JURI & OPERATOR FEATURE: WIDGET SOAL & REFERENSI JAWABAN */}
                        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/40 text-white p-5 rounded-2xl shadow-md space-y-4 relative overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-800/60 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
                                        <BookOpen size={20}/>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-sm text-amber-400">
                                                SOAL {config.nomorSoal}
                                            </span>
                                            {currentActiveQuestion && (
                                                <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold rounded-full uppercase">
                                                    {currentActiveQuestion.babak || config.namaBabak}
                                                </span>
                                            )}
                                            {currentActiveQuestion?.kategori && (
                                                <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold rounded-full uppercase">
                                                    {currentActiveQuestion.kategori}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-300">Tampilan Soal & Referensi Jawaban (Khusus Akun Juri / Operator)</p>
                                    </div>
                                </div>

                                {/* Question Selector Dropdown & Nav Buttons */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={() => {
                                            const prevNum = Math.max(1, config.nomorSoal - 1);
                                            setConfig(prev => ({ ...prev, nomorSoal: prevNum }));
                                            setIsQuestionCardOpen(true);
                                        }}
                                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition"
                                        title="Soal Sebelumnya"
                                    >
                                        <ChevronLeft size={16}/>
                                    </button>

                                    <button
                                        onClick={() => {
                                            const nextNum = config.nomorSoal + 1;
                                            setConfig(prev => ({ ...prev, nomorSoal: nextNum }));
                                            setIsQuestionCardOpen(true);
                                        }}
                                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1 shadow-sm"
                                        title="Lanjut Soal Berikutnya"
                                    >
                                        Lanjut Soal <ChevronRight size={16}/>
                                    </button>

                                    <button
                                        onClick={() => setIsQuestionCardOpen(!isQuestionCardOpen)}
                                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
                                        title={isQuestionCardOpen ? "Tutup Tampilan Soal" : "Buka Tampilan Soal"}
                                    >
                                        {isQuestionCardOpen ? <X size={16}/> : <BookOpen size={16}/>}
                                    </button>
                                </div>
                            </div>

                            {isQuestionCardOpen && (
                                currentActiveQuestion ? (
                                    <div className="space-y-4 pt-1">
                                        {/* SOAL PERTANYAAN */}
                                        <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Teks Pertanyaan / Soal:</span>
                                            <p className="text-base md:text-lg font-bold text-white leading-relaxed">
                                                {currentActiveQuestion.soal}
                                            </p>
                                        </div>

                                        {/* REFERENSI JAWABAN (KUNCI JAWABAN) */}
                                        <div className="p-4 bg-emerald-950/70 border border-emerald-500/50 rounded-xl space-y-2 relative">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                                                    <CheckCircle2 size={14} className="text-emerald-400"/> REFERENSI / KUNCI JAWABAN JURI:
                                                </span>
                                                <button
                                                    onClick={() => setShowAnswerJuri(!showAnswerJuri)}
                                                    className="text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1 underline"
                                                >
                                                    {showAnswerJuri ? <EyeOff size={14}/> : <Eye size={14}/>}
                                                    {showAnswerJuri ? 'Sembunyikan' : 'Tampilkan Kunci'}
                                                </button>
                                            </div>

                                            {showAnswerJuri ? (
                                                <p className="text-sm md:text-base font-extrabold text-emerald-200 leading-normal">
                                                    {currentActiveQuestion.referensiJawaban}
                                                </p>
                                            ) : (
                                                <p className="text-xs font-bold text-slate-500 italic">
                                                    [ Kunci jawaban disembunyikan. Klik "Tampilkan Kunci" untuk melihat. ]
                                                </p>
                                            )}
                                        </div>

                                        {/* DIRECT QUICK SCORE BUTTONS FOR REGU */}
                                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-slate-300">Pemberian Skor Langsung Soal {config.nomorSoal}:</span>
                                            <div className="flex gap-2 flex-wrap">
                                                {displayedTeams.map(t => (
                                                    <div key={t.id} className="flex items-center gap-1 bg-slate-800 p-1 px-2.5 rounded-lg border border-slate-700">
                                                        <span className="text-xs font-bold mr-1" style={{ color: t.color }}>{getTeamNameOnly(t)}:</span>
                                                        <button
                                                            onClick={() => updateScore(t.id, currentActiveQuestion.poin || config.nilaiWajib, `Jawaban Benar Soal ${config.nomorSoal}`)}
                                                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded transition flex items-center gap-1"
                                                        >
                                                            <Check size={12}/> +{currentActiveQuestion.poin || config.nilaiWajib}
                                                        </button>
                                                        <button
                                                            onClick={() => updateScore(t.id, -config.penguranganSalah, `Jawaban Salah Soal ${config.nomorSoal}`)}
                                                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] rounded transition flex items-center gap-1"
                                                        >
                                                            <X size={12}/> -{config.penguranganSalah}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-900/60 rounded-xl text-center text-slate-400 text-xs font-medium space-y-2">
                                        <p>Belum ada pertanyaan tersimpan di Bank Soal untuk Soal {config.nomorSoal}.</p>
                                        {!isOperatorLimited && (
                                            <button
                                                onClick={() => setActiveTabOperator('soal')}
                                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-1 shadow-sm"
                                            >
                                                <Plus size={14}/> Input atau Impor Soal di Menu Bank Soal
                                            </button>
                                        )}
                                    </div>
                                )
                            )}
                        </div>

                        {/* QUICK DUAL DISPLAY BANNER */}
                        {!isJuri && (
                            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 border border-amber-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                                        <Tv size={20}/>
                                    </div>
                                    <div>
                                        <h4 className="font-black text-xs text-slate-800 uppercase tracking-wide">Mode Tampilan LCD Proyektor (Dual Monitor)</h4>
                                        <p className="text-[11px] text-slate-600 font-medium">Buka Scoreboard di jendela terpisah untuk ditarik ke proyektor. Kontrol tetap dari laptop Anda.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={openProjectorWindow} className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl transition shadow-sm flex items-center gap-1.5 active:scale-95">
                                        <ExternalLink size={14}/> Buka Window Proyektor
                                    </button>
                                    <button onClick={() => setShowProjectorGuideModal(true)} className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition">
                                        Petunjuk Lengkap
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* LEFT COLUMN: TIMER & BUZZER CONTROL */}
                        <div className="space-y-6">

                            {/* PANEL B: TIMER */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                        <Clock size={18} className="text-indigo-600"/> PANEL TIMER
                                    </h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                        isTimeout ? 'bg-rose-100 text-rose-600' : isTimerRunning ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {isTimeout ? 'WAKTU HABIS' : isTimerRunning ? 'BERJALAN' : 'BERHENTI'}
                                    </span>
                                </div>

                                {/* TIMER DISPLAY */}
                                <div className={`text-center py-6 rounded-2xl border-2 transition-all ${
                                    isTimeout 
                                        ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse' 
                                        : 'bg-slate-900 border-slate-800 text-amber-400'
                                }`}>
                                    <div className="font-mono text-5xl font-black tracking-widest">
                                        {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                                    </div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Durasi Soal</p>
                                </div>

                                {/* TIMER CONTROLS */}
                                <div className="grid grid-cols-3 gap-2">
                                    {!isTimerRunning ? (
                                        <button onClick={startTimer} className="col-span-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-100 flex items-center justify-center gap-2">
                                            <Play size={16}/> START (Space)
                                        </button>
                                    ) : (
                                        <button onClick={pauseTimer} className="col-span-2 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition shadow-md shadow-amber-100 flex items-center justify-center gap-2">
                                            <Pause size={16}/> PAUSE (Space)
                                        </button>
                                    )}
                                    <button onClick={resetTimer} className="py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1">
                                        <RotateCcw size={16}/> RESET (R)
                                    </button>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => adjustTime(10)} className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition">+10s</button>
                                    <button onClick={() => adjustTime(-10)} className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition">-10s</button>
                                </div>
                            </div>

                            {/* PANEL E: BABAK REBUTAN (BUZZER) */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                        <Radio size={18} className="text-rose-600"/> BABAK REBUTAN (BUZZER)
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-400">Tekan B</span>
                                </div>

                                <button 
                                    onClick={openBuzzer}
                                    className={`w-full py-3.5 rounded-xl font-extrabold text-sm transition shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider ${
                                        isBuzzerOpen 
                                            ? 'bg-amber-500 text-white animate-pulse shadow-amber-200' 
                                            : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                                    }`}
                                >
                                    <Zap size={18}/> {isBuzzerOpen ? 'BUZZER OPEN! (MENUNGGU)' : 'BUKA BUZZER REBUTAN'}
                                </button>

                                {/* LOCKED TEAM DISPLAY */}
                                {lockedTeamId ? (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-3">
                                        <span className="text-[10px] font-extrabold uppercase text-amber-700 block tracking-wider">REGU TERCEPAT (BUZZER)</span>
                                        <div className="font-black text-xl text-amber-900">
                                            {teams.find(t => t.id === lockedTeamId)?.name}
                                        </div>
                                        <p className="text-[10px] text-amber-600 font-mono">Waktu: {lockedTime}</p>

                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                            <button 
                                                onClick={() => {
                                                    updateScore(lockedTeamId, config.nilaiRebutan, `Soal Rebutan #${config.nomorSoal}`);
                                                    setLockedTeamId(null);
                                                }}
                                                className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1"
                                            >
                                                <CheckCircle2 size={16}/> ✔ Benar (+{config.nilaiRebutan})
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    updateScore(lockedTeamId, -config.penguranganSalah, `Salah Rebutan #${config.nomorSoal}`);
                                                    setLockedTeamId(null);
                                                    openBuzzer(); // Auto unlock for other teams
                                                }}
                                                className="py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1"
                                            >
                                                <XCircle size={16}/> ✖ Salah (-{config.penguranganSalah})
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs font-medium italic">
                                        Tekan tombol "Buka Buzzer" untuk memulai rebutan.
                                    </div>
                                )}

                                {/* VIRTUAL BUZZER TEST BUTTONS */}
                                <div className="border-t border-slate-100 pt-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Simulasi Tekan Buzzer (Operator/Keyboard 1-5):</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {displayedTeams.map((t, idx) => (
                                            <button
                                                key={t.id}
                                                onClick={() => triggerBuzzer(t.id)}
                                                disabled={!isBuzzerOpen || !!lockedTeamId}
                                                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition"
                                            >
                                                {t.name} ({idx + 1})
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* PANEL D: BABAK LEMPAR TANGKAP */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <ArrowRight size={18} className="text-purple-600"/> BABAK LEMPAR TANGKAP
                                </h3>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">1. Regu yang gagal menjawab:</label>
                                        <select 
                                            value={failingTeamId} 
                                            onChange={e => setFailingTeamId(e.target.value)}
                                            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none"
                                        >
                                            <option value="">-- Pilih Regu Utama --</option>
                                            {displayedTeams.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} ({getTeamSchoolOnly(t) || t.school})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {failingTeamId && (
                                        <div className="space-y-2 pt-2 border-t border-slate-100">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block">2. Lempar Soal Ke Regu Lain:</label>
                                            <div className="grid grid-cols-1 gap-2">
                                                {displayedTeams.filter(t => t.id !== failingTeamId).map(destTeam => (
                                                    <div key={destTeam.id} className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl flex items-center justify-between">
                                                        <span className="font-bold text-xs text-purple-900">{destTeam.name}</span>
                                                        <div className="flex gap-1">
                                                            <button 
                                                                onClick={() => {
                                                                    updateScore(destTeam.id, config.nilaiLempar, `Lempar Soal ${config.nomorSoal}`);
                                                                    setFailingTeamId('');
                                                                }}
                                                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition"
                                                            >
                                                                ✔ Benar (+{config.nilaiLempar})
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    updateScore(destTeam.id, -config.penguranganSalah, `Salah Lempar Soal ${config.nomorSoal}`);
                                                                    setFailingTeamId('');
                                                                }}
                                                                className="px-3 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-700 transition"
                                                            >
                                                                ✖ Salah (-{config.penguranganSalah})
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT 2 COLUMNS: PANEL C - SKOR MANAJEMEN PER REGU */}
                        <div className="lg:col-span-2 space-y-6">
                            
                            {/* SOAL STATUS CONTROLS */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold">
                                        Soal {config.nomorSoal}
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => setConfig({...config, nomorSoal: Math.max(1, config.nomorSoal - 1)})} className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-700 font-bold"><Minus size={14}/></button>
                                        <button onClick={() => setConfig({...config, nomorSoal: config.nomorSoal + 1})} className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-700 font-bold"><Plus size={14}/></button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400">Status Soal:</span>
                                    {(['Wajib', 'Lempar', 'Rebutan'] as const).map(status => (
                                        <button
                                            key={status}
                                            onClick={() => setConfig({...config, statusSoal: status})}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                                                config.statusSoal === status 
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            Soal {status}
                                        </button>
                                    ))}
                                </div>

                                <button 
                                    onClick={handleUndo} 
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 border border-slate-200 transition"
                                >
                                    <Undo size={14}/> Undo (Ctrl+Z)
                                </button>
                            </div>

                            {/* PANEL SKOR REGU CARDS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {displayedTeams.map((team) => (
                                    <div 
                                        key={team.id}
                                        style={{ borderTopColor: team.color }}
                                        className="bg-white rounded-2xl border border-slate-200 border-t-4 shadow-sm p-5 flex flex-col justify-between space-y-4"
                                    >
                                        {/* HEADER */}
                                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                                            <div className="flex-1 mr-2">
                                                <TeamMemberBadge 
                                                    rawName={team.name} 
                                                    members={team.members} 
                                                    theme="indigo" 
                                                    size="md" 
                                                    align="left"
                                                    customColor={team.color}
                                                />
                                                <p className="text-xs font-semibold text-slate-400 truncate mt-1">
                                                    {getTeamSchoolOnly(team) || '-'} {getTeamGugus(team) ? `(${getTeamGugus(team)})` : ''}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => resetScoreTeam(team.id)} 
                                                className="text-slate-300 hover:text-rose-600 transition p-1 shrink-0"
                                                title="Riset Skor Regu Ini"
                                            >
                                                <RotateCcw size={14}/>
                                            </button>
                                        </div>

                                        {/* SCORE */}
                                        <div className="text-center py-2 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="font-mono font-black text-4xl text-slate-800">
                                                {team.score}
                                            </span>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Skor</p>
                                        </div>

                                        {/* QUICK ADD BUTTONS */}
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase block">Tambah Skor (+):</label>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {(config.tambahSkorSteps && config.tambahSkorSteps.length > 0 ? config.tambahSkorSteps : [5, 10, 20, 25, 50, 100]).map(val => (
                                                    <button
                                                        key={'plus_' + val}
                                                        onClick={() => updateScore(team.id, val, `Soal ${config.nomorSoal}`)}
                                                        className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-xs rounded-xl border border-emerald-200 transition"
                                                    >
                                                        +{val}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* QUICK SUBTRACT BUTTONS */}
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase block">Kurang Skor (-):</label>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {(config.kurangSkorSteps && config.kurangSkorSteps.length > 0 ? config.kurangSkorSteps : [5, 10, 20, 50, 100]).map(val => (
                                                    <button
                                                        key={'minus_' + val}
                                                        onClick={() => updateScore(team.id, -val, `Pengurangan Soal ${config.nomorSoal}`)}
                                                        className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs rounded-xl border border-rose-200 transition"
                                                    >
                                                        -{val}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* CUSTOM MANUAL SCORE INPUT PER TEAM */}
                                        <div className="pt-2 border-t border-slate-100">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Skor Custom Manual:</label>
                                            <div className="flex gap-1.5">
                                                <input
                                                    type="number"
                                                    placeholder="Skor Custom Manual"
                                                    value={customScoreInputs[team.id] || ''}
                                                    onChange={e => setCustomScoreInputs({ ...customScoreInputs, [team.id]: e.target.value })}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            handleApplyCustomScore(team.id, true);
                                                        }
                                                    }}
                                                    className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500"
                                                />
                                                <button
                                                    onClick={() => handleApplyCustomScore(team.id, true)}
                                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg transition shrink-0"
                                                    title="Tambah Skor Custom"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={() => handleApplyCustomScore(team.id, false)}
                                                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-lg transition shrink-0"
                                                    title="Kurang Skor Custom"
                                                >
                                                    -
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
                )}

                {/* ==================== TAB: BANK SOAL & REFERENSI JAWABAN ==================== */}
                {activeTabOperator === 'soal' && (
                    <div className="space-y-6">

                        {/* ACTION BAR: SAVE TO DATABASE */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
                            <div className="flex-1 min-w-[280px]">
                                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                                    <Save size={18} className="text-indigo-600"/> SIMPAN BANK SOAL KE DATABASE
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    Simpan seluruh daftar soal LCC yang ada di bawah ini secara permanen ke database utama agar dapat diakses di sesi/perangkat lain.
                                </p>
                            </div>
                            <button
                                onClick={handleSaveAllQuestions}
                                disabled={isSavingQuestions}
                                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-black text-xs rounded-xl transition flex items-center gap-2 shadow-md shadow-indigo-100"
                            >
                                {isSavingQuestions ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Menyimpan ke DB...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Simpan Bank Soal
                                    </>
                                )}
                            </button>
                        </div>

                        {/* TOP ACTION BAR: EXCEL IMPORT, EXPORT, TEMPLATE DOWNLOAD */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                                    <BookOpen size={20} className="text-indigo-600"/> BANK SOAL & REFERENSI JAWABAN LCC
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Kelola daftar soal, kunci/referensi jawaban, serta impor/ekspor file Excel.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={downloadExcelTemplate}
                                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center gap-1.5"
                                    title="Unduh contoh format file Excel"
                                >
                                    <Download size={15} className="text-slate-600"/> Download Template Excel
                                </button>

                                <label className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-sm active:scale-95">
                                    <FileSpreadsheet size={16}/> Impor Soal Excel
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        onChange={importQuestionsFromExcel}
                                        className="hidden"
                                    />
                                </label>

                                <button
                                    onClick={exportQuestionsToExcel}
                                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
                                >
                                    <FileUp size={16}/> Export Excel
                                </button>

                                {questions.length > 0 && (
                                    <button
                                        onClick={handleClearAllQuestions}
                                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl border border-rose-200 transition flex items-center gap-1"
                                    >
                                        <Trash2 size={15}/> Hapus Semua Soal
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* FORM INPUT / EDIT SOAL */}
                        <form onSubmit={handleSaveQuestion} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                    <Edit3 size={16} className="text-indigo-600"/>
                                    {editingQuestionId ? `Edit Soal ${questionForm.nomorSoal}` : 'Tambah / Input Soal Baru'}
                                </h4>
                                {editingQuestionId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const maxNum = questions.length > 0 ? Math.max(0, ...questions.map(q => q.nomorSoal || 0)) : 0;
                                            setEditingQuestionId(null);
                                            setQuestionForm({
                                                nomorSoal: maxNum + 1,
                                                babak: config.namaBabak,
                                                soal: '',
                                                referensiJawaban: '',
                                                poin: config.nilaiWajib,
                                                kategori: 'Pengetahuan Umum'
                                            });
                                        }}
                                        className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
                                    >
                                        Batal Edit
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nomor Soal</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={questionForm.nomorSoal}
                                        onChange={e => updateQuestionForm({ nomorSoal: parseInt(e.target.value) || 1 })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Babak / Sesi (Deteksi Otomatis Konfigurasi)</label>
                                    <select
                                        value={questionForm.babak}
                                        onChange={e => updateQuestionForm({ babak: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    >
                                        <option value={config.namaBabak}>{config.namaBabak} (Konfigurasi Utama)</option>
                                        <option value="Babak Penyisihan - Soal Wajib">Babak Penyisihan - Soal Wajib</option>
                                        <option value="Babak Penyisihan - Soal Rebutan">Babak Penyisihan - Soal Rebutan</option>
                                        <option value="Babak Semifinal">Babak Semifinal</option>
                                        <option value="Babak Final">Babak Final</option>
                                        {Array.from(new Set(questions.map(q => q.babak))).map(b => (
                                            b && b !== config.namaBabak && !['Babak Penyisihan - Soal Wajib', 'Babak Penyisihan - Soal Rebutan', 'Babak Semifinal', 'Babak Final'].includes(b) ? (
                                                <option key={b} value={b}>{b}</option>
                                            ) : null
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Kategori / Mapel</label>
                                    <select
                                        value={questionForm.kategori}
                                        onChange={e => updateQuestionForm({ kategori: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                        {getSubjects(config as unknown as Record<string, string>).map(s => (
                                            <option key={s.id || s.label} value={s.label}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Poin Soal (Jika Benar)</label>
                                    <input
                                        type="number"
                                        value={questionForm.poin}
                                        onChange={e => updateQuestionForm({ poin: parseInt(e.target.value) || 100 })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pertanyaan / Teks Soal</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Pertanyaan / Teks Soal"
                                        value={questionForm.soal}
                                        onChange={e => updateQuestionForm({ soal: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">Referensi / Kunci Jawaban</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Referensi / Kunci Jawaban"
                                        value={questionForm.referensiJawaban}
                                        onChange={e => updateQuestionForm({ referensiJawaban: e.target.value })}
                                        className="w-full p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    className={`px-5 py-2.5 font-extrabold text-xs rounded-xl transition shadow-md flex items-center gap-2 active:scale-95 cursor-pointer text-white ${
                                        isFormSaved 
                                            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' 
                                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                    }`}
                                >
                                    {isFormSaved ? (
                                        <>
                                            <Plus size={16}/> Tambah Soal
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16}/> {editingQuestionId ? 'Simpan Perubahan Soal' : 'Simpan Soal'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* TABLE DAFTAR BANK SOAL */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                    Daftar Soal Tersimpan ({questions.length} Soal)
                                </h4>

                                {/* SEARCH BOX */}
                                <div className="relative w-full sm:w-64">
                                    <Search size={14} className="absolute left-3 top-3 text-slate-400"/>
                                    <input
                                        type="text"
                                        placeholder="Pencarian Soal / Babak"
                                        value={questionSearch}
                                        onChange={e => setQuestionSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {questions.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 space-y-2">
                                    <BookOpen size={36} className="mx-auto text-slate-300"/>
                                    <p className="text-xs font-bold">Bank Soal Masih Kosong</p>
                                    <p className="text-[11px]">Silakan input soal secara manual di form atas atau klik <strong>Impor Soal Excel</strong>.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                                                <th className="p-3 w-16">No.</th>
                                                <th className="p-3 w-36">Babak / Kategori</th>
                                                <th className="p-3">Pertanyaan / Soal</th>
                                                <th className="p-3 text-emerald-800">Kunci / Referensi Jawaban</th>
                                                <th className="p-3 w-16 text-center">Poin</th>
                                                <th className="p-3 w-36 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {questions
                                                .filter(q => 
                                                    q.soal.toLowerCase().includes(questionSearch.toLowerCase()) || 
                                                    q.referensiJawaban.toLowerCase().includes(questionSearch.toLowerCase()) ||
                                                    q.babak.toLowerCase().includes(questionSearch.toLowerCase()) ||
                                                    (q.kategori && q.kategori.toLowerCase().includes(questionSearch.toLowerCase()))
                                                )
                                                .map((q) => {
                                                    const isActive = config.nomorSoal === q.nomorSoal;
                                                    return (
                                                        <tr key={q.id} className={`hover:bg-slate-50/80 transition ${isActive ? 'bg-amber-50/60 font-medium' : ''}`}>
                                                            <td className="p-3 font-black text-slate-800 text-center">
                                                                <span className={`px-2 py-1 rounded-lg text-xs ${isActive ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                                    {q.nomorSoal}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 space-y-1">
                                                                <span className="block font-bold text-slate-700 text-[11px]">{q.babak}</span>
                                                                {q.kategori && (
                                                                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-semibold">
                                                                        {q.kategori}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 font-semibold text-slate-800 max-w-xs leading-relaxed">
                                                                {q.soal}
                                                            </td>
                                                            <td className="p-3 font-extrabold text-emerald-700 max-w-xs leading-relaxed bg-emerald-50/30">
                                                                {q.referensiJawaban}
                                                            </td>
                                                            <td className="p-3 font-black text-center text-indigo-600">
                                                                +{q.poin}
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <button
                                                                        onClick={() => {
                                                                            setConfig(prev => ({ ...prev, nomorSoal: q.nomorSoal }));
                                                                            setActiveTabOperator('control');
                                                                            setIsQuestionCardOpen(true);
                                                                            showToast(`Soal ${q.nomorSoal} terpilih di Panel Utama!`, 'info');
                                                                        }}
                                                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[10px] transition"
                                                                        title="Pilih & Buka Soal Ini"
                                                                    >
                                                                        Buka
                                                                    </button>

                                                                    <button
                                                                        onClick={() => startEditQuestion(q)}
                                                                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                                                                        title="Edit Soal"
                                                                    >
                                                                        <Edit3 size={14}/>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteQuestion(q.id)}
                                                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                                                                        title="Hapus Soal"
                                                                    >
                                                                        <Trash2 size={14}/>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                    </div>
                )}

                {/* ==================== TAB 2: PENGATURAN LOMBA & NILAI ==================== */}
                {activeTabOperator === 'settings' && (
                    <div className="space-y-6">
                        {/* ACTION BAR: SAVE TO DATABASE */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
                            <div className="flex-1 min-w-[280px]">
                                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                                    <Save size={18} className="text-emerald-600"/> SIMPAN PENGATURAN KE DATABASE
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    Simpan semua perubahan pada informasi lomba, daftar regu peserta, dan aturan nilai secara permanen ke database utama.
                                </p>
                            </div>
                            <button
                                onClick={handleSaveAllSettings}
                                disabled={isSavingSettings}
                                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-black text-xs rounded-xl transition flex items-center gap-2 shadow-md shadow-emerald-100"
                            >
                                {isSavingSettings ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Menyimpan ke DB...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Simpan Pengaturan
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* PANEL A: PENGATURAN LOMBA & REGUS */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <h3 className="font-bold text-base text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                                <Settings size={18} className="text-indigo-600"/> INFORMASI LOMBA
                            </h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nama Lomba</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" 
                                        value={config.namaLomba}
                                        onChange={e => setConfig({...config, namaLomba: e.target.value})}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tema Lomba</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" 
                                        value={config.tema}
                                        onChange={e => setConfig({...config, tema: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nama Babak</label>
                                        <input 
                                            type="text" 
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" 
                                            value={config.namaBabak}
                                            onChange={e => setConfig({...config, namaBabak: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Durasi Timer (Detik)</label>
                                        <input 
                                            type="number" 
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" 
                                            value={config.durasiTimer}
                                            onChange={e => setConfig({...config, durasiTimer: parseInt(e.target.value) || 60})}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Running Text Footer</label>
                                    <textarea 
                                        rows={2}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" 
                                        value={config.runningText}
                                        onChange={e => setConfig({...config, runningText: e.target.value})}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">URL Logo Lomba</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" 
                                        value={config.logoUrl}
                                        onChange={e => setConfig({...config, logoUrl: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* PANEL REGU REGISTRATION & COLOR */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-3">
                                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                                    <Users size={18} className="text-amber-600"/> DAFTAR REGU PESERTA
                                </h3>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={openTeamSelector}
                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
                                        title="Pilih dan tarik data regu secara spesifik dari daftar peserta"
                                    >
                                        <Users size={14}/> Pilih & Tarik Regu dari Peserta
                                    </button>
                                    <button
                                        onClick={syncTeamsFromCBT}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
                                        title="Siswa mengerjakan ujian secara umum, sistem otomatis mengelompokkan 3 siswa per sekolah menjadi 1 regu dan mensinkronkan skor."
                                    >
                                        <RefreshCw size={14}/> Sinkronkan Regu & Skor dari CBT
                                    </button>
                                    <label className="text-xs font-bold text-slate-400">Jumlah:</label>
                                    <select 
                                        value={teams.length}
                                        onChange={e => {
                                            const num = parseInt(e.target.value);
                                            if (num > teams.length) {
                                                const diff = num - teams.length;
                                                const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
                                                const newAdded: LccTeam[] = Array.from({ length: diff }, (_, i) => {
                                                    const idx = teams.length + i;
                                                    const letter = String.fromCharCode(65 + idx);
                                                    return {
                                                        id: `regu_${letter.toLowerCase()}`,
                                                        name: `REGU ${letter}`,
                                                        school: `Sekolah ${letter}`,
                                                        score: 0,
                                                        color: colors[idx % colors.length],
                                                        logo: '',
                                                        correctCount: 0,
                                                        wrongCount: 0
                                                    };
                                                });
                                                setTeams([...teams, ...newAdded]);
                                            } else if (num < teams.length && num >= 2) {
                                                setTeams(teams.slice(0, num));
                                            }
                                        }}
                                        className="p-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50"
                                    >
                                        <option value={2}>2 Regu</option>
                                        <option value={3}>3 Regu</option>
                                        <option value={4}>4 Regu</option>
                                        <option value={5}>5 Regu</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                                {teams.map((t, idx) => (
                                    <div key={t.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-xs uppercase" style={{ color: t.color }}>
                                                Detail Regu {idx + 1}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="color" 
                                                    value={t.color}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setTeams(prev => prev.map(item => item.id === t.id ? { ...item, color: val } : item));
                                                    }}
                                                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                                                    title="Pilih Warna Regu"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteConfirmTeamId(t.id)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                                    title="Hapus Regu"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Nama Regu</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                                    value={t.name}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setTeams(prev => prev.map(item => item.id === t.id ? { ...item, name: val } : item));
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Nama Gugus</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Gugus..."
                                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                                    value={getTeamGugus(t)}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const currentSchool = getTeamSchoolOnly(t);
                                                        const updatedSchoolValue = val ? `${val} | ${currentSchool}` : currentSchool;
                                                        setTeams(prev => prev.map(item => item.id === t.id ? { ...item, school: updatedSchoolValue } : item));
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Asal Sekolah</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                                    value={getTeamSchoolOnly(t)}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const currentGugus = getTeamGugus(t);
                                                        const updatedSchoolValue = currentGugus ? `${currentGugus} | ${val}` : val;
                                                        setTeams(prev => prev.map(item => item.id === t.id ? { ...item, school: updatedSchoolValue } : item));
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">URL Logo Regu (Opsional)</label>
                                            <input 
                                                type="text" 
                                                placeholder="Link URL Logo..."
                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none"
                                                value={t.logo || ''}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setTeams(prev => prev.map(item => item.id === t.id ? { ...item, logo: val } : item));
                                                }}
                                            />
                                        </div>

                                        {t.members && t.members.length > 0 && (
                                            <div className="text-[10px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                                                <span className="font-bold text-slate-700 block mb-1">Anggota Regu ({t.members.length} Siswa):</span>
                                                <ul className="list-disc list-inside space-y-0.5">
                                                    {t.members.map((m, mIdx) => <li key={mIdx}>{m}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* PANEL F: PENGATURAN SKOR & ATURAN NILAI */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 md:col-span-2">
                            <h3 className="font-bold text-base text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                                <Award size={18} className="text-emerald-600"/> PENGATURAN POIN & ATURAN NILAI
                            </h3>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Soal Wajib</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none" 
                                        value={config.nilaiWajib}
                                        onChange={e => setConfig({...config, nilaiWajib: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Soal Lempar</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none" 
                                        value={config.nilaiLempar}
                                        onChange={e => setConfig({...config, nilaiLempar: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Soal Rebutan</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none" 
                                        value={config.nilaiRebutan}
                                        onChange={e => setConfig({...config, nilaiRebutan: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pengurangan Salah</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-rose-600 outline-none" 
                                        value={penguranganSalahStr}
                                        onChange={e => setPenguranganSalahStr(e.target.value)}
                                        onBlur={e => setConfig({...config, penguranganSalah: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Bonus Point</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-emerald-600 outline-none" 
                                        value={bonusPointStr}
                                        onChange={e => setBonusPointStr(e.target.value)}
                                        onBlur={e => setConfig({...config, bonusPoint: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tombol Tambah Skor Cepat (Pisahkan koma)</label>
                                    <input 
                                        type="text" 
                                        placeholder="Tombol Tambah Skor Cepat"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" 
                                        value={tambahSkorStr}
                                        onChange={e => setTambahSkorStr(e.target.value)}
                                        onBlur={e => {
                                            const arr = e.target.value.split(/[, ]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                                            setConfig({ ...config, tambahSkorSteps: arr });
                                        }}
                                    />
                                    <span className="text-[10px] text-slate-400 block mt-0.5">Pengaturan nilai tombol hijau (+) pada kartu regu</span>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tombol Kurang Skor Cepat (Pisahkan koma)</label>
                                    <input 
                                        type="text" 
                                        placeholder="Tombol Kurang Skor Cepat"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" 
                                        value={kurangSkorStr}
                                        onChange={e => setKurangSkorStr(e.target.value)}
                                        onBlur={e => {
                                            const arr = e.target.value.split(/[, ]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                                            setConfig({ ...config, kurangSkorSteps: arr });
                                        }}
                                    />
                                    <span className="text-[10px] text-slate-400 block mt-0.5">Pengaturan nilai tombol merah (-) pada kartu regu</span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                                <div>
                                    <span className="font-bold text-xs text-slate-800 block">Tampilkan Teks Soal di Screen Proyektor (Scoreboard)</span>
                                    <span className="text-[11px] text-slate-500">Jika diaktifkan, teks soal akan muncul di layar proyektor untuk peserta. Referensi/kunci jawaban tetap hanya tampil di layar juri.</span>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={config.tampilkanSoalKeProjector ?? true}
                                    onChange={e => setConfig({ ...config, tampilkanSoalKeProjector: e.target.checked })}
                                    className="w-5 h-5 text-indigo-600 rounded cursor-pointer accent-indigo-600 shrink-0"
                                />
                            </div>
                        </div>

                    </div>
                </div>
            )}

                {/* ==================== TAB 3: RIWAYAT SKOR LOG ==================== */}
                {activeTabOperator === 'history' && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                                <History size={18} className="text-indigo-600"/> AUDIT LOG RIWAYAT PERUBAHAN SKOR
                            </h3>
                            <button onClick={handleUndo} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1">
                                <Undo size={14}/> Undo Perubahan Terakhir
                            </button>
                        </div>

                        {history.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 italic text-sm">
                                Belum ada riwayat perubahan skor yang dicatat.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                                        <tr>
                                            <th className="p-3">Waktu</th>
                                            <th className="p-3">Regu</th>
                                            <th className="p-3 text-center">Perubahan</th>
                                            <th className="p-3 text-center">Skor Akhir</th>
                                            <th className="p-3">Kategori</th>
                                            <th className="p-3">Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {history.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50 transition">
                                                <td className="p-3 font-mono text-slate-500">{log.timestamp}</td>
                                                <td className="p-3 font-bold text-slate-800">{log.teamName}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                                                        log.delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                                    }`}>
                                                        {log.delta > 0 ? `+${log.delta}` : log.delta}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center font-mono font-bold text-slate-700">{log.newScore}</td>
                                                <td className="p-3">
                                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                                                        {log.category || '-'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-slate-600">{log.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ==================== TAB 4: EXPORT & BACKUP ==================== */}
                {activeTabOperator === 'export' && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        <h3 className="font-bold text-base text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                            <Download size={18} className="text-emerald-600"/> EXPORT, BACKUP & RESTORE DATA
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                            {/* EXCEL & LAPORAN */}
                            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                    <FileSpreadsheet size={18} className="text-emerald-600"/> Export Laporan
                                </h4>
                                <p className="text-xs text-slate-500">
                                    Download rekapitulasi total skor, peringkat regu, dan seluruh riwayat poin ke format file Excel.
                                </p>
                                <button 
                                    onClick={exportExcel}
                                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-100"
                                >
                                    <FileSpreadsheet size={16}/> Download Excel (.xlsx)
                                </button>
                            </div>

                            {/* BACKUP & RESTORE */}
                            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                    <Upload size={18} className="text-indigo-600"/> Backup & Restore
                                </h4>
                                <p className="text-xs text-slate-500">
                                    Simpan file cadangan JSON atau pulihkan data lomba dari file backup sebelumnya.
                                </p>
                                <div className="space-y-2">
                                    <button 
                                        onClick={backupDataJSON}
                                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                                    >
                                        <Download size={14}/> Download Backup JSON
                                    </button>
                                    <label className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer">
                                        <Upload size={14}/> Restore JSON
                                        <input type="file" accept=".json" onChange={restoreDataJSON} className="hidden" />
                                    </label>
                                </div>
                            </div>

                            {/* RESET DATA */}
                            <div className="p-5 bg-rose-50/60 border border-rose-200 rounded-2xl space-y-3">
                                <h4 className="font-bold text-sm text-rose-900 flex items-center gap-2">
                                    <AlertCircle size={18} className="text-rose-600"/> Riset Seluruh Data
                                </h4>
                                <p className="text-xs text-rose-700">
                                    Kembalikan pengaturan, daftar regu, dan riwayat skor ke kondisi awal bawaan pabrik.
                                </p>
                                <button 
                                    onClick={resetAllData}
                                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-rose-100"
                                >
                                    <RotateCcw size={16}/> Riset Semua Data LCC
                                </button>
                            </div>

                        </div>
                    </div>
                )}

            </div>

            {/* KEYBOARD SHORTCUTS MODAL */}
            {showShortcutsModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                                <HelpCircle size={18} className="text-indigo-600"/> PETUNJUK SHORTCUT KEYBOARD
                            </h3>
                            <button onClick={() => setShowShortcutsModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                                <span className="font-bold text-slate-700">Start / Pause Timer</span>
                                <kbd className="px-2 py-1 bg-white border rounded font-mono font-bold shadow-xs">Spacebar</kbd>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                                <span className="font-bold text-slate-700">Riset Timer</span>
                                <kbd className="px-2 py-1 bg-white border rounded font-mono font-bold shadow-xs">Key R</kbd>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                                <span className="font-bold text-slate-700">Buka Buzzer Rebutan</span>
                                <kbd className="px-2 py-1 bg-white border rounded font-mono font-bold shadow-xs">Key B</kbd>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                                <span className="font-bold text-slate-700">Simulasi Buzzer Regu 1–5</span>
                                <kbd className="px-2 py-1 bg-white border rounded font-mono font-bold shadow-xs">Angka 1 s/d 5</kbd>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                                <span className="font-bold text-slate-700">Undo Perubahan Poin</span>
                                <kbd className="px-2 py-1 bg-white border rounded font-mono font-bold shadow-xs">Ctrl + Z</kbd>
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowShortcutsModal(false)}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            {/* PANDUAN PROYEKTOR DUAL MONITOR MODAL */}
            {showProjectorGuideModal && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
                    <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 space-y-5 shadow-2xl overflow-hidden relative">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                                    <Tv size={22} />
                                </div>
                                <div>
                                    <h3 className="font-black text-base text-slate-800 uppercase tracking-tight">
                                        PANDUAN LCD PROYEKTOR / DUAL DISPLAY
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">Cara Menampilkan Scoreboard LCC di Layar Kedua</p>
                                </div>
                            </div>
                            <button onClick={() => setShowProjectorGuideModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
                        </div>

                        <div className="space-y-3.5 text-xs">
                            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0">1</span>
                                <div>
                                    <p className="font-bold text-slate-800">Hubungkan Laptop ke Proyektor</p>
                                    <p className="text-slate-600 mt-0.5">Sambungkan kabel HDMI/VGA laptop Anda ke proyektor atau TV panggung.</p>
                                </div>
                            </div>

                            <div className="p-3.5 bg-indigo-50 rounded-2xl border border-indigo-200/80 flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">2</span>
                                <div>
                                    <p className="font-bold text-slate-800">Atur Mode Layar Windows (Win + P)</p>
                                    <p className="text-slate-600 mt-0.5">Tekan kombinasi tombol <kbd className="px-1.5 py-0.5 bg-white border border-indigo-300 rounded font-mono font-bold">Win + P</kbd> di keyboard, lalu pilih mode <strong className="text-indigo-700">"Extend" / "Perluas"</strong>.</p>
                                </div>
                            </div>

                            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200/80 flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">3</span>
                                <div>
                                    <p className="font-bold text-slate-800">Buka Scoreboard di Jendela Baru</p>
                                    <p className="text-slate-600 mt-0.5">Klik tombol <strong className="text-emerald-700">"Buka di Window Baru"</strong> di atas. Jendela tampilan khusus proyektor akan muncul.</p>
                                </div>
                            </div>

                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-black text-xs flex items-center justify-center shrink-0">4</span>
                                <div>
                                    <p className="font-bold text-slate-800">Geser Jendela ke Layar Proyektor & Tekan F11</p>
                                    <p className="text-slate-600 mt-0.5">Tarik (drag) jendela tersebut ke layar proyektor, lalu klik jendela tersebut dan tekan <kbd className="px-1.5 py-0.5 bg-white border rounded font-mono font-bold">F11</kbd> untuk Fullscreen penuh.</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 flex flex-wrap gap-2">
                            <button 
                                onClick={() => { setShowProjectorGuideModal(false); openProjectorWindow(); }}
                                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-amber-100"
                            >
                                <ExternalLink size={16}/> Buka Window Proyektor Sekarang
                            </button>
                            <button 
                                onClick={copyProjectorUrl}
                                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                            >
                                <Copy size={16}/> Copy Link
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Konfirmasi Hapus Soal LCC */}
            <ConfirmationModal
                isOpen={deleteConfirmQuestionId !== null}
                onClose={() => setDeleteConfirmQuestionId(null)}
                onConfirm={confirmDeleteQuestion}
                title="Hapus Soal"
                message="Apakah Anda yakin ingin menghapus soal ini dari Bank Soal? Soal yang dihapus tidak dapat dikembalikan."
                confirmText="Hapus"
                cancelText="Batal"
                type="danger"
            />

            {/* Modal Konfirmasi Hapus Semua Soal LCC */}
            <ConfirmationModal
                isOpen={showClearAllModal}
                onClose={() => setShowClearAllModal(false)}
                onConfirm={confirmClearAllQuestions}
                title="Hapus Semua Soal"
                message="Apakah Anda yakin ingin menghapus SEMUA soal dari Bank Soal? Seluruh soal di daftar akan dihapus secara permanen."
                confirmText="Hapus Semua"
                cancelText="Batal"
                type="danger"
            />

            {/* Modal Konfirmasi Reset Skor Regu */}
            <ConfirmationModal
                isOpen={resetScoreTeamId !== null}
                onClose={() => setResetScoreTeamId(null)}
                onConfirm={confirmResetScoreTeam}
                title="Reset Skor Regu"
                message={`Apakah Anda yakin ingin meriset skor regu ${teams.find(t => t.id === resetScoreTeamId)?.name || ''} menjadi 0?`}
                confirmText="Reset Skor"
                cancelText="Batal"
                type="warning"
            />

            {/* Modal Konfirmasi Reset Seluruh Data LCC */}
            <ConfirmationModal
                isOpen={showResetAllDataModal}
                onClose={() => setShowResetAllDataModal(false)}
                onConfirm={confirmResetAllData}
                title="Reset Seluruh Data LCC"
                message="Apakah Anda yakin ingin meriset seluruh data LCC? (Skor, Regu, dan Riwayat akan kembali ke kondisi awal)"
                confirmText="Reset Seluruh Data"
                cancelText="Batal"
                type="danger"
            />

            {/* Modal Konfirmasi Hapus Regu LCC */}
            <ConfirmationModal
                isOpen={deleteConfirmTeamId !== null}
                onClose={() => setDeleteConfirmTeamId(null)}
                onConfirm={confirmDeleteTeam}
                title="Hapus Regu"
                message={`Apakah Anda yakin ingin menghapus regu ${teams.find(t => t.id === deleteConfirmTeamId)?.name || ''} dari daftar? Data skor dan identitas regu ini akan hilang.`}
                confirmText="Hapus"
                cancelText="Batal"
                type="danger"
            />

            {/* MODAL PILIH & TARIK REGU DARI DAFTAR PESERTA */}
            {isTeamSelectorModalOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
                    <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                                    <Users size={22} />
                                </div>
                                <div>
                                    <h3 className="font-black text-base text-slate-800 uppercase tracking-tight">
                                        PILIH & TARIK REGU DARI DAFTAR PESERTA
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">Pilih regu atau sekolah yang ingin ditarik ke Scoreboard LCC ({candidateTeams.length} kandidat ditemukan)</p>
                                </div>
                            </div>
                            <button onClick={() => setIsTeamSelectorModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
                        </div>

                        <div className="flex items-center justify-between gap-2 shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="text-xs font-bold text-slate-700">
                                Terpilih: <span className="text-indigo-600 font-black">{selectedCandidateIds.length}</span> dari {candidateTeams.length} Regu
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedCandidateIds(candidateTeams.map(c => c.id))}
                                    className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg shadow-sm"
                                >
                                    Pilih Semua
                                </button>
                                <button
                                    onClick={() => setSelectedCandidateIds([])}
                                    className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg shadow-sm"
                                >
                                    Batalkan Semua
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-[250px]">
                            {candidateTeams.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-xs font-medium">
                                    Tidak ada data peserta atau regu yang ditemukan di database.
                                </div>
                            ) : (
                                candidateTeams.map(c => {
                                    const isSelected = selectedCandidateIds.includes(c.id);
                                    return (
                                        <div 
                                            key={c.id} 
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedCandidateIds(selectedCandidateIds.filter(id => id !== c.id));
                                                } else {
                                                    setSelectedCandidateIds([...selectedCandidateIds, c.id]);
                                                }
                                            }}
                                            className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between gap-3 ${isSelected ? 'bg-indigo-50/50 border-indigo-500 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    onChange={() => {}} 
                                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <div>
                                                    <TeamMemberBadge rawName={c.name} members={c.members} theme="indigo" size="sm" align="left" customColor={c.color} />
                                                    <div className="flex gap-2 mt-1">
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{c.school}</span>
                                                        {c.gugus && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">{c.gugus}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-[10px] text-slate-400 uppercase font-bold">Skor CBT</div>
                                                <div className="text-sm font-black text-indigo-600">{c.score} Poin</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="pt-2 flex gap-3 shrink-0 border-t border-slate-100">
                            <button 
                                onClick={() => setIsTeamSelectorModalOpen(false)}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={handleImportSelectedTeams}
                                disabled={selectedCandidateIds.length === 0}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                            >
                                <Check size={16}/> Impor {selectedCandidateIds.length} Regu Terpilih ke Scoreboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScoreboardLCCTab;
