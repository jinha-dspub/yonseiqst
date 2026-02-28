"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Search, Filter, PlayCircle, ArrowLeft, ArrowRight, GraduationCap } from 'lucide-react';
import { Course } from '@/lib/lms/types';
import { getMockCourse } from '@/lib/lms/mockData';
import { useTranslations, useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function LMSDashboard() {
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('LMS');

    const [courses, setCourses] = useState<Course[]>([]);
    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setMounted(true);
        let saved = sessionStorage.getItem('lms_courses_db');

        // Initialize mock data if empty
        if (!saved) {
            saved = JSON.stringify([getMockCourse()]);
            sessionStorage.setItem('lms_courses_db', saved);
        }

        if (saved) {
            // Only show published courses to students
            const parsed: Course[] = JSON.parse(saved);
            const published = parsed.filter(c => c.status === 'published');
            setCourses(published);
        }
    }, [router]);

    if (!mounted) return null;

    const filteredCourses = courses.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white p-2 rounded-lg">
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">{t('dashboard_title')}</h1>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('course_catalog')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <LanguageSwitcher />
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
            <main className="max-w-6xl mx-auto p-8">

                {/* Hero Section */}
                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-10 text-white mb-10 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                        <h2 className="text-3xl font-extrabold tracking-tight mb-4">{t('welcome')}</h2>
                        <p className="text-blue-100 text-lg max-w-2xl mb-8 leading-relaxed">
                            {t('welcome_desc')}
                        </p>

                        {/* Search Bar */}
                        <div className="relative max-w-xl">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder={t('search_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-xl text-slate-900 bg-white border-0 shadow-lg focus:ring-4 focus:ring-blue-500/30 transition-shadow text-lg outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Course Grid */}
                <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{t('available_courses')}</h3>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-500 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
                        <Filter size={16} />
                        {t('all_categories')}
                    </div>
                </div>

                {filteredCourses.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
                        <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 mb-2">{t('no_courses_title')}</h3>
                        <p className="text-slate-500">{t('no_courses_desc')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCourses.map(course => (
                            <div key={course.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-blue-300 transition-all group flex flex-col h-full">
                                {/* Course Thumbnail Placeholder */}
                                <div
                                    className="h-40 flex items-center justify-center border-b border-slate-100 relative overflow-hidden bg-cover bg-center bg-slate-100"
                                    style={course.imageUrl ? { backgroundImage: `url(${course.imageUrl})` } : {}}
                                >
                                    {!course.imageUrl && <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 mix-blend-multiply group-hover:opacity-75 transition-opacity"></div>}
                                    {!course.imageUrl && <BookOpen size={48} className="text-slate-300 group-hover:scale-110 transition-transform duration-500" />}
                                    {course.imageUrl && <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300"></div>}
                                </div>

                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded">
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
                                        onClick={() => router.push(`/${locale}/lms/course/${course.id}`)}
                                        className="w-full bg-slate-900 hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 group-hover:shadow-md"
                                    >
                                        {t('start_learning')}
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
