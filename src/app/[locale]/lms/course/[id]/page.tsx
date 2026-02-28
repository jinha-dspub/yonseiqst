"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ChevronRight, ChevronDown, BookOpen, Menu,
    CheckCircle2, Circle, PlayCircle, FileText, ListTodo, ArrowLeft, ArrowRight
} from 'lucide-react';
import { Course, Section, Subsection, Unit, UnitComponent } from '@/lib/lms/types';
import { getMockCourse } from '@/lib/lms/mockData';
import ReactMarkdown from 'react-markdown';

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
    const courseId = params.id as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [mounted, setMounted] = useState(false);

    // UI Navigation State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    // Core Learning Position
    const [currentUnitId, setCurrentUnitId] = useState<string | null>(null);

    // Track completed units (mock progress)
    const [completedUnits, setCompletedUnits] = useState<Set<string>>(new Set());

    useEffect(() => {
        setMounted(true);
        let saved = sessionStorage.getItem('lms_courses_db');
        if (!saved) {
            // Auto-fallback for testing if they didn't visit CMS first
            saved = JSON.stringify([getMockCourse()]);
            sessionStorage.setItem('lms_courses_db', saved);
        }

        if (saved) {
            const courses: Course[] = JSON.parse(saved);
            // Filter out draft content across the entire tree
            const rawCourse = courses.find(c => c.id === courseId);

            if (rawCourse && rawCourse.status === 'published') {
                // Deep filter drafts
                const publishedCourse: Course = {
                    ...rawCourse,
                    sections: rawCourse.sections
                        .filter(s => s.status === 'published')
                        .map(s => ({
                            ...s,
                            subsections: s.subsections
                                .filter(sub => sub.status === 'published')
                                .map(sub => ({
                                    ...sub,
                                    units: sub.units.filter(u => u.status === 'published')
                                }))
                        }))
                };

                setCourse(publishedCourse);

                // Set initial position to the very first unit
                if (publishedCourse.sections.length > 0) {
                    setExpandedSections(new Set([publishedCourse.sections[0].id]));
                    for (const sec of publishedCourse.sections) {
                        for (const sub of sec.subsections) {
                            if (sub.units.length > 0) {
                                setCurrentUnitId(sub.units[0].id);
                                return;
                            }
                        }
                    }
                }
            } else {
                router.push('/dashboard');
            }
        } else {
            router.push('/dashboard');
        }
    }, [courseId, router]);

    const toggleSection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedSections);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedSections(next);
    };

    const markUnitCompleted = () => {
        if (currentUnitId) {
            setCompletedUnits(new Set([...completedUnits, currentUnitId]));
        }
    };

    if (!mounted || !course) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-pulse font-bold text-slate-400">LOADING COURSE...</div></div>;

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
                    <Link href="/lms" className="font-bold flex items-center gap-2 hover:text-emerald-400 transition-colors">
                        <ArrowLeft size={16} /> Course Catalog
                    </Link>
                    <div className="h-4 w-px bg-slate-600"></div>
                    <span className="font-semibold text-slate-300 text-sm truncate max-w-md hidden md:block">{course.title}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-xs bg-slate-800 text-emerald-400 px-3 py-1 rounded-full font-bold">
                        {completedUnits.size} / {allUnits.length} Completed
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden h-full">
                {/* Left Sidebar (Course Outline) */}
                {sidebarOpen && (
                    <aside className="w-[320px] bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto custom-scrollbar shadow-inner z-10 transition-all">
                        <div className="p-6">
                            <h2 className="font-bold text-slate-800 tracking-tight text-lg mb-4">Course Progress</h2>

                            <div className="space-y-4">
                                {course.sections.map((section, sIdx) => {
                                    const isExpanded = expandedSections.has(section.id);
                                    return (
                                        <div key={section.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                                            {/* Section Header */}
                                            <div
                                                className="bg-slate-100/50 p-4 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-emerald-50/50 transition-colors"
                                                onClick={(e) => toggleSection(section.id, e)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Section {sIdx + 1}</span>
                                                    <span className="font-bold text-slate-800 text-sm">{section.title}</span>
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
                                                        return (
                                                            <div key={sub.id} className="border-b border-slate-100 last:border-0">
                                                                <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${isSubActive ? 'text-emerald-600 bg-emerald-50/30' : 'text-slate-500 bg-slate-50/50'}`}>
                                                                    {sub.title}
                                                                </div>
                                                                <div className="flex flex-col py-1">
                                                                    {sub.units.map((unit, uIdx) => {
                                                                        const isCurrent = currentUnitId === unit.id;
                                                                        const isCompleted = completedUnits.has(unit.id);
                                                                        return (
                                                                            <div
                                                                                key={unit.id}
                                                                                onClick={() => setCurrentUnitId(unit.id)}
                                                                                className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors border-l-4
                                                                                    ${isCurrent
                                                                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                                                                                        : 'border-transparent hover:bg-slate-50 text-slate-600'
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
                                                                                <span className={`leading-snug ${isCurrent ? 'font-bold' : 'font-medium'}`}>{unit.title}</span>
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
                )}

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
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

                                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-10 tracking-tight">
                                        {currentUnit.title}
                                    </h1>

                                    {/* Components Render Stack */}
                                    <div className="space-y-12">
                                        {currentUnit.components.map((comp) => (
                                            <div key={comp.id} className="component-block">

                                                {comp.type === 'html' && (
                                                    <div className="prose prose-slate prose-lg max-w-none prose-emerald">
                                                        <ReactMarkdown>{comp.content}</ReactMarkdown>
                                                    </div>
                                                )}

                                                {comp.type === 'video' && (
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black/5 ring-1 ring-slate-200">
                                                            {comp.content.includes('youtube') || comp.content.includes('youtu.be') ? (
                                                                <iframe
                                                                    src={getYouTubeEmbedUrl(comp.content)}
                                                                    className="w-full h-full"
                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                    allowFullScreen
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-900">
                                                                    <PlayCircle size={64} className="mb-4 opacity-50" />
                                                                    <p>Video Source: {comp.content}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {comp.type === 'quiz' && (
                                                    <div className="bg-white border-2 border-emerald-100 rounded-2xl p-8 shadow-sm">
                                                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-emirald-50">
                                                            <div className="flex items-center gap-3">
                                                                <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">
                                                                    <ListTodo size={24} />
                                                                </div>
                                                                <h3 className="text-xl font-bold text-slate-800">Knowledge Check</h3>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase">{comp.weight || 1} Points</span>
                                                                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase">{comp.attempts || 'Unlimited'} Attempts</span>
                                                            </div>
                                                        </div>

                                                        <div className="prose prose-slate max-w-none mb-8">
                                                            <ReactMarkdown>{comp.content || '*Question content missing*'}</ReactMarkdown>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {['Option A', 'Option B', 'Option C', 'Option D'].map((opt, i) => (
                                                                <button key={i} className="text-left px-5 py-4 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all font-medium text-slate-700">
                                                                    {opt}
                                                                </button>
                                                            ))}
                                                        </div>

                                                        <div className="mt-8 flex justify-end">
                                                            <button
                                                                onClick={() => {
                                                                    alert("Submit functionality implies backend grading. Simulated success.");
                                                                    markUnitCompleted();
                                                                }}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl shadow-sm transition-colors"
                                                            >
                                                                Submit Answer
                                                            </button>
                                                        </div>
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
                                                <ArrowLeft size={18} /> Previous
                                            </button>

                                            {!completedUnits.has(currentUnit.id) && (
                                                <button
                                                    onClick={markUnitCompleted}
                                                    className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-6 py-3 rounded-lg font-bold transition-all shadow-sm"
                                                >
                                                    Mark as Completed
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
                                                Next Unit <ArrowRight size={18} />
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
                            <BookOpen size={64} className="opacity-20" />
                            <p className="text-lg">No content available to view.</p>
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
