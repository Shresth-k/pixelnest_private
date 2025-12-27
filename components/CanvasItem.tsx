import React from 'react';
import { PlacedAsset, Asset } from '../types';
import { Scaling, Lock } from 'lucide-react';

interface CanvasItemProps {
  item: PlacedAsset;
  asset: Asset;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, type: 'drag' | 'resize') => void;
}

const CanvasItem: React.FC<CanvasItemProps> = ({ item, asset, isSelected, onMouseDown }) => {
  // Default values if filters are undefined
  const filters = item.filters || { brightness: 100, contrast: 100, saturation: 100, blur: 0 };
  const shadowBlur = item.shadow || 0;
  
  // Construct filter string: basic filters + drop shadow
  let filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) blur(${filters.blur}px)`;
  if (shadowBlur > 0) {
      filterString += ` drop-shadow(4px 6px ${shadowBlur}px rgba(0,0,0,0.6))`;
  }

  const isLocked = item.isLocked || false;
  const blendMode = item.blendMode || 'normal';

  return (
    <div
      style={{
        position: 'absolute',
        left: item.position.x,
        top: item.position.y,
        width: item.size.width,
        height: item.size.height,
        zIndex: item.zIndex,
        // Use translate3d to force GPU layer promotion
        transform: `rotate(${item.rotation}deg) scaleX(${item.flipX ? -1 : 1}) translate3d(0,0,0)`,
        touchAction: 'none', // Disable browser gestures
        willChange: 'transform, width, height', // Hint to browser
        backfaceVisibility: 'hidden', // Clean up rendering
        mixBlendMode: blendMode
      }}
      className={`group select-none ${isSelected ? 'z-50' : ''}`}
      onMouseDown={(e) => {
          if (isLocked) {
              e.stopPropagation();
              return;
          }
          onMouseDown(e, 'drag');
      }}
      onTouchStart={(e) => {
        if (isLocked) {
             e.stopPropagation();
             return;
        }
        e.stopPropagation(); 
        const syntheticEvent = {
            ...e,
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY,
            stopPropagation: () => e.stopPropagation(),
            preventDefault: () => {}
        } as unknown as React.MouseEvent;
        onMouseDown(syntheticEvent, 'drag');
      }}
    >
      {asset.type === 'video' ? (
        <video 
           src={asset.url}
           autoPlay
           muted
           loop
           playsInline
           style={{ filter: filterString }}
           className={`w-full h-full object-cover pointer-events-none ${isSelected ? 'drop-shadow-[0_0_4px_rgba(99,102,241,0.8)]' : ''}`}
        />
      ) : (
        <img 
            src={asset.url} 
            alt={asset.name} 
            style={{ filter: filterString }}
            className={`w-full h-full object-fill pixelated pointer-events-none ${isSelected ? 'drop-shadow-[0_0_4px_rgba(99,102,241,0.8)]' : ''}`}
            draggable={false}
        />
      )}
      
      {/* Selection Border & Controls */}
      {isSelected && (
        <>
          <div className={`absolute inset-0 border-2 ${isLocked ? 'border-red-500/50 bg-red-500/5' : 'border-indigo-500 bg-indigo-500/10'} pointer-events-none`} />
          
          {/* Resize Handle - Bottom Right */}
          {!isLocked && (
            <div 
                className="absolute -bottom-4 -right-4 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center cursor-nwse-resize shadow-lg z-50 hover:scale-110 transition-transform active:scale-90 border-2 border-white"
                onMouseDown={(e) => {
                e.stopPropagation();
                onMouseDown(e, 'resize');
                }}
                onTouchStart={(e) => {
                e.stopPropagation();
                    const syntheticEvent = {
                        ...e,
                        clientX: e.touches[0].clientX,
                        clientY: e.touches[0].clientY,
                        stopPropagation: () => e.stopPropagation(),
                        preventDefault: () => {}
                    } as unknown as React.MouseEvent;
                onMouseDown(syntheticEvent, 'resize');
                }}
            >
                <Scaling size={16} className="text-white" />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CanvasItem;