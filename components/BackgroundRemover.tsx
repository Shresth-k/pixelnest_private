import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Droplet, Eraser, Crop, Undo2, Sparkles, Wand2, Brush } from 'lucide-react';
import { removeBackgroundWithAI } from '../services/geminiService';
import CropModal from './CropModal';

interface BackgroundRemoverProps {
  imageSrc: string;
  onConfirm: (newImageSrc: string) => void;
  onCancel: () => void;
}

const BackgroundRemover: React.FC<BackgroundRemoverProps> = ({ imageSrc, onConfirm, onCancel }) => {
  // We use history to store DataURLs of the canvas state
  const [history, setHistory] = useState<string[]>([imageSrc]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [tolerance, setTolerance] = useState(40);
  const [brushSize, setBrushSize] = useState(20);
  
  // Tools
  const [activeTool, setActiveTool] = useState<'wand' | 'eraser' | 'none'>('none');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // To keep track of the loaded image object for re-drawing if needed (though we mostly draw from history)
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });

  // Magnifier State
  const [magnifierPos, setMagnifierPos] = useState<{x: number, y: number} | null>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Canvas with the image
  useEffect(() => {
    const currentSrc = history[historyIndex];
    const img = new Image();
    img.onload = () => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Set canvas dims to natural image size
            canvas.width = img.width;
            canvas.height = img.height;
            setCanvasDims({ w: img.width, h: img.height });

            ctx.clearRect(0,0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        }
    };
    img.src = currentSrc;
  }, [history, historyIndex]);

  const saveToHistory = () => {
      if (!canvasRef.current) return;
      const newUrl = canvasRef.current.toDataURL('image/png');
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newUrl);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };
  
  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'wand' || isProcessing || !canvasRef.current) return;
    
    setIsProcessing(true);
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Get target color
      const targetIdx = (y * canvas.width + x) * 4;
      const r0 = data[targetIdx];
      const g0 = data[targetIdx + 1];
      const b0 = data[targetIdx + 2];
      
      for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a === 0) continue; // Already transparent

          const dist = Math.sqrt((r - r0)**2 + (g - g0)**2 + (b - b0)**2);
          if (dist <= tolerance) {
              data[i + 3] = 0; // Set alpha to 0
          }
      }

      ctx.putImageData(imageData, 0, 0);
      saveToHistory();

    } catch (err) {
      console.error("Failed to remove background", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Eraser Logic
  const isDrawing = useRef(false);
  const lastPos = useRef<{x: number, y: number} | null>(null);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
  };

  // Magnifier Logic
  const updateMagnifier = (x: number, y: number) => {
      if (!magnifierCanvasRef.current || !canvasRef.current) return;
      const magCtx = magnifierCanvasRef.current.getContext('2d');
      const mainCanvas = canvasRef.current;
      if (!magCtx) return;

      const size = 100; // Size of the magnifier window
      const zoom = 2;   // Zoom level
      const sourceSize = size / zoom;

      // Clear
      magCtx.clearRect(0, 0, size, size);
      
      // Draw background pattern
      const patternSize = 10;
      for(let i=0; i<size; i+=patternSize) {
          for(let j=0; j<size; j+=patternSize) {
              if ((i/patternSize + j/patternSize) % 2 === 0) {
                  magCtx.fillStyle = '#ccc';
                  magCtx.fillRect(i, j, patternSize, patternSize);
              } else {
                  magCtx.fillStyle = '#fff';
                  magCtx.fillRect(i, j, patternSize, patternSize);
              }
          }
      }

      // Draw magnified image
      // Clamp coordinates
      const sx = Math.max(0, Math.min(mainCanvas.width - sourceSize, x - sourceSize/2));
      const sy = Math.max(0, Math.min(mainCanvas.height - sourceSize, y - sourceSize/2));

      magCtx.drawImage(
          mainCanvas,
          sx, sy, sourceSize, sourceSize,
          0, 0, size, size
      );

      // Draw crosshair
      magCtx.strokeStyle = 'rgba(239, 68, 68, 0.8)'; // Red
      magCtx.lineWidth = 1;
      magCtx.beginPath();
      magCtx.moveTo(size/2, 0);
      magCtx.lineTo(size/2, size);
      magCtx.moveTo(0, size/2);
      magCtx.lineTo(size, size/2);
      magCtx.stroke();
  };

  const handleDrawStart = (e: React.MouseEvent | React.TouchEvent) => {
      if (activeTool !== 'eraser') return;
      isDrawing.current = true;
      const pos = getCanvasPos(e);
      lastPos.current = pos;
      
      setMagnifierPos(pos);
      updateMagnifier(pos.x, pos.y);
      draw(e);
  };

  const handleDrawMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing.current || activeTool !== 'eraser') return;
      e.preventDefault(); // Stop scroll on mobile
      
      const pos = getCanvasPos(e);
      setMagnifierPos(pos);
      updateMagnifier(pos.x, pos.y);
      draw(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!canvasRef.current || !lastPos.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const currentPos = getCanvasPos(e);

      ctx.globalCompositeOperation = 'destination-out'; // Erase mode
      ctx.beginPath();
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();

      lastPos.current = currentPos;
  };

  const handleDrawEnd = () => {
      if (isDrawing.current) {
          isDrawing.current = false;
          saveToHistory();
      }
      lastPos.current = null;
      setMagnifierPos(null); // Hide magnifier
  };

  const handleAIRemove = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setActiveTool('none'); 

    try {
      const currentSrc = history[historyIndex];
      const newSrc = await removeBackgroundWithAI(currentSrc);
      if (newSrc) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newSrc);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      } else {
        alert("AI couldn't remove the background automatically. Try using the Wand manually.");
      }
    } catch (e) {
      console.error(e);
      alert("AI Service Unavailable. Switching to manual tools.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = () => {
      if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
      }
  };

  if (showCrop) {
      return (
          <CropModal 
            imageSrc={history[historyIndex]} 
            onConfirm={(croppedSrc) => {
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(croppedSrc);
                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
                setShowCrop(false);
            }} 
            onCancel={() => setShowCrop(false)} 
          />
      )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#09090b] flex flex-col animate-in fade-in duration-200">
      
      {/* Magnifier View (Shifted to LEFT) */}
      {magnifierPos && activeTool === 'eraser' && (
          <div className="absolute top-16 left-2 z-[110] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
             <div className="w-24 h-24 rounded-full border-4 border-white shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden bg-white">
                <canvas ref={magnifierCanvasRef} width={100} height={100} className="w-full h-full" />
             </div>
             <div className="text-center text-[10px] text-white font-bold mt-1 bg-black/50 rounded px-2 w-max mx-auto shadow-sm">Zoom x2</div>
          </div>
      )}

      {/* 1. Header */}
      <div className="flex justify-between items-center px-4 py-2 bg-[#18181b] border-b border-white/10 shrink-0 z-10 safe-area-top">
         <button 
           onClick={onCancel} 
           className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
         >
            <X size={20} />
         </button>
         
         <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Edit Asset</span>
         
         <button 
            onClick={() => onConfirm(history[historyIndex])}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-indigo-900/40 transition-all active:scale-95 flex items-center gap-2"
         >
            <Check size={14} /> Done
         </button>
      </div>

      {/* 2. Main Canvas Area */}
      <div className="flex-1 relative w-full h-full overflow-hidden bg-[#101012] flex items-center justify-center p-4">
         {/* Checkerboard Pattern Background */}
         <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')]" />

         <div className="relative group cursor-crosshair transition-transform duration-200 max-w-full max-h-full flex items-center justify-center">
             {isProcessing && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 rounded-lg">
                     <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                        <span className="text-xs text-indigo-300 font-medium animate-pulse">Processing...</span>
                     </div>
                 </div>
             )}
             
             {/* Editable Canvas */}
             <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseDown={handleDrawStart}
                onMouseMove={handleDrawMove}
                onMouseUp={handleDrawEnd}
                onMouseLeave={handleDrawEnd}
                onTouchStart={handleDrawStart}
                onTouchMove={handleDrawMove}
                onTouchEnd={handleDrawEnd}
                className={`max-w-full max-h-[calc(100vh-180px)] object-contain shadow-2xl rounded-sm ring-1 ring-white/10 touch-none ${
                    activeTool === 'wand' ? 'cursor-crosshair' : 
                    activeTool === 'eraser' ? 'cursor-cell' : 'cursor-default'
                }`}
             />
             
             {activeTool === 'wand' && !magnifierPos && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] px-3 py-1 rounded-full pointer-events-none transition-opacity whitespace-nowrap border border-white/10 z-20 shadow-xl animate-bounce">
                    Tap a color to erase it
                </div>
             )}
             {activeTool === 'eraser' && !magnifierPos && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] px-3 py-1 rounded-full pointer-events-none transition-opacity whitespace-nowrap border border-white/10 z-20 shadow-xl animate-bounce">
                    Drag to erase manually
                </div>
             )}
         </div>
      </div>

      {/* 3. Footer Controls */}
      <div className="shrink-0 bg-[#18181b] border-t border-white/10 safe-area-bottom">
         <div className="max-w-md mx-auto p-3 flex flex-col gap-3">
            
            {/* Tolerance Slider (Wand) */}
            {activeTool === 'wand' && (
                <div className="flex items-center gap-3 px-2 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-1.5 min-w-[50px]">
                        <Droplet size={12} className="text-indigo-400" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Tol</span>
                    </div>
                    <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        value={tolerance} 
                        onChange={(e) => setTolerance(parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[10px] font-mono text-indigo-400 w-6 text-center">{tolerance}</span>
                </div>
            )}

            {/* Brush Size Slider (Eraser) */}
            {activeTool === 'eraser' && (
                <div className="flex items-center gap-3 px-2 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-1.5 min-w-[50px]">
                        <Brush size={12} className="text-red-400" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Size</span>
                    </div>
                    <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        value={brushSize} 
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-red-500"
                    />
                    <div 
                        className="w-6 h-6 flex items-center justify-center bg-white/5 rounded"
                    >
                         <div className="bg-red-500 rounded-full" style={{ width: Math.max(2, brushSize/4), height: Math.max(2, brushSize/4) }} />
                    </div>
                </div>
            )}

            {/* Main Toolbar */}
            <div className="grid grid-cols-5 gap-2">
                {/* Undo */}
                <button 
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="flex items-center justify-center p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Undo"
                >
                    <Undo2 size={18} />
                </button>

                {/* Crop Tool */}
                <button 
                    onClick={() => { setActiveTool('none'); setShowCrop(true); }}
                    className="flex flex-col items-center justify-center gap-0.5 p-1 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 transition-colors border border-white/5"
                >
                    <Crop size={16} />
                    <span className="text-[9px] font-medium">Crop</span>
                </button>

                {/* Wand Tool */}
                <button 
                    onClick={() => setActiveTool(activeTool === 'wand' ? 'none' : 'wand')}
                    className={`flex flex-col items-center justify-center gap-0.5 p-1 rounded-xl transition-all border ${activeTool === 'wand' ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                >
                    <Wand2 size={16} />
                    <span className="text-[9px] font-medium">Wand</span>
                </button>

                {/* Eraser Tool */}
                <button 
                    onClick={() => setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')}
                    className={`flex flex-col items-center justify-center gap-0.5 p-1 rounded-xl transition-all border ${activeTool === 'eraser' ? 'bg-red-500 text-white border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                >
                    <Eraser size={16} />
                    <span className="text-[9px] font-medium">Eraser</span>
                </button>

                {/* AI Auto Remove */}
                <button 
                    onClick={handleAIRemove}
                    className="flex flex-col items-center justify-center gap-0.5 p-1 rounded-xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 hover:from-indigo-600/30 hover:to-purple-600/30 text-indigo-200 border border-indigo-500/30 transition-all"
                >
                    <Sparkles size={16} />
                    <span className="text-[9px] font-medium">Auto AI</span>
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default BackgroundRemover;