"use client";

import { createClient } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UserProfileDropdown from "@/components/dashboard/UserProfileDropdown";
import { MissionNodesMock } from "@/lib/mockData";
import { getCourses } from "@/lib/courseService";
import { BookOpen, PlayCircle, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";

export default function DashboardPage() {
    const router = useRouter();
    const locale = useLocale();
    const supabase = createClient();
    const [mounted, setMounted] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [isStaff, setIsStaff] = useState(false);
    const [assignedCourse, setAssignedCourse] = useState<any>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        setMounted(true);
        loadUserData();
    }, []);

    const loadUserData = async () => {
        setIsRefreshing(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push("/");
            return;
        }

        const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
        const role = userData?.role || "student";
        const cohort = userData?.cohort || "DEFAULT";
        let cohortId = userData?.cohort_id || null;
        const name = userData?.name || user.user_metadata?.full_name || user.email;

        // Auto-backfill: if cohort is set but cohort_id is missing, look up and persist
        if (cohort && cohort !== 'DEFAULT' && !cohortId) {
            const { data: cohortRow } = await supabase.from("cohorts").select("id").eq("name", cohort).maybeSingle();
            if (cohortRow) {
                cohortId = cohortRow.id;
                await supabase.from("users").update({ cohort_id: cohortId }).eq("id", user.id);
            }
        }

        setIsStaff(role === "staff" || role === "admin" || role === "superuser" || role === "lecturer");

        // Fetch courses to find assigned ones
        const allCourses = await getCourses();
        const publishedCourses = allCourses.filter(c => c.status === 'published');

        // Find courses specifically for this user's cohort
        const cohortCourses = publishedCourses.filter(c =>
            c.visibility === 'cohort' && (
                (c.allowedCohorts && cohortId && c.allowedCohorts.includes(cohortId)) ||
                (c.allowedCohorts && c.allowedCohorts.includes(cohort)) // Fallback for name-based (deprecated)
            )
        );

        // If no cohort specific, maybe show public ones
        const publicCourses = publishedCourses.filter(c => c.visibility === 'public');

        const priorityCourse = cohortCourses[0] || publicCourses[0];
        if (priorityCourse) {
            setAssignedCourse(priorityCourse);
        }

        const profile = {
            id: user.id,
            name: name,
            email: user.email,
            agent_id: role.toUpperCase(),
            role: role,
            cohort: cohort,
            level: 1,
            exp: 0,
            inventory: [],
            current_mission: priorityCourse ? priorityCourse.title : "Waiting for Assignment"
        };

        setUserProfile(profile);
        sessionStorage.setItem("currentUser", JSON.stringify(profile));
        setIsRefreshing(false);
    };

    if (!mounted || !userProfile) return null;

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 tracking-widest uppercase">
                        Mission Hub
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 uppercase tracking-wide font-medium">
                        Central Command & Control
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={loadUserData}
                        disabled={isRefreshing}
                        className={`p-2 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <UserProfileDropdown userProfile={userProfile} />
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Inventory & Current Mission (1 col) */}
                <section className="space-y-8 lg:col-span-1">
                    {/* Current Directive */}
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-8 relative overflow-hidden flex flex-col justify-center min-h-[280px] shadow-sm group">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <BookOpen size={120} />
                        </div>
                        <h2 className="text-xs font-black uppercase tracking-widest text-indigo-700 mb-6 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                            Current Directive
                        </h2>

                        <div className="relative z-10">
                            <p className="text-3xl font-black text-slate-800 mb-4 tracking-tight leading-tight">
                                {userProfile.current_mission}
                            </p>

                            {assignedCourse ? (
                                <div className="space-y-6">
                                    <p className="text-slate-600 font-medium max-w-md line-clamp-2">
                                        {assignedCourse.description || "No mission brief available for this objective."}
                                    </p>
                                    <button
                                        onClick={() => router.push(`/${locale}/lms/course/${assignedCourse.id}`)}
                                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        <PlayCircle size={20} />
                                        <span>EXECUTE MISSION</span>
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            ) : (
                                <p className="text-base text-slate-500 font-medium">
                                    Awaiting orders from command. Check the LMS Catalog for available self-study modules.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Inventory */}
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-widest border-l-4 border-slate-300 pl-3 text-slate-700 mb-4">Inventory</h2>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <ul className="space-y-3">
                                {userProfile.inventory.length > 0 ? userProfile.inventory.map((item: string, index: number) => (
                                    <li key={index} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                                        <div className="w-10 h-10 rounded bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
                                            <span className="text-blue-600 text-xl">✨</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">{item}</span>
                                    </li>
                                )) : (
                                    <li className="text-center p-4 text-slate-400 font-medium text-sm">Inventory is empty.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Right Column: Access Portals - LMS & Games (1 col) */}
                <section className="space-y-8 lg:col-span-1">
                    <h2 className="text-xl font-bold uppercase tracking-widest border-l-4 border-blue-500 pl-3 text-slate-800">Access Portals</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* LMS Catalog */}
                        <div className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm flex flex-col h-full transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-blue-400 group">
                            <div className="mb-4 text-4xl group-hover:scale-110 transition-transform origin-left">📚</div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-wide group-hover:text-blue-700 transition-colors">LMS Catalog</h3>
                            <p className="text-slate-600 font-medium mb-8 flex-grow">
                                Access all available learning modules, missions, and historical archives. View your progress and explore new content.
                            </p>
                            <button
                                onClick={() => router.push('/lms')}
                                className="w-full bg-blue-50 hover:bg-blue-600 border border-blue-200 hover:border-blue-600 text-blue-700 hover:text-white uppercase tracking-widest text-sm font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]"
                            >
                                <span>Enter Catalog</span>
                            </button>
                        </div>

                        {/* Games / Quests */}
                        <div className="rounded-xl border border-indigo-200 bg-white p-6 shadow-sm flex flex-col h-full transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-indigo-400 group">
                            <div className="mb-4 text-4xl group-hover:scale-110 transition-transform origin-left">🎮</div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-wide group-hover:text-indigo-700 transition-colors">Quests & Games</h3>
                            <p className="text-slate-600 font-medium mb-8 flex-grow">
                                Engage in interactive learning simulations, escape rooms, and practical problem-solving scenarios.
                            </p>
                            <button
                                onClick={() => router.push(`/${locale}/hazard-hunt`)}
                                className="w-full bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 text-indigo-700 hover:text-white uppercase tracking-widest text-sm font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]"
                            >
                                <span>Play Quests</span>
                            </button>
                        </div>

                        {/* Staff Only: CMS Tool */}
                        {isStaff && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm flex flex-col h-full md:col-span-2 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-emerald-400">
                                <div className="flex items-start justify-between mb-4">
                                    <h3 className="text-xl font-black text-emerald-800 uppercase tracking-wide flex items-center gap-2">
                                        <span className="text-2xl">⚙️</span>
                                        Open Studio CMS
                                    </h3>
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded uppercase tracking-wider border border-emerald-200">Staff Only</span>
                                </div>
                                <p className="text-emerald-700/80 font-medium mb-6">
                                    Content management system for creating, editing, and assigning missions, cohorts, and learning materials.
                                </p>
                                <button
                                    onClick={() => router.push('/cms')}
                                    className="w-full md:w-auto self-start px-8 bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 text-white uppercase tracking-widest text-sm font-bold py-3 rounded-xl transition-all shadow-sm hover:shadow-md transform active:scale-[0.98]"
                                >
                                    Enter CMS
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
