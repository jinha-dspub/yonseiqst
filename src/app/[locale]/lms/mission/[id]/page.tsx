"use client";

import { createClient } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function MissionViewerPage() {
    const router = useRouter();
    const params = useParams();
    const missionId = params.id as string;
    const supabase = createClient();
    
    const [mounted, setMounted] = useState(false);
    const [mission, setMission] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState<any>(null);

    useEffect(() => {
        setMounted(true);
        loadMission();
    }, [missionId]);

    const loadMission = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/");
                return;
            }

            // Fetch Mission Data
            const { data: missionData, error: missionError } = await supabase
                .from("missions")
                .select("*")
                .eq("id", missionId)
                .single();

            if (missionError) throw missionError;
            setMission(missionData);

            // Fetch or Create Progress Data
            const { data: progressData, error: progressError } = await supabase
                .from("mission_progress")
                .select("*")
                .eq("mission_id", missionId)
                .eq("user_id", user.id)
                .maybeSingle();

            if (progressData) {
                setProgress(progressData);
            } else {
                // Initialize progress as 'started'
                const { data: newProgress, error: insertError } = await supabase
                    .from("mission_progress")
                    .insert([{ mission_id: missionId, user_id: user.id, status: 'started' }])
                    .select()
                    .single();
                
                if (!insertError) {
                    setProgress(newProgress);
                }
            }
        } catch (error) {
            console.error("Error loading mission:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        await supabase
            .from("mission_progress")
            .update({ 
                status: 'completed', 
                completed_at: new Date().toISOString(),
                score: 100 // default score for now
            })
            .eq("mission_id", missionId)
            .eq("user_id", user.id);
            
        router.back();
    };

    if (!mounted || loading) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
                <div className="text-[var(--color-primary)] text-xl animate-pulse">Loading Mission Data...</div>
            </div>
        );
    }

    if (!mission) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] flex flex-col items-center justify-center text-white p-8">
                <h1 className="text-3xl font-bold text-rose-500 mb-4">Mission Not Found</h1>
                <button onClick={() => router.back()} className="px-6 py-2 bg-slate-800 rounded-md hover:bg-slate-700">Go Back</button>
            </div>
        );
    }

    // Dynamic Player Rendering based on Mission Type
    const renderPlayer = () => {
        switch (mission.type) {
            case 'markdown':
                return (
                    <div className="prose prose-invert max-w-none bg-[var(--color-card)] p-8 rounded-xl border border-[var(--color-card-border)]">
                        <h3>Markdown Content Viewer</h3>
                        <p>This is where the markdown content will be rendered based on <code>content_url = {mission.content_url || 'empty'}</code>.</p>
                        <p className="opacity-50 mt-4">(Integration with MDX or react-markdown logic goes here)</p>
                    </div>
                );
            case 'video':
                return (
                    <div className="aspect-video bg-black rounded-xl border border-[var(--color-card-border)] flex items-center justify-center shadow-xl">
                        <div className="text-center">
                            <span className="text-6xl max-w-none mb-4 block">▶️</span>
                            <p className="text-[var(--color-foreground)]/70">Video Player Component</p>
                            <p className="text-sm opacity-50"><code>{mission.content_url || 'No URL Provided'}</code></p>
                        </div>
                    </div>
                );
            case 'interactive_quiz':
                return (
                    <div className="bg-[var(--color-card)] p-8 rounded-xl border border-[var(--color-accent)]/50 shadow-[0_0_30px_rgba(0,255,209,0.1)]">
                        <h3 className="text-xl font-bold text-[var(--color-accent)] mb-6">Interactive Quiz System (Prototype)</h3>
                        <div className="space-y-4">
                            <div className="p-4 border border-[var(--color-card-border)] rounded-md hover:border-[var(--color-primary)] cursor-pointer transition-colors">
                                Option A: Yes, it is true.
                            </div>
                            <div className="p-4 border border-[var(--color-card-border)] rounded-md hover:border-[var(--color-primary)] cursor-pointer transition-colors">
                                Option B: No, it is false.
                            </div>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="bg-rose-900/20 border border-rose-500/50 p-6 rounded-xl text-rose-300">
                        Unknown mission type: {mission.type}
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)] p-8 text-white font-sans">
            <header className="mb-8 flex items-center justify-between border-b border-[var(--color-card-border)] pb-6">
                <div>
                    <span className="text-xs font-mono px-2 py-1 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded border border-[var(--color-primary)]/30 uppercase mr-3">
                        {mission.era}
                    </span>
                    <h1 className="text-3xl font-bold inline-block align-middle">{mission.title}</h1>
                </div>
                <button onClick={() => router.back()} className="px-4 py-2 text-sm text-[var(--color-foreground)]/70 hover:text-white transition-colors">
                    &larr; Abort Mission
                </button>
            </header>

            <main className="max-w-4xl mx-auto space-y-8">
                {/* Status Panel */}
                <div className="flex justify-between items-center bg-[var(--color-card)]/50 p-4 rounded-lg border border-[var(--color-card-border)] backdrop-blur-sm">
                    <div>
                        <p className="text-xs text-[var(--color-foreground)]/60 uppercase">Progress Status</p>
                        <p className={`font-bold uppercase ${progress?.status === 'completed' ? 'text-[var(--color-accent)]' : 'text-[var(--color-primary)]'}`}>
                            {progress?.status || 'Not Started'}
                        </p>
                    </div>
                    {mission.reward && (
                        <div className="text-right">
                            <p className="text-xs text-[var(--color-foreground)]/60 uppercase">Completion Reward</p>
                            <p className="font-bold text-[var(--color-accent)]">{mission.reward}</p>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <section>
                    {renderPlayer()}
                </section>

                {/* Action Footer */}
                <footer className="pt-8 border-t border-[var(--color-card-border)] flex justify-end">
                    <button 
                        onClick={handleComplete}
                        className="px-8 py-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary)-dark] text-white font-bold rounded-lg shadow-lg hover:shadow-[0_0_20px_rgba(0,103,172,0.4)] transition-all uppercase tracking-widest text-sm"
                    >
                        {progress?.status === 'completed' ? 'Re-Submit Mission' : 'Complete Mission & Claim Reward'}
                    </button>
                </footer>
            </main>
        </div>
    );
}
