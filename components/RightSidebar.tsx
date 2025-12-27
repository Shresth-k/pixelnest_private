import React, { useState, useRef, useEffect } from 'react';
import { 
  Layers, Image as ImageIcon, Plus, Eye, EyeOff, Lock, Unlock, 
  Sparkles, Upload, ChevronLeft, ChevronRight, FolderPlus, Folder, X, Check,
  MoreVertical, Trash2, Edit2, GripVertical, CornerDownRight, ChevronDown, Video
} from 'lucide-react';
import { Asset, LayerGroup, PlacedAsset, AssetFolder } from '../types';
import { generatePixelAsset } from '../services/geminiService';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  folders: AssetFolder[];
  groups: LayerGroup[];
  placedItems: PlacedAsset[];
  activeGroupId: string;
  // Group Actions
  onAddGroup: (name: string) => void;
  onToggleGroupVisibility: (groupId: string) => void;
  onToggleGroupLock: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onSetActiveGroup: (groupId: string) => void;
  // Asset Actions
  onPlaceAsset: (asset: Asset) => void;
  onAddAsset: (url: string, name: string, folderId?: string, isVideo?: boolean) => void;
  onCreateFolder: (name: string) => void;
  onDeleteAsset: (assetId: string) => void;
  onRenameAsset: (assetId: string, newName: string) => void;
  onMoveAsset: (assetId: string, folderId: string | undefined) => void;
  onRequestProcessing: (url: string) => void;
  // Selection / Layer Actions
  onSelectPlacedItem: (itemId: string) => void;
  selectedItemId: string | null;
  onRenamePlacedItem: (itemId: string, newName: string) => void;
  onReorderPlacedItems: (groupId: string, reorderedIds: string[]) => void;
  onToggleItemLock: (itemId: string) => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  assets,
  folders,
  groups,
  placedItems,
  activeGroupId,
  onAddGroup,
  onToggleGroupVisibility,
  onToggleGroupLock,
  onSetActiveGroup,
  onPlaceAsset,
  onAddAsset,
  onCreateFolder,
  onDeleteAsset,
  onRenameAsset,
  onMoveAsset,
  onRequestProcessing,
  onSelectPlacedItem,
  selectedItemId,
  onRenamePlacedItem,
  onReorderPlacedItems,
  onToggleItemLock
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'assets'>('layers');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Collapsed Groups State (Set of IDs that are COLLAPSED)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Asset Editing
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editAssetName, setEditAssetName] = useState('');
  
  // Menu State
  const [menuData, setMenuData] = useState<{ id: string, x: number, y: number } | null>(null);

  // Layer Editing
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editLayerName, setEditLayerName] = useState('');
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close menu on scroll or click elsewhere
  useEffect(() => {
    const handleGlobalClick = () => setMenuData(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleMenuClick = (e: React.MouseEvent, assetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Position menu: Align right edge of menu with right edge of button
    // This keeps it within the sidebar usually, or slightly to the left
    const menuWidth = 128; // w-32
    
    // Calculate Y to keep it on screen
    let top = rect.bottom + 5;
    if (top + 150 > window.innerHeight) { // Assuming menu height ~150px
        top = rect.top - 150;
    }

    setMenuData({
        id: assetId,
        x: rect.right - menuWidth,
        y: top
    });
  };

  // --- Drag and Drop Logic ---
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedLayerId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetGroupId: string) => {
      e.preventDefault(); 
  };

  const handleDrop = (e: React.DragEvent, targetItemId: string, targetGroupId: string) => {
      e.preventDefault();
      if (!draggedLayerId) return;
      if (draggedLayerId === targetItemId) return;

      const groupItems = placedItems
          .filter(i => i.groupId === targetGroupId)
          .sort((a, b) => b.zIndex - a.zIndex);
      
      const currentIds = groupItems.map(i => i.id);
      const fromIndex = currentIds.indexOf(draggedLayerId);
      const toIndex = currentIds.indexOf(targetItemId);

      if (fromIndex === -1 || toIndex === -1) return;

      const newIds = [...currentIds];
      const [movedItem] = newIds.splice(fromIndex, 1);
      newIds.splice(toIndex, 0, movedItem);

      onReorderPlacedItems(targetGroupId, newIds);
      setDraggedLayerId(null);
  };

  const toggleGroupCollapse = (groupId: string) => {
      setCollapsedGroups(prev => {
          const next = new Set(prev);
          if (next.has(groupId)) next.delete(groupId);
          else next.add(groupId);
          return next;
      });
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  // Asset Logic
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        // If it's a video
        if (file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            onAddAsset(url, "New Video", currentFolderId || undefined, true);
        } else {
            // Image
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    onRequestProcessing(event.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    }
  };
  
  const handleGenerate = async () => {
       if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
        const imageUrl = await generatePixelAsset(prompt);
        if (imageUrl) {
            onAddAsset(imageUrl, prompt, currentFolderId || undefined);
            setPrompt('');
        } else {
            alert("AI couldn't generate an image this time.");
        }
        } catch (e) {
        alert("Error connecting to Gemini.");
        } finally {
        setIsGenerating(false);
        }
  };

  const visibleAssets = currentFolderId 
    ? assets.filter(a => a.folderId === currentFolderId)
    : assets.filter(a => !a.folderId);

  const currentFolder = folders.find(f => f.id === currentFolderId);

  return (
    <>
      {/* Backdrop: Only for mobile portrait. Hidden on landscape to allow canvas interaction. */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden landscape:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div 
        ref={sidebarRef}
        className={`fixed top-0 right-0 bottom-0 w-[85vw] max-w-[240px] bg-[#15161e]/95 backdrop-blur-xl border-l border-white/5 flex flex-col z-[70] shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={() => setMenuData(null)}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-3 py-2 border-b border-white/10 shrink-0">
          <h2 className="text-white font-pixel text-lg tracking-wide">Menu</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-white/5 p-1 rounded-full">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-black/20 mx-2 mt-2 mb-1 rounded-lg shrink-0">
          <button
            onClick={() => setActiveTab('layers')}
            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'layers' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Layers size={12} /> Layers
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'assets' ? 'bg-pink-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <ImageIcon size={12} /> Assets
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4">
          {activeTab === 'layers' ? (
            <div className="space-y-3">
              {/* Add Group Header */}
              <div className="flex justify-between items-center pt-2 px-1">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Builds</h3>
                <button 
                  onClick={() => onAddGroup(`Build ${groups.length + 1}`)}
                  className="p-1 hover:bg-white/10 rounded text-indigo-400 transition-colors"
                  title="New Build Group"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="space-y-1.5">
                {groups.map(group => {
                  const isCollapsed = collapsedGroups.has(group.id);
                  const isActive = activeGroupId === group.id;

                  return (
                  <div 
                    key={group.id} 
                    className={`bg-white/5 rounded-lg border transition-all ${
                      isActive ? 'border-indigo-500/50 shadow shadow-indigo-500/10' : 'border-white/5'
                    }`}
                  >
                    {/* Group Header */}
                    <div 
                      className={`flex items-center p-2 gap-1.5 cursor-pointer hover:bg-white/5 border-b ${isCollapsed ? 'border-transparent' : 'border-white/5'}`}
                      onClick={() => onSetActiveGroup(group.id)}
                    >
                       <button
                         onClick={(e) => { e.stopPropagation(); toggleGroupCollapse(group.id); }}
                         className={`text-gray-500 transition-transform duration-200 p-0.5 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                       >
                           <ChevronDown size={12} />
                       </button>

                      <div className={`w-1.5 h-1.5 rounded-full shadow-sm shrink-0 ${isActive ? 'bg-indigo-500 shadow-indigo-500/50' : 'bg-gray-700'}`} />
                      <span className={`flex-1 text-[11px] font-medium truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {group.name}
                      </span>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); onToggleGroupVisibility(group.id); }}
                        className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/10"
                      >
                        {group.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onToggleGroupLock(group.id); }}
                        className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/10"
                      >
                        {group.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                    </div>

                    {/* Draggable Layer List */}
                    {!isCollapsed && (
                      <div className="bg-black/20 p-1 space-y-0.5">
                        {placedItems.filter(i => i.groupId === group.id).length === 0 && (
                          <p className="text-[9px] text-gray-600 text-center py-1">Empty</p>
                        )}
                        {placedItems
                          .filter(i => i.groupId === group.id)
                          .sort((a, b) => b.zIndex - a.zIndex) 
                          .map(item => {
                            const asset = assets.find(a => a.id === item.assetId);
                            const isEditing = editingLayerId === item.id;
                            const isItemLocked = item.isLocked || false;

                            return (
                              <div 
                                key={item.id}
                                draggable={!isEditing && !isItemLocked}
                                onDragStart={(e) => handleDragStart(e, item.id)}
                                onDragOver={(e) => handleDragOver(e, group.id)}
                                onDrop={(e) => handleDrop(e, item.id, group.id)}
                                onClick={() => onSelectPlacedItem(item.id)}
                                onDoubleClick={() => {
                                    setEditingLayerId(item.id);
                                    setEditLayerName(item.name || asset?.name || 'Item');
                                }}
                                className={`flex items-center gap-1.5 p-1 rounded-md text-[10px] cursor-pointer group transition-colors border border-transparent ${
                                  selectedItemId === item.id 
                                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-100' 
                                    : 'hover:bg-white/5 text-gray-400'
                                } ${draggedLayerId === item.id ? 'opacity-50' : ''}`}
                              >
                                <div className={`cursor-grab active:cursor-grabbing ${isItemLocked ? 'opacity-20 cursor-not-allowed' : 'text-gray-600 group-hover:text-gray-400'}`}>
                                    <GripVertical size={10} />
                                </div>

                                {asset?.type === 'video' ? (
                                    <Video size={16} className="text-pink-500" />
                                ) : (
                                    <img src={asset?.url} className="w-4 h-4 object-contain rounded bg-black/30" />
                                )}
                                
                                {isEditing ? (
                                    <input 
                                        autoFocus
                                        value={editLayerName}
                                        onChange={(e) => setEditLayerName(e.target.value)}
                                        onBlur={() => {
                                            if(editLayerName.trim()) onRenamePlacedItem(item.id, editLayerName);
                                            setEditingLayerId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if(e.key === 'Enter') {
                                                if(editLayerName.trim()) onRenamePlacedItem(item.id, editLayerName);
                                                setEditingLayerId(null);
                                            }
                                        }}
                                        className="flex-1 bg-black/50 text-white px-1 py-0 rounded outline-none border border-indigo-500/50 text-[10px]"
                                    />
                                ) : (
                                    <span className="truncate flex-1 font-medium">{item.name || asset?.name || 'Item'}</span>
                                )}

                                <button 
                                    onClick={(e) => { e.stopPropagation(); onToggleItemLock(item.id); }}
                                    className={`p-0.5 rounded hover:bg-white/10 ${isItemLocked ? 'text-indigo-400' : 'text-gray-600'}`}
                                >
                                    {isItemLocked ? <Lock size={9} /> : <Unlock size={9} />}
                                </button>
                              </div>
                            );
                          })
                        }
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
               {/* Folder Navigation */}
               {currentFolderId === null ? (
                 <>
                   {isCreatingFolder ? (
                      <div className="bg-gray-800 p-1.5 rounded-lg border border-gray-600 flex gap-2 items-center">
                        <Folder size={14} className="text-gray-400" />
                        <input 
                          autoFocus
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Name..."
                          className="flex-1 bg-transparent text-xs text-white outline-none"
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                        />
                        <button onClick={handleCreateFolder} className="text-green-400 hover:bg-green-400/10 p-0.5 rounded"><Check size={12}/></button>
                        <button onClick={() => setIsCreatingFolder(false)} className="text-red-400 hover:bg-red-400/10 p-0.5 rounded"><X size={12}/></button>
                      </div>
                   ) : (
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        <button 
                          onClick={() => setIsCreatingFolder(true)}
                          className="p-2 bg-white/5 rounded-lg border border-white/5 flex flex-col items-center justify-center hover:bg-white/10 transition-colors group"
                        >
                          <div className="bg-indigo-500/20 p-1 rounded-full mb-1 group-hover:bg-indigo-500/30 transition-colors">
                              <FolderPlus size={14} className="text-indigo-400" />
                          </div>
                          <span className="text-[9px] text-gray-300 font-medium">New Folder</span>
                        </button>
                        {folders.map(folder => (
                          <button 
                            key={folder.id}
                            onClick={() => setCurrentFolderId(folder.id)}
                            className="p-2 bg-white/5 rounded-lg border border-white/5 flex flex-col items-center justify-center hover:bg-white/10 transition-colors group"
                          >
                             <div className="bg-yellow-500/20 p-1 rounded-full mb-1 group-hover:bg-yellow-500/30 transition-colors">
                                <Folder size={14} className="text-yellow-500" />
                             </div>
                            <span className="text-[9px] text-gray-300 font-medium truncate w-full text-center">{folder.name}</span>
                          </button>
                        ))}
                      </div>
                   )}
                 </>
               ) : (
                 <div className="flex items-center gap-1 mb-2 pb-2 border-b border-white/10">
                   <button 
                    onClick={() => setCurrentFolderId(null)}
                    className="p-1 hover:bg-white/10 rounded-md text-gray-400"
                   >
                     <ChevronLeft size={16} />
                   </button>
                   <Folder size={14} className="text-yellow-500" />
                   <span className="text-xs font-bold text-white truncate">{currentFolder?.name}</span>
                 </div>
               )}

               {/* Upload Area */}
               <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-gray-600 bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-white/10 transition-all group"
               >
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-gray-800 rounded-full group-hover:bg-indigo-500/20 transition-colors">
                        <Upload size={14} className="text-gray-400 group-hover:text-indigo-400" />
                    </div>
                    <span className="text-[10px] text-gray-300 font-medium">Upload (Img/Vid/Gif)</span>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*, video/mp4, image/gif" 
                    onChange={handleFileUpload}
                  />
               </div>

               {/* AI Gen */}
               <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-1 rounded-lg border border-white/10 shadow-inner">
                  <div className="bg-black/30 p-2 rounded-md">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles size={10} className="text-pink-400" />
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Generate</span>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="e.g. A retro cat"
                          className="flex-1 bg-transparent border-b border-gray-600 text-[10px] text-white p-0.5 focus:border-pink-500 outline-none transition-colors placeholder:text-gray-600"
                        />
                        <button
                          onClick={handleGenerate}
                          disabled={isGenerating || !prompt}
                          className="p-1 rounded bg-pink-600 hover:bg-pink-500 text-white shadow disabled:opacity-50 transition-all active:scale-95"
                        >
                          {isGenerating ? <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"/> : <ChevronRight size={12} />}
                        </button>
                      </div>
                  </div>
               </div>

               {/* Asset Grid */}
               <div>
                 <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                   Inventory
                 </h3>
                 <div className="grid grid-cols-2 gap-1.5">
                    {visibleAssets.map((asset) => (
                      <div key={asset.id} className="relative group bg-white/5 rounded-md border border-white/5 hover:border-indigo-500/50 transition-colors">
                        
                        {/* Image Button */}
                        <button
                          onClick={() => onPlaceAsset(asset)}
                          className="aspect-square w-full p-1.5 relative block bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-repeat rounded-t-md overflow-hidden"
                          title={asset.name}
                        >
                          {asset.type === 'video' ? (
                             <video src={asset.url} className="w-full h-full object-cover" muted />
                          ) : (
                             <img src={asset.url} alt={asset.name} className="w-full h-full object-contain pixelated" />
                          )}
                          
                          {/* Video Badge */}
                          {asset.type === 'video' && (
                              <div className="absolute bottom-1 right-1 bg-black/60 p-0.5 rounded-full">
                                  <Video size={8} className="text-white"/>
                              </div>
                          )}
                        </button>

                        {/* Footer & Menu */}
                        <div className="px-1.5 py-0.5 flex items-center justify-between border-t border-white/5 bg-[#1a1b26] rounded-b-md">
                           {editingAssetId === asset.id ? (
                               <input 
                                 autoFocus
                                 className="w-full text-[9px] bg-black/50 text-white px-1 py-0.5 rounded outline-none border border-indigo-500"
                                 value={editAssetName}
                                 onChange={e => setEditAssetName(e.target.value)}
                                 onBlur={() => {
                                     if(editAssetName.trim()) onRenameAsset(asset.id, editAssetName);
                                     setEditingAssetId(null);
                                 }}
                                 onKeyDown={e => {
                                     if(e.key === 'Enter') {
                                         if(editAssetName.trim()) onRenameAsset(asset.id, editAssetName);
                                         setEditingAssetId(null);
                                     }
                                 }}
                               />
                           ) : (
                               <span 
                                className="text-[9px] text-gray-400 truncate max-w-[60px] font-medium" 
                                title={asset.name}
                               >
                                {asset.name}
                               </span>
                           )}
                           
                           <button 
                             onClick={(e) => handleMenuClick(e, asset.id)}
                             className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/10 shrink-0 w-5 h-5 flex items-center justify-center"
                           >
                               <MoreVertical size={10} />
                           </button>
                        </div>
                      </div>
                    ))}
                    {visibleAssets.length === 0 && (
                      <div className="col-span-2 text-center py-6 flex flex-col items-center gap-1 border border-dashed border-white/5 rounded-lg">
                        <div className="p-2 bg-white/5 rounded-full">
                           <ImageIcon size={16} className="text-gray-600" />
                        </div>
                        <span className="text-[9px] text-gray-600">Empty</span>
                      </div>
                    )}
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Fixed Context Menu (Portal-like) */}
      {menuData && (
        <div 
          className="fixed z-[100] w-32 bg-[#1f2937] border border-gray-600 rounded-lg shadow-xl flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100"
          style={{ 
             top: menuData.y,
             left: menuData.x
          }}
          onClick={(e) => e.stopPropagation()}
        >
            <span className="px-2 py-1 text-[8px] text-gray-500 uppercase font-bold tracking-wider">Actions</span>
            
            {/* Find Asset */}
            {(() => {
                const asset = assets.find(a => a.id === menuData.id);
                if(!asset) return null;
                return (
                    <>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setEditingAssetId(asset.id); setEditAssetName(asset.name); setMenuData(null); }}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] text-gray-300 hover:bg-white/5 text-left"
                        >
                            <Edit2 size={10} /> Rename
                        </button>
                        
                        <div className="h-px bg-white/10 my-0.5 mx-2"></div>
                        <span className="px-2 py-1 text-[8px] text-gray-500 uppercase font-bold tracking-wider">Move To</span>
                        <div className="max-h-24 overflow-y-auto custom-scrollbar">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onMoveAsset(asset.id, undefined); setMenuData(null); }}
                                className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] text-gray-300 hover:bg-white/5 text-left w-full"
                            >
                                <CornerDownRight size={8} className="text-gray-500"/> Root
                            </button>
                            {folders.map(f => (
                                <button 
                                    key={f.id}
                                    onClick={(e) => { e.stopPropagation(); onMoveAsset(asset.id, f.id); setMenuData(null); }}
                                    className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] text-gray-300 hover:bg-white/5 text-left w-full truncate"
                                >
                                    <Folder size={8} className="text-yellow-600"/> {f.name}
                                </button>
                            ))}
                        </div>

                        <div className="h-px bg-white/10 my-0.5 mx-2"></div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteAsset(asset.id); setMenuData(null); }}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] text-red-400 hover:bg-red-500/10 text-left font-medium"
                        >
                            <Trash2 size={10} /> Delete
                        </button>
                    </>
                )
            })()}
        </div>
      )}
    </>
  );
};

export default RightSidebar;