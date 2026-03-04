"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { BookOpen, Plus, LogOut, Settings, Library, Trash2 } from 'lucide-react';
import { Course } from '@/lib/lms/types';
import { getMockCourse } from '@/lib/lms/mockData';
import { getCourses, saveCourseToDb, deleteCourseFromDb } from '@/lib/courseService';
import { useTranslations, useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import MediaLibrarySelector from "@/components/cms/MediaLibrarySelector";
import { createClient } from "@/lib/supabaseClient";

export default function CMSDashboard() {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const t = useTranslations();

    const [courses, setCourses] = useState<Course[]>([]);
    const [mounted, setMounted] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'courses' | 'library'>('courses');

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteCreds, setDeleteCreds] = useState({ username: '', password: '' });
    const [deleteError, setDeleteError] = useState('');
    const [showCourseModal, setShowCourseModal] = useState(false); // New state
    const [courseFormData, setCourseFormData] = useState<Partial<Course>>({ // Replaced courseForm
        title: '',
        organization: '',
        courseNumber: '',
        courseRun: '',
        description: '',
        thumbnail: '' // Changed from imageUrl to thumbnail
    });
    const [showMediaSelector, setShowMediaSelector] = useState(false); // New state

    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push(`/${locale}`);
                return;
            }

            const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
            const role = userData?.role || "student";

            if (role === 'student') {
                router.push(`/${locale}/dashboard`);
                return;
            }

            setUserRole(role);
            setUserEmail(user.email || '');
            setMounted(true);

            // Once authorized, load courses
            let dbCourses = await getCourses();

            if (role === 'lecturer') {
                dbCourses = dbCourses.filter(c => c.lecturers && c.lecturers.includes(user.email!));
            }

            if (dbCourses.length > 0) {
                setCourses(dbCourses);
                localStorage.setItem('lms_courses_db', JSON.stringify(dbCourses));
            } else {
                setCourses([]);
                localStorage.setItem('lms_courses_db', JSON.stringify([]));
            }
        };
        checkAuth();
    }, [locale, router]);

    const handleLogout = () => {
        sessionStorage.removeItem("currentUser");
        router.push(`/${locale}/dashboard`);
    };

    const handleAddCourse = async (e: React.FormEvent) => {
        e.preventDefault();

        if (userRole === 'lecturer') return;

        let newId = `course_${Date.now()}`;
        if (courseFormData.organization && courseFormData.courseNumber && courseFormData.courseRun) {
            const org = courseFormData.organization.replace(/\s+/g, '');
            const num = courseFormData.courseNumber.replace(/\s+/g, '');
            const run = courseFormData.courseRun.replace(/\s+/g, '');
            newId = `${org}+${num}+${run}`;
        }

        const newCourse: Course = {
            id: newId,
            title: courseFormData.title || t('Modal.create_title'),
            organization: courseFormData.organization || undefined,
            courseNumber: courseFormData.courseNumber || undefined,
            courseRun: courseFormData.courseRun || undefined,
            description: courseFormData.description || "A brand new course.",
            thumbnail: courseFormData.thumbnail || undefined,
            sections: [],
            status: "draft",
            lecturers: []
        };
        const updatedCourses = [...courses, newCourse];
        setCourses(updatedCourses);
        localStorage.setItem('lms_courses_db', JSON.stringify(updatedCourses));
        await saveCourseToDb(newCourse);
        setIsCreateModalOpen(false);
        setCourseFormData({ title: '', organization: '', courseNumber: '', courseRun: '', description: '', thumbnail: '' });
    };

    const handleEditCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCourseId) return;

        const updatedCourses = courses.map(c => {
            if (c.id === editingCourseId) {
                return {
                    ...c,
                    title: courseFormData.title || "Untitled Course",
                    organization: courseFormData.organization || undefined,
                    courseNumber: courseFormData.courseNumber || undefined,
                    courseRun: courseFormData.courseRun || undefined,
                    description: courseFormData.description || "",
                    thumbnail: courseFormData.thumbnail || undefined
                };
            }
            return c;
        });

        setCourses(updatedCourses);
        localStorage.setItem('lms_courses_db', JSON.stringify(updatedCourses));
        const updated = updatedCourses.find(c => c.id === editingCourseId);
        if (updated) await saveCourseToDb(updated);
        setIsEditModalOpen(false);
        setEditingCourseId(null);
        setCourseFormData({ title: '', organization: '', courseNumber: '', courseRun: '', description: '', thumbnail: '' });
    };

    const handleDeleteCourse = async (courseId: string) => {
        if (userRole === 'lecturer') return;

        if (deleteCreds.username !== 'jinha' || deleteCreds.password !== 'j2data2025') {
            setDeleteError('Invalid username or password.');
            return;
        }

        const updatedCourses = courses.filter(c => c.id !== courseId);
        setCourses(updatedCourses);
        localStorage.setItem('lms_courses_db', JSON.stringify(updatedCourses));
        await deleteCourseFromDb(courseId);
        setIsEditModalOpen(false);
        setEditingCourseId(null);
        setShowDeleteConfirm(false);
        setDeleteCreds({ username: '', password: '' });
        setCourseFormData({ title: '', organization: '', courseNumber: '', courseRun: '', description: '', thumbnail: '' });
    };

    const openCreateModal = () => {
        setCourseFormData({ title: '', organization: '', courseNumber: '', courseRun: '', description: '', thumbnail: '' }); // Changed from imageUrl to thumbnail
        setIsCreateModalOpen(true);
    };

    const openEditModal = (course: Course) => {
        setCourseFormData({
            title: course.title,
            organization: course.organization || '',
            courseNumber: course.courseNumber || '',
            courseRun: course.courseRun || '',
            description: course.description,
            thumbnail: course.thumbnail || '' // Changed from imageUrl to thumbnail
        });
        setEditingCourseId(course.id);
        setShowDeleteConfirm(false);
        setDeleteCreds({ username: '', password: '' });
        setDeleteError('');
        setIsEditModalOpen(true);
    };

    if (!mounted || userRole === 'student') return null;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3 text-emerald-600">
                    <BookOpen size={24} />
                    <h1 className="text-xl font-bold tracking-tight">{t('CMS.header_title')} <span className="text-sm font-normal text-slate-400">by CodeInit</span></h1>
                    {userRole === 'lecturer' && (
                        <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">Lecturer</span>
                    )}
                </div>
                <div className="flex items-center gap-6">
                    <LanguageSwitcher />
                    <Link href={`/${locale}/dashboard`} className="text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors text-nowrap">
                        {t('CMS.dashboard')}
                    </Link>
                    <Link href={`/${locale}/cms/cohorts`} className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors text-nowrap">
                        {t('CMS.cohorts') || 'Cohorts'}
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-slate-500 hover:text-rose-600 transition-colors text-sm font-medium"
                    >
                        <LogOut size={16} />
                        {t('CMS.logout')}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto p-8">
                {/* Tabs Navigation */}
                <div className="flex items-center gap-6 border-b border-slate-200 mb-8">
                    <button
                        onClick={() => setActiveTab('courses')}
                        className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'courses' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <BookOpen size={16} /> {t('CMS.tab_courses')}
                    </button>
                    <button
                        onClick={() => setActiveTab('library')}
                        className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'library' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Library size={16} /> {t('CMS.tab_library')}
                    </button>
                </div>

                {activeTab === 'courses' ? (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('CMS.my_courses')}</h2>
                                <p className="text-slate-500 mt-1 text-sm">{t('CMS.my_courses_desc')}</p>
                            </div>
                            {userRole !== 'lecturer' && (
                                <button
                                    onClick={openCreateModal}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm text-sm"
                                >
                                    <Plus size={16} />
                                    {t('CMS.new_course')}
                                </button>
                            )}
                        </div>

                        {courses.length === 0 ? (
                            <div className="text-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
                                <h3 className="text-lg font-bold text-slate-800 mb-2">No Courses Found</h3>
                                <p className="text-slate-500 text-sm">
                                    {userRole === 'lecturer' ? "You have not been assigned as a lecturer to any courses yet." : "Create your first course to get started!"}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {courses.map(course => (
                                    <div key={course.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all group flex flex-col h-full">
                                        <div
                                            className={`h-32 border-b border-slate-200 flex items-center justify-center relative ${course.thumbnail ? 'bg-cover bg-center' : 'bg-slate-100 text-slate-300'}`}
                                            style={course.thumbnail ? { backgroundImage: `url(${course.thumbnail})` } : {}}
                                        >
                                            {course.thumbnail && <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />}
                                            {!course.thumbnail && <BookOpen size={48} className="opacity-20 group-hover:scale-110 transition-transform duration-300 relative z-10" />}

                                            <div className="absolute top-3 right-3 flex gap-2 z-20">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        openEditModal(course);
                                                    }}
                                                    className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-600 flex items-center justify-center shadow-sm backdrop-blur-sm transition-colors"
                                                    title={t('Modal.edit_title')}
                                                >
                                                    <Settings size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-5 flex-1 flex flex-col">
                                            <h3 className="font-bold text-lg text-slate-900 mb-1">{course.title}</h3>
                                            <p className="text-sm text-slate-500 line-clamp-2 mb-6 flex-1">{course.description}</p>
                                            <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-auto">
                                                <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${course.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {course.status}
                                                </span>
                                                <Link
                                                    href={`/${locale}/cms/course/${course.id}`}
                                                    className="text-emerald-600 hover:text-emerald-700 text-sm font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                                                >
                                                    {t('CMS.edit_outline')} <span aria-hidden="true">&rarr;</span>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-6 border border-emerald-100">
                            <Library size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('CMS.library_title')}</h2>
                        <p className="text-slate-500 max-w-md mb-8">
                            {t('CMS.library_desc')}
                        </p>
                        <Link
                            href={`/${locale}/cms/content-library`}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all active:scale-95"
                        >
                            Content Library 열기 →
                        </Link>
                    </div>
                )}
            </main>
            {/* Create Course Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">{t('Modal.create_title')}</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none">
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleAddCourse} className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Modal.course_name')}</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={courseFormData.title}
                                    onChange={e => setCourseFormData({ ...courseFormData, title: e.target.value })}
                                />
                                <p className="text-xs text-slate-400 mt-1">{t('Modal.course_name_hint')}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.organization')}</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={courseFormData.organization}
                                        onChange={e => setCourseFormData({ ...courseFormData, organization: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.course_number')}</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={courseFormData.courseNumber}
                                        onChange={e => setCourseFormData({ ...courseFormData, courseNumber: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.course_run')}</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={courseFormData.courseRun}
                                        onChange={e => setCourseFormData({ ...courseFormData, courseRun: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-full">
                                    <p className="text-[10px] text-slate-500">{t('Modal.id_note_create')}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Modal.description')}</label>
                                <textarea
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                                    value={courseFormData.description}
                                    onChange={e => setCourseFormData({ ...courseFormData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Modal.cover_image')}</label>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Thumbnail URL (Optional)"
                                        value={courseFormData.thumbnail || ""}
                                        onChange={(e) => setCourseFormData({ ...courseFormData, thumbnail: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowMediaSelector(true)}
                                        className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-600 px-4 py-2 rounded-md transition-colors text-sm font-bold whitespace-nowrap"
                                    >
                                        Library
                                    </button>
                                </div>
                                {courseFormData.thumbnail && (
                                    <div className="w-32 h-20 rounded overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 mb-2">
                                        <img src={courseFormData.thumbnail} alt="Cover Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                {courseFormData.thumbnail && (
                                    <button type="button" onClick={() => setCourseFormData({ ...courseFormData, thumbnail: '' })} className="text-xs text-rose-500 mt-2 hover:underline">{t('Modal.remove_image')}</button>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                                >
                                    {t('Modal.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                    {t('Modal.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Course Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">{t('Modal.edit_title')}</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none">
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleEditCourse} className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Modal.course_name')}</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={courseFormData.title}
                                    onChange={e => setCourseFormData({ ...courseFormData, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.organization')}</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        value={courseFormData.organization}
                                        disabled
                                        placeholder={t('Modal.not_set')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.course_number')}</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        value={courseFormData.courseNumber}
                                        disabled
                                        placeholder={t('Modal.not_set')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.course_run')}</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        value={courseFormData.courseRun}
                                        disabled
                                        placeholder={t('Modal.not_set')}
                                    />
                                </div>
                                <div className="col-span-full">
                                    <p className="text-[10px] text-slate-500">{t('Modal.id_note_edit')}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Modal.description')}</label>
                                <textarea
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                                    value={courseFormData.description}
                                    onChange={e => setCourseFormData({ ...courseFormData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Modal.cover_image')}</label>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Thumbnail URL (Optional)"
                                        value={courseFormData.thumbnail || ""}
                                        onChange={(e) => setCourseFormData({ ...courseFormData, thumbnail: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowMediaSelector(true)}
                                        className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-600 px-4 py-2 rounded-md transition-colors text-sm font-bold whitespace-nowrap"
                                    >
                                        Library
                                    </button>
                                </div>
                                {courseFormData.thumbnail && (
                                    <div className="w-32 h-20 rounded overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 mb-2">
                                        <img src={courseFormData.thumbnail} alt="Cover Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                {courseFormData.thumbnail && (
                                    <button type="button" onClick={() => setCourseFormData({ ...courseFormData, thumbnail: '' })} className="text-xs text-rose-500 mt-2 hover:underline">{t('Modal.remove_image')}</button>
                                )}
                            </div>
                            {/* Superuser/staff only delete controls */}
                            {userRole !== 'lecturer' && showDeleteConfirm && (
                                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg mt-4 mb-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <h4 className="text-sm font-bold text-rose-800 mb-2">{t('Modal.confirm_delete_title')}</h4>
                                    <p className="text-xs text-rose-600 mb-3 block">{t('Modal.confirm_delete_desc')}</p>

                                    {deleteError && (
                                        <div className="mb-3 px-3 py-2 bg-white border border-rose-300 text-rose-600 text-xs font-bold rounded">
                                            {deleteError}
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-2 mb-3">
                                        <input
                                            type="text"
                                            placeholder={t('Modal.username')}
                                            className="w-full border border-rose-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                                            value={deleteCreds.username}
                                            onChange={e => setDeleteCreds({ ...deleteCreds, username: e.target.value })}
                                        />
                                        <input
                                            type="password"
                                            placeholder={t('Modal.password')}
                                            className="w-full border border-rose-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                                            value={deleteCreds.password}
                                            onChange={e => setDeleteCreds({ ...deleteCreds, password: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDeleteConfirm(false);
                                                setDeleteCreds({ username: '', password: '' });
                                                setDeleteError('');
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-rose-100 rounded transition-colors"
                                        >
                                            {t('Modal.cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => editingCourseId && handleDeleteCourse(editingCourseId)}
                                            className="px-3 py-1.5 text-xs font-bold bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors shadow-sm"
                                        >
                                            {t('Modal.confirm_delete')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!showDeleteConfirm && (
                                <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
                                    {userRole !== 'lecturer' ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="px-4 py-2 text-sm font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <Trash2 size={14} /> {t('Modal.delete_course')}
                                        </button>
                                    ) : (
                                        <div></div> // Empty div to keep save buttons on the right
                                    )}
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditModalOpen(false)}
                                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                                        >
                                            {t('Modal.cancel')}
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                        >
                                            {t('Modal.save')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {showMediaSelector && (
                <MediaLibrarySelector
                    onSelectOption={(url) => setCourseFormData({ ...courseFormData, thumbnail: url })}
                    onClose={() => setShowMediaSelector(false)}
                />
            )}
        </div>
    );
}
