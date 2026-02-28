"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { BookOpen, Plus, LogOut, Settings, UploadCloud, Loader2, Library, Trash2 } from 'lucide-react';
import { Course } from '@/lib/lms/types';
import { getMockCourse } from '@/lib/lms/mockData';
import { supabase } from '@/lib/supabase';
import { useTranslations, useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function CMSDashboard() {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const t = useTranslations();

    const [courses, setCourses] = useState<Course[]>([]);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'courses' | 'library'>('courses');

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteCreds, setDeleteCreds] = useState({ username: '', password: '' });
    const [deleteError, setDeleteError] = useState('');
    const [uploadError, setUploadError] = useState('');
    const [courseForm, setCourseForm] = useState({
        title: '',
        organization: '',
        courseNumber: '',
        courseRun: '',
        description: '',
        imageUrl: ''
    });
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Load mock course or from localStorage
        const saved = sessionStorage.getItem('lms_courses_db');
        if (saved) {
            setCourses(JSON.parse(saved));
        } else {
            const initialCourse = getMockCourse();
            setCourses([initialCourse]);
            sessionStorage.setItem('lms_courses_db', JSON.stringify([initialCourse]));
        }
    }, []);

    const handleLogout = () => {
        sessionStorage.removeItem("currentUser");
        router.push(`/${locale}/dashboard`);
    };

    const handleAddCourse = (e: React.FormEvent) => {
        e.preventDefault();

        // Generate Open edX style ID or fallback to timestamp
        let newId = `course_${Date.now()}`;
        if (courseForm.organization && courseForm.courseNumber && courseForm.courseRun) {
            // Remove spaces from the fields to make URL-friendly
            const org = courseForm.organization.replace(/\s+/g, '');
            const num = courseForm.courseNumber.replace(/\s+/g, '');
            const run = courseForm.courseRun.replace(/\s+/g, '');
            newId = `${org}+${num}+${run}`;
        }

        const newCourse: Course = {
            id: newId,
            title: courseForm.title || t('Modal.create_title'),
            organization: courseForm.organization || undefined,
            courseNumber: courseForm.courseNumber || undefined,
            courseRun: courseForm.courseRun || undefined,
            description: courseForm.description || "A brand new course.",
            imageUrl: courseForm.imageUrl || undefined,
            sections: [],
            status: "draft",
        };
        const updatedCourses = [...courses, newCourse];
        setCourses(updatedCourses);
        sessionStorage.setItem('lms_courses_db', JSON.stringify(updatedCourses));
        setIsCreateModalOpen(false);
        setCourseForm({ title: '', organization: '', courseNumber: '', courseRun: '', description: '', imageUrl: '' });
    };

    const handleEditCourse = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCourseId) return;

        const updatedCourses = courses.map(c => {
            if (c.id === editingCourseId) {
                return {
                    ...c,
                    title: courseForm.title,
                    organization: courseForm.organization || undefined,
                    courseNumber: courseForm.courseNumber || undefined,
                    courseRun: courseForm.courseRun || undefined,
                    description: courseForm.description,
                    imageUrl: courseForm.imageUrl || undefined
                };
            }
            return c;
        });

        setCourses(updatedCourses);
        sessionStorage.setItem('lms_courses_db', JSON.stringify(updatedCourses));
        setIsEditModalOpen(false);
        setEditingCourseId(null);
        setCourseForm({ title: '', organization: '', courseNumber: '', courseRun: '', description: '', imageUrl: '' });
    };

    const handleDeleteCourse = (courseId: string) => {
        // Authenticate the delete action
        if (deleteCreds.username !== 'jinha' || deleteCreds.password !== 'j2data2025') {
            setDeleteError('Invalid username or password.');
            return;
        }

        const updatedCourses = courses.filter(c => c.id !== courseId);
        setCourses(updatedCourses);
        sessionStorage.setItem('lms_courses_db', JSON.stringify(updatedCourses));
        setIsEditModalOpen(false);
        setEditingCourseId(null);
        setShowDeleteConfirm(false);
        setDeleteCreds({ username: '', password: '' });
        setCourseForm({ title: '', organization: '', courseNumber: '', courseRun: '', description: '', imageUrl: '' });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadError('');
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload directly to Supabase Storage 'course-images' bucket
            const { error: uploadError } = await supabase.storage
                .from('course-images')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            // Get public URL
            const { data } = supabase.storage
                .from('course-images')
                .getPublicUrl(filePath);

            setCourseForm(prev => ({ ...prev, imageUrl: data.publicUrl }));
        } catch (error) {
            console.error('Error uploading image:', error);
            setUploadError('Failed to upload image. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const openCreateModal = () => {
        setCourseForm({ title: '', organization: '', courseNumber: '', courseRun: '', description: '', imageUrl: '' });
        setUploadError('');
        setIsCreateModalOpen(true);
    };

    const openEditModal = (course: Course) => {
        setCourseForm({
            title: course.title,
            organization: course.organization || '',
            courseNumber: course.courseNumber || '',
            courseRun: course.courseRun || '',
            description: course.description,
            imageUrl: course.imageUrl || ''
        });
        setEditingCourseId(course.id);
        setShowDeleteConfirm(false);
        setDeleteCreds({ username: '', password: '' });
        setDeleteError('');
        setUploadError('');
        setIsEditModalOpen(true);
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3 text-emerald-600">
                    <BookOpen size={24} />
                    <h1 className="text-xl font-bold tracking-tight">{t('CMS.header_title')} <span className="text-sm font-normal text-slate-400">by CodeInit</span></h1>
                </div>
                <div className="flex items-center gap-6">
                    <LanguageSwitcher />
                    <Link href={`/${locale}/dashboard`} className="text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors">
                        {t('CMS.dashboard')}
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
                            <button
                                onClick={openCreateModal}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm text-sm"
                            >
                                <Plus size={16} />
                                {t('CMS.new_course')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {courses.map(course => (
                                <div key={course.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all group flex flex-col h-full">
                                    <div
                                        className={`h-32 border-b border-slate-200 flex items-center justify-center relative ${course.imageUrl ? 'bg-cover bg-center' : 'bg-slate-100 text-slate-300'}`}
                                        style={course.imageUrl ? { backgroundImage: `url(${course.imageUrl})` } : {}}
                                    >
                                        {course.imageUrl && <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />}
                                        {!course.imageUrl && <BookOpen size={48} className="opacity-20 group-hover:scale-110 transition-transform duration-300 relative z-10" />}

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
                        <button className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm opacity-50 cursor-not-allowed">
                            {t('CMS.coming_soon')}
                        </button>
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
                                    value={courseForm.title}
                                    onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
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
                                        value={courseForm.organization}
                                        onChange={e => setCourseForm({ ...courseForm, organization: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.course_number')}</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={courseForm.courseNumber}
                                        onChange={e => setCourseForm({ ...courseForm, courseNumber: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.course_run')}</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={courseForm.courseRun}
                                        onChange={e => setCourseForm({ ...courseForm, courseRun: e.target.value })}
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
                                    value={courseForm.description}
                                    onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Modal.cover_image')}</label>
                                <div className="flex items-center gap-4">
                                    {courseForm.imageUrl && (
                                        <div className="w-16 h-16 rounded overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                                            <img src={courseForm.imageUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 text-sm font-medium transition-colors w-full cursor-pointer hover:bg-slate-50 hover:border-emerald-500 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                        {isUploading ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : <UploadCloud size={18} className="text-slate-500" />}
                                        <span className="text-slate-600">{isUploading ? t('Modal.uploading') : t('Modal.upload_image')}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageUpload}
                                            disabled={isUploading}
                                        />
                                    </label>
                                </div>
                                {uploadError && (
                                    <p className="text-xs text-rose-500 mt-2 font-medium">{uploadError}</p>
                                )}
                                {courseForm.imageUrl && (
                                    <button type="button" onClick={() => setCourseForm({ ...courseForm, imageUrl: '' })} className="text-xs text-rose-500 mt-2 hover:underline">{t('Modal.remove_image')}</button>
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
                                    disabled={isUploading}
                                    className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
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
                                    value={courseForm.title}
                                    onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.organization')}</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        value={courseForm.organization}
                                        disabled
                                        placeholder={t('Modal.not_set')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.course_number')}</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        value={courseForm.courseNumber}
                                        disabled
                                        placeholder={t('Modal.not_set')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">{t('Modal.course_run')}</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        value={courseForm.courseRun}
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
                                    value={courseForm.description}
                                    onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Modal.cover_image')}</label>
                                <div className="flex items-center gap-4">
                                    {courseForm.imageUrl && (
                                        <div className="w-16 h-16 rounded overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                                            <img src={courseForm.imageUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 text-sm font-medium transition-colors w-full cursor-pointer hover:bg-slate-50 hover:border-emerald-500 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                        {isUploading ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : <UploadCloud size={18} className="text-slate-500" />}
                                        <span className="text-slate-600">{isUploading ? t('Modal.uploading') : t('Modal.upload_image')}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageUpload}
                                            disabled={isUploading}
                                        />
                                    </label>
                                </div>
                                {uploadError && (
                                    <p className="text-xs text-rose-500 mt-2 font-medium">{uploadError}</p>
                                )}
                                {courseForm.imageUrl && (
                                    <button type="button" onClick={() => setCourseForm({ ...courseForm, imageUrl: '' })} className="text-xs text-rose-500 mt-2 hover:underline">{t('Modal.remove_image')}</button>
                                )}
                            </div>
                            {showDeleteConfirm && (
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
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="px-4 py-2 text-sm font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                        <Trash2 size={14} /> {t('Modal.delete_course')}
                                    </button>
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
                                            disabled={isUploading}
                                            className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
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
        </div>
    );
}
