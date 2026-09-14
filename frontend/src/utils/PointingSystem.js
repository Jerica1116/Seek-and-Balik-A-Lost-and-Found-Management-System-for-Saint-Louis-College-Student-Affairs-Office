// utils/pointsSystem.js
// Category points reward the item type; action points reward the workflow
// step (report / surrender / claim). Total = category + action, stacked.
// Note: "Surrender to SAO" is treated the same as "Report found item" — both
// score +8 — since surrendering IS the act of reporting a found item for
// walk-in cases (FoundItems.jsx), not a separate bonus on top of it.

export const CATEGORY_POINTS = {
  'Electronic': 5,          // Electronics
  'ID': 4,                  // Identification documents
  'Bags & Wallets': 4,      // Wallets and bags
  'Keys': 3,                // Keys and access items
  'Academic Materials': 2,  // Academic materials
  'Accessories': 3,         // Accessories
  'Clothing': 2,            // Clothing
};

export const ACTION_POINTS = {
  REPORT_ITEM: 8,     // Report found item
  SURRENDER_ITEM: 8,  // Surrender to SAO — same value as reporting
  ITEM_CLAIMED: 4,    // Found item successfully claimed by its rightful owner
};

export const REASON_LABELS = {
  REPORT_ITEM: 'Reported found item',
  SURRENDER_ITEM: 'Surrendered item',
  ITEM_CLAIMED: 'Item claimed by owner',
};

// Unknown category/action falls back to 0 instead of throwing, so a typo'd
// or newly-added category never breaks the flow — it just scores 0 for that part.
export function calculatePoints(category, actionType) {
  const categoryPts = CATEGORY_POINTS[category] ?? 0;
  const actionPts = ACTION_POINTS[actionType] ?? 0;
  return categoryPts + actionPts;
}

export function reasonLabel(reason) {
  return REASON_LABELS[reason] || reason;
}