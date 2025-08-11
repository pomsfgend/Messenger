import { useState, useRef, useEffect, useCallback, RefObject } from 'react';

const getCoords = (e: MouseEvent | TouchEvent) => {
    if ('touches' in e) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
};

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

  const onDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragInfo.current.isDragging) return;
    
    // Prevent default scroll behavior on touch devices
    if ('touches' in e) {
        e.preventDefault();
    }
    
    const { x, y } = getCoords(e);
    const dx = x - dragInfo.current.startX;
    const dy = y - dragInfo.current.startY;
    setTransform({
      x: dragInfo.current.initialX + dx,
      y: dragInfo.current.initialY + dy,
    });
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragInfo.current.isDragging) return;
    
    dragInfo.current.isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);
    
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

  }, [onDragMove, modalId]);

  const onDragStart = useCallback((e: MouseEvent | TouchEvent) => {
    const targetIsHandle = handleRef.current && handleRef.current.contains(e.target as Node);
    
    if (targetIsHandle) {
      e.stopPropagation(); // CRITICAL FIX: Prevent click events on elements behind the handle.
      const { x, y } = getCoords(e);
      
      dragInfo.current.isDragging = true;
      dragInfo.current.startX = x;
      dragInfo.current.startY = y;
      
      setTransform(currentTransform => {
        dragInfo.current.initialX = currentTransform.x;
        dragInfo.current.initialY = currentTransform.y;
        return currentTransform;
      });

      document.addEventListener('mousemove', onDragMove, { passive: false });
      document.addEventListener('mouseup', onDragEnd);
      document.addEventListener('touchmove', onDragMove, { passive: false });
      document.addEventListener('touchend', onDragEnd);
      
      document.body.style.userSelect = 'none';
    }
  }, [handleRef, onDragMove, onDragEnd]);

  useEffect(() => {
    const handle = handleRef.current;
    if (handle) {
      const mousedownListener = onDragStart as EventListener;
      const touchstartListener = onDragStart as EventListener;

      handle.addEventListener('mousedown', mousedownListener);
      // FIX: Use `passive: false` for touchstart to allow `preventDefault` in `onDragMove`.
      handle.addEventListener('touchstart', touchstartListener, { passive: false });

      return () => {
        handle.removeEventListener('mousedown', mousedownListener);
        handle.removeEventListener('touchstart', touchstartListener);
        // Cleanup global listeners just in case
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('touchend', onDragEnd);
      };
    }
  }, [handleRef, onDragStart, onDragMove, onDragEnd]);

  return { transform };
};
