import React, { useState } from 'react';
import { 
  FlipHorizontal, 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  Sliders,
  Move,
  Wand2,
  Lock,
  Unlock,
  Crop,
  Edit2,
  Blend,
  Eclipse
} from 'lucide-react';
import { PlacedAsset, Asset, ImageFilters } from '../types';

interface ContextPanelProps {
  selectedItem: PlacedAsset | null;
  selectedAsset: Asset | null;
  onUpdateItem: (updates: Partial<PlacedAsset>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRemoveBackground: () => void;
  onCrop: () => void;
  onRenameItem: (newName: string) => void;
}

const ContextPanel: React.FC<ContextPanelProps> = ({ 
  selectedItem, 
  selectedAsset,
  onUpdateItem, 
  onDelete,
  onDuplicate,
  onRemoveBackground,
  onCrop,
  onRenameItem
}) => {
  const [activeTab, setActiveTab] = useState<'tools' | 'adjust'>('tools');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  if (!selectedItem) {
    return null; 
  }

  const filters = selectedItem.filters || { brightness: 100, contrast: 100, saturation: 100, blur: 0 };
  const isLocked = selectedItem.isLocked || false;
  const blendMode = selectedItem.blendMode || 'normal';
  const shadow = selectedItem.shadow || 0;

  const handleFilterChange = (key: keyof ImageFilters, value: number) => {
    onUpdateItem({
      filters: {
        ...filters,
        [key]: value
      }
    });
  };

  const startRenaming = () => {
      setRenameValue(selectedItem.name || selectedAsset?.name || 'Item');
      setIsRenaming(true);
  };

  const finishRenaming = () => {
      if (renameValue.trim()) {
          onRenameItem(renameValue.trim());
      }
      setIsRenaming(false);
  };

  return (
    <>
    {/* Rename / Info Tag - Positioned relative to selection on Desktop, or fixed on Mobile */}
    {selectedAsset && (
        <div className="fixed z-30 left-1/2 -translate-x-1/2 top-16 md:left-16 md:top-20 md:translate-x-0 bg-[#1f2937]/90 backdrop-blur rounded-full border border-white/10 shadow-lg overflow-hidden max-w-[200px] transition-all animate-in fade-in zoom-in-95">
           {isRenaming ? (
               <input 
                 autoFocus
                 className="w-full text-[10px] bg-black/50 text-white px-3 py-1.5 outline-none font-medium text-center"
                 value={renameValue}
                 onChange={(e) => setRenameValue(e.target.value)}
                 onBlur={finishRenaming}
                 onKeyDown={(e) => e.key === 'Enter' && finishRenaming()}
               />
           ) : (
               <div 
                onClick={startRenaming}
                className="px-3 py-1.5 text-[10px] text-gray-300 font-medium truncate cursor-text hover:text-white hover:bg-white/5 flex items-center gap-1.5"
                title="Click to rename"
               >
                   <span className="truncate max-w-[100px]">{selectedItem.name || selectedAsset.name}</span>
                   <Edit2 size={10} className="opacity-50" />
               </div>
           )}
        </div>
      )}

    <div className="fixed z-30 pointer-events-auto transition-all duration-300 
        bottom-6 left-1/2 -translate-x-1/2 flex-row h-auto w-auto max-w-[95vw]
        md:left-4 md:top-36 md:bottom-auto md:translate-x-0 md:flex-col md:w-[50px] md:h-auto
        flex gap-2 animate-in slide-in-from-bottom-10 md:slide-in-from-left-4"
    >
      
      {/* Main Toolbar Bubble */}
      <div className="bg-[#1f2937]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex 
          flex-row items-center px-1.5 py-1.5 h-[50px]
          md:flex-col md:w-[50px] md:h-auto md:py-1.5 md:px-0"
      >
        
        {/* Tab Toggle */}
        <div className="flex gap-1.5 md:flex-col md:mb-2 md:w-full md:px-1.5 shrink-0 border-r md:border-r-0 md:border-b border-white/10 pr-1.5 md:pr-0 md:pb-1.5 mr-1.5 md:mr-0">
            <button 
                onClick={() => setActiveTab('tools')}
                className={`w-8 h-8 md:w-full md:aspect-square rounded-xl flex items-center justify-center transition-all ${activeTab === 'tools' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                <Move size={16} />
            </button>
            <button 
                onClick={() => setActiveTab('adjust')}
                className={`w-8 h-8 md:w-full md:aspect-square rounded-xl flex items-center justify-center transition-all ${activeTab === 'adjust' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/40' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                <Sliders size={16} />
            </button>
        </div>

        {activeTab === 'tools' ? (
            <div className="flex flex-row md:flex-col gap-1 w-full md:px-1.5 overflow-x-auto md:overflow-visible no-scrollbar items-center">
                <ToolButton 
                    icon={isLocked ? Lock : Unlock} 
                    label={isLocked ? "Unlock" : "Lock"} 
                    onClick={() => onUpdateItem({ isLocked: !isLocked })} 
                    active={isLocked}
                />
                
                {!isLocked && (
                    <>
                    <div className="w-px h-6 bg-white/10 md:w-full md:h-px md:my-1 shrink-0"></div>

                    <ToolButton icon={FlipHorizontal} label="Flip" onClick={() => onUpdateItem({ flipX: !selectedItem.flipX })} />
                    
                    {/* Shadow Toggle */}
                    <ToolButton 
                        icon={Eclipse} 
                        label="Shadow" 
                        onClick={() => onUpdateItem({ shadow: shadow > 0 ? 0 : 5 })} 
                        active={shadow > 0}
                    />

                    {selectedAsset?.type === 'image' && (
                        <>
                            <ToolButton icon={Crop} label="Crop" onClick={onCrop} />
                            <ToolButton icon={Wand2} label="Clean BG" onClick={onRemoveBackground} color="text-indigo-300 hover:text-white hover:bg-white/10" />
                        </>
                    )}
                    
                    <div className="w-px h-6 bg-white/10 md:w-full md:h-px md:my-1 shrink-0"></div>
                    
                    <ToolButton icon={ArrowUp} label="Up" onClick={() => onUpdateItem({ zIndex: selectedItem.zIndex + 1 })} />
                    <ToolButton icon={ArrowDown} label="Down" onClick={() => onUpdateItem({ zIndex: Math.max(0, selectedItem.zIndex - 1) })} />

                    <div className="w-px h-6 bg-white/10 md:w-full md:h-px md:my-1 shrink-0"></div>

                    <ToolButton icon={Copy} label="Clone" onClick={onDuplicate} />
                    <ToolButton icon={Trash2} label="Del" onClick={onDelete} color="text-red-400 hover:bg-red-500/20" />
                    </>
                )}
            </div>
        ) : (
             <div className="flex items-center justify-center px-4 text-[10px] text-gray-500 md:rotate-90 md:whitespace-nowrap md:py-4">
                 Adjustments
             </div>
        )}
      </div>

      {/* Adjustments Popover */}
      {activeTab === 'adjust' && (
        <div className="absolute 
            bottom-full left-1/2 -translate-x-1/2 mb-2 w-64
            md:left-[58px] md:top-0 md:bottom-auto md:translate-x-0 md:mb-0 md:w-44
            bg-[#1f2937]/95 backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-2xl space-y-3 animate-in fade-in zoom-in-95"
        >
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Visuals</h3>
            <FilterSlider label="Brightness" value={filters.brightness} min={0} max={200} onChange={(v) => handleFilterChange('brightness', v)} />
            <FilterSlider label="Contrast" value={filters.contrast} min={0} max={200} onChange={(v) => handleFilterChange('contrast', v)} />
            <FilterSlider label="Saturation" value={filters.saturation} min={0} max={200} onChange={(v) => handleFilterChange('saturation', v)} />
            
            {/* Shadow Slider (only shows if shadow is active) */}
            {shadow > 0 && (
                <div className="pt-1">
                    <FilterSlider label="Shadow Blur" value={shadow} min={0} max={20} onChange={(v) => onUpdateItem({ shadow: v })} />
                </div>
            )}

            <div className="h-px bg-white/10 my-2"></div>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Blend size={10}/> Overlay Mode</h3>
            <div className="grid grid-cols-2 gap-1">
                 {['normal', 'multiply', 'screen', 'overlay'].map((mode) => (
                     <button
                        key={mode}
                        onClick={() => onUpdateItem({ blendMode: mode as any })}
                        className={`text-[9px] py-1 rounded capitalize border border-white/5 ${blendMode === mode ? 'bg-pink-600 text-white' : 'bg-black/20 text-gray-400 hover:bg-white/10'}`}
                     >
                         {mode}
                     </button>
                 ))}
            </div>
            <p className="text-[9px] text-gray-500 leading-tight">
                Use <b>Screen</b> to remove black backgrounds (fire, magic). Use <b>Multiply</b> to remove white backgrounds.
            </p>
        </div>
      )}
    </div>
    </>
  );
};

const ToolButton = ({ icon: Icon, label, onClick, active = false, color = "text-gray-400 hover:text-white hover:bg-white/10" }: any) => (
  <button
    onClick={onClick}
    className={`w-8 h-8 md:w-full md:aspect-square shrink-0 rounded-lg flex items-center justify-center transition-all group relative ${active ? 'bg-indigo-500 text-white' : color}`}
  >
    <Icon size={16} />
    {/* Tooltip: Hidden on Mobile usually, visible on Desktop hover */}
    <span className="hidden md:block absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 backdrop-blur text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-white/10">
      {label}
    </span>
  </button>
);

const FilterSlider = ({ label, value, min, max, onChange }: { label: string, value: number, min: number, max: number, onChange: (val: number) => void }) => (
    <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
            <span className="text-[9px] text-gray-400 font-medium">{label}</span>
            <span className="text-[9px] text-gray-500 font-mono bg-black/20 px-1 rounded">{value}</span>
        </div>
        <input 
            type="range" 
            min={min} 
            max={max} 
            value={value} 
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400"
        />
    </div>
);

export default ContextPanel;