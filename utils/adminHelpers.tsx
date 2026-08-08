
import React from 'react';
import * as XLSX from 'xlsx';

export const getSchoolOnly = (schoolStr?: string): string => {
    if (!schoolStr) return '';
    if (schoolStr.includes(' | ')) {
        const parts = schoolStr.split(' | ');
        return parts[1]?.trim() || parts[0]?.trim() || '';
    }
    if (schoolStr.includes('|')) {
        const parts = schoolStr.split('|');
        return parts[1]?.trim() || parts[0]?.trim() || '';
    }
    return schoolStr.trim();
};

// DAFTAR MAPEL BAKU & KODE ID
export const DEFAULT_SUBJECTS_DB = [
    { id: "Pengetahuan Umum", label: "Pengetahuan Umum" },
    { id: "PAI", label: "PAI" },
    { id: "Pendidikan Pancasila", label: "Pendidikan Pancasila" },
    { id: "Bahasa Indonesia", label: "Bahasa Indonesia" },
    { id: "Matematika", label: "Matematika" },
    { id: "IPAS", label: "IPAS" },
    { id: "Seni Rupa", label: "Seni Rupa" },
    { id: "PJOK", label: "PJOK" },
    { id: "Bahasa Inggris", label: "Bahasa Inggris" },
    { id: "Bahasa Jawa", label: "Bahasa Jawa" }
];

export const DEFAULT_EXAM_TYPES = [
    { id: "OSN", label: "OSN" },
    { id: "LCC", label: "Lomba Cerdas Cermat" },
    { id: "TKA", label: "TKA" },
    { id: "SUMATIF", label: "Sumatif" },
    { id: "LITERASI", label: "Lomba Literasi/Numerasi" }
];

export const DEFAULT_EXAM_SUBJECT_MAPPING = [
    { examTypeId: "OSN", subjectIds: ["IPAS", "MTK", "PAI"] }, // Example mapping
    { examTypeId: "LCC", subjectIds: ["UMUM"] },
    { examTypeId: "TKA", subjectIds: ["MTK", "BIN"] },
    { examTypeId: "SUMATIF", subjectIds: DEFAULT_SUBJECTS_DB.map(s => s.id) },
    { examTypeId: "LITERASI", subjectIds: ["LITERASI", "NUMERASI"] }
];

export const getSubjects = (config: Record<string, string>) => {
    if (config['SUBJECTS_DB']) {
        try {
            const parsed = JSON.parse(config['SUBJECTS_DB']);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.error("Failed to parse SUBJECTS_DB", e);
        }
    }
    return DEFAULT_SUBJECTS_DB;
};

export const getExamTypes = (config: Record<string, string>, onlyActive: boolean = true) => {
    let types = DEFAULT_EXAM_TYPES;
    
    if (config['EXAM_TYPES_DB']) {
        try {
            const parsed = JSON.parse(config['EXAM_TYPES_DB']);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Normalize string[] to {id, label}[]
                if (typeof parsed[0] === 'string') {
                    types = parsed.map((p: string) => ({ id: p, label: p }));
                } else {
                    types = parsed;
                }
            }
        } catch (e) {
            console.error("Failed to parse EXAM_TYPES_DB", e);
        }
    }

    // Filter by Active Status if requested
    if (onlyActive && config['EXAM_TYPES_STATUS']) {
        try {
            const statusMap = JSON.parse(config['EXAM_TYPES_STATUS']);
            // If status exists, filter. If not in map, assume active (backward compatibility) or inactive?
            // Let's assume active by default if not specified, to avoid hiding everything on first load.
            types = types.filter(t => statusMap[t.id] !== false);
        } catch (e) {
            console.error("Failed to parse EXAM_TYPES_STATUS", e);
        }
    }

    return types;
};

export const getExamSubjectMapping = (config: Record<string, string>) => {
    if (config['EXAM_SUBJECT_MAPPING_DB']) {
        try {
            const parsed = JSON.parse(config['EXAM_SUBJECT_MAPPING_DB']);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.error("Failed to parse EXAM_SUBJECT_MAPPING_DB", e);
        }
    }
    return DEFAULT_EXAM_SUBJECT_MAPPING;
};

export const SUBJECTS_DB = DEFAULT_SUBJECTS_DB; // Fallback for backward compatibility

// Helper to detect whether an exam type is LCC / Beregu (Team competition)
export const isBereguExamType = (examType?: string | null): boolean => {
    if (!examType) return false;
    const str = examType.trim().toUpperCase();
    return str === 'LCC' || str.includes('CERDAS CERMAT') || str.includes('BEREGU') || str.includes('LOMBA CERDAS CERMAT');
};

// Helper to format duration string "HH:mm:ss" or "mm:ss" to text "X Jam Y Menit Z Detik"
export const formatDurationToText = (duration: string) => {
    if (!duration || duration === '-' || duration === 'undefined') return '-';
    try {
        const parts = duration.split(':').map(p => parseInt(p, 10) || 0);
        let h = 0, m = 0, s = 0;
        if (parts.length === 3) { [h, m, s] = parts; } 
        else if (parts.length === 2) { [m, s] = parts; } 
        else { return duration; }
        
        const textParts = [];
        if (h > 0) textParts.push(`${h}h`);
        if (m > 0) textParts.push(`${m}m`);
        if (s > 0) textParts.push(`${s}s`);
        
        return textParts.length > 0 ? textParts.join(' ') : '0s';
    } catch (e) { return duration; }
};

// Helper: Score Predicate Logic
export const getScorePredicate = (score: number) => {
    if (score >= 86) return "Istimewa";
    if (score >= 71) return "Baik";
    if (score >= 56) return "Memadai";
    return "Kurang";
};

// Helper: Predicate Badge Component
export const getPredicateBadge = (score: number) => {
    const p = getScorePredicate(score);
    let color = "";
    switch (p) {
        case "Istimewa": color = "bg-purple-100 text-purple-700 border-purple-200"; break;
        case "Baik": color = "bg-emerald-100 text-emerald-700 border-emerald-200"; break;
        case "Memadai": color = "bg-yellow-100 text-yellow-700 border-yellow-200"; break;
        default: color = "bg-rose-100 text-rose-700 border-rose-200"; break;
    }
    return <span className={`px-2 py-1 rounded text-xs font-bold border ${color}`}>{p}</span>;
};

// Generic Export Function
export const exportToExcel = (data: any[], fileName: string, sheetName: string = "Data") => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

// Custom SVG Donut Chart
export const SimpleDonutChart = ({ data, size = 160 }: { data: { value: number, color: string, label?: string }[], size?: number }) => {
    const total = data.reduce((a, b) => a + b.value, 0);
    let cumulative = 0;
    const center = size / 2;
    const radius = (size - 40) / 2;
    const circumference = 2 * Math.PI * radius;
    return (
        <div className="relative flex items-center justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                {data.map((item, i) => {
                    const percentage = total > 0 ? item.value / total : 0;
                    const dashArray = percentage * circumference;
                    const offset = cumulative * circumference;
                    cumulative += percentage;
                    return (
                        <circle key={i} cx={center} cy={center} r={radius} fill="transparent" stroke={item.color} strokeWidth="24" strokeDasharray={`${dashArray} ${circumference}`} strokeDashoffset={-offset} className="transition-all duration-1000 ease-out" />
                    );
                })}
                {total === 0 && <circle cx={center} cy={center} r={radius} fill="transparent" stroke="#e2e8f0" strokeWidth="24" />}
            </svg>
            <div className="absolute flex flex-col items-center"><span className="text-2xl font-bold text-slate-700">{total}</span><span className="text-xs text-slate-400 font-bold uppercase">Total</span></div>
        </div>
    );
};

export interface ParsedTeamInfo {
    reguTitle: string;
    members: string[];
}

export const formatTwoWords = (name: string): string => {
    if (!name) return '';
    const cleanName = name.trim();
    if (!cleanName || cleanName.startsWith('.')) return cleanName;
    const words = cleanName.split(/\s+/).filter(Boolean);
    if (words.length <= 2) return words.join(' ');
    return words.slice(0, 2).join(' ');
};

export const parseTeamAndMembers = (rawName?: string, membersArray?: string[]): ParsedTeamInfo => {
    let reguTitle = (rawName || '').trim();
    let members: string[] = membersArray && Array.isArray(membersArray) && membersArray.length > 0 ? [...membersArray] : [];

    if (reguTitle.includes('|')) {
        const parts = reguTitle.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length > 0) {
            reguTitle = parts[0];
            if (members.length === 0 && parts.length > 1) {
                members = parts.slice(1);
            }
        }
    }

    if (!reguTitle) reguTitle = 'REGU';

    const formattedMembers = members.map(m => formatTwoWords(m)).filter(Boolean);

    return { reguTitle, members: formattedMembers };
};

export const syncTeamsWithParticipants = (teams: any[], students: any[]): any[] => {
    if (!students || students.length === 0 || !teams || teams.length === 0) return teams;

    const studentMapByUname: Record<string, any> = {};
    const studentMapByName: Record<string, any> = {};

    students.forEach(s => {
        const uname = (s.username || '').toLowerCase().trim();
        const fname = (s.fullname || s.nama_lengkap || '').toLowerCase().trim();
        if (uname) studentMapByUname[uname] = s;
        if (fname) studentMapByName[fname] = s;
    });

    return teams.map(team => {
        const cleanTeamId = String(team.id).toLowerCase().replace(/^team_/, '').trim();
        let matchedStudent = studentMapByUname[cleanTeamId] || studentMapByUname[String(team.id).toLowerCase().trim()];

        if (!matchedStudent) {
            const cleanTeamName = String(team.name).toLowerCase().trim();
            matchedStudent = studentMapByName[cleanTeamName];
        }

        if (matchedStudent) {
            const rawFullName = (matchedStudent.fullname || matchedStudent.nama_lengkap || matchedStudent.username || '').trim();
            if (rawFullName) {
                const { reguTitle, members: extractedMembers } = parseTeamAndMembers(rawFullName);
                
                let cleanTeamName = reguTitle;
                if (!cleanTeamName.toUpperCase().includes('REGU') && !cleanTeamName.toUpperCase().includes('TEAM')) {
                    cleanTeamName = `REGU ${cleanTeamName}`;
                }

                const rawMembersList = extractedMembers.length > 0 
                    ? extractedMembers 
                    : (matchedStudent.members && Array.isArray(matchedStudent.members) && matchedStudent.members.length > 0
                        ? matchedStudent.members
                        : (team.members && team.members.length > 0 ? team.members : []));

                const finalMembers = rawMembersList.map((m: string) => formatTwoWords(m)).filter(Boolean);

                return {
                    ...team,
                    name: cleanTeamName,
                    members: finalMembers,
                    school: matchedStudent.school || matchedStudent.kelas_id || team.school
                };
            }
        }
        return team;
    });
};

export const TeamMemberBadge: React.FC<{
    rawName?: string;
    members?: string[];
    theme?: 'light' | 'dark' | 'amber' | 'indigo';
    size?: 'sm' | 'md' | 'lg';
    align?: 'left' | 'center';
    customColor?: string;
}> = ({ rawName, members, theme = 'light', size = 'md', align = 'left', customColor }) => {
    const parsed = parseTeamAndMembers(rawName, members);
    const isDark = theme === 'dark';
    const alignClass = align === 'center' ? 'items-center text-center justify-center' : 'items-start text-left';

    const titleSizeClass = 
        size === 'sm' ? 'text-[11px] px-2 py-0.5' :
        size === 'lg' ? 'text-base md:text-lg px-3.5 py-1' :
        'text-xs md:text-sm px-2.5 py-1';

    const memberSizeClass = 
        size === 'sm' ? 'text-[9px] px-1.5 py-0.5' :
        size === 'lg' ? 'text-xs md:text-sm px-2.5 py-1' :
        'text-[10px] md:text-xs px-2 py-0.5';

    let titleBg = 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white';
    if (theme === 'amber') titleBg = 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
    if (theme === 'dark') titleBg = 'bg-slate-800 text-amber-300 border border-slate-700 shadow-inner';

    let memberBg = isDark 
        ? 'bg-slate-800/90 text-slate-200 border-slate-700/80 hover:bg-slate-800' 
        : 'bg-indigo-50/80 text-indigo-800 border-indigo-100 hover:bg-indigo-100/60';

    return (
        <div className={`flex flex-col ${alignClass} gap-1.5 max-w-full`}>
            {/* REGU BADGE ON TOP */}
            <div className="inline-flex items-center gap-1.5 flex-wrap">
                <span 
                    style={customColor ? { backgroundColor: customColor } : undefined}
                    className={`font-black rounded-lg uppercase tracking-wide inline-flex items-center gap-1.5 shadow-sm ${titleBg} ${titleSizeClass}`}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse"></span>
                    {parsed.reguTitle}
                </span>
            </div>

            {/* MEMBER STUDENT NAMES BELOW WITH BACKGROUND DECORATIONS */}
            {parsed.members.length > 0 && (
                <div className={`flex flex-col gap-1 ${align === 'center' ? 'items-center' : 'items-start'}`}>
                    {parsed.members.map((member, idx) => (
                        <span 
                            key={idx} 
                            className={`inline-flex items-center gap-1 rounded-md font-bold border transition shadow-2xs ${memberBg} ${memberSizeClass}`}
                        >
                            <span className="text-[9px] opacity-60 font-mono font-black">{idx + 1}.</span>
                            {member}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export const DashboardSkeleton = () => (
    <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-slate-200 rounded-2xl"></div>
            <div className="h-64 bg-slate-200 rounded-2xl col-span-2"></div>
        </div>
    </div>
);
