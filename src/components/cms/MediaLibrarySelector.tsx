import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Image as ImageIcon, FileText, Search, Upload, X, Loader2, Check, Copy } from 'lucide-react';

interface AssetLibrarySelectorProps {
    onSelectOption: (url: string) => void;
    onClose: () => void;
}

interface MediaItem {
    id: string;
    file_name: string;
    url: string;
    size_kb: number;
    created_at: string;
}

export default function MediaLibrarySelector({ onSelectOption, onClose }: AssetLibrarySelectorProps) {
    const supabase = createClient();
    const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'library') {
            fetchMedia();
        }
    }, [activeTab]);

    const fetchMedia = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('media_library')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (data && !error) {
            setMediaItems(data);
        }
        setIsLoading(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        
        // 1. Upload to Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`; // Adjust folder structure if needed later

        const { error: uploadError } = await supabase.storage
            .from('course_assets')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Upload error:', uploadError);
            alert('Failed to upload file.');
            setUploading(false);
            return;
        }

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('course_assets')
            .getPublicUrl(filePath);

        // 3. Save to media_library table
        const { data: userAuth } = await supabase.auth.getUser();
        
        await supabase.from('media_library').insert([{
            file_name: file.name,
            bucket_path: filePath,
            url: publicUrl,
            size_kb: Math.round(file.size / 1024),
            user_id: userAuth.user?.id
        }]);

        setUploading(false);
        setActiveTab('library'); // Switch back to see it
    };

    const handleConfirm = () => {
        if (selectedItem) {
            onSelectOption(selectedItem);
            onClose();
        }
    };

    const filteredMedia = mediaItems.filter(item => 
        item.file_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCopyUrl = (e: React.MouseEvent, url: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(url);
        // Optional: you could add a little Toast here. For now, a quick alert.
        alert('Asset URL copied to clipboard!');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--color-card-border)] bg-black/20">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ImageIcon className="text-[var(--color-primary)]" />
                        Asset Library
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--color-card-border)] px-6">
                    <button 
                        onClick={() => setActiveTab('library')}
                        className={`px-6 py-4 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'library' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                    >
                        Browse Library
                    </button>
                    <button 
                        onClick={() => setActiveTab('upload')}
                        className={`px-6 py-4 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'upload' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                    >
                        Upload New
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-black/10">
                    
                    {/* LIBRARY TAB */}
                    {activeTab === 'library' && (
                        <div className="space-y-6">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search library..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-black/40 border border-[var(--color-card-border)] rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[var(--color-primary)] placeholder-gray-500"
                                />
                            </div>

                            {/* Grid */}
                            {isLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="animate-spin text-[var(--color-primary)]" size={32} />
                                </div>
                            ) : filteredMedia.length === 0 ? (
                                <div className="text-center py-20 text-gray-500 flex flex-col items-center">
                                    <ImageIcon size={48} className="text-gray-700 mb-4" />
                                    <p>No assets found.</p>
                                    <button onClick={() => setActiveTab('upload')} className="mt-4 text-[var(--color-primary)] hover:underline text-sm font-semibold">Upload your first file</button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {filteredMedia.map(item => (
                                        <div 
                                            key={item.id}
                                            onClick={() => setSelectedItem(item.url)}
                                            className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${selectedItem === item.url ? 'border-[var(--color-primary)] shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.5)]' : 'border-transparent bg-black/40 hover:border-gray-500'}`}
                                        >
                                            <div className="aspect-square bg-black/50 overflow-hidden flex items-center justify-center relative">
                                                {item.file_name.toLowerCase().endsWith('.pdf') ? (
                                                    <div className="flex flex-col items-center justify-center w-full h-full text-red-400 gap-2 group-hover:scale-110 transition-transform duration-500 bg-red-950/30">
                                                        <FileText size={48} />
                                                        <span className="text-[10px] font-bold tracking-wider">PDF DOC</span>
                                                    </div>
                                                ) : (
                                                    <img src={item.url} alt={item.file_name} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
                                                )}
                                                
                                                {/* Selection Badge */}
                                                {selectedItem === item.url && (
                                                    <div className="absolute top-2 right-2 bg-[var(--color-primary)] text-white p-1 rounded-full shadow-lg">
                                                        <Check size={14} strokeWidth={3} />
                                                    </div>
                                                )}
                                                
                                                {/* Copy Button */}
                                                <button
                                                    onClick={(e) => handleCopyUrl(e, item.url)}
                                                    className="absolute bottom-2 right-2 bg-black/60 hover:bg-[var(--color-primary)] text-white p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
                                                    title="Copy URL"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                            <div className="p-2 bg-black/80 truncate text-[10px] text-gray-300 group-hover:text-white">
                                                {item.file_name}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* UPLOAD TAB */}
                    {activeTab === 'upload' && (
                        <div className="flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed border-[var(--color-card-border)] rounded-2xl bg-black/20 hover:bg-black/30 hover:border-[var(--color-primary)]/50 transition-all">
                            {uploading ? (
                                <div className="flex flex-col items-center gap-4 text-gray-300">
                                    <Loader2 className="animate-spin text-[var(--color-primary)]" size={48} />
                                    <p className="font-semibold text-lg">Uploading to library...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="w-20 h-20 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center mb-6">
                                        <Upload size={32} className="text-[var(--color-primary)]" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">Upload File</h3>
                                    <p className="text-sm text-gray-400 mb-8 max-w-sm text-center">Images and PDFs will be saved to your shared library for reuse across courses.</p>
                                    
                                    <label className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white font-bold py-3 px-8 rounded-xl cursor-pointer transition-colors shadow-lg">
                                        Select File
                                        <input type="file" accept="image/*, application/pdf" className="hidden" onChange={handleFileUpload} />
                                    </label>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Footer */}
                <div className="p-6 border-t border-[var(--color-card-border)] bg-black/40 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!selectedItem || activeTab !== 'library'}
                        className="px-8 py-2.5 rounded-xl font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                    >
                        Insert Asset
                    </button>
                </div>

            </div>
        </div>
    );
}
