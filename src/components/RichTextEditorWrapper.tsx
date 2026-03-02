"use client";

import dynamic from 'next/dynamic';

// Next.js dynamic import with ssr disabled to prevent window is not defined errors from CKEditor 5
const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
    ssr: false,
    loading: () => <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-lg animate-pulse">Loading Rich Text Editor...</div>
});

export default RichTextEditor;
