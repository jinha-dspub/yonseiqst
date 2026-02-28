"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Shield, BookOpen, AlertTriangle, Building2, Beaker, Scale, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MockUsers } from '@/lib/mockData';

// --- Types ---
type AreaId = 'hub' | 'area1' | 'area2' | 'area3';

interface Area {
    id: AreaId;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    contents: string[];
    rewards: string[];
    mechanics?: string[];
    position: { top: string; left: string }; // 2D CSS Coordinates
    color: string; // Hex color for icon/border
    themeColor: string; // Tailwind class
    subType?: 'default' | 'book' | 'quiz';
    subLevel?: string;
    subLevelDesc?: string;
    markdown?: string;
    videoUrl?: string;
}

// --- Data ---
// Mapped to relative screen percentages
const MAP_DATA: Area[] = [
    {
        id: 'hub',
        title: '[Center Hub] 직업환경보건 박물관',
        subtitle: '지식의 성전',
        description: '모든 학습의 시작점이자, 획득한 유물(지식)이 전시되는 중앙 홀입니다.',
        icon: <Building2 size={24} />,
        rewards: [],
        contents: ['학습 진행도 확인', '획득한 유물(지식) 열람'],
        mechanics: ['각 구역 클리어 시 박물관에 새로운 전시물 추가'],
        position: { top: '80%', left: '50%' },
        color: '#2563eb', // blue-600
        themeColor: 'bg-blue-900/30'
    },
    {
        id: 'area1',
        title: '[기초: 산업보건의 태동]',
        subtitle: '지혜의 고서 (The Glowing Ledger)',
        description: '공중에 살짝 떠서 은은하게 빛나는 양장본 책. 과거의 사건들을 담고 있습니다.',
        icon: <BookOpen size={24} />,
        rewards: ['역사적 유물 해금'],
        contents: [
            '산업혁명기 굴뚝청소부의 암',
            '수은 중독(미나마타), 카드뮴 중독(이타이이타이) 사례',
            '국내 문송면 군 사건, 원진레이온 사태 등'
        ],
        position: { top: '60%', left: '30%' },
        color: '#d97706', // amber-600
        themeColor: 'bg-amber-900/30'
    },
    {
        id: 'area2',
        title: '[Area 2] 조각상의 시련',
        subtitle: 'Governance & Law',
        description: '법과 제도의 기초를 다루는 구역입니다.',
        icon: <HelpCircle size={24} />,
        rewards: ['사회적 보호막 활성화', 'Path Light 조명 활성화'],
        contents: [
            '산업안전보건법: 사업장 안전의 기본 룰',
            '산재보험법: 사고 이후의 보상 엔진',
            '중대재해처벌법: 강력한 책임과 예방의 방패',
            '환경보건법: 일터를 넘어 일상으로의 확장'
        ],
        mechanics: [
            '정답 시 길(Path Light) 열림',
            '오답 시 리콜(Recall) 복습 포탈 활성화'
        ],
        position: { top: '35%', left: '70%' },
        color: '#9333ea', // purple-600
        themeColor: 'bg-purple-900/30'
    },
    {
        id: 'area3',
        title: '[Area 3] 진실의 실험실',
        subtitle: '학문적 메커니즘',
        description: '복잡한 수식과 기호들이 정렬되며 \'분석 도구\'이(가) 활성화됨',
        icon: <Beaker size={24} />,
        rewards: ['분석 도구 활성화'],
        contents: [
            '역학(Epidemiology): 질병의 지도를 그리는 법 (인과관계 추론)',
            '독성학(Toxicology): 독이 몸 안에서 벌이는 전쟁 (ADME)',
            '노출 평가(Exposure Assessment): 보이지 않는 위험을 숫자로 바꾸는 기술'
        ],
        mechanics: [
            '독성 물질 도감 활성화',
            '실시간 노출 시뮬레이터 (데이터 과학 미니 게임)'
        ],
        position: { top: '15%', left: '50%' },
        color: '#4f46e5', // indigo-600
        themeColor: 'bg-indigo-900/30'
    }
];

// Helper to determine status based on user role/level
function getAreaStatus(areaId: AreaId, userProfile: any): 'Clear' | 'In Progress' | 'Locked' {
    if (!userProfile) return 'Locked';

    // Superusers or Staff see everything cleared
    if (userProfile.role === 'superuser' || userProfile.role === 'staff') {
        return 'Clear';
    }

    // For students, let's hardcode a progression for demonstration:
    // Hub is always Clear.
    // Area 1 is In Progress.
    // Area 2 and 3 are Locked.
    if (areaId === 'hub') return 'Clear';

    // If they have high exp, maybe unlock area 2
    if (userProfile.exp > 1000) {
        if (areaId === 'area1') return 'Clear';
        if (areaId === 'area2') return 'In Progress';
    } else {
        if (areaId === 'area1') return 'In Progress';
    }

    return 'Locked';
}

// Removed 3D Connections in favor of 2D SVG


export default function LectureWorldMap3D() {
    const router = useRouter();
    const [selectedArea, setSelectedArea] = useState<Area | null>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [mounted, setMounted] = useState(false);
    const [mapData, setMapData] = useState<Area[]>(MAP_DATA);

    useEffect(() => {
        setMounted(true);
        const roleId = sessionStorage.getItem("currentUser") || 'student';

        let profile = MockUsers['student'];
        if (MockUsers[roleId]) {
            profile = MockUsers[roleId];
        }
        setUserProfile(profile);
    }, []);

    if (!mounted) return null;

    const handleLogout = () => {
        sessionStorage.removeItem("currentUser");
        router.push("/");
    };

    return (
        <div className="relative w-full h-screen bg-slate-900 overflow-hidden font-sans select-none flex flex-col">

            {/* --- Top Navigation Bar (HTML OVERLAY) --- */}
            <div className="absolute top-0 left-0 right-0 z-30 p-6 flex justify-between items-start pointer-events-none">
                <div className="pointer-events-auto">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-500 tracking-tight drop-shadow-md">
                        L E C T U R E <span className="text-slate-100/50">W O R L D</span>
                    </h1>
                    <div className="flex items-center gap-3 mt-2">
                        <p className="text-slate-400 font-medium tracking-wider">산업보건 기초 3D Map</p>

                    </div>
                </div>

                <div className="pointer-events-auto flex items-center gap-4">
                    <Link href="/dashboard" className="px-5 py-2.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2 shadow-lg hover:shadow-cyan-900/20">
                        대시보드로 돌아가기
                    </Link>
                    <button onClick={handleLogout} className="px-4 py-2.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-red-900/30 hover:text-red-400 hover:border-red-900 transition-colors flex items-center gap-2 shadow-lg">
                        <LogOut size={16} />
                        로그아웃
                    </button>
                    <button className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-center shadow-lg">
                        <HelpCircle size={20} />
                    </button>
                </div>
            </div>

            {/* --- 2D Adventure Map Background --- */}
            <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black" onClick={() => setSelectedArea(null)}>
                {/* Background decorative elements */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] pointer-events-none"></div>

                {/* Connections (SVG Pathing) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path
                        d="M 50 80 C 30 75, 30 70, 30 60 C 30 45, 70 50, 70 35 C 70 25, 50 25, 50 15"
                        fill="transparent"
                        stroke="#1e293b"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        vectorEffect="non-scaling-stroke"
                    />
                    <path
                        d="M 50 80 C 30 75, 30 70, 30 60"
                        fill="transparent"
                        stroke={getAreaStatus('area1', userProfile) !== 'Locked' ? '#38bdf8' : 'transparent'}
                        strokeWidth="0.4"
                        strokeDasharray="2 2"
                        vectorEffect="non-scaling-stroke"
                        className="opacity-70 backdrop-blur"
                    />
                    <path
                        d="M 30 60 C 30 45, 70 50, 70 35"
                        fill="transparent"
                        stroke={getAreaStatus('area2', userProfile) !== 'Locked' ? '#38bdf8' : 'transparent'}
                        strokeWidth="0.4"
                        strokeDasharray="2 2"
                        vectorEffect="non-scaling-stroke"
                        className="opacity-70 backdrop-blur"
                    />
                    <path
                        d="M 70 35 C 70 25, 50 25, 50 15"
                        fill="transparent"
                        stroke={getAreaStatus('area3', userProfile) !== 'Locked' ? '#38bdf8' : 'transparent'}
                        strokeWidth="0.4"
                        strokeDasharray="2 2"
                        vectorEffect="non-scaling-stroke"
                        className="opacity-70 backdrop-blur"
                    />
                </svg>

                {/* Render Map Nodes */}
                {mapData.map((area) => {
                    const status = getAreaStatus(area.id, userProfile);
                    const isLocked = status === 'Locked';
                    const isInProgress = status === 'In Progress';
                    const isSelected = selectedArea?.id === area.id;

                    return (
                        <div
                            key={area.id}
                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-10 ${isLocked ? 'cursor-not-allowed grayscale bg-blend-luminosity' : 'cursor-pointer hover:z-20'}`}
                            style={{ top: area.position.top, left: area.position.left }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isLocked) setSelectedArea(area);
                            }}
                        >
                            {/* Node Floating Animation Container */}
                            <motion.div
                                animate={{ y: isLocked ? 0 : [0, -10, 0] }}
                                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                                className="relative flex flex-col items-center group"
                            >
                                {/* The Node Icon / Circle */}
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-[0_0_30px_rgba(0,0,0,0.8)] transition-all duration-300 ${isLocked ? 'bg-slate-800 border-slate-700 opacity-50' : 'bg-slate-800 group-hover:scale-110'} ${isSelected ? 'ring-4 ring-cyan-400 ring-offset-4 ring-offset-slate-900 border-cyan-400' : ''}`}
                                    style={{ borderColor: !isLocked ? area.color : undefined }}>

                                    {/* Inner icon color */}
                                    <div className={`${isLocked ? 'text-slate-600' : 'text-slate-200'}`}>
                                        {React.cloneElement(area.icon as React.ReactElement<any>, { size: 36 })}
                                    </div>

                                    {/* Pulse effect if in progress */}
                                    {isInProgress && (
                                        <div className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping"></div>
                                    )}
                                </div>

                                {/* Node Label */}
                                <div className={`mt-4 px-4 py-2 rounded-xl backdrop-blur-md border border-slate-700 text-center whitespace-nowrap shadow-xl transition-all ${isLocked ? 'bg-slate-900/50 text-slate-500' : 'bg-slate-800/80 text-white'}`}>
                                    <p className="font-bold text-sm">{area.title}</p>
                                    <p className="text-xs font-mono opacity-70 mt-0.5">{status === 'Clear' ? '✓ DONE' : status === 'In Progress' ? '▶ IN PROGRESS' : '🔒 LOCKED'}</p>
                                </div>
                            </motion.div>
                        </div>
                    );
                })}
            </div>

            {/* --- Side Panel / Details Modal (HTML OVERLAY) --- */}
            <AnimatePresence>
                {selectedArea && (
                    <motion.div
                        initial={{ opacity: 0, x: 400 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 400 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="absolute top-0 right-0 h-full w-[450px] bg-slate-800/95 backdrop-blur-xl border-l border-slate-700 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-40 flex flex-col pointer-events-auto"
                    >
                        {/* Panel Header */}
                        <div className={`p-8 border-b border-slate-700 ${selectedArea.themeColor} relative overflow-hidden`}>
                            <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 scale-150 text-white">
                                {React.cloneElement(selectedArea.icon as React.ReactElement<any>, { size: 120 })}
                            </div>

                            <button
                                onClick={() => setSelectedArea(null)}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors shadow-lg border border-slate-600 z-50 pointer-events-auto cursor-pointer"
                            >
                                ✕
                            </button>

                            <div className="flex items-center gap-3 mb-3 text-cyan-400">
                                {selectedArea.icon}
                                <span className="uppercase tracking-widest text-xs font-bold font-mono">{selectedArea.id} / Sector</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{selectedArea.title}</h2>
                            <p className="text-slate-300 text-sm leading-relaxed">{selectedArea.description}</p>
                        </div>

                        {/* Panel Content (Scrollable) */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

                            {/* Rewards Section */}
                            {selectedArea.rewards.length > 0 && (
                                <section>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-4 h-[1px] bg-slate-600"></span>
                                        Clear Reward
                                        <span className="flex-1 h-[1px] bg-slate-600"></span>
                                    </h3>
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                                            <Scale className="text-amber-400" size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-amber-300 mb-1">구역 활성화 보상</h4>
                                            <ul className="space-y-1 text-sm text-slate-300">
                                                {selectedArea.rewards.map((reward, i) => (
                                                    <li key={i}>• {reward}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Core Contents Section */}
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-4 h-[1px] bg-slate-600"></span>
                                    Core Subjects
                                    <span className="flex-1 h-[1px] bg-slate-600"></span>
                                </h3>
                                <div className="space-y-3">
                                    {selectedArea.contents.map((content, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 + (idx * 0.1) }}
                                            className="bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 rounded-lg p-4 transition-colors cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-cyan-400 group-hover:scale-150 transition-transform shadow-[0_0_8px_cyan]"></div>
                                                <p className="text-sm text-slate-200">{content}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </section>

                            {/* Sub-level Section */}
                            {selectedArea.subLevel && (
                                <section>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-4 h-[1px] bg-slate-600"></span>
                                        Hidden Sector
                                        <span className="flex-1 h-[1px] bg-slate-600"></span>
                                    </h3>
                                    <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4 relative overflow-hidden">
                                        <div className="absolute right-0 bottom-0 opacity-10 text-purple-500">
                                            <AlertTriangle size={80} />
                                        </div>
                                        <h4 className="font-bold text-purple-300 mb-2 relative z-10">{selectedArea.subLevel}</h4>
                                        <p className="text-sm text-slate-300 relative z-10">{selectedArea.subLevelDesc}</p>
                                    </div>
                                </section>
                            )}

                            {/* Mechanics Section */}
                            {selectedArea.mechanics && selectedArea.mechanics.length > 0 && (
                                <section>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-4 h-[1px] bg-slate-600"></span>
                                        Game Mechanics
                                        <span className="flex-1 h-[1px] bg-slate-600"></span>
                                    </h3>
                                    <ul className="space-y-2">
                                        {selectedArea.mechanics.map((mech, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                                                <span className="mt-1 text-teal-400">▸</span>
                                                <span className="leading-relaxed">{mech}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                        </div>

                        {/* Action Buttons */}
                        <div className="p-6 border-t border-slate-700 bg-slate-800 pointer-events-auto">
                            <button
                                onClick={() => {
                                    if (selectedArea.id === 'hub' || selectedArea.id === 'area1') {
                                        router.push('/lecture-world/play');
                                    } else {
                                        router.push('/hazard-hunt');
                                    }
                                }}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                            >
                                <span>해당 구역 탐색 시작</span>
                                <span className="text-xl">→</span>
                            </button>
                        </div>

                    </motion.div>
                )}
            </AnimatePresence>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(30, 41, 59, 1);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(71, 85, 105, 1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(100, 116, 139, 1);
                }
                @keyframes scan {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
                .animate-scan {
                    animation: scan 3s linear infinite;
                }
                .perspective-1000 {
                    perspective: 1000px;
                }
            `}} />
        </div>
    );
}
