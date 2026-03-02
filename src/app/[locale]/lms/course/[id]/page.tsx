"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ChevronRight, ChevronDown, BookOpen, Menu, Clock, X,
    CheckCircle2, Circle, PlayCircle, FileText, ListTodo, ArrowLeft, ArrowRight, Megaphone
} from 'lucide-react';
import { Course, Section, Subsection, Unit, UnitComponent } from '@/lib/lms/types';
import { getMockCourse } from '@/lib/lms/mockData';
import { getCourseById } from '@/lib/courseService';
import { useTranslations, useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserProfileDropdown from '@/components/dashboard/UserProfileDropdown';
import QuizRenderer from '@/components/lms/QuizRenderer';
import { createClient } from '@/lib/supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Helper to sanitize Youtube URLs for embedding
function getYouTubeEmbedUrl(url: string) {
    try {
        let videoId = "";
        if (url.includes('youtube.com/watch')) {
            videoId = new URL(url).searchParams.get('v') || "";
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    } catch (e) {
        return url;
    }
}

export default function LMSCoursePlayer() {
    const params = useParams();
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('CoursePlayer');
    const tLMS = useTranslations('LMS');
    const supabase = createClient();

    const courseId = decodeURIComponent(params.id as string);

    const [course, setCourse] = useState<Course | null>(null);
    const [mounted, setMounted] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);

    // UI Navigation State
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [expandedUnitComponents, setExpandedUnitComponents] = useState<Set<string>>(new Set());
    const [announcements, setAnnouncements] = useState<{ id: string; title: string; content: string; pinned: boolean; created_at: string }[]>([]);
    const [showAnnouncements, setShowAnnouncements] = useState(true);
    // Core Learning Position
    const [currentUnitId, setCurrentUnitId] = useState<string | null>(null);

    // Track completed units (mock progress)
    const [completedUnits, setCompletedUnits] = useState<Set<string>>(new Set());

    // Sync state
    const [dataSource, setDataSource] = useState<'cloud' | 'local' | 'loading'>('loading');
    const [lastSyncError, setLastSyncError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);

        const initLms = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push(`/${locale}`);
                return;
            }
            
            // Get user's cohort from the database
            const { data: userData } = await supabase.from("users").select("role, name, cohort, cohort_id").eq("id", user.id).maybeSingle();
            const role = userData?.role || "student";
            const cohort = userData?.cohort || "DEFAULT";
            let cohortId = userData?.cohort_id || null;
            const name = userData?.name || user.email;

            // Auto-backfill: if cohort is set but cohort_id is missing, look up and persist
            if (cohort && cohort !== 'DEFAULT' && !cohortId) {
                const { data: cohortRow } = await supabase.from("cohorts").select("id").eq("name", cohort).maybeSingle();
                if (cohortRow) {
                    cohortId = cohortRow.id;
                    await supabase.from("users").update({ cohort_id: cohortId }).eq("id", user.id);
                }
            }
            
            const profile = {
                id: user.id,
                name: name,
                email: user.email,
                agent_id: role.toUpperCase(),
                role: role,
                cohort: cohort,
                cohort_id: cohortId,
                level: 1,
                exp: 0,
            };
            setUserProfile(profile);

            // Populate sessionStorage if missing so sync works
            if (!sessionStorage.getItem('currentUser')) {
                sessionStorage.setItem("currentUser", JSON.stringify(profile));
            }

            let saved = localStorage.getItem('lms_courses_db');
            if (!saved) {
                saved = JSON.stringify([getMockCourse()]);
                localStorage.setItem('lms_courses_db', saved);
            }

            if (saved) {
                const courses: Course[] = JSON.parse(saved);
                // Try Supabase first for the single course
                setDataSource('loading');
                const dbCourse = await getCourseById(courseId);
                
                if (dbCourse) {
                    setDataSource('cloud');
                    setLastSyncError(null);
                    // Load announcements
                    const { data: annData } = await supabase.from('announcements').select('*').eq('course_id', courseId).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(10);
                    if (annData) setAnnouncements(annData);
                } else {
                    setDataSource('local');
                    setLastSyncError("Could not fetch from Supabase. Showing local/cached version.");
                }

                const rawCourse = dbCourse || courses.find((c: any) => c.id === courseId);

                if (rawCourse && rawCourse.status !== 'none') {
                    
                    if (rawCourse.visibility === 'cohort') {
                        const isStaffUser = ['staff', 'admin', 'superuser'].includes(profile.role);
                        
                        if (!isStaffUser) {
                            let hasAccess = false;
                            
                            if (!rawCourse.allowedCohorts || rawCourse.allowedCohorts.length === 0) {
                                // No cohorts assigned = available to all
                                hasAccess = true;
                            } else {
                                // Check via cohort_memberships (definitive source of truth)
                                try {
                                    const { data: myMemberships } = await supabase
                                        .from("cohort_memberships")
                                        .select("cohort_id")
                                        .eq("user_id", user.id);
                                    
                                    if (myMemberships && myMemberships.length > 0) {
                                        const myCohortIds = myMemberships.map(m => m.cohort_id);
                                        hasAccess = rawCourse.allowedCohorts.some((id: string) => myCohortIds.includes(id));
                                    }
                                } catch (e) {
                                    // Fallback: use cohort_id from profile
                                    if (profile.cohort_id && rawCourse.allowedCohorts.includes(profile.cohort_id)) {
                                        hasAccess = true;
                                    }
                                }
                            }
                            
                            if (!hasAccess) {
                                router.push(`/${locale}/lms`);
                                return;
                            }
                        }
                    }

                    const isScheduledInFuture = (dateStr?: string) => {
                        if (!dateStr) return false;
                        const kstDateStr = dateStr.includes('+') || dateStr.endsWith('Z') 
                            ? dateStr 
                            : (dateStr.includes('T') ? `${dateStr}:00+09:00` : `${dateStr}T00:00:00+09:00`);
                        return new Date(kstDateStr).getTime() > Date.now();
                    };
                    
                    const publishedCourse: Course = {
                        ...rawCourse,
                        sections: rawCourse.sections
                            .filter((s: any) => s.status !== 'none')
                            .map((s: any) => {
                                const isScheduled = isScheduledInFuture(s.publishDate);
                                const effectiveStatus = s.status === 'draft' ? 'draft' : (isScheduled ? 'scheduled' : 'published');
                                return {
                                    ...s,
                                    status: effectiveStatus as any,
                                    subsections: s.subsections
                                        .filter((sub: any) => sub.status !== 'none')
                                        .map((sub: any) => {
                                            const isSubScheduled = isScheduledInFuture(sub.publishDate);
                                            let effectiveSubStatus = sub.status === 'draft' ? 'draft' : (isSubScheduled ? 'scheduled' : 'published');
                                            
                                            if (effectiveStatus === 'draft') effectiveSubStatus = 'draft';
                                            else if (effectiveStatus === 'scheduled' && effectiveSubStatus === 'published') effectiveSubStatus = 'scheduled';

                                            return {
                                                ...sub,
                                                status: effectiveSubStatus as any,
                                                units: sub.units.filter((u: any) => u.status !== 'none').map((u: any) => {
                                                    const isUnitScheduled = isScheduledInFuture(u.publishDate);
                                                    let effectiveUnitStatus = u.status === 'draft' ? 'draft' : (isUnitScheduled ? 'scheduled' : 'published');
                                                    
                                                    if (effectiveSubStatus === 'draft') effectiveUnitStatus = 'draft';
                                                    else if (effectiveSubStatus === 'scheduled' && effectiveUnitStatus === 'published') effectiveUnitStatus = 'scheduled';

                                                    return {
                                                        ...u,
                                                        status: effectiveUnitStatus as any
                                                    };
                                                })
                                            };
                                        })
                                };
                            })
                    };

                    setCourse(publishedCourse);

                    // Load completed units from Supabase
                    try {
                        const { data: completions } = await supabase
                            .from('unit_completions')
                            .select('unit_id')
                            .eq('user_id', user.id)
                            .eq('course_id', courseId);
                        if (completions && completions.length > 0) {
                            setCompletedUnits(new Set(completions.map(c => c.unit_id)));
                        }
                    } catch (e) {
                        console.error('Failed to load completions', e);
                    }

                    if (publishedCourse.sections.length > 0) {
                        setExpandedSections(new Set([publishedCourse.sections[0].id]));
                        for (const sec of publishedCourse.sections) {
                            if (sec.status !== 'published') continue;
                            for (const sub of sec.subsections) {
                                if (sub.status !== 'published') continue;
                                for (const unit of sub.units) {
                                    if (unit.status === 'published') {
                                        setCurrentUnitId(unit.id);
                                        return;
                                    }
                                }
                            }
                        }
                    }
                } else {
                    router.push(`/${locale}/lms`);
                }
            } else {
                router.push(`/${locale}/dashboard`);
            }
        };

        if (courseId) {
            initLms();
        }
    }, [courseId, router, locale, supabase]);

    const toggleSection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedSections);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedSections(next);
    };

    const markUnitCompleted = async () => {
        if (currentUnitId && !completedUnits.has(currentUnitId)) {
            setCompletedUnits(new Set([...completedUnits, currentUnitId]));
            // Persist to Supabase
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('unit_completions').upsert({
                        user_id: user.id,
                        course_id: courseId,
                        unit_id: currentUnitId,
                    }, { onConflict: 'user_id,course_id,unit_id' });
                }
            } catch (e) {
                console.error('Failed to save completion', e);
            }
        }
    };

    // Auto-mark non-quiz units as completed after viewing for 2 seconds
    useEffect(() => {
        if (!currentUnitId || !course) return;
        // Find the current unit
        let currentUnit: Unit | undefined;
        for (const sec of course.sections) {
            for (const sub of sec.subsections) {
                for (const u of sub.units) {
                    if (u.id === currentUnitId) currentUnit = u;
                }
            }
        }
        if (!currentUnit) return;
        const hasQuiz = currentUnit.components.some(c => c.type === 'quiz');
        const hasVideo = currentUnit.components.some(c => c.type === 'video');
        if (hasQuiz || hasVideo) return; // Video/quiz completion handled separately
        if (completedUnits.has(currentUnitId)) return; // Already completed

        const timer = setTimeout(() => {
            markUnitCompleted();
        }, 2000);
        return () => clearTimeout(timer);
    }, [currentUnitId, course]);

    if (!mounted || !course) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-pulse font-bold text-slate-400">{t('loading')}</div></div>;

    // Build linear array of all units for Next/Prev navigation
    let allUnits: { unit: Unit, subsectionName: string, sectionName: string }[] = [];
    course.sections.forEach(sec => {
        sec.subsections.forEach(sub => {
            sub.units.forEach(unit => {
                allUnits.push({ unit, subsectionName: sub.title, sectionName: sec.title });
            });
        });
    });

    const currentIndex = allUnits.findIndex(u => u.unit.id === currentUnitId);
    const currentUnitMeta = currentIndex > -1 ? allUnits[currentIndex] : null;
    const currentUnit = currentUnitMeta?.unit;

    const prevUnitId = currentIndex > 0 ? allUnits[currentIndex - 1].unit.id : null;
    const nextUnitId = currentIndex < allUnits.length - 1 ? allUnits[currentIndex + 1].unit.id : null;

    // Get units for the top ribbon (siblings in the same subsection)
    const currentSubsectionUnits = currentUnitMeta ? course.sections.flatMap(s => s.subsections).find(sub => sub.title === currentUnitMeta.subsectionName)?.units || [] : [];

    return (
        <div className="h-screen bg-white flex flex-col font-sans overflow-hidden">
            {/* Top Navbar */}
            <header className="h-14 bg-[#111827] text-white flex items-center justify-between px-4 shrink-0 shadow-md z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="text-slate-300 hover:text-white transition-colors"
                    >
                        <Menu size={24} />
                    </button>
                    <Link href={`/${locale}/lms`} className="font-bold flex items-center gap-2 hover:text-emerald-400 transition-colors">
                        <ArrowLeft size={16} /> {t('course_catalog')}
                    </Link>
                    <div className="h-4 w-px bg-slate-600 hidden md:block"></div>
                    <span className="font-semibold text-slate-300 text-sm truncate max-w-md hidden md:block">{course.title}</span>
                </div>
                <div className="flex items-center gap-4">
                    {dataSource === 'cloud' && (
                        <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                            Cloud Sync
                        </div>
                    )}
                    {dataSource === 'local' && (
                        <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 cursor-help" title={lastSyncError || "Offline mode"}>
                            <Clock size={12} />
                            Local Cache
                        </div>
                    )}
                    {userProfile && <UserProfileDropdown userProfile={userProfile} />}
                    <div className="text-xs bg-slate-800 text-emerald-400 px-3 py-1 rounded-full font-bold hidden sm:block border border-slate-700">
                        {completedUnits.size} / {allUnits.length} {t('completed')}
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden h-full relative">
                {/* Left Sidebar (Course Outline) - overlay on mobile */}
                {sidebarOpen && (
                    <>
                    {/* Mobile backdrop */}
                    <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
                    <aside className="fixed md:relative inset-y-14 left-0 w-[85vw] sm:w-[320px] md:w-[320px] bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto custom-scrollbar shadow-xl md:shadow-inner z-40 md:z-10 transition-all">
                        <div className="p-6">
                            {/* Progress Bar */}
                            {(() => {
                                const totalUnits = allUnits.filter(u => u.unit.status === 'published').length;
                                const completedCount = allUnits.filter(u => u.unit.status === 'published' && completedUnits.has(u.unit.id)).length;
                                const pct = totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;
                                return (
                                    <div className="mb-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <h2 className="font-bold text-slate-800 tracking-tight text-lg">{t('course_progress')}</h2>
                                            <span className="text-sm font-bold text-emerald-600">{pct}%</span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 font-bold">{completedCount} / {totalUnits} units completed</p>
                                    </div>
                                );
                            })()}

                            <div className="space-y-4">
                                {course.sections.map((section, sIdx) => {
                                    const isExpanded = expandedSections.has(section.id);
                                    // Calculate section completion
                                    const sectionUnits = section.subsections.flatMap(sub => sub.units.filter(u => u.status === 'published'));
                                    const sectionCompleted = sectionUnits.filter(u => completedUnits.has(u.id)).length;
                                    const sectionTotal = sectionUnits.length;
                                    const sectionPct = sectionTotal > 0 ? Math.round((sectionCompleted / sectionTotal) * 100) : 0;
                                    const isFullyComplete = sectionCompleted === sectionTotal && sectionTotal > 0;
                                    return (
                                        <div key={section.id} className={`border rounded-xl overflow-hidden shadow-sm ${isFullyComplete ? 'border-green-300 bg-green-50/30' : 'border-slate-200 bg-white'}`}>
                                            {/* Section Header */}
                                            <div
                                                className={`p-4 border-b flex items-center justify-between cursor-pointer transition-colors ${isFullyComplete ? 'bg-green-50 border-green-200 hover:bg-green-100/50' : 'bg-slate-100/50 border-slate-200 hover:bg-emerald-50/50'}`}
                                                onClick={(e) => toggleSection(section.id, e)}
                                            >
                                                <div className="flex flex-col flex-1 mr-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('section')} {sIdx + 1}</span>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isFullyComplete ? 'bg-green-200 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                                                            {sectionCompleted}/{sectionTotal}
                                                        </span>
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-sm">{section.title}</span>
                                                    {/* Mini progress bar */}
                                                    <div className="w-full h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${isFullyComplete ? 'bg-green-500' : 'bg-emerald-400'}`}
                                                            style={{ width: `${sectionPct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="text-slate-400">
                                                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                </div>
                                            </div>

                                            {/* Subsections */}
                                            {isExpanded && (
                                                <div className="flex flex-col">
                                                    {section.subsections.map(sub => {
                                                        const isSubActive = currentUnitMeta?.subsectionName === sub.title;
                                                        const subUnits = sub.units.filter(u => u.status === 'published');
                                                        const subCompleted = subUnits.filter(u => completedUnits.has(u.id)).length;
                                                        const subTotal = subUnits.length;
                                                        const subAllDone = subCompleted === subTotal && subTotal > 0;
                                                        return (
                                                            <div key={sub.id} className="border-b border-slate-100 last:border-0">
                                                                <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${isSubActive ? 'text-emerald-600 bg-emerald-50/30' : subAllDone ? 'text-green-600 bg-green-50/30' : (sub.status === 'draft' || sub.status === 'scheduled') ? 'text-slate-400 bg-slate-50 opacity-70' : 'text-slate-500 bg-slate-50/50'}`}>
                                                                    <div className="flex items-center justify-between">
                                                                        <span>{sub.title}</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            {sub.status === 'draft' && <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">DRAFT</span>}
                                                                            {sub.status === 'scheduled' && sub.publishDate && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock size={10}/>{new Date(sub.publishDate).toLocaleDateString()}</span>}
                                                                            {subTotal > 0 && (
                                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${subAllDone ? 'bg-green-200 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                                                                                    {subCompleted}/{subTotal}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {subTotal > 0 && (
                                                                        <div className="w-full h-0.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                                                                            <div className={`h-full rounded-full transition-all duration-500 ${subAllDone ? 'bg-green-500' : 'bg-emerald-400'}`} style={{ width: `${subTotal > 0 ? (subCompleted / subTotal) * 100 : 0}%` }} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col py-1">
                                                                    {sub.units.map((unit, uIdx) => {
                                                                        const isCurrent = currentUnitId === unit.id;
                                                                        const isCompleted = completedUnits.has(unit.id);
                                                                        const isUnavailable = unit.status === 'draft' || unit.status === 'scheduled';
                                                                        const isUnitExpanded = expandedUnitComponents.has(unit.id);
                                                                        const hasComponents = unit.components && unit.components.length > 0;
                                                                        return (
                                                                            <div key={unit.id}>
                                                                                <div
                                                                                    onClick={() => {
                                                                                        if (!isUnavailable) {
                                                                                            setCurrentUnitId(unit.id);
                                                                                            if (window.innerWidth < 768) setSidebarOpen(false);
                                                                                        }
                                                                                    }}
                                                                                    className={`flex items-start gap-3 px-4 py-2.5 text-sm transition-colors border-l-4
                                                                                        ${isUnavailable ? 'cursor-not-allowed opacity-50 grayscale' : 'cursor-pointer'}
                                                                                        ${isCurrent
                                                                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                                                                                            : isCompleted 
                                                                                                ? 'bg-green-50/60 border-green-400 text-green-700 hover:bg-green-50'
                                                                                                : isUnavailable ? 'border-transparent text-slate-500' : 'border-transparent hover:bg-slate-50 text-slate-600'
                                                                                        }
                                                                                    `}
                                                                                >
                                                                                    <div className="mt-0.5 w-4 h-4 flex-shrink-0">
                                                                                        {isCompleted ? (
                                                                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                                                                        ) : isCurrent ? (
                                                                                            <PlayCircle size={16} className="text-emerald-600" />
                                                                                        ) : (
                                                                                            <Circle size={16} className="text-slate-300" />
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 flex-1 mt-0.5 pr-2">
                                                                                        <span className={`leading-snug flex-1 ${isCurrent ? 'font-bold' : 'font-medium'}`}>{unit.title}</span>
                                                                                        {hasComponents && (
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setExpandedUnitComponents(prev => {
                                                                                                        const next = new Set(prev);
                                                                                                        if (next.has(unit.id)) next.delete(unit.id);
                                                                                                        else next.add(unit.id);
                                                                                                        return next;
                                                                                                    });
                                                                                                }}
                                                                                                className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 transition-colors flex-shrink-0"
                                                                                                title={`${unit.components.length} components`}
                                                                                            >
                                                                                                {isUnitExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                                            </button>
                                                                                        )}
                                                                                        {unit.status === 'draft' && <span className="text-[9px] bg-slate-200 text-slate-500 px-1 py-0.5 rounded font-bold">DRAFT</span>}
                                                                                        {unit.status === 'scheduled' && unit.publishDate && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-bold">{new Date(unit.publishDate).toLocaleDateString()}</span>}
                                                                                    </div>
                                                                                </div>
                                                                                {/* Component preview */}
                                                                                {isUnitExpanded && hasComponents && (
                                                                                    <div className="ml-11 mr-4 mb-2 mt-0.5 space-y-0.5 border-l border-dashed border-slate-200 pl-2">
                                                                                        {unit.components.map((comp, cIdx) => (
                                                                                            <div
                                                                                                key={comp.id}
                                                                                                className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50 rounded cursor-pointer transition-colors"
                                                                                                onClick={() => !isUnavailable && setCurrentUnitId(unit.id)}
                                                                                                title={comp.title || comp.content}
                                                                                            >
                                                                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                                                                    comp.type === 'html' ? 'bg-blue-400' :
                                                                                                    comp.type === 'video' ? 'bg-red-400' :
                                                                                                    comp.type === 'embed' ? 'bg-purple-400' :
                                                                                                    comp.type === 'quiz' ? 'bg-amber-400' : 'bg-slate-400'
                                                                                                }`}></span>
                                                                                                <span className="font-bold uppercase tracking-wider text-[9px] w-8 flex-shrink-0 text-slate-400">
                                                                                                    {comp.type === 'html' ? 'TXT' :
                                                                                                     comp.type === 'video' ? 'VID' :
                                                                                                     comp.type === 'embed' ? 'EMB' :
                                                                                                     comp.type === 'quiz' ? 'QIZ' : comp.type.slice(0,3).toUpperCase()}
                                                                                                </span>
                                                                                                <span className="truncate flex-1 font-medium text-slate-600">
                                                                                                    {comp.title || (comp.type === 'html'
                                                                                                        ? (comp.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').slice(0, 30) || 'Untitled'
                                                                                                        : 'Untitled')}
                                                                                                </span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>
                    </>
                )}

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
                    {/* Announcements Banner */}
                    {announcements.length > 0 && showAnnouncements && (
                        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Megaphone size={14} /> 공지사항
                                </span>
                                <button onClick={() => setShowAnnouncements(false)} className="text-amber-400 hover:text-amber-600"><X size={14} /></button>
                            </div>
                            {announcements.slice(0, 3).map(ann => (
                                <div key={ann.id} className={`text-sm py-1 ${ann.pinned ? 'text-amber-800 font-bold' : 'text-amber-700'}`}>
                                    {ann.pinned && '📌 '}{ann.title}
                                    {ann.content && <span className="text-amber-600 font-normal ml-1 text-xs">— {ann.content.slice(0, 80)}{ann.content.length > 80 ? '...' : ''}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                    {currentUnit ? (
                        <>
                            {/* Top Ribbon (Open edX Style Sequence Bar) */}
                            <div className="h-auto min-h-[50px] bg-slate-50 border-b border-slate-200 px-6 py-2 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                    <span className="truncate max-w-[200px]">{currentUnitMeta?.sectionName}</span>
                                    <ChevronRight size={14} className="text-slate-400" />
                                    <span className="font-bold text-slate-800 truncate max-w-[200px]">{currentUnitMeta?.subsectionName}</span>
                                </div>

                                {/* Unit Ribbon Navigation */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 custom-scrollbar-horizontal">
                                    {currentSubsectionUnits.map((u, i) => {
                                        const isCurrent = u.id === currentUnitId;
                                        const isCompleted = completedUnits.has(u.id);
                                        return (
                                            <button
                                                key={u.id}
                                                onClick={() => setCurrentUnitId(u.id)}
                                                className={`flex items-center justify-center p-2 rounded-md transition-all border
                                                    ${isCurrent
                                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                                                        : isCompleted
                                                            ? 'bg-white border-slate-200 text-slate-400 hover:border-emerald-300'
                                                            : 'bg-white border-transparent hover:bg-slate-100 text-slate-500'
                                                    }
                                                `}
                                                title={u.title}
                                            >
                                                {/* Simple icon based on first component type or generic */}
                                                {u.components[0]?.type === 'video' ? <PlayCircle size={18} /> :
                                                    u.components[0]?.type === 'quiz' ? <ListTodo size={18} /> :
                                                        <FileText size={18} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Content Scroll View */}
                            <div className="flex-1 overflow-y-auto w-full flex justify-center bg-white custom-scrollbar pb-32">
                                <div className="max-w-4xl w-full p-8 md:p-12">

                                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">
                                        {currentUnit.title}
                                    </h1>
                                    {completedUnits.has(currentUnit.id) && (
                                        <div className="mb-8 inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                                            <CheckCircle2 size={14} /> Completed ✓
                                        </div>
                                    )}
                                    {!completedUnits.has(currentUnit.id) && <div className="mb-8" />}

                                    {/* Components Render Stack */}
                                    <div className="space-y-12">
                                        {currentUnit.components.map((comp) => (
                                            <div key={comp.id} className="component-block">

                                                {comp.type === 'html' && (() => {
                                                    // Detect if content is Markdown (vs pure HTML)
                                                    const isMd = /^#|```|\$\$|^\-\s|^\d+\.\s|^>\s|\[.*\]\(.*\)/m.test(comp.content);
                                                    return isMd ? (
                                                        <div className="prose prose-slate prose-lg max-w-none prose-emerald">
                                                            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkGfm, remarkMath]}
                                                                rehypePlugins={[rehypeKatex]}
                                                                components={{
                                                                    code({ className, children, ...props }: any) {
                                                                        const match = /language-(\w+)/.exec(className || '');
                                                                        return match ? (
                                                                            <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto my-4">
                                                                                <code className={className} {...props}>{children}</code>
                                                                            </pre>
                                                                        ) : (
                                                                            <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
                                                                        );
                                                                    },
                                                                    table({ children }: any) { return <table className="border-collapse border border-slate-300 w-full my-4">{children}</table>; },
                                                                    th({ children }: any) { return <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left text-sm font-bold">{children}</th>; },
                                                                    td({ children }: any) { return <td className="border border-slate-300 px-3 py-2 text-sm">{children}</td>; },
                                                                    img({ src, alt }: any) { return <img src={src} alt={alt || ''} className="max-w-full h-auto rounded-lg border border-slate-200 my-4" />; }
                                                                }}
                                                            >
                                                                {comp.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    ) : (
                                                        <div 
                                                            className="prose prose-slate prose-lg max-w-none prose-emerald ck-content" 
                                                            dangerouslySetInnerHTML={{ __html: comp.content }}
                                                        />
                                                    );
                                                })()}

                                                {comp.type === 'video' && (() => {
                                                    const url = comp.content || '';
                                                    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
                                                    const isDirect = /\.(mp4|webm|ogg)(\?|$)/i.test(url);
                                                    const isGDrive = url.includes('drive.google.com');
                                                    
                                                    // Convert Google Drive share link to embed
                                                    const getGDriveEmbedUrl = (u: string) => {
                                                        const match = u.match(/\/d\/([a-zA-Z0-9_-]+)/);
                                                        return match ? `https://drive.google.com/file/d/${match[1]}/preview` : u;
                                                    };

                                                    // YouTube IFrame API with progress tracking
                                                    const YouTubeTracker = ({ embedUrl }: { embedUrl: string }) => {
                                                        const iframeRef = React.useRef<HTMLIFrameElement>(null);
                                                        const [watchPct, setWatchPct] = React.useState(0);
                                                        const [done80, setDone80] = React.useState(false);

                                                        React.useEffect(() => {
                                                            // Use postMessage to communicate with YouTube iframe
                                                            const ytUrl = embedUrl + (embedUrl.includes('?') ? '&' : '?') + 'enablejsapi=1&origin=' + window.location.origin;
                                                            if (iframeRef.current) {
                                                                iframeRef.current.src = ytUrl;
                                                            }

                                                            let polling: ReturnType<typeof setInterval>;

                                                            const handleMessage = (e: MessageEvent) => {
                                                                try {
                                                                    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                                                                    if (data.event === 'infoDelivery' && data.info) {
                                                                        if (data.info.currentTime !== undefined && data.info.duration) {
                                                                            const pct = Math.round((data.info.currentTime / data.info.duration) * 100);
                                                                            setWatchPct(pct);
                                                                            if (pct >= 80 && !done80) {
                                                                                setDone80(true);
                                                                                markUnitCompleted();
                                                                            }
                                                                        }
                                                                    }
                                                                } catch {}
                                                            };

                                                            window.addEventListener('message', handleMessage);

                                                            // Start listening after iframe loads
                                                            const startListening = () => {
                                                                if (iframeRef.current?.contentWindow) {
                                                                    // Tell YouTube to send us updates
                                                                    iframeRef.current.contentWindow.postMessage(JSON.stringify({
                                                                        event: 'listening',
                                                                        id: 1,
                                                                        channel: 'widget'
                                                                    }), '*');
                                                                }
                                                            };

                                                            polling = setInterval(startListening, 3000);

                                                            return () => {
                                                                window.removeEventListener('message', handleMessage);
                                                                clearInterval(polling);
                                                            };
                                                        }, [embedUrl]);

                                                        return (
                                                            <>
                                                                <iframe
                                                                    ref={iframeRef}
                                                                    className="w-full h-full"
                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                    allowFullScreen
                                                                />
                                                                <div className="mt-2 flex items-center gap-2">
                                                                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-300 ${watchPct >= 80 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                                            style={{ width: `${watchPct}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className={`text-[10px] font-bold ${watchPct >= 80 ? 'text-green-600' : 'text-slate-400'}`}>
                                                                        {watchPct >= 80 ? '✅ 시청 완료' : `${watchPct}%`}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        );
                                                    };

                                                    // HTML5 video with progress tracking
                                                    const VideoTracker = ({ src, poster, fallbackUrls }: { src: string; poster?: string; fallbackUrls?: string[] }) => {
                                                        const videoRef = React.useRef<HTMLVideoElement>(null);
                                                        const [watchPct, setWatchPct] = React.useState(0);
                                                        const [done80, setDone80] = React.useState(false);
                                                        
                                                        const handleTimeUpdate = () => {
                                                            if (videoRef.current) {
                                                                const pct = Math.round((videoRef.current.currentTime / videoRef.current.duration) * 100);
                                                                setWatchPct(pct);
                                                                if (pct >= 80 && !done80) {
                                                                    setDone80(true);
                                                                    markUnitCompleted();
                                                                }
                                                            }
                                                        };

                                                        return (
                                                            <>
                                                                <video
                                                                    ref={videoRef}
                                                                    className="w-full h-full"
                                                                    controls
                                                                    poster={poster}
                                                                    preload="metadata"
                                                                    onTimeUpdate={handleTimeUpdate}
                                                                >
                                                                    <source src={src} type={`video/${src.match(/\.(mp4|webm|ogg)/i)?.[1] || 'mp4'}`} />
                                                                    {(fallbackUrls || []).map((fbUrl, fbIdx) => (
                                                                        <source key={fbIdx} src={fbUrl} type={`video/${fbUrl.match(/\.(mp4|webm|ogg)/i)?.[1] || 'mp4'}`} />
                                                                    ))}
                                                                    Your browser does not support the video tag.
                                                                </video>
                                                                <div className="mt-2 flex items-center gap-2">
                                                                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-300 ${watchPct >= 80 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                                            style={{ width: `${watchPct}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className={`text-[10px] font-bold ${watchPct >= 80 ? 'text-green-600' : 'text-slate-400'}`}>
                                                                        {watchPct >= 80 ? '✅ 시청 완료' : `${watchPct}%`}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        );
                                                    };

                                                    return (
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black/5 ring-1 ring-slate-200">
                                                                {isYouTube ? (
                                                                    <div className="w-full h-full flex flex-col">
                                                                        <div className="flex-1">
                                                                            <YouTubeTracker embedUrl={getYouTubeEmbedUrl(url)} />
                                                                        </div>
                                                                    </div>
                                                                ) : isDirect ? (
                                                                    <VideoTracker src={url} poster={comp.thumbnailUrl || undefined} fallbackUrls={comp.fallbackUrls} />
                                                                ) : isGDrive ? (
                                                                    <iframe
                                                                        src={getGDriveEmbedUrl(url)}
                                                                        className="w-full h-full"
                                                                        allow="autoplay; encrypted-media"
                                                                        allowFullScreen
                                                                    />
                                                                ) : url ? (
                                                                    <VideoTracker src={url} poster={comp.thumbnailUrl || undefined} />
                                                                ) : (
                                                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-900">
                                                                        <PlayCircle size={64} className="mb-4 opacity-50" />
                                                                        <p>No video source configured</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {/* Download button */}
                                                            {comp.allowDownload && (isDirect || url) && !isYouTube && (
                                                                <a
                                                                    href={url}
                                                                    download
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="self-end flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                                                                >
                                                                    ⬇ Download Video
                                                                </a>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                {comp.type === 'embed' && (() => {
                                                    const isGoogle = comp.content.includes('docs.google.com') || comp.content.includes('drive.google.com');
                                                    return (
                                                        <div className="w-full space-y-3">
                                                            {/* Toolbar */}
                                                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                                                                <div className="flex items-center gap-2 text-slate-500">
                                                                    {isGoogle ? (
                                                                        <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                                            Google Document
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                                            Embedded Content
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <a
                                                                    href={comp.content}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                                                    Open in New Window
                                                                </a>
                                                            </div>
                                                            {/* 16:9 Embed Frame */}
                                                            <div className="w-full aspect-video bg-white rounded-xl overflow-hidden shadow-lg ring-1 ring-slate-200">
                                                                <iframe
                                                                    src={comp.content}
                                                                    className="w-full h-full border-0"
                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                    allowFullScreen
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {comp.type === 'quiz' && (
                                                    <div className="bg-white border-2 border-emerald-100 rounded-2xl p-8 shadow-sm">
                                                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-emerald-50">
                                                            <div className="flex items-center gap-3">
                                                                <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">
                                                                    <ListTodo size={24} />
                                                                </div>
                                                                <h3 className="text-xl font-bold text-slate-800">{t('knowledge_check')}</h3>
                                                            </div>
                                                            <div className="flex gap-2 flex-wrap">
                                                                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase">{comp.attempts === 0 || !comp.attempts ? t('unlimited') : comp.attempts} {t('attempts')}</span>
                                                                {comp.isGraded ? (
                                                                    <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">📊 성적 반영</span>
                                                                ) : (
                                                                    <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">🏋️ 연습</span>
                                                                )}
                                                                {comp.isGraded && comp.passingScore && (
                                                                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">PASS ≥ {comp.passingScore}%</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Advanced Quiz Rendering Engine */}
                                                        <QuizRenderer 
                                                            content={comp.content}
                                                            componentId={comp.id}
                                                            courseId={courseId}
                                                            quizBankId={comp.quizBankId}
                                                            quizMode={comp.quizMode}
                                                            questionCount={comp.questionCount}
                                                            selectedQuestionIds={comp.selectedQuestionIds}
                                                            reshuffleOnRetry={comp.reshuffleOnRetry}
                                                            isGraded={comp.isGraded}
                                                            passingScore={comp.passingScore}
                                                            maxAttempts={comp.attempts}
                                                            onComplete={(score: number, maxScore: number, answers: any) => {
                                                                console.log("Quiz completed with score:", score, "/", maxScore, "Answers:", answers);
                                                                markUnitCompleted();
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                {comp.type === 'document' && (
                                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                                        <div className="flex items-start gap-4 mb-4">
                                                            <div className="bg-red-50 text-red-500 p-3 rounded-xl shrink-0 mt-1">
                                                                <FileText size={28} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <h3 className="text-xl font-bold text-slate-800">{comp.content.split('/').pop() || 'Document'}</h3>
                                                                {comp.description && (
                                                                    <p className="text-sm text-slate-600 mt-2 p-3 bg-slate-50 border-l-4 border-emerald-500 rounded-r-md">
                                                                        {comp.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {comp.displayMode === 'iframe' ? (
                                                            <div className="w-full h-[600px] border border-slate-200 rounded-xl overflow-hidden mt-6 bg-slate-100 relative">
                                                                {/* Fallback link above the iframe just in case it's blocked */}
                                                                <div className="absolute top-0 right-0 p-2 z-10 bg-white/80 backdrop-blur rounded-bl-lg border-b border-l border-slate-200">
                                                                    <a href={comp.content} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline">Open in new tab</a>
                                                                </div>
                                                                <iframe src={comp.content} className="w-full h-full relative z-0" title="Document Viewer" />
                                                            </div>
                                                        ) : (
                                                            <div className="mt-6 flex">
                                                                <a 
                                                                    href={comp.content} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 bg-slate-800 hover:bg-black text-white font-bold py-3 px-6 rounded-xl transition-all shadow hover:shadow-lg"
                                                                >
                                                                    Download Document
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                <div className="my-10 border-b border-slate-100 w-full" />
                                            </div>
                                        ))}

                                        {/* End of content marker */}
                                        <div className="flex flex-col flex-wrap gap-4 items-center justify-between pt-8 mt-12 mb-32 border-t border-slate-200 sm:flex-row">
                                            <button
                                                onClick={() => {
                                                    markUnitCompleted();
                                                    if (prevUnitId) setCurrentUnitId(prevUnitId);
                                                }}
                                                disabled={!prevUnitId}
                                                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${prevUnitId ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                                            >
                                                <ArrowLeft size={18} /> {t('previous')}
                                            </button>

                                            {!completedUnits.has(currentUnit.id) && (
                                                <button
                                                    onClick={markUnitCompleted}
                                                    className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-6 py-3 rounded-lg font-bold transition-all shadow-sm"
                                                >
                                                    {t('mark_completed')}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    markUnitCompleted();
                                                    if (nextUnitId) setCurrentUnitId(nextUnitId);
                                                }}
                                                disabled={!nextUnitId}
                                                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${nextUnitId ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' : 'bg-emerald-100 text-emerald-300 cursor-not-allowed'}`}
                                            >
                                                {t('next_unit')} <ArrowRight size={18} />
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
                            <BookOpen size={64} className="opacity-20" />
                            <p className="text-lg">{t('no_content')}</p>
                        </div>
                    )}
                </main>
            </div>
            {/* Global style for markdown rendering and scrollbars inside the component */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

                .custom-scrollbar-horizontal::-webkit-scrollbar { height: 6px; }
                .custom-scrollbar-horizontal::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-horizontal::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                
                /* Markdown overrides */
                .prose h1, .prose h2, .prose h3 { color: #0f172a !important; font-weight: 800 !important; tracking:-0.025em; margin-bottom: 1rem; }
                .prose p { color: #334155; line-height: 1.8; margin-bottom: 1.5rem; font-size: 1.1rem; }
                .prose strong { color: #0f172a; font-weight: 700; }
                .prose ul, .prose ol { color: #334155; font-size: 1.1rem; line-height: 1.8; }
                .prose li { margin-bottom: 0.5rem; }
                .prose a { color: #10b981; text-decoration: none; font-weight: 600; border-bottom: 2px solid #a7f3d0; transition: all 0.2s; }
                .prose a:hover { border-bottom-color: #10b981; }
                .prose blockquote { border-left-color: #10b981; background: #ecfdf5; padding: 1rem 1.5rem; border-radius: 0 0.5rem 0.5rem 0; font-style: italic; color: #065f46; margin: 2rem 0; }
            `}} />
        </div>
    );
}
