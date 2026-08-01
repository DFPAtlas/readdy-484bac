export interface Rack {
  id: string;
  code: string;
  label: string;
  row: number;
  section: number;
  totalShelves: number;
  maxLoadKg: number;
  currentLoadKg: number;
  createdAt: string;
  updatedAt: string;
}

export interface Container {
  id: string;
  code: string;
  label: string;
  rackId: string;
  rackCode: string;
  shelf: number;
  position: number;
  category: string;
  status: 'empty' | 'partial' | 'full' | 'catalogued' | 'sealed';
  description: string;
  dimensions: { width: number; height: number; depth: number; unit: 'cm' };
  maxLoadKg: number;
  currentLoadKg: number;
  photoUrl: string;
  qrCode: string;
  cataloguedAt: string | null;
  cataloguedBy: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  parentContainerId?: string;
}

export interface ItemPhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  type: 'overview' | 'closeup' | 'label' | 'receipt' | 'damage' | 'packaging' | 'other';
  caption: string;
  isPrimary: boolean;
  width: number;
  height: number;
  fileSize: number;
  blurScore: number;
  darknessScore: number;
  duplicateScore: number;
  hasGlare: boolean;
  ocrText: string | null;
  aiTags: string[];
  createdAt: string;
}

export interface ItemReceipt {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  retailer: string;
  purchaseDate: string;
  price: number;
  currency: string;
  orderReference: string;
  warrantyPeriodMonths: number | null;
  warrantyExpiryDate: string | null;
  ocrConfidence: number;
  linkedItemIds: string[];
  createdAt: string;
}

export interface ItemMovement {
  id: string;
  itemId: string;
  type: 'added' | 'moved' | 'removed' | 'loaned' | 'returned' | 'sold' | 'donated' | 'disposed' | 'missing' | 'found' | 'verified' | 'edited';
  fromContainerId: string | null;
  fromContainerCode: string | null;
  toContainerId: string | null;
  toContainerCode: string | null;
  loanedTo: string | null;
  loanExpectedReturn: string | null;
  notes: string;
  performedBy: string;
  createdAt: string;
}

export interface StorageWarning {
  type: 'battery' | 'aerosol' | 'paint' | 'gas_canister' | 'medicine' | 'flammable' | 'valuable_document' | 'electronics' | 'temperature_sensitive' | 'chemical';
  severity: 'low' | 'medium' | 'high' | 'severe';
  message: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

export interface AiSuggestion {
  id: string;
  itemId: string;
  field: string;
  proposedValue: string;
  confidence: number;
  status: 'pending' | 'confirmed' | 'edited' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  quantity: number;
  unitType: 'single' | 'set' | 'pair' | 'box' | 'bag' | 'bundle';
  dimensions: { width: number; height: number; depth: number; unit: 'cm' } | null;
  estimatedWeightKg: number | null;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor' | 'damaged' | 'for_parts';
  estimatedValue: number | null;
  currency: string;
  purchaseDate: string | null;
  purchasePrice: number | null;
  warrantyExpiry: string | null;
  status: 'in_storage' | 'removed' | 'on_loan' | 'sold' | 'donated' | 'disposed' | 'missing';
  decisionStatus: 'keep' | 'sell' | 'donate' | 'dispose' | 'unsure' | null;
  containerId: string | null;
  containerCode: string | null;
  rackId: string | null;
  rackCode: string | null;
  shelf: number | null;
  position: number | null;
  isImportant: boolean;
  isSentimental: boolean;
  isSeasonal: boolean;
  isFragile: boolean;
  parentItemId: string | null;
  childItemIds: string[];
  photos: ItemPhoto[];
  receipts: ItemReceipt[];
  movements: ItemMovement[];
  storageWarnings: StorageWarning[];
  aiSuggestions: AiSuggestion[];
  aiReviewStatus: 'none' | 'pending' | 'partial' | 'reviewed';
  lastVerifiedAt: string | null;
  lastCheckedAt: string | null;
  addedBy: string;
  ownedBy: string;
  searchableText: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  parentId: string | null;
  itemCount: number;
}

export interface SavedView {
  id: string;
  name: string;
  icon: string;
  filters: ItemFilters;
  sort: ItemSort;
  viewMode: 'gallery' | 'list' | 'table';
  isDefault: boolean;
}

export interface ItemFilters {
  search: string;
  category: string[];
  containerId: string[];
  rackId: string[];
  status: string[];
  decisionStatus: string[];
  condition: string[];
  valueMin: number | null;
  valueMax: number | null;
  dateAddedFrom: string | null;
  dateAddedTo: string | null;
  aiReviewState: string | null;
  isImportant: boolean | null;
  isSentimental: boolean | null;
  isSeasonal: boolean | null;
  isFragile: boolean | null;
  missingOnly: boolean;
}

export interface ItemSort {
  field: 'recently_added' | 'name' | 'location' | 'value' | 'last_checked' | 'oldest_unverified';
  direction: 'asc' | 'desc';
}

export interface BatchCatalogueSession {
  id: string;
  containerId: string;
  containerCode: string;
  status: 'draft' | 'reviewing' | 'confirmed';
  draftItems: ItemDraft[];
  photos: { id: string; url: string; thumbnailUrl: string; groupedItemIndex: number | null }[];
  startedAt: string;
  completedAt: string | null;
  completedBy: string | null;
}

export interface ItemDraft {
  id: string;
  name: string;
  description: string;
  quantity: number;
  category: string;
  condition: string;
  photoIndices: number[];
  voiceNoteUrl: string | null;
  aiSuggestedName: string | null;
  aiConfidence: number | null;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  avatarUrl: string;
  isActive: boolean;
  invitationAccepted: boolean;
  invitationExpiry: string | null;
  lastActiveAt: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resourceType: 'item' | 'container' | 'rack' | 'user' | 'setting';
  resourceId: string;
  resourceName: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface AuditSession {
  id: string;
  containerId: string;
  containerCode: string;
  status: 'pending' | 'in_progress' | 'paused' | 'completed';
  startedBy: string;
  startedAt: string;
  completedAt: string | null;
  expectedItemIds: string[];
  foundItemIds: string[];
  missingItemIds: string[];
  differences: { itemId: string; itemName: string; issue: string; resolved: boolean }[];
  notes: string;
}

export type ViewMode = 'gallery' | 'list' | 'table';

export interface ClearOutBatch {
  id: string;
  type: 'sell' | 'donate' | 'dispose';
  itemIds: string[];
  status: 'pending' | 'in_progress' | 'completed';
  notes: string;
  totalValue: number;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
}