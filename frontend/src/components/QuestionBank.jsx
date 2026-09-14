import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, HelpCircle, AlertCircle, X, Tag, Sparkles } from 'lucide-react';

// Kept in sync with the item categories used in FoundItems.jsx (CATS) and
// ClaimModal.jsx (CATEGORY_QUESTIONS), plus two special filter/tag values:
// - 'All'     → filter-only, matches every question regardless of category
// - 'General' → a real question category. Presets tagged General apply to
//               every item category (see the "General or matching
//               category" filtering logic in ClaimModal.jsx / FoundItems.jsx)
const CATEGORIES = [
  'All',
  'General',
  'Accessories',
  'ID',
  'Academic Materials',
  'Bags & Wallets',
  'Clothing',
  'Electronic',
  'Keys',
];

// Standard color options for the General "What color of the item?"
// question — kept as its own list since color, unlike brand, applies
// uniformly across every category rather than being category-specific.
const COLORS = [
  'Black', 'White', 'Gray', 'Silver', 'Gold', 'Rose Gold', 'Brown', 'Beige', 'Red',
  'Orange', 'Yellow', 'Green', 'Blue', 'Navy', 'Purple', 'Pink', 'Maroon', 'Brass',
  'Bronze', 'Copper', 'Clear',
];

// Standard distinctive-feature options for the General "What design or
// distinctive features does the item have?" question — like COLORS, this
// applies uniformly across every category rather than being
// category-specific (a sticker or keychain charm can turn up on a bag,
// a phone case, an ID lanyard, etc). 'Other' covers anything not listed;
// 'None' is for items with no distinguishing marks at all.
const DESIGN_FEATURES = [
  'Sticker', 'Keychain', 'Charm', 'Pin', 'Patch', 'Embroidery', 'Logo', 'Name Label',
  'Initials', 'Engraving', 'Lanyard', 'Strap', 'Case/Cover', 'Skin', 'PopSocket',
  'Photo', 'Character', 'Plush', 'Acrylic', 'Metal', 'Rubber', 'Ribbon', 'Bow',
  'Scarf', 'Tag', 'Clip', 'Beads', 'Gemstones', 'Custom Print', 'Custom Drawing',
  'Other', 'None',
];

// Quick-load lists for the 'General' category — unlike CATEGORY_BRANDS/
// CATEGORY_SIZES (keyed by item category), General has no single
// category key of its own, so without this the "Load standard list"
// button never appeared for General questions even though COLORS and
// DESIGN_FEATURES already existed. Keyed by a short label shown on the
// button itself.
const GENERAL_OPTION_LISTS = {
  Color: COLORS,
  'Design/Distinctive Features': DESIGN_FEATURES,
};

// Reference brand/issuer lists per item category, flattened and
// deduplicated from the campus Lost & Found brand list (Philippine/Local
// + Foreign brands merged into one list per category — the sub-type
// split, e.g. "Watches" vs "Belts" under Accessories, isn't tracked
// since a single question's options are one flat list). ID uses card/
// document *issuers* instead of brands, per that reference list.
// Used to one-click populate a new question's Predefined Answer Choices
// (see handleLoadCategoryList) and to seed the default "What brand...?"
// / "Who issued...?" question per category below.
const CATEGORY_BRANDS = {
  Accessories: [
    'Bench', 'Penshoppe', 'Kultura', 'Casio', 'G-Shock', 'Seiko', 'Citizen', 'Fossil',
    'Timex', 'Swatch', 'Rolex', 'Tissot', 'Daniel Wellington', 'Apple', 'Samsung',
    'Garmin', 'Xiaomi', 'Huawei', 'Amazfit', 'Jewelmer', 'Haliya', 'Hiraya',
    'Golden South Sea Pearls', 'Pandora', 'Swarovski', 'Tiffany & Co.', 'Cartier',
    'Bvlgari', 'Michael Kors', 'Coach', 'Kate Spade', 'Sunnies Studios', 'Ideal Vision',
    'EO Executive Optical', 'Ray-Ban', 'Oakley', 'JINS', 'Gucci', 'Prada', 'Persol',
    'Polaroid', 'OXGN', 'Team Manila', 'Bocu', 'Regatta', 'Nike', 'Adidas', 'Puma',
    'New Era', 'Vans', 'Converse', 'Under Armour', 'ForMe', 'Memo', "Levi's",
    'Calvin Klein', 'Zara', 'Tommy Hilfiger', 'Lacoste',
  ],
  ID: [
    'PSA / PhilSys — National ID', 'LTO — Driver\u2019s License', 'DFA — Passport',
    'PRC — Professional ID', 'SSS', 'PhilHealth', 'Pag-IBIG', 'PHLPost — Postal ID',
    'Saint Louis College', 'School/University', 'Company/Employer', 'Government Agency',
    'Organization', 'BDO', 'BPI', 'Metrobank', 'PNB', 'UnionBank', 'RCBC',
    'Security Bank', 'LandBank', 'DBP', 'China Bank', 'EastWest Bank', 'AUB',
    'Maybank', 'HSBC', 'Citibank',
  ],
  'Academic Materials': [
    'Cattleya', 'Advance', 'Corona', 'Best Buy', 'Expressions', 'National Book Store',
    'Kokuyo', 'Muji', 'Moleskine', 'Campus', 'Rhodia', 'Oxford', 'Clairefontaine',
    'Pilot', 'Uni', 'Zebra', 'Pentel', 'Faber-Castell', 'Stabilo', 'Schneider',
    'Paper Mate', 'Sharpie', 'Staedtler', 'Maped', 'Deli', 'Casio', 'Canon', 'Sharp',
    'Citizen', 'Texas Instruments', 'HP', 'Sakura', 'Crayola', 'Rex Book Store',
    'C&E Publishing', 'Pearson', 'McGraw Hill', 'Cengage', 'Wiley', 'Cambridge',
    'Macmillan', 'SanDisk', 'Kingston', 'Transcend', 'Toshiba', 'Lexar', 'Samsung',
    'Crucial', 'Western Digital',
  ],
  'Bags & Wallets': [
    'Hawk', 'Tiger', 'Straightforward', 'Bench', 'Penshoppe', 'OXGN', 'World Balance',
    'Team Manila', 'Jansport', 'Herschel', 'Nike', 'Adidas', 'Puma', 'Fj\u00e4llr\u00e4ven',
    'The North Face', 'Doughnut', 'Eastpak', 'Samsonite', 'Targus', 'Case Logic',
    'Lenovo', 'HP', 'Dell', 'American Tourister', 'Aranaz', 'R2R', 'Kultura', 'Bayo',
    'ForMe', 'Uniqlo', 'Longchamp', 'Coach', 'Michael Kors', 'Kate Spade',
    'Charles & Keith', 'Baggu', 'Anello', 'Fossil', 'Calvin Klein', 'Tommy Hilfiger',
    'Lacoste', "Levi's", 'World Traveller', 'Delsey', 'Tumi', 'Victorinox', 'SwissGear',
  ],
  Clothing: [
    'Bench', 'Penshoppe', 'OXGN', 'Human', 'Oxygen', 'Memo', 'ForMe', 'Regatta', 'Bocu',
    'Bayo', 'Jag', 'RRJ', 'Team Manila', 'Straightforward', 'Nike', 'Adidas', 'Puma',
    'Uniqlo', 'H&M', 'Zara', "Levi's", 'Lacoste', 'Tommy Hilfiger', 'Calvin Klein',
    'Gap', 'Cotton On', 'Giordano', 'Under Armour', 'New Balance', 'Champion',
    'The North Face', 'Columbia', 'Vans', 'Converse', 'Wrangler', 'Lee', 'Dickies',
    'Carhartt', 'Plains & Prints', 'Kamiseta', 'R.A.F.', 'Mango', 'Forever 21',
    'Charles & Keith', 'World Balance', 'Rusty Lopez', 'Parisian', 'Bristol',
    'Easy Soft', 'Spartan', 'Islander', 'Banana Peel', 'Tribu', 'Reebok', 'Skechers',
    'Crocs', 'Asics', 'Fila', 'On', 'Hoka', 'Havaianas', 'Birkenstock',
    'Hanes Philippines', 'Jockey', 'Hanes',
  ],
  Electronic: [
    'Cherry Mobile', 'MyPhone', 'Starmobile', 'CloudFone', 'Torque', 'Apple', 'Samsung',
    'Xiaomi', 'Redmi', 'Oppo', 'Vivo', 'Realme', 'Huawei', 'Google Pixel', 'OnePlus',
    'Nokia', 'Motorola', 'Asus', 'Sony', 'HP', 'Dell', 'Lenovo', 'Acer', 'MSI',
    'Microsoft', 'Razer', 'Amazfit', 'Garmin', 'Fitbit', 'Casio', 'JBL', 'Anker',
    'Soundcore', 'Jabra', 'Bose', 'Sennheiser', 'Skullcandy', 'Audio-Technica',
    'Logitech', 'Marshall', 'Harman Kardon', 'Romoss', 'UGREEN', 'Baseus', 'Aukey',
    'Belkin', 'A4Tech', 'Redragon', 'Corsair', 'SteelSeries', 'Canon', 'Nikon',
    'Fujifilm', 'Panasonic', 'GoPro', 'DJI', 'Kodak', 'Epson', 'Brother',
  ],
  Keys: [
    'Union', 'Yale', 'Schlage', 'Kwikset', 'Dormakaba', 'Master Lock', 'Ace', 'Rusi',
    'MotorStar', 'Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'KTM', 'Vespa', 'Kymco',
    'Toyota', 'Mitsubishi', 'Nissan', 'Isuzu', 'Ford', 'Mazda', 'Hyundai', 'Kia',
    'Chevrolet', 'Subaru', 'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen',
  ],
};

// Reference size options per item category, flattened from the campus
// Lost & Found size reference sheet (unlike COLORS/CATEGORY_BRANDS, size
// units genuinely differ per category — inches for bags/electronics,
// garment sizing for clothing, key counts for Keys, etc. — so each
// category keeps its own list rather than sharing one). Note: the
// reference sheet's "Electronics" section maps to the "Electronic"
// category value used throughout this app.
// Used to one-click populate a question's Predefined Answer Choices
// (see handleLoadCategorySizeList) and to seed the default "What size...?"
// question per category below.
const CATEGORY_SIZES = {
  Accessories: [
    'Small', 'Medium', 'Large', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size',
    'Adjustable', 'Short', 'Medium Length', 'Long', 'Ring Size 5–12', 'Other', 'Unknown',
  ],
  ID: [
    'Standard ID Size', 'Standard Card Size', 'Passport Size', 'Other', 'Unknown',
  ],
  'Academic Materials': [
    'Small', 'Medium', 'Large', 'Pocket', 'A5', 'A4', 'Letter', 'Legal', 'Short',
    'Long', '6 inches', '12 inches', '18 inches', '24 inches', 'Standard', 'Other',
    'Unknown',
  ],
  'Bags & Wallets': [
    'Mini', 'Small', 'Medium', 'Large', 'XL', 'XXL', 'Carry-on', '11 inches',
    '13 inches', '14 inches', '15 inches', '16 inches', '17 inches', 'Other', 'Unknown',
  ],
  Clothing: [
    'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL', '26', '28', '30',
    '32', '34', '36', '38', '40', '42', '44', 'One Size', 'Adjustable', 'Other',
    'Unknown',
  ],
  Electronic: [
    'Mini', 'Small', 'Medium', 'Large', 'Compact', 'Standard', '7 inches', '8 inches',
    '10 inches', '11 inches', '12 inches', '13 inches', '14 inches', '15 inches',
    '16 inches', '17 inches', '19 inches', '21 inches', '24 inches', '27 inches',
    '32 inches', '34+ inches', '256GB', '512GB', '1TB', '2TB', '4TB', '5TB+', 'Other',
    'Unknown',
  ],
  Keys: [
    'Mini', 'Small', 'Standard', 'Large', '2 Keys', '3 Keys', '4+ Keys', 'Other',
    'Unknown',
  ],
};

// `options` is optional. When empty, the question behaves exactly as
// before (free-text answer). When populated, it's a predefined set of
// answer choices for that question — e.g. category "Clothing" + question
// "What brand?" → ["Nike", "Penshoppe", "Adidas", ...]. ClaimModal.jsx and
// FoundItems.jsx should check `question.options?.length` and render a
// dropdown/select of those choices instead of a free-text input whenever
// it's non-empty.
const INITIAL_QUESTIONS = [
  { id: 1, text: "What color of the item?", category: "General", options: COLORS },
  { id: 2, text: "What brand of the item?", category: "General", options: [] },
  { id: 3, text: "What size of the item?", category: "General", options: [] },
  // General (applies to every category) rather than tied to one, since
  // stickers/keychains/engravings etc. can show up on any item type.
  { id: 18, text: "What design or distinctive features does the item have?", category: "General", options: DESIGN_FEATURES },
  // One preset brand/issuer question per category, pre-populated from
  // CATEGORY_BRANDS so moderators get a dropdown of real-world options
  // out of the box instead of free-text. ID uses "issuer" wording since
  // its options are card/document issuers, not brands.
  { id: 4, text: "What brand of the item?", category: "Accessories", options: CATEGORY_BRANDS.Accessories },
  { id: 5, text: "Who issued this ID/card?", category: "ID", options: CATEGORY_BRANDS.ID },
  { id: 6, text: "What brand of the item?", category: "Academic Materials", options: CATEGORY_BRANDS["Academic Materials"] },
  { id: 7, text: "What brand of the item?", category: "Bags & Wallets", options: CATEGORY_BRANDS["Bags & Wallets"] },
  { id: 8, text: "What brand of the item?", category: "Clothing", options: CATEGORY_BRANDS.Clothing },
  { id: 9, text: "What brand of the item?", category: "Electronic", options: CATEGORY_BRANDS.Electronic },
  { id: 10, text: "What brand of the item?", category: "Keys", options: CATEGORY_BRANDS.Keys },
  // One preset size question per category, pre-populated from
  // CATEGORY_SIZES — sizing units genuinely differ by category (garment
  // sizes, inches, key counts, storage capacity), so each gets its own
  // tailored list instead of one shared General size question.
  { id: 11, text: "What size of the item?", category: "Accessories", options: CATEGORY_SIZES.Accessories },
  { id: 12, text: "What size of the item?", category: "ID", options: CATEGORY_SIZES.ID },
  { id: 13, text: "What size of the item?", category: "Academic Materials", options: CATEGORY_SIZES["Academic Materials"] },
  { id: 14, text: "What size of the item?", category: "Bags & Wallets", options: CATEGORY_SIZES["Bags & Wallets"] },
  { id: 15, text: "What size of the item?", category: "Clothing", options: CATEGORY_SIZES.Clothing },
  { id: 16, text: "What size of the item?", category: "Electronic", options: CATEGORY_SIZES.Electronic },
  { id: 17, text: "What size of the item?", category: "Keys", options: CATEGORY_SIZES.Keys },
];

// Same key FoundItems.jsx reads from (getPresetQuestions). Keeping the
// admin/moderator-managed Question Bank and the Found Item form's preset
// dropdown in sync just means both sides agree on this one localStorage
// key — write here, read there.
const STORAGE_KEY = 'app_question_bank';

// Bump this whenever INITIAL_QUESTIONS is meaningfully changed (new
// preset list, restructured categories, etc). On load, if a browser's
// saved schema version doesn't match, its old cached question bank is
// wiped and fully replaced with the current INITIAL_QUESTIONS — this is
// what clears out stale leftover questions (e.g. old free-text presets)
// that would otherwise persist forever in localStorage across deploys.
const STORAGE_VERSION_KEY = 'app_question_bank_version';
const SCHEMA_VERSION = '3';

// Loads the bank from localStorage so a full page refresh / remount here
// doesn't wipe out anything previously added or edited — UNLESS the
// stored schema version is stale, in which case it's a full reseed (see
// STORAGE_VERSION_KEY above). Falls back to the starter set (and
// re-seeds storage with it) if nothing's saved yet, or if what's saved
// is corrupt/empty.
const loadQuestions = () => {
  try {
    const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    if (savedVersion !== SCHEMA_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_QUESTIONS));
      localStorage.setItem(STORAGE_VERSION_KEY, SCHEMA_VERSION);
      return INITIAL_QUESTIONS;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Backfill `options` for anything saved before this field existed.
        return parsed.map((q) => ({ options: [], ...q }));
      }
    }
  } catch (e) {
    console.error('Failed to load question bank from storage:', e);
  }
  return INITIAL_QUESTIONS;
};

export default function QuestionBank() {
  const [questions, setQuestions] = useState(loadQuestions);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Pagination — 10 questions per page, with Prev/Next controls below the
  // table. Kept as its own page index (not derived from filteredQuestions)
  // since the effect below resets it to page 1 whenever search/filter
  // change, so stale page numbers from a previous, larger result set never
  // point past the end of a newly filtered list.
  const [currentPage, setCurrentPage] = useState(1);
  const QUESTIONS_PER_PAGE = 10;

  // Which table rows have their full Predefined Choices list expanded —
  // rows default to a short preview (see OPTIONS_PREVIEW_LIMIT) so long
  // lists like a 60-brand Clothing list don't blow up the table.
  const [expandedOptionRows, setExpandedOptionRows] = useState(new Set());
  const OPTIONS_PREVIEW_LIMIT = 4;

  const toggleOptionsExpanded = (id) => {
    setExpandedOptionRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Form states
  const [formData, setFormData] = useState({ text: '', category: 'General', options: [] });
  // Staging input for the "add a predefined option" field — kept separate
  // from formData.options so typing doesn't require pressing Add on every
  // keystroke.
  const [optionDraft, setOptionDraft] = useState('');

  // Persist to localStorage every time the list changes (add, edit, or
  // delete all funnel through setQuestions, so one effect covers all
  // three). This is what actually makes new questions show up in the
  // Found Item form's preset dropdown. The version stamp is also kept
  // current here so a save after the initial reseed doesn't get wiped
  // again on the next load.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
      localStorage.setItem(STORAGE_VERSION_KEY, SCHEMA_VERSION);
    } catch (e) {
      console.error('Failed to save question bank to storage:', e);
    }
  }, [questions]);

  // Open modal for adding
  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setFormData({ text: '', category: 'General', options: [] });
    setOptionDraft('');
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (q) => {
    setEditingQuestion(q);
    setFormData({ text: q.text, category: q.category, options: q.options || [] });
    setOptionDraft('');
    setIsModalOpen(true);
  };

  // Adds the current draft to formData.options — supports comma-separated
  // entry too (e.g. pasting "Nike, Penshoppe, Adidas" adds all three at
  // once), trims whitespace, skips blanks, and skips case-insensitive
  // duplicates already in the list.
  const handleAddOption = () => {
    const pieces = optionDraft
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (pieces.length === 0) return;

    setFormData((prev) => {
      const existingLower = new Set(prev.options.map((o) => o.toLowerCase()));
      const additions = pieces.filter((p) => !existingLower.has(p.toLowerCase()));
      return { ...prev, options: [...prev.options, ...additions] };
    });
    setOptionDraft('');
  };

  // Merges the current category's standard brand/issuer list (from
  // CATEGORY_BRANDS) into formData.options — same case-insensitive
  // dedupe as handleAddOption, so re-clicking or switching categories
  // never produces duplicate tags.
  const handleLoadCategoryList = () => {
    const preset = CATEGORY_BRANDS[formData.category];
    if (!preset || preset.length === 0) return;

    setFormData((prev) => {
      const existingLower = new Set(prev.options.map((o) => o.toLowerCase()));
      const additions = preset.filter((p) => !existingLower.has(p.toLowerCase()));
      return { ...prev, options: [...prev.options, ...additions] };
    });
  };

  // Same idea as handleLoadCategoryList, but merges the category's
  // standard size list (CATEGORY_SIZES) instead of its brand list.
  const handleLoadCategorySizeList = () => {
    const preset = CATEGORY_SIZES[formData.category];
    if (!preset || preset.length === 0) return;

    setFormData((prev) => {
      const existingLower = new Set(prev.options.map((o) => o.toLowerCase()));
      const additions = preset.filter((p) => !existingLower.has(p.toLowerCase()));
      return { ...prev, options: [...prev.options, ...additions] };
    });
  };

  // Same idea as handleLoadCategoryList/handleLoadCategorySizeList, but
  // for the General-only lists in GENERAL_OPTION_LISTS (Color,
  // Design/Distinctive Features) — merges by label instead of by
  // category since General isn't a key in CATEGORY_BRANDS/CATEGORY_SIZES.
  const handleLoadGeneralList = (label) => {
    const preset = GENERAL_OPTION_LISTS[label];
    if (!preset || preset.length === 0) return;

    setFormData((prev) => {
      const existingLower = new Set(prev.options.map((o) => o.toLowerCase()));
      const additions = preset.filter((p) => !existingLower.has(p.toLowerCase()));
      return { ...prev, options: [...prev.options, ...additions] };
    });
  };

  const handleOptionKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    }
  };

  const handleRemoveOption = (index) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  // Save (Create or Update)
  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.text.trim()) return;

    const cleanedOptions = formData.options.map((o) => o.trim()).filter(Boolean);

    if (editingQuestion) {
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === editingQuestion.id
            ? { ...item, text: formData.text.trim(), category: formData.category, options: cleanedOptions }
            : item
        )
      );
    } else {
      const newQuestion = {
        id: Date.now(),
        text: formData.text.trim(),
        category: formData.category,
        options: cleanedOptions,
      };
      setQuestions((prev) => [newQuestion, ...prev]);
    }

    setIsModalOpen(false);
  };

  // Confirm delete
  const handleConfirmDelete = () => {
    if (deletingId) {
      setQuestions((prev) => prev.filter((q) => q.id !== deletingId));
      setDeletingId(null);
    }
  };

  // Filtered List
  // 'All' matches every category; every other filter value (including
  // 'General') matches only questions tagged with that exact category.
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.text.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || q.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Whenever the search term or category filter narrows/widens the
  // result set, jump back to page 1 rather than leaving the user on a
  // page number that may no longer exist.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE));
  // Clamp defensively (e.g. if a question gets deleted while on the last
  // page) so the slice below never computes an out-of-range start index.
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuestions = filteredQuestions.slice(
    (safePage - 1) * QUESTIONS_PER_PAGE,
    safePage * QUESTIONS_PER_PAGE
  );

  return (
    <div className="min-h-screen w-full bg-slate-50 p-6 lg:p-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#0B648D] flex items-center gap-2">
            <HelpCircle size={26} /> Verification Question Bank
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage preset verification questions available for moderators and admins when reporting found items.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B648D] to-[#155F87] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg active:scale-[0.98]"
        >
          <Plus size={18} /> Add New Question
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search preset questions..."
            className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-[#1478a7]"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-700 outline-none focus:border-[#1478a7]"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                Category: {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Questions Table */}
      {filteredQuestions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <HelpCircle size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No verification questions found.</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search filter or add a new question.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gradient-to-r from-[#0B648D] to-[#155F87] text-white">
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Question</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Predefined Choices</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedQuestions.map((q) => (
                  <tr key={q.id} className="transition hover:bg-amber-50/40">
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      <span className="inline-block rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase text-amber-800">
                        {q.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top text-sm font-medium text-slate-800">
                      {q.text}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      {q.options && q.options.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Tag size={12} className="text-slate-400 shrink-0" />
                          {(expandedOptionRows.has(q.id)
                            ? q.options
                            : q.options.slice(0, OPTIONS_PREVIEW_LIMIT)
                          ).map((opt, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                            >
                              {opt}
                            </span>
                          ))}
                          {q.options.length > OPTIONS_PREVIEW_LIMIT && (
                            <button
                              type="button"
                              onClick={() => toggleOptionsExpanded(q.id)}
                              className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-bold text-[#0B648D] hover:bg-blue-50"
                            >
                              {expandedOptionRows.has(q.id)
                                ? 'Show less'
                                : `+${q.options.length - OPTIONS_PREVIEW_LIMIT} more`}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-400">Free-text</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(q)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-[#0B648D] hover:bg-blue-50 hover:text-[#0B648D]"
                          title="Edit Question"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeletingId(q.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                          title="Delete Question"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Page {safePage} of {totalPages}{' '}
                <span className="text-slate-400">({filteredQuestions.length} questions)</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-[#0B648D] hover:text-[#0B648D] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-[#0B648D] hover:text-[#0B648D] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Question Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#0B648D] to-[#155F87] px-6 py-4 text-white shrink-0">
              <h3 className="font-bold">
                {editingQuestion ? 'Edit Preset Question' : 'Add New Preset Question'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-700">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none focus:border-[#1478a7]"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-700">Question Text *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  placeholder="e.g. What brand is it?"
                  className="w-full resize-none rounded-xl border border-slate-300 p-3.5 text-sm text-slate-700 outline-none focus:border-[#1478a7]"
                  maxLength={150}
                />
                <p className="mt-1 text-right text-xs text-slate-400">{formData.text.length}/150 characters</p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-700">
                  Predefined Answer Choices (optional)
                </label>
                <p className="mb-2 text-xs text-slate-400">
                  Add specific choices claimants/moderators can pick from instead of typing a free-text
                  answer — e.g. for "What brand?" under Clothing: Nike, Penshoppe, Adidas. Leave empty to
                  keep this a free-text question.
                </p>

                {formData.category === 'General' &&
                  Object.entries(GENERAL_OPTION_LISTS).map(([label, list]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleLoadGeneralList(label)}
                      className="mb-2 mr-2 flex items-center gap-1.5 rounded-lg border border-dashed border-[#0B648D]/40 bg-blue-50/60 px-3 py-1.5 text-xs font-bold text-[#0B648D] transition hover:bg-blue-50"
                    >
                      <Sparkles size={13} />
                      Load standard {label} list
                      <span className="font-normal text-[#0B648D]/60">({list.length})</span>
                    </button>
                  ))}

                {CATEGORY_BRANDS[formData.category] && (
                  <button
                    type="button"
                    onClick={handleLoadCategoryList}
                    className="mb-2 flex items-center gap-1.5 rounded-lg border border-dashed border-[#0B648D]/40 bg-blue-50/60 px-3 py-1.5 text-xs font-bold text-[#0B648D] transition hover:bg-blue-50"
                  >
                    <Sparkles size={13} />
                    Load standard {formData.category === 'ID' ? 'issuer' : 'brand'} list for {formData.category}
                    <span className="font-normal text-[#0B648D]/60">
                      ({CATEGORY_BRANDS[formData.category].length})
                    </span>
                  </button>
                )}

                {CATEGORY_SIZES[formData.category] && (
                  <button
                    type="button"
                    onClick={handleLoadCategorySizeList}
                    className="mb-3 flex items-center gap-1.5 rounded-lg border border-dashed border-amber-400/50 bg-amber-50/60 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-50"
                  >
                    <Sparkles size={13} />
                    Load standard size list for {formData.category}
                    <span className="font-normal text-amber-700/60">
                      ({CATEGORY_SIZES[formData.category].length})
                    </span>
                  </button>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={optionDraft}
                    onChange={(e) => setOptionDraft(e.target.value)}
                    onKeyDown={handleOptionKeyDown}
                    placeholder="Type a choice and press Enter (or comma-separate several)"
                    className="h-10 flex-1 rounded-xl border border-slate-300 px-3.5 text-sm text-slate-700 outline-none focus:border-[#1478a7]"
                  />
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="shrink-0 rounded-xl bg-slate-800 px-4 text-sm font-bold text-white transition hover:bg-slate-700"
                  >
                    Add
                  </button>
                </div>

                {formData.options.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formData.options.map((opt, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 pl-3 pr-1.5 py-1 text-xs font-semibold text-[#0B648D]"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(i)}
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[#0B648D] hover:bg-blue-200"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#0B648D] to-[#155F87] py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition hover:shadow-lg active:scale-[0.98]"
                >
                  {editingQuestion ? 'Save Changes' : 'Add Question'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-11 rounded-xl bg-slate-200 px-6 text-sm font-bold uppercase text-slate-600 hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] bg-white px-8 py-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertCircle size={30} strokeWidth={2.5} />
            </div>

            <h5 className="mb-2 text-lg font-black text-[#144B70]">Delete Question?</h5>
            <p className="mb-6 text-sm font-medium text-[#5F6F8C]">
              Are you sure you want to remove this preset question from the global bank?
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="h-12 w-full rounded-xl bg-rose-600 text-sm font-black uppercase tracking-wide text-white shadow-md transition hover:bg-rose-700 active:scale-[0.98]"
              >
                Delete Question
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white text-sm font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
