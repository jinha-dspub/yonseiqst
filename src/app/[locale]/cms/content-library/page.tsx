"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    BookOpen, Plus, Upload, Edit3, Trash2, ChevronRight, Copy, Check,
    FileJson, Search, Tag, ArrowLeft, Layers, PenTool, Download,
    CheckCircle2, AlertCircle, Image as ImageIcon, X
} from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserProfileDropdown from '@/components/dashboard/UserProfileDropdown';

// ─── Types ──────────────────────────────────────────────────────────
interface QuestionBank {
    id: string;
    name: string;
    description: string;
    tags: string[];
    course_id: string | null;
    created_by: string;
    created_at: string;
    questionCount?: number;
}

interface Question {
    id: string;
    bank_id: string;
    type: 'multiple_choice' | 'short_answer' | 'descriptive';
    question: string;
    image_url: string | null;
    options: any;
    answer_data: any;
    points: number;
    explanation: string | null;
    tags: string[];
    sort_order: number;
}

// ─── Gemini Prompt Template ─────────────────────────────────────────
const GEMINI_PROMPT_TEMPLATE = `다음 주제에 대한 퀴즈를 JSON 형식으로 만들어 주세요.

주제: [여기에 주제 입력]
문제 수: [원하는 문제 수]

JSON 형식:
{
  "bankName": "문제은행 이름",
  "problems": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "question": "문제 내용",
      "imageUrl": null,
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "answer": 0,
      "points": 5,
      "explanation": "정답 해설"
    },
    {
      "id": "q2",
      "type": "short_answer",
      "question": "문제 내용",
      "acceptable_answers": ["정답1", "정답2"],
      "points": 5,
      "explanation": "정답 해설"
    },
    {
      "id": "q3",
      "type": "descriptive",
      "question": "서술형 문제 내용",
      "min_length": 50,
      "keywords": ["핵심키워드1", "핵심키워드2"],
      "points": 10,
      "explanation": "모범답안 해설"
    }
  ]
}

문제 유형: multiple_choice, short_answer, descriptive 중 섞어서 만들어 주세요.
이미지가 필요한 문제는 imageUrl에 이미지 URL을 넣어주세요.`;

// ─── Main Component ─────────────────────────────────────────────────
export default function ContentLibraryPage() {
    const params = useParams();
    const locale = useLocale();
    const router = useRouter();
    const supabase = createClient();

    // State
    const [activeTab, setActiveTab] = useState<'banks' | 'builder' | 'import'>('banks');
    const [banks, setBanks] = useState<QuestionBank[]>([]);
    const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
    const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<any>(null);

    // Modal state
    const [showNewBankModal, setShowNewBankModal] = useState(false);
    const [newBankName, setNewBankName] = useState('');
    const [newBankDesc, setNewBankDesc] = useState('');
    const [newBankTags, setNewBankTags] = useState('');

    // Builder state
    const [builderType, setBuilderType] = useState<'multiple_choice' | 'short_answer' | 'descriptive'>('multiple_choice');
    const [builderQuestion, setBuilderQuestion] = useState('');
    const [builderImageUrl, setBuilderImageUrl] = useState('');
    const [builderOptions, setBuilderOptions] = useState<string[]>(['', '', '', '']);
    const [builderAnswer, setBuilderAnswer] = useState(0);
    const [builderAcceptable, setBuilderAcceptable] = useState('');
    const [builderKeywords, setBuilderKeywords] = useState('');
    const [builderMinLength, setBuilderMinLength] = useState(50);
    const [builderPoints, setBuilderPoints] = useState(5);
    const [builderExplanation, setBuilderExplanation] = useState('');
    const [builderTargetBank, setBuilderTargetBank] = useState('');
    const [builderSaving, setBuilderSaving] = useState(false);

    // Import state
    const [importJson, setImportJson] = useState('');
    const [importPreview, setImportPreview] = useState<any>(null);
    const [importError, setImportError] = useState('');
    const [importTargetBank, setImportTargetBank] = useState('');
    const [importSaving, setImportSaving] = useState(false);
    const [promptCopied, setPromptCopied] = useState(false);
    const [importSuccess, setImportSuccess] = useState('');

    // ─── Data Loading ───────────────────────────────────────────────
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push(`/${locale}/login`); return; }

            const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
            setUserProfile(profile);

            if (!profile || !['staff', 'admin', 'superuser'].includes(profile.role)) {
                router.push(`/${locale}/dashboard`);
                return;
            }

            // Load banks with question counts
            const { data: banksData } = await supabase
                .from('question_banks')
                .select('*')
                .order('created_at', { ascending: false });

            if (banksData) {
                // Get question counts
                const banksWithCounts = await Promise.all(banksData.map(async (bank) => {
                    const { count } = await supabase
                        .from('questions')
                        .select('*', { count: 'exact', head: true })
                        .eq('bank_id', bank.id);
                    return { ...bank, questionCount: count || 0 };
                }));
                setBanks(banksWithCounts);
            }
        } catch (e) {
            console.error('Failed to load data', e);
        } finally {
            setLoading(false);
        }
    };

    const loadBankQuestions = async (bankId: string) => {
        const { data } = await supabase
            .from('questions')
            .select('*')
            .eq('bank_id', bankId)
            .order('sort_order', { ascending: true });
        setBankQuestions(data || []);
    };

    // ─── Bank CRUD ──────────────────────────────────────────────────
    const createBank = async () => {
        if (!newBankName.trim()) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase.from('question_banks').insert({
            name: newBankName.trim(),
            description: newBankDesc.trim(),
            tags: newBankTags.split(',').map(t => t.trim()).filter(Boolean),
            created_by: user.id
        }).select().single();

        if (data) {
            setBanks(prev => [{ ...data, questionCount: 0 }, ...prev]);
            setShowNewBankModal(false);
            setNewBankName(''); setNewBankDesc(''); setNewBankTags('');
        }
    };

    const deleteBank = async (bankId: string) => {
        if (!confirm('이 문제은행과 모든 문제가 삭제됩니다. 계속하시겠습니까?')) return;
        await supabase.from('question_banks').delete().eq('id', bankId);
        setBanks(prev => prev.filter(b => b.id !== bankId));
        if (selectedBank?.id === bankId) { setSelectedBank(null); setBankQuestions([]); }
    };

    const deleteQuestion = async (questionId: string) => {
        await supabase.from('questions').delete().eq('id', questionId);
        setBankQuestions(prev => prev.filter(q => q.id !== questionId));
        // Update count
        setBanks(prev => prev.map(b =>
            b.id === selectedBank?.id ? { ...b, questionCount: (b.questionCount || 1) - 1 } : b
        ));
    };

    // ─── Manual Builder ─────────────────────────────────────────────
    const saveBuilderQuestion = async () => {
        if (!builderTargetBank || !builderQuestion.trim()) return;
        setBuilderSaving(true);

        const questionData: any = {
            bank_id: builderTargetBank,
            type: builderType,
            question: builderQuestion.trim(),
            image_url: builderImageUrl.trim() || null,
            points: builderPoints,
            explanation: builderExplanation.trim() || null,
            tags: [],
        };

        if (builderType === 'multiple_choice') {
            questionData.options = builderOptions.filter(o => o.trim());
            questionData.answer_data = { answer: builderAnswer };
        } else if (builderType === 'short_answer') {
            questionData.options = [];
            questionData.answer_data = { acceptable_answers: builderAcceptable.split(',').map(a => a.trim()).filter(Boolean) };
        } else {
            questionData.options = [];
            questionData.answer_data = {
                min_length: builderMinLength,
                keywords: builderKeywords.split(',').map(k => k.trim()).filter(Boolean)
            };
        }

        const { error } = await supabase.from('questions').insert(questionData);
        setBuilderSaving(false);

        if (!error) {
            // Reset form
            setBuilderQuestion(''); setBuilderImageUrl(''); setBuilderOptions(['', '', '', '']);
            setBuilderAnswer(0); setBuilderAcceptable(''); setBuilderKeywords('');
            setBuilderExplanation('');
            // Update count
            setBanks(prev => prev.map(b =>
                b.id === builderTargetBank ? { ...b, questionCount: (b.questionCount || 0) + 1 } : b
            ));
            alert('✅ 문제가 저장되었습니다!');
        }
    };

    // ─── JSON Import ────────────────────────────────────────────────
    const validateImportJson = (text: string) => {
        setImportError('');
        setImportPreview(null);
        setImportSuccess('');

        if (!text.trim()) return;

        try {
            const parsed = JSON.parse(text);
            if (!parsed.problems || !Array.isArray(parsed.problems)) {
                setImportError('JSON에 "problems" 배열이 없습니다.');
                return;
            }

            // Validate each problem
            const errors: string[] = [];
            parsed.problems.forEach((p: any, idx: number) => {
                if (!p.type) errors.push(`문제 ${idx + 1}: type이 없습니다`);
                if (!p.question) errors.push(`문제 ${idx + 1}: question이 없습니다`);
                if (!['multiple_choice', 'short_answer', 'descriptive'].includes(p.type)) {
                    errors.push(`문제 ${idx + 1}: type "${p.type}" 은 지원하지 않습니다`);
                }
                if (p.type === 'multiple_choice' && (!p.options || p.options.length < 2)) {
                    errors.push(`문제 ${idx + 1}: 객관식은 최소 2개 선택지가 필요합니다`);
                }
                if (p.type === 'multiple_choice' && p.answer === undefined) {
                    errors.push(`문제 ${idx + 1}: 정답 인덱스(answer)가 없습니다`);
                }
            });

            if (errors.length > 0) {
                setImportError(errors.join('\n'));
                return;
            }

            setImportPreview(parsed);
        } catch (e: any) {
            setImportError(`JSON 파싱 오류: ${e.message}`);
        }
    };

    const handleImportSave = async () => {
        if (!importPreview || !importTargetBank) return;
        setImportSaving(true);
        setImportSuccess('');

        try {
            const questionsToInsert = importPreview.problems.map((p: any, idx: number) => {
                const q: any = {
                    bank_id: importTargetBank,
                    type: p.type,
                    question: p.question,
                    image_url: p.imageUrl || null,
                    points: p.points || 5,
                    explanation: p.explanation || null,
                    tags: p.tags || [],
                    sort_order: idx,
                };

                if (p.type === 'multiple_choice') {
                    q.options = p.options;
                    q.answer_data = { answer: p.answer };
                } else if (p.type === 'short_answer') {
                    q.options = [];
                    q.answer_data = { acceptable_answers: p.acceptable_answers || [] };
                } else {
                    q.options = [];
                    q.answer_data = { min_length: p.min_length, keywords: p.keywords || [] };
                }

                return q;
            });

            const { error } = await supabase.from('questions').insert(questionsToInsert);

            if (error) {
                setImportError(`저장 오류: ${error.message}`);
            } else {
                setImportSuccess(`✅ ${questionsToInsert.length}개 문제가 성공적으로 저장되었습니다!`);
                setImportJson('');
                setImportPreview(null);
                // Update count
                setBanks(prev => prev.map(b =>
                    b.id === importTargetBank ? { ...b, questionCount: (b.questionCount || 0) + questionsToInsert.length } : b
                ));
            }
        } catch (e: any) {
            setImportError(`저장 실패: ${e.message}`);
        } finally {
            setImportSaving(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setImportJson(text);
            validateImportJson(text);
        };
        reader.readAsText(file);
    };

    // ─── Render ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-pulse font-bold text-slate-400 text-lg">Loading Content Library...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex flex-col">
            {/* Header */}
            <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href={`/${locale}/cms`} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors">
                        <ArrowLeft size={18} />
                        <span className="text-sm font-medium">CMS</span>
                    </Link>
                    <div className="w-px h-6 bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <BookOpen size={20} className="text-indigo-600" />
                        <h1 className="font-bold text-slate-800 text-lg">Content Library</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <LanguageSwitcher />
                    {userProfile && <UserProfileDropdown userProfile={userProfile} />}
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="bg-white border-b border-slate-200 px-6">
                <div className="flex gap-1">
                    {[
                        { key: 'banks' as const, label: 'Question Banks', icon: Layers, count: banks.length },
                        { key: 'builder' as const, label: 'Manual Builder', icon: PenTool },
                        { key: 'import' as const, label: 'JSON Import', icon: Upload },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-colors
                                ${activeTab === tab.key
                                    ? 'border-indigo-600 text-indigo-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* ═══ TAB 1: Question Banks ═══ */}
                {activeTab === 'banks' && (
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-800">문제은행 관리</h2>
                            <button
                                onClick={() => setShowNewBankModal(true)}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                            >
                                <Plus size={16} /> 새 문제은행
                            </button>
                        </div>

                        {banks.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center">
                                <Layers size={48} className="mx-auto text-slate-300 mb-4" />
                                <p className="text-slate-500 font-medium mb-2">문제은행이 없습니다</p>
                                <p className="text-slate-400 text-sm">새 문제은행을 만들어서 문제를 정리하세요</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {banks.map(bank => (
                                    <div
                                        key={bank.id}
                                        className={`bg-white rounded-xl border-2 transition-all cursor-pointer hover:shadow-md group
                                            ${selectedBank?.id === bank.id ? 'border-indigo-500 shadow-md ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'}`}
                                        onClick={() => {
                                            setSelectedBank(bank);
                                            loadBankQuestions(bank.id);
                                        }}
                                    >
                                        <div className="p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <h3 className="font-bold text-slate-800 text-base leading-tight">{bank.name}</h3>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteBank(bank.id); }}
                                                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            {bank.description && (
                                                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{bank.description}</p>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                                    {bank.questionCount || 0} 문제
                                                </span>
                                                {bank.tags.length > 0 && (
                                                    <div className="flex gap-1">
                                                        {bank.tags.slice(0, 2).map((tag, i) => (
                                                            <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{tag}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Selected Bank : Question List */}
                        {selectedBank && (
                            <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="bg-indigo-50 border-b border-indigo-100 p-4 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-indigo-800">{selectedBank.name}</h3>
                                        <p className="text-xs text-indigo-600 mt-0.5">{bankQuestions.length}개 문제</p>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedBank(null); setBankQuestions([]); }}
                                        className="text-indigo-400 hover:text-indigo-600 p-1"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {bankQuestions.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-sm">
                                            문제가 없습니다. Builder나 JSON Import로 추가하세요.
                                        </div>
                                    ) : bankQuestions.map((q, idx) => (
                                        <div key={q.id} className="p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                                            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                        q.type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' :
                                                        q.type === 'short_answer' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-purple-100 text-purple-700'
                                                    }`}>
                                                        {q.type === 'multiple_choice' ? 'MC' : q.type === 'short_answer' ? 'SA' : 'DESC'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{q.points}pts</span>
                                                </div>
                                                <p className="text-sm text-slate-700 font-medium line-clamp-2">{q.question}</p>
                                                {q.image_url && (
                                                    <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-500">
                                                        <ImageIcon size={10} /> Image attached
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => deleteQuestion(q.id)}
                                                className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* New Bank Modal */}
                        {showNewBankModal && (
                            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">새 문제은행 만들기</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">이름 *</label>
                                            <input
                                                className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                                value={newBankName}
                                                onChange={e => setNewBankName(e.target.value)}
                                                placeholder="예: 직업환경의학 중간고사"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">설명</label>
                                            <textarea
                                                className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 min-h-[80px]"
                                                value={newBankDesc}
                                                onChange={e => setNewBankDesc(e.target.value)}
                                                placeholder="문제은행 설명 (선택)"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">태그 (쉼표 구분)</label>
                                            <input
                                                className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                                value={newBankTags}
                                                onChange={e => setNewBankTags(e.target.value)}
                                                placeholder="예: 중간고사, 산업보건"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-6">
                                        <button
                                            onClick={() => setShowNewBankModal(false)}
                                            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                                        >취소</button>
                                        <button
                                            onClick={createBank}
                                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
                                        >만들기</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ TAB 2: Manual Builder ═══ */}
                {activeTab === 'builder' && (
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-xl font-bold text-slate-800 mb-6">문제 직접 만들기</h2>

                        {/* Target Bank Selection */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">저장할 문제은행 *</label>
                            <select
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                value={builderTargetBank}
                                onChange={e => setBuilderTargetBank(e.target.value)}
                            >
                                <option value="">문제은행 선택...</option>
                                {banks.map(b => <option key={b.id} value={b.id}>{b.name} ({b.questionCount}문제)</option>)}
                            </select>
                        </div>

                        {/* Problem Type Selection */}
                        <div className="flex gap-2 mb-6">
                            {[
                                { type: 'multiple_choice' as const, label: '객관식', color: 'blue' },
                                { type: 'short_answer' as const, label: '단답형', color: 'amber' },
                                { type: 'descriptive' as const, label: '서술형', color: 'purple' },
                            ].map(t => (
                                <button
                                    key={t.type}
                                    onClick={() => setBuilderType(t.type)}
                                    className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
                                        builderType === t.type
                                            ? `bg-${t.color}-100 text-${t.color}-700 border-2 border-${t.color}-300`
                                            : 'bg-slate-100 text-slate-500 border-2 border-transparent hover:bg-slate-200'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Question Form */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                            {/* Question Text */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">문제 내용 *</label>
                                <textarea
                                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 min-h-[100px]"
                                    value={builderQuestion}
                                    onChange={e => setBuilderQuestion(e.target.value)}
                                    placeholder="문제를 입력하세요..."
                                />
                            </div>

                            {/* Image URL */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">이미지 URL <span className="font-normal text-slate-400">(선택)</span></label>
                                <input
                                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                    value={builderImageUrl}
                                    onChange={e => setBuilderImageUrl(e.target.value)}
                                    placeholder="https://example.com/image.png"
                                />
                                {builderImageUrl && (
                                    <img src={builderImageUrl} alt="Preview" className="mt-2 max-h-32 rounded-lg border border-slate-200" />
                                )}
                            </div>

                            {/* MC Options */}
                            {builderType === 'multiple_choice' && (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">선택지</label>
                                    {builderOptions.map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2 mb-2">
                                            <button
                                                onClick={() => setBuilderAnswer(i)}
                                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                    builderAnswer === i ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-300'
                                                }`}
                                            >
                                                {builderAnswer === i && <Check size={12} className="text-white" />}
                                            </button>
                                            <input
                                                className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                                value={opt}
                                                onChange={e => {
                                                    const newOpts = [...builderOptions];
                                                    newOpts[i] = e.target.value;
                                                    setBuilderOptions(newOpts);
                                                }}
                                                placeholder={`선택지 ${i + 1}`}
                                            />
                                            {builderOptions.length > 2 && (
                                                <button
                                                    onClick={() => setBuilderOptions(prev => prev.filter((_, j) => j !== i))}
                                                    className="text-slate-300 hover:text-red-500 p-1"
                                                ><X size={14} /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setBuilderOptions(prev => [...prev, ''])}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-bold mt-1"
                                    >+ 선택지 추가</button>
                                </div>
                            )}

                            {/* Short Answer */}
                            {builderType === 'short_answer' && (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">허용 정답 (쉼표 구분)</label>
                                    <input
                                        className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                        value={builderAcceptable}
                                        onChange={e => setBuilderAcceptable(e.target.value)}
                                        placeholder="정답1, 정답2, 정답3"
                                    />
                                </div>
                            )}

                            {/* Descriptive */}
                            {builderType === 'descriptive' && (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">최소 글자 수</label>
                                        <input
                                            type="number"
                                            className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                            value={builderMinLength}
                                            onChange={e => setBuilderMinLength(Number(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">필수 키워드 (쉼표 구분)</label>
                                        <input
                                            className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                            value={builderKeywords}
                                            onChange={e => setBuilderKeywords(e.target.value)}
                                            placeholder="키워드1, 키워드2"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Points & Explanation */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">배점</label>
                                    <input
                                        type="number"
                                        className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                        value={builderPoints}
                                        onChange={e => setBuilderPoints(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">해설 <span className="font-normal text-slate-400">(선택)</span></label>
                                <textarea
                                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 min-h-[80px]"
                                    value={builderExplanation}
                                    onChange={e => setBuilderExplanation(e.target.value)}
                                    placeholder="정답 해설..."
                                />
                            </div>

                            {/* Save button */}
                            <button
                                onClick={saveBuilderQuestion}
                                disabled={!builderTargetBank || !builderQuestion.trim() || builderSaving}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98]"
                            >
                                {builderSaving ? 'Saving...' : '💾 문제 저장'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ TAB 3: JSON Import ═══ */}
                {activeTab === 'import' && (
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-xl font-bold text-slate-800 mb-6">JSON 일괄 가져오기</h2>

                        {/* Gemini Prompt Template */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5 mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">✨</span>
                                    <h3 className="font-bold text-blue-800 text-sm">Gemini AI 프롬프트 템플릿</h3>
                                </div>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(GEMINI_PROMPT_TEMPLATE);
                                        setPromptCopied(true);
                                        setTimeout(() => setPromptCopied(false), 2000);
                                    }}
                                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-white px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                                >
                                    {promptCopied ? <><Check size={12} /> 복사됨!</> : <><Copy size={12} /> 프롬프트 복사</>}
                                </button>
                            </div>
                            <pre className="text-xs text-blue-700 bg-white/60 p-3 rounded-lg border border-blue-100 overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                                {GEMINI_PROMPT_TEMPLATE}
                            </pre>
                        </div>

                        {/* Target Bank */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">저장할 문제은행 *</label>
                            <select
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                value={importTargetBank}
                                onChange={e => setImportTargetBank(e.target.value)}
                            >
                                <option value="">문제은행 선택...</option>
                                {banks.map(b => <option key={b.id} value={b.id}>{b.name} ({b.questionCount}문제)</option>)}
                            </select>
                        </div>

                        {/* JSON Input */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">JSON 붙여넣기</label>
                                <div className="flex gap-2">
                                    <a
                                        href="/examples/quiz_example.json"
                                        download="quiz_example.json"
                                        className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                    >
                                        <Download size={12} /> 예시 JSON 다운로드
                                    </a>
                                    <label className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                                        <Upload size={12} /> .json 파일 업로드
                                        <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                                    </label>
                                </div>
                            </div>
                            <textarea
                                className="w-full p-4 bg-slate-900 text-green-400 font-mono text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[250px] resize-y"
                                value={importJson}
                                onChange={e => {
                                    setImportJson(e.target.value);
                                    validateImportJson(e.target.value);
                                }}
                                placeholder='Gemini에서 받은 JSON을 여기에 붙여넣으세요...'
                            />
                        </div>

                        {/* Validation / Preview */}
                        {importError && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-2">
                                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                                <pre className="text-sm text-red-700 whitespace-pre-wrap">{importError}</pre>
                            </div>
                        )}

                        {importSuccess && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex items-center gap-2">
                                <CheckCircle2 size={18} className="text-emerald-500" />
                                <span className="text-sm font-bold text-emerald-700">{importSuccess}</span>
                            </div>
                        )}

                        {importPreview && (
                            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                                <h3 className="font-bold text-slate-800 mb-1">
                                    {importPreview.bankName || 'Preview'}
                                </h3>
                                <p className="text-sm text-emerald-600 font-bold mb-4">
                                    ✅ {importPreview.problems.length}개 문제 검증 완료
                                </p>
                                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                                    {importPreview.problems.map((p: any, idx: number) => (
                                        <div key={idx} className="py-2.5 flex items-start gap-2">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mr-2 ${
                                                    p.type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' :
                                                    p.type === 'short_answer' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {p.type === 'multiple_choice' ? 'MC' : p.type === 'short_answer' ? 'SA' : 'DESC'}
                                                </span>
                                                <span className="text-sm text-slate-700">{p.question.slice(0, 80)}{p.question.length > 80 ? '...' : ''}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">{p.points || 5}pts</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleImportSave}
                                    disabled={!importTargetBank || importSaving}
                                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98]"
                                >
                                    {importSaving ? 'Saving...' : `📥 ${importPreview.problems.length}개 문제 일괄 저장`}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
