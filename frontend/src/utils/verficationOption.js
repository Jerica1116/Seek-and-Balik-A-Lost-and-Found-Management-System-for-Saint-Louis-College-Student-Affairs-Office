// verificationOptions.js
//
// Predefined answer choices for verification questions ("color" / "brand"
// questions), plus the logic that decides which list applies based on the
// item's Category + Item Name.
//
// The lists themselves are editable by admins/moderators from the
// Question Bank page ("Predefined Answer Options" tab) and are persisted
// to localStorage — the same pattern FoundItems.jsx already uses for the
// Question Bank itself. Anything not yet customized falls back to
// DEFAULT_OPTION_SETS below.
//
// Import this same module wherever verification answers are collected or
// displayed (e.g. FoundItems.jsx, ClaimModal.jsx) so the lists stay in
// sync everywhere.

export const STORAGE_KEY = 'app_predefined_options';

// Human-readable labels + the order they're shown in the manager UI.
export const OPTION_SET_LABELS = {
  color: 'Color',
  laptop: 'Laptop Brands',
  cellphone: 'Cellphone Brands',
  watch: 'Watch Brands',
  bagWallet: 'Bags & Wallets Brands',
};

export const OPTION_SET_KEYS = Object.keys(OPTION_SET_LABELS);

export const DEFAULT_OPTION_SETS = {
  color: [
    'Black', 'White', 'Gray', 'Silver', 'Gold', 'Rose Gold', 'Brown', 'Beige', 'Red', 'Pink',
    'Blue', 'Green', 'Purple', 'Yellow', 'Orange', 'Multicolor', 'Transparent/Clear', 'Other',
  ],
  laptop: [
    'Apple', 'ASUS', 'Acer', 'Lenovo', 'Dell', 'HP', 'MSI', 'Samsung', 'Microsoft', 'Huawei',
    'Razer', 'Toshiba', 'Gigabyte', 'LG', 'Other / Unknown',
  ],
  cellphone: [
    'Apple', 'Samsung', 'Xiaomi', 'Redmi', 'POCO', 'OPPO', 'Vivo', 'Realme', 'Huawei', 'OnePlus',
    'Google', 'Motorola', 'Nokia', 'Infinix', 'Tecno', 'ASUS', 'Sony', 'ZTE', 'Honor', 'Nothing',
    'Other / Unknown',
  ],
  watch: [
    'Casio', 'Seiko', 'Citizen', 'Rolex', 'Fossil', 'Swatch', 'Timex', 'Tissot', 'Omega', 'Tag Heuer',
    'Orient', 'G-Shock', 'Apple', 'Samsung', 'Garmin', 'Huawei', 'Xiaomi', 'Amazfit', 'Fitbit',
    'Other / Unknown',
  ],
  bagWallet: [
    'Local Brand', 'Jansport', 'Herschel', 'Nike', 'Adidas', 'Puma', 'Under Armour', 'Converse',
    'The North Face', 'Fjällräven', 'Kipling', 'Coach', 'Michael Kors', 'Kate Spade', 'Guess',
    'Lacoste', 'Tommy Hilfiger', 'Calvin Klein', 'Louis Vuitton', 'Gucci', 'Prada', 'Uniqlo',
    'Other / Unknown',
  ],
};

// Backwards-compatible named exports (in case anything imports these
// static lists directly instead of going through loadOptionSets()).
export const COLOR_OPTIONS = DEFAULT_OPTION_SETS.color;
export const LAPTOP_BRANDS = DEFAULT_OPTION_SETS.laptop;
export const CELLPHONE_BRANDS = DEFAULT_OPTION_SETS.cellphone;
export const WATCH_BRANDS = DEFAULT_OPTION_SETS.watch;
export const BAG_WALLET_BRANDS = DEFAULT_OPTION_SETS.bagWallet;

/**
 * Load the current (possibly admin-edited) option sets from localStorage,
 * filling in any missing keys from the defaults so older saved data still
 * works if new option sets get added later.
 */
export function loadOptionSets() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_OPTION_SETS, ...parsed };
      }
    }
  } catch (e) {
    console.error('Failed to load predefined options from storage:', e);
  }
  return { ...DEFAULT_OPTION_SETS };
}

/** Persist the full set of option lists to localStorage. */
export function saveOptionSets(optionSets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(optionSets));
    return true;
  } catch (e) {
    console.error('Failed to save predefined options to storage:', e);
    return false;
  }
}

/** Reset a single option set (e.g. 'color') back to its default list. */
export function resetOptionSet(key) {
  const current = loadOptionSets();
  const next = { ...current, [key]: DEFAULT_OPTION_SETS[key] };
  saveOptionSets(next);
  return next;
}

// Keyword hints used to figure out WHAT KIND of item we're dealing with,
// based on the free-text Item Name the staff typed in (e.g. "Black
// MacBook Pro 13-inch" -> laptop brands, "iPhone 13" -> cellphone brands).
const LAPTOP_KEYWORDS = /laptop|notebook|macbook|chromebook|netbook|ultrabook/i;
const CELLPHONE_KEYWORDS = /phone|iphone|smartphone|cellphone|android|galaxy|redmi|poco|\boppo\b|\bvivo\b|realme/i;
const WATCH_KEYWORDS = /watch/i; // covers "watch" and "smartwatch"

/**
 * Figure out which brand list applies for the current item.
 * Item Name keywords take priority (most specific), then Category is used
 * as a fallback for categories that map to a single brand list.
 *
 * Returns an array of brand strings, or null if nothing confidently matches
 * (in which case the caller should fall back to a free-text input).
 */
export function getBrandOptions(category, itemTitle = '') {
  const title = (itemTitle || '').toLowerCase();
  const optionSets = loadOptionSets();

  if (WATCH_KEYWORDS.test(title)) return optionSets.watch;
  if (LAPTOP_KEYWORDS.test(title)) return optionSets.laptop;
  if (CELLPHONE_KEYWORDS.test(title)) return optionSets.cellphone;

  if (category === 'Bags & Wallets') return optionSets.bagWallet;

  // Electronic category with no laptop/phone keyword in the name is too
  // ambiguous to guess a brand list for (could be a laptop, phone, tablet,
  // earbuds, etc.) — let the staff type it in instead.
  return null;
}

/**
 * Given a verification question's text plus the item's Category and Item
 * Name, return the predefined list of valid answers for that question, or
 * null if the question doesn't have a predefined list (free text applies).
 *
 * Matching is done on the question text itself so this works whether the
 * question was picked from the Question Bank or typed in manually.
 */
export function getPresetAnswerOptions(questionText, category, itemTitle) {
  if (!questionText) return null;
  const q = questionText.toLowerCase();

  if (q.includes('color') || q.includes('colour')) return loadOptionSets().color;
  if (q.includes('brand')) return getBrandOptions(category, itemTitle);

  return null;
}