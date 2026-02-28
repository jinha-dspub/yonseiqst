"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ChevronRight, ChevronDown, Plus,
    BookOpen, Layers, FileText, ArrowLeft, Trash2
} from 'lucide-react';
import { Course, Section, Subsection, Unit, UnitComponent, ComponentType } from '@/lib/lms/types';

export default function CourseOutlineEditor() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.id as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [mounted, setMounted] = useState(false);

    // UI State for expanded nodes
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [expandedSubsections, setExpandedSubsections] = useState<Set<string>>(new Set());

    // Inline Editing states
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editBuffer, setEditBuffer] = useState<string>('');

    // UI state for selected item
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        const saved = sessionStorage.getItem('lms_courses_db');
        if (saved) {
            const courses: Course[] = JSON.parse(saved);
            const found = courses.find(c => c.id === courseId);
            if (found) {
                setCourse(found);
                // Auto expand first section/subsection
                if (found.sections.length > 0) {
                    setExpandedSections(new Set([found.sections[0].id]));
                    if (found.sections[0].subsections.length > 0) {
                        setExpandedSubsections(new Set([found.sections[0].subsections[0].id]));
                    }
                }
            } else {
                router.push('/cms');
            }
        } else {
            router.push('/cms');
        }
    }, [courseId, router]);

    const saveCourse = (updatedCourse: Course) => {
        setCourse(updatedCourse);
        const saved = sessionStorage.getItem('lms_courses_db');
        if (saved) {
            const courses: Course[] = JSON.parse(saved);
            const newCourses = courses.map(c => c.id === courseId ? updatedCourse : c);
            sessionStorage.setItem('lms_courses_db', JSON.stringify(newCourses));
        }
    };

    const toggleSection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedSections);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedSections(next);
    };

    const toggleSubsection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedSubsections);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedSubsections(next);
    };

    const startEditing = (id: string, currentTitle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingNodeId(id);
        setEditBuffer(currentTitle);
    };

    const commitSectionEdit = (sectionIdx: number) => {
        if (!course) return;
        if (editBuffer.trim() === '') {
            setEditingNodeId(null);
            return;
        }
        const newSections = [...course.sections];
        newSections[sectionIdx].title = editBuffer.trim();
        saveCourse({ ...course, sections: newSections });
        setEditingNodeId(null);
    };

    const commitSubsectionEdit = (sectionIdx: number, subIdx: number) => {
        if (!course) return;
        if (editBuffer.trim() === '') {
            setEditingNodeId(null);
            return;
        }
        const newSections = [...course.sections];
        newSections[sectionIdx].subsections[subIdx].title = editBuffer.trim();
        saveCourse({ ...course, sections: newSections });
        setEditingNodeId(null);
    };

    if (!mounted || !course) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans"><div className="animate-pulse text-slate-400 font-medium tracking-widest uppercase">Loading Outline...</div></div>;

    // Helper to find the selected unit for the right pane
    let selectedUnitData: Unit | null = null;
    let selectedSubIdx = -1;
    let selectedSecIdx = -1;
    let selectedUnitIdx = -1;

    if (selectedUnitId && course) {
        for (let i = 0; i < course.sections.length; i++) {
            for (let j = 0; j < course.sections[i].subsections.length; j++) {
                const uIdx = course.sections[i].subsections[j].units.findIndex(u => u.id === selectedUnitId);
                if (uIdx > -1) {
                    selectedUnitData = course.sections[i].subsections[j].units[uIdx];
                    selectedSecIdx = i;
                    selectedSubIdx = j;
                    selectedUnitIdx = uIdx;
                    break;
                }
            }
            if (selectedUnitData) break;
        }
    }

    const updateComponent = (compId: string, updates: Partial<UnitComponent>) => {
        if (!course || selectedSecIdx === -1) return;
        const newSections = [...course.sections];
        const unit = newSections[selectedSecIdx].subsections[selectedSubIdx].units[selectedUnitIdx];
        const compIdx = unit.components.findIndex(c => c.id === compId);
        if (compIdx > -1) {
            unit.components[compIdx] = { ...unit.components[compIdx], ...updates };
            saveCourse({ ...course, sections: newSections });
        }
    };

    const deleteComponent = (compId: string) => {
        if (!course || selectedSecIdx === -1) return;
        const newSections = [...course.sections];
        const unit = newSections[selectedSecIdx].subsections[selectedSubIdx].units[selectedUnitIdx];
        unit.components = unit.components.filter(c => c.id !== compId);
        saveCourse({ ...course, sections: newSections });
    };

    const addComponent = (type: ComponentType) => {
        if (!course || selectedSecIdx === -1) return;
        const newSections = [...course.sections];
        const unit = newSections[selectedSecIdx].subsections[selectedSubIdx].units[selectedUnitIdx];
        const newComp: UnitComponent = {
            id: `comp-${Date.now()}`,
            title: `New ${type.toUpperCase()} Component`,
            type,
            content: '',
            ...(type === 'quiz' ? { weight: 1.0, attempts: 1, showAnswer: 'answered' } : {})
        };
        unit.components.push(newComp);
        saveCourse({ ...course, sections: newSections });
    };

    return (
        <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
            {/* Topbar */}
            <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <Link href="/cms" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                        <ArrowLeft size={18} />
                    </Link>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-emerald-600" />
                        <span className="font-semibold text-slate-800 text-sm truncate max-w-md">{course.title}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded">Outline Editor</span>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex flex-1 overflow-hidden h-full">
                {/* Outline Sidebar (Left) */}
                <aside className="w-[380px] bg-white border-r border-slate-200 flex flex-col shrink-0">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h2 className="font-bold text-slate-700 text-sm tracking-wide uppercase flex items-center gap-2">
                            Course Outline
                        </h2>
                        <button
                            className="bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-2 py-1 rounded flex items-center gap-1 text-xs font-bold transition-colors"
                            onClick={() => {
                                const newSec: Section = {
                                    id: `sec-${Date.now()}`,
                                    title: `New Section ${course.sections.length + 1}`,
                                    status: 'draft',
                                    subsections: []
                                };
                                saveCourse({ ...course, sections: [...course.sections, newSec] });
                            }}
                        >
                            <Plus size={14} /> Section
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 outline-tree custom-scrollbar">
                        {course.sections.length === 0 && (
                            <div className="text-center py-12 text-slate-400 text-sm">
                                <div>No sections yet.</div>
                                <div className="mt-1">Click the + Section button to begin.</div>
                            </div>
                        )}
                        {course.sections.map((section, sIdx) => {
                            const isSecExpanded = expandedSections.has(section.id);
                            return (
                                <div key={section.id} className="mb-3">
                                    {/* Section Item */}
                                    <div
                                        className="group flex items-center gap-1.5 p-2 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-700 transition-colors border border-transparent hover:border-slate-200"
                                        onClick={(e) => toggleSection(section.id, e)}
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                                            {isSecExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </div>
                                        <Layers size={15} className="text-indigo-500 opacity-90" />
                                        <div className="flex flex-col flex-1 truncate pl-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">Section</span>
                                            {editingNodeId === section.id ? (
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={editBuffer}
                                                    onChange={(e) => setEditBuffer(e.target.value)}
                                                    onBlur={() => commitSectionEdit(sIdx)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') commitSectionEdit(sIdx);
                                                        if (e.key === 'Escape') setEditingNodeId(null);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="font-bold text-sm bg-white border border-emerald-500 rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                />
                                            ) : (
                                                <span
                                                    className="font-bold text-sm truncate select-none leading-none border border-transparent rounded px-1 -mx-1 hover:border-slate-300 transition-colors"
                                                    onDoubleClick={(e) => startEditing(section.id, section.title, e)}
                                                    title="Double click to edit title"
                                                >
                                                    {section.title}
                                                </span>
                                            )}
                                        </div>

                                        {/* Section Actions */}
                                        <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                                            <button
                                                className="w-7 h-7 rounded-md hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm text-slate-500 flex items-center justify-center transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newSub: Subsection = {
                                                        id: `subsec-${Date.now()}`,
                                                        title: `New Subsection`,
                                                        status: 'draft',
                                                        units: []
                                                    };
                                                    const newSections = [...course.sections];
                                                    newSections[sIdx].subsections.push(newSub);
                                                    saveCourse({ ...course, sections: newSections });
                                                    setExpandedSections(new Set([...expandedSections, section.id]));
                                                }}
                                                title="Add Subsection"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Subsections */}
                                    {isSecExpanded && (
                                        <div className="ml-6 border-l-2 border-slate-100 pl-2 mt-1 space-y-1">
                                            {section.subsections.length === 0 && (
                                                <div className="text-xs text-slate-400 p-2 italic bg-slate-50 rounded-md border border-slate-100/50">Empty section</div>
                                            )}
                                            {section.subsections.map((subsec, ssIdx) => {
                                                const isSubExpanded = expandedSubsections.has(subsec.id);
                                                return (
                                                    <div key={subsec.id}>
                                                        {/* Subsection Item */}
                                                        <div
                                                            className="group flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-600 transition-colors"
                                                            onClick={(e) => toggleSubsection(subsec.id, e)}
                                                        >
                                                            <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                                                                {isSubExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                            </div>
                                                            <div className="flex flex-col flex-1 truncate pl-1">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">Subsection</span>
                                                                {editingNodeId === subsec.id ? (
                                                                    <input
                                                                        type="text"
                                                                        autoFocus
                                                                        value={editBuffer}
                                                                        onChange={(e) => setEditBuffer(e.target.value)}
                                                                        onBlur={() => commitSubsectionEdit(sIdx, ssIdx)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') commitSubsectionEdit(sIdx, ssIdx);
                                                                            if (e.key === 'Escape') setEditingNodeId(null);
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="font-semibold text-sm bg-white border border-emerald-500 rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                    />
                                                                ) : (
                                                                    <span
                                                                        className="font-semibold text-sm truncate select-none leading-none border border-transparent rounded px-1 -mx-1 hover:border-slate-300 transition-colors"
                                                                        onDoubleClick={(e) => startEditing(subsec.id, subsec.title, e)}
                                                                        title="Double click to edit title"
                                                                    >
                                                                        {subsec.title}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                                                                <button
                                                                    className="w-6 h-6 rounded-md hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm text-slate-500 flex items-center justify-center transition-all"
                                                                    title="Add Unit"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const newUnit: Unit = {
                                                                            id: `unit-${Date.now()}`,
                                                                            title: `New Unit`,
                                                                            status: 'draft',
                                                                            components: []
                                                                        };
                                                                        const newSections = [...course.sections];
                                                                        newSections[sIdx].subsections[ssIdx].units.push(newUnit);
                                                                        saveCourse({ ...course, sections: newSections });
                                                                        setExpandedSubsections(new Set([...expandedSubsections, subsec.id]));
                                                                    }}
                                                                >
                                                                    <Plus size={14} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Units */}
                                                        {isSubExpanded && (
                                                            <div className="ml-5 pl-2 mt-1 space-y-0.5 relative before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-slate-200">
                                                                {subsec.units.length === 0 && (
                                                                    <div className="text-xs text-slate-400 p-2 italic">No units inside</div>
                                                                )}
                                                                {subsec.units.map(unit => {
                                                                    const isSelected = selectedUnitId === unit.id;
                                                                    return (
                                                                        <div
                                                                            key={unit.id}
                                                                            onClick={() => setSelectedUnitId(unit.id)}
                                                                            className={`
                                                                                group relative flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all text-sm
                                                                                ${isSelected
                                                                                    ? 'bg-emerald-50 text-emerald-800 shadow-sm border border-emerald-100'
                                                                                    : 'hover:bg-slate-100 text-slate-600 border border-transparent'}
                                                                            `}
                                                                        >
                                                                            {/* Custom line connector for unit */}
                                                                            <div className="absolute left-[-9px] w-2 h-px bg-slate-200"></div>

                                                                            <FileText size={14} className={isSelected ? 'text-emerald-500' : 'text-slate-400'} />
                                                                            <span className={`flex-1 truncate select-none ${isSelected ? 'font-bold' : 'font-medium'}`}>
                                                                                {unit.title}
                                                                            </span>
                                                                            {unit.status === 'draft' && (
                                                                                <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded flex-shrink-0 font-bold">DRAFT</span>
                                                                            )}
                                                                            {unit.status === 'published' && (
                                                                                <span className="text-[9px] bg-slate-100 text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded flex-shrink-0 font-bold">PUB</span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* Main Editor Area (Right) */}
                <main className="flex-1 bg-slate-50 overflow-y-auto">
                    {selectedUnitData ? (
                        <div className="max-w-4xl mx-auto p-8 pb-32">
                            {/* Unit Header editable area */}
                            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
                                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1">
                                            <FileText size={14} />
                                            Editing Unit
                                        </div>
                                        <div className="text-xs text-slate-400 font-mono">ID: {selectedUnitData.id}</div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2">Visibility:</label>
                                        <select
                                            className="text-sm font-medium border border-slate-200 shadow-sm rounded px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                            value={selectedUnitData.status}
                                            onChange={(e) => {
                                                const newSections = [...course.sections];
                                                for (let i = 0; i < newSections.length; i++) {
                                                    for (let j = 0; j < newSections[i].subsections.length; j++) {
                                                        const unitIdx = newSections[i].subsections[j].units.findIndex(u => u.id === selectedUnitId);
                                                        if (unitIdx > -1) {
                                                            newSections[i].subsections[j].units[unitIdx].status = e.target.value as any;
                                                            saveCourse({ ...course, sections: newSections });
                                                            return;
                                                        }
                                                    }
                                                }
                                            }}
                                        >
                                            <option value="draft">Draft (Hidden from students)</option>
                                            <option value="published">Published (Visible)</option>
                                        </select>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    className="w-full text-3xl font-black text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 placeholder-slate-300"
                                    value={selectedUnitData.title}
                                    placeholder="Enter Unit Title here..."
                                    onChange={(e) => {
                                        const newSections = [...course.sections];
                                        for (let i = 0; i < newSections.length; i++) {
                                            for (let j = 0; j < newSections[i].subsections.length; j++) {
                                                const unitIdx = newSections[i].subsections[j].units.findIndex(u => u.id === selectedUnitId);
                                                if (unitIdx > -1) {
                                                    newSections[i].subsections[j].units[unitIdx].title = e.target.value;
                                                    saveCourse({ ...course, sections: newSections });
                                                    return;
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>

                            {/* Components list */}
                            <div className="space-y-6 relative">
                                {/* Visual vertical line connecting blocks */}
                                <div className="absolute left-8 top-0 bottom-0 w-1 bg-slate-200/50 -z-10 rounded-full"></div>

                                {selectedUnitData.components.length === 0 ? (
                                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center shadow-inner relative z-10">
                                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400 shadow-sm border border-slate-100">
                                            <Layers size={40} className="text-emerald-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-700 mb-2">Build Your Lesson</h3>
                                        <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
                                            Units are composed of stacked vertical blocks in Open edX. Add Markdown, Videos, or interactive Quizzes below to begin.
                                        </p>
                                    </div>
                                ) : (
                                    selectedUnitData.components.map((comp, idx) => (
                                        <div key={comp.id} className="bg-white border border-slate-200 rounded-xl shadow-sm relative z-10 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                                            {/* Block Header */}
                                            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 font-mono text-xs font-bold shadow-sm">
                                                        {idx + 1}
                                                    </div>
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border
                                                        ${comp.type === 'html' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                                        ${comp.type === 'video' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                                                        ${comp.type === 'quiz' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''}
                                                    `}>
                                                        {comp.type} Component
                                                    </span>
                                                    <input
                                                        type="text"
                                                        value={comp.title}
                                                        onChange={(e) => updateComponent(comp.id, { title: e.target.value })}
                                                        placeholder="Component Title"
                                                        className="font-semibold text-slate-700 text-sm bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Are you sure you want to delete this component?')) {
                                                            deleteComponent(comp.id);
                                                        }
                                                    }}
                                                    className="text-slate-400 hover:text-rose-500 transition-colors bg-white p-1.5 rounded-md border border-transparent hover:border-rose-200 hover:bg-rose-50"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* Block Body Editor Forms */}
                                            <div className="p-6">
                                                {comp.type === 'html' && (
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Markdown Content</label>
                                                        <textarea
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[150px] font-mono"
                                                            value={comp.content}
                                                            onChange={(e) => updateComponent(comp.id, { content: e.target.value })}
                                                            placeholder="# Heading 1&#10;Write your markdown here..."
                                                        />
                                                    </div>
                                                )}

                                                {comp.type === 'video' && (
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Video URL (YouTube)</label>
                                                        <input
                                                            type="text"
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                                            value={comp.content}
                                                            onChange={(e) => updateComponent(comp.id, { content: e.target.value })}
                                                            placeholder="https://youtube.com/watch?v=..."
                                                        />
                                                    </div>
                                                )}

                                                {comp.type === 'quiz' && (
                                                    <div className="flex flex-col gap-4">
                                                        <div className="flex flex-col gap-2">
                                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Problem Text (Markdown)</label>
                                                            <textarea
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 min-h-[100px] font-mono"
                                                                value={comp.content}
                                                                onChange={(e) => updateComponent(comp.id, { content: e.target.value })}
                                                                placeholder="Enter the quiz question here..."
                                                            />
                                                        </div>

                                                        {/* Open edX Metadata */}
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 border border-slate-200 rounded-lg">
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weight (Points)</label>
                                                                <input
                                                                    type="number" min="0" step="0.5"
                                                                    className="bg-white border border-slate-200 rounded p-2 text-sm text-slate-700 focus:outline-none focus:border-purple-500"
                                                                    value={comp.weight !== undefined ? comp.weight : 1.0}
                                                                    onChange={(e) => updateComponent(comp.id, { weight: parseFloat(e.target.value) || 0 })}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max Attempts</label>
                                                                <input
                                                                    type="number" min="0" step="1"
                                                                    className="bg-white border border-slate-200 rounded p-2 text-sm text-slate-700 focus:outline-none focus:border-purple-500"
                                                                    value={comp.attempts !== undefined ? comp.attempts : 1}
                                                                    onChange={(e) => updateComponent(comp.id, { attempts: parseInt(e.target.value, 10) || 0 })}
                                                                    placeholder="0 = Unlimited"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Show Answer To Learners</label>
                                                                <select
                                                                    className="bg-white border border-slate-200 rounded p-2 text-sm text-slate-700 focus:outline-none focus:border-purple-500"
                                                                    value={comp.showAnswer || 'answered'}
                                                                    onChange={(e) => updateComponent(comp.id, { showAnswer: e.target.value as any })}
                                                                >
                                                                    <option value="always">Always</option>
                                                                    <option value="answered">Answered</option>
                                                                    <option value="attempted">Attempted</option>
                                                                    <option value="never">Never</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}

                                {/* Add Component Action Bar */}
                                <div className="pt-6 flex justify-center gap-3 relative z-10">
                                    <button
                                        onClick={() => addComponent('html')}
                                        className="bg-white border-2 border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-600 font-bold px-5 py-3 rounded-xl flex items-center gap-2 text-sm transition-all shadow-sm hover:shadow-md"
                                    >
                                        <Plus size={18} /> HTML Text
                                    </button>
                                    <button
                                        onClick={() => addComponent('video')}
                                        className="bg-white border-2 border-slate-200 hover:border-red-500 hover:text-red-600 text-slate-600 font-bold px-5 py-3 rounded-xl flex items-center gap-2 text-sm transition-all shadow-sm hover:shadow-md"
                                    >
                                        <Plus size={18} /> Video
                                    </button>
                                    <button
                                        onClick={() => addComponent('quiz')}
                                        className="bg-white border-2 border-slate-200 hover:border-purple-500 hover:text-purple-600 text-slate-600 font-bold px-5 py-3 rounded-xl flex items-center gap-2 text-sm transition-all shadow-sm hover:shadow-md"
                                    >
                                        <Plus size={18} /> Problem (Quiz)
                                    </button>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
                            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
                                <BookOpen size={48} className="text-slate-300" />
                            </div>
                            <p className="font-medium text-slate-500">Select a Unit directly from the Outline sidebar to start editing.</p>
                        </div>
                    )}
                </main>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}} />
        </div>
    );
}
