import { Rack, Container, Item, ItemPhoto, ItemMovement, CategoryDefinition, SavedView, UserProfile, ActivityLog, ItemReceipt, StorageWarning } from './types';

const mockUser: UserProfile = {
  id: 'u1',
  email: 'owner@loftlog.demo',
  displayName: 'Alex Morgan',
  role: 'owner',
  avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20headshot%20portrait%20of%20a%20person%20in%20their%2030s%20with%20a%20friendly%20confident%20expression%20warm%20lighting%20simple%20plain%20background%20studio%20quality&width=200&height=200&seq=1&orientation=squarish',
  isActive: true,
  invitationAccepted: true,
  invitationExpiry: null,
  lastActiveAt: '2026-01-15T09:30:00Z',
  createdAt: '2025-06-01T00:00:00Z',
};

export const mockUsers: UserProfile[] = [
  mockUser,
  {
    id: 'u2',
    email: 'sam@loftlog.demo',
    displayName: 'Sam Taylor',
    role: 'editor',
    avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20headshot%20portrait%20of%20a%20person%20in%20their%20late%2020s%20neutral%20expression%20simple%20background%20studio%20lighting&width=200&height=200&seq=2&orientation=squarish',
    isActive: true,
    invitationAccepted: true,
    invitationExpiry: null,
    lastActiveAt: '2026-01-14T16:00:00Z',
    createdAt: '2025-08-15T00:00:00Z',
  },
  {
    id: 'u3',
    email: 'jordan@loftlog.demo',
    displayName: 'Jordan Lee',
    role: 'viewer',
    avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20headshot%20portrait%20of%20a%20person%20in%20their%20early%2030s%20smiling%20warm%20lighting%20simple%20background&width=200&height=200&seq=3&orientation=squarish',
    isActive: true,
    invitationAccepted: true,
    invitationExpiry: null,
    lastActiveAt: '2026-01-10T11:00:00Z',
    createdAt: '2025-10-01T00:00:00Z',
  },
];

export const mockRacks: Rack[] = [
  { id: 'r1', code: 'L-R01', label: 'Rack 1 - Left Wall', row: 1, section: 1, totalShelves: 5, maxLoadKg: 500, currentLoadKg: 320, createdAt: '2025-06-10T00:00:00Z', updatedAt: '2025-12-01T00:00:00Z' },
  { id: 'r2', code: 'L-R02', label: 'Rack 2 - Back Wall Left', row: 1, section: 2, totalShelves: 5, maxLoadKg: 500, currentLoadKg: 410, createdAt: '2025-06-10T00:00:00Z', updatedAt: '2025-12-20T00:00:00Z' },
  { id: 'r3', code: 'L-R03', label: 'Rack 3 - Back Wall Right', row: 1, section: 3, totalShelves: 5, maxLoadKg: 500, currentLoadKg: 185, createdAt: '2025-06-10T00:00:00Z', updatedAt: '2025-11-15T00:00:00Z' },
  { id: 'r4', code: 'L-R04', label: 'Rack 4 - Right Wall', row: 2, section: 1, totalShelves: 4, maxLoadKg: 400, currentLoadKg: 250, createdAt: '2025-06-10T00:00:00Z', updatedAt: '2025-10-20T00:00:00Z' },
];

export const mockContainers: Container[] = [
  { id: 'c1', code: 'L-R01-S03-B01', label: 'Christmas Decorations', rackId: 'r1', rackCode: 'L-R01', shelf: 3, position: 1, category: 'Christmas', status: 'catalogued', description: 'Tree ornaments, lights, and garlands', dimensions: { width: 60, height: 40, depth: 40, unit: 'cm' }, maxLoadKg: 25, currentLoadKg: 12, photoUrl: '', qrCode: '', cataloguedAt: '2025-11-01T00:00:00Z', cataloguedBy: 'Alex Morgan', lastCheckedAt: '2025-12-15T00:00:00Z', createdAt: '2025-06-15T00:00:00Z', updatedAt: '2025-12-15T00:00:00Z' },
  { id: 'c2', code: 'L-R01-S02-B01', label: 'Power Tools', rackId: 'r1', rackCode: 'L-R01', shelf: 2, position: 1, category: 'Tools', status: 'catalogued', description: 'Drills, saws, sanders', dimensions: { width: 55, height: 45, depth: 35, unit: 'cm' }, maxLoadKg: 30, currentLoadKg: 18, photoUrl: '', qrCode: '', cataloguedAt: '2025-09-20T00:00:00Z', cataloguedBy: 'Alex Morgan', lastCheckedAt: '2025-11-10T00:00:00Z', createdAt: '2025-06-15T00:00:00Z', updatedAt: '2025-11-10T00:00:00Z' },
  { id: 'c3', code: 'L-R02-S02-B02', label: 'Camping Gear', rackId: 'r2', rackCode: 'L-R02', shelf: 2, position: 2, category: 'Camping', status: 'partial', description: 'Tent, sleeping bags, stove', dimensions: { width: 70, height: 50, depth: 45, unit: 'cm' }, maxLoadKg: 20, currentLoadKg: 14, photoUrl: '', qrCode: '', cataloguedAt: null, cataloguedBy: null, lastCheckedAt: '2025-10-05T00:00:00Z', createdAt: '2025-07-01T00:00:00Z', updatedAt: '2025-10-05T00:00:00Z' },
  { id: 'c4', code: 'L-R02-S04-B01', label: 'Documents - Personal', rackId: 'r2', rackCode: 'L-R02', shelf: 4, position: 1, category: 'Documents', status: 'catalogued', description: 'Birth certificates, passports, tax records', dimensions: { width: 40, height: 30, depth: 30, unit: 'cm' }, maxLoadKg: 10, currentLoadKg: 5, photoUrl: '', qrCode: '', cataloguedAt: '2025-08-01T00:00:00Z', cataloguedBy: 'Alex Morgan', lastCheckedAt: '2025-12-01T00:00:00Z', createdAt: '2025-07-10T00:00:00Z', updatedAt: '2025-12-01T00:00:00Z' },
  { id: 'c5', code: 'L-R03-S01-B03', label: 'Electrical Supplies', rackId: 'r3', rackCode: 'L-R03', shelf: 1, position: 3, category: 'Electrical', status: 'catalogued', description: 'Cables, adapters, extension leads', dimensions: { width: 50, height: 35, depth: 35, unit: 'cm' }, maxLoadKg: 15, currentLoadKg: 8, photoUrl: '', qrCode: '', cataloguedAt: '2025-09-01T00:00:00Z', cataloguedBy: 'Alex Morgan', lastCheckedAt: '2025-11-20T00:00:00Z', createdAt: '2025-08-05T00:00:00Z', updatedAt: '2025-11-20T00:00:00Z' },
  { id: 'c6', code: 'L-R04-S02-B01', label: 'Clothing - Winter', rackId: 'r4', rackCode: 'L-R04', shelf: 2, position: 1, category: 'Clothing', status: 'full', description: 'Coats, boots, scarves', dimensions: { width: 65, height: 45, depth: 40, unit: 'cm' }, maxLoadKg: 15, currentLoadKg: 12, photoUrl: '', qrCode: '', cataloguedAt: null, cataloguedBy: null, lastCheckedAt: '2025-10-01T00:00:00Z', createdAt: '2025-08-20T00:00:00Z', updatedAt: '2025-10-01T00:00:00Z' },
  { id: 'c7', code: 'L-R02-S03-B04', label: 'Keepsakes Box', rackId: 'r2', rackCode: 'L-R02', shelf: 3, position: 4, category: 'Keepsakes', status: 'catalogued', description: 'Family photos, letters, mementos', dimensions: { width: 35, height: 30, depth: 25, unit: 'cm' }, maxLoadKg: 8, currentLoadKg: 4, photoUrl: '', qrCode: '', cataloguedAt: '2025-07-15T00:00:00Z', cataloguedBy: 'Alex Morgan', lastCheckedAt: '2025-11-01T00:00:00Z', createdAt: '2025-07-15T00:00:00Z', updatedAt: '2025-11-01T00:00:00Z' },
  { id: 'c8', code: 'L-R01-S04-B02', label: 'Spare Parts', rackId: 'r1', rackCode: 'L-R01', shelf: 4, position: 2, category: 'Spare Parts', status: 'partial', description: 'Screws, bolts, washers, brackets', dimensions: { width: 40, height: 25, depth: 30, unit: 'cm' }, maxLoadKg: 20, currentLoadKg: 15, photoUrl: '', qrCode: '', cataloguedAt: null, cataloguedBy: null, lastCheckedAt: '2025-09-15T00:00:00Z', createdAt: '2025-08-01T00:00:00Z', updatedAt: '2025-09-15T00:00:00Z' },
  { id: 'c9', code: 'L-R03-S03-B01', label: 'Paint and Decorating', rackId: 'r3', rackCode: 'L-R03', shelf: 3, position: 1, category: 'Household', status: 'catalogued', description: 'Paint tins, brushes, rollers', dimensions: { width: 50, height: 40, depth: 40, unit: 'cm' }, maxLoadKg: 30, currentLoadKg: 22, photoUrl: '', qrCode: '', cataloguedAt: '2025-10-01T00:00:00Z', cataloguedBy: 'Alex Morgan', lastCheckedAt: '2025-12-10T00:00:00Z', createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-12-10T00:00:00Z' },
  { id: 'c10', code: 'L-R04-S03-B02', label: 'Garden Tools', rackId: 'r4', rackCode: 'L-R04', shelf: 3, position: 2, category: 'Garden', status: 'partial', description: 'Hand tools, gloves, seeds', dimensions: { width: 55, height: 40, depth: 35, unit: 'cm' }, maxLoadKg: 15, currentLoadKg: 10, photoUrl: '', qrCode: '', cataloguedAt: null, cataloguedBy: null, lastCheckedAt: '2025-08-01T00:00:00Z', createdAt: '2025-08-15T00:00:00Z', updatedAt: '2025-08-01T00:00:00Z' },
];

function makePhoto(partial: Partial<ItemPhoto>): ItemPhoto {
  return {
    id: partial.id || 'ph-' + Math.random().toString(36).slice(2, 8),
    url: partial.url || '',
    thumbnailUrl: partial.thumbnailUrl || '',
    type: partial.type || 'overview',
    caption: partial.caption || '',
    isPrimary: partial.isPrimary || false,
    width: partial.width || 1200,
    height: partial.height || 800,
    fileSize: partial.fileSize || 500000,
    blurScore: partial.blurScore || 0.1,
    darknessScore: partial.darknessScore || 0.15,
    duplicateScore: partial.duplicateScore || 0,
    hasGlare: partial.hasGlare || false,
    ocrText: partial.ocrText || null,
    aiTags: partial.aiTags || [],
    createdAt: partial.createdAt || '2025-06-01T00:00:00Z',
  };
}

function makeMovement(partial: Partial<ItemMovement>): ItemMovement {
  return {
    id: partial.id || 'mv-' + Math.random().toString(36).slice(2, 8),
    itemId: partial.itemId || '',
    type: partial.type || 'added',
    fromContainerId: partial.fromContainerId || null,
    fromContainerCode: partial.fromContainerCode || null,
    toContainerId: partial.toContainerId || null,
    toContainerCode: partial.toContainerCode || null,
    loanedTo: partial.loanedTo || null,
    loanExpectedReturn: partial.loanExpectedReturn || null,
    notes: partial.notes || '',
    performedBy: partial.performedBy || 'Alex Morgan',
    createdAt: partial.createdAt || '2025-06-01T00:00:00Z',
  };
}

export const mockItems: Item[] = [
  {
    id: 'i1', name: 'Festive Christmas Tree Ornaments Set', description: 'Complete set of 48 glass baubles in red, gold, and green. Includes tree topper star. Packed in original foam-lined box.', keywords: ['christmas', 'tree', 'ornaments', 'baubles', 'decorations', 'festive', 'holiday'], category: 'Christmas', brand: 'John Lewis', model: 'Heritage Collection', serialNumber: '', quantity: 1, unitType: 'set', dimensions: { width: 50, height: 40, depth: 35, unit: 'cm' }, estimatedWeightKg: 4, condition: 'good', estimatedValue: 85, currency: 'GBP', purchaseDate: '2023-11-15', purchasePrice: 120, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c1', containerCode: 'L-R01-S03-B01', rackId: 'r1', rackCode: 'L-R01', shelf: 3, position: 1,
    isImportant: false, isSentimental: true, isSeasonal: true, isFragile: true, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph1', type: 'overview', caption: 'Full ornament set in box', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=set%20of%20colorful%20glass%20christmas%20baubles%20in%20red%20gold%20and%20green%20arranged%20in%20a%20foam%20lined%20storage%20box%20on%20a%20plain%20light%20surface%20overhead%20view&width=1200&height=800&seq=101&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=set%20of%20colorful%20glass%20christmas%20baubles%20in%20red%20gold%20and%20green%20arranged%20in%20a%20foam%20lined%20storage%20box%20on%20a%20plain%20light%20surface%20overhead%20view&width=300&height=200&seq=101t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv1', itemId: 'i1', type: 'added', toContainerId: 'c1', toContainerCode: 'L-R01-S03-B01', notes: 'Stored after Christmas 2025', createdAt: '2025-01-05T00:00:00Z' })],
    storageWarnings: [], aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-12-15T00:00:00Z', lastCheckedAt: '2025-12-15T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Festive Christmas Tree Ornaments Set glass baubles red gold green tree topper John Lewis Heritage Collection christmas decorations festive holiday', createdAt: '2025-06-15T00:00:00Z', updatedAt: '2025-12-15T00:00:00Z',
  },
  {
    id: 'i2', name: 'Bosch Professional Drill GSB 18V-55', description: 'Cordless combi drill with two 4.0Ah batteries, fast charger, and carry case. Excellent condition, used for three projects.', keywords: ['drill', 'bosch', 'cordless', 'power tool', 'combi', '18v', 'battery'], category: 'Tools', brand: 'Bosch Professional', model: 'GSB 18V-55', serialNumber: 'BP-2023-784921', quantity: 1, unitType: 'single', dimensions: { width: 45, height: 35, depth: 25, unit: 'cm' }, estimatedWeightKg: 5.5, condition: 'like_new', estimatedValue: 180, currency: 'GBP', purchaseDate: '2023-08-20', purchasePrice: 249, warrantyExpiry: '2026-08-20',
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c2', containerCode: 'L-R01-S02-B01', rackId: 'r1', rackCode: 'L-R01', shelf: 2, position: 1,
    isImportant: true, isSentimental: false, isSeasonal: false, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph2', type: 'overview', caption: 'Bosch drill in case', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20professional%20cordless%20power%20drill%20with%20battery%20and%20charger%20inside%20a%20black%20plastic%20carry%20case%20on%20a%20clean%20white%20surface%20top%20down%20view&width=1200&height=800&seq=102&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20professional%20cordless%20power%20drill%20with%20battery%20and%20charger%20inside%20a%20black%20plastic%20carry%20case%20on%20a%20clean%20white%20surface%20top%20down%20view&width=300&height=200&seq=102t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv2', itemId: 'i2', type: 'added', toContainerId: 'c2', toContainerCode: 'L-R01-S02-B01', notes: 'Purchased new, stored with accessories', createdAt: '2025-09-20T00:00:00Z' })],
    storageWarnings: [], aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-11-10T00:00:00Z', lastCheckedAt: '2025-11-10T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Bosch Professional Drill GSB 18V-55 cordless combi battery power tool 18v BP-2023-784921', createdAt: '2025-09-20T00:00:00Z', updatedAt: '2025-11-10T00:00:00Z',
  },
  {
    id: 'i3', name: 'Coleman Sundome 4-Person Tent', description: 'Darkroom technology dome tent, sleeps 4. Includes rainfly, carry bag, and stakes. Used on three camping trips, excellent condition.', keywords: ['tent', 'camping', 'coleman', 'outdoor', '4-person', 'dome', 'darkroom'], category: 'Camping', brand: 'Coleman', model: 'Sundome 4P', serialNumber: 'CM-SD4-2022-3312', quantity: 1, unitType: 'single', dimensions: { width: 70, height: 25, depth: 25, unit: 'cm' }, estimatedWeightKg: 8, condition: 'good', estimatedValue: 95, currency: 'GBP', purchaseDate: '2022-06-01', purchasePrice: 149, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c3', containerCode: 'L-R02-S02-B02', rackId: 'r2', rackCode: 'L-R02', shelf: 2, position: 2,
    isImportant: false, isSentimental: false, isSeasonal: true, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph3', type: 'overview', caption: 'Tent in carry bag', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20green%20and%20grey%20dome%20camping%20tent%20folded%20and%20packed%20inside%20a%20black%20carry%20bag%20on%20a%20light%20grey%20background%20top%20view&width=1200&height=800&seq=103&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20green%20and%20grey%20dome%20camping%20tent%20folded%20and%20packed%20inside%20a%20black%20carry%20bag%20on%20a%20light%20grey%20background%20top%20view&width=300&height=200&seq=103t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv3', itemId: 'i3', type: 'added', toContainerId: 'c3', toContainerCode: 'L-R02-S02-B02', notes: 'Cleaned and packed after summer trip', createdAt: '2025-09-01T00:00:00Z' })],
    storageWarnings: [], aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-10-05T00:00:00Z', lastCheckedAt: '2025-10-05T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Coleman Sundome 4-Person Tent darkroom dome camping outdoor 4-person CM-SD4-2022-3312', createdAt: '2025-07-01T00:00:00Z', updatedAt: '2025-10-05T00:00:00Z',
  },
  {
    id: 'i4', name: 'Birth Certificate - Alex Morgan', description: 'Original birth certificate in protective sleeve. Stored in fireproof document pouch.', keywords: ['birth certificate', 'legal', 'document', 'identity', 'personal'], category: 'Documents', brand: '', model: '', serialNumber: '', quantity: 1, unitType: 'single', dimensions: null, estimatedWeightKg: 0.05, condition: 'good', estimatedValue: null, currency: 'GBP', purchaseDate: null, purchasePrice: null, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c4', containerCode: 'L-R02-S04-B01', rackId: 'r2', rackCode: 'L-R02', shelf: 4, position: 1,
    isImportant: true, isSentimental: false, isSeasonal: false, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [], receipts: [], movements: [makeMovement({ id: 'mv4', itemId: 'i4', type: 'added', toContainerId: 'c4', toContainerCode: 'L-R02-S04-B01', notes: 'Moved to fireproof pouch', createdAt: '2025-08-01T00:00:00Z' })],
    storageWarnings: [{ type: 'valuable_document', severity: 'medium', message: 'Valuable document stored in loft. Ensure fireproof protection is adequate for extreme temperatures.', acknowledged: true, acknowledgedBy: 'Alex Morgan', acknowledgedAt: '2025-08-01T00:00:00Z' }],
    aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-12-01T00:00:00Z', lastCheckedAt: '2025-12-01T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Birth Certificate Alex Morgan legal document identity personal', createdAt: '2025-07-10T00:00:00Z', updatedAt: '2025-12-01T00:00:00Z',
  },
  {
    id: 'i5', name: 'HDMI and USB Cable Collection', description: 'Assorted cables: 3x HDMI (2m), 2x USB-C to USB-A (1m), 1x DisplayPort (3m), 1x Ethernet (5m). All tested working.', keywords: ['cables', 'hdmi', 'usb', 'displayport', 'ethernet', 'electronics', 'accessories'], category: 'Electrical', brand: 'Mixed', model: '', serialNumber: '', quantity: 7, unitType: 'bundle', dimensions: null, estimatedWeightKg: 1.2, condition: 'good', estimatedValue: 35, currency: 'GBP', purchaseDate: null, purchasePrice: null, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c5', containerCode: 'L-R03-S01-B03', rackId: 'r3', rackCode: 'L-R03', shelf: 1, position: 3,
    isImportant: false, isSentimental: false, isSeasonal: false, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph5', type: 'overview', caption: 'Cable collection bundled', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20collection%20of%20various%20electronic%20cables%20including%20hdmi%20usb%20and%20ethernet%20cords%20neatly%20coiled%20and%20grouped%20together%20on%20a%20white%20surface%20top%20down%20view&width=1200&height=800&seq=105&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20collection%20of%20various%20electronic%20cables%20including%20hdmi%20usb%20and%20ethernet%20cords%20neatly%20coiled%20and%20grouped%20together%20on%20a%20white%20surface%20top%20down%20view&width=300&height=200&seq=105t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv5', itemId: 'i5', type: 'added', toContainerId: 'c5', toContainerCode: 'L-R03-S01-B03', notes: 'Sorted and bundled cables', createdAt: '2025-09-01T00:00:00Z' })],
    storageWarnings: [], aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-11-20T00:00:00Z', lastCheckedAt: '2025-11-20T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'HDMI USB Cable Collection hdmi usb displayport ethernet electronics accessories cables', createdAt: '2025-08-05T00:00:00Z', updatedAt: '2025-11-20T00:00:00Z',
  },
  {
    id: 'i6', name: 'North Face Arctic Parka - Women\'s Medium', description: 'Insulated waterproof winter parka. Khaki green, hood with faux fur trim. Worn one season.', keywords: ['coat', 'winter', 'parka', 'north face', 'insulated', 'waterproof', 'womens'], category: 'Clothing', brand: 'The North Face', model: 'Arctic Parka II', serialNumber: '', quantity: 1, unitType: 'single', dimensions: null, estimatedWeightKg: 1.4, condition: 'like_new', estimatedValue: 160, currency: 'GBP', purchaseDate: '2024-10-15', purchasePrice: 280, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c6', containerCode: 'L-R04-S02-B01', rackId: 'r4', rackCode: 'L-R04', shelf: 2, position: 1,
    isImportant: false, isSentimental: false, isSeasonal: true, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph6', type: 'overview', caption: 'Winter parka folded', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20khaki%20green%20winter%20parka%20coat%20with%20faux%20fur%20hood%20trim%20neatly%20folded%20on%20a%20clean%20light%20grey%20surface%20top%20down%20view%20minimalist&width=1200&height=800&seq=106&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20khaki%20green%20winter%20parka%20coat%20with%20faux%20fur%20hood%20trim%20neatly%20folded%20on%20a%20clean%20light%20grey%20surface%20top%20down%20view%20minimalist&width=300&height=200&seq=106t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv6', itemId: 'i6', type: 'added', toContainerId: 'c6', toContainerCode: 'L-R04-S02-B01', notes: 'Stored for summer', createdAt: '2025-04-01T00:00:00Z' })],
    storageWarnings: [], aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-10-01T00:00:00Z', lastCheckedAt: '2025-10-01T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'North Face Arctic Parka Women Medium insulated waterproof winter coat khaki green', createdAt: '2025-08-20T00:00:00Z', updatedAt: '2025-10-01T00:00:00Z',
  },
  {
    id: 'i7', name: 'Vintage Black and White Family Photographs', description: 'Collection of approximately 30 black and white photographs from the 1940s-1960s. Family portraits, wedding photos, and street scenes.', keywords: ['photographs', 'vintage', 'family', 'black and white', 'history', 'ancestry'], category: 'Keepsakes', brand: '', model: '', serialNumber: '', quantity: 30, unitType: 'bundle', dimensions: { width: 20, height: 15, depth: 5, unit: 'cm' }, estimatedWeightKg: 0.8, condition: 'fair', estimatedValue: null, currency: 'GBP', purchaseDate: null, purchasePrice: null, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c7', containerCode: 'L-R02-S03-B04', rackId: 'r2', rackCode: 'L-R02', shelf: 3, position: 4,
    isImportant: true, isSentimental: true, isSeasonal: false, isFragile: true, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph7', type: 'overview', caption: 'Stack of vintage photos', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20stack%20of%20aged%20black%20and%20white%20vintage%20photographs%20neatly%20arranged%20inside%20a%20protective%20archival%20box%20on%20a%20light%20wooden%20surface%20overhead%20view&width=1200&height=800&seq=107&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20stack%20of%20aged%20black%20and%20white%20vintage%20photographs%20neatly%20arranged%20inside%20a%20protective%20archival%20box%20on%20a%20light%20wooden%20surface%20overhead%20view&width=300&height=200&seq=107t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv7', itemId: 'i7', type: 'added', toContainerId: 'c7', toContainerCode: 'L-R02-S03-B04', notes: 'Transferred from old shoebox to archival box', createdAt: '2025-07-15T00:00:00Z' })],
    storageWarnings: [{ type: 'temperature_sensitive', severity: 'low', message: 'Photographs may degrade in fluctuating loft temperatures. Consider climate-controlled storage for long-term preservation.', acknowledged: true, acknowledgedBy: 'Alex Morgan', acknowledgedAt: '2025-07-15T00:00:00Z' }],
    aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-11-01T00:00:00Z', lastCheckedAt: '2025-11-01T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Vintage Black and White Family Photographs 1940s 1960s portraits wedding ancestry history keepsakes', createdAt: '2025-07-15T00:00:00Z', updatedAt: '2025-11-01T00:00:00Z',
  },
  {
    id: 'i8', name: 'Screw and Bolt Assortment Kit', description: '400-piece steel screw and bolt set in compartmentalised organiser. Sizes M3-M10, includes washers and wall plugs.', keywords: ['screws', 'bolts', 'washers', 'hardware', 'fasteners', 'diy'], category: 'Spare Parts', brand: 'Fischer', model: 'DuoPower Assortment', serialNumber: '', quantity: 400, unitType: 'set', dimensions: { width: 35, height: 25, depth: 8, unit: 'cm' }, estimatedWeightKg: 3.5, condition: 'new', estimatedValue: 28, currency: 'GBP', purchaseDate: '2025-01-10', purchasePrice: 35, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c8', containerCode: 'L-R01-S04-B02', rackId: 'r1', rackCode: 'L-R01', shelf: 4, position: 2,
    isImportant: false, isSentimental: false, isSeasonal: false, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph8', type: 'overview', caption: 'Screw organiser kit', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20compartmentalized%20plastic%20organizer%20box%20filled%20with%20various%20sizes%20of%20screws%20bolts%20and%20washers%20on%20a%20plain%20white%20background%20overhead%20view&width=1200&height=800&seq=108&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20compartmentalized%20plastic%20organizer%20box%20filled%20with%20various%20sizes%20of%20screws%20bolts%20and%20washers%20on%20a%20plain%20white%20background%20overhead%20view&width=300&height=200&seq=108t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv8', itemId: 'i8', type: 'added', toContainerId: 'c8', toContainerCode: 'L-R01-S04-B02', notes: 'New purchase, unopened', createdAt: '2025-01-10T00:00:00Z' })],
    storageWarnings: [], aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-09-15T00:00:00Z', lastCheckedAt: '2025-09-15T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Screw Bolt Assortment Kit Fischer DuoPower 400-piece M3-M10 hardware fasteners diy', createdAt: '2025-08-01T00:00:00Z', updatedAt: '2025-09-15T00:00:00Z',
  },
  {
    id: 'i9', name: 'Dulux Pure Brilliant White Emulsion 5L', description: 'Matt finish emulsion paint for walls and ceilings. Sealed, unused. Purchased for spare room project that was cancelled.', keywords: ['paint', 'emulsion', 'white', 'dulux', 'decorating', 'walls', 'matt'], category: 'Household', brand: 'Dulux', model: 'Pure Brilliant White Matt', serialNumber: '', quantity: 1, unitType: 'single', dimensions: { width: 25, height: 25, depth: 20, unit: 'cm' }, estimatedWeightKg: 6.5, condition: 'new', estimatedValue: 22, currency: 'GBP', purchaseDate: '2024-09-01', purchasePrice: 28, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'unsure', containerId: 'c9', containerCode: 'L-R03-S03-B01', rackId: 'r3', rackCode: 'L-R03', shelf: 3, position: 1,
    isImportant: false, isSentimental: false, isSeasonal: false, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph9', type: 'overview', caption: 'Paint tin', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20white%20plastic%20paint%20tin%20with%20a%20label%20reading%20brilliant%20white%20matt%20emulsion%20placed%20on%20a%20neutral%20grey%20surface%20front%20view%20clean%20background&width=1200&height=800&seq=109&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20white%20plastic%20paint%20tin%20with%20a%20label%20reading%20brilliant%20white%20matt%20emulsion%20placed%20on%20a%20neutral%20grey%20surface%20front%20view%20clean%20background&width=300&height=200&seq=109t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv9', itemId: 'i9', type: 'added', toContainerId: 'c9', toContainerCode: 'L-R03-S03-B01', notes: 'Unused, may sell or donate', createdAt: '2025-10-01T00:00:00Z' })],
    storageWarnings: [{ type: 'paint', severity: 'medium', message: 'Paint may freeze or separate in unheated loft during winter. Ensure lid is fully sealed and tin is not in direct contact with cold surfaces.', acknowledged: true, acknowledgedBy: 'Alex Morgan', acknowledgedAt: '2025-10-01T00:00:00Z' }],
    aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-12-10T00:00:00Z', lastCheckedAt: '2025-12-10T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Dulux Pure Brilliant White Emulsion 5L matt paint decorating walls ceilings', createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-12-10T00:00:00Z',
  },
  {
    id: 'i10', name: 'Stainless Steel Garden Trowel Set', description: 'Set of 3: trowel, hand fork, and transplanting spade. Ergonomic soft-grip handles. Light surface rust on trowel tip from last use.', keywords: ['garden', 'tools', 'trowel', 'fork', 'spade', 'hand tools', 'outdoor'], category: 'Garden', brand: 'Spear & Jackson', model: 'Elements Stainless', serialNumber: '', quantity: 3, unitType: 'set', dimensions: { width: 35, height: 12, depth: 8, unit: 'cm' }, estimatedWeightKg: 0.9, condition: 'good', estimatedValue: 18, currency: 'GBP', purchaseDate: '2023-04-01', purchasePrice: 29, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c10', containerCode: 'L-R04-S03-B02', rackId: 'r4', rackCode: 'L-R04', shelf: 3, position: 2,
    isImportant: false, isSentimental: false, isSeasonal: true, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph10', type: 'overview', caption: 'Garden trowel set', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=three%20stainless%20steel%20garden%20hand%20tools%20including%20trowel%20fork%20and%20spade%20with%20ergonomic%20handles%20laid%20out%20on%20a%20light%20wooden%20surface%20overhead%20view&width=1200&height=800&seq=110&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=three%20stainless%20steel%20garden%20hand%20tools%20including%20trowel%20fork%20and%20spade%20with%20ergonomic%20handles%20laid%20out%20on%20a%20light%20wooden%20surface%20overhead%20view&width=300&height=200&seq=110t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv10', itemId: 'i10', type: 'added', toContainerId: 'c10', toContainerCode: 'L-R04-S03-B02', notes: 'Cleaned and stored for winter', createdAt: '2025-10-15T00:00:00Z' })],
    storageWarnings: [], aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-08-01T00:00:00Z', lastCheckedAt: '2025-08-01T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Stainless Steel Garden Trowel Set Spear Jackson Elements hand tools outdoor trowel fork spade', createdAt: '2025-08-15T00:00:00Z', updatedAt: '2025-08-01T00:00:00Z',
  },
  {
    id: 'i11', name: 'LED Christmas String Lights - Warm White', description: '20m outdoor string lights, 200 warm white LEDs. 8 programmed modes, timer function. IP44 rated. In original box.', keywords: ['lights', 'christmas', 'LED', 'outdoor', 'string lights', 'warm white', 'festive'], category: 'Christmas', brand: 'Lights4Fun', model: 'Connect Pro', serialNumber: '', quantity: 1, unitType: 'single', dimensions: { width: 30, height: 25, depth: 15, unit: 'cm' }, estimatedWeightKg: 2, condition: 'good', estimatedValue: 30, currency: 'GBP', purchaseDate: '2024-11-01', purchasePrice: 45, warrantyExpiry: null,
    status: 'on_loan', decisionStatus: 'keep', containerId: 'c1', containerCode: 'L-R01-S03-B01', rackId: 'r1', rackCode: 'L-R01', shelf: 3, position: 1,
    isImportant: false, isSentimental: false, isSeasonal: true, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph11', type: 'overview', caption: 'String lights in box', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20coil%20of%20warm%20white%20LED%20string%20lights%20inside%20an%20open%20cardboard%20box%20on%20a%20plain%20light%20surface%20top%20view&width=1200&height=800&seq=111&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20coil%20of%20warm%20white%20LED%20string%20lights%20inside%20an%20open%20cardboard%20box%20on%20a%20plain%20light%20surface%20top%20view&width=300&height=200&seq=111t&orientation=landscape' })],
    receipts: [], movements: [
      makeMovement({ id: 'mv11a', itemId: 'i11', type: 'added', toContainerId: 'c1', toContainerCode: 'L-R01-S03-B01', notes: 'Stored after Christmas 2024', createdAt: '2025-01-05T00:00:00Z' }),
      makeMovement({ id: 'mv11b', itemId: 'i11', type: 'loaned', loanedTo: 'Sarah Morgan', loanExpectedReturn: '2026-01-15', notes: 'Loaned to sister for her Christmas display', createdAt: '2025-12-01T00:00:00Z' }),
    ],
    storageWarnings: [], aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-11-28T00:00:00Z', lastCheckedAt: '2025-11-28T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'LED Christmas String Lights Warm White Lights4Fun Connect Pro outdoor 200 LEDs festive', createdAt: '2025-06-15T00:00:00Z', updatedAt: '2025-12-01T00:00:00Z',
  },
  {
    id: 'i12', name: 'Old Microwave Oven - Panasonic NN-E221', description: '800W compact microwave. Working but slow to heat. Cosmetic scratches on door. Replaced with new model, kept as spare.', keywords: ['microwave', 'oven', 'kitchen', 'appliance', 'panasonic', 'spare'], category: 'Household', brand: 'Panasonic', model: 'NN-E221', serialNumber: 'PN-2019-E221-8852', quantity: 1, unitType: 'single', dimensions: { width: 45, height: 28, depth: 35, unit: 'cm' }, estimatedWeightKg: 11, condition: 'poor', estimatedValue: 15, currency: 'GBP', purchaseDate: '2019-03-01', purchasePrice: 79, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'dispose', containerId: 'c9', containerCode: 'L-R03-S03-B01', rackId: 'r3', rackCode: 'L-R03', shelf: 3, position: 1,
    isImportant: false, isSentimental: false, isSeasonal: false, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph12', type: 'overview', caption: 'Old microwave', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=an%20older%20white%20compact%20microwave%20oven%20with%20a%20few%20scratches%20on%20the%20door%20placed%20on%20a%20plain%20grey%20surface%20front%20angle%20view%20minimalist&width=1200&height=800&seq=112&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=an%20older%20white%20compact%20microwave%20oven%20with%20a%20few%20scratches%20on%20the%20door%20placed%20on%20a%20plain%20grey%20surface%20front%20angle%20view%20minimalist&width=300&height=200&seq=112t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv12', itemId: 'i12', type: 'added', toContainerId: 'c9', toContainerCode: 'L-R03-S03-B01', notes: 'Replaced with new model, stored pending disposal', createdAt: '2025-06-01T00:00:00Z' })],
    storageWarnings: [{ type: 'electronics', severity: 'low', message: 'Electronics may be affected by condensation in loft spaces. Consider wrapping in protective material.', acknowledged: true, acknowledgedBy: 'Alex Morgan', acknowledgedAt: '2025-06-01T00:00:00Z' }],
    aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-12-10T00:00:00Z', lastCheckedAt: '2025-12-10T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Old Microwave Oven Panasonic NN-E221 800W kitchen appliance spare dispose PN-2019-E221-8852', createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-12-10T00:00:00Z',
  },
  {
    id: 'i13', name: 'DeWalt Jigsaw DCS331N', description: '18V cordless jigsaw, body only. Variable speed, pendulum action, dust blower. In original case with spare blades.', keywords: ['jigsaw', 'dewalt', 'cordless', 'power tool', 'woodworking', 'cutting'], category: 'Tools', brand: 'DeWalt', model: 'DCS331N', serialNumber: 'DW-2024-449201', quantity: 1, unitType: 'single', dimensions: { width: 40, height: 30, depth: 20, unit: 'cm' }, estimatedWeightKg: 3.2, condition: 'good', estimatedValue: 95, currency: 'GBP', purchaseDate: '2024-06-15', purchasePrice: 135, warrantyExpiry: '2027-06-15',
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c2', containerCode: 'L-R01-S02-B01', rackId: 'r1', rackCode: 'L-R01', shelf: 2, position: 1,
    isImportant: false, isSentimental: false, isSeasonal: false, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph13', type: 'overview', caption: 'DeWalt jigsaw in case', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20yellow%20and%20black%20cordless%20jigsaw%20power%20tool%20inside%20a%20hard%20plastic%20carry%20case%20with%20spare%20blades%20on%20a%20white%20surface%20top%20view&width=1200&height=800&seq=113&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20yellow%20and%20black%20cordless%20jigsaw%20power%20tool%20inside%20a%20hard%20plastic%20carry%20case%20with%20spare%20blades%20on%20a%20white%20surface%20top%20view&width=300&height=200&seq=113t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv13', itemId: 'i13', type: 'added', toContainerId: 'c2', toContainerCode: 'L-R01-S02-B01', notes: 'Purchased for kitchen cabinet project', createdAt: '2025-09-20T00:00:00Z' })],
    storageWarnings: [], aiSuggestions: [], aiReviewStatus: 'pending', lastVerifiedAt: '2025-11-10T00:00:00Z', lastCheckedAt: '2025-11-10T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'DeWalt Jigsaw DCS331N cordless 18V variable speed pendulum woodworking cutting DW-2024-449201', createdAt: '2025-09-20T00:00:00Z', updatedAt: '2025-11-10T00:00:00Z',
  },
  {
    id: 'i14', name: 'Camping Gas Stove - Campingaz Twister Plus', description: 'Single burner camping stove with piezo ignition. Uses CV470 Plus cartridges. Includes carry case. Tested working.', keywords: ['stove', 'camping', 'gas', 'cooking', 'outdoor', 'campingaz', 'burner'], category: 'Camping', brand: 'Campingaz', model: 'Twister Plus', serialNumber: 'CG-2023-TW-7741', quantity: 1, unitType: 'single', dimensions: { width: 30, height: 20, depth: 15, unit: 'cm' }, estimatedWeightKg: 1.1, condition: 'good', estimatedValue: 30, currency: 'GBP', purchaseDate: '2023-07-01', purchasePrice: 45, warrantyExpiry: null,
    status: 'missing', decisionStatus: 'keep', containerId: 'c3', containerCode: 'L-R02-S02-B02', rackId: 'r2', rackCode: 'L-R02', shelf: 2, position: 2,
    isImportant: false, isSentimental: false, isSeasonal: true, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph14', type: 'overview', caption: 'Camping stove', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20compact%20blue%20single%20burner%20camping%20gas%20stove%20with%20folded%20arms%20on%20a%20clean%20white%20surface%20overhead%20view&width=1200&height=800&seq=114&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20compact%20blue%20single%20burner%20camping%20gas%20stove%20with%20folded%20arms%20on%20a%20clean%20white%20surface%20overhead%20view&width=300&height=200&seq=114t&orientation=landscape' })],
    receipts: [], movements: [
      makeMovement({ id: 'mv14a', itemId: 'i14', type: 'added', toContainerId: 'c3', toContainerCode: 'L-R02-S02-B02', notes: 'Stored after camping trip', createdAt: '2025-09-01T00:00:00Z' }),
      makeMovement({ id: 'mv14b', itemId: 'i14', type: 'missing', notes: 'Not found during box audit - may have been lent to friend', createdAt: '2025-10-05T00:00:00Z' }),
    ],
    storageWarnings: [{ type: 'gas_canister', severity: 'high', message: 'Gas canisters should not be stored in enclosed loft spaces due to fire risk and pressure changes from temperature fluctuations.', acknowledged: false, acknowledgedBy: null, acknowledgedAt: null }],
    aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-10-05T00:00:00Z', lastCheckedAt: '2025-10-05T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Camping Gas Stove Campingaz Twister Plus single burner piezo CV470 outdoor cooking CG-2023-TW-7741', createdAt: '2025-07-01T00:00:00Z', updatedAt: '2025-10-05T00:00:00Z',
  },
  {
    id: 'i15', name: 'Dyson V8 Absolute Cordless Vacuum', description: 'Complete with motorised cleaner head, crevice tool, combination tool, and docking station. Battery life reduced to about 25 mins. Used weekly until replaced.', keywords: ['vacuum', 'dyson', 'cordless', 'cleaning', 'household', 'v8'], category: 'Household', brand: 'Dyson', model: 'V8 Absolute', serialNumber: 'DY-V8-2018-CY4N', quantity: 1, unitType: 'single', dimensions: { width: 25, height: 120, depth: 25, unit: 'cm' }, estimatedWeightKg: 2.6, condition: 'fair', estimatedValue: 80, currency: 'GBP', purchaseDate: '2018-12-01', purchasePrice: 399, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'sell', containerId: 'c9', containerCode: 'L-R03-S03-B01', rackId: 'r3', rackCode: 'L-R03', shelf: 3, position: 1,
    isImportant: false, isSentimental: false, isSeasonal: false, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph15', type: 'overview', caption: 'Dyson vacuum', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20dyson%20cordless%20stick%20vacuum%20cleaner%20with%20attachments%20leaning%20against%20a%20plain%20light%20grey%20wall%20on%20a%20clean%20floor%20front%20view&width=1200&height=800&seq=115&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20dyson%20cordless%20stick%20vacuum%20cleaner%20with%20attachments%20leaning%20against%20a%20plain%20light%20grey%20wall%20on%20a%20clean%20floor%20front%20view&width=300&height=200&seq=115t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv15', itemId: 'i15', type: 'added', toContainerId: 'c9', toContainerCode: 'L-R03-S03-B01', notes: 'Replaced with new model, listed for sale', createdAt: '2025-11-01T00:00:00Z' })],
    storageWarnings: [{ type: 'battery', severity: 'medium', message: 'Lithium-ion battery should not be stored in extreme temperatures. Loft heat in summer may degrade battery.', acknowledged: true, acknowledgedBy: 'Alex Morgan', acknowledgedAt: '2025-11-01T00:00:00Z' }],
    aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-12-10T00:00:00Z', lastCheckedAt: '2025-12-10T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Dyson V8 Absolute Cordless Vacuum cleaner household DY-V8-2018-CY4N sell', createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-12-10T00:00:00Z',
  },
  {
    id: 'i16', name: 'Box of Assorted Batteries', description: 'Mixed pack: 8x AA Duracell, 6x AAA Energizer, 2x 9V Panasonic, 4x CR2032 coin cells. Most still in original packaging.', keywords: ['batteries', 'AA', 'AAA', '9V', 'coin cell', 'power', 'spares'], category: 'Electrical', brand: 'Mixed', model: '', serialNumber: '', quantity: 20, unitType: 'box', dimensions: { width: 20, height: 15, depth: 10, unit: 'cm' }, estimatedWeightKg: 0.7, condition: 'new', estimatedValue: 15, currency: 'GBP', purchaseDate: '2025-03-01', purchasePrice: 20, warrantyExpiry: null,
    status: 'in_storage', decisionStatus: 'keep', containerId: 'c5', containerCode: 'L-R03-S01-B03', rackId: 'r3', rackCode: 'L-R03', shelf: 1, position: 3,
    isImportant: false, isSentimental: false, isSeasonal: false, isFragile: false, parentItemId: null, childItemIds: [],
    photos: [makePhoto({ id: 'ph16', type: 'overview', caption: 'Battery assortment', isPrimary: true, url: 'https://readdy.ai/api/search-image?query=a%20collection%20of%20various%20sizes%20and%20brands%20of%20batteries%20AA%20AAA%209V%20and%20coin%20cells%20scattered%20neatly%20on%20a%20white%20surface%20overhead%20view&width=1200&height=800&seq=116&orientation=landscape', thumbnailUrl: 'https://readdy.ai/api/search-image?query=a%20collection%20of%20various%20sizes%20and%20brands%20of%20batteries%20AA%20AAA%209V%20and%20coin%20cells%20scattered%20neatly%20on%20a%20white%20surface%20overhead%20view&width=300&height=200&seq=116t&orientation=landscape' })],
    receipts: [], movements: [makeMovement({ id: 'mv16', itemId: 'i16', type: 'added', toContainerId: 'c5', toContainerCode: 'L-R03-S01-B03', notes: 'Bulk purchase stored', createdAt: '2025-03-01T00:00:00Z' })],
    storageWarnings: [{ type: 'battery', severity: 'medium', message: 'Batteries can leak or corrode over time, especially in fluctuating temperatures. Store in a cool, dry container.', acknowledged: true, acknowledgedBy: 'Alex Morgan', acknowledgedAt: '2025-03-01T00:00:00Z' }],
    aiSuggestions: [], aiReviewStatus: 'none', lastVerifiedAt: '2025-11-20T00:00:00Z', lastCheckedAt: '2025-11-20T00:00:00Z',
    addedBy: 'Alex Morgan', ownedBy: 'Alex Morgan', searchableText: 'Assorted Batteries AA Duracell AAA Energizer 9V Panasonic CR2032 coin cell power spares', createdAt: '2025-08-05T00:00:00Z', updatedAt: '2025-11-20T00:00:00Z',
  },
];

export const mockCategories: CategoryDefinition[] = [
  { id: 'cat1', name: 'Tools', icon: 'ri-tools-line', color: '#f59e0b', description: 'Power tools, hand tools, and workshop equipment', parentId: null, itemCount: 2 },
  { id: 'cat2', name: 'Electrical', icon: 'ri-plug-line', color: '#06b6d4', description: 'Cables, adapters, batteries, and electronic accessories', parentId: null, itemCount: 2 },
  { id: 'cat3', name: 'Christmas', icon: 'ri-gift-line', color: '#ef4444', description: 'Festive decorations, lights, and holiday items', parentId: null, itemCount: 2 },
  { id: 'cat4', name: 'Documents', icon: 'ri-file-text-line', color: '#6b7280', description: 'Personal documents, certificates, and paperwork', parentId: null, itemCount: 1 },
  { id: 'cat5', name: 'Photographs', icon: 'ri-image-line', color: '#8b5cf6', description: 'Photo albums, framed pictures, and prints', parentId: null, itemCount: 0 },
  { id: 'cat6', name: 'Camping', icon: 'ri-tent-line', color: '#10b981', description: 'Camping and outdoor equipment', parentId: null, itemCount: 2 },
  { id: 'cat7', name: 'Clothing', icon: 'ri-t-shirt-line', color: '#ec4899', description: 'Seasonal clothing, shoes, and accessories', parentId: null, itemCount: 1 },
  { id: 'cat8', name: 'Household', icon: 'ri-home-3-line', color: '#f97316', description: 'Home goods, appliances, and household items', parentId: null, itemCount: 3 },
  { id: 'cat9', name: 'Spare Parts', icon: 'ri-settings-3-line', color: '#6366f1', description: 'Screws, bolts, brackets, and hardware', parentId: null, itemCount: 1 },
  { id: 'cat10', name: 'Keepsakes', icon: 'ri-heart-line', color: '#d946ef', description: 'Sentimental items, heirlooms, and memorabilia', parentId: null, itemCount: 1 },
  { id: 'cat11', name: 'Furniture', icon: 'ri-armchair-line', color: '#a16207', description: 'Small furniture, flat-pack items, and parts', parentId: null, itemCount: 0 },
  { id: 'cat12', name: 'Garden', icon: 'ri-plant-line', color: '#22c55e', description: 'Garden tools, pots, seeds, and outdoor gear', parentId: null, itemCount: 1 },
  { id: 'cat13', name: 'Items to Sell', icon: 'ri-price-tag-3-line', color: '#eab308', description: 'Items listed or intended for sale', parentId: null, itemCount: 1 },
];

export const mockSavedViews: SavedView[] = [
  { id: 'sv1', name: 'All Items', icon: 'ri-archive-line', filters: { search: '', category: [], containerId: [], rackId: [], status: [], decisionStatus: [], condition: [], valueMin: null, valueMax: null, dateAddedFrom: null, dateAddedTo: null, aiReviewState: null, isImportant: null, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: false }, sort: { field: 'recently_added', direction: 'desc' }, viewMode: 'gallery', isDefault: true },
  { id: 'sv2', name: 'Recently Added', icon: 'ri-time-line', filters: { search: '', category: [], containerId: [], rackId: [], status: [], decisionStatus: [], condition: [], valueMin: null, valueMax: null, dateAddedFrom: '2025-12-01', dateAddedTo: null, aiReviewState: null, isImportant: null, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: false }, sort: { field: 'recently_added', direction: 'desc' }, viewMode: 'list', isDefault: false },
  { id: 'sv3', name: 'Important', icon: 'ri-star-line', filters: { search: '', category: [], containerId: [], rackId: [], status: [], decisionStatus: [], condition: [], valueMin: null, valueMax: null, dateAddedFrom: null, dateAddedTo: null, aiReviewState: null, isImportant: true, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: false }, sort: { field: 'name', direction: 'asc' }, viewMode: 'gallery', isDefault: false },
  { id: 'sv4', name: 'On Loan', icon: 'ri-share-forward-line', filters: { search: '', category: [], containerId: [], rackId: [], status: ['on_loan'], decisionStatus: [], condition: [], valueMin: null, valueMax: null, dateAddedFrom: null, dateAddedTo: null, aiReviewState: null, isImportant: null, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: false }, sort: { field: 'recently_added', direction: 'desc' }, viewMode: 'list', isDefault: false },
  { id: 'sv5', name: 'Missing', icon: 'ri-error-warning-line', filters: { search: '', category: [], containerId: [], rackId: [], status: ['missing'], decisionStatus: [], condition: [], valueMin: null, valueMax: null, dateAddedFrom: null, dateAddedTo: null, aiReviewState: null, isImportant: null, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: true }, sort: { field: 'recently_added', direction: 'desc' }, viewMode: 'list', isDefault: false },
  { id: 'sv6', name: 'To Sell', icon: 'ri-price-tag-3-line', filters: { search: '', category: [], containerId: [], rackId: [], status: [], decisionStatus: ['sell'], condition: [], valueMin: null, valueMax: null, dateAddedFrom: null, dateAddedTo: null, aiReviewState: null, isImportant: null, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: false }, sort: { field: 'value', direction: 'desc' }, viewMode: 'table', isDefault: false },
  { id: 'sv7', name: 'To Donate', icon: 'ri-hand-heart-line', filters: { search: '', category: [], containerId: [], rackId: [], status: [], decisionStatus: ['donate'], condition: [], valueMin: null, valueMax: null, dateAddedFrom: null, dateAddedTo: null, aiReviewState: null, isImportant: null, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: false }, sort: { field: 'name', direction: 'asc' }, viewMode: 'gallery', isDefault: false },
  { id: 'sv8', name: 'To Dispose', icon: 'ri-delete-bin-line', filters: { search: '', category: [], containerId: [], rackId: [], status: [], decisionStatus: ['dispose'], condition: [], valueMin: null, valueMax: null, dateAddedFrom: null, dateAddedTo: null, aiReviewState: null, isImportant: null, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: false }, sort: { field: 'recently_added', direction: 'desc' }, viewMode: 'list', isDefault: false },
  { id: 'sv9', name: 'Needs Review', icon: 'ri-eye-line', filters: { search: '', category: [], containerId: [], rackId: [], status: [], decisionStatus: [], condition: [], valueMin: null, valueMax: null, dateAddedFrom: null, dateAddedTo: null, aiReviewState: 'pending', isImportant: null, isSentimental: null, isSeasonal: null, isFragile: null, missingOnly: false }, sort: { field: 'oldest_unverified', direction: 'asc' }, viewMode: 'list', isDefault: false },
];

export const mockActivityLog: ActivityLog[] = [
  { id: 'a1', userId: 'u1', userName: 'Alex Morgan', action: 'Added item', resourceType: 'item', resourceId: 'i15', resourceName: 'Dyson V8 Absolute Cordless Vacuum', before: null, after: null, riskLevel: 'low', createdAt: '2025-11-01T09:00:00Z' },
  { id: 'a2', userId: 'u1', userName: 'Alex Morgan', action: 'Marked item for sale', resourceType: 'item', resourceId: 'i15', resourceName: 'Dyson V8 Absolute Cordless Vacuum', before: { decisionStatus: 'unsure' }, after: { decisionStatus: 'sell' }, riskLevel: 'low', createdAt: '2025-11-01T09:05:00Z' },
  { id: 'a3', userId: 'u1', userName: 'Alex Morgan', action: 'Loaned item', resourceType: 'item', resourceId: 'i11', resourceName: 'LED Christmas String Lights', before: { status: 'in_storage' }, after: { status: 'on_loan', loanedTo: 'Sarah Morgan' }, riskLevel: 'low', createdAt: '2025-12-01T14:00:00Z' },
  { id: 'a4', userId: 'u2', userName: 'Sam Taylor', action: 'Verified box contents', resourceType: 'container', resourceId: 'c1', resourceName: 'Christmas Decorations', before: null, after: null, riskLevel: 'low', createdAt: '2025-12-15T11:00:00Z' },
  { id: 'a5', userId: 'u1', userName: 'Alex Morgan', action: 'Marked item missing', resourceType: 'item', resourceId: 'i14', resourceName: 'Camping Gas Stove', before: { status: 'in_storage' }, after: { status: 'missing' }, riskLevel: 'medium', createdAt: '2025-10-05T15:00:00Z' },
  { id: 'a6', userId: 'u1', userName: 'Alex Morgan', action: 'Catalogue session completed', resourceType: 'container', resourceId: 'c2', resourceName: 'Power Tools', before: null, after: { status: 'catalogued' }, riskLevel: 'low', createdAt: '2025-09-20T16:30:00Z' },
  { id: 'a7', userId: 'u2', userName: 'Sam Taylor', action: 'Updated item condition', resourceType: 'item', resourceId: 'i12', resourceName: 'Old Microwave Oven', before: { condition: 'fair' }, after: { condition: 'poor' }, riskLevel: 'low', createdAt: '2025-12-10T10:00:00Z' },
  { id: 'a8', userId: 'u1', userName: 'Alex Morgan', action: 'Acknowledged storage warning', resourceType: 'item', resourceId: 'i15', resourceName: 'Dyson V8 Absolute', before: null, after: null, riskLevel: 'low', createdAt: '2025-11-01T09:10:00Z' },
];

export function getItemById(id: string): Item | undefined {
  return mockItems.find(i => i.id === id);
}

export function getContainerById(id: string): Container | undefined {
  return mockContainers.find(c => c.id === id);
}

export function getRackById(id: string): Rack | undefined {
  return mockRacks.find(r => r.id === id);
}

export function getItemsByContainer(containerId: string): Item[] {
  return mockItems.filter(i => i.containerId === containerId);
}