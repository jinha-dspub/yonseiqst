"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, AlertCircle, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { getCourses } from '@/lib/courseService';
import { Course, QuizProblem } from '@/lib/lms/types';
import { useLocale } from 'next-intl';

export default function GradesPage() {
    const router = useRouter();
    const locale = useLocale();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<Course[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push(`/${locale}`); return; }

            // Load all courses
            const allCourses = await getCourses();
            setCourses(allCourses);

            // Load all quiz submissions for this user
            const { data: subs } = await supabase
                .from('quiz_submissions')
                .select('*')
                .eq('user_id', user.id)
                .order('submitted_at', { ascending: false });
            
            if (subs) setSubmissions(subs);
            setLoading(false);
        })();
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    // Build grade data per course
    const courseGradeData = courses.map(course => {
        const courseSubmissions = submissions.filter(s => s.course_id === course.id);
        
        // Find all quiz components in this course
        const quizComponents: { id: string; title: string; problems: QuizProblem[] }[] = [];
        course.sections.forEach(sec => {
            sec.subsections.forEach(sub => {
                sub.units.forEach(unit => {
                    unit.components.forEach(comp => {
                        if (comp.type === 'quiz') {
                            let problems: QuizProblem[] = [];
                            try { problems = JSON.parse(comp.content).problems || []; } catch {}
                            quizComponents.push({ id: comp.id, title: comp.title || unit.title, problems });
                        }
                    });
                });
            });
        });

        const totalAutoScore = courseSubmissions.reduce((s, sub) => s + (sub.score || 0), 0);
        const totalMaxScore = courseSubmissions.reduce((s, sub) => s + (sub.max_score || 0), 0);

        // Manual grades
        let totalManualScore = 0;
        let totalManualMax = 0;
        let pendingGrading = 0;

        courseSubmissions.forEach(sub => {
            const comp = quizComponents.find(c => c.id === sub.component_id);
            if (!comp) return;
            comp.problems.forEach(prob => {
                if (prob.type === 'descriptive' || prob.type === 'assignment') {
                    totalManualMax += prob.points;
                    if (sub.manual_grades?.[prob.id]) {
                        totalManualScore += sub.manual_grades[prob.id].score;
                    } else {
                        pendingGrading++;
                    }
                }
            });
        });

        return {
            course,
            courseSubmissions,
            quizComponents,
            totalAutoScore,
            totalMaxScore,
            totalManualScore,
            totalManualMax,
            pendingGrading
        };
    }).filter(d => d.courseSubmissions.length > 0);

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-600 text-white p-2 rounded-lg">
                        <ClipboardList size={24} />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl font-black text-slate-800">📋 성적표</h1>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">My Grades</p>
                    </div>
                </div>
                <button
                    onClick={() => router.push(`/${locale}/lms`)}
                    className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 px-3 py-2 border border-slate-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                    <ArrowLeft size={16} /> 돌아가기
                </button>
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-8">
                {courseGradeData.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
                        <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-600 mb-2">아직 성적이 없습니다</h3>
                        <p className="text-slate-400">퀴즈나 과제를 제출하면 여기서 성적을 확인할 수 있습니다.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {courseGradeData.map(({ course, courseSubmissions, quizComponents, totalAutoScore, totalMaxScore, totalManualScore, totalManualMax, pendingGrading }) => {
                            const isExpanded = expandedCourse === course.id;
                            const overallPercent = totalMaxScore > 0 ? Math.round((totalAutoScore / totalMaxScore) * 100) : 0;

                            return (
                                <div key={course.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                    {/* Course Header */}
                                    <button
                                        onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                                        className="w-full text-left p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${overallPercent >= 80 ? 'bg-emerald-100 text-emerald-600' : overallPercent >= 60 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                                                <span className="text-lg font-black">{overallPercent}%</span>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate">{course.title}</h3>
                                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">자동채점 {totalAutoScore}/{totalMaxScore}</span>
                                                    {totalManualMax > 0 && (
                                                        <span className="font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">수동채점 {totalManualScore}/{totalManualMax}</span>
                                                    )}
                                                    {pendingGrading > 0 && (
                                                        <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">⏳ {pendingGrading}건 채점 대기</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronDown size={20} className="text-slate-400 shrink-0" /> : <ChevronRight size={20} className="text-slate-400 shrink-0" />}
                                    </button>

                                    {/* Expanded: per-quiz details */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 divide-y divide-slate-100">
                                            {courseSubmissions.map(sub => {
                                                const comp = quizComponents.find(c => c.id === sub.component_id);
                                                const autoPercent = sub.max_score > 0 ? Math.round((sub.score / sub.max_score) * 100) : 0;

                                                return (
                                                    <div key={sub.id} className="p-4 sm:p-5">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div>
                                                                <h4 className="font-bold text-sm text-slate-800">{comp?.title || sub.component_id.slice(0, 10)}</h4>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                                    제출: {new Date(sub.submitted_at).toLocaleString('ko-KR')} · {sub.attempt_count}회 시도
                                                                </p>
                                                            </div>
                                                            <div className={`text-sm font-black px-3 py-1 rounded-lg ${autoPercent >= 80 ? 'bg-emerald-100 text-emerald-700' : autoPercent >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                                {sub.score}/{sub.max_score}
                                                            </div>
                                                        </div>

                                                        {/* Show manual grade feedback */}
                                                        {sub.manual_grades && Object.keys(sub.manual_grades).length > 0 && (
                                                            <div className="mt-3 space-y-2">
                                                                {Object.entries(sub.manual_grades).map(([probId, grade]: [string, any]) => {
                                                                    const prob = comp?.problems.find((p: any) => p.id === probId);
                                                                    return (
                                                                        <div key={probId} className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                                                                            <div className="flex items-center justify-between mb-1">
                                                                                <span className="text-xs font-bold text-purple-700">
                                                                                    {prob?.type === 'assignment' ? '📎 과제' : '📝 서술형'} 교수자 채점
                                                                                </span>
                                                                                <span className="text-xs font-bold text-purple-600">{grade.score}/{prob?.points || '?'}점</span>
                                                                            </div>
                                                                            {grade.feedback && (
                                                                                <p className="text-xs text-purple-700 mt-1 italic">💬 {grade.feedback}</p>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Auto-grading results */}
                                                        {sub.results && (
                                                            <div className="mt-2 flex flex-wrap gap-1">
                                                                {Object.entries(sub.results).map(([probId, result]: [string, any]) => (
                                                                    <span key={probId} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${result.correct ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                                        {result.correct ? '✅' : '❌'}
                                                                    </span>
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
            </main>
        </div>
    );
}
