import React, { useState, useEffect, useRef } from 'react';
import { Bell, Trophy, Volume2, ShieldAlert, CheckCircle2, RefreshCw, Zap, VolumeX, Maximize2, Users, ArrowLeft, Radio } from 'lucide-react';
import { soundFx } from '../utils/scoreboardAudio';
import { TeamMemberBadge } from '../utils/adminHelpers';
import { User } from '../types';
import { api } from '../src/services/api';
import { useToast } from '../context/ToastContext';

interface LccReguBuzzerViewProps {
    currentUser?: User;
    onBack?: () => void;
}

export const LccReguBuzzerView: React.FC<LccReguBuzzerViewProps> = ({ currentUser, onBack }) => {
    const { showToast } = useToast();
    const [teams, setTeams] = useState<any[]>([
        { id: 'team_1', name: 'REGU A', color: '#ef4444', school: 'SD NEGERI 1' },
        { id: 'team_2', name: 'REGU B', color: '#3b82f6', school: 'SD NEGERI 2' },
        { id: 'team_3', name: 'REGU C', color: '#10b981', school: 'SD NEGERI 3' },
        { id: 'team_4', name: 'REGU D', color: '#f59e0b', school: 'SD NEGERI 4' },
        { id: 'team_5', name: 'REGU E', color: '#8b5cf6', school: 'SD NEGERI 5' },
    ]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('team_1');
    const [isBuzzerOpen, setIsBuzzerOpen] = useState<boolean>(true);
    const [lockedTeamId, setLockedTeamId] = useState<string | null>(null);
    const [lockedTime, setLockedTime] = useState<string | null>(null);
    const [isPressed, setIsPressed] = useState<boolean>(false);
    const [isRinging, setIsRinging] = useState<boolean>(false);
    const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

    // Auto select team based on currentUser
    useEffect(() => {
        (async () => {
            try {
                const dbTeams = await api.getLccTeams();
                if (dbTeams && dbTeams.length > 0) {
                    setTeams(dbTeams);
                    if (currentUser) {
                        const uname = currentUser.username.toLowerCase();
                        const fname = currentUser.nama_lengkap.toLowerCase();
                        const matched = dbTeams.find((t: any) => 
                            t.id.toLowerCase() === uname || 
                            t.name.toLowerCase() === uname || 
                            fname.includes(t.name.toLowerCase()) || 
                            uname.includes(t.id.replace('team_', 'regu_')) ||
                            uname.includes(t.id.replace('team_', 'team_'))
                        );
                        if (matched) {
                            setSelectedTeamId(matched.id);
                        } else {
                            // Check regu_a, regu_b, etc.
                            if (uname.includes('regu_a') || uname.includes('team_1')) setSelectedTeamId(dbTeams[0]?.id || 'team_1');
                            else if (uname.includes('regu_b') || uname.includes('team_2')) setSelectedTeamId(dbTeams[1]?.id || 'team_2');
                            else if (uname.includes('regu_c') || uname.includes('team_3')) setSelectedTeamId(dbTeams[2]?.id || 'team_3');
                            else if (uname.includes('regu_d') || uname.includes('team_4')) setSelectedTeamId(dbTeams[3]?.id || 'team_4');
                            else if (uname.includes('regu_e') || uname.includes('team_5')) setSelectedTeamId(dbTeams[4]?.id || 'team_5');
                        }
                    }
                }
            } catch (e) {
                console.error("Error loading LCC teams for buzzer view:", e);
            }
        })();
    }, [currentUser]);

    // Setup BroadcastChannel for real-time state sync with Scoreboard
    useEffect(() => {
        if (typeof BroadcastChannel !== 'undefined') {
            broadcastChannelRef.current = new BroadcastChannel('lcc_scoreboard_sync');
            broadcastChannelRef.current.onmessage = (event) => {
                if (event.data && event.data.type === 'SYNC_STATE') {
                    const { teams: t, isBuzzerOpen: bo, lockedTeamId: lt } = event.data.payload;
                    if (t) setTeams(t);
                    if (typeof bo === 'boolean') setIsBuzzerOpen(bo);
                    if (lt !== undefined) setLockedTeamId(lt);
                }
            };
        }

        // Listen for localStorage changes
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'lcc_scoreboard_teams' && e.newValue) {
                try { setTeams(JSON.parse(e.newValue)); } catch (err) {}
            }
            if (e.key === 'lcc_scoreboard_config' && e.newValue) {
                try {
                    const cfg = JSON.parse(e.newValue);
                    if (typeof cfg.isBuzzerOpen === 'boolean') setIsBuzzerOpen(cfg.isBuzzerOpen);
                } catch (err) {}
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            broadcastChannelRef.current?.close();
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    const activeTeam = teams.find(t => t.id === selectedTeamId) || teams[0] || { id: 'team_1', name: 'REGU A', color: '#ef4444', school: 'SD NEGERI 1' };

    // HANDLE PRESS BELL
    const handlePressBell = () => {
        if (!isBuzzerOpen) {
            showToast('Buzzer saat ini masih ditutup/dinonaktifkan oleh Juri.', 'warning');
            return;
        }
        if (lockedTeamId) {
            showToast('Buzzer sudah dikunci oleh regu lain!', 'error');
            return;
        }

        // Play Bell & Buzzer sound INSTANTLY with zero latency
        soundFx.playBell();
        soundFx.playBuzzer();

        // Trigger vibration if device supports it
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }

        // Bell Ringing animation state
        setIsPressed(true);
        setIsRinging(true);
        setTimeout(() => setIsPressed(false), 200);
        setTimeout(() => setIsRinging(false), 1200);

        const timeStr = new Date().toLocaleTimeString('id-ID') + '.' + new Date().getMilliseconds().toString().padStart(3, '0');
        setLockedTeamId(activeTeam.id);
        setLockedTime(timeStr);

        // 1. Send Broadcast message
        broadcastChannelRef.current?.postMessage({
            type: 'TRIGGER_BUZZER',
            payload: { teamId: activeTeam.id, teamName: activeTeam.name, time: timeStr }
        });

        // 2. Set LocalStorage trigger for all open windows
        localStorage.setItem('lcc_buzzer_trigger', JSON.stringify({
            teamId: activeTeam.id,
            teamName: activeTeam.name,
            timestamp: Date.now()
        }));

        showToast(`🔔 BELL DITEKAN! ${activeTeam.name} mengunci buzzer!`, 'success');
    };

    // Keyboard trigger (Spacebar)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
                e.preventDefault();
                handlePressBell();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTeam, isBuzzerOpen, lockedTeamId]);

    const isMyTeamLocked = lockedTeamId === activeTeam.id;
    const isOtherTeamLocked = lockedTeamId !== null && !isMyTeamLocked;

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between p-4 md:p-6 relative overflow-hidden select-none">
            {/* Background Glowing Ambiance */}
            <div 
                className="absolute inset-0 opacity-20 pointer-events-none transition-all duration-700"
                style={{
                    background: isMyTeamLocked 
                        ? 'radial-gradient(circle at center, #f59e0b 0%, #d97706 40%, transparent 80%)'
                        : isOtherTeamLocked
                        ? 'radial-gradient(circle at center, #ef4444 0%, transparent 70%)'
                        : `radial-gradient(circle at center, ${activeTeam.color || '#3b82f6'} 0%, transparent 75%)`
                }}
            />

            {/* HEADER BAR */}
            <header className="relative z-10 flex items-center justify-between bg-slate-900/80 border border-slate-800 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-xl">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700 active:scale-95"
                            title="Kembali"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
                        <Bell size={22} className={isRinging ? 'animate-bounce' : ''} />
                    </div>
                    <div>
                        <h1 className="font-black text-base md:text-lg tracking-tight text-slate-100 leading-tight">
                            LAYAR BEL REGU LCC
                        </h1>
                        <p className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                            Smart Scoreboard Buzzer
                        </p>
                    </div>
                </div>

                {/* TEAM SELECTOR / IDENTITY BADGE */}
                <div className="flex items-center gap-2">
                    <div className="hidden sm:flex flex-col items-end mr-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Regu Aktif</span>
                        <span className="text-xs font-black text-white">{activeTeam.name}</span>
                    </div>

                    <select 
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="bg-slate-800 border-2 border-slate-700 text-white font-black text-xs md:text-sm px-3 py-2 rounded-xl outline-none focus:border-amber-500 transition cursor-pointer"
                        style={{ color: activeTeam.color }}
                    >
                        {teams.map(t => (
                            <option key={t.id} value={t.id} style={{ color: t.color, backgroundColor: '#0f172a' }}>
                                {t.name} ({t.school || 'SD'})
                            </option>
                        ))}
                    </select>

                    <button 
                        onClick={() => soundFx.playBell()}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl border border-slate-700 transition"
                        title="Tes Suara Bel"
                    >
                        <Volume2 size={18} />
                    </button>
                </div>
            </header>

            {/* MAIN BELL INTERACTIVE DISPLAY */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center my-4">
                
                {/* STATUS BADGE */}
                <div className="mb-6">
                    {isMyTeamLocked ? (
                        <div className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-sm md:text-base rounded-full shadow-[0_0_30px_rgba(245,158,11,0.6)] border-2 border-amber-200 flex items-center gap-2 animate-pulse uppercase tracking-wider">
                            <Zap size={20} className="fill-current" /> BUZZER TERCEPAT! REGU ANDA MENGUNCI!
                        </div>
                    ) : isOtherTeamLocked ? (
                        <div className="px-5 py-2 bg-rose-950/80 border border-rose-500/50 text-rose-300 font-bold text-xs md:text-sm rounded-full flex items-center gap-2 uppercase tracking-wider">
                            <ShieldAlert size={18} className="text-rose-400" /> REGUNYA {teams.find(t => t.id === lockedTeamId)?.name} DULUAN!
                        </div>
                    ) : (
                        <div className="px-5 py-2 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold text-xs md:text-sm rounded-full flex items-center gap-2 uppercase tracking-wider animate-pulse">
                            <Radio size={18} className="text-emerald-400" /> BUZZER DIBUKA — TEKAN BEL SEKARANG!
                        </div>
                    )}
                </div>

                {/* THE GIANT BELL BUTTON */}
                <div className="relative group">
                    {/* Ringing Sound Wave Ripple Effects */}
                    {isRinging && (
                        <>
                            <div className="absolute inset-0 rounded-full border-4 border-amber-400 animate-ping opacity-75 pointer-events-none scale-125" />
                            <div className="absolute -inset-8 rounded-full border-2 border-yellow-300 animate-ping opacity-50 pointer-events-none scale-150 delay-100" />
                        </>
                    )}

                    {/* Outer Glow Ring */}
                    <div 
                        className={`w-64 h-64 md:w-80 md:h-80 rounded-full flex items-center justify-center shadow-2xl ${
                            isMyTeamLocked 
                                ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 ring-8 ring-amber-300 shadow-[0_0_80px_rgba(251,191,36,0.9)] scale-105'
                                : isOtherTeamLocked || !isBuzzerOpen
                                ? 'bg-slate-800/80 border-4 border-slate-700 opacity-60 cursor-not-allowed'
                                : 'bg-gradient-to-tr from-amber-600 via-orange-500 to-yellow-400 hover:scale-105 active:scale-95 shadow-[0_0_60px_rgba(245,158,11,0.5)] cursor-pointer'
                        }`}
                        onPointerDown={handlePressBell}
                    >
                        {/* Inner 3D Button Disc */}
                        <div 
                            className={`w-52 h-52 md:w-64 md:h-64 rounded-full flex flex-col items-center justify-center text-slate-950 border-4 ${
                                isPressed 
                                    ? 'scale-90 bg-amber-300 border-white' 
                                    : isOtherTeamLocked || !isBuzzerOpen
                                    ? 'bg-slate-700 border-slate-600 text-slate-500 shadow-inner'
                                    : 'bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-500 border-yellow-200 shadow-inner'
                            }`}
                        >
                            {/* Animated Bell Icon */}
                            <div className={`transition-transform duration-300 ${isRinging ? 'animate-bounce scale-110' : (!isOtherTeamLocked && isBuzzerOpen ? 'group-hover:scale-110' : '')}`}>
                                <Bell 
                                    size={80} 
                                    className={`${isOtherTeamLocked || !isBuzzerOpen ? 'fill-slate-600 stroke-slate-500' : 'fill-slate-950 stroke-slate-950'} ${isRinging ? 'rotate-12' : ''}`} 
                                    strokeWidth={2.5}
                                />
                            </div>

                            <span className="font-black text-xl md:text-2xl uppercase tracking-widest mt-2 drop-shadow-sm">
                                {isMyTeamLocked ? 'TERKUNCI!' : isOtherTeamLocked ? 'TERKUNCI REGU LAIN' : !isBuzzerOpen ? 'DITUTUP JURI' : 'TEKAN BEL'}
                            </span>

                            <span className="text-[10px] md:text-xs font-bold text-slate-900/80 tracking-wider uppercase mt-0.5">
                                (Tekan / Spacebar)
                            </span>
                        </div>
                    </div>
                </div>

                {/* REGU IDENTITY INFO CARD BELOW BELL */}
                <div className="mt-8 bg-slate-900/90 border-2 border-slate-800 p-4 rounded-2xl max-w-sm w-full text-center shadow-xl backdrop-blur-md flex flex-col items-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Users size={18} style={{ color: activeTeam.color }} />
                        <TeamMemberBadge 
                            rawName={activeTeam.name} 
                            members={activeTeam.members} 
                            theme="dark" 
                            size="md" 
                            align="center"
                            customColor={activeTeam.color} 
                        />
                    </div>
                    <p className="text-xs text-slate-400 font-medium">{activeTeam.school || 'SD NEGERI'}</p>
                    
                    {lockedTime && isMyTeamLocked && (
                        <p className="mt-2 text-xs font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 py-1 px-3 rounded-lg inline-block">
                            Waktu Lock: {lockedTime}
                        </p>
                    )}
                </div>

            </main>

            {/* FOOTER TIPS */}
            <footer className="relative z-10 text-center text-slate-500 text-xs font-medium py-2">
                Tekan tombol Bel di layar atau tombol <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded font-mono text-[10px]">SPACE</kbd> untuk merebut soal secara instant.
            </footer>
        </div>
    );
};

export default LccReguBuzzerView;
