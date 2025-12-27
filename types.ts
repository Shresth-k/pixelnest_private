export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface LayerGroup {
  id: string;
  name: string;
  isVisible: boolean;
  isLocked: boolean;
}

export interface ImageFilters {
  brightness: number; // 100 is default
  contrast: number;   // 100 is default
  saturation: number; // 100 is default
  blur: number;       // 0 is default
}

export interface PlacedAsset {
  id: string;
  assetId: string;
  groupId: string; // The build/section this item belongs to
  name: string;    // Custom name for the layer
  position: Position;
  size: Size;
  zIndex: number;
  flipX: boolean;
  rotation: number;
  isLocked?: boolean; // New: Lock individual item
  filters?: ImageFilters; // New: visual adjustments
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay'; // New: For video/gif transparency
  shadow?: number; // New: Drop shadow blur radius (0 = none)
}

export interface AssetFolder {
  id: string;
  name: string;
}

export interface Asset {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video'; // New: Support video/gif
  folderId?: string; // Optional folder association
  originalWidth: number;
  originalHeight: number;
  isGenerated?: boolean;
}

export interface RoomState {
  id: string;
  name: string;
  assets: Asset[];
  placedItems: PlacedAsset[];
  groups: LayerGroup[];
}

export enum Tool {
  SELECT = 'SELECT',
  MOVE = 'MOVE',
  ERASE = 'ERASE',
  PLACE = 'PLACE',
  HAND = 'HAND' // For panning
}