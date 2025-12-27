import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check } from 'lucide-react';

interface CropModalProps {
  imageSrc: string;
  onConfirm: (newImageSrc: string) => void;
  onCancel: () => void;
}

type InteractionMode = 
  | 'create' 
  | 'move' 
  | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' 
  | 'resize-n' | 'resize-e' | 'resize-s' | 'resize-w' 
  | null;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CropModal: React.FC<CropModalProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const [selection, setSelection] = useState<Rect | null>(null);
  const [mode, setMode] = useState<InteractionMode>(null);
  
  // Ref to store interaction state without triggering re-renders during drag
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startSelection: Rect;
    containerRect: DOMRect | null;
  }>({
    startX: 0,
    startY: 0,
    startSelection: { x: 0, y: 0, w: 0, h: 0 },
    containerRect: null
  });

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getClientPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { clientX, clientY };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent, action: InteractionMode) => {
    e.stopPropagation();
    // Prevent default to stop scrolling on mobile while cropping
    if (e.cancelable && 'touches' in e) e.preventDefault();

    if (!containerRef.current) return;

    const { clientX, clientY } = getClientPos(e);
    const rect = containerRef.current.getBoundingClientRect();

    // Store initial state
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startSelection: selection ? { ...selection } : { x: 0, y: 0, w: 0, h: 0 },
      containerRect: rect
    };

    setMode(action);

    // If creating, start at relative position
    if (action === 'create') {
       const relX = clientX - rect.left;
       const relY = clientY - rect.top;
       setSelection({ x: relX, y: relY, w: 0, h: 0 });
       // Update start selection for 'create' logic
       dragRef.current.startSelection = { x: relX, y: relY, w: 0, h: 0 };
    }
  };

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!mode || !dragRef.current.containerRect) return;
    
    // Crucial for mobile to prevent scroll
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    const { clientX, clientY } = getClientPos(e as any);
    const { startX, startY, startSelection, containerRect } = dragRef.current;
    
    // Delta from start point
    const dx = clientX - startX;
    const dy = clientY - startY;

    setSelection(prev => {
        if (!prev && mode !== 'create') return null;
        
        // Use cached container dimensions
        const containerW = containerRect.width;
        const containerH = containerRect.height;
        const minSize = 20;

        let newRect = { ...startSelection };

        if (mode === 'create') {
            const currentRelX = clientX - containerRect.left;
            const currentRelY = clientY - containerRect.top;
            
            // Calculate strictly based on start point vs current point
            newRect.x = Math.min(currentRelX, startSelection.x);
            newRect.y = Math.min(currentRelY, startSelection.y);
            newRect.w = Math.abs(currentRelX - startSelection.x);
            newRect.h = Math.abs(currentRelY - startSelection.y);

            // Clamp to bounds
            newRect.x = Math.max(0, newRect.x);
            newRect.y = Math.max(0, newRect.y);
            if(newRect.x + newRect.w > containerW) newRect.w = containerW - newRect.x;
            if(newRect.y + newRect.h > containerH) newRect.h = containerH - newRect.y;

        } else if (mode === 'move') {
            newRect.x = Math.max(0, Math.min(containerW - startSelection.w, startSelection.x + dx));
            newRect.y = Math.max(0, Math.min(containerH - startSelection.h, startSelection.y + dy));
        } else {
            // Resizing
            if (mode.includes('e')) {
                 newRect.w = Math.max(minSize, startSelection.w + dx);
            }
            if (mode.includes('s')) {
                 newRect.h = Math.max(minSize, startSelection.h + dy);
            }
            if (mode.includes('w')) {
                 const maxShift = startSelection.w - minSize;
                 const shift = Math.min(maxShift, dx);
                 newRect.x = startSelection.x + shift;
                 newRect.w = startSelection.w - shift;
            }
            if (mode.includes('n')) {
                 const maxShift = startSelection.h - minSize;
                 const shift = Math.min(maxShift, dy);
                 newRect.y = startSelection.y + shift;
                 newRect.h = startSelection.h - shift;
            }
        }

        return newRect;
    });
  }, [mode]);

  const handleEnd = useCallback(() => {
    setMode(null);
  }, []);

  useEffect(() => {
      if (mode) {
          window.addEventListener('mousemove', handleMove);
          window.addEventListener('mouseup', handleEnd);
          window.addEventListener('touchmove', handleMove, { passive: false });
          window.addEventListener('touchend', handleEnd);
      }
      return () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleEnd);
          window.removeEventListener('touchmove', handleMove);
          window.removeEventListener('touchend', handleEnd);
      }
  }, [mode, handleMove, handleEnd]);


  const handleCrop = () => {
    if (!selection || !imgRef.current || selection.w < 5 || selection.h < 5) {
        onConfirm(imageSrc);
        return;
    }

    const canvas = document.createElement('canvas');
    // Important: Use natural dims vs rendered dims
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    canvas.width = selection.w * scaleX;
    canvas.height = selection.h * scaleY;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      imgRef.current,
      selection.x * scaleX,
      selection.y * scaleY,
      selection.w * scaleX,
      selection.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    onConfirm(canvas.toDataURL('image/png'));
  };

  const Handle = ({ cursor, position, onStart }: { cursor: string, position: string, onStart: (e: any) => void }) => (
      <div 
        className={`absolute w-8 h-8 flex items-center justify-center z-20 ${position}`}
        style={{ cursor, touchAction: 'none' }}
        onMouseDown={onStart}
        onTouchStart={onStart}
      >
          <div className="w-3 h-3 bg-white border border-indigo-600 rounded-full shadow-sm" />
      </div>
  );

  return (
    <div className="fixed inset-0 z-[110] bg-[#09090b] flex flex-col animate-in fade-in duration-200 select-none">
      {/* Ultra Compact Header */}
      <div className="flex justify-between items-center px-3 py-1.5 bg-[#18181b] border-b border-white/10 shrink-0 z-20">
         <button 
           onClick={onCancel} 
           className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
         >
            <X size={18} />
         </button>
         
         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Crop</span>
         
         <button 
            onClick={handleCrop}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg shadow-indigo-900/40 transition-all active:scale-95 flex items-center gap-1"
         >
            <Check size={12} /> Apply
         </button>
      </div>

      {/* Workspace */}
      <div className="flex-1 w-full h-full bg-[#101012] flex items-center justify-center p-2 overflow-hidden relative">
           
           <div 
             ref={containerRef}
             className={`relative inline-block shadow-2xl touch-none transition-transform duration-200 ease-out will-change-transform ${mode ? 'scale-[1.35]' : 'scale-100'}`}
             onMouseDown={(e) => !selection && handleStart(e, 'create')}
             onTouchStart={(e) => !selection && handleStart(e, 'create')}
           >
              <img 
                ref={imgRef}
                src={imageSrc} 
                alt="Crop Target" 
                className="max-w-full max-h-[calc(100vh-60px)] object-contain block pointer-events-none select-none"
                draggable={false}
              />
              
              {/* Dim Overlay */}
              {selection && (
                  <>
                     <div className="absolute top-0 left-0 right-0 bg-black/70 pointer-events-none" style={{ height: selection.y }} />
                     <div className="absolute bottom-0 left-0 right-0 bg-black/70 pointer-events-none" style={{ top: selection.y + selection.h }} />
                     <div className="absolute left-0 bg-black/70 pointer-events-none" style={{ top: selection.y, height: selection.h, width: selection.x }} />
                     <div className="absolute right-0 bg-black/70 pointer-events-none" style={{ top: selection.y, height: selection.h, left: selection.x + selection.w }} />
                  </>
              )}

              {/* Selection Box */}
              {selection && (
                <div 
                    className="absolute border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move"
                    style={{
                        left: selection.x,
                        top: selection.y,
                        width: selection.w,
                        height: selection.h,
                        touchAction: 'none'
                    }}
                    onMouseDown={(e) => handleStart(e, 'move')}
                    onTouchStart={(e) => handleStart(e, 'move')}
                >
                    {/* Grid Lines */}
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30 pointer-events-none" />
                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30 pointer-events-none" />
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30 pointer-events-none" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30 pointer-events-none" />

                    {/* Corner Handles */}
                    <Handle cursor="nw-resize" position="-top-4 -left-4" onStart={(e) => handleStart(e, 'resize-nw')} />
                    <Handle cursor="ne-resize" position="-top-4 -right-4" onStart={(e) => handleStart(e, 'resize-ne')} />
                    <Handle cursor="sw-resize" position="-bottom-4 -left-4" onStart={(e) => handleStart(e, 'resize-sw')} />
                    <Handle cursor="se-resize" position="-bottom-4 -right-4" onStart={(e) => handleStart(e, 'resize-se')} />

                    {/* Side Handles */}
                    <Handle cursor="n-resize" position="-top-4 left-1/2 -translate-x-1/2" onStart={(e) => handleStart(e, 'resize-n')} />
                    <Handle cursor="s-resize" position="-bottom-4 left-1/2 -translate-x-1/2" onStart={(e) => handleStart(e, 'resize-s')} />
                    <Handle cursor="w-resize" position="top-1/2 -translate-y-1/2 -left-4" onStart={(e) => handleStart(e, 'resize-w')} />
                    <Handle cursor="e-resize" position="top-1/2 -translate-y-1/2 -right-4" onStart={(e) => handleStart(e, 'resize-e')} />
                </div>
              )}
           </div>
      </div>
    </div>
  );
};

export default CropModal;