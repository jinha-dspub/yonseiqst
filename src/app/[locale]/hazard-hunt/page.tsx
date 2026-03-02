"use client";

import React, { useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, useHelper, Float, Text } from "@react-three/drei";
import * as THREE from 'three';
import { SCENARIOS } from "../../../engine/hazard-hunt/rules_kosha";

// A floating point light that follows the mouse loosely (Flashlight effect)
function Flashlight() {
    const lightRef = useRef<THREE.SpotLight>(null);
    useFrame((state) => {
        if (lightRef.current) {
            // Very basic following of the mouse
            lightRef.current.position.x = state.pointer.x * 5;
            lightRef.current.position.y = state.pointer.y * 5;
            lightRef.current.target.position.set(0, 0, 0);
            lightRef.current.target.updateMatrixWorld();
        }
    });

    return (
        <spotLight
            ref={lightRef}
            color="#ccfffc"
            intensity={150}
            angle={0.4}
            penumbra={0.8}
            position={[0, 0, 5]}
            castShadow
        />
    );
}

// A 3D object acting as an interactable hazard element
function HazardBarrel({ position }: { position: [number, number, number] }) {
    return (
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
            <mesh position={position} castShadow receiveShadow>
                <cylinderGeometry args={[1, 1, 3, 32]} />
                <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.3} />
                {/* Neon Biohazard Warning */}
                <mesh position={[0, 0, 1.05]}>
                    <planeGeometry args={[1, 1]} />
                    <meshBasicMaterial color="#ff0044" />
                </mesh>
            </mesh>
        </Float>
    );
}

export default function HazardHuntEscapeRoom() {
    const [logMessage, setLogMessage] = useState<string>("SYSTEM: 진입 대기 중...");
    const [isGameOver, setIsGameOver] = useState(false);

    const [equippedItems, setEquippedItems] = useState<string[]>([]);

    const toggleItem = (id: string) => {
        setEquippedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleEvaluate = async () => {
        if (equippedItems.length === 0) {
            setLogMessage("SYSTEM: 장비를 최소 1개 이상 착용하십시오.");
            return;
        }

        setLogMessage("SYSTEM: 판독 중... (KOSHA 지침 대조)");
        try {
            const res = await fetch("/api/hazard-hunt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scenarioId: "mission_1_manhole",
                    equippedIds: equippedItems
                })
            });

            const data = await res.json();
            setLogMessage(data.log);

            if (!data.success) {
                setIsGameOver(true);
            } else {
                setIsGameOver(false);
            }
        } catch (err) {
            setLogMessage("SYSTEM ERROR: 통신 불가");
        }
    };

    return (
        <main className="relative w-screen h-screen bg-black overflow-hidden font-mono">
            {/* 3D Canvas Background */}
            <div className="absolute inset-0 z-0">
                <Canvas shadows camera={{ position: [0, 2, 8], fov: 60 }}>
                    <color attach="background" args={["#05080c"]} />
                    <fog attach="fog" args={["#05080c", 5, 15]} />

                    <ambientLight intensity={1.5} color="#ffffff" />
                    <hemisphereLight args={[0xffffff, 0x444444, 1]} />
                    <Flashlight />

                    <HazardBarrel position={[-2, 0, -2]} />
                    <HazardBarrel position={[2, 0, -3]} />

                    {/* Floor */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
                        <planeGeometry args={[50, 50]} />
                        <meshStandardMaterial color="#0B0E14" roughness={0.8} />
                    </mesh>

                    {isGameOver && (
                        <Text position={[0, 2, 0]} fontSize={1} color="#ff0000" outlineWidth={0.05} outlineColor="#000">
                            GAME OVER
                        </Text>
                    )}

                    <OrbitControls
                        enablePan={false}
                        maxPolarAngle={Math.PI / 2 - 0.1} // don't go below floor
                        minDistance={3}
                        maxDistance={10}
                    />
                </Canvas>
            </div>

            {/* UI Overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none p-8 flex flex-col justify-between">

                {/* Top Header */}
                <header className="flex justify-between items-start text-[#00FFD1]">
                    <div>
                        <h1 className="text-3xl font-bold tracking-widest uppercase">Hazard Hunt</h1>
                        <h2 className="text-lg opacity-80 mt-1">Module 03 [밀폐공간]</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-sm opacity-60">O2 LEVEL: 17.5%</p>
                        <p className="text-sm text-red-500 animate-pulse">WARNING: OXYGEN DEFICIENCY</p>
                    </div>
                </header>

                {/* HUD Bottom */}
                <div className="flex justify-between items-end gap-6">
                    {/* Action Log Box */}
                    <div className="flex-1 bg-[#0B0E14]/80 backdrop-blur border border-[#0067AC]/50 p-4 rounded-lg shadow-[0_0_15px_rgba(0,103,172,0.3)]">
                        <p className={`text-sm tracking-wide leading-relaxed ${isGameOver ? 'text-red-400' : 'text-[#aaccff]'}`}>
                            {logMessage}
                        </p>
                    </div>

                    {/* Action Panel */}
                    <div className="w-80 bg-[#0B0E14]/90 backdrop-blur border border-[#00FFD1]/30 p-4 rounded-lg flex flex-col gap-4 pointer-events-auto">
                        <h3 className="text-[#00FFD1] text-sm uppercase border-b border-[#00FFD1]/30 pb-2">Inventory Setup</h3>

                        <div className="flex items-center gap-2 text-xs text-gray-400 hover:text-white cursor-pointer" onClick={() => toggleItem('resp_gas_organic')}>
                            <input type="checkbox" checked={equippedItems.includes('resp_gas_organic')} readOnly className="accent-[#00FFD1] pointer-events-none" />
                            <span>방독마스크 (유기화합물용)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 hover:text-white cursor-pointer" onClick={() => toggleItem('resp_dust_special')}>
                            <input type="checkbox" checked={equippedItems.includes('resp_dust_special')} readOnly className="accent-[#00FFD1] pointer-events-none" />
                            <span>특급 방진마스크 (분진용)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-yellow-500 hover:text-yellow-300 cursor-pointer" onClick={() => toggleItem('resp_air')}>
                            <input type="checkbox" checked={equippedItems.includes('resp_air')} readOnly className="accent-[#00FFD1] pointer-events-none" />
                            <span>★ 공기호흡기 (독립 산소 공급)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 hover:text-white cursor-pointer" onClick={() => toggleItem('body_chemical')}>
                            <input type="checkbox" checked={equippedItems.includes('body_chemical')} readOnly className="accent-[#00FFD1] pointer-events-none" />
                            <span>전신 화학 보호복</span>
                        </div>

                        <button
                            onClick={handleEvaluate}
                            className="mt-2 py-3 bg-[#0067AC] hover:bg-[#00FFD1] text-white hover:text-black transition-colors font-bold tracking-widest uppercase text-sm disabled:opacity-50"
                        >
                            Enter Sector
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
