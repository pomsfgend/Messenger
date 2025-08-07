import React, { useState, useEffect, useRef } from 'react';
import { MessageType } from '../types';
import { useI18n } from '../hooks/useI18n';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

interface MediaUploadPreviewModalProps {
    item: { file: File; type: MessageType };
    onClose: () => void;
    onSend: (file: File, caption: string, typeOverride?: MessageType) => void;
}

const MediaUploadPreviewModal: React.FC<MediaUploadPreviewModalProps> = ({ item, onClose, onSend }) => {
    const { t } = useI18n();
    const [caption, setCaption] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLHeadingElement>(null);
    const modalId = 'media-upload-preview';
    const { transform } = useDraggable(modalRef, handleRef, modalId);
    const { size } = useResizable(modalRef, modalId);

    useEffect(() => {
        if (item.type === 'image' || item.type === 'video') {
            const url = URL.createObjectURL(item.file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [item]);

    const handleSend = () => {
        setLoading(true);
        onSend(item.file, caption, item.type);
        onClose();
    };

    const renderPreview = () => {
        if (item.type === 'image' && previewUrl) {
            return <img src={previewUrl} alt="Upload preview" className="max-h-80 w-auto object-contain rounded-lg" />;
        }
        if (item.type === 'video' && previewUrl) {
            return <video src={previewUrl} controls className="max-h-80 w-auto object-contain rounded-lg" />;
        }
        return (
            <div className="h-40 flex flex-col items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-lg p-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2-2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                 <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 truncate max-w-full">{item.file.name}</p>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[150] flex items-center justify-center p-4" onClick={onClose}>
            <div 
                ref={modalRef}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-fade-in-up" 
                onClick={e => e.stopPropagation()}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px)`,
                    width: size.width ? `${size.width}px` : 'min(90vw, 512px)',
                    height: size.height ? `${size.height}px` : 'auto',
                    minWidth: '320px',
                }}
            >
                <h2 ref={handleRef} className="text-xl font-bold text-slate-800 dark:text-white cursor-move">Send File</h2>
                <div className="flex justify-center">
                    {renderPreview()}
                </div>
                 <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={t('chat.addCaption')}
                    className="w-full bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors resize-none"
                    rows={2}
                />
                 <div className="flex justify-end gap-4">
                    <button onClick={onClose} disabled={loading} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                        {t('common.cancel')}
                    </button>
                    <button onClick={handleSend} disabled={loading} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400/50 btn-primary">
                        {loading ? t('common.saving') : t('chat.send')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MediaUploadPreviewModal;