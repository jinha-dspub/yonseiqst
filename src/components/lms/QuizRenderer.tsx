"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { QuizProblem, MultipleChoiceProblem, ShortAnswerProblem, DescriptiveProblem, AssignmentProblem } from '@/lib/lms/types';
import { CheckCircle2, AlertCircle, Loader2, Upload, FileText, X } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';

interface QuizRendererProps {
    content: string; // The JSON string (for manual mode)
    componentId?: string; // Unique ID for this quiz component
    courseId?: string; // Course ID for persistence
    onComplete: (score: number, maxScore: number, answers: any) => void;
    // Bank-based quiz props
    quizBankId?: string;
    quizMode?: 'all' | 'random' | 'select';
    questionCount?: number;
    selectedQuestionIds?: string[];
    reshuffleOnRetry?: boolean;
    isGraded?: boolean;
    passingScore?: number;
    maxAttempts?: number;
}

export default function QuizRenderer({ content, componentId, courseId, onComplete, quizBankId, quizMode, questionCount, selectedQuestionIds, reshuffleOnRetry, isGraded, passingScore, maxAttempts }: QuizRendererProps) {
    const [problems, setProblems] = useState<QuizProblem[]>([]);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [results, setResults] = useState<Record<string, { correct: boolean; message: string }>>({});
    const [totalScore, setTotalScore] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [attemptCount, setAttemptCount] = useState(0);
    const [retryTrigger, setRetryTrigger] = useState(0);
    const [uploadedFiles, setUploadedFiles] = useState<Record<string, { name: string; size: number; type: string; data: string }[]>>({});

    const supabase = createClient();

    const handleFileUpload = (probId: string, files: FileList | null, allowedTypes?: string[], maxSizeMB?: number) => {
        if (!files) return;
        const maxSize = (maxSizeMB || 10) * 1024 * 1024;
        const existing = uploadedFiles[probId] || [];
        const newFiles: { name: string; size: number; type: string; data: string }[] = [];

        Array.from(files).forEach(file => {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(ext)) {
                alert(`"${file.name}" 파일 형식이 허용되지 않습니다. 허용: ${allowedTypes.join(', ')}`);
                return;
            }
            if (file.size > maxSize) {
                alert(`"${file.name}" 파일이 너무 큽니다. 최대 ${maxSizeMB || 10}MB`);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                newFiles.push({ name: file.name, size: file.size, type: file.type, data: reader.result as string });
                if (newFiles.length === Array.from(files).filter(f => {
                    const fExt = f.name.split('.').pop()?.toLowerCase() || '';
                    return (!allowedTypes || allowedTypes.length === 0 || allowedTypes.includes(fExt)) && f.size <= maxSize;
                }).length) {
                    setUploadedFiles(prev => ({ ...prev, [probId]: [...existing, ...newFiles] }));
                }
            };
            reader.readAsDataURL(file);
        });
    };

    // Convert a DB question row to QuizProblem format
    const dbToQuizProblem = (q: any): QuizProblem => {
        const base = { id: q.id, question: q.question, imageUrl: q.image_url || undefined, points: q.points || 5, explanation: q.explanation || undefined };
        if (q.type === 'multiple_choice') {
            return { ...base, type: 'multiple_choice', options: q.options || [], answer: q.answer_data?.answer ?? 0 } as QuizProblem;
        } else if (q.type === 'short_answer') {
            return { ...base, type: 'short_answer', acceptable_answers: q.answer_data?.acceptable_answers || [] } as QuizProblem;
        } else {
            return { ...base, type: 'descriptive', min_length: q.answer_data?.min_length, keywords: q.answer_data?.keywords || [] } as QuizProblem;
        }
    };

    // Shuffle helper
    const shuffleArray = <T,>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
    };

    // Load quiz content — either from bank or from JSON content
    useEffect(() => {
        if (quizBankId && quizBankId !== '_pending') {
            // Bank-based loading
            (async () => {
                let query = supabase.from('questions').select('*').eq('bank_id', quizBankId).order('sort_order', { ascending: true });
                const { data } = await query;
                if (!data) return;

                let qs = data.map(dbToQuizProblem);

                // Apply mode
                if (quizMode === 'select' && selectedQuestionIds?.length) {
                    qs = qs.filter(q => selectedQuestionIds.includes(q.id));
                } else if (quizMode === 'random') {
                    const count = questionCount || Math.min(10, qs.length);
                    qs = shuffleArray(qs).slice(0, count);
                }
                // 'all' mode uses all questions

                setProblems(qs);
            })();
        } else {
            // Manual JSON-based loading
            try {
                if (content && content.startsWith('{')) {
                    const parsed = JSON.parse(content);
                    if (parsed && Array.isArray(parsed.problems)) {
                        setProblems(parsed.problems);
                    }
                } else if (content && content.trim()) {
                    setProblems([{
                        id: 'legacy_prob',
                        type: 'descriptive',
                        question: content,
                        points: 10
                    } as DescriptiveProblem]);
                }
            } catch (e) {
                console.error("Failed to parse quiz json", e);
            }
        }
    }, [content, quizBankId, quizMode, questionCount, retryTrigger]);

    // Load saved submission from Supabase
    useEffect(() => {
        if (!componentId || !courseId) {
            setIsLoading(false);
            return;
        }

        const loadSubmission = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { setIsLoading(false); return; }

                const { data } = await supabase
                    .from('quiz_submissions')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('course_id', courseId)
                    .eq('component_id', componentId)
                    .maybeSingle();

                if (data) {
                    setAnswers(data.answers || {});
                    setResults(data.results || {});
                    setTotalScore(data.score || 0);
                    setAttemptCount(data.attempt_count || 1);
                    setIsSubmitted(true);
                }
            } catch (e) {
                console.error("Failed to load quiz submission", e);
            } finally {
                setIsLoading(false);
            }
        };

        loadSubmission();
    }, [componentId, courseId, supabase]);

    const handleAnswerChange = (probId: string, value: any) => {
        if (isSubmitted) return;
        setAnswers(prev => ({ ...prev, [probId]: value }));
    };

    // Retry handler
    const handleRetry = () => {
        setAnswers({});
        setResults({});
        setTotalScore(0);
        setIsSubmitted(false);
        // If reshuffleOnRetry and using random bank mode, reload with new shuffle
        if (reshuffleOnRetry && quizBankId && quizMode === 'random') {
            setRetryTrigger(prev => prev + 1);
        }
    };

    const handleSubmit = async () => {
        let earned = 0;
        let possible = 0;
        const grading: Record<string, { correct: boolean; message: string }> = {};

        problems.forEach(prob => {
            possible += prob.points;
            const ans = answers[prob.id];

            if (prob.type === 'multiple_choice') {
                const p = prob as MultipleChoiceProblem;
                if (ans === p.answer) {
                    earned += prob.points;
                    grading[prob.id] = { correct: true, message: 'Correct!' };
                } else {
                    grading[prob.id] = { correct: false, message: 'Incorrect answer.' };
                }
            } else if (prob.type === 'short_answer') {
                const p = prob as ShortAnswerProblem;
                const normalizedAns = String(ans || '').trim().toLowerCase();
                const isMatch = p.acceptable_answers.some(a => a.trim().toLowerCase() === normalizedAns);
                if (isMatch) {
                    earned += prob.points;
                    grading[prob.id] = { correct: true, message: 'Correct!' };
                } else {
                    grading[prob.id] = { correct: false, message: 'Incorrect answer.' };
                }
            } else if (prob.type === 'descriptive') {
                const p = prob as DescriptiveProblem;
                const textAns = String(ans || '');
                let correct = true;
                let msgs = [];
                
                if (p.min_length && textAns.length < p.min_length) {
                    correct = false;
                    msgs.push(`Too short. Requires at least ${p.min_length} characters.`);
                }
                
                if (p.keywords && p.keywords.length > 0) {
                    const missing = p.keywords.filter(k => !textAns.includes(k));
                    if (missing.length > 0) {
                        correct = false;
                        msgs.push(`Missing keywords: ${missing.join(', ')}`);
                    }
                }
                
                if (correct) {
                    earned += prob.points;
                    grading[prob.id] = { correct: true, message: 'Good response.' };
                } else {
                    grading[prob.id] = { correct: false, message: msgs.join(' ') };
                }
            } else if (prob.type === 'assignment') {
                const p = prob as AssignmentProblem;
                const textAns = String(ans || '');
                const files = uploadedFiles[prob.id] || [];
                let correct = true;
                let msgs = [];

                if (p.requireText !== false && p.min_length && textAns.length < p.min_length) {
                    correct = false;
                    msgs.push(`텍스트가 너무 짧습니다. 최소 ${p.min_length}자 이상 작성해주세요.`);
                }
                if (files.length === 0) {
                    correct = false;
                    msgs.push('파일을 최소 1개 이상 업로드해주세요.');
                }

                if (correct) {
                    // Assignment is always "submitted" - manual grading later
                    grading[prob.id] = { correct: true, message: '보고서가 제출되었습니다. 교수자 채점 후 점수가 반영됩니다.' };
                } else {
                    grading[prob.id] = { correct: false, message: msgs.join(' ') };
                }
            }
        });

        setTotalScore(earned);
        setResults(grading);
        setIsSubmitted(true);
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        onComplete(earned, possible, answers);

        // Save to Supabase
        if (componentId && courseId) {
            setIsSaving(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase
                        .from('quiz_submissions')
                        .upsert({
                            user_id: user.id,
                            course_id: courseId,
                            component_id: componentId,
                            answers,
                            results: grading,
                            score: earned,
                            max_score: possible,
                            attempt_count: newAttemptCount,
                            submitted_at: new Date().toISOString()
                        }, { onConflict: 'user_id,course_id,component_id' });
                }
            } catch (e) {
                console.error("Failed to save quiz submission", e);
            } finally {
                setIsSaving(false);
            }
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 size={20} className="animate-spin" />
                <span className="font-medium">Loading quiz...</span>
            </div>
        );
    }

    if (problems.length === 0) {
        return <div className="text-slate-400 italic">No valid problems found in this quiz.</div>;
    }

    const maxScore = problems.reduce((acc, p) => acc + p.points, 0);

    return (
        <div className="flex flex-col gap-8">
            {problems.map((prob, idx) => (
                <div key={prob.id} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow">
                    <div className="bg-slate-50 border-b border-slate-100 p-4 flex gap-3 items-start">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm shrink-0">
                            {idx + 1}
                        </span>
                        <div className="flex-1 mt-1">
                            <h4 className="text-base font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">{prob.question}</h4>
                            {prob.imageUrl && (
                                <img src={prob.imageUrl} alt="Question image" className="mt-3 max-h-64 rounded-lg border border-slate-200 shadow-sm" />
                            )}
                            <div className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">{prob.points} Points</div>
                        </div>
                    </div>

                    <div className="p-5">
                        {prob.type === 'multiple_choice' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                                {(prob as MultipleChoiceProblem).options.map((opt, optIdx) => {
                                    const optText = typeof opt === 'string' ? opt : opt.text;
                                    const optImage = typeof opt === 'object' && opt.imageUrl ? opt.imageUrl : null;
                                    const isSelected = answers[prob.id] === optIdx;
                                    const isError = isSubmitted && results[prob.id] && !results[prob.id].correct && isSelected;
                                    const isSuccess = isSubmitted && (prob as MultipleChoiceProblem).answer === optIdx;
                                    
                                    let btnClass = "text-left px-4 py-3 border-2 rounded-xl transition-all font-medium ";
                                    if (isSuccess) btnClass += "bg-emerald-50 border-emerald-500 text-emerald-800";
                                    else if (isError) btnClass += "bg-red-50 border-red-500 text-red-800";
                                    else if (isSelected) btnClass += "bg-blue-50 border-blue-500 text-blue-800";
                                    else btnClass += "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50";

                                    return (
                                        <button 
                                            key={optIdx} 
                                            className={btnClass}
                                            onClick={() => handleAnswerChange(prob.id, optIdx)}
                                            disabled={isSubmitted}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected || isSuccess || isError ? 'border-transparent' : 'border-slate-300'}`}>
                                                    {(isSuccess) && <CheckCircle2 className="text-emerald-500" size={20} />}
                                                    {(isError && !isSuccess) && <AlertCircle className="text-red-500" size={20} />}
                                                    {(!isSubmitted && isSelected) && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="leading-snug">{optText}</span>
                                                    {optImage && <img src={optImage} alt="" className="max-h-20 rounded border border-slate-200" />}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {prob.type === 'short_answer' && (
                            <div className="pb-2">
                                <input
                                    type="text"
                                    className={`w-full p-4 bg-slate-50 border-2 rounded-xl focus:outline-none transition-colors ${
                                        isSubmitted 
                                            ? (results[prob.id]?.correct ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-red-500 bg-red-50 text-red-900') 
                                            : 'border-slate-200 focus:border-blue-500 text-slate-800'
                                    }`}
                                    placeholder="Type your exact answer..."
                                    value={answers[prob.id] || ''}
                                    onChange={(e) => handleAnswerChange(prob.id, e.target.value)}
                                    disabled={isSubmitted}
                                />
                            </div>
                        )}

                        {prob.type === 'descriptive' && (
                            <div className="pb-2">
                                <textarea
                                    className={`w-full p-4 bg-slate-50 border-2 rounded-xl focus:outline-none transition-colors min-h-[150px] resize-y ${
                                        isSubmitted 
                                            ? (results[prob.id]?.correct ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-red-500 bg-red-50 text-red-900') 
                                            : 'border-slate-200 focus:border-blue-500 text-slate-800'
                                    }`}
                                    placeholder="Write your answer..."
                                    value={answers[prob.id] || ''}
                                    onChange={(e) => handleAnswerChange(prob.id, e.target.value)}
                                    disabled={isSubmitted}
                                />
                                {(!isSubmitted && (prob as DescriptiveProblem).min_length) && (
                                    <div className="text-xs font-bold text-slate-400 mt-2 text-right">
                                        {(answers[prob.id] || '').length} / {(prob as DescriptiveProblem).min_length} chars minimum
                                    </div>
                                )}
                            </div>
                        )}

                        {prob.type === 'assignment' && (
                            <div className="pb-2 flex flex-col gap-4">
                                {/* Instructions */}
                                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-sm font-bold text-rose-700 mb-2">
                                        <Upload size={16} /> 📎 보고서 제출
                                    </div>
                                    <p className="text-xs text-rose-600">
                                        허용 파일: {((prob as AssignmentProblem).allowedFileTypes || ['pdf']).join(', ').toUpperCase()}
                                        {' • '} 최대 {(prob as AssignmentProblem).maxFileSize || 10}MB
                                        {(prob as AssignmentProblem).requireText !== false && ' • 텍스트 작성 필수'}
                                    </p>
                                </div>

                                {/* Text area */}
                                {(prob as AssignmentProblem).requireText !== false && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 mb-1 block">📝 보고서 내용</label>
                                        <textarea
                                            className={`w-full p-4 bg-white border-2 rounded-xl focus:outline-none transition-colors min-h-[180px] resize-y text-slate-900 ${
                                                isSubmitted 
                                                    ? (results[prob.id]?.correct ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50') 
                                                    : 'border-slate-200 focus:border-rose-400'
                                            }`}
                                            placeholder="보고서 내용을 작성해주세요..."
                                            value={answers[prob.id] || ''}
                                            onChange={(e) => handleAnswerChange(prob.id, e.target.value)}
                                            disabled={isSubmitted}
                                        />
                                        {!isSubmitted && (prob as AssignmentProblem).min_length && (
                                            <div className="text-xs font-bold text-slate-400 mt-1 text-right">
                                                {(answers[prob.id] || '').length} / {(prob as AssignmentProblem).min_length} 자 최소
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* File upload */}
                                <div>
                                    <label className="text-xs font-bold text-slate-600 mb-2 block">📄 파일 업로드</label>
                                    {!isSubmitted && (
                                        <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-rose-400 hover:bg-rose-50/30 transition-all">
                                            <Upload size={24} className="text-slate-400" />
                                            <span className="text-sm text-slate-500 font-medium">파일을 선택하거나 드래그하세요</span>
                                            <input
                                                type="file"
                                                multiple
                                                className="hidden"
                                                accept={((prob as AssignmentProblem).allowedFileTypes || []).map(t => `.${t}`).join(',')}
                                                onChange={(e) => handleFileUpload(
                                                    prob.id,
                                                    e.target.files,
                                                    (prob as AssignmentProblem).allowedFileTypes,
                                                    (prob as AssignmentProblem).maxFileSize
                                                )}
                                            />
                                        </label>
                                    )}
                                    {/* Uploaded files list */}
                                    {(uploadedFiles[prob.id] || []).length > 0 && (
                                        <div className="mt-3 flex flex-col gap-2">
                                            {(uploadedFiles[prob.id] || []).map((f, fIdx) => (
                                                <div key={fIdx} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                                    <FileText size={16} className="text-slate-400 shrink-0" />
                                                    <span className="text-sm text-slate-700 font-medium flex-1 truncate">{f.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                                                    {!isSubmitted && (
                                                        <button
                                                            onClick={() => setUploadedFiles(prev => ({
                                                                ...prev,
                                                                [prob.id]: (prev[prob.id] || []).filter((_, i) => i !== fIdx)
                                                            }))}
                                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {isSubmitted && prob.explanation && (
                            <div className="mt-4 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm leading-relaxed border border-blue-100">
                                <strong>Explanation:</strong> {prob.explanation}
                            </div>
                        )}
                        
                        {isSubmitted && !results[prob.id]?.correct && prob.type !== 'multiple_choice' && (
                            <div className="mt-4 p-4 bg-red-50 text-red-800 rounded-xl text-sm leading-relaxed border border-red-100 flex items-start gap-2">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <div>
                                    <strong>Feedback:</strong> {results[prob.id]?.message}
                                    {prob.type === 'short_answer' && (
                                        <div className="mt-1">Acceptable answers: {(prob as ShortAnswerProblem).acceptable_answers.join(', ')}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            <div className="flex items-center justify-between border-t border-slate-200 pt-8">
                <div>
                    {isSubmitted && (
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Final Score</span>
                            <span className={`text-4xl font-extrabold ${totalScore === maxScore ? 'text-emerald-500' : 'text-blue-600'}`}>
                                {totalScore} <span className="text-xl text-slate-400">/ {maxScore}</span>
                            </span>
                            {isGraded && passingScore !== undefined && maxScore > 0 && (
                                <div className="mt-2">
                                    {(totalScore / maxScore * 100) >= passingScore ? (
                                        <span className="text-sm font-bold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg">✅ PASS 🎉 ({Math.round(totalScore / maxScore * 100)}%)</span>
                                    ) : (
                                        <span className="text-sm font-bold bg-red-100 text-red-700 px-3 py-1 rounded-lg">❌ FAIL ({Math.round(totalScore / maxScore * 100)}% / {passingScore}% 필요)</span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {!isSubmitted ? (
                    <button
                        onClick={handleSubmit}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-10 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 text-lg"
                    >
                        Submit Quiz
                    </button>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="font-bold text-emerald-600 flex items-center gap-2 px-6 py-3 bg-emerald-50 rounded-xl border border-emerald-200">
                            <CheckCircle2 size={24} /> {isSaving ? 'Saving...' : 'Responses Recorded ✓'}
                        </div>
                        {(maxAttempts === 0 || !maxAttempts || attemptCount < maxAttempts) && (
                            <button
                                onClick={handleRetry}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all active:scale-95 text-sm"
                            >
                                🔄 다시 풀기 ({attemptCount}/{maxAttempts || '∞'})
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
