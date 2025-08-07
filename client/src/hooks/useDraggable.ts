import { useState, useRef, useEffect, useCallback, RefObject } from 'react';

export const useDraggable = (
  modalRef: RefObject<HTMLElement>,
  handleRef: RefObject<HTMLElement>,
  modalId?: string
) => {
  const getInitialPosition = useCallback(() => {
    if (modalId) {
      try {
        const saved = localStorage.getItem(`modal-pos-${modalId}`);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved modal position", e);
      }
    }
    return { x: 0, y: 0 };
  }, [modalId]);

  const [transform, setTransform] = useState(getInitialPosition());
  const dragInfo = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragInfo.current.isDragging) return;
    const dx = e.clientX - dragInfo.current.startX;
    const dy = e.clientY - dragInfo.current.startY;
    setTransform({
      x: dragInfo.current.initialX + dx,
      y: dragInfo.current.initialY + dy,
    });
  }, []);

  const onMouseUp = useCallback(() => {
    if (!dragInfo.current.isDragging) return;
    
    dragInfo.current.isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (document.body.style.userSelect === 'none') {
        document.body.style.userSelect = '';
    }
    
    if (modalId) {
      setTransform(currentTransform => {
        try {
          localStorage.setItem(`modal-pos-${modalId}`, JSON.stringify(currentTransform));
        } catch (e) {
          console.error("Failed to save modal position", e);
        }
        return currentTransform;
      });
    }

  }, [onMouseMove, modalId]);

  const onMouseDown = useCallback((e: MouseEvent) => {
    const targetIsHandle = handleRef.current && handleRef.current.contains(e.target as Node);
    
    if (targetIsHandle) {
      e.preventDefault();
      dragInfo.current.isDragging = true;
      dragInfo.current.startX = e.clientX;
      dragInfo.current.startY = e.clientY;
      
      setTransform(currentTransform => {
        dragInfo.current.initialX = currentTransform.x;
        dragInfo.current.initialY = currentTransform.y;
        return currentTransform;
      });

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = 'none';
    }
  }, [handleRef, onMouseMove, onMouseUp]);

  useEffect(() => {
    const handle = handleRef.current;
    if (handle) {
      const mousedownListener = onMouseDown as EventListener;
      handle.addEventListener('mousedown', mousedownListener);
      return () => {
        handle.removeEventListener('mousedown', mousedownListener);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [handleRef, onMouseDown, onMouseMove, onMouseUp]);

  return { transform };
};
