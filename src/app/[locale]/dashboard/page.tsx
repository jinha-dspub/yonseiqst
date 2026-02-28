"use client";

import { MockUsers, MissionNodesMock } from "../../../lib/mockData";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [isStaff, setIsStaff] = useState(false);

    useEffect(() => {
        setMounted(true);
        const roleId = sessionStorage.getItem("currentUser") || "student";
        setIsStaff(roleId === "staff" || roleId === "admin" || roleId === "superuser");
        // Check if the role is a mock user, otherwise default to student mock
        if (MockUsers[roleId]) {
            setUserProfile(MockUsers[roleId]);
        } else {
            setUserProfile(MockUsers["student"]);
            // Update student name and ID if entered specifically (not saving in storage here for simplicity, but could)
        }
    }, []);

    if (!mounted || !userProfile) return null;

    return (
        <div className="min-h-screen bg-[var(--color-background)] p-8 font-sans">
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between border-b border-[var(--color-card-border)] pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] tracking-widest uppercase">
                        Mission Hub
                    </h1>
                    <p className="text-[var(--color-foreground)]/60 text-sm mt-1 uppercase tracking-wide">
                        Central Command & Control
                    </p>
                </div>
                <div className="flex items-center gap-6 bg-[var(--color-card)]/40 px-6 py-3 rounded-lg border border-[var(--color-primary)]/30 backdrop-blur-md shadow-[0_0_15px_rgba(0,103,172,0.2)]">
                    <div>
                        <p className="text-xs text-[var(--color-primary)] uppercase font-bold tracking-widest mb-1">Agent Status</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">{userProfile.name}</span>
                            <span className="text-[var(--color-foreground)]/60 text-sm font-mono">{userProfile.agent_id}</span>
                        </div>
                    </div>
                    <div className="w-px h-10 bg-[var(--color-card-border)]"></div>
                    <div>
                        <p className="text-xs text-[var(--color-accent)] uppercase font-bold tracking-widest mb-1">Level {userProfile.level}</p>
                        <p className="text-xl font-mono text-white">{userProfile.exp} <span className="text-xs text-[var(--color-foreground)]/50">EXP</span></p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Mission Board */}
                <section className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-bold uppercase tracking-widest border-l-4 border-[var(--color-primary)] pl-3 text-white">Chrono-History (역사 강의 지구)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {MissionNodesMock.map((node) => (
                            <div
                                key={node.id}
                                className={`relative overflow-hidden rounded-xl border p-6 transition-all duration-300
                  ${node.status === "Clear" ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-[0_0_20px_rgba(0,103,172,0.15)] opacity-80" : ""}
                  ${node.status === "In Progress" ? "border-[var(--color-accent)] bg-[var(--color-card)] shadow-[0_0_20px_rgba(0,255,209,0.15)] transform hover:-translate-y-1 cursor-pointer" : ""}
                  ${node.status === "Locked" ? "border-[var(--color-card-border)] bg-[var(--color-card)]/30 opacity-50 grayscale" : ""}
                `}
                            >
                                {/* Status Indicator Glow */}
                                {node.status === "In Progress" && (
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--color-accent)] opacity-20 blur-[20px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
                                )}

                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-xs font-mono px-2 py-1 rounded bg-black/50 text-[var(--color-foreground)] border border-[var(--color-card-border)] uppercase">{node.era}</span>
                                    <span className={`text-xs font-black uppercase tracking-wider
                    ${node.status === "Clear" ? "text-[var(--color-primary)]" : ""}
                    ${node.status === "In Progress" ? "text-[var(--color-accent)] animate-pulse" : ""}
                    ${node.status === "Locked" ? "text-[var(--color-foreground)]/40" : ""}
                  `}>
                                        {node.status}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-white mb-2 h-14">{node.title}</h3>

                                <div className="pt-4 border-t border-[var(--color-card-border)]/50 mt-4">
                                    <p className="text-xs text-[var(--color-foreground)]/60 uppercase mb-1">Mission Reward</p>
                                    <p className="text-sm font-medium text-[var(--color-accent)]">{node.reward}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Right Column: Inventory & Current Mission */}
                <section className="space-y-8">
                    {/* Current Directive */}
                    <div className="rounded-xl border border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5 p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-accent)]"></div>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)] mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-ping"></span>
                            Current Directive
                        </h2>
                        <p className="text-xl font-medium text-white">{userProfile.current_mission}</p>

                        <div className="mt-6 flex flex-col gap-3">
                            {isStaff ? (
                                <button
                                    onClick={() => router.push('/cms')}
                                    className="w-full bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-400 uppercase tracking-widest text-sm font-bold py-3 rounded-md transition-all flex items-center justify-center gap-2"
                                >
                                    <span>⚙️ Open Studio CMS</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => router.push('/lms')}
                                    className="w-full bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-400 uppercase tracking-widest text-sm font-bold py-3 rounded-md transition-all flex items-center justify-center gap-2"
                                >
                                    <span>📚 Enter LMS Catalog</span>
                                </button>
                            )}

                            <button
                                onClick={() => router.push('/hazard-hunt')}
                                className="w-full bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/50 text-[var(--color-accent)] uppercase tracking-widest text-sm font-bold py-3 rounded-md transition-all"
                            >
                                Enter Escape Room
                            </button>
                        </div>
                    </div>

                    {/* Inventory */}
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-widest border-l-4 border-[var(--color-foreground)]/30 pl-3 text-white mb-4">Inventory</h2>
                        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-4 shadow-xl">
                            <ul className="space-y-3">
                                {userProfile.inventory.map((item: string, index: number) => (
                                    <li key={index} className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-[var(--color-card-border)]/50 hover:border-[var(--color-primary)]/50 transition-colors">
                                        <div className="w-10 h-10 rounded bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30 flex items-center justify-center">
                                            <span className="text-[var(--color-primary)] text-xl">✨</span>
                                        </div>
                                        <span className="text-sm font-medium text-white">{item}</span>
                                    </li>
                                ))}
                                {userProfile.inventory.length === 0 && (
                                    <li className="text-center p-4 text-[var(--color-foreground)]/50 text-sm">Inventory is empty.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </section>
            </div>

            {/* Logout Button */}
            <button
                onClick={() => {
                    sessionStorage.removeItem("currentUser");
                    router.push("/");
                }}
                className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-[var(--color-card)] border border-[var(--color-primary)] shadow-[0_0_15px_rgba(0,103,172,0.3)] flex items-center justify-center text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-all z-50 group"
                title="Logout"
            >
                <span className="text-xl transform group-hover:scale-110 transition-transform">⏻</span>
            </button>
        </div>
    );
}
