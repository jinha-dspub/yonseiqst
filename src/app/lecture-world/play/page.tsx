"use client";

import React, { useState, useCallback, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Node,
    Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, ArrowLeft, BookOpen, AlertTriangle, Building2, Beaker, Shield, Scale, HelpCircle, Video, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MockUsers } from '@/lib/mockData';
import { UnitComponent } from '../builder/page';

const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11)
        ? `https://www.youtube.com/embed/${match[2]}`
        : url; // fallback to original if not matching
};

export default function PlayWorld() {
    const router = useRouter();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [mounted, setMounted] = useState(false);

    // UI states
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isExploring, setIsExploring] = useState(false);

    useEffect(() => {
        setMounted(true);
        const roleId = sessionStorage.getItem("currentUser") || 'student';

        let profile = MockUsers['student'];
        if (MockUsers[roleId]) {
            profile = MockUsers[roleId];
        }
        setUserProfile(profile);

        const isStaff = profile.role === 'staff' || profile.role === 'superuser';
        const targetLayout = isStaff ? 'draft-map-layout' : 'published-map-layout';
        const savedLayout = sessionStorage.getItem(targetLayout) || sessionStorage.getItem('published-map-layout');

        if (savedLayout) {
            try {
                const parsed = JSON.parse(savedLayout);
                if (parsed.nodes) {
                    // Enforce Publishing Controls (Open edX feature)
                    let visibleNodes = parsed.nodes;
                    if (!isStaff) {
                        visibleNodes = visibleNodes.filter((n: Node) => {
                            // If it's explicitly draft, hide it from students. Hub has no status so it shows.
                            const status = n.data?.status;
                            return status !== 'draft';
                        });
                    }
                    setNodes(visibleNodes);
                }
                if (parsed.edges) setEdges(parsed.edges);
            } catch (e) {
                console.error("Failed to parse map layout", e);
            }
        }
    }, [setNodes, setEdges]);

    const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
        setIsExploring(false);
    }, []);

    const handlePaneClick = useCallback(() => {
        setSelectedNode(null);
        setIsExploring(false);
    }, []);

    if (!mounted) return null;

    // Determine subType and icon for the selected node to match the 3D map logic
    let subType = 'default';
    let icon = <Building2 size={24} />;
    const bgColor = selectedNode?.style?.backgroundColor || '#475569';
    const title = selectedNode?.data?.label as string || 'Node';
    const markdown = selectedNode?.data?.markdown as string;
    const videoUrl = selectedNode?.data?.videoUrl as string;
    const description = selectedNode?.data?.description as string || '';

    if (bgColor === '#d97706') { subType = 'book'; icon = <BookOpen size={24} />; }
    if (bgColor === '#059669') { subType = 'visual'; icon = <Shield size={24} />; }

    const components = (selectedNode?.data?.components as UnitComponent[]) || [];
    const hasContent = components.length > 0;

    return (
        <div className="w-full h-screen bg-slate-900 font-sans flex flex-col relative overflow-hidden">

            {/* Top Navigation */}
            <div className="absolute top-0 left-0 right-0 z-30 p-6 flex justify-between items-start pointer-events-none">
                <div className="pointer-events-auto">
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-500 tracking-tight drop-shadow-md">
                        MODULE <span className="text-slate-100/50">INNER VIEW</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-slate-400 font-medium tracking-wider text-sm">직업환경보건 박물관 세부 노드</p>
                        {userProfile?.role && ['staff', 'superuser'].includes(userProfile.role) && (
                            <span className="bg-amber-500/20 text-amber-500 text-xs px-2 py-0.5 rounded border border-amber-500/30">
                                Staff Preview
                            </span>
                        )}
                    </div>
                </div>

                <div className="pointer-events-auto flex items-center gap-4">
                    <button onClick={() => router.push('/lecture-world')} className="px-5 py-2.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2 shadow-lg hover:shadow-cyan-900/20">
                        <ArrowLeft size={16} />
                        월드맵으로
                    </button>
                    <Link href="/dashboard" className="px-5 py-2.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2 shadow-lg hover:shadow-cyan-900/20">
                        대시보드로
                    </Link>
                </div>
            </div>

            {/* React Flow Canvas */}
            <div className="flex-1 w-full h-full relative z-0">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={handleNodeClick}
                    onPaneClick={handlePaneClick}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={true}
                    fitView
                    className="bg-slate-900"
                    colorMode="dark"
                >
                    <Background color="#334155" gap={20} />
                    <Controls className="bg-slate-800 border-slate-700 fill-slate-300" />
                    <MiniMap
                        nodeColor={(n) => n.style?.backgroundColor as string || '#475569'}
                        maskColor="rgba(15, 23, 42, 0.7)"
                        className="bg-slate-800 border-slate-700"
                    />
                </ReactFlow>
            </div>

            {/* SUMMARY PANEL */}
            <AnimatePresence>
                {selectedNode && !isExploring && (
                    <motion.div
                        initial={{ opacity: 0, x: 400 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 400 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="absolute top-0 right-0 h-full w-[450px] bg-slate-800/95 backdrop-blur-xl border-l border-slate-700 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-40 flex flex-col pointer-events-auto"
                    >
                        <div className={`p-8 border-b border-slate-700 bg-slate-900/50 relative overflow-hidden`}>
                            <button
                                onClick={handlePaneClick}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors shadow-lg border border-slate-600 z-50 cursor-pointer"
                            >
                                ✕
                            </button>
                            <div className="flex items-center gap-3 mb-3 text-cyan-400">
                                {icon}
                                <span className="uppercase tracking-widest text-xs font-bold font-mono">NODE INFO</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{title}</h2>
                            <p className="text-slate-300 text-sm leading-relaxed">{description || '설명이 없습니다.'}</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            {/* Staff info notice */}
                            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                                <p className="text-sm text-slate-300">
                                    이것은 세부 학습 모듈입니다. 아래 버튼을 눌러 해당 모듈의 상세 콘텐츠 구역으로 진입하세요.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-700 bg-slate-800 pointer-events-auto">
                            <button
                                onClick={() => {
                                    if (hasContent) {
                                        setIsExploring(true);
                                    } else {
                                        alert("이 노드에는 아직 상세 콘텐츠가 등록되지 않았습니다.");
                                    }
                                }}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                            >
                                <span>{hasContent ? '학습 콘텐츠 열기' : '콘텐츠 없음'}</span>
                                <span className="text-xl">→</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* UNIFIED COMPONENT STORE MODAL */}
            <AnimatePresence>
                {selectedNode && isExploring && hasContent && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="absolute top-[5%] left-[10%] right-[10%] bottom-[5%] bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_0_100px_rgba(6,182,212,0.2)] z-50 rounded-2xl flex flex-col overflow-hidden pointer-events-auto"
                    >
                        {/* Header */}
                        <div className="flex-none p-6 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                                    {icon}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-500">
                                        {title}
                                    </h2>
                                    <p className="text-cyan-500/70 font-mono text-sm tracking-widest uppercase">
                                        Unit Modules: {components.length} Blocks
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsExploring(false)}
                                className="w-10 h-10 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all shadow-lg border border-slate-600"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Scrollable Component Stack */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-900/50 space-y-12">
                            {components.map((comp, idx) => (
                                <div key={comp.id} className="w-full max-w-4xl mx-auto">
                                    {/* Component Header Block */}
                                    <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm font-bold uppercase tracking-widest border-b border-slate-800 pb-2">
                                        <span className="text-cyan-500">Block {idx + 1}</span>
                                        <span className="opacity-50">•</span>
                                        {comp.type === 'html' && <><FileText size={16} /> HTML / Markdown</>}
                                        {comp.type === 'video' && <><Video size={16} /> Video Player</>}
                                        {comp.type === 'quiz' && <><HelpCircle size={16} /> Internal Assessment</>}
                                    </div>

                                    {/* Render HTML Block */}
                                    {comp.type === 'html' && (
                                        <div className="prose prose-invert prose-cyan max-w-none bg-slate-800/30 p-8 rounded-2xl border border-slate-700/50">
                                            <div className="whitespace-pre-wrap text-slate-200 font-medium text-lg leading-relaxed">
                                                {comp.content || <span className="text-slate-500 italic">Empty text block.</span>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Render Video Block */}
                                    {comp.type === 'video' && (
                                        <div className="aspect-video w-full bg-black rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative">
                                            {comp.content ? (
                                                <iframe
                                                    src={getYouTubeEmbedUrl(comp.content)}
                                                    className="w-full h-full"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                ></iframe>
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                                                    <Video size={48} className="mb-4 opacity-50" />
                                                    <p>Video URL not provided.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Render Quiz Block */}
                                    {comp.type === 'quiz' && (
                                        <div className="bg-slate-800/80 rounded-2xl border border-purple-500/30 p-8 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-8 opacity-5 text-purple-400 pointer-events-none">
                                                <HelpCircle size={200} />
                                            </div>
                                            <div className="flex justify-between items-start mb-6 align-top">
                                                <h3 className="text-xl font-bold text-slate-200">
                                                    Knowledge Check
                                                </h3>
                                                {/* Open edX Metadata Badges */}
                                                <div className="flex gap-2">
                                                    <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded-md font-mono flex items-center gap-1">
                                                        <Scale size={12} /> {comp.weight !== undefined ? comp.weight : 1.0} pts
                                                    </span>
                                                    <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded-md font-mono flex items-center gap-1">
                                                        <Shield size={12} /> {comp.attempts ? `${comp.attempts} attempts` : 'Unlimited'}
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="text-lg text-slate-300 leading-relaxed font-medium mb-8 whitespace-pre-wrap relative z-10">
                                                {comp.content || 'Question content missing.'}
                                            </p>
                                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                                {['Option A', 'Option B', 'Option C', 'Option D'].map((answer, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => alert('Assessment recorded. (Demo)')}
                                                        className="bg-slate-900/50 hover:bg-purple-900/40 border border-slate-700 hover:border-purple-500/80 text-slate-300 hover:text-white p-4 rounded-xl text-left transition-all hover:shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                                                    >
                                                        <span className="font-mono text-purple-400 mr-2">{i + 1}.</span> {answer}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 1); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 1); }
                .perspective-1000 { perspective: 1000px; }
            `}} />
        </div>
    );
}
