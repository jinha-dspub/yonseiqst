"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { User, Settings, LogOut, ChevronDown, Globe, Users, Database, Check, X, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";

export default function UserProfileDropdown({ userProfile: initialProfile }: { userProfile: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const [showLanguageSettings, setShowLanguageSettings] = useState(false);
    const [showAccountSettings, setShowAccountSettings] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [userProfile, setUserProfile] = useState(initialProfile);
    const [newName, setNewName] = useState(initialProfile?.name || "");
    const [isSaving, setIsSaving] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setShowLanguageSettings(false);
                setShowAccountSettings(false);
                setShowProfile(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Sync state if prop changes
    useEffect(() => {
        setUserProfile(initialProfile);
        setNewName(initialProfile?.name || "");
    }, [initialProfile]);

    const handleSignOut = () => {
        sessionStorage.removeItem("currentUser");
        router.push("/");
    };

    const handleLanguageChange = (newLocale: string) => {
        document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
        const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
        router.push(newPath);
        setIsOpen(false);
        setShowLanguageSettings(false);
        setShowProfile(false);
    };

    const handleSaveName = async () => {
        if (!newName.trim() || newName === userProfile.name) {
            setShowAccountSettings(false);
            return;
        }

        setIsSaving(true);
        const supabase = createClient();
        const { error } = await supabase
            .from('users')
            .update({ name: newName.trim() })
            .eq('id', userProfile.id);

        if (!error) {
            const updatedProfile = { ...userProfile, name: newName.trim() };
            setUserProfile(updatedProfile);
            sessionStorage.setItem("currentUser", JSON.stringify(updatedProfile));
            
            // Trigger a custom event to update other components if needed
            window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: updatedProfile }));

            const { data } = await supabase.auth.updateUser({ data: { full_name: newName.trim() }});
        }
        setIsSaving(false);
        setShowAccountSettings(false);
    };

    // Prevent component rendering if profile is somehow missing
    if (!userProfile) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 hover:bg-blue-50 transition-all duration-300"
            >
                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                    <User size={14} />
                </div>
                <span className="text-sm font-bold text-slate-800 max-w-[120px] truncate hidden sm:block">{userProfile.name}</span>
                {userProfile.cohort && userProfile.cohort !== 'DEFAULT' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title={`Cohort: ${userProfile.cohort}`}></span>
                )}
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
                    {/* Level/Exp Info */}
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div>
                            <p className="text-[10px] text-blue-600 uppercase font-bold tracking-widest mb-1">Level {userProfile.level}</p>
                            <p className="text-lg font-mono text-slate-800 leading-none">{userProfile.exp} <span className="text-xs text-slate-400 ml-1">EXP</span></p>
                        </div>
                    </div>

                    <div className="py-2">
                        {!showLanguageSettings && !showAccountSettings && !showProfile ? (
                            <>
                                <button
                                    onClick={() => setShowProfile(true)}
                                    className="w-full text-left px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-3"
                                >
                                    <User size={16} className="text-blue-600" />
                                    Profile
                                </button>
                                
                                {['staff', 'admin', 'superuser'].includes(userProfile.role) && (
                                    <>
                                        <div className="h-px bg-slate-100 my-1 mx-2"></div>
                                        <p className="px-5 py-1 text-[10px] text-emerald-600 uppercase font-bold tracking-widest mt-1">Admin Tools</p>
                                        <button 
                                            onClick={() => { window.open(`/${locale}/cms/cohorts`, '_blank'); setIsOpen(false); }}
                                            className="w-full text-left px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-3"
                                        >
                                            <Users size={16} className="text-emerald-500" />
                                            Cohort Management
                                        </button>
                                        <button 
                                            onClick={() => { window.open(`/${locale}/cms`, '_blank'); setIsOpen(false); }}
                                            className="w-full text-left px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-3"
                                        >
                                            <Database size={16} className="text-emerald-500" />
                                            CMS Dashboard
                                        </button>
                                        <button 
                                            onClick={() => { window.open(`/${locale}/cms/content-library`, '_blank'); setIsOpen(false); }}
                                            className="w-full text-left px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-3"
                                        >
                                            <BookOpen size={16} className="text-indigo-500" />
                                            Content Library
                                        </button>
                                    </>
                                )}

                                <div className="h-px bg-slate-100 my-1 mx-2"></div>

                                <button 
                                    onClick={() => setShowAccountSettings(true)}
                                    className="w-full text-left px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-3"
                                >
                                    <Settings size={16} className="text-blue-600" />
                                    Account Settings
                                </button>

                                <button 
                                    onClick={() => setShowLanguageSettings(true)}
                                    className="w-full text-left px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <Globe size={16} className="text-blue-600" />
                                        Language
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{locale}</span>
                                </button>
                                <div className="h-px bg-slate-100 my-1 mx-2"></div>
                                <button 
                                    onClick={handleSignOut}
                                    className="w-full text-left px-5 py-3 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-3"
                                >
                                    <LogOut size={16} />
                                    Sign Out
                                </button>
                            </>
                        ) : showProfile ? (
                            <>
                                <div className="px-5 py-3 flex items-center gap-3 border-b border-slate-100 mb-2 bg-slate-50">
                                    <button 
                                        onClick={() => setShowProfile(false)}
                                        className="text-slate-500 hover:text-slate-800 p-1 -ml-2 rounded-md hover:bg-slate-200 transition-colors"
                                    >
                                        <ChevronDown size={14} className="rotate-90" />
                                    </button>
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-700">Agent Profile</span>
                                </div>
                                <div className="px-5 py-2 space-y-3">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Role</p>
                                        <p className="text-sm font-medium text-slate-800 capitalize">{userProfile.role}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Active Cohort</p>
                                        {userProfile.cohort && userProfile.cohort !== 'DEFAULT' ? (
                                            <p className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 flex justify-center py-1 rounded border border-emerald-200 uppercase tracking-wide">
                                                {userProfile.cohort}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic">No assigned cohort</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Progression</p>
                                        <p className="text-sm font-medium text-slate-800 uppercase tracking-widest text-blue-600 font-bold">Lvl {userProfile.level} / {userProfile.exp} XP</p>
                                    </div>
                                </div>
                            </>
                        ) : showLanguageSettings ? (
                            <>
                                <div className="px-5 py-3 flex items-center gap-3 border-b border-slate-100 mb-1 bg-slate-50">
                                    <button 
                                        onClick={() => setShowLanguageSettings(false)}
                                        className="text-slate-500 hover:text-slate-800 p-1 -ml-2 rounded-md hover:bg-slate-200 transition-colors"
                                    >
                                        <ChevronDown size={14} className="rotate-90" />
                                    </button>
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-700">Language / 언어</span>
                                </div>
                                <button 
                                    onClick={() => handleLanguageChange('ko')}
                                    className={`w-full text-left px-5 py-3 text-sm font-medium flex items-center gap-3 transition-colors ${
                                        locale === 'ko' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${locale === 'ko' ? 'bg-blue-600 shadow-sm' : 'bg-transparent border border-slate-300'}`}></span>
                                    한국어
                                </button>
                                <button 
                                    onClick={() => handleLanguageChange('en')}
                                    className={`w-full text-left px-5 py-3 text-sm font-medium flex items-center gap-3 transition-colors ${
                                        locale === 'en' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${locale === 'en' ? 'bg-blue-600 shadow-sm' : 'bg-transparent border border-slate-300'}`}></span>
                                    English (EN)
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="px-5 py-3 flex items-center gap-3 border-b border-slate-100 mb-2 bg-slate-50">
                                    <button 
                                        onClick={() => setShowAccountSettings(false)}
                                        className="text-slate-500 hover:text-slate-800 p-1 -ml-2 rounded-md hover:bg-slate-200 transition-colors"
                                    >
                                        <ChevronDown size={14} className="rotate-90" />
                                    </button>
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-700">Account Settings</span>
                                </div>
                                <div className="px-5 pb-3 pt-1 border-b border-slate-100 mb-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Name</label>
                                    <input 
                                        type="text" 
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="w-full bg-white border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none mb-3"
                                        placeholder="Enter your name"
                                    />
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setShowAccountSettings(false)}
                                            className="flex-1 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={handleSaveName}
                                            disabled={isSaving || !newName.trim() || newName === userProfile.name}
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                                        >
                                            {isSaving ? 'Saving...' : <><Check size={14}/> Save</>}
                                        </button>
                                    </div>
                                </div>
                                <div className="px-5 py-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 mt-2">Email Address</label>
                                    <p className="text-sm font-medium text-slate-800 mb-1 truncate">{userProfile.email}</p>
                                    <p className="text-[10px] text-slate-400">Email cannot be changed directly.</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
