import React, { useState, useEffect, useRef } from 'react';
import { Plus, Menu, ZoomIn, ZoomOut, Search, Share2, X, Users, ArrowRight } from 'lucide-react';
import RightSidebar from './components/RightSidebar';
import ContextPanel from './components/ContextPanel';
import BackgroundRemover from './components/BackgroundRemover';
import CropModal from './components/CropModal';
import CanvasItem from './components/CanvasItem';
import { Asset, PlacedAsset, LayerGroup, Position, AssetFolder } from './types';

// Initial data - Empty as requested
const INITIAL_ASSETS: Asset[] = [];

const INITIAL_GROUPS: LayerGroup[] = [
  { id: 'g1', name: 'Base Room', isVisible: true, isLocked: false },
];

function App() {
  // --- State ---
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  
  // Data
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [placedItems, setPlacedItems] = useState<PlacedAsset[]>([]);
  const [groups, setGroups] = useState<LayerGroup[]>(INITIAL_GROUPS);
  
  // UI State
  const [activeGroupId, setActiveGroupId] = useState<string>('g1');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  // Modals & Editing Context
  // 'context' helps us know if we are editing a fresh upload or an existing item on canvas
  const [editingContext, setEditingContext] = useState<{ type: 'upload' | 'canvas', targetId?: string } | null>(null);
  const [imageToProcess, setImageToProcess] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null); 
  const [pendingUploadName, setPendingUploadName] = useState<string>('New Asset');
  const [pendingFolderId, setPendingFolderId] = useState<string | undefined>(undefined); 
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // Viewport State (Camera)
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Interaction State
  const [interactionState, setInteractionState] = useState<{
    type: 'idle' | 'dragging' | 'resizing';
    itemId: string | null;
    startPos: Position; // Mouse start position (Screen)
    initialItemPos: Position; // Item pos at start (World)
    initialItemSize: { width: number, height: number }; 
  }>({
    type: 'idle',
    itemId: null,
    startPos: { x: 0, y: 0 },
    initialItemPos: { x: 0, y: 0 },
    initialItemSize: { width: 0, height: 0 }
  });
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---

  // Convert Screen Coordinates (Mouse Event) to World Coordinates (Canvas)
  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - viewport.x) / viewport.scale,
      y: (screenY - viewport.y) / viewport.scale
    };
  };

  const handleCreateRoom = () => {
    const id = Math.random().toString(36).substring(7);
    setRoomId(id);
    setViewport({ 
        x: window.innerWidth / 2 - 200, 
        y: window.innerHeight / 2 - 200, 
        scale: 1 
    });
  };

  const handleJoinRoom = () => {
      if (joinCodeInput.trim().length > 0) {
          setRoomId(joinCodeInput.trim());
          setViewport({ 
            x: window.innerWidth / 2 - 200, 
            y: window.innerHeight / 2 - 200, 
            scale: 1 
          });
      }
  };

  // Handles adding the final asset to the library
  // AND updating the canvas item if we were editing one
  const handleSaveEditedAsset = (url: string) => {
     const img = new Image();
     img.onload = () => {
        const newAssetId = Math.random().toString(36).substring(7);
        const newAsset: Asset = {
            id: newAssetId,
            url,
            name: pendingUploadName,
            type: 'image',
            folderId: pendingFolderId,
            originalWidth: img.width,
            originalHeight: img.height
        };

        setAssets(prev => [newAsset, ...prev]);

        // If we were editing a placed item, update it to use the new asset
        if (editingContext?.type === 'canvas' && editingContext.targetId) {
            setPlacedItems(prev => prev.map(item => {
                if (item.id === editingContext.targetId) {
                    return {
                        ...item,
                        assetId: newAssetId,
                        size: { width: img.width, height: img.height } // Update size to match new crop
                    };
                }
                return item;
            }));
        } else {
            // If it was an upload, open sidebar to show it
            setIsSidebarOpen(true);
        }

        // Cleanup
        setImageToProcess(null);
        setImageToCrop(null);
        setEditingContext(null);
        setPendingFolderId(undefined);
     };
     img.src = url;
  };

  const handleAddAsset = (url: string, name: string, folderId?: string, isVideo: boolean = false) => {
    if (isVideo) {
        // Create a temporary video element to get dimensions
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            const newAsset: Asset = {
                id: Math.random().toString(36).substring(7),
                url,
                name,
                type: 'video',
                folderId,
                originalWidth: video.videoWidth || 300,
                originalHeight: video.videoHeight || 300
            };
            setAssets(prev => [newAsset, ...prev]);
        };
        video.src = url;
    } else {
        const img = new Image();
        img.onload = () => {
          const newAsset: Asset = {
            id: Math.random().toString(36).substring(7),
            url,
            name,
            type: 'image',
            folderId,
            originalWidth: img.width,
            originalHeight: img.height
          };
          setAssets(prev => [newAsset, ...prev]);
        };
        img.src = url;
    }
  };

  const handlePlaceAsset = (asset: Asset) => {
    const activeGroup = groups.find(g => g.id === activeGroupId);
    if (!activeGroup || activeGroup.isLocked || !activeGroup.isVisible) {
      alert("Select an unlocked build to place items.");
      return;
    }

    const centerScreenX = window.innerWidth / 2;
    const centerScreenY = window.innerHeight / 2;
    const worldPos = screenToWorld(centerScreenX, centerScreenY);
    
    const groupItems = placedItems.filter(i => i.groupId === activeGroupId);
    const maxZ = groupItems.length > 0 ? Math.max(...groupItems.map(i => i.zIndex)) : 0;

    // --- Smart Resizing Logic ---
    let width = asset.originalWidth;
    let height = asset.originalHeight;

    // 1. Cap huge images (e.g. photos from phone)
    const MAX_DIMENSION = 400; 
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    } 
    // 2. Scale up tiny pixel art so it's visible initially
    else if (width < 64 && height < 64) {
        width *= 4;
        height *= 4;
    }
    else if (width < 128 && height < 128) {
        width *= 2;
        height *= 2;
    }

    const newItem: PlacedAsset = {
      id: Math.random().toString(36).substring(7),
      assetId: asset.id,
      groupId: activeGroupId,
      name: asset.name, 
      position: { 
          x: Math.round(worldPos.x - width / 2), 
          y: Math.round(worldPos.y - height / 2) 
      },
      size: { width, height },
      zIndex: maxZ + 1,
      flipX: false,
      rotation: 0
    };
    setPlacedItems(prev => [...prev, newItem]);
    setSelectedItemId(newItem.id);
    if (window.innerWidth < 768 && window.innerHeight > window.innerWidth) setIsSidebarOpen(false); // Only close on portrait
  };

  // --- Asset Management ---
  const deleteAsset = (assetId: string) => {
      // confirm is sometimes blocked by browsers or feels clunky, simple check is mostly enough for this tool
      if(window.confirm("Delete this asset permanently? This will remove it from the canvas too.")) {
          setAssets(prev => prev.filter(a => a.id !== assetId));
          setPlacedItems(prev => prev.filter(p => p.assetId !== assetId));
      }
  };

  const renameAsset = (assetId: string, newName: string) => {
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, name: newName } : a));
  };

  const moveAsset = (assetId: string, folderId: string | undefined) => {
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, folderId } : a));
  };

  // --- Layer Management ---
  const handleRenamePlacedItem = (itemId: string, newName: string) => {
      setPlacedItems(prev => prev.map(i => i.id === itemId ? { ...i, name: newName } : i));
  };

  const handleReorderPlacedItems = (groupId: string, reorderedIds: string[]) => {
      setPlacedItems(prev => {
          const groupItems = prev.filter(i => i.groupId === groupId);
          const otherItems = prev.filter(i => i.groupId !== groupId);
          
          const updatedGroupItems = groupItems.map(item => {
              const index = reorderedIds.indexOf(item.id);
              if (index === -1) return item; 
              return { ...item, zIndex: reorderedIds.length - index }; 
          });

          return [...otherItems, ...updatedGroupItems];
      });
  };

  const toggleItemLock = (itemId: string) => {
      setPlacedItems(prev => prev.map(i => i.id === itemId ? { ...i, isLocked: !i.isLocked } : i));
  };

  // --- Input Handlers ---

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (interactionState.type !== 'idle') return;
    
    setIsPanning(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
    setSelectedItemId(null);
  };

  const handleItemMouseDown = (e: React.MouseEvent, itemId: string, type: 'drag' | 'resize') => {
    e.stopPropagation(); 
    
    const item = placedItems.find(i => i.id === itemId);
    if (!item || item.isLocked) return; // Prevent interaction if locked

    const group = groups.find(g => g.id === item.groupId);
    if (group?.isLocked) return;

    setSelectedItemId(itemId);
    setActiveGroupId(item.groupId);

    setInteractionState({
      type: type === 'drag' ? 'dragging' : 'resizing',
      itemId,
      startPos: { x: e.clientX, y: e.clientY },
      initialItemPos: { ...item.position },
      initialItemSize: { ...item.size }
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (interactionState.type !== 'idle' && interactionState.itemId) {
      const dx = (e.clientX - interactionState.startPos.x) / viewport.scale;
      const dy = (e.clientY - interactionState.startPos.y) / viewport.scale;

      setPlacedItems(prev => prev.map(item => {
        if (item.id !== interactionState.itemId) return item;

        if (interactionState.type === 'dragging') {
          // Round to nearest integer to prevent sub-pixel rendering blurring and artifacts
          const newX = Math.round(interactionState.initialItemPos.x + dx);
          const newY = Math.round(interactionState.initialItemPos.y + dy);
          return { ...item, position: { x: newX, y: newY } };
        } 
        
        if (interactionState.type === 'resizing') {
          // Calculate new Width first based on mouse delta, rounded
          let newWidth = Math.round(Math.max(16, interactionState.initialItemSize.width + dx));
          
          // Enforce Aspect Ratio, result rounded
          const aspectRatio = interactionState.initialItemSize.width / interactionState.initialItemSize.height;
          let newHeight = Math.round(newWidth / aspectRatio);

          return { ...item, size: { width: newWidth, height: newHeight } };
        }
        return item;
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setInteractionState(prev => ({ ...prev, type: 'idle', itemId: null }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    const scaleFactor = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.1, Math.min(5, viewport.scale + direction * scaleFactor));
    
    setViewport(prev => ({
        ...prev,
        scale: newScale
    }));
  };

  // --- Render ---

  if (!roomId) {
    return (
      <div className="min-h-screen bg-[#1a1b26] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#1f2937] p-8 rounded-2xl shadow-2xl border border-gray-700 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="flex justify-center mb-6">
             <div className="w-16 h-16 bg-indigo-600 rounded-2xl rotate-3 flex items-center justify-center shadow-lg shadow-indigo-500/50">
               <Plus className="text-white w-8 h-8" />
             </div>
          </div>
          <h1 className="text-4xl font-pixel text-white mb-2 tracking-wide">PixelNest</h1>
          <p className="text-gray-400 mb-8 text-sm">Collaborative RPG Home Designer<br/>for Couples</p>
          
          {!showJoinInput ? (
            <div className="space-y-3">
                <button onClick={handleCreateRoom} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 group">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    Create New Room
                </button>
                <button onClick={() => setShowJoinInput(true)} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-lg transition-all border border-white/10 flex items-center justify-center gap-2">
                    <Users size={20} />
                    Join Room
                </button>
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4">
                <div className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1">Enter Room Code</div>
                <div className="flex gap-2">
                    <input 
                        autoFocus
                        value={joinCodeInput} 
                        onChange={(e) => setJoinCodeInput(e.target.value)}
                        className="flex-1 bg-black/30 border border-indigo-500/30 rounded-xl px-4 text-white outline-none focus:border-indigo-500 transition-colors font-mono text-lg"
                        placeholder="e.g. x7k9p2"
                    />
                    <button 
                        onClick={handleJoinRoom}
                        disabled={!joinCodeInput}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowRight size={24} />
                    </button>
                </div>
                <button onClick={() => setShowJoinInput(false)} className="text-sm text-gray-500 hover:text-white underline decoration-dotted">
                    Back
                </button>
                <p className="text-[10px] text-gray-600 mt-2">Max 2 players allowed per room.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedItem = placedItems.find(i => i.id === selectedItemId) || null;
  const selectedAsset = selectedItem ? assets.find(a => a.id === selectedItem.assetId) || null : null;

  return (
    <div 
      className="h-screen w-screen overflow-hidden bg-[#15161e] relative select-none flex"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      {/* 1. Minimized Zoom Controls (Floating) */}
      <div className="fixed bottom-5 left-5 z-50 flex flex-col items-start gap-2 pointer-events-auto">
         {isZoomOpen && (
             <div className="bg-[#1f2937]/90 backdrop-blur p-1.5 rounded-xl border border-white/10 shadow-2xl flex flex-col gap-1 animate-in slide-in-from-bottom-5 fade-in duration-200">
                <button 
                    onClick={() => setViewport(prev => ({ ...prev, scale: Math.min(5, prev.scale + 0.2) }))}
                    className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
                >
                    <ZoomIn size={18} />
                </button>
                <span className="text-[10px] text-center font-mono text-gray-400 py-1 border-y border-white/5 bg-black/20 rounded-sm">
                    {Math.round(viewport.scale * 100)}%
                </span>
                <button 
                    onClick={() => setViewport(prev => ({ ...prev, scale: Math.max(0.2, prev.scale - 0.2) }))}
                    className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
                >
                    <ZoomOut size={18} />
                </button>
             </div>
         )}
         <button 
           onClick={() => setIsZoomOpen(!isZoomOpen)}
           className={`p-3 rounded-full border border-white/10 shadow-xl text-white transition-all active:scale-95 ${isZoomOpen ? 'bg-indigo-600 shadow-indigo-500/30' : 'bg-[#1f2937]/90 backdrop-blur hover:bg-white/10'}`}
         >
           <Search size={20} />
         </button>
      </div>

      {/* 2. Compact Top Bar */}
      <div className="fixed top-4 left-4 right-4 z-40 flex justify-between items-start pointer-events-none safe-area-top">
         <div className="pointer-events-auto flex items-center gap-2">
             <div className="bg-[#1f2937]/90 backdrop-blur border border-white/10 pl-3 pr-2 py-1.5 rounded-full shadow-lg flex items-center gap-2 transition-all">
                <span className="text-white font-pixel text-sm tracking-wide">Room: <span className="text-indigo-400 select-text">{roomId}</span></span>
                <div className="w-px h-3 bg-white/20"></div>
                <button 
                    onClick={() => {
                        navigator.clipboard.writeText(roomId || "");
                        alert("Room Code copied: " + roomId);
                    }} 
                    className="p-1.5 bg-white/5 hover:bg-indigo-500 rounded-full text-white transition-colors"
                    title="Copy Room Code"
                >
                    <Share2 size={12} />
                </button>
             </div>
         </div>
         
         {!isSidebarOpen && (
           <button 
              onClick={() => setIsSidebarOpen(true)}
              className="pointer-events-auto bg-[#1f2937]/90 backdrop-blur text-white p-2.5 rounded-full border border-white/10 shadow-lg hover:bg-white/10 transition-all active:scale-95"
           >
              <Menu size={20} />
           </button>
         )}
      </div>

      {/* 3. Left Context Panel (Toolbar) */}
      <ContextPanel 
        selectedItem={selectedItem}
        selectedAsset={selectedAsset}
        onUpdateItem={(updates) => {
            if (selectedItemId) {
                setPlacedItems(prev => prev.map(i => i.id === selectedItemId ? { ...i, ...updates } : i));
            }
        }}
        onDelete={() => {
          setPlacedItems(prev => prev.filter(i => i.id !== selectedItemId));
          setSelectedItemId(null);
        }}
        onDuplicate={() => {
           if(selectedItem) {
             const copy = {
                 ...selectedItem, 
                 id: Math.random().toString(), 
                 position: {x: selectedItem.position.x + 20, y: selectedItem.position.y + 20}
             };
             setPlacedItems(prev => [...prev, copy]);
             setSelectedItemId(copy.id);
           }
        }}
        onRemoveBackground={() => {
          if (selectedAsset && selectedItem && selectedAsset.type === 'image') {
              setPendingUploadName(selectedAsset.name + " (Clean)");
              setImageToProcess(selectedAsset.url);
              setPendingFolderId(selectedAsset.folderId);
              setEditingContext({ type: 'canvas', targetId: selectedItem.id });
          } else if (selectedAsset?.type === 'video') {
              alert("For videos, use the Overlay Mode in the Adjustments tab to remove backgrounds.");
          }
        }}
        onCrop={() => {
            if (selectedAsset && selectedItem && selectedAsset.type === 'image') {
                setPendingUploadName(selectedAsset.name + " (Cropped)");
                setImageToCrop(selectedAsset.url);
                setPendingFolderId(selectedAsset.folderId);
                setEditingContext({ type: 'canvas', targetId: selectedItem.id });
            }
        }}
        onRenameItem={(newName) => {
             if (selectedItemId) {
                 handleRenamePlacedItem(selectedItemId, newName);
             }
        }}
      />

      {/* 4. Main Canvas Area */}
      <div 
        className="absolute inset-0 overflow-hidden bg-[#15161e] cursor-move active:cursor-grabbing" 
        ref={canvasRef} 
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        // Touch Panning
        onTouchStart={(e) => {
            if(e.target === canvasRef.current || e.target === e.currentTarget) {
                if(e.touches.length === 1) {
                    setIsPanning(true);
                    setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                    setSelectedItemId(null); 
                }
            }
        }}
        onTouchMove={(e) => {
             if (isPanning && e.touches.length === 1) {
                 const dx = e.touches[0].clientX - lastMousePos.x;
                 const dy = e.touches[0].clientY - lastMousePos.y;
                 setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
                 setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
             }
        }}
      >
         {/* Grid Background */}
         <div 
            className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" 
            style={{
                backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                backgroundSize: `${32 * viewport.scale}px ${32 * viewport.scale}px`
            }}
         />

         {/* World Container */}
         <div 
            style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                transformOrigin: '0 0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
            }}
         >
            {groups.filter(g => g.isVisible).map(group => (
            <React.Fragment key={group.id}>
                {placedItems
                    .filter(item => item.groupId === group.id)
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map(item => {
                    const asset = assets.find(a => a.id === item.assetId);
                    if (!asset) return null;
                    return (
                        <div key={item.id} className="pointer-events-auto"> 
                            <CanvasItem 
                                item={item}
                                asset={asset}
                                isSelected={selectedItemId === item.id}
                                onMouseDown={(e, type) => handleItemMouseDown(e, item.id, type)}
                            />
                        </div>
                    );
                    })}
            </React.Fragment>
            ))}
         </div>
      </div>

      {/* 5. Right Sidebar (Slide Out) */}
      <RightSidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        assets={assets}
        folders={folders}
        groups={groups}
        placedItems={placedItems}
        activeGroupId={activeGroupId}
        onAddGroup={(name) => {
            const newGroup = { id: Math.random().toString(), name, isVisible: true, isLocked: false };
            setGroups(prev => [...prev, newGroup]);
            setActiveGroupId(newGroup.id);
        }}
        onToggleGroupVisibility={(id) => setGroups(prev => prev.map(g => g.id === id ? { ...g, isVisible: !g.isVisible } : g))}
        onToggleGroupLock={(id) => setGroups(prev => prev.map(g => g.id === id ? { ...g, isLocked: !g.isLocked } : g))}
        onDeleteGroup={(id) => setGroups(prev => prev.filter(g => g.id !== id))}
        onSetActiveGroup={setActiveGroupId}
        onPlaceAsset={handlePlaceAsset}
        onAddAsset={handleAddAsset}
        onCreateFolder={(name) => setFolders(prev => [...prev, { id: Math.random().toString(), name }])}
        onRequestProcessing={(url) => {
            setEditingContext({ type: 'upload' });
            setImageToProcess(url);
        }}
        onDeleteAsset={deleteAsset}
        onRenameAsset={renameAsset}
        onMoveAsset={moveAsset}
        onSelectPlacedItem={setSelectedItemId}
        selectedItemId={selectedItemId}
        onRenamePlacedItem={handleRenamePlacedItem}
        onReorderPlacedItems={handleReorderPlacedItems}
        onToggleItemLock={toggleItemLock}
      />

      {/* Modals */}
      {imageToProcess && (
        <BackgroundRemover 
          imageSrc={imageToProcess}
          onCancel={() => {
              setImageToProcess(null);
              setEditingContext(null);
          }}
          onConfirm={(newSrc) => handleSaveEditedAsset(newSrc)}
        />
      )}

      {imageToCrop && (
        <CropModal
            imageSrc={imageToCrop}
            onCancel={() => {
                setImageToCrop(null);
                setEditingContext(null);
            }}
            onConfirm={(newSrc) => handleSaveEditedAsset(newSrc)}
        />
      )}
    </div>
  );
}

export default App;