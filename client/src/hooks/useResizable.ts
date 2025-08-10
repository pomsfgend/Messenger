import React, { useState, useEffect, useCallback, RefObject, useRef } from 'react';

const getCoords = (e: MouseEvent | TouchEvent) => {
    if ('touches' in e) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
};


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

    const onResizeMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isResizing.current || !modalRef.current) return;
        
        const { x, y } = getCoords(e);
        const rect = modalRef.current.getBoundingClientRect();
        
        setSize({
            width: x - rect.left,
            height: y - rect.top,
        });
    }, [modalRef]);

    const onResizeEnd = useCallback(() => {
        if (!isResizing.current) return;
        
        isResizing.current = false;
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeEnd);
        document.removeEventListener('touchmove', onResizeMove);
        document.removeEventListener('touchend', onResizeEnd);
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
    }, [onResizeMove, modalId]);

    const onResizeStart = useCallback((e: MouseEvent | TouchEvent) => {
        e.stopPropagation();
        if ('preventDefault' in e) e.preventDefault();
        
        isResizing.current = true;
        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onResizeEnd);
        document.addEventListener('touchmove', onResizeMove, { passive: false });
        document.addEventListener('touchend', onResizeEnd);
        document.body.style.userSelect = 'none';
    }, [onResizeMove, onResizeEnd]);
    
    useEffect(() => {
        const modal = modalRef.current;
        if (!modal) return;

        const resizer = document.createElement('div');
        resizer.style.width = '20px';
        resizer.style.height = '20px';
        resizer.style.position = 'absolute';
        resizer.style.right = '0';
        resizer.style.bottom = '0';
        resizer.style.cursor = 'se-resize';
        resizer.style.zIndex = '100';
        resizer.style.touchAction = 'none';

        const mousedownListener = onResizeStart as unknown as EventListener;
        resizer.addEventListener('mousedown', mousedownListener);
        resizer.addEventListener('touchstart', mousedownListener, { passive: false });
        
        modal.appendChild(resizer);
        
        return () => {
            resizer.removeEventListener('mousedown', mousedownListener);
            resizer.removeEventListener('touchstart', mousedownListener);
            if (modal.contains(resizer)) {
                 modal.removeChild(resizer);
            }
            document.removeEventListener('mousemove', onResizeMove);
            document.removeEventListener('mouseup', onResizeEnd);
            document.removeEventListener('touchmove', onResizeMove);
            document.removeEventListener('touchend', onResizeEnd);
        };
    }, [modalRef, onResizeStart, onResizeMove, onResizeEnd]);

    return { size };
};