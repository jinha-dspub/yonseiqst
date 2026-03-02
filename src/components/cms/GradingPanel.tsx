"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Course, QuizProblem, AssignmentProblem, DescriptiveProblem } from '@/lib/lms/types';
import { CheckCircle2, AlertCircle, Clock, User, FileText, Download, ChevronDown, ChevronRight, Search, Filter, Save, MessageSquare } from 'lucide-react';

interface GradingPanelProps {
    course: Course;
    courseId: string;
}

interface Submission {
    id: string;
    user_id: string;
    course_id: string;
    component_id: string;
    answers: Record<string, any>;
    results: Record<string, { correct: boolean; message: string }>;
    score: number;
    max_score: number;
    attempt_count: number;
    submitted_at: string;
    manual_grades?: Record<string, { score: number; feedback: string; gradedAt: string }>;
    graded_by?: string;
    graded_at?: string;
    // Joined from auth.users
    user_email?: string;
}

interface QuizComponentInfo {
    componentId: string;
    unitTitle: string;
    subsectionTitle: string;
    sectionTitle: string;
    componentTitle: string;
    problems: QuizProblem[];
}

export default function GradingPanel({ course, courseId }: GradingPanelProps) {
    const supabase = createClient();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'problems' | 'students'>('problems');
    const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
    const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [gradeInputs, setGradeInputs] = useState<Record<string, { score: number; feedback: string }>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

    // Extract all quiz components from course
    const quizComponents: QuizComponentInfo[] = [];
    course.sections.forEach(sec => {
        sec.subsections.forEach(sub => {
            sub.units.forEach(unit => {
                unit.components.forEach(comp => {
                    if (comp.type === 'quiz') {
                        let problems: QuizProblem[] = [];
                        try {
                            const parsed = JSON.parse(comp.content);
                            if (Array.isArray(parsed.problems)) {
                                problems = parsed.problems;
                            }
                        } catch {}
                        // Only include if has descriptive or assignment problems
                        const needsGrading = problems.some(p => p.type === 'descriptive' || p.type === 'assignment');
                        if (needsGrading) {
                            quizComponents.push({
                                componentId: comp.id,
                                unitTitle: unit.title,
                                subsectionTitle: sub.title,
                                sectionTitle: sec.title,
                                componentTitle: comp.title,
                                problems
                            });
                        }
                    }
                });
            });
        });
    });

    // Load submissions
    const loadSubmissions = useCallback(async () => {
        setLoading(true);
        const componentIds = quizComponents.map(c => c.componentId);
        if (componentIds.length === 0) {
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('quiz_submissions')
            .select('*')
            .eq('course_id', courseId)
            .in('component_id', componentIds)
            .order('submitted_at', { ascending: false });

        if (data) {
            setSubmissions(data);
            
            // Load user profiles (try profiles table, then users table as fallback)
            const userIds = [...new Set(data.map(s => s.user_id))];
            if (userIds.length > 0) {
                const profiles: Record<string, string> = {};
                for (const uid of userIds) {
                    // Try profiles table first
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('full_name, email')
                        .eq('id', uid)
                        .single();
                    if (profileData && (profileData.full_name || profileData.email)) {
                        profiles[uid] = profileData.full_name || profileData.email;
                    } else {
                        // Fallback to users table (legacy)
                        const { data: userData } = await supabase
                            .from('users')
                            .select('name, email')
                            .eq('id', uid)
                            .single();
                        if (userData) {
                            profiles[uid] = userData.name || userData.email || uid.slice(0, 8);
                        } else {
                            profiles[uid] = uid.slice(0, 8) + '...';
                        }
                    }
                }
                setUserProfiles(profiles);
            }
        }
        setLoading(false);
    }, [courseId, quizComponents.length]);

    useEffect(() => {
        loadSubmissions();
    }, []);

    // Auto-select first component
    useEffect(() => {
        if (!selectedComponent && quizComponents.length > 0) {
            setSelectedComponent(quizComponents[0].componentId);
        }
    }, [quizComponents.length]);

    // Save manual grade
    const saveGrade = async (submissionId: string, probId: string, score: number, feedback: string) => {
        const key = `${submissionId}_${probId}`;
        setSaving(prev => ({ ...prev, [key]: true }));
        
        const submission = submissions.find(s => s.id === submissionId);
        if (!submission) return;

        const currentGrades = submission.manual_grades || {};
        const updatedGrades = {
            ...currentGrades,
            [probId]: { score, feedback, gradedAt: new Date().toISOString() }
        };

        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
            .from('quiz_submissions')
            .update({
                manual_grades: updatedGrades,
                graded_by: user?.id,
                graded_at: new Date().toISOString()
            })
            .eq('id', submissionId);

        if (!error) {
            setSubmissions(prev => prev.map(s => 
                s.id === submissionId 
                    ? { ...s, manual_grades: updatedGrades, graded_by: user?.id, graded_at: new Date().toISOString() }
                    : s
            ));
        }
        
        setSaving(prev => ({ ...prev, [key]: false }));
    };

    // Get grading status counts
    const getGradingStats = () => {
        let total = 0;
        let graded = 0;
        let pending = 0;

        submissions.forEach(sub => {
            const comp = quizComponents.find(c => c.componentId === sub.component_id);
            if (!comp) return;
            comp.problems.forEach(prob => {
                if (prob.type === 'descriptive' || prob.type === 'assignment') {
                    total++;
                    if (sub.manual_grades?.[prob.id]) {
                        graded++;
                    } else {
                        pending++;
                    }
                }
            });
        });

        return { total, graded, pending };
    };

    const stats = getGradingStats();
    const selectedComp = quizComponents.find(c => c.componentId === selectedComponent);
    const gradableProblems = selectedComp?.problems.filter(p => p.type === 'descriptive' || p.type === 'assignment') || [];
    const componentSubmissions = submissions.filter(s => s.component_id === selectedComponent);

    // Student view data
    const uniqueStudents = [...new Set(submissions.map(s => s.user_id))];
    const filteredStudents = uniqueStudents.filter(uid => {
        const name = userProfiles[uid] || uid;
        return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sm text-slate-500 font-medium">Loading submissions...</p>
                </div>
            </div>
        );
    }

    if (quizComponents.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <MessageSquare size={48} className="text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-600 mb-2">채점할 문제가 없습니다</h3>
                    <p className="text-sm text-slate-400">이 코스에 Descriptive 또는 Assignment Report 유형의 문제가 없습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-slate-800">📋 Grading Center</h2>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-lg">⏳ 미채점 {stats.pending}</span>
                            <span className="bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-lg">✅ 완료 {stats.graded}</span>
                            <span className="bg-slate-100 text-slate-500 font-bold px-2.5 py-1 rounded-lg">전체 {stats.total}</span>
                        </div>
                    </div>
                </div>
                
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('problems')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                            viewMode === 'problems' 
                                ? 'bg-emerald-600 text-white shadow-md' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        📝 문제별 채점
                    </button>
                    <button
                        onClick={() => setViewMode('students')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                            viewMode === 'students' 
                                ? 'bg-emerald-600 text-white shadow-md' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        👤 학생별 보기
                    </button>
                </div>
            </div>

            {viewMode === 'problems' ? (
                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Component/Problem Selector */}
                    <div className="w-72 bg-slate-50 border-r border-slate-200 overflow-y-auto">
                        <div className="p-3 space-y-1">
                            {quizComponents.map(comp => {
                                const compSubs = submissions.filter(s => s.component_id === comp.componentId);
                                const gradable = comp.problems.filter(p => p.type === 'descriptive' || p.type === 'assignment');
                                const isExpanded = selectedComponent === comp.componentId;
                                
                                return (
                                    <div key={comp.componentId}>
                                        <button
                                            onClick={() => { setSelectedComponent(comp.componentId); setSelectedProblem(null); }}
                                            className={`w-full text-left p-3 rounded-lg transition-all ${
                                                isExpanded ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-white border border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? <ChevronDown size={14} className="text-emerald-500" /> : <ChevronRight size={14} className="text-slate-400" />}
                                                <span className="text-xs font-bold text-slate-500 truncate">{comp.sectionTitle} &gt; {comp.subsectionTitle}</span>
                                            </div>
                                            <div className="ml-5 mt-1 text-sm font-bold text-slate-800 truncate">{comp.componentTitle || comp.unitTitle}</div>
                                            <div className="ml-5 mt-1 flex items-center gap-2 text-[10px]">
                                                <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">{compSubs.length}명 제출</span>
                                                <span className="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-bold">{gradable.length}문제</span>
                                            </div>
                                        </button>
                                        
                                        {isExpanded && (
                                            <div className="ml-5 pl-3 border-l-2 border-emerald-200 mt-1 space-y-1">
                                                <button
                                                    onClick={() => setSelectedProblem(null)}
                                                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-bold transition-all ${
                                                        !selectedProblem ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-white'
                                                    }`}
                                                >
                                                    📊 전체 보기
                                                </button>
                                                {gradable.map((prob, pIdx) => {
                                                    const ungradedCount = compSubs.filter(s => !s.manual_grades?.[prob.id]).length;
                                                    return (
                                                        <button
                                                            key={prob.id}
                                                            onClick={() => setSelectedProblem(prob.id)}
                                                            className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all ${
                                                                selectedProblem === prob.id ? 'bg-emerald-100 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-white'
                                                            }`}
                                                        >
                                                            <span className="font-bold">Q{pIdx + 1}.</span> {prob.type === 'assignment' ? '📎 과제' : '📝 서술형'}
                                                            {ungradedCount > 0 && (
                                                                <span className="ml-1 bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold">{ungradedCount}</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Grading Area */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {selectedComp && (
                            <div className="max-w-4xl mx-auto space-y-6">
                                {/* Problem header */}
                                {selectedProblem && (() => {
                                    const prob = gradableProblems.find(p => p.id === selectedProblem);
                                    if (!prob) return null;
                                    const probIdx = gradableProblems.indexOf(prob);
                                    return (
                                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5">
                                            <div className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-2">
                                                {prob.type === 'assignment' ? '📎 Assignment Report' : '📝 Descriptive'} · {prob.points}점
                                            </div>
                                            <p className="text-base text-slate-800 font-medium leading-relaxed">{prob.question}</p>
                                        </div>
                                    );
                                })()}

                                {/* Submissions List */}
                                {componentSubmissions.length === 0 ? (
                                    <div className="text-center py-16 text-slate-400">
                                        <FileText size={40} className="mx-auto mb-3 opacity-50" />
                                        <p className="font-medium">아직 제출된 답안이 없습니다</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {componentSubmissions.map(sub => {
                                            const problemsToShow = selectedProblem 
                                                ? gradableProblems.filter(p => p.id === selectedProblem)
                                                : gradableProblems;

                                            return (
                                                <div key={sub.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                                    {/* Student header */}
                                                    <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">
                                                                <User size={16} />
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-sm text-slate-800">{userProfiles[sub.user_id] || sub.user_id.slice(0, 8)}</span>
                                                                <div className="text-[10px] text-slate-400 font-medium">
                                                                    제출: {new Date(sub.submitted_at).toLocaleString('ko-KR')} · 시도 {sub.attempt_count}회
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {sub.graded_at && (
                                                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded-lg">
                                                                ✅ 채점됨 {new Date(sub.graded_at).toLocaleDateString('ko-KR')}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Per-problem grading */}
                                                    <div className="divide-y divide-slate-100">
                                                        {problemsToShow.map((prob, pIdx) => {
                                                            const answer = sub.answers?.[prob.id];
                                                            const existingGrade = sub.manual_grades?.[prob.id];
                                                            const gradeKey = `${sub.id}_${prob.id}`;
                                                            const input = gradeInputs[gradeKey] || { 
                                                                score: existingGrade?.score ?? 0, 
                                                                feedback: existingGrade?.feedback ?? '' 
                                                            };

                                                            return (
                                                                <div key={prob.id} className="p-5">
                                                                    {!selectedProblem && (
                                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                                                            Q{pIdx + 1}. {prob.type === 'assignment' ? '📎 과제' : '📝 서술형'} ({prob.points}점)
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Student's answer */}
                                                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                                                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">학생 답안</label>
                                                                        {answer ? (
                                                                            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{String(answer)}</p>
                                                                        ) : (
                                                                            <p className="text-sm text-slate-400 italic">답안 없음</p>
                                                                        )}
                                                                    </div>

                                                                    {/* TODO: Show uploaded files for assignment type */}

                                                                    {/* Grading inputs */}
                                                                    <div className="flex gap-4 items-start">
                                                                        <div className="flex flex-col gap-1 w-28 shrink-0">
                                                                            <label className="text-[10px] font-bold text-slate-500 uppercase">점수</label>
                                                                            <div className="flex items-center gap-1">
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max={prob.points}
                                                                                    className="w-full bg-white border-2 border-slate-200 rounded-lg p-2 text-sm text-slate-900 font-bold text-center focus:outline-none focus:border-emerald-500"
                                                                                    value={input.score}
                                                                                    onChange={(e) => setGradeInputs(prev => ({
                                                                                        ...prev,
                                                                                        [gradeKey]: { ...input, score: Math.min(prob.points, Math.max(0, parseInt(e.target.value) || 0)) }
                                                                                    }))}
                                                                                />
                                                                                <span className="text-xs text-slate-400 font-bold">/ {prob.points}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex-1 flex flex-col gap-1">
                                                                            <label className="text-[10px] font-bold text-slate-500 uppercase">피드백</label>
                                                                            <textarea
                                                                                className="w-full bg-white border-2 border-slate-200 rounded-lg p-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 min-h-[60px] resize-y"
                                                                                placeholder="학생에게 보일 피드백을 작성하세요..."
                                                                                value={input.feedback}
                                                                                onChange={(e) => setGradeInputs(prev => ({
                                                                                    ...prev,
                                                                                    [gradeKey]: { ...input, feedback: e.target.value }
                                                                                }))}
                                                                            />
                                                                        </div>
                                                                        <button
                                                                            onClick={() => saveGrade(sub.id, prob.id, input.score, input.feedback)}
                                                                            disabled={saving[gradeKey]}
                                                                            className={`mt-5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
                                                                                existingGrade 
                                                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                                                                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                                                                            }`}
                                                                        >
                                                                            {saving[gradeKey] ? (
                                                                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                            ) : (
                                                                                <Save size={14} />
                                                                            )}
                                                                            {existingGrade ? '수정' : '저장'}
                                                                        </button>
                                                                    </div>

                                                                    {existingGrade && (
                                                                        <div className="mt-2 text-[10px] text-emerald-500 font-medium">
                                                                            ✅ 채점 완료: {existingGrade.score}/{prob.points}점 · {new Date(existingGrade.gradedAt).toLocaleString('ko-KR')}
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
                        )}
                    </div>
                </div>
            ) : (
                /* Student View */
                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Student List */}
                    <div className="w-72 bg-slate-50 border-r border-slate-200 overflow-y-auto flex flex-col">
                        <div className="p-3">
                            <div className="relative mb-3">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                                    placeholder="학생 검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 space-y-1">
                            {filteredStudents.map(uid => {
                                const studentSubs = submissions.filter(s => s.user_id === uid);
                                const totalGradable = studentSubs.reduce((sum, s) => {
                                    const comp = quizComponents.find(c => c.componentId === s.component_id);
                                    return sum + (comp?.problems.filter(p => p.type === 'descriptive' || p.type === 'assignment').length || 0);
                                }, 0);
                                const totalGraded = studentSubs.reduce((sum, s) => {
                                    const comp = quizComponents.find(c => c.componentId === s.component_id);
                                    return sum + (comp?.problems.filter(p => (p.type === 'descriptive' || p.type === 'assignment') && s.manual_grades?.[p.id]).length || 0);
                                }, 0);

                                return (
                                    <button
                                        key={uid}
                                        onClick={() => setSelectedStudent(uid)}
                                        className={`w-full text-left p-3 rounded-lg transition-all ${
                                            selectedStudent === uid ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-white border border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center text-xs font-bold"><User size={14} /></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-slate-800 truncate">{userProfiles[uid] || uid.slice(0, 8)}</div>
                                                <div className="text-[10px] text-slate-400">{studentSubs.length}개 제출 · {totalGraded}/{totalGradable} 채점</div>
                                            </div>
                                            {totalGraded === totalGradable && totalGradable > 0 && (
                                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Student Detail */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {selectedStudent ? (
                            <div className="max-w-4xl mx-auto space-y-4">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center"><User size={20} /></div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">{userProfiles[selectedStudent] || selectedStudent.slice(0, 8)}</h3>
                                        <p className="text-xs text-slate-400">ID: {selectedStudent}</p>
                                    </div>
                                </div>

                                {submissions.filter(s => s.user_id === selectedStudent).map(sub => {
                                    const comp = quizComponents.find(c => c.componentId === sub.component_id);
                                    if (!comp) return null;
                                    const gradable = comp.problems.filter(p => p.type === 'descriptive' || p.type === 'assignment');
                                    if (gradable.length === 0) return null;

                                    return (
                                        <div key={sub.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                            <div className="bg-slate-50 border-b border-slate-100 px-5 py-3">
                                                <div className="text-xs font-bold text-slate-500">{comp.sectionTitle} &gt; {comp.subsectionTitle}</div>
                                                <div className="text-sm font-bold text-slate-800 mt-0.5">{comp.componentTitle || comp.unitTitle}</div>
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    자동 점수: {sub.score}/{sub.max_score} · 제출: {new Date(sub.submitted_at).toLocaleString('ko-KR')}
                                                </div>
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {gradable.map((prob, pIdx) => {
                                                    const answer = sub.answers?.[prob.id];
                                                    const existingGrade = sub.manual_grades?.[prob.id];
                                                    const gradeKey = `${sub.id}_${prob.id}`;
                                                    const input = gradeInputs[gradeKey] || { 
                                                        score: existingGrade?.score ?? 0, 
                                                        feedback: existingGrade?.feedback ?? '' 
                                                    };

                                                    return (
                                                        <div key={prob.id} className="p-5">
                                                            <div className="text-xs font-bold text-purple-600 mb-2">
                                                                Q{pIdx + 1}. {prob.question}
                                                                <span className="ml-2 text-slate-400">({prob.points}점)</span>
                                                            </div>
                                                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                                                                {answer ? (
                                                                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{String(answer)}</p>
                                                                ) : (
                                                                    <p className="text-sm text-slate-400 italic">답안 없음</p>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-3 items-start">
                                                                <div className="w-24 shrink-0">
                                                                    <label className="text-[10px] font-bold text-slate-500">점수</label>
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="number" min="0" max={prob.points}
                                                                            className="w-full bg-white border-2 border-slate-200 rounded-lg p-1.5 text-sm text-slate-900 font-bold text-center focus:outline-none focus:border-emerald-500"
                                                                            value={input.score}
                                                                            onChange={(e) => setGradeInputs(prev => ({
                                                                                ...prev,
                                                                                [gradeKey]: { ...input, score: Math.min(prob.points, Math.max(0, parseInt(e.target.value) || 0)) }
                                                                            }))}
                                                                        />
                                                                        <span className="text-xs text-slate-400 font-bold whitespace-nowrap">/ {prob.points}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <label className="text-[10px] font-bold text-slate-500">피드백</label>
                                                                    <input
                                                                        type="text"
                                                                        className="w-full bg-white border-2 border-slate-200 rounded-lg p-1.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                                                                        placeholder="피드백..."
                                                                        value={input.feedback}
                                                                        onChange={(e) => setGradeInputs(prev => ({
                                                                            ...prev,
                                                                            [gradeKey]: { ...input, feedback: e.target.value }
                                                                        }))}
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => saveGrade(sub.id, prob.id, input.score, input.feedback)}
                                                                    disabled={saving[gradeKey]}
                                                                    className="mt-4 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 shrink-0"
                                                                >
                                                                    <Save size={12} /> {existingGrade ? '수정' : '저장'}
                                                                </button>
                                                            </div>
                                                            {existingGrade && (
                                                                <div className="mt-1 text-[10px] text-emerald-500 font-medium">✅ {existingGrade.score}/{prob.points}점</div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                <div className="text-center">
                                    <User size={40} className="mx-auto mb-3 opacity-50" />
                                    <p className="font-medium">왼쪽에서 학생을 선택하세요</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
