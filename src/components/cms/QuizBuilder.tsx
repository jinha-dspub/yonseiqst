import React, { useState, useEffect } from 'react';
import { QuizProblem, QuizProblemType, MultipleChoiceProblem, ShortAnswerProblem, DescriptiveProblem, AssignmentProblem } from '@/lib/lms/types';
import { Plus, Trash2, CheckCircle2, List, AlignLeft, MessageSquare, Upload, ChevronDown } from 'lucide-react';

interface QuizBuilderProps {
    initialContent: string;
    onChange: (content: string) => void;
}

export default function QuizBuilder({ initialContent, onChange }: QuizBuilderProps) {
    const [problems, setProblems] = useState<QuizProblem[]>([]);
    const [isParsed, setIsParsed] = useState(false);

    useEffect(() => {
        if (isParsed) return; // Only parse once on mount
        try {
            if (initialContent && initialContent.startsWith('{')) {
                const parsed = JSON.parse(initialContent);
                if (parsed && Array.isArray(parsed.problems)) {
                    setProblems(parsed.problems);
                }
            } else if (initialContent.trim().length > 0) {
                // Migrate legacy markdown text into a descriptive question
                setProblems([{
                    id: `prob_${Date.now()}`,
                    type: 'descriptive',
                    question: initialContent,
                    points: 10
                } as DescriptiveProblem]);
            }
        } catch (e) {
            console.warn("Could not parse quiz content", e);
        }
        setIsParsed(true);
    }, [initialContent, isParsed]);

    const updateParent = (newProblems: QuizProblem[]) => {
        setProblems(newProblems);
        onChange(JSON.stringify({ problems: newProblems }));
    };

    const handleAddProblem = (type: QuizProblemType) => {
        const baseInfo = { id: `prob_${Date.now()}_${Math.floor(Math.random() * 1000)}`, question: '', points: 10, explanation: '' };
        let newProb: any = { ...baseInfo, type };
        
        if (type === 'multiple_choice') {
            newProb = { ...newProb, options: ['Option 1', 'Option 2'], answer: 0 } as MultipleChoiceProblem;
        } else if (type === 'short_answer') {
            newProb = { ...newProb, acceptable_answers: [''] } as ShortAnswerProblem;
        } else if (type === 'descriptive') {
            newProb = { ...newProb, min_length: 50, keywords: [] } as DescriptiveProblem;
        } else if (type === 'assignment') {
            newProb = { ...newProb, allowedFileTypes: ['pdf', 'jpg', 'png', 'docx'], maxFileSize: 10, requireText: true, min_length: 100 } as AssignmentProblem;
        }
        
        updateParent([...problems, newProb]);
    };

    const updateProblem = (index: number, updates: any) => {
        const newProps = [...problems];
        newProps[index] = { ...newProps[index], ...updates };
        updateParent(newProps);
    };

    const removeProblem = (index: number) => {
        const newProps = problems.filter((_, i) => i !== index);
        updateParent(newProps);
    };

    const typeConfig: Record<QuizProblemType, { icon: React.ReactNode; label: string; color: string }> = {
        multiple_choice: { icon: <List size={16} className="text-blue-500"/>, label: 'Multiple Choice', color: 'blue' },
        short_answer: { icon: <MessageSquare size={16} className="text-amber-500"/>, label: 'Short Answer', color: 'amber' },
        descriptive: { icon: <AlignLeft size={16} className="text-purple-500"/>, label: 'Descriptive', color: 'purple' },
        assignment: { icon: <Upload size={16} className="text-rose-500"/>, label: 'Assignment Report', color: 'rose' },
    };

    return (
        <div className="flex flex-col gap-6">
            {problems.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-slate-500 mb-4">No questions added yet. Construct your quiz by adding problems below.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {problems.map((prob, idx) => {
                        const tc = typeConfig[prob.type];
                        return (
                        <div key={prob.id} className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="bg-slate-200 text-slate-700 font-bold w-6 h-6 flex items-center justify-center rounded text-xs">{idx + 1}</span>
                                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        {tc.icon} {tc.label}
                                    </span>
                                </div>
                                <button onClick={() => removeProblem(idx)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Remove Question">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            
                            <div className="p-4 flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-600">Question Text</label>
                                    <textarea
                                        className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-900 focus:border-purple-500 focus:outline-none min-h-[80px]"
                                        value={prob.question}
                                        onChange={(e) => updateProblem(idx, { question: e.target.value })}
                                        placeholder="Enter the main question prompt here..."
                                    />
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col gap-1 w-32">
                                        <label className="text-xs font-bold text-slate-600">Points</label>
                                        <input
                                            type="number" min="0"
                                            className="w-full bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none"
                                            value={prob.points}
                                            onChange={(e) => updateProblem(idx, { points: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 flex-1">
                                        <label className="text-xs font-bold text-slate-600">Explanation (Optional)</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none"
                                            value={prob.explanation || ''}
                                            onChange={(e) => updateProblem(idx, { explanation: e.target.value })}
                                            placeholder="Shown after answer is submitted..."
                                        />
                                    </div>
                                </div>
                                
                                <div className="border-t border-slate-100 my-2 pt-4">
                                    {prob.type === 'multiple_choice' && (
                                        <div className="flex flex-col gap-3">
                                            <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                                                Options & Correct Answer
                                                <button 
                                                    onClick={() => {
                                                        const p = prob as MultipleChoiceProblem;
                                                        updateProblem(idx, { options: [...p.options, `Option ${p.options.length + 1}`] });
                                                    }}
                                                    className="text-purple-600 hover:text-purple-700 flex items-center gap-1"
                                                >
                                                    <Plus size={14} /> Add Option
                                                </button>
                                            </label>
                                            {(prob as MultipleChoiceProblem).options.map((opt, optIdx) => (
                                                <div key={optIdx} className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => updateProblem(idx, { answer: optIdx })}
                                                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                            (prob as MultipleChoiceProblem).answer === optIdx 
                                                            ? 'border-emerald-500 bg-emerald-500 text-white' 
                                                            : 'border-slate-300 text-transparent hover:border-emerald-300'
                                                        }`}
                                                        title="Mark as correct answer"
                                                    >
                                                        <CheckCircle2 size={16} />
                                                    </button>
                                                    <input
                                                        type="text"
                                                        className={`flex-1 p-2 border rounded text-sm text-slate-900 focus:outline-none focus:border-purple-500 ${
                                                            (prob as MultipleChoiceProblem).answer === optIdx ? 'bg-emerald-50 border-emerald-200 font-medium' : 'bg-white border-slate-200'
                                                        }`}
                                                        value={typeof opt === 'string' ? opt : opt.text}
                                                        onChange={(e) => {
                                                            const newOpts = [...(prob as MultipleChoiceProblem).options];
                                                            newOpts[optIdx] = e.target.value;
                                                            updateProblem(idx, { options: newOpts });
                                                        }}
                                                    />
                                                    <button 
                                                        onClick={() => {
                                                            const p = prob as MultipleChoiceProblem;
                                                            if (p.options.length <= 2) return; // Minimum 2 options
                                                            const newOpts = [...p.options];
                                                            newOpts.splice(optIdx, 1);
                                                            // Adjust correct answer if needed
                                                            let newAns = p.answer;
                                                            if (newAns === optIdx) newAns = 0;
                                                            else if (newAns > optIdx) newAns--;
                                                            updateProblem(idx, { options: newOpts, answer: newAns });
                                                        }}
                                                        className="text-slate-400 hover:text-red-500 disabled:opacity-30"
                                                        disabled={(prob as MultipleChoiceProblem).options.length <= 2}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {prob.type === 'short_answer' && (
                                        <div className="flex flex-col gap-3">
                                            <label className="text-xs font-bold text-slate-600">Acceptable Answers (Exact Match)</label>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none"
                                                value={(prob as ShortAnswerProblem).acceptable_answers.join(', ')}
                                                onChange={(e) => {
                                                    const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                                    updateProblem(idx, { acceptable_answers: arr.length ? arr : [''] });
                                                }}
                                                placeholder="e.g. 심평원, HIRA (comma separated)"
                                            />
                                        </div>
                                    )}

                                    {prob.type === 'descriptive' && (
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col gap-1 w-1/3">
                                                <label className="text-xs font-bold text-slate-600">Min Length (Chars)</label>
                                                <input
                                                    type="number" min="0"
                                                    className="w-full bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none"
                                                    value={(prob as DescriptiveProblem).min_length || 0}
                                                    onChange={(e) => updateProblem(idx, { min_length: parseInt(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1 flex-1">
                                                <label className="text-xs font-bold text-slate-600">Keywords (Instructor Reference)</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-white border border-slate-200 rounded p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none"
                                                    value={((prob as DescriptiveProblem).keywords || []).join(', ')}
                                                    onChange={(e) => {
                                                        const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                                        updateProblem(idx, { keywords: arr });
                                                    }}
                                                    placeholder="e.g. 인과관계, 정량화 (comma separated)"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {prob.type === 'assignment' && (
                                        <div className="flex flex-col gap-4">
                                            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                                                <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-3">📎 Assignment Report Settings</p>
                                                <div className="flex flex-wrap gap-4">
                                                    <div className="flex flex-col gap-1 w-48">
                                                        <label className="text-xs font-bold text-slate-600">Allowed File Types</label>
                                                        <input
                                                            type="text"
                                                            className="w-full bg-white border border-rose-200 rounded p-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none"
                                                            value={((prob as AssignmentProblem).allowedFileTypes || []).join(', ')}
                                                            onChange={(e) => {
                                                                const arr = e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
                                                                updateProblem(idx, { allowedFileTypes: arr });
                                                            }}
                                                            placeholder="pdf, jpg, png, docx"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1 w-32">
                                                        <label className="text-xs font-bold text-slate-600">Max Size (MB)</label>
                                                        <input
                                                            type="number" min="1" max="100"
                                                            className="w-full bg-white border border-rose-200 rounded p-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none"
                                                            value={(prob as AssignmentProblem).maxFileSize || 10}
                                                            onChange={(e) => updateProblem(idx, { maxFileSize: parseInt(e.target.value) || 10 })}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1 w-40">
                                                        <label className="text-xs font-bold text-slate-600">Min Text Length</label>
                                                        <input
                                                            type="number" min="0"
                                                            className="w-full bg-white border border-rose-200 rounded p-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none"
                                                            value={(prob as AssignmentProblem).min_length || 0}
                                                            onChange={(e) => updateProblem(idx, { min_length: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`req-text-${prob.id}`}
                                                        checked={(prob as AssignmentProblem).requireText !== false}
                                                        onChange={(e) => updateProblem(idx, { requireText: e.target.checked })}
                                                        className="w-4 h-4 accent-rose-500"
                                                    />
                                                    <label htmlFor={`req-text-${prob.id}`} className="text-xs font-medium text-slate-700">
                                                        텍스트 작성 필수 (보고서 내용을 함께 작성)
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
                                                💡 학생은 보고서 텍스트를 작성하고, PDF/이미지 등 파일을 업로드해서 제출합니다. 교수자가 수동 채점합니다.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button onClick={() => handleAddProblem('multiple_choice')} className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors border border-slate-200 flex items-center gap-1.5">
                    <List size={14} /> + Multiple Choice
                </button>
                <button onClick={() => handleAddProblem('short_answer')} className="px-4 py-2 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors border border-slate-200 flex items-center gap-1.5">
                    <MessageSquare size={14} /> + Short Answer
                </button>
                <button onClick={() => handleAddProblem('descriptive')} className="px-4 py-2 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors border border-slate-200 flex items-center gap-1.5">
                    <AlignLeft size={14} /> + Descriptive
                </button>
                <button onClick={() => handleAddProblem('assignment')} className="px-4 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors border border-slate-200 flex items-center gap-1.5">
                    <Upload size={14} /> + Assignment Report
                </button>
            </div>
        </div>
    );
}
