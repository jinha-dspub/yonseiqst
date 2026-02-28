import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { BookOpen, Shield, Beaker, Building2 } from 'lucide-react';

interface Area {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    contents: string[];
    rewards: string[];
    mechanics?: string[];
    position: [number, number, number];
    color: string; // Hex for 3D material
    icon: React.ReactNode;
    subType?: 'default' | 'book' | 'quiz';
    subLevel?: string;
    subLevelDesc?: string;
}

interface MapNodeProps {
    area: Area;
    status: 'Clear' | 'In Progress' | 'Locked';
    isSelected: boolean;
    onClick: (area: Area) => void;
}

export function MapNode3D({ area, status, isSelected, onClick }: MapNodeProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHover] = useState(false);

    // Simple rotation and pulse animation
    useFrame((state, delta) => {
        if (meshRef.current) {
            if (status === 'Locked') {
                // Very slow idle rotation for locked nodes
                meshRef.current.rotation.y += delta * 0.1;
            } else {
                meshRef.current.rotation.y += delta * 0.5;

                // Pulse effect for 'In Progress'
                if (status === 'In Progress' && !isSelected) {
                    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
                    meshRef.current.scale.set(pulse, pulse, pulse);
                }
            }
        }
    });

    const isLocked = status === 'Locked';

    // Scale based on hover/selection (only if unlocked)
    let scale = 1;
    if (!isLocked) {
        scale = isSelected ? 1.5 : hovered ? 1.2 : 1;
    }

    return (
        <Float speed={isLocked ? 0.5 : 2} rotationIntensity={isLocked ? 0.2 : 0.5} floatIntensity={1}>
            <group position={area.position}>
                {/* The 3D Object */}
                <mesh
                    ref={meshRef}
                    scale={status === 'In Progress' && !isSelected ? 1 : scale} // scale is handled by pulse in useFrame for In Progress
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isLocked) onClick(area);
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        if (!isLocked) {
                            setHover(true);
                            document.body.style.cursor = 'pointer';
                        }
                    }}
                    onPointerOut={() => {
                        if (!isLocked) {
                            setHover(false);
                            document.body.style.cursor = 'auto';
                        }
                    }}
                >
                    {area.subType === 'book' ? (
                        <boxGeometry args={[1.2, 0.4, 1.6]} /> // Book shape
                    ) : area.subType === 'quiz' ? (
                        <icosahedronGeometry args={[1, 0]} /> // complex shape for quiz
                    ) : (
                        <octahedronGeometry args={[1, 0]} /> // default
                    )}
                    <meshStandardMaterial
                        color={isLocked ? '#334155' : area.color} // Slate-700 if locked
                        emissive={isLocked ? '#000000' : area.color}
                        emissiveIntensity={isLocked ? 0 : (isSelected || hovered || status === 'In Progress' ? 0.8 : 0.2)}
                        roughness={isLocked ? 0.9 : 0.2}
                        metalness={isLocked ? 0.1 : 0.8}
                        wireframe={isLocked}
                        transparent={isLocked}
                        opacity={isLocked ? 0.5 : 1}
                    />
                </mesh>

                {/* Floating HTML Icon inside the node */}
                <Html position={[0, 0, 0]} center transform style={{ pointerEvents: 'none' }}>
                    <div className={`transition-transform duration-300
                ${isLocked ? 'text-slate-500 opacity-50 scale-75 blur-[1px]' : 'text-white drop-shadow-lg'} 
                ${(!isLocked && (isSelected || hovered)) ? 'scale-125' : 'scale-100'}`}
                    >
                        {area.icon}
                    </div>
                </Html>

                {/* 3D Text Label below the node */}
                <Text
                    position={[0, -1.8, 0]}
                    fontSize={0.4}
                    color={isLocked ? "#475569" : "white"}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={isLocked ? 0 : 0.04}
                    outlineColor="#000000"
                >
                    {isLocked ? '???' : area.title}
                </Text>

                {/* Lock Icon indicator for Locked nodes */}
                {isLocked && (
                    <Html position={[0, -2.5, 0]} center transform style={{ pointerEvents: 'none' }}>
                        <div className="bg-slate-800 border border-slate-700 text-slate-400 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest shadow-xl flex items-center gap-2">
                            <span className="text-red-400">🔒</span> LOCKED
                        </div>
                    </Html>
                )}

                {/* Status Indicator for In Progress nodes */}
                {status === 'In Progress' && (
                    <Html position={[0, 1.8, 0]} center transform style={{ pointerEvents: 'none' }}>
                        <div className="bg-cyan-900 border border-cyan-400 text-cyan-50 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest shadow-[0_0_15px_rgba(34,211,238,0.5)] flex items-center gap-2 animate-bounce">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span> IN PROGRESS
                        </div>
                    </Html>
                )}
            </group>
        </Float>
    );
}
