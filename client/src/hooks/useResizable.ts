import React, { useState, useEffect, useCallback, RefObject, useRef } from 'react';

export const useResizable = (modalRef: RefObject<HTMLElement>, modalId?: string) => {
    const getInitialSize = useCallback(() => {
        if (modalId) {
            try {
                const saved = localStorage.getItem(`modal-size-${modalId}`);
                if (saved) return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved modal size", e);
            }
        }
        return { width: 0, height: 0 };
    }, [modalId]);

    const [size, setSize] = useState(getInitialSize());
    const isResizing = useRef(false);

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current || !modalRef.current) return;
        
        const rect = modalRef.current.getBoundingClientRect();
        
        setSize({
            width: e.clientX - rect.left,
            height: e.clientY - rect.top,
        });
    }, [modalRef]);

    const onMouseUp = useCallback(() => {
        if (!isResizing.current) return;
        
        isResizing.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.userSelect = '';
        
        if (modalId) {
            setSize(currentSize => {
                try {
                    localStorage.setItem(`modal-size-${modalId}`, JSON.stringify(currentSize));
                } catch (e) {
                    console.error("Failed to save modal size", e);
                }
                return currentSize;
            });
        }
    }, [onMouseMove, modalId]);

    const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        isResizing.current = true;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.userSelect = 'none';
    }, [onMouseMove, onMouseUp]);
    
    useEffect(() => {
        const modal = modalRef.current;
        if (!modal) return;

        const resizer = document.createElement('div');
        resizer.style.width = '16px';
        resizer.style.height = '16px';
        resizer.style.position = 'absolute';
        resizer.style.right = '0';
        resizer.style.bottom = '0';
        resizer.style.cursor = 'se-resize';
        resizer.style.zIndex = '100';

        const mouseDownListener = onMouseDown as unknown as EventListener;
        resizer.addEventListener('mousedown', mouseDownListener);
        
        modal.appendChild(resizer);
        
        return () => {
            resizer.removeEventListener('mousedown', mouseDownListener);
            if (modal.contains(resizer)) {
                 modal.removeChild(resizer);
            }
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [modalRef, onMouseDown, onMouseMove, onMouseUp]);

    return { size };
};
