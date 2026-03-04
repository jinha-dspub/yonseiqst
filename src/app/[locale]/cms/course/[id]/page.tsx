"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import {
    ChevronRight, ChevronDown, Plus, Settings, X, Calendar, Clock,
    BookOpen, Layers, FileText, ArrowLeft, Trash2, Eye, Edit3, Upload,
    Bold, Italic, Link as LinkIcon, List as ListIcon, Image as ImageIcon, Globe,
    ArrowUp, ArrowDown, ChevronUp, Search, Megaphone, Pin, Save
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MediaLibrarySelector from '@/components/cms/MediaLibrarySelector';
import { Course, Section, Subsection, Unit, UnitComponent, ComponentType } from '@/lib/lms/types';
import RichTextEditorWrapper from '@/components/RichTextEditorWrapper';
import QuizBuilder from '@/components/cms/QuizBuilder';
import GradingPanel from '@/components/cms/GradingPanel';
import { getCourseById, saveCourseToDb } from '@/lib/courseService';
import { createClient } from "@/lib/supabaseClient";

// ─── QuizBankPicker Component ────────────────────────────────────────
function QuizBankPicker({ comp, updateComponent }: { comp: UnitComponent; updateComponent: (id: string, updates: Partial<UnitComponent>) => void }) {
    const supabase = createClient();
    const [banks, setBanks] = useState<any[]>([]);
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const { data: banksData } = await supabase
                .from('question_banks')
                .select('*')
                .order('created_at', { ascending: false });

            if (banksData) {
                const withCounts = await Promise.all(banksData.map(async (b) => {
                    const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('bank_id', b.id);
                    return { ...b, questionCount: count || 0 };
                }));
                setBanks(withCounts);
            }
            setLoading(false);
        })();
    }, []);

    useEffect(() => {
        if (comp.quizBankId && comp.quizBankId !== '_pending') {
            (async () => {
                const { data } = await supabase
                    .from('questions')
                    .select('*')
                    .eq('bank_id', comp.quizBankId)
                    .order('sort_order', { ascending: true });
                setQuestions(data || []);
            })();
        } else {
            setQuestions([]);
        }
    }, [comp.quizBankId]);

    const toggleSelectedQuestion = (qId: string) => {
        const current = comp.selectedQuestionIds || [];
        const updated = current.includes(qId) ? current.filter(id => id !== qId) : [...current, qId];
        updateComponent(comp.id, { selectedQuestionIds: updated });
    };

    if (loading) return <div className="text-sm text-slate-400 p-4">Loading banks...</div>;

    return (
        <div className="flex flex-col gap-4">
            {/* Bank Selector */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <label className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2 block">📚 문제은행 선택</label>
                <select
                    className="w-full p-3 bg-white border border-purple-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-purple-500"
                    value={comp.quizBankId === '_pending' ? '' : (comp.quizBankId || '')}
                    onChange={(e) => updateComponent(comp.id, { quizBankId: e.target.value || '_pending', selectedQuestionIds: [] })}
                >
                    <option value="">문제은행 선택...</option>
                    {banks.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.questionCount}문제)</option>
                    ))}
                </select>
            </div>

            {/* Question Mode */}
            {comp.quizBankId && comp.quizBankId !== '_pending' && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">출제 방식</label>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                            { mode: 'all' as const, label: '전체 출제', desc: `${questions.length}문제 모두` },
                            { mode: 'random' as const, label: '랜덤 출제', desc: 'N문제 무작위' },
                            { mode: 'select' as const, label: '선택 출제', desc: '특정 문제만' },
                        ].map(m => (
                            <button
                                key={m.mode}
                                onClick={() => updateComponent(comp.id, { quizMode: m.mode })}
                                className={`p-3 rounded-lg text-center transition-all border-2 ${comp.quizMode === m.mode
                                    ? 'bg-purple-50 border-purple-500 text-purple-700'
                                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}
                            >
                                <div className="text-sm font-bold">{m.label}</div>
                                <div className="text-[10px] mt-0.5">{m.desc}</div>
                            </button>
                        ))}
                    </div>

                    {/* Random Mode Options */}
                    {comp.quizMode === 'random' && (
                        <div className="flex flex-col gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-500 min-w-[80px]">문제 수</label>
                                <input
                                    type="number" min="1" max={questions.length}
                                    className="w-24 p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-purple-500"
                                    value={comp.questionCount || Math.min(10, questions.length)}
                                    onChange={(e) => updateComponent(comp.id, { questionCount: parseInt(e.target.value) || 1 })}
                                />
                                <span className="text-xs text-slate-400">/ {questions.length}문제 중</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => updateComponent(comp.id, { reshuffleOnRetry: !comp.reshuffleOnRetry })}
                                    className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${comp.reshuffleOnRetry ? 'bg-purple-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${comp.reshuffleOnRetry ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                                <div>
                                    <span className="text-xs font-bold text-slate-700">{comp.reshuffleOnRetry ? '매번 다른 문제' : '같은 문제 유지'}</span>
                                    <p className="text-[10px] text-slate-400">{comp.reshuffleOnRetry ? '재시도할 때마다 새로운 랜덤 문제' : '처음 선택된 문제가 고정'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Question Preview / Selection */}
                    <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {comp.quizMode === 'select' ? `문제 선택 (${(comp.selectedQuestionIds || []).length}/${questions.length})` : `문제 미리보기 (${questions.length})`}
                            </span>
                        </div>
                        <div className="max-h-[250px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                            {questions.map((q, idx) => {
                                const isSelected = comp.quizMode === 'select' ? (comp.selectedQuestionIds || []).includes(q.id) : true;
                                return (
                                    <div
                                        key={q.id}
                                        className={`p-2.5 flex items-start gap-2 cursor-pointer hover:bg-slate-50 transition-colors ${!isSelected && comp.quizMode === 'select' ? 'opacity-40' : ''}`}
                                        onClick={() => comp.quizMode === 'select' && toggleSelectedQuestion(q.id)}
                                    >
                                        {comp.quizMode === 'select' && (
                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-300'}`}>
                                                {isSelected && <span className="text-white text-[8px] font-bold">✓</span>}
                                            </div>
                                        )}
                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-bold">{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className={`text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${q.type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' :
                                                    q.type === 'short_answer' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-purple-100 text-purple-700'
                                                    }`}>
                                                    {q.type === 'multiple_choice' ? 'MC' : q.type === 'short_answer' ? 'SA' : 'DESC'}
                                                </span>
                                                <span className="text-[8px] text-slate-400 font-bold">{q.points}pts</span>
                                            </div>
                                            <p className="text-xs text-slate-700 line-clamp-1">{q.question}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {questions.length === 0 && (
                                <div className="p-4 text-center text-slate-400 text-xs">이 문제은행에 문제가 없습니다</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CourseOutlineEditor() {
    const params = useParams();
    const router = useRouter();
    const locale = useLocale();
    const rawCourseId = params.id as string;
    // Account for URL encoding of '+' or spaces
    const courseId = decodeURIComponent(rawCourseId);

    const [course, setCourse] = useState<Course | null>(null);
    const [mounted, setMounted] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [allCohorts, setAllCohorts] = useState<{ id: string, name: string, program_id: string }[]>([]);
    const [allPrograms, setAllPrograms] = useState<{ id: string, name: string }[]>([]);
    const [cohortSearch, setCohortSearch] = useState('');
    const [cmsView, setCmsView] = useState<'editor' | 'grading' | 'announcements' | 'enrollments'>('editor');
    const [cmsAnnouncements, setCmsAnnouncements] = useState<any[]>([]);
    const [newAnnTitle, setNewAnnTitle] = useState('');
    const [newAnnContent, setNewAnnContent] = useState('');
    const [newAnnPinned, setNewAnnPinned] = useState(false);

    // Enrollments State
    const [courseEnrollments, setCourseEnrollments] = useState<any[]>([]);

    // UI State for expanded nodes
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [expandedSubsections, setExpandedSubsections] = useState<Set<string>>(new Set());

    // Inline Editing states
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editBuffer, setEditBuffer] = useState<string>('');

    // UI state for selected item
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

    // Markdown preview state & Asset Library state
    const [previewModes, setPreviewModes] = useState<Record<string, boolean>>({});
    const [showAssetLibrary, setShowAssetLibrary] = useState<{ isOpen: boolean, targetCompId: string | null }>({ isOpen: false, targetCompId: null });

    const [collapsedComponents, setCollapsedComponents] = useState<Set<string>>(new Set());

    // Expanded unit components in the sidebar outline
    const [expandedUnitComponents, setExpandedUnitComponents] = useState<Set<string>>(new Set());

    // Drag-and-drop state for component reordering
    const [dragOverUnitId, setDragOverUnitId] = useState<string | null>(null);
    const [dragSourceUnitId, setDragSourceUnitId] = useState<string | null>(null);

    // Course Settings Modal
    const [showCourseSettings, setShowCourseSettings] = useState(false);

    // Scheduling Popover State (Format: 'section-idx' or 'subsection-sIdx-ssIdx')
    const [focusedScheduleNode, setFocusedScheduleNode] = useState<string | null>(null);

    // Sync state
    const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [lastSyncError, setLastSyncError] = useState<string | null>(null);

    const togglePreview = (compId: string) => {
        setPreviewModes(prev => ({ ...prev, [compId]: !prev[compId] }));
    };

    const handleInsertMarkdown = (compId: string, currentText: string, prefix: string, suffix: string = '') => {
        const textToInsert = suffix ? `${prefix}text${suffix}` : prefix;
        // Simple append strategy
        updateComponent(compId, { content: currentText + (currentText ? '\n' : '') + textToInsert });
    };

    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push(`/${locale}`);
                return;
            }

            const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
            const role = userData?.role || "student";

            if (role === 'student') {
                router.push(`/${locale}/dashboard`);
                return;
            }

            setUserRole(role);
            setMounted(true);

            // Fetch all available cohorts and programs for the hierarchical restricted visibility option
            const { data: globalPrograms } = await supabase.from("programs").select("id, name");
            if (globalPrograms) setAllPrograms(globalPrograms);

            const { data: globalCohorts } = await supabase.from("cohorts").select("id, name, program_id");
            if (globalCohorts) setAllCohorts(globalCohorts);

            // Once authorized, load the course
            const dbCourse = await getCourseById(courseId) || await getCourseById(rawCourseId);
            if (dbCourse) {
                // If lecturer, they must be in the lecturers array to edit it
                if (role === 'lecturer' && (!dbCourse.lecturers || !user.email || !dbCourse.lecturers.includes(user.email))) {
                    router.push(`/${locale}/cms`);
                    return;
                }

                setCourse(dbCourse);
                if (dbCourse.sections.length > 0) {
                    setExpandedSections(new Set([dbCourse.sections[0].id]));
                    if (dbCourse.sections[0].subsections.length > 0) {
                        setExpandedSubsections(new Set([dbCourse.sections[0].subsections[0].id]));
                    }
                }
                return;
            }

            const saved = localStorage.getItem('lms_courses_db');
            if (saved) {
                const courses: Course[] = JSON.parse(saved);
                const found = courses.find(c => c.id === courseId || c.id === rawCourseId);
                if (found) {
                    // Check lecturer access
                    if (role === 'lecturer' && (!found.lecturers || !user.email || !found.lecturers.includes(user.email))) {
                        router.push(`/${locale}/cms`);
                        return;
                    }

                    setCourse(found);
                    if (found.sections.length > 0) {
                        setExpandedSections(new Set([found.sections[0].id]));
                        if (found.sections[0].subsections.length > 0) {
                            setExpandedSubsections(new Set([found.sections[0].subsections[0].id]));
                        }
                    }
                } else {
                    router.push(`/${locale}/cms`);
                }
            } else {
                router.push(`/${locale}/cms`);
            }
        };
        checkAuth();
    }, [courseId, rawCourseId, router, locale]);

    const saveCourse = (updatedCourse: Course) => {
        setCourse(updatedCourse);
        // Update localStorage cache
        const saved = localStorage.getItem('lms_courses_db');
        if (saved) {
            const courses: Course[] = JSON.parse(saved);
            const newCourses = courses.map(c => c.id === updatedCourse.id ? updatedCourse : c);
            localStorage.setItem('lms_courses_db', JSON.stringify(newCourses));
        }

        // Persist to Supabase
        setSyncStatus('saving');
        setLastSyncError(null);
        saveCourseToDb(updatedCourse)
            .then(success => {
                if (success) {
                    setSyncStatus('saved');
                    setTimeout(() => setSyncStatus('idle'), 3000);
                } else {
                    setSyncStatus('error');
                    setLastSyncError("Could not save to Supabase. Please check if the 'courses' table exists.");
                }
            })
            .catch(err => {
                console.error('[saveCourse] Supabase error:', err);
                setSyncStatus('error');
                setLastSyncError(err.message || "An unexpected error occurred while syncing.");
            });
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

    if (!mounted || !course || userRole === 'student') return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans"><div className="animate-pulse text-slate-400 font-medium tracking-widest uppercase">Loading Outline...</div></div>;

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

    const toggleComponentCollapse = (compId: string) => {
        setCollapsedComponents(prev => {
            const next = new Set(prev);
            if (next.has(compId)) next.delete(compId);
            else next.add(compId);
            return next;
        });
    };

    const moveComponentLocation = (compId: string, direction: 'up' | 'down') => {
        if (!course || selectedSecIdx === -1) return;
        const newSections = [...course.sections];
        const unit = newSections[selectedSecIdx].subsections[selectedSubIdx].units[selectedUnitIdx];
        const compIdx = unit.components.findIndex(c => c.id === compId);

        if (compIdx < 0) return;
        if (direction === 'up' && compIdx === 0) return;
        if (direction === 'down' && compIdx === unit.components.length - 1) return;

        const targetIdx = direction === 'up' ? compIdx - 1 : compIdx + 1;
        const temp = unit.components[compIdx];
        unit.components[compIdx] = unit.components[targetIdx];
        unit.components[targetIdx] = temp;

        saveCourse({ ...course, sections: newSections });
    };

    // Move subsection up/down within a section
    const moveSubsection = (sIdx: number, ssIdx: number, direction: 'up' | 'down') => {
        if (!course) return;
        const newSections = JSON.parse(JSON.stringify(course.sections));
        const subs = newSections[sIdx].subsections;
        if (direction === 'up' && ssIdx === 0) return;
        if (direction === 'down' && ssIdx === subs.length - 1) return;
        const targetIdx = direction === 'up' ? ssIdx - 1 : ssIdx + 1;
        [subs[ssIdx], subs[targetIdx]] = [subs[targetIdx], subs[ssIdx]];
        saveCourse({ ...course, sections: newSections });
    };

    // Move unit up/down within a subsection
    const moveUnit = (sIdx: number, ssIdx: number, uIdx: number, direction: 'up' | 'down') => {
        if (!course) return;
        const newSections = JSON.parse(JSON.stringify(course.sections));
        const units = newSections[sIdx].subsections[ssIdx].units;
        if (direction === 'up' && uIdx === 0) return;
        if (direction === 'down' && uIdx === units.length - 1) return;
        const targetIdx = direction === 'up' ? uIdx - 1 : uIdx + 1;
        [units[uIdx], units[targetIdx]] = [units[targetIdx], units[uIdx]];
        saveCourse({ ...course, sections: newSections });
    };

    // Delete subsection (with confirm)
    const deleteSubsection = (sIdx: number, ssIdx: number) => {
        if (!course) return;
        const sub = course.sections[sIdx].subsections[ssIdx];
        if (!confirm(`"${sub.title}" 소단원을 삭제하시겠습니까? (내부 유닛 ${sub.units.length}개도 함께 삭제됩니다)`)) return;
        const newSections = JSON.parse(JSON.stringify(course.sections));
        newSections[sIdx].subsections.splice(ssIdx, 1);
        saveCourse({ ...course, sections: newSections });
        setSelectedUnitId(null);
    };

    // Delete unit (with confirm)
    const deleteUnit = (sIdx: number, ssIdx: number, uIdx: number) => {
        if (!course) return;
        const unit = course.sections[sIdx].subsections[ssIdx].units[uIdx];
        if (!confirm(`"${unit.title}" 유닛을 삭제하시겠습니까?`)) return;
        const newSections = JSON.parse(JSON.stringify(course.sections));
        newSections[sIdx].subsections[ssIdx].units.splice(uIdx, 1);
        saveCourse({ ...course, sections: newSections });
        if (selectedUnitId === unit.id) setSelectedUnitId(null);
    };

    // Move section up/down
    const moveSection = (sIdx: number, direction: 'up' | 'down') => {
        if (!course) return;
        const newSections = JSON.parse(JSON.stringify(course.sections));
        if (direction === 'up' && sIdx === 0) return;
        if (direction === 'down' && sIdx === newSections.length - 1) return;
        const targetIdx = direction === 'up' ? sIdx - 1 : sIdx + 1;
        [newSections[sIdx], newSections[targetIdx]] = [newSections[targetIdx], newSections[sIdx]];
        saveCourse({ ...course, sections: newSections });
    };

    // Delete section (with confirm)
    const deleteSection = (sIdx: number) => {
        if (!course) return;
        const sec = course.sections[sIdx];
        const totalUnits = sec.subsections.reduce((sum, sub) => sum + sub.units.length, 0);
        if (!confirm(`"${sec.title}" 섹션을 삭제하시겠습니까?\n(소단원 ${sec.subsections.length}개, 유닛 ${totalUnits}개가 함께 삭제됩니다)`)) return;
        const newSections = JSON.parse(JSON.stringify(course.sections));
        newSections.splice(sIdx, 1);
        saveCourse({ ...course, sections: newSections });
        setSelectedUnitId(null);
    };

    const toggleUnitComponentsExpand = (unitId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedUnitComponents(prev => {
            const next = new Set(prev);
            if (next.has(unitId)) next.delete(unitId);
            else next.add(unitId);
            return next;
        });
    };

    const moveComponentToUnit = (compId: string, targetUnitId: string) => {
        if (!course) return;
        const newSections = JSON.parse(JSON.stringify(course.sections));
        let comp: UnitComponent | null = null;

        // Remove from current unit
        for (const sec of newSections) {
            for (const sub of sec.subsections) {
                for (const unit of sub.units) {
                    const idx = unit.components.findIndex((c: UnitComponent) => c.id === compId);
                    if (idx > -1) {
                        comp = unit.components.splice(idx, 1)[0];
                        break;
                    }
                }
                if (comp) break;
            }
            if (comp) break;
        }
        if (!comp) return;

        // Add to target unit
        for (const sec of newSections) {
            for (const sub of sec.subsections) {
                for (const unit of sub.units) {
                    if (unit.id === targetUnitId) {
                        unit.components.push(comp);
                        saveCourse({ ...course, sections: newSections });
                        return;
                    }
                }
            }
        }
    };

    return (
        <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
            {/* Topbar */}
            <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <Link href={`/${locale}/cms`} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                        <ArrowLeft size={18} />
                    </Link>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-emerald-600" />
                        <span className="font-semibold text-slate-800 text-sm truncate max-w-md">{course.title}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {syncStatus === 'saving' && (
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold animate-pulse">
                            <Clock size={14} />
                            SAVING TO CLOUD...
                        </div>
                    )}
                    {syncStatus === 'saved' && (
                        <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            SAVED TO SUPABASE
                        </div>
                    )}
                    {syncStatus === 'error' && (
                        <div className="flex items-center gap-2 text-rose-500 text-xs font-bold cursor-help" title={lastSyncError || "Unknown sync error"}>
                            <X size={14} className="bg-rose-500 text-white rounded-full p-0.5" />
                            SYNC FAILED
                        </div>
                    )}
                    <select
                        className={`text-sm font-bold rounded-lg px-3 py-1.5 border-2 focus:outline-none transition-colors cursor-pointer ${course.status === 'published' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                        value={course.status}
                        onChange={(e) => {
                            const newStatus = e.target.value as any;
                            if (newStatus === 'published') {
                                if (confirm("Publish Master Course! Would you ALSO like to automatically publish all Sections and Units inside?")) {
                                    let newCourse = { ...course, status: newStatus };
                                    newCourse.sections = newCourse.sections.map(sec => ({
                                        ...sec, status: 'published' as any,
                                        subsections: sec.subsections.map(sub => ({
                                            ...sub, status: 'published' as any,
                                            units: sub.units.map(u => ({ ...u, status: 'published' as any }))
                                        }))
                                    }));
                                    saveCourse(newCourse);
                                    return;
                                }
                            }
                            saveCourse({ ...course, status: newStatus });
                        }}
                    >
                        <option value="draft">Course: Draft</option>
                        <option value="published">Course: Published</option>
                    </select>

                    <button
                        onClick={() => setShowCourseSettings(true)}
                        className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-2 rounded-lg transition-colors"
                        title="Course Settings"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex flex-1 overflow-hidden h-full">
                {/* Outline Sidebar (Left) */}
                <aside className="w-[380px] bg-white border-r border-slate-200 flex flex-col shrink-0">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCmsView('editor')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${cmsView === 'editor' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                                ✏️ Editor
                            </button>
                            <button
                                onClick={() => setCmsView('grading')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${cmsView === 'grading' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                                📋 Grading
                            </button>
                            <button
                                onClick={async () => {
                                    setCmsView('announcements');
                                    const { data } = await createClient().from('announcements').select('*').eq('course_id', courseId).order('created_at', { ascending: false });
                                    if (data) setCmsAnnouncements(data);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${cmsView === 'announcements' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                                📢 공지
                            </button>
                            <button
                                onClick={async () => {
                                    setCmsView('enrollments');
                                    const supabase = createClient();

                                    // 1. Fetch enrollments for this course
                                    const { data: enrollData, error: enrollError } = await supabase
                                        .from('enrollments')
                                        .select('*')
                                        .eq('course_id', courseId);

                                    if (enrollError) {
                                        console.error('Enrollment fetch error:', enrollError);
                                        alert(`신청 목록을 불러오지 못했습니다: ${enrollError.message} (${enrollError.code})`);
                                        return;
                                    }

                                    if (!enrollData || enrollData.length === 0) {
                                        setCourseEnrollments([]);
                                        return;
                                    }

                                    // 2. Fetch user details for these enrollments
                                    const userIds = enrollData.map(e => e.user_id);

                                    // Try users table
                                    const { data: userData } = await supabase
                                        .from('users')
                                        .select('id, name, email')
                                        .in('id', userIds);

                                    // Try profiles table as well
                                    const { data: profileData } = await supabase
                                        .from('profiles')
                                        .select('id, full_name, email')
                                        .in('id', userIds);

                                    // Merge user data into enrollments
                                    const userMap = new Map();
                                    userData?.forEach(u => userMap.set(u.id, { name: u.name, email: u.email }));
                                    profileData?.forEach(p => {
                                        const existing = userMap.get(p.id);
                                        userMap.set(p.id, {
                                            name: existing?.name || p.full_name,
                                            email: existing?.email || p.email
                                        });
                                    });

                                    const enriched = enrollData.map(e => ({
                                        ...e,
                                        user: userMap.get(e.user_id)
                                    }));
                                    setCourseEnrollments(enriched);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${cmsView === 'enrollments' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                                👥 신청
                            </button>
                        </div>
                        {cmsView === 'editor' && (
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
                        )}
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
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">Section</span>
                                                {section.publishDate && (
                                                    <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold tracking-wider" title="Scheduled Publish Date (KST)">
                                                        <Clock size={10} />
                                                        {new Date(section.publishDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
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
                                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                                            <button
                                                className="w-6 h-6 rounded hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all disabled:opacity-30"
                                                title="Move Up"
                                                disabled={sIdx === 0}
                                                onClick={(e) => { e.stopPropagation(); moveSection(sIdx, 'up'); }}
                                            >
                                                <ArrowUp size={13} />
                                            </button>
                                            <button
                                                className="w-6 h-6 rounded hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all disabled:opacity-30"
                                                title="Move Down"
                                                disabled={sIdx === course.sections.length - 1}
                                                onClick={(e) => { e.stopPropagation(); moveSection(sIdx, 'down'); }}
                                            >
                                                <ArrowDown size={13} />
                                            </button>
                                            <button
                                                className="w-7 h-7 rounded-md hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm text-slate-500 flex items-center justify-center transition-all"
                                                title="Schedule Section"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFocusedScheduleNode(section.id);
                                                }}
                                            >
                                                <Calendar size={14} />
                                            </button>
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
                                            <button
                                                className="w-6 h-6 rounded hover:bg-red-50 border border-transparent hover:border-red-200 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all"
                                                title="Delete Section"
                                                onClick={(e) => { e.stopPropagation(); deleteSection(sIdx); }}
                                            >
                                                <Trash2 size={13} />
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
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">Subsection</span>
                                                                    {subsec.publishDate && (
                                                                        <span className="text-[9px] bg-amber-100/50 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold tracking-wider" title="Scheduled Publish Date (KST)">
                                                                            <Clock size={9} />
                                                                            {new Date(subsec.publishDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    )}
                                                                </div>
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

                                                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                                                                <button
                                                                    className="w-5 h-5 rounded hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all disabled:opacity-30"
                                                                    title="Move Up"
                                                                    disabled={ssIdx === 0}
                                                                    onClick={(e) => { e.stopPropagation(); moveSubsection(sIdx, ssIdx, 'up'); }}
                                                                >
                                                                    <ArrowUp size={12} />
                                                                </button>
                                                                <button
                                                                    className="w-5 h-5 rounded hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all disabled:opacity-30"
                                                                    title="Move Down"
                                                                    disabled={ssIdx === section.subsections.length - 1}
                                                                    onClick={(e) => { e.stopPropagation(); moveSubsection(sIdx, ssIdx, 'down'); }}
                                                                >
                                                                    <ArrowDown size={12} />
                                                                </button>
                                                                <button
                                                                    className="w-6 h-6 rounded-md hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm text-slate-500 flex items-center justify-center transition-all"
                                                                    title="Schedule Subsection"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setFocusedScheduleNode(subsec.id);
                                                                    }}
                                                                >
                                                                    <Calendar size={14} />
                                                                </button>
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
                                                                <button
                                                                    className="w-5 h-5 rounded hover:bg-red-50 border border-transparent hover:border-red-200 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all"
                                                                    title="Delete Subsection"
                                                                    onClick={(e) => { e.stopPropagation(); deleteSubsection(sIdx, ssIdx); }}
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Units */}
                                                        {isSubExpanded && (
                                                            <div className="ml-5 pl-2 mt-1 space-y-0.5 relative before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-slate-200">
                                                                {subsec.units.length === 0 && (
                                                                    <div className="text-xs text-slate-400 p-2 italic">No units inside</div>
                                                                )}
                                                                {subsec.units.map((unit, uIdx) => {
                                                                    const isSelected = selectedUnitId === unit.id;
                                                                    return (
                                                                        <div key={unit.id}>
                                                                            <div
                                                                                onClick={() => setSelectedUnitId(unit.id)}
                                                                                onDragOver={(e) => { e.preventDefault(); setDragOverUnitId(unit.id); }}
                                                                                onDragLeave={() => setDragOverUnitId(null)}
                                                                                onDrop={(e) => {
                                                                                    e.preventDefault();
                                                                                    const compId = e.dataTransfer.getData('text/comp-id');
                                                                                    if (compId && unit.id !== dragSourceUnitId) {
                                                                                        moveComponentToUnit(compId, unit.id);
                                                                                    }
                                                                                    setDragOverUnitId(null);
                                                                                    setDragSourceUnitId(null);
                                                                                }}
                                                                                className={`
                                                                                    group relative flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all text-sm
                                                                                    ${dragOverUnitId === unit.id && dragSourceUnitId !== unit.id
                                                                                        ? 'bg-blue-50 text-blue-700 border-2 border-dashed border-blue-400'
                                                                                        : isSelected
                                                                                            ? 'bg-emerald-50 text-emerald-800 shadow-sm border border-emerald-100'
                                                                                            : 'hover:bg-slate-100 text-slate-600 border border-transparent'}
                                                                                `}
                                                                            >
                                                                                {/* Custom line connector for unit */}
                                                                                <div className="absolute left-[-9px] w-2 h-px bg-slate-200"></div>

                                                                                {/* Expand/Collapse toggle for components */}
                                                                                {unit.components && unit.components.length > 0 ? (
                                                                                    <button
                                                                                        onClick={(e) => toggleUnitComponentsExpand(unit.id, e)}
                                                                                        className="flex-shrink-0 hover:bg-slate-200 rounded p-0.5 transition-colors"
                                                                                    >
                                                                                        {expandedUnitComponents.has(unit.id)
                                                                                            ? <ChevronDown size={12} className={isSelected ? 'text-emerald-500' : 'text-slate-400'} />
                                                                                            : <ChevronRight size={12} className={isSelected ? 'text-emerald-500' : 'text-slate-400'} />}
                                                                                    </button>
                                                                                ) : (
                                                                                    <span className="w-4 flex-shrink-0"></span>
                                                                                )}

                                                                                <FileText size={14} className={isSelected ? 'text-emerald-500' : 'text-slate-400'} />
                                                                                <span className={`flex-1 truncate select-none ${isSelected ? 'font-bold' : 'font-medium'}`}>
                                                                                    {unit.title}
                                                                                </span>
                                                                                {unit.components && unit.components.length > 0 && (
                                                                                    <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded flex-shrink-0 font-bold">
                                                                                        {unit.components.length}
                                                                                    </span>
                                                                                )}
                                                                                {unit.status === 'draft' && (
                                                                                    <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded flex-shrink-0 font-bold">DRAFT</span>
                                                                                )}
                                                                                {unit.status === 'published' && (
                                                                                    <span className="text-[9px] bg-slate-100 text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded flex-shrink-0 font-bold">PUB</span>
                                                                                )}
                                                                                {/* Unit Actions (hover) */}
                                                                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-auto flex-shrink-0 transition-opacity">
                                                                                    <button
                                                                                        className="w-4 h-4 rounded hover:bg-white text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all disabled:opacity-30"
                                                                                        title="Move Up"
                                                                                        disabled={uIdx === 0}
                                                                                        onClick={(e) => { e.stopPropagation(); moveUnit(sIdx, ssIdx, uIdx, 'up'); }}
                                                                                    >
                                                                                        <ArrowUp size={10} />
                                                                                    </button>
                                                                                    <button
                                                                                        className="w-4 h-4 rounded hover:bg-white text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all disabled:opacity-30"
                                                                                        title="Move Down"
                                                                                        disabled={uIdx === subsec.units.length - 1}
                                                                                        onClick={(e) => { e.stopPropagation(); moveUnit(sIdx, ssIdx, uIdx, 'down'); }}
                                                                                    >
                                                                                        <ArrowDown size={10} />
                                                                                    </button>
                                                                                    <button
                                                                                        className="w-4 h-4 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all"
                                                                                        title="Delete Unit"
                                                                                        onClick={(e) => { e.stopPropagation(); deleteUnit(sIdx, ssIdx, uIdx); }}
                                                                                    >
                                                                                        <Trash2 size={10} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>

                                                                            {/* Expandable components list */}
                                                                            {expandedUnitComponents.has(unit.id) && unit.components && unit.components.length > 0 && (
                                                                                <div
                                                                                    className={`ml-7 pl-2 mt-1 mb-1 space-y-0.5 border-l border-dashed border-slate-200 transition-colors ${dragOverUnitId === unit.id ? 'border-blue-400 bg-blue-50/50 rounded-r' : ''
                                                                                        }`}
                                                                                    onDragOver={(e) => { e.preventDefault(); setDragOverUnitId(unit.id); }}
                                                                                    onDragLeave={() => setDragOverUnitId(null)}
                                                                                    onDrop={(e) => {
                                                                                        e.preventDefault();
                                                                                        const compId = e.dataTransfer.getData('text/comp-id');
                                                                                        if (compId && unit.id !== dragSourceUnitId) {
                                                                                            moveComponentToUnit(compId, unit.id);
                                                                                        }
                                                                                        setDragOverUnitId(null);
                                                                                        setDragSourceUnitId(null);
                                                                                    }}
                                                                                >
                                                                                    {unit.components.map((comp: UnitComponent, cIdx: number) => (
                                                                                        <div
                                                                                            key={comp.id}
                                                                                            draggable
                                                                                            onDragStart={(e) => {
                                                                                                e.dataTransfer.setData('text/comp-id', comp.id);
                                                                                                setDragSourceUnitId(unit.id);
                                                                                            }}
                                                                                            onDragEnd={() => { setDragOverUnitId(null); setDragSourceUnitId(null); }}
                                                                                            className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-slate-500 hover:bg-slate-100 rounded cursor-grab active:cursor-grabbing transition-colors group/comp"
                                                                                            title={comp.title || comp.content}
                                                                                        >
                                                                                            <span className="text-slate-300 group-hover/comp:text-slate-400 cursor-grab">⠿</span>
                                                                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${comp.type === 'html' ? 'bg-blue-400' :
                                                                                                comp.type === 'video' ? 'bg-red-400' :
                                                                                                    comp.type === 'embed' ? 'bg-purple-400' :
                                                                                                        comp.type === 'quiz' ? 'bg-amber-400' : 'bg-slate-400'
                                                                                                }`}></span>
                                                                                            <span className="font-bold uppercase tracking-wider text-[9px] w-10 flex-shrink-0 text-slate-400">
                                                                                                {comp.type === 'html' ? 'TXT' :
                                                                                                    comp.type === 'video' ? 'VID' :
                                                                                                        comp.type === 'embed' ? 'EMB' :
                                                                                                            comp.type === 'quiz' ? 'QIZ' : comp.type.slice(0, 3).toUpperCase()}
                                                                                            </span>
                                                                                            <span className="truncate flex-1 font-medium text-slate-600">
                                                                                                {comp.title || (comp.type === 'html'
                                                                                                    ? (comp.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').slice(0, 35) || 'Untitled'
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
                {cmsView === 'grading' ? (
                    <GradingPanel course={course} courseId={courseId} />
                ) : cmsView === 'announcements' ? (
                    <div className="flex-1 bg-slate-50 overflow-y-auto p-8">
                        <div className="max-w-3xl mx-auto">
                            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Megaphone size={24} /> 공지사항 관리</h2>
                            {/* Create new announcement */}
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
                                <h3 className="text-sm font-bold text-slate-700 mb-3">새 공지 작성</h3>
                                <input
                                    type="text"
                                    className="w-full bg-white border-2 border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 mb-3 focus:outline-none focus:border-amber-500"
                                    placeholder="공지 제목"
                                    value={newAnnTitle}
                                    onChange={(e) => setNewAnnTitle(e.target.value)}
                                />
                                <textarea
                                    className="w-full bg-white border-2 border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 mb-3 focus:outline-none focus:border-amber-500 min-h-[100px] resize-y"
                                    placeholder="공지 내용"
                                    value={newAnnContent}
                                    onChange={(e) => setNewAnnContent(e.target.value)}
                                />
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                                        <input type="checkbox" checked={newAnnPinned} onChange={() => setNewAnnPinned(!newAnnPinned)} className="rounded" />
                                        <Pin size={14} className="text-amber-500" />
                                        <span className="font-medium text-slate-600">상단 고정</span>
                                    </label>
                                    <button
                                        onClick={async () => {
                                            if (!newAnnTitle.trim()) return alert('제목을 입력하세요');
                                            const { data: { user } } = await createClient().auth.getUser();
                                            const { data, error } = await createClient().from('announcements').insert({
                                                course_id: courseId,
                                                title: newAnnTitle.trim(),
                                                content: newAnnContent.trim(),
                                                pinned: newAnnPinned,
                                                author_id: user?.id
                                            }).select().single();
                                            if (data) {
                                                setCmsAnnouncements([data, ...cmsAnnouncements]);
                                                setNewAnnTitle(''); setNewAnnContent(''); setNewAnnPinned(false);
                                            }
                                            if (error) alert('오류: ' + error.message);
                                        }}
                                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                                    >
                                        <Save size={14} /> 공지 등록
                                    </button>
                                </div>
                            </div>
                            {/* List of announcements */}
                            <div className="space-y-3">
                                {cmsAnnouncements.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400"><Megaphone size={32} className="mx-auto mb-2 opacity-30" /><p>등록된 공지가 없습니다</p></div>
                                ) : cmsAnnouncements.map(ann => (
                                    <div key={ann.id} className={`bg-white border rounded-xl p-4 shadow-sm ${ann.pinned ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {ann.pinned && <Pin size={12} className="text-amber-500" />}
                                                    <span className="font-bold text-sm text-slate-800">{ann.title}</span>
                                                </div>
                                                {ann.content && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ann.content}</p>}
                                                <p className="text-[10px] text-slate-400 mt-2">{new Date(ann.created_at).toLocaleString('ko-KR')}</p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('이 공지를 삭제하시겠습니까?')) return;
                                                    await createClient().from('announcements').delete().eq('id', ann.id);
                                                    setCmsAnnouncements(cmsAnnouncements.filter(a => a.id !== ann.id));
                                                }}
                                                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
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
                                                        ${comp.type === 'document' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                                                        ${comp.type === 'embed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                                                    `}>
                                                            {comp.type} Component
                                                        </span>
                                                        <input
                                                            type="text"
                                                            value={comp.title}
                                                            onChange={(e) => updateComponent(comp.id, { title: e.target.value })}
                                                            placeholder="Component Title"
                                                            className="font-semibold text-slate-900 text-sm bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="flex items-center border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm mr-2">
                                                            <button
                                                                onClick={() => moveComponentLocation(comp.id, 'up')}
                                                                disabled={idx === 0}
                                                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors border-r border-slate-200"
                                                                title="Move Up"
                                                            >
                                                                <ArrowUp size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => moveComponentLocation(comp.id, 'down')}
                                                                disabled={idx === selectedUnitData.components.length - 1}
                                                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                                                title="Move Down"
                                                            >
                                                                <ArrowDown size={14} />
                                                            </button>
                                                        </div>

                                                        {/* Move to another Unit */}
                                                        <select
                                                            value=""
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    moveComponentToUnit(comp.id, e.target.value);
                                                                }
                                                            }}
                                                            className="text-[11px] font-medium border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:border-emerald-500 mr-2 shadow-sm max-w-[160px]"
                                                            title="Move to another Unit"
                                                        >
                                                            <option value="">Move to...</option>
                                                            {course.sections.map((sec, sIdx) =>
                                                                sec.subsections.map((sub, ssIdx) =>
                                                                    sub.units
                                                                        .filter(u => u.id !== selectedUnitId)
                                                                        .map(u => (
                                                                            <option key={u.id} value={u.id}>
                                                                                {sec.title.slice(0, 12)}... › {u.title.slice(0, 20)}
                                                                            </option>
                                                                        ))
                                                                )
                                                            )}
                                                        </select>

                                                        <button
                                                            onClick={() => toggleComponentCollapse(comp.id)}
                                                            className="text-slate-400 hover:text-slate-600 transition-colors bg-white p-1.5 rounded-md border border-transparent hover:border-slate-200 hover:bg-slate-50 shadow-sm"
                                                            title={collapsedComponents.has(comp.id) ? "Expand Component" : "Collapse Component"}
                                                        >
                                                            {collapsedComponents.has(comp.id) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('Are you sure you want to delete this component?')) {
                                                                    deleteComponent(comp.id);
                                                                }
                                                            }}
                                                            className="text-slate-400 hover:text-rose-500 transition-colors bg-white p-1.5 rounded-md border border-transparent hover:border-rose-200 hover:bg-rose-50 shadow-sm"
                                                            title="Delete Component"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Block Body Editor Forms */}
                                                {!collapsedComponents.has(comp.id) && (
                                                    <div className="p-6">
                                                        {comp.type === 'html' && (
                                                            <div className="flex flex-col gap-2 relative z-0">
                                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rich Text Content</label>
                                                                <div className="border border-slate-200 rounded-lg overflow-hidden relative z-0">
                                                                    <RichTextEditorWrapper
                                                                        value={comp.content}
                                                                        onChange={(newVal) => updateComponent(comp.id, { content: newVal })}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {comp.type === 'video' && (
                                                            <div className="flex flex-col gap-4">
                                                                {/* Video Source Type Detection */}
                                                                {(() => {
                                                                    const url = comp.content || '';
                                                                    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
                                                                    const isDirect = /\.(mp4|webm|ogg)(\?|$)/i.test(url);
                                                                    const isGDrive = url.includes('drive.google.com');
                                                                    const sourceType = isYouTube ? '🎬 YouTube' : isDirect ? '🎥 Direct Video File' : isGDrive ? '📁 Google Drive' : url ? '🔗 External URL' : '⏳ No video set';
                                                                    return (
                                                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${isYouTube ? 'bg-red-50 text-red-700 border border-red-200' :
                                                                            isDirect ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                                                isGDrive ? 'bg-green-50 text-green-700 border border-green-200' :
                                                                                    'bg-slate-50 text-slate-500 border border-slate-200'
                                                                            }`}>
                                                                            <span>{sourceType}</span>
                                                                            {url && <span className="font-normal text-[10px] truncate max-w-[300px] opacity-70">{url}</span>}
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {/* Video URL Input */}
                                                                <div className="flex flex-col gap-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Video URL</label>
                                                                    <input
                                                                        type="text"
                                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                                                        value={comp.content}
                                                                        onChange={(e) => updateComponent(comp.id, { content: e.target.value })}
                                                                        placeholder="YouTube URL, .mp4/.webm link, or Google Drive share link"
                                                                    />
                                                                    <p className="text-[11px] text-slate-400">
                                                                        Supports: YouTube URLs, direct .mp4/.ogg/.webm links, Google Drive shared videos
                                                                    </p>
                                                                </div>

                                                                {/* Video ID */}
                                                                <div className="flex flex-col gap-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Video ID <span className="font-normal text-slate-400">(Optional)</span></label>
                                                                    <input
                                                                        type="text"
                                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
                                                                        value={comp.videoId || ''}
                                                                        onChange={(e) => updateComponent(comp.id, { videoId: e.target.value })}
                                                                        placeholder="e.g. abc123def"
                                                                    />
                                                                    <p className="text-[11px] text-slate-400">If assigned a video ID by edX, enter it here.</p>
                                                                </div>

                                                                {/* Fallback Videos */}
                                                                <div className="flex flex-col gap-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fallback Videos <span className="font-normal text-slate-400">(Optional)</span></label>
                                                                    {(comp.fallbackUrls || []).map((url, fIdx) => (
                                                                        <div key={fIdx} className="flex gap-2">
                                                                            <input
                                                                                type="text"
                                                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
                                                                                value={url}
                                                                                onChange={(e) => {
                                                                                    const updated = [...(comp.fallbackUrls || [])];
                                                                                    updated[fIdx] = e.target.value;
                                                                                    updateComponent(comp.id, { fallbackUrls: updated });
                                                                                }}
                                                                                placeholder=".mp4 or .webm URL"
                                                                            />
                                                                            <button
                                                                                onClick={() => {
                                                                                    const updated = (comp.fallbackUrls || []).filter((_, i) => i !== fIdx);
                                                                                    updateComponent(comp.id, { fallbackUrls: updated });
                                                                                }}
                                                                                className="text-red-400 hover:text-red-600 p-1 text-xs font-bold"
                                                                            >✕</button>
                                                                        </div>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => updateComponent(comp.id, { fallbackUrls: [...(comp.fallbackUrls || []), ''] })}
                                                                        className="text-xs text-blue-600 hover:text-blue-700 font-bold self-start"
                                                                    >+ Add fallback video</button>
                                                                    <p className="text-[11px] text-slate-400">Provide .mp4 and .webm versions to ensure all learners can access the video.</p>
                                                                </div>

                                                                {/* Thumbnail */}
                                                                <div className="flex flex-col gap-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thumbnail URL <span className="font-normal text-slate-400">(Optional)</span></label>
                                                                    <input
                                                                        type="text"
                                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
                                                                        value={comp.thumbnailUrl || ''}
                                                                        onChange={(e) => updateComponent(comp.id, { thumbnailUrl: e.target.value })}
                                                                        placeholder="https://example.com/thumbnail.jpg"
                                                                    />
                                                                    {comp.thumbnailUrl && (
                                                                        <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden w-40 h-24">
                                                                            <img src={comp.thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Allow Download Toggle */}
                                                                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                                                                    <div>
                                                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Allow Video Downloads</label>
                                                                        <p className="text-[11px] text-slate-400 mt-0.5">Students can download the video file for offline viewing</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => updateComponent(comp.id, { allowDownload: !comp.allowDownload })}
                                                                        className={`relative w-10 h-5 rounded-full transition-colors ${comp.allowDownload ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                                                    >
                                                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${comp.allowDownload ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {comp.type === 'embed' && (
                                                            <div className="flex flex-col gap-2">
                                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">External URL (iFrame Embed)</label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                                                    value={comp.content}
                                                                    onChange={(e) => updateComponent(comp.id, { content: e.target.value })}
                                                                    placeholder="https://docs.google.com/document/d/e/.../pub"
                                                                />
                                                                <p className="text-xs text-slate-400 mt-1">This URL will be embedded directly into the course page as an interactive iFrame.</p>
                                                            </div>
                                                        )}

                                                        {comp.type === 'quiz' && (() => {
                                                            // Quiz Source: 'library' or 'manual'
                                                            const quizSource = comp.quizBankId ? 'library' : 'manual';
                                                            return (
                                                                <div className="flex flex-col gap-4">
                                                                    {/* Source Toggle */}
                                                                    <div className="flex gap-2 bg-slate-50 p-3 border-b border-slate-200 -mx-6 -mt-6 rounded-t-lg">
                                                                        <button
                                                                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${quizSource === 'library' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
                                                                            onClick={() => {
                                                                                if (!comp.quizBankId) updateComponent(comp.id, { quizBankId: '_pending', quizMode: 'all', content: '' });
                                                                            }}
                                                                        >📚 문제은행에서 가져오기</button>
                                                                        <button
                                                                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${quizSource === 'manual' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
                                                                            onClick={() => updateComponent(comp.id, { quizBankId: undefined, quizMode: undefined, questionCount: undefined, selectedQuestionIds: undefined })}
                                                                        >✏️ 직접 만들기</button>
                                                                    </div>

                                                                    {/* Library Mode */}
                                                                    {quizSource === 'library' && (
                                                                        <QuizBankPicker
                                                                            comp={comp}
                                                                            updateComponent={updateComponent}
                                                                        />
                                                                    )}

                                                                    {/* Manual Mode */}
                                                                    {quizSource === 'manual' && (
                                                                        <div className="flex flex-col gap-2 bg-slate-50 p-6 border border-slate-200 rounded-lg">
                                                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Interactive Problem Builder</label>
                                                                            <QuizBuilder
                                                                                initialContent={comp.content}
                                                                                onChange={(newVal) => updateComponent(comp.id, { content: newVal })}
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    {/* Grading Configuration */}
                                                                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                                                                        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                                                            📊 채점 설정
                                                                        </h4>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                            {/* isGraded Toggle */}
                                                                            <div className="flex items-center gap-3 bg-white rounded-lg border border-amber-100 p-3">
                                                                                <button
                                                                                    onClick={() => updateComponent(comp.id, { isGraded: !comp.isGraded })}
                                                                                    className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${comp.isGraded ? 'bg-amber-500' : 'bg-slate-300'}`}
                                                                                >
                                                                                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${comp.isGraded ? 'translate-x-5' : 'translate-x-0'}`} />
                                                                                </button>
                                                                                <div>
                                                                                    <span className="text-sm font-bold text-slate-800">{comp.isGraded ? '성적 반영' : '연습 모드'}</span>
                                                                                    <p className="text-[10px] text-slate-400">{comp.isGraded ? '이 퀴즈 점수가 성적에 포함됩니다' : '점수가 성적에 반영되지 않습니다'}</p>
                                                                                </div>
                                                                            </div>
                                                                            {/* Passing Score */}
                                                                            {comp.isGraded && (
                                                                                <div className="bg-white rounded-lg border border-amber-100 p-3">
                                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">통과 기준 점수 (%)</label>
                                                                                    <div className="flex items-center gap-3">
                                                                                        <input
                                                                                            type="range" min="0" max="100" step="5"
                                                                                            className="flex-1 accent-amber-500"
                                                                                            value={comp.passingScore ?? 60}
                                                                                            onChange={(e) => updateComponent(comp.id, { passingScore: parseInt(e.target.value) })}
                                                                                        />
                                                                                        <span className="text-lg font-bold text-amber-700 min-w-[3ch] text-right">{comp.passingScore ?? 60}%</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Open edX Metadata */}
                                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 border border-slate-200 rounded-lg">
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weight (Points)</label>
                                                                            <input
                                                                                type="number" min="0" step="0.5"
                                                                                className="bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500"
                                                                                value={comp.weight !== undefined ? comp.weight : 1.0}
                                                                                onChange={(e) => updateComponent(comp.id, { weight: parseFloat(e.target.value) || 0 })}
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max Attempts</label>
                                                                            <input
                                                                                type="number" min="0" step="1"
                                                                                className="bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500"
                                                                                value={comp.attempts !== undefined ? comp.attempts : 1}
                                                                                onChange={(e) => updateComponent(comp.id, { attempts: parseInt(e.target.value, 10) || 0 })}
                                                                                placeholder="0 = Unlimited"
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Show Answer To Learners</label>
                                                                            <select
                                                                                className="bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500"
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
                                                            );
                                                        })()}

                                                        {comp.type === 'document' && (
                                                            <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attached File</label>
                                                                {comp.content ? (
                                                                    <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-md shadow-sm">
                                                                        <div className="flex items-center gap-3 truncate pr-4">
                                                                            <div className="w-10 h-10 bg-red-50 text-red-500 rounded flex items-center justify-center shrink-0">
                                                                                <FileText size={20} />
                                                                            </div>
                                                                            <div className="flex flex-col truncate">
                                                                                <span className="text-sm font-semibold text-slate-700 truncate">{comp.content.split('/').pop()}</span>
                                                                                <span className="text-xs text-slate-400 truncate hover:text-blue-500 cursor-pointer" onClick={() => window.open(comp.content, '_blank')}>
                                                                                    {comp.content}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => setShowAssetLibrary({ isOpen: true, targetCompId: comp.id })}
                                                                            className="shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                                                                        >
                                                                            Change File
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-8 bg-white text-center">
                                                                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
                                                                            <Upload size={20} />
                                                                        </div>
                                                                        <p className="text-sm font-semibold text-slate-700 mb-1">No document selected</p>
                                                                        <p className="text-xs text-slate-500 mb-4">Upload a PDF or document from your shared library.</p>
                                                                        <button
                                                                            onClick={() => setShowAssetLibrary({ isOpen: true, targetCompId: comp.id })}
                                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded shadow-sm text-sm transition-colors flex items-center gap-2"
                                                                        >
                                                                            <Layers size={16} /> Browse Library
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {comp.content && (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description / Note</label>
                                                                            <input
                                                                                type="text"
                                                                                className="w-full bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                                                                                value={comp.description || ''}
                                                                                onChange={(e) => updateComponent(comp.id, { description: e.target.value })}
                                                                                placeholder="e.g. Please read chapter 4 before class..."
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Display Mode</label>
                                                                            <select
                                                                                className="w-full bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                                                                                value={comp.displayMode || 'link'}
                                                                                onChange={(e) => updateComponent(comp.id, { displayMode: e.target.value as any })}
                                                                            >
                                                                                <option value="link">Download Link (Default)</option>
                                                                                <option value="iframe">Embedded iFrame Player</option>
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
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
                                        <button
                                            onClick={() => addComponent('document')}
                                            className="bg-white border-2 border-slate-200 hover:border-amber-500 hover:text-amber-600 text-slate-600 font-bold px-5 py-3 rounded-xl flex items-center gap-2 text-sm transition-all shadow-sm hover:shadow-md"
                                        >
                                            <Plus size={18} /> File
                                        </button>
                                        <button
                                            onClick={() => addComponent('embed')}
                                            className="bg-white border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 text-slate-600 font-bold px-5 py-3 rounded-xl flex items-center gap-2 text-sm transition-all shadow-sm hover:shadow-md"
                                        >
                                            <Globe size={18} /> Embed URL
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
                )}

                {cmsView === 'enrollments' && (
                    <main className="flex-1 overflow-y-auto bg-slate-50 p-8 custom-scrollbar">
                        <div className="max-w-4xl mx-auto">
                            <div className="mb-8">
                                <h2 className="text-2xl font-black text-slate-800">👥 수강 신청 관리 (Enrollments)</h2>
                                <p className="text-slate-500">이 코스에 신청한 학생들의 목록입니다. 승인 대기 중인 학생을 수락하거나 거절할 수 있습니다.</p>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {courseEnrollments.map((enroll) => (
                                                <tr key={enroll.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-700">{enroll.name || enroll.user?.name || enroll.profiles?.name || `User (${enroll.user_id.substring(0, 8)})`}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">{enroll.email || enroll.user?.email || enroll.profiles?.email || 'N/A'}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${enroll.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                                            enroll.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-rose-100 text-rose-700'
                                                            }`}>
                                                            {enroll.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {enroll.status === 'pending' && (
                                                                <>
                                                                    <button
                                                                        onClick={async () => {
                                                                            const supabase = createClient();
                                                                            const { error } = await supabase.from('enrollments').update({ status: 'active' }).eq('id', enroll.id);
                                                                            if (error) {
                                                                                alert(`승인 실패: ${error.message}`);
                                                                            } else {
                                                                                setCourseEnrollments(prev => prev.map(e => e.id === enroll.id ? { ...e, status: 'active' } : e));
                                                                            }
                                                                        }}
                                                                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                                                                    >승인</button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (!confirm("이 신청을 거절하시겠습니까?")) return;
                                                                            const supabase = createClient();
                                                                            const { error } = await supabase.from('enrollments').delete().eq('id', enroll.id);
                                                                            if (error) {
                                                                                alert(`거절 실패: ${error.message}`);
                                                                            } else {
                                                                                setCourseEnrollments(prev => prev.filter(e => e.id !== enroll.id));
                                                                            }
                                                                        }}
                                                                        className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                                                                    >거절</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {courseEnrollments.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">신청한 학생이 없습니다.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </main>
                )}

                {cmsView === 'grading' && (
                    <main className="flex-1 overflow-y-auto bg-slate-50 p-8 custom-scrollbar">
                        <div className="max-w-4xl mx-auto text-center py-20">
                            <h2 className="text-2xl font-black text-slate-800 mb-2">📊 성적 관리 (Grading)</h2>
                            <p className="text-slate-500">이 탭에서는 학생들의 퀴즈 참여 내역과 성적을 관리할 수 있습니다. (준비 중입니다)</p>
                        </div>
                    </main>
                )}
            </div>

            {/* Asset Library Modal Overlay */}
            {showAssetLibrary.isOpen && (
                <MediaLibrarySelector
                    onClose={() => setShowAssetLibrary({ isOpen: false, targetCompId: null })}
                    onSelectOption={(url) => {
                        if (showAssetLibrary.targetCompId) {
                            updateComponent(showAssetLibrary.targetCompId, { content: url });
                        }
                        setShowAssetLibrary({ isOpen: false, targetCompId: null });
                    }}
                />
            )}

            {/* Course Settings Modal */}
            {showCourseSettings && course && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-xl flex items-center gap-2">
                                <Settings className="text-emerald-600" size={24} />
                                Course Settings
                            </h3>
                            <button onClick={() => setShowCourseSettings(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Publish Status</label>
                                <p className="text-xs text-slate-400 mb-3">Controls the master visibility of this course.</p>
                                <select
                                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 mb-6"
                                    value={course.status}
                                    onChange={(e) => saveCourse({ ...course, status: e.target.value as any })}
                                >
                                    <option value="draft">Draft (Hidden)</option>
                                    <option value="published">Published</option>
                                    <option value="none">None (Removed completely)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Publish Schedule (KST)</label>
                                <p className="text-xs text-slate-400 mb-3">Set the date and time when this course becomes visible to students.</p>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                                    value={course.publishDate || ''}
                                    onChange={(e) => saveCourse({ ...course, publishDate: e.target.value })}
                                />
                            </div>

                            <div className="bg-emerald-50 p-4 border border-emerald-200 rounded-lg">
                                <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">Bulk Publish Actions</label>
                                <p className="text-xs text-emerald-600 mb-3">Automatically set all Sections, Subsections, and Units in this course to 'Published'. This fixes issues where students cannot see content because inner components are still set to Draft.</p>
                                <button
                                    onClick={() => {
                                        if (confirm("Are you sure you want to publish ALL contents inside this course? This will overwrite any draft statuses.")) {
                                            const newCourse = { ...course, status: 'published' as any };
                                            newCourse.sections = newCourse.sections.map(sec => ({
                                                ...sec,
                                                status: 'published' as any,
                                                subsections: sec.subsections.map(sub => ({
                                                    ...sub,
                                                    status: 'published' as any,
                                                    units: sub.units.map(u => ({
                                                        ...u,
                                                        status: 'published' as any
                                                    }))
                                                }))
                                            }));
                                            saveCourse(newCourse);
                                            alert("All contents successfully published!");
                                        }
                                    }}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors text-sm"
                                >
                                    Force Publish All Drafts
                                </button>
                            </div>

                            <div className="border-t border-slate-100 pt-6">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Visibility</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="public"
                                            checked={!course.visibility || course.visibility === 'public'}
                                            onChange={() => saveCourse({ ...course, visibility: 'public' })}
                                            className="text-emerald-500 focus:ring-emerald-500"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">Public (All Users)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="cohort"
                                            checked={course.visibility === 'cohort'}
                                            onChange={() => saveCourse({ ...course, visibility: 'cohort' })}
                                            className="text-emerald-500 focus:ring-emerald-500"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">Restricted (Cohorts)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="none"
                                            checked={course.visibility === 'none'}
                                            onChange={() => saveCourse({ ...course, visibility: 'none' })}
                                            className="text-emerald-500 focus:ring-emerald-500"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">None (Hidden)</span>
                                    </label>
                                </div>
                            </div>

                            {course.visibility === 'cohort' && (
                                <div className="bg-slate-50 p-5 border border-slate-200 rounded-xl space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Allowed Cohorts</label>
                                            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                                                {(course.allowedCohorts || []).length} Selected
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {course.allowedCohorts && course.allowedCohorts.length > 0 ? (
                                                course.allowedCohorts.map(code => (
                                                    <span key={code} className="inline-flex items-center gap-1.5 bg-white text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 shadow-sm">
                                                        <span className="text-[10px] text-slate-400 font-normal mr-1">
                                                            {allPrograms.find(p => p.id === allCohorts.find(c => c.id === code)?.program_id)?.name || 'N/A'} »
                                                        </span>
                                                        {allCohorts.find(c => c.id === code)?.name || code}
                                                        <button
                                                            onClick={() => {
                                                                const newCodes = (course.allowedCohorts || []).filter(c => c !== code);
                                                                saveCourse({ ...course, allowedCohorts: newCodes });
                                                            }}
                                                            className="text-slate-400 hover:text-red-500 transition-colors ml-1"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">No cohorts selected. This course will be invisible to students.</span>
                                            )}
                                        </div>

                                        <div className="relative mb-4">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                <Search size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
                                                placeholder="Search programs or cohorts..."
                                                value={cohortSearch}
                                                onChange={(e) => setCohortSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="max-h-64 overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg bg-white">
                                            {allPrograms.map(program => {
                                                const cohortsInProgram = allCohorts.filter(c => c.program_id === program.id);
                                                const displayedCohorts = cohortsInProgram.filter(c =>
                                                    !cohortSearch ||
                                                    c.name.toLowerCase().includes(cohortSearch.toLowerCase()) ||
                                                    program.name.toLowerCase().includes(cohortSearch.toLowerCase())
                                                );

                                                if (cohortSearch && displayedCohorts.length === 0 && !program.name.toLowerCase().includes(cohortSearch.toLowerCase())) return null;

                                                const selectedInProgram = (course.allowedCohorts || []).filter(code =>
                                                    cohortsInProgram.some(c => c.id === code)
                                                );
                                                const isAllSelected = cohortsInProgram.length > 0 && selectedInProgram.length === cohortsInProgram.length;

                                                return (
                                                    <div key={program.id} className="border-b border-slate-50 last:border-0">
                                                        <div className="p-3 bg-slate-50/50 flex items-center justify-between group">
                                                            <div className="flex items-center gap-2">
                                                                <Layers size={14} className="text-slate-400" />
                                                                <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{program.name}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const current = course.allowedCohorts || [];
                                                                    let next;
                                                                    if (isAllSelected) {
                                                                        // Deselect all cohorts of THIS program
                                                                        next = current.filter(code => !cohortsInProgram.some(c => c.id === code));
                                                                    } else {
                                                                        // Select all cohorts of THIS program (keeping others)
                                                                        const toAdd = cohortsInProgram.map(c => c.id).filter(id => !current.includes(id));
                                                                        next = [...current, ...toAdd];
                                                                    }
                                                                    saveCourse({ ...course, allowedCohorts: next });
                                                                }}
                                                                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${isAllSelected
                                                                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                                    }`}
                                                            >
                                                                {isAllSelected ? "Deselect Program" : "Select Program"}
                                                            </button>
                                                        </div>
                                                        <div className="p-2 grid grid-cols-1 gap-1">
                                                            {displayedCohorts.map(cohort => {
                                                                const isSelected = (course.allowedCohorts || []).includes(cohort.id);
                                                                return (
                                                                    <button
                                                                        key={cohort.id}
                                                                        onClick={() => {
                                                                            const current = course.allowedCohorts || [];
                                                                            const next = isSelected
                                                                                ? current.filter(c => c !== cohort.id)
                                                                                : [...current, cohort.id];
                                                                            saveCourse({ ...course, allowedCohorts: next });
                                                                        }}
                                                                        className={`flex items-center justify-between p-2 rounded-md text-xs transition-colors ${isSelected
                                                                            ? 'bg-emerald-50 text-emerald-700 font-bold'
                                                                            : 'hover:bg-slate-50 text-slate-600'
                                                                            }`}
                                                                    >
                                                                        <span>{cohort.name}</span>
                                                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {allPrograms.length === 0 && (
                                                <div className="p-8 text-center text-slate-400 text-xs italic">No programs or cohorts found.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Lecturer Assignment (Superuser/Staff ONLY) */}
                            {userRole !== 'lecturer' && (
                                <div className="pt-4 border-t border-slate-100 mt-4">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        Assigned Lecturers (Emails)
                                    </label>
                                    <div className="text-[10px] text-slate-500 mb-2">
                                        Enter email addresses separated by commas. These users (if they hold the 'lecturer' role) will be granted CMS edit access to this course.
                                    </div>
                                    <textarea
                                        className="w-full border text-left border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white placeholder-slate-400 min-h-[60px]"
                                        placeholder="e.g. lecturer1@ex.com, teacher@school.edu"
                                        value={(course.lecturers || []).join(', ')}
                                        onChange={(e) => {
                                            const emails = e.target.value.split(',').map(email => email.trim()).filter(email => email.length > 0);
                                            saveCourse({ ...course, lecturers: emails });
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setShowCourseSettings(false)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-8 rounded-xl shadow-sm transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scheduling Popover Modal */}
            {focusedScheduleNode && (() => {
                let targetNode: Section | Subsection | null = null;
                for (const sec of course?.sections || []) {
                    if (sec.id === focusedScheduleNode) targetNode = sec;
                    for (const sub of sec.subsections) {
                        if (sub.id === focusedScheduleNode) targetNode = sub;
                    }
                }
                if (!targetNode) return null;

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                    <Calendar className="text-amber-500" size={20} />
                                    Schedule Options
                                </h3>
                                <button onClick={() => setFocusedScheduleNode(null)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-5 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Publish Status</label>
                                    <select
                                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                                        value={targetNode.status || 'draft'}
                                        onChange={(e) => {
                                            const newSections = [...course!.sections];
                                            for (let i = 0; i < newSections.length; i++) {
                                                if (newSections[i].id === focusedScheduleNode) {
                                                    newSections[i].status = e.target.value as any;
                                                }
                                                for (let j = 0; j < newSections[i].subsections.length; j++) {
                                                    if (newSections[i].subsections[j].id === focusedScheduleNode) {
                                                        newSections[i].subsections[j].status = e.target.value as any;
                                                    }
                                                }
                                            }
                                            saveCourse({ ...course!, sections: newSections });
                                        }}
                                    >
                                        <option value="draft">Draft (Hidden, Greyed out)</option>
                                        <option value="scheduled">Scheduled (Shows date)</option>
                                        <option value="published">Published (Visible)</option>
                                        <option value="none">None (Completely removed)</option>
                                    </select>
                                </div>

                                {targetNode.status === 'scheduled' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Publish Date & Time (KST)</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                                            value={targetNode.publishDate || ''}
                                            onChange={(e) => {
                                                const newSections = [...course!.sections];
                                                for (let i = 0; i < newSections.length; i++) {
                                                    if (newSections[i].id === focusedScheduleNode) {
                                                        newSections[i].publishDate = e.target.value;
                                                    }
                                                    for (let j = 0; j < newSections[i].subsections.length; j++) {
                                                        if (newSections[i].subsections[j].id === focusedScheduleNode) {
                                                            newSections[i].subsections[j].publishDate = e.target.value;
                                                        }
                                                    }
                                                }
                                                saveCourse({ ...course!, sections: newSections });
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                                <button onClick={() => setFocusedScheduleNode(null)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors">
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

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
