import React, { useState, useRef, useCallback } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Eye, Code, Edit3, ImagePlus, X, FileCode2, Hash } from 'lucide-react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    onBrowseAssets?: () => void;
}

type EditorMode = 'visual' | 'markdown' | 'preview' | 'html';

export default function RichTextEditor({ value, onChange, onBrowseAssets }: RichTextEditorProps) {
    const [mode, setMode] = useState<EditorMode>('markdown');
    const [showImageDialog, setShowImageDialog] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [imageAlt, setImageAlt] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleModeSwitch = (newMode: EditorMode) => {
        setMode(newMode);
    };

    const insertAtCursor = useCallback((text: string) => {
        if (!textareaRef.current) return;
        const ta = textareaRef.current;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newVal = value.slice(0, start) + text + value.slice(end);
        onChange(newVal);
        // Restore cursor position after insert
        setTimeout(() => {
            ta.focus();
            ta.selectionStart = ta.selectionEnd = start + text.length;
        }, 0);
    }, [value, onChange]);

    const insertImage = () => {
        if (!imageUrl.trim()) return;
        if (mode === 'markdown') {
            insertAtCursor(`\n![${imageAlt || 'image'}](${imageUrl})\n`);
        } else {
            const imgTag = `<img src="${imageUrl}" alt="${imageAlt || 'image'}" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />`;
            onChange(value + imgTag);
        }
        setImageUrl('');
        setImageAlt('');
        setShowImageDialog(false);
    };

    const mdToolbar = [
        { label: 'H1', insert: '# ', title: 'Heading 1' },
        { label: 'H2', insert: '## ', title: 'Heading 2' },
        { label: 'H3', insert: '### ', title: 'Heading 3' },
        { label: 'B', insert: '**텍스트**', title: 'Bold', style: 'font-bold' },
        { label: 'I', insert: '*텍스트*', title: 'Italic', style: 'italic' },
        { label: '``', insert: '`code`', title: 'Inline Code' },
        { label: '```', insert: '\n```\ncode\n```\n', title: 'Code Block' },
        { label: '∑', insert: ' $E=mc^2$ ', title: 'Inline Math' },
        { label: '∫', insert: '\n$$\n\\int_0^1 f(x) dx\n$$\n', title: 'Block Math' },
        { label: '—', insert: '\n---\n', title: 'Horizontal Rule' },
        { label: '•', insert: '\n- ', title: 'Bullet List' },
        { label: '1.', insert: '\n1. ', title: 'Numbered List' },
        { label: '> ', insert: '\n> ', title: 'Blockquote' },
        { label: '[]', insert: '\n| Head | Head |\n|------|------|\n| Cell | Cell |\n', title: 'Table' },
        { label: '🔗', insert: '[텍스트](https://)', title: 'Link' },
    ];

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            {/* Mode Tabs + Actions */}
            <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-2 py-1.5">
                <div className="flex gap-1">
                    {[
                        { id: 'markdown' as const, label: 'Markdown', icon: <Hash size={13} /> },
                        { id: 'visual' as const, label: 'Visual', icon: <Edit3 size={13} /> },
                        { id: 'preview' as const, label: 'Preview', icon: <Eye size={13} /> },
                        { id: 'html' as const, label: 'HTML', icon: <Code size={13} /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleModeSwitch(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === tab.id
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setShowImageDialog(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-purple-600 hover:bg-purple-50 transition-all"
                    title="Insert Image"
                >
                    <ImagePlus size={14} /> 이미지
                </button>
            </div>

            {/* Image Dialog */}
            {showImageDialog && (
                <div className="p-4 bg-purple-50 border-b border-purple-200 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">이미지 삽입</span>
                        <button onClick={() => setShowImageDialog(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 flex gap-2">
                            <input
                                type="text"
                                placeholder="이미지 URL (https://...)"
                                className="flex-1 p-2.5 bg-white border border-purple-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-purple-500"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                            />
                            {onBrowseAssets && (
                                <button
                                    onClick={onBrowseAssets}
                                    className="px-3 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-200 transition-all flex items-center gap-1 shrink-0"
                                    title="미디어 라이브러리 열기"
                                >
                                    <ImageIcon size={14} /> 보관함
                                </button>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="대체 텍스트"
                            className="w-36 p-2.5 bg-white border border-purple-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-purple-500"
                            value={imageAlt}
                            onChange={(e) => setImageAlt(e.target.value)}
                        />
                        <button
                            onClick={insertImage}
                            disabled={!imageUrl.trim()}
                            className="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-all"
                        >
                            삽입
                        </button>
                    </div>
                    {imageUrl && (
                        <img src={imageUrl} alt="Preview" className="max-h-24 rounded border border-purple-200" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    )}
                </div>
            )}

            {/* Markdown Editor */}
            {mode === 'markdown' && (
                <div>
                    {/* Markdown Toolbar */}
                    <div className="flex flex-wrap gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
                        {mdToolbar.map((btn, i) => (
                            <button
                                key={i}
                                onClick={() => insertAtCursor(btn.insert)}
                                className={`px-2 py-1 rounded text-xs font-mono hover:bg-slate-200 transition-colors text-slate-600 ${btn.style || ''}`}
                                title={btn.title}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full min-h-[300px] p-4 font-mono text-sm text-slate-800 focus:outline-none resize-y bg-white"
                        spellCheck={false}
                        placeholder="# 제목&#10;&#10;마크다운으로 작성하세요...&#10;&#10;- 목록&#10;- **굵은 글씨**&#10;- `코드`&#10;&#10;```python&#10;print('Hello')&#10;```&#10;&#10;수식: $E = mc^2$"
                    />
                </div>
            )}

            {/* Visual Editor (CKEditor) */}
            {mode === 'visual' && (
                <div className="ckeditor-wrapper prose prose-sm max-w-none bg-white text-slate-800">
                    <CKEditor
                        editor={ClassicEditor as any}
                        data={value}
                        onChange={(event, editor) => {
                            const data = editor.getData();
                            onChange(data);
                        }}
                        config={{
                            toolbar: [
                                'heading', '|',
                                'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote', '|',
                                'insertTable', '|',
                                'undo', 'redo'
                            ]
                        }}
                    />
                </div>
            )}

            {/* Preview Mode */}
            {mode === 'preview' && (
                <div className="prose prose-sm prose-slate max-w-none p-6 min-h-[200px] ck-content">
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
                    {value ? (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                                code({ className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const isInline = !match;
                                    return isInline ? (
                                        <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
                                    ) : (
                                        <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto my-4">
                                            <code className={className} {...props}>{children}</code>
                                        </pre>
                                    );
                                },
                                table({ children }: any) {
                                    return <table className="border-collapse border border-slate-300 w-full my-4">{children}</table>;
                                },
                                th({ children }: any) {
                                    return <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left text-sm font-bold">{children}</th>;
                                },
                                td({ children }: any) {
                                    return <td className="border border-slate-300 px-3 py-2 text-sm">{children}</td>;
                                },
                                img({ src, alt }: any) {
                                    return <img src={src} alt={alt || ''} className="max-w-full h-auto rounded-lg border border-slate-200 my-4" />;
                                }
                            }}
                        >
                            {value}
                        </ReactMarkdown>
                    ) : (
                        <p className="text-slate-400 italic">콘텐츠가 없습니다. Markdown 또는 Visual 모드에서 편집하세요.</p>
                    )}
                </div>
            )}

            {/* Raw HTML Editor */}
            {mode === 'html' && (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full min-h-[300px] p-4 font-mono text-sm focus:outline-none resize-y"
                    style={{ backgroundColor: '#1e293b', color: '#4ade80' }}
                    spellCheck={false}
                    placeholder="<p>여기에 HTML을 직접 작성하세요...</p>"
                />
            )}

            <style jsx global>{`
                .ck-editor__editable_inline {
                    min-height: 200px;
                    border-bottom-left-radius: 0 !important;
                    border-bottom-right-radius: 0 !important;
                    border: none !important;
                }
                .ck-toolbar {
                    border-top-left-radius: 0 !important;
                    border-top-right-radius: 0 !important;
                    background: #f8fafc !important;
                    border-color: #e2e8f0 !important;
                    border-left: none !important;
                    border-right: none !important;
                    border-top: none !important;
                }
                .ck.ck-editor__main>.ck-editor__editable:not(.ck-focused) {
                    border-color: transparent !important;
                }
                .ck.ck-editor__main>.ck-editor__editable.ck-focused {
                    border-color: transparent !important;
                    box-shadow: none !important;
                }
                .ck.ck-editor {
                    border: none !important;
                }
            `}</style>
        </div>
    );
}
