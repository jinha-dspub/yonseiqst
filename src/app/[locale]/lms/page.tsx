"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Search, Filter, PlayCircle, ArrowLeft, ArrowRight, GraduationCap, Target, Bell, ClipboardList } from 'lucide-react';
import { Course } from '@/lib/lms/types';
import { getMockCourse } from '@/lib/lms/mockData';
import { getCourses } from '@/lib/courseService';
import { useTranslations, useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserProfileDropdown from '@/components/dashboard/UserProfileDropdown';
import { createClient } from '@/lib/supabaseClient';

export default function LMSDashboard() {
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('LMS');
    const supabase = createClient();

    const [courses, setCourses] = useState<Course[]>([]);
    const [missions, setMissions] = useState<any[]>([]);
    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [userProfile, setUserProfile] = useState<any>(null);
    const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        setMounted(true);
        
        const initLms = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push(`/${locale}`);
                return;
            }
            
            // Get user's cohort from the database
            const { data: userData } = await supabase.from("users").select("role, name, cohort, cohort_id").eq("id", user.id).maybeSingle();
            const role = userData?.role || "student";
            const cohort = userData?.cohort || "DEFAULT";
            let cohortId = userData?.cohort_id || null;
            const name = userData?.name || user.email;
            
            // Auto-backfill: if cohort is set but cohort_id is missing, look up and persist
            if (cohort && cohort !== 'DEFAULT' && !cohortId) {
                const { data: cohortRow } = await supabase.from("cohorts").select("id").eq("name", cohort).maybeSingle();
                if (cohortRow) {
                    cohortId = cohortRow.id;
                    await supabase.from("users").update({ cohort_id: cohortId }).eq("id", user.id);
                }
            }
            
            const profile = {
                id: user.id,
                name: name,
                email: user.email,
                agent_id: role.toUpperCase(),
                role: role,
                cohort: cohort,
                cohort_id: cohortId,
                level: 1,
                exp: 0,
            };
            setUserProfile(profile);
            sessionStorage.setItem("currentUser", JSON.stringify(profile));

            // Load enrollments
            const { data: enrollData } = await supabase.from('enrollments').select('course_id').eq('user_id', user.id).eq('status', 'active');
            if (enrollData) {
                setEnrolledCourseIds(new Set(enrollData.map(e => e.course_id)));
            }

            // Load unread notifications
            const { data: notifData } = await supabase.from('notifications').select('*').eq('user_id', user.id).eq('read', false).order('created_at', { ascending: false }).limit(10);
            if (notifData) setNotifications(notifData);

            let saved = localStorage.getItem('lms_courses_db');

            // Try Supabase first for real-time sync
            const dbCourses = await getCourses();
            if (dbCourses.length > 0) {
                // Update local cache
                localStorage.setItem('lms_courses_db', JSON.stringify(dbCourses));
                saved = JSON.stringify(dbCourses);
            } else if (!saved) {
                // Initialize mock data if nothing in DB or cache
                saved = JSON.stringify([getMockCourse()]);
                localStorage.setItem('lms_courses_db', saved);
            }

            if (saved) {
                const parsed: Course[] = JSON.parse(saved);
                const published = parsed.filter(c => {
                    if (c.status !== 'published') return false;
                    if (c.visibility === 'none') return false;

                    if (c.publishDate) {
                        const kstDateStr = c.publishDate.includes('+') || c.publishDate.endsWith('Z') 
                            ? c.publishDate 
                            : (c.publishDate.includes('T') ? `${c.publishDate}:00+09:00` : `${c.publishDate}T00:00:00+09:00`);
                        
                        const publishTimeMs = new Date(kstDateStr).getTime();
                        if (publishTimeMs > Date.now()) {
                            return false; // Not yet published
                        }
                    }
                    
                    return true;
                });
                
                // Further filter based on access
                const isStaffUser = ['staff', 'admin', 'superuser'].includes(profile.role);
                const accessible = published.filter(c => {
                    if (c.visibility === 'public') return true;
                    if (c.visibility === 'cohort') {
                        // Staff/admin/superuser can see all courses
                        if (isStaffUser) return true;
                        // No cohorts assigned = treat as available to all
                        if (!c.allowedCohorts || c.allowedCohorts.length === 0) return true;
                        // Students can see if their cohort is explicitly assigned
                        if (c.allowedCohorts && (
                            (profile.cohort_id && c.allowedCohorts.includes(profile.cohort_id)) ||
                            (c.allowedCohorts.includes(profile.cohort)) // Fallback
                        )) return true;
                    }
                    return false;
                });
                
                setCourses(accessible);
            }

            const { data, error } = await supabase.from('missions').select('*').eq('status', 'Published');
            if (data && !error) {
                const hiddenTitles = ['광산 노예의 폐질환', '굴뚝청소부의 암', '이황화탄소 중독'];
                setMissions(data.filter(m => !hiddenTitles.includes(m.title)));
            }
        };

        initLms();
    }, [router, locale, supabase]);

    if (!mounted) return null;

    const filteredCourses = courses.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleEnroll = async (courseId: string) => {
        if (!userProfile) return;
        await supabase.from('enrollments').upsert({
            user_id: userProfile.id,
            course_id: courseId,
            status: 'active'
        }, { onConflict: 'user_id,course_id' });
        setEnrolledCourseIds(prev => new Set([...prev, courseId]));
    };

    // "My Courses" = cohort-restricted courses where the student's cohort IS assigned
    // "Available Courses" = public courses + cohort courses with no cohorts assigned
    const isStaffRole = userProfile && ['staff', 'admin', 'superuser'].includes(userProfile.role);
    const myCourses = filteredCourses.filter(c => {
        if (c.visibility !== 'cohort') return false;
        if (isStaffRole) return false;
        // Must have cohorts assigned AND student's cohort must be in the list
        if (!c.allowedCohorts || c.allowedCohorts.length === 0) return false;
        if (userProfile && (
            (userProfile.cohort_id && c.allowedCohorts.includes(userProfile.cohort_id)) ||
            c.allowedCohorts.includes(userProfile.cohort)
        )) return true;
        return false;
    });
    const availableCourses = filteredCourses.filter(c => {
        if (c.visibility === 'public') return true;
        if (c.visibility === 'cohort') {
            // Staff sees all cohort courses here
            if (isStaffRole) return true;
            // No cohorts assigned = available to everyone
            if (!c.allowedCohorts || c.allowedCohorts.length === 0) return true;
        }
        return false;
    });

    const filteredMissions = missions.filter(m =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.era?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-blue-600 text-white p-1.5 sm:p-2 rounded-lg">
                        <GraduationCap size={20} />
                    </div>
                    <div>
                        <h1 className="text-base sm:text-xl font-black text-slate-800 tracking-tight">{t('dashboard_title')}</h1>
                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:block">{t('course_catalog')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href={`/${locale}/lms/grades`}
                        className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-purple-600 transition-colors px-3 py-2 border border-slate-200 rounded-lg hover:border-purple-200 hover:bg-purple-50"
                    >
                        <ClipboardList size={16} /> 성적표
                    </Link>
                    <div className="relative">
                        <button className="relative p-2 text-slate-500 hover:text-blue-600 transition-colors">
                            <Bell size={20} />
                            {notifications.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{notifications.length}</span>
                            )}
                        </button>
                    </div>
                    {userProfile && <UserProfileDropdown userProfile={userProfile} />}
                    <button
                        onClick={() => router.push(`/${locale}/dashboard`)}
                        className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors px-4 py-2 border border-slate-200 rounded-lg hover:border-blue-200 hover:bg-blue-50"
                    >
                        <ArrowLeft size={16} />
                        {t('back_to_hub')}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto p-4 sm:p-8">

                {/* Hero Section */}
                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-white mb-6 sm:mb-10 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                        <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mb-2 sm:mb-4">{t('welcome')}</h2>
                        <p className="text-blue-100 text-sm sm:text-lg max-w-2xl mb-4 sm:mb-8 leading-relaxed">
                            {t('welcome_desc')}
                        </p>

                        {/* Search Bar */}
                        <div className="relative max-w-xl">
                            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder={t('search_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 rounded-xl text-slate-900 bg-white border-0 shadow-lg focus:ring-4 focus:ring-blue-500/30 transition-shadow text-base sm:text-lg outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Missions (Atoms) Grid */}
                <div className="mb-12">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                            <Target className="text-rose-500" />
                            Learning Missions
                        </h3>
                    </div>

                    {filteredMissions.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
                            <Target size={40} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500">No missions found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredMissions.map(node => (
                                <div key={node.id} className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:border-rose-300 transition-all flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-xs font-mono px-2 py-1 rounded bg-rose-50 text-rose-600 border border-rose-100 uppercase">{node.era || 'General'}</span>
                                        <span className="text-[10px] font-black uppercase text-slate-400 border border-slate-200 px-2 py-1 rounded-full">
                                            {node.type}
                                        </span>
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-800 mb-2 leading-tight">
                                        {node.title}
                                    </h4>
                                    <div className="pt-4 border-t border-slate-100 mt-4 mb-6 flex-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Reward</p>
                                        <p className="text-sm text-slate-600">{node.reward || 'No Reward'}</p>
                                    </div>
                                    <button
                                        onClick={() => router.push(`/${locale}/lms/mission/${node.id}`)}
                                        className="w-full bg-slate-100 hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        View Mission
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* My Courses Section */}
                <div className="mb-12">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                            <div className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">
                                <GraduationCap size={20} />
                            </div>
                            {t('my_courses')}
                        </h3>
                    </div>

                    {myCourses.length === 0 ? (
                        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-8 text-center">
                            <p className="text-slate-400 text-sm font-medium italic">No courses specifically assigned to your cohort yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {myCourses.map(course => (
                                <CourseCard key={course.id} course={course} t={t} locale={locale} router={router} isEnrolled={enrolledCourseIds.has(course.id)} onEnroll={handleEnroll} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Available Courses Section */}
                <div>
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                            <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                                <BookOpen size={20} />
                            </div>
                            {t('available_courses')}
                        </h3>
                    </div>

                    {availableCourses.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm col-span-full">
                            <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
                            <h3 className="text-xl font-bold text-slate-700 mb-2">{t('no_courses_title')}</h3>
                            <p className="text-slate-500">{t('no_courses_desc')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {availableCourses.map(course => (
                                <CourseCard key={course.id} course={course} t={t} locale={locale} router={router} isEnrolled={enrolledCourseIds.has(course.id)} onEnroll={handleEnroll} />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

// Sub-component for course card
function CourseCard({ course, t, locale, router, isEnrolled, onEnroll }: { course: Course, t: any, locale: string, router: any, isEnrolled?: boolean, onEnroll?: (courseId: string) => void }) {
    return (
        <div key={course.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-blue-300 transition-all group flex flex-col h-full shadow-sm">
            <div
                className="h-40 flex items-center justify-center border-b border-slate-100 relative overflow-hidden bg-cover bg-center bg-slate-100"
                style={course.thumbnail ? { backgroundImage: `url(${course.thumbnail})` } : {}}
            >
                {!course.thumbnail && <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 mix-blend-multiply group-hover:opacity-75 transition-opacity"></div>}
                {!course.thumbnail && <BookOpen size={48} className="text-slate-300 group-hover:scale-110 transition-transform duration-500" />}
                {course.thumbnail && <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300"></div>}
                {course.visibility === 'cohort' && (
                    <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-lg flex items-center gap-1">
                        <Target size={10} />
                        Assigned
                    </div>
                )}
            </div>

            <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded ${course.visibility === 'cohort' ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50'}`}>
                        {course.sections.length} {t('sections')}
                    </span>
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-2 line-clamp-2 leading-tight">
                    {course.title}
                </h4>
                <p className="text-slate-500 text-sm line-clamp-3 mb-6 flex-1">
                    {course.description || t('no_desc')}
                </p>

                <button
                    onClick={async () => {
                        if (!isEnrolled && onEnroll) {
                            await onEnroll(course.id);
                        }
                        router.push(`/${locale}/lms/course/${course.id}`);
                    }}
                    className={`w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm ${
                        course.visibility === 'cohort' 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100' 
                        : 'bg-slate-900 hover:bg-blue-600 text-white shadow-slate-100'
                    }`}
                >
                    {isEnrolled ? t('start_learning') : '수강 시작하기'}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
}
