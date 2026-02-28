"use client";

import React, { useState, useCallback, useRef } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    MiniMap,
    Panel,
    Node,
    Edge,
    Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';
import { LogOut, Save, Plus, ArrowLeft, BookOpen, Image as ImageIcon, HelpCircle, Terminal, UploadCloud, Eye, Trash2, Video, FileText } from 'lucide-react';

// --- Types for Component Store ---
export type ComponentType = 'html' | 'video' | 'quiz';

export interface UnitComponent {
    id: string;
    type: ComponentType;
    content: string; // Markdown text, Video URL, or Quiz JSON string
    // Open edX Advanced Quiz Properties
    weight?: number;      // 배점
    attempts?: number;    // 시도 횟수 제한 (0 = 무제한)
    showAnswer?: 'always' | 'never' | 'answered' | 'attempted';
}

interface NodeData {
    [key: string]: any; // Satisfy ReactFlow Record<string, unknown>
    label: string;
    description: string;
    components: UnitComponent[];
    status?: 'draft' | 'published'; // Unit level publishing control
}

// Define initial nodes
const initialNodes: Node[] = [
    {
        id: 'hub',
        type: 'default',
        data: { label: '[Center Hub] 직업환경보건 박물관' },
        position: { x: 400, y: 100 },
        style: { backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold' }
    },
];

const initialEdges: Edge[] = [];

// Sidebar Drag-and-Drop component
const Sidebar = () => {
    const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/label', label);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="w-64 bg-slate-800 border-r border-slate-700 p-4 flex flex-col gap-4 text-slate-200 shadow-xl z-10">
            <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-widest border-b border-slate-700 pb-2">Node Types</h2>

            <div
                className="cursor-grab hover:bg-slate-700 p-3 rounded-lg border border-slate-600 flex items-center gap-3 transition-colors"
                onDragStart={(event) => onDragStart(event, 'lecture', '강의 노드 (Book)')}
                draggable
            >
                <div className="bg-amber-600 p-2 rounded text-white shadow"><BookOpen size={16} /></div>
                <span className="text-sm font-medium">강의 노드 (Book)</span>
            </div>

            <div
                className="cursor-grab hover:bg-slate-700 p-3 rounded-lg border border-slate-600 flex items-center gap-3 transition-colors"
                onDragStart={(event) => onDragStart(event, 'visual', '시각 자료 (Frame)')}
                draggable
            >
                <div className="bg-emerald-600 p-2 rounded text-white shadow"><ImageIcon size={16} /></div>
                <span className="text-sm font-medium">시각 자료 (Frame)</span>
            </div>

            <div
                className="cursor-grab hover:bg-slate-700 p-3 rounded-lg border border-slate-600 flex items-center gap-3 transition-colors"
                onDragStart={(event) => onDragStart(event, 'quiz', '퀴즈 노드 (?)')}
                draggable
            >
                <div className="bg-purple-600 p-2 rounded text-white shadow"><HelpCircle size={16} /></div>
                <span className="text-sm font-medium">퀴즈 노드 (?)</span>
            </div>

            <div
                className="cursor-grab hover:bg-slate-700 p-3 rounded-lg border border-slate-600 flex items-center gap-3 transition-colors"
                onDragStart={(event) => onDragStart(event, 'practice', '실습 포탈')}
                draggable
            >
                <div className="bg-slate-600 p-2 rounded text-white shadow"><Terminal size={16} /></div>
                <span className="text-sm font-medium">실습 포탈 (Terminal)</span>
            </div>

            <div className="mt-8 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-400">
                <p className="font-bold text-slate-300 mb-1">사용법:</p>
                <ol className="list-decimal pl-4 space-y-1">
                    <li>원하는 노드를 오른쪽 캔버스로 드래그 앤 드롭 하세요.</li>
                    <li>노드의 동그라미(핸들)를 드래그하여 다른 노드와 연결하세요.</li>
                    <li>저장 버튼을 눌러 상태를 보존하세요.</li>
                </ol>
            </div>
        </div>
    );
};

let id = 0;
const getId = () => `dndnode_${id++}`;

function BuilderFlow() {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    const updateNodeData = (id: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            ...newData,
                        },
                    };
                }
                return node;
            })
        );
    };

    // Load Draft from session storage on mount
    const onInit = useCallback((instance: any) => {
        setReactFlowInstance(instance);
        const draft = sessionStorage.getItem('draft-map-layout');
        if (draft) {
            try {
                const parsed = JSON.parse(draft);
                if (parsed.nodes) setNodes(parsed.nodes);
                if (parsed.edges) setEdges(parsed.edges);
            } catch (e) {
                console.error("Failed to parse draft layout", e);
            }
        }
    }, [setNodes, setEdges]);

    const onConnect = useCallback(
        (params: Connection | Edge) => {
            const edge: Edge = { ...params, id: `e${params.source}-${params.target}`, animated: true, style: { stroke: '#38bdf8', strokeWidth: 2 } } as Edge;
            setEdges((eds) => addEdge(edge, eds))
        },
        [setEdges],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            if (!reactFlowWrapper.current || !reactFlowInstance) return;

            const type = event.dataTransfer.getData('application/reactflow');
            const label = event.dataTransfer.getData('application/label');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            let bgColor = '#475569';
            if (type === 'lecture') bgColor = '#d97706';
            if (type === 'visual') bgColor = '#059669';
            if (type === 'quiz') bgColor = '#9333ea';

            const newNode: Node = {
                id: getId(),
                type: 'default', // Using default type for now, but we can create custom components later
                position,
                data: {
                    label: `${label}`,
                    description: '',
                    components: [], // Initialize empty component array
                    status: 'draft' // Default to draft
                } as NodeData,
                style: {
                    backgroundColor: bgColor,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                    padding: '10px 15px',
                    fontWeight: 'bold'
                }
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes],
    );

    const onSave = useCallback(() => {
        if (reactFlowInstance) {
            const flow = reactFlowInstance.toObject();
            sessionStorage.setItem('draft-map-layout', JSON.stringify(flow));
            alert('Draft saved! (Staff only)');
        } else {
            alert('Cannot save: React Flow instance not ready.');
        }
    }, [reactFlowInstance]);

    const onPublish = useCallback(() => {
        if (reactFlowInstance) {
            const flow = reactFlowInstance.toObject();
            // Save both draft and published states
            sessionStorage.setItem('draft-map-layout', JSON.stringify(flow));
            sessionStorage.setItem('published-map-layout', JSON.stringify(flow));
            alert('Map Published successfully! Students will now see this version.');
        } else {
            alert('Cannot publish: React Flow instance not ready.');
        }
    }, [reactFlowInstance]);

    return (
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(e, node) => setSelectedNodeId(node.id)}
                onPaneClick={() => setSelectedNodeId(null)}
                onInit={onInit}
                onDrop={onDrop}
                onDragOver={onDragOver}
                fitView
                className="bg-slate-900"
                colorMode="dark"
            >
                <Controls className="bg-slate-800 border-slate-700 fill-white" />
                <MiniMap
                    nodeStrokeColor={(n) => {
                        if (n.style?.backgroundColor) return n.style.backgroundColor as string;
                        return '#eee';
                    }}
                    nodeColor={(n) => {
                        if (n.style?.backgroundColor) return n.style.backgroundColor as string;
                        return '#fff';
                    }}
                    maskColor="rgba(15, 23, 42, 0.8)"
                    className="bg-slate-800 border-slate-700"
                />
                <Background color="#334155" gap={16} />
                <Panel position="top-right" className="flex gap-2">
                    <button onClick={onSave} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 px-4 py-2 rounded-md shadow-lg font-bold transition-colors">
                        <Save size={16} /> Save Draft
                    </button>
                    <button onClick={onPublish} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-4 py-2 rounded-md shadow-lg shadow-cyan-500/30 font-bold transition-all hover:scale-105">
                        <UploadCloud size={16} /> Publish to Students
                    </button>
                </Panel>
            </ReactFlow>

            {/* Right Side Panel for Node Editing */}
            {selectedNode && (
                <div className="absolute top-0 right-0 w-80 h-full bg-slate-800 border-l border-slate-700 p-6 flex flex-col gap-4 text-slate-200 shadow-2xl z-20 overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                        <h2 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Terminal size={18} className="text-cyan-400" /> Properties
                        </h2>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if (confirm('이 노드를 삭제하시겠습니까? (연결된 선도 함께 삭제됩니다)')) {
                                        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                                        setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                                        setSelectedNodeId(null);
                                    }
                                }}
                                className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1 text-xs font-bold"
                            >
                                <Trash2 size={16} /> 삭제
                            </button>
                            <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Publishing Status</label>
                        <select
                            className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                            value={(selectedNode.data as NodeData).status || 'draft'}
                            onChange={(e) => updateNodeData(selectedNode.id, { status: e.target.value })}
                        >
                            <option value="draft">Draft (단독 저장, 학생 미노출)</option>
                            <option value="published">Published (전체 Publish 시 포함 배포됨)</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Node Title</label>
                        <input
                            type="text"
                            className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                            value={selectedNode.data.label as string || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase">Description</label>
                        <textarea
                            className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white h-20 resize-none focus:outline-none focus:border-cyan-500"
                            value={selectedNode.data.description as string || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { description: e.target.value })}
                            placeholder="노드 설명 (맵 클릭 시 보임)"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5 mt-2">
                        <label className="text-xs font-bold text-amber-500 uppercase flex items-center justify-between">
                            <span className="flex items-center gap-1"><Terminal size={14} /> Components (Unit Blocks)</span>
                        </label>

                        {/* Store / Add Component Buttons */}
                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => {
                                    const currentComponents = (selectedNode.data.components as UnitComponent[]) || [];
                                    updateNodeData(selectedNode.id, {
                                        components: [...currentComponents, { id: Date.now().toString(), type: 'html', content: '' }]
                                    });
                                }}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs py-1.5 rounded border border-slate-600 flex items-center justify-center gap-1"
                            >
                                <FileText size={12} /> + HTML
                            </button>
                            <button
                                onClick={() => {
                                    const currentComponents = (selectedNode.data.components as UnitComponent[]) || [];
                                    updateNodeData(selectedNode.id, {
                                        components: [...currentComponents, { id: Date.now().toString(), type: 'video', content: '' }]
                                    });
                                }}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs py-1.5 rounded border border-slate-600 flex items-center justify-center gap-1"
                            >
                                <Video size={12} /> + Video
                            </button>
                            <button
                                onClick={() => {
                                    const currentComponents = (selectedNode.data.components as UnitComponent[]) || [];
                                    updateNodeData(selectedNode.id, {
                                        components: [...currentComponents, { id: Date.now().toString(), type: 'quiz', content: '' }]
                                    });
                                }}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs py-1.5 rounded border border-slate-600 flex items-center justify-center gap-1"
                            >
                                <HelpCircle size={12} /> + Quiz
                            </button>
                        </div>

                        {/* List of Components */}
                        <div className="space-y-3">
                            {((selectedNode.data.components as UnitComponent[]) || []).map((comp, index) => (
                                <div key={comp.id} className="bg-slate-900 border border-slate-700 rounded-lg p-3 relative group">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs font-bold uppercase flex items-center gap-1 text-slate-300">
                                            {comp.type === 'html' && <FileText size={14} className="text-amber-500" />}
                                            {comp.type === 'video' && <Video size={14} className="text-rose-500" />}
                                            {comp.type === 'quiz' && <HelpCircle size={14} className="text-purple-500" />}
                                            {comp.type} Block
                                        </div>
                                        <button
                                            onClick={() => {
                                                const currentComponents = (selectedNode.data.components as UnitComponent[]) || [];
                                                updateNodeData(selectedNode.id, {
                                                    components: currentComponents.filter(c => c.id !== comp.id)
                                                });
                                            }}
                                            className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    {comp.type === 'html' ? (
                                        <textarea
                                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white h-24 font-mono focus:outline-none focus:border-amber-500"
                                            value={comp.content}
                                            onChange={(e) => {
                                                const currentComponents = [...((selectedNode.data.components as UnitComponent[]) || [])];
                                                currentComponents[index].content = e.target.value;
                                                updateNodeData(selectedNode.id, { components: currentComponents });
                                            }}
                                            placeholder="# HTML/Markdown Content"
                                        />
                                    ) : comp.type === 'video' ? (
                                        <input
                                            type="text"
                                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-rose-500"
                                            value={comp.content}
                                            onChange={(e) => {
                                                const currentComponents = [...((selectedNode.data.components as UnitComponent[]) || [])];
                                                currentComponents[index].content = e.target.value;
                                                updateNodeData(selectedNode.id, { components: currentComponents });
                                            }}
                                            placeholder="https://youtube.com/watch?v=..."
                                        />
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <textarea
                                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white h-24 font-mono focus:outline-none focus:border-purple-500"
                                                value={comp.content}
                                                onChange={(e) => {
                                                    const currentComponents = [...(((selectedNode.data as NodeData).components as UnitComponent[]) || [])];
                                                    currentComponents[index].content = e.target.value;
                                                    updateNodeData(selectedNode.id, { components: currentComponents });
                                                }}
                                                placeholder="Question Markdown here..."
                                            />
                                            {/* Open edX Quiz Properties */}
                                            <div className="grid grid-cols-2 gap-2 mt-2 bg-slate-950 p-3 rounded-md border border-slate-800">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Weight (배점)</label>
                                                    <input
                                                        type="number" min="0" step="0.5"
                                                        className="bg-slate-800 border border-slate-700 rounded p-1.5 pl-2 text-xs text-white"
                                                        value={comp.weight !== undefined ? comp.weight : 1.0}
                                                        onChange={(e) => {
                                                            const currentComponents = [...(((selectedNode.data as NodeData).components as UnitComponent[]) || [])];
                                                            currentComponents[index].weight = parseFloat(e.target.value);
                                                            updateNodeData(selectedNode.id, { components: currentComponents });
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Attempts (제한)</label>
                                                    <input
                                                        type="number" min="0" step="1"
                                                        className="bg-slate-800 border border-slate-700 rounded p-1.5 pl-2 text-xs text-white"
                                                        value={comp.attempts !== undefined ? comp.attempts : 0}
                                                        onChange={(e) => {
                                                            const currentComponents = [...(((selectedNode.data as NodeData).components as UnitComponent[]) || [])];
                                                            currentComponents[index].attempts = parseInt(e.target.value, 10);
                                                            updateNodeData(selectedNode.id, { components: currentComponents });
                                                        }}
                                                        placeholder="0 = 무제한"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1 col-span-2 mt-1">
                                                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Show Answer (정답 공개)</label>
                                                    <select
                                                        className="bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white"
                                                        value={comp.showAnswer || 'answered'}
                                                        onChange={(e) => {
                                                            const currentComponents = [...(((selectedNode.data as NodeData).components as UnitComponent[]) || [])];
                                                            currentComponents[index].showAnswer = e.target.value as any;
                                                            updateNodeData(selectedNode.id, { components: currentComponents });
                                                        }}
                                                    >
                                                        <option value="answered">답변 후 공개 (Answered)</option>
                                                        <option value="always">항상 공개 (Always)</option>
                                                        <option value="never">공개 안 함 (Never)</option>
                                                        <option value="attempted">시도 횟수 소진 시 (Attempted)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {((selectedNode.data.components as UnitComponent[]) || []).length === 0 && (
                                <div className="text-center text-slate-500 text-xs py-4 border border-dashed border-slate-700 rounded">
                                    No components added yet.
                                </div>
                            )}
                        </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-4 text-center">Changes are autosaved to draft when you click "Save Draft".</p>
                </div>
            )}
        </div>
    );
}

export default function NodeBuilderPage() {
    const router = useRouter();

    const handleLogout = () => {
        sessionStorage.removeItem("currentUser");
        router.push("/");
    };

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
            {/* Top Header */}
            <header className="h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500 tracking-tight uppercase">
                        Staff Node Builder
                    </h1>
                    <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded font-mono border border-slate-700">Lecture World Admin</span>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </button>
                    <button onClick={() => router.push('/lecture-world')} className="flex items-center gap-2 text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors ml-2 bg-cyan-900/30 px-3 py-1.5 rounded border border-cyan-800">
                        <Eye size={16} /> Preview 3D Map
                    </button>
                    <div className="w-px h-6 bg-slate-800 ml-2"></div>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-400 transition-colors">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">
                <ReactFlowProvider>
                    <Sidebar />
                    <BuilderFlow />
                </ReactFlowProvider>
            </div>
        </div>
    );
}
