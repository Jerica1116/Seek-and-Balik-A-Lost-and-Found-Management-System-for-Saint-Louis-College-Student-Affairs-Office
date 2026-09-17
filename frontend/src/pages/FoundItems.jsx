import React, { useEffect, useState, useRef } from 'react';
import { Eye, X, Pencil, CheckCircle, Archive, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getItems,
  getItemById,
  API_URL,
  editLostItem,
  createLostItem,
  deleteLostItem,
  addPointsRecord,
  getUsers,
  createUser,
  getClaims,
} from "../api/api";
import { calculatePoints } from '../utils/PointingSystem';
import PhotoUpload from '../components/PhotoUpload';
import { logActivity } from '../utils/activityLog';


const PREDEFINED_OPTIONS_STORAGE_KEY = 'app_predefined_options';

/** Load the current (possibly admin-edited) fallback option sets from storage. */
function loadOptionSets() {
  try {
    const saved = localStorage.getItem(PREDEFINED_OPTIONS_STORAGE_KEY);
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

// Keyword hints used to figure out WHAT KIND of item we're dealing with,
// based on the free-text Item Name the staff typed in (e.g. "Black
// MacBook Pro 13-inch" -> laptop brands, "iPhone 13" -> cellphone brands).
const LAPTOP_KEYWORDS = /laptop|notebook|macbook|chromebook|netbook|ultrabook/i;
const CELLPHONE_KEYWORDS = /phone|iphone|smartphone|cellphone|android|galaxy|redmi|poco|\boppo\b|\bvivo\b|realme/i;
const WATCH_KEYWORDS = /watch/i; // covers "watch" and "smartwatch"

/**
 * Figure out which brand list applies for the current item. Item Name
 * keywords take priority (most specific), then Category is used as a
 * fallback for categories that map to a single brand list. Returns null if
 * nothing confidently matches (caller falls back to free text).
 */
function getBrandOptions(category, itemTitle = '') {
  const title = (itemTitle || '').toLowerCase();
  const optionSets = loadOptionSets();

  if (WATCH_KEYWORDS.test(title)) return optionSets.watch;
  if (LAPTOP_KEYWORDS.test(title)) return optionSets.laptop;
  if (CELLPHONE_KEYWORDS.test(title)) return optionSets.cellphone;

  if (category === 'Bags & Wallets') return optionSets.bagWallet;

  return null;
}

/**
 * Given a verification question's text plus the item's Category and Item
 * Name, return the predefined list of valid answers for that question, or
 * null if the question doesn't have a predefined list (free text applies).
 *
 * See the header comment above DEFAULT_OPTION_SETS for the two-step lookup
 * this performs: an exact Question Bank preset match (with its own
 * `options`) wins first; a generic color/brand keyword fallback applies
 * only when there's no such match.
 */
function getPresetAnswerOptions(questionText, category, itemTitle) {
  if (!questionText) return null;
  const trimmedQuestion = questionText.trim();
  if (!trimmedQuestion) return null;

  // 1. Question Bank preset match — exact text, case-insensitive. If more
  // than one bank entry shares this exact wording (e.g. saved under
  // different categories), prefer one tagged for this item's Category or
  // "General", mirroring the visibility rule used for the preset dropdown
  // below; otherwise fall back to the first text match found.
  const bankCandidates = getPresetQuestions().filter(
    (qObj) =>
      typeof qObj === 'object' &&
      typeof qObj.text === 'string' &&
      qObj.text.trim().toLowerCase() === trimmedQuestion.toLowerCase()
  );

  const bankMatch =
    bankCandidates.find((qObj) => qObj.category === category || qObj.category === 'General') ||
    bankCandidates[0];

  if (bankMatch && Array.isArray(bankMatch.options) && bankMatch.options.length > 0) {
    return bankMatch.options;
  }

  // 2. Generic color/brand keyword fallback.
  const q = trimmedQuestion.toLowerCase();
  if (q.includes('color') || q.includes('colour')) return loadOptionSets().color;
  if (q.includes('brand')) return getBrandOptions(category, itemTitle);

  return null;
}

const AREAS = [
  'Grandstand',
  'Criminology Building',
  'Verbist Building',
  'Chapel',
  'Administrative Building (Main Building)',
  'Library',
  'Gymnasium',
  'ICT Center',
  'New Building (CEA Building)',
  'New Elementary Building',
  'SLC Canteen',
  'Old Elementary Building',
  'Conrado Dela Cruz Sports Center (CDC)',
  'Senior High School Department Building',
  'HM Laboratory Building',
  'Student Affairs Office Lobby',
  'Others'
];

const CATS = ['Accessories', 'ID', 'Academic Materials', 'Bags & Wallets', 'Clothing', 'Electronic', 'Keys'];
const STATUSES = ['Pending', 'Claimed', 'Approved'];

// ─── Item Name presets ──────────────────────────────────────────────────────
// Predefined Item Name choices per Category, used to drive the Item Name
// dropdown once a Category is selected. Keys must match the CATS values
// above exactly. "Other (please specify)" is always appended in the UI so
// staff can still type something not on the list.
const ITEM_NAME_OPTIONS = {
  'Accessories': [
    'Watch', 'Bracelet', 'Necklace', 'Ring', 'Earrings', 'Hair Clip', 'Hair Tie',
    'Sunglasses', 'Eyeglasses', 'Cap/Hat', 'Keychain', 'ID Lace', 'Brooch/Pin', 'Belt'
  ],
  'ID': [
    'Student ID', 'School ID', "Driver's License", 'Passport', 'Government ID',
    'Company/Employee ID', 'PhilHealth ID', 'UMID', 'ATM/Debit Card', 'Library Card',
    'Other Identification Card'
  ],
  'Academic Materials': [
    'Notebook', 'Binder', 'Folder', 'Envelope', 'Textbook', 'Reference Book', 'Module',
    'Reviewer', 'Printed Document', 'Assignment', 'Examination Paper', 'Index Card',
    'Yellow Pad', 'Calculator', 'Ruler', 'Pencil', 'Ballpen', 'Marker/Highlighter',
    'Eraser', 'Pencil Case', 'Art Materials', 'USB/Flash Drive'
  ],
  'Bags & Wallets': [
    'Backpack', 'School Bag', 'Shoulder Bag', 'Tote Bag', 'Sling Bag', 'Laptop Bag',
    'Handbag', 'Purse', 'Wallet', 'Coin Purse', 'Pouch', 'Pencil Case', 'Drawstring Bag',
    'Travel Bag'
  ],
  'Clothing': [
    'T-Shirt', 'Polo Shirt', 'Uniform', 'Jacket', 'Hoodie', 'Sweater', 'Pants', 'Jeans',
    'Shorts', 'Skirt', 'Dress', 'Socks', 'Shoes', 'Slippers', 'Sneakers', 'Underwear',
    'Scarf', 'Gloves', 'Raincoat'
  ],
  'Electronic': [
    'Mobile Phone', 'Laptop', 'Tablet', 'iPad', 'Smartwatch', 'Digital Camera',
    'Calculator', 'Power Bank', 'Charger', 'Charging Cable', 'Earphones', 'Earbuds',
    'Headphones', 'Bluetooth Speaker', 'USB Flash Drive', 'External Hard Drive', 'Mouse',
    'Keyboard', 'Adapter', 'Power Supply', 'HDMI Cable'
  ],
  'Keys': [
    'House Key', 'Room Key', 'Classroom Key', 'Office Key', 'Cabinet Key', 'Locker Key',
    'Padlock Key', 'Motorcycle Key', 'Car Key', 'Key Set', 'Duplicate Key',
    'Keychain with Keys'
  ]
};

// Marker value used by the Item Name <select> to represent "the staff wants
// to type a custom name that isn't on the predefined list for this Category".
const OTHER_ITEM_NAME = '__other__';

/** True when `title` is non-empty and not one of the predefined choices for
 * `category` — i.e. the Item Name field should show as free-text/custom. */
function isCustomItemName(title, category) {
  if (!title) return false;
  const options = ITEM_NAME_OPTIONS[category] || [];
  return !options.includes(title);
}

// Fixed domain suffix appended to the 8-digit ID Number to form the full
// school ID (e.g. "12345678" -> "12345678@slc-sflu.edu.ph"). This is the
// same suffix Users.jsx uses for Student accounts, so a finder's ID
// Number always lines up with their account email in User Management.
const ID_NUMBER_DOMAIN = '@slc-sflu.edu.ph';

const DEFAULT_PRESETS = [
  { text: "What is the main color of the item?", category: "General", options: [] },
  { text: "What brand is the item?", category: "General", options: [] },
  { text: "What is the size of the item?", category: "General", options: [] },
];

const statusColor = (s) =>
  s === 'Claimed' ? 'bg-purple-100 text-purple-500' :
  s === 'Pending' ? 'bg-orange-100 text-orange-500' :
  'bg-green-100 text-green-500';

const EMPTY = {
  title: '',
  category: 'Accessories',
  poster_first_name: '',
  poster_last_name: '',
  id_number: '',
  location: [],
  created_date: '',
  created_date_to: '',
  created_time: '',
  created_time_to: '',
  description: '',
  verification_question_1: '',
  verification_answer_1: '',
  verification_question_2: '',
  verification_answer_2: '',
  verification_question_3: '',
  verification_answer_3: '',
  verification_question_4: '',
  verification_answer_4: '',
  status: 'Pending',
  image: null
};

function toTitleCase(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Fetch dynamic questions stored in LocalStorage by the Question Bank
const getPresetQuestions = () => {
  try {
    const saved = localStorage.getItem('app_question_bank');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Backfill `options` for anything saved before that field existed,
        // so callers can always safely check qObj.options.length.
        return parsed.map((q) => ({ options: [], ...q }));
      }
    }
  } catch (e) {
    console.error("Failed to load preset questions from storage:", e);
  }
  return DEFAULT_PRESETS;
};

// ─── Location helpers ──────────────────────────────────────────────────────
// The item's "location" is stored on the backend as a single text field.
// The form now works with a SINGLE selected area (not a multi-select), but
// we keep the underlying representation as a one-item array internally so
// the rest of the save/serialize pipeline (and any legacy multi-location
// data coming back from the backend) keeps working unchanged.

/** Turn a stored location value (string or array) into a working array of
 * selected AREAS values (using "Others" as the marker for custom entries),
 * plus the free-text for any custom ("Others") entries. Only the FIRST
 * area found is kept, since the field is single-select going forward. */
function parseStoredLocation(rawLocation, storedOtherText) {
  let list = [];
  if (Array.isArray(rawLocation)) {
    list = rawLocation.filter(Boolean);
  } else if (typeof rawLocation === 'string' && rawLocation.trim() !== '') {
    list = rawLocation.split(',').map((s) => s.trim()).filter(Boolean);
  }

  const known = list.filter((loc) => AREAS.includes(loc) && loc !== 'Others');
  const custom = list.filter((loc) => !AREAS.includes(loc));
  const hadOthersMarker = list.includes('Others');

  let otherText = storedOtherText || '';
  let selected = [];

  if (known.length > 0) {
    selected = [known[0]];
  } else if (custom.length > 0) {
    selected = ['Others'];
    otherText = custom.join(', ');
  } else if (hadOthersMarker) {
    selected = ['Others'];
  }

  return { selected, otherText };
}

/** Turn the working { location: [...], other_location } form state back into
 * a single comma-separated string for saving to the backend. With a
 * single-select field this will be at most one value. */
function serializeLocation(locationArr, otherText) {
  const list = Array.isArray(locationArr) ? locationArr : [];
  const named = list.filter((a) => a !== 'Others');
  const custom = list.includes('Others')
    ? (otherText || '').split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return [...named, ...custom].join(', ');
}

// ─── Found-by name helpers ──────────────────────────────────────────────────
// "Found By" is still stored on the backend as a single `poster_name` field,
// but the form works with separate First Name / Last Name inputs. These
// helpers convert between the two, splitting on the first whitespace when
// only a combined name is available (e.g. an item saved before this split
// existed, or one coming straight from the backend).
function parsePosterName(source) {
  if (!source) return { first: '', last: '' };
  if (source.poster_first_name || source.poster_last_name) {
    return {
      first: source.poster_first_name || '',
      last: source.poster_last_name || '',
    };
  }
  const full = (source.poster_name || '').trim();
  if (!full) return { first: '', last: '' };
  const parts = full.split(/\s+/);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

// ─── ID number helpers ──────────────────────────────────────────────────────
// The ID Number input only ever collects the 8 digits; the fixed
// ID_NUMBER_DOMAIN suffix is appended when saving. When loading an existing
// item, strip any non-digit characters (including an already-appended
// domain) back down to just the digits for the input.
function parseIdNumberDigits(source) {
  const raw = source?.id_number || '';
  return String(raw).replace(/\D/g, '').slice(0, 8);
}

// ─── Student account auto-provisioning ─────────────────────────────────────
// Every student who turns in a found item should have a matching account
// in User Management (Users.jsx), keyed by their ID Number — which is also
// their account email once the ID_NUMBER_DOMAIN suffix is appended (see
// Users.jsx's own ID_NUMBER_DOMAIN/parseIdNumberDigits, which mirror this).
// If no such account exists yet, one is created automatically so staff
// never have to leave this form to register a first-time finder
// separately. This never blocks the item submission itself — a hiccup
// here is logged and surfaced as a warning, not a failure.
//
// NOTE: the ItemModal now looks the account up as soon as the 8-digit ID
// Number is entered (see the finder-lookup effect below), so by the time
// this runs the account usually either already existed — in which case
// this is a cheap no-op — or genuinely doesn't exist yet and gets created
// from the name staff typed.
async function ensureStudentAccount(payload) {
  const email = payload.id_number; // already has the domain suffix appended
  if (!email) return { warning: '' };

  try {
    const users = await getUsers();
    const alreadyExists = (Array.isArray(users) ? users : []).some(
      (u) => (u.email || '').toLowerCase() === email.toLowerCase()
    );
    if (alreadyExists) return { warning: '' };

    const firstName = (payload.poster_first_name || '').trim();
    const lastName = (payload.poster_last_name || '').trim();

    await createUser({
      first_name: firstName,
      last_name: lastName,
      email,
      contact_number: '',
      role: 'student',
    });
    return { warning: '' };
  } catch (err) {
    console.error('Failed to auto-provision student account:', err.response?.data || err.message);
    return {
      warning: '\n\n⚠️ However, a student account could not be auto-created for this ID Number (see console for details).',
    };
  }
}

const ItemModal = ({ item, onSave, onClose }) => {
  const [saving, setSaving] = useState(false);
  const [presetQuestions, setPresetQuestions] = useState([]);

  const normalizeForm = (source) => {
    const base = source || EMPTY;
    const { selected, otherText } = parseStoredLocation(base.location, base.other_location);
    const { first, last } = parsePosterName(base);
    const idDigits = parseIdNumberDigits(base);

    return {
      ...base,
      location: selected,
      other_location: otherText,
      poster_first_name: first,
      poster_last_name: last,
      id_number: idDigits,
      created_date_to: base.created_date_to || '',
      created_time_to: base.created_time_to || '',
    };
  };

  const [form, setForm] = useState(normalizeForm(item));
  const isEdit = !!item;

  // Whether the Item Name field is currently in "custom text" mode (staff
  // picked "Other (please specify)", or the item's saved title isn't one of
  // the predefined choices for its Category — e.g. legacy data).
  const [itemNameOther, setItemNameOther] = useState(() =>
    isCustomItemName(normalizeForm(item).title, normalizeForm(item).category)
  );

  // ─── Finder lookup by ID Number ───────────────────────────────────────────
  // The ID Number is the FIRST field in this form, because it identifies
  // the finder. As soon as it reaches 8 digits we look the account up in
  // User Management (keyed by <digits>@slc-sflu.edu.ph — the same
  // convention Users.jsx uses). If an account exists, Found By First/Last
  // Name are filled from that account and locked read-only, so a
  // registered finder's name can never be spelled differently from one
  // item to the next; the account record in User Management stays the
  // single source of truth. If no account exists, the name fields stay
  // editable and ensureStudentAccount() creates the account on save, as
  // before.
  //
  // 'idle' | 'loading' | 'found' | 'notfound' | 'error'
  const [lookupStatus, setLookupStatus] = useState('idle');

  // Tracks whether the name currently in the form was put there by the
  // lookup (as opposed to typed by staff or loaded from an existing item),
  // so clearing the ID Number only ever wipes OUR auto-fill.
  const autoFilledRef = useRef(false);

  const nameLocked = lookupStatus === 'found';

  // Load latest Question Bank entries on modal mount
  useEffect(() => {
    setPresetQuestions(getPresetQuestions());
  }, []);

  useEffect(() => {
    const normalized = normalizeForm(item);
    setForm(normalized);
    setItemNameOther(isCustomItemName(normalized.title, normalized.category));
    autoFilledRef.current = false;
    setLookupStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  // Debounced account lookup driven purely by the ID Number field.
  useEffect(() => {
    const digits = form.id_number || '';

    if (digits.length !== 8) {
      setLookupStatus('idle');
      if (autoFilledRef.current) {
        autoFilledRef.current = false;
        setForm((prev) => ({ ...prev, poster_first_name: '', poster_last_name: '' }));
      }
      return;
    }

    let cancelled = false;
    setLookupStatus('loading');

    const timer = setTimeout(async () => {
      try {
        const users = await getUsers();
        if (cancelled) return;

        const email = `${digits}${ID_NUMBER_DOMAIN}`.toLowerCase();
        const match = (Array.isArray(users) ? users : []).find(
          (u) => (u.email || '').toLowerCase() === email
        );

        if (match) {
          autoFilledRef.current = true;
          setForm((prev) =>
            prev.id_number === digits
              ? {
                  ...prev,
                  poster_first_name: match.first_name || '',
                  poster_last_name: match.last_name || '',
                }
              : prev
          );
          setLookupStatus('found');
        } else {
          if (autoFilledRef.current) {
            autoFilledRef.current = false;
            setForm((prev) => ({ ...prev, poster_first_name: '', poster_last_name: '' }));
          }
          setLookupStatus('notfound');
        }
      } catch (err) {
        if (cancelled) return;
        // Never trap staff behind read-only fields we can't fill — fall
        // back to manual entry when the lookup itself fails.
        console.error('Finder lookup failed:', err.response?.data || err.message);
        setLookupStatus('error');
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id_number]);

  const set = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Changing Category swaps the predefined Item Name list, so the
  // previously selected/typed name almost never still applies. Reset the
  // Item Name back to "choose one" mode whenever Category changes, unless
  // the current title happens to also exist in the new category's list.
  const setCategory = (newCategory) => {
    setForm((prev) => {
      const stillValid = (ITEM_NAME_OPTIONS[newCategory] || []).includes(prev.title);
      return {
        ...prev,
        category: newCategory,
        title: stillValid ? prev.title : '',
      };
    });
    setItemNameOther(false);
  };

  // Only digits are ever accepted for the ID Number field, capped at 8
  // characters — anything else typed/pasted is silently stripped.
  const setIdNumber = (value) => {
    const digitsOnly = (value || '').replace(/\D/g, '').slice(0, 8);
    set('id_number', digitsOnly);
  };

  // Area Found is a single-select field: picking a new area always
  // replaces whatever was selected before. Switching away from "Others"
  // also clears the free-text field for the custom location.
  const setLocation = (area) => {
    setForm((prev) => ({
      ...prev,
      location: area ? [area] : [],
      ...(area !== 'Others' ? { other_location: '' } : {}),
    }));
  };

  // Whenever the Category, Item Name, or any of the 4 verification
  // questions change, the predefined answer list for a question can
  // change too (e.g. a Question Bank preset swapped for another, or the
  // item name goes from "MacBook Pro" to "iPhone 13" -> brand list
  // switches from laptop brands to phone brands). If the answer
  // currently saved for that question no longer appears in the new
  // predefined list, clear it instead of silently keeping a now-invalid
  // answer selected.
  useEffect(() => {
    setForm((prev) => {
      let changed = false;
      const next = { ...prev };

      [1, 2, 3, 4].forEach((n) => {
        const qKey = `verification_question_${n}`;
        const aKey = `verification_answer_${n}`;
        const options = getPresetAnswerOptions(prev[qKey], prev.category, prev.title);
        if (options && prev[aKey] && !options.includes(prev[aKey])) {
          next[aKey] = '';
          changed = true;
        }
      });

      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.category,
    form.title,
    form.verification_question_1,
    form.verification_question_2,
    form.verification_question_3,
    form.verification_question_4,
  ]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;

    const today = new Date().toLocaleDateString("en-CA");
    if (form.created_date && form.created_date > today) {
      window.alert("Date reported cannot be in the future.");
      return;
    }
    if (form.created_date_to && form.created_date_to > today) {
      window.alert("Date reported (To) cannot be in the future.");
      return;
    }
    if (form.created_date && form.created_date_to && form.created_date_to < form.created_date) {
      window.alert("Date Found 'To' cannot be before 'From'.");
      return;
    }
    if (
      form.created_time &&
      form.created_time_to &&
      form.created_date &&
      form.created_date_to &&
      form.created_date === form.created_date_to &&
      form.created_time_to < form.created_time
    ) {
      window.alert("Time Found 'To' cannot be before 'From'.");
      return;
    }

    // ------------------------------------------------------------------
    // VALIDATION — each required field is checked individually with its
    // own window.alert(). Previously these were combined into a single
    // `if (...) return;` with no feedback at all, so clicking "Add Item"
    // with e.g. no Area Found selected did nothing visible — no error,
    // no save, no clue why.
    //
    // Checked in the same order the fields now appear in the form, so the
    // alert always points at the topmost unfinished field.
    // ------------------------------------------------------------------
    const hasLocation = Array.isArray(form.location) && form.location.length > 0;

    if (!/^\d{8}$/.test(form.id_number || "")) {
      window.alert("Please enter a valid 8-digit ID Number.");
      return;
    }
    if (lookupStatus === 'loading') {
      window.alert("Still checking this ID Number — please wait a moment and try again.");
      return;
    }
    if (!form.poster_first_name?.trim()) {
      window.alert("Please enter the First Name of who found the item.");
      return;
    }
    if (!form.poster_last_name?.trim()) {
      window.alert("Please enter the Last Name of who found the item.");
      return;
    }
    if (!hasLocation) {
      window.alert("Please select the Area Found.");
      return;
    }
    if (form.location.includes("Others") && !form.other_location?.trim()) {
      window.alert('Please specify the location for "Others".');
      return;
    }
    if (!form.title?.trim()) {
      window.alert("Please select or enter the Item Name.");
      return;
    }
    if (!form.created_date?.trim()) {
      window.alert("Please select the Date Found.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        location: serializeLocation(form.location, form.other_location),
        // Backend still stores a single combined name plus the full
        // ID Number (digits + fixed domain suffix); the split first/last
        // inputs are only a form-side convenience.
        poster_name: `${form.poster_first_name.trim()} ${form.poster_last_name.trim()}`.trim(),
        id_number: `${form.id_number}${ID_NUMBER_DOMAIN}`,
      };
      delete payload.other_location;
      delete payload.poster_first_name;
      delete payload.poster_last_name;

      // Attach the predefined answer-choice list (if any) for each
      // verification question, so ClaimModal.jsx can render the exact
      // same choices as a dropdown for the claimant. Sent as a JSON
      // string since these travel via FormData (multipart fields must be
      // strings) — see parseOptionList() in ClaimModal.jsx, which decodes
      // this back into an array. An empty string explicitly clears a
      // previously-saved list when a question no longer has one (e.g.
      // switched from a Question Bank preset with choices to a free-typed
      // question), rather than leaving a stale list behind.
      [1, 2, 3, 4].forEach((n) => {
        const qText = payload[`verification_question_${n}`];
        const options = getPresetAnswerOptions(qText, payload.category, payload.title);
        payload[`verification_options_${n}`] =
          options && options.length > 0 ? JSON.stringify(options) : '';
      });

      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = (e) => {
    const { name, value, files } = e.target;
    set(name, files ? files[0] : value);
  };

  // Only show "General" preset questions plus presets tagged for the
  // currently selected category. Presets with no category field at all
  // (legacy/uncategorized entries) are always shown.
  const visiblePresets = presetQuestions.filter((qObj) => {
    const qCat = typeof qObj === "object" ? qObj.category : null;
    if (!qCat) return true;
    return qCat === "General" || qCat === form.category;
  });

  const inputClass =
    "h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1478a7] disabled:bg-slate-100";
  const lockedInputClass =
    "h-11 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 text-sm font-semibold text-slate-500 outline-none cursor-not-allowed";
  const labelClass = "mb-2 block text-xs font-bold uppercase text-slate-700";
  const rangeLabelClass = "mb-1 block text-[10px] font-bold uppercase text-slate-400";
  const today = new Date().toLocaleDateString("en-CA");
  const selectedLocations = Array.isArray(form.location) ? form.location : [];
  const idNumberInvalid = form.id_number && form.id_number.length !== 8;
  const itemNamePresets = ITEM_NAME_OPTIONS[form.category] || [];
  const lockedTitle =
    "This name comes from the registered account for this ID Number. To change it, edit the account in User Management.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="flex items-start justify-between bg-gradient-to-r from-[#0B648D] to-[#155F87] px-6 py-3 text-white">
          <div>
            <h3 className="text-lg font-bold">{isEdit ? "Edit Found Item" : "Add Found Item"}</h3>
            <p className="mt-1 text-sm text-white/90">
              {isEdit ? "Update found item details" : "Start with the finder's ID Number"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base text-white transition hover:bg-white/25"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSave} className="max-h-[calc(92vh-88px)] overflow-y-auto px-6 py-5">
          <div className="mx-auto max-w-3xl space-y-3">
            {!isEdit && (
              <div className="rounded-xl bg-blue-50 p-4 border border-blue-200 text-blue-800 text-xs font-medium">
                ℹ️ Enter the finder's ID Number first — if they already have an account, their name fills in automatically. This item will be marked <strong>Approved</strong> and appear immediately on the public board under "Surrendered". If the ID Number isn't registered yet, a Student account will be created for them automatically.
              </div>
            )}

            {/* ── 1. ID Number first: it identifies the finder and drives the
                   name auto-fill directly below. ───────────────────────── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>ID Number *</label>
                <div className="flex items-center gap-2">
                  <input
                    className={`${inputClass} flex-1`}
                    value={form.id_number || ""}
                    onChange={(e) => setIdNumber(e.target.value)}
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={8}
                    placeholder="8-digit ID"
                    autoFocus={!isEdit}
                    required
                  />
                  <span className="whitespace-nowrap text-sm font-semibold text-slate-500">
                    {ID_NUMBER_DOMAIN}
                  </span>
                </div>

                {idNumberInvalid && (
                  <p className="mt-1 text-xs font-medium text-red-500">
                    ID Number must be exactly 8 digits.
                  </p>
                )}
                {lookupStatus === 'loading' && (
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Checking this ID Number…
                  </p>
                )}
                {lookupStatus === 'found' && (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    ✅ Registered account found — the name below is filled in from it.
                  </p>
                )}
                {lookupStatus === 'notfound' && (
                  <p className="mt-1 text-xs font-medium text-amber-600">
                    No account for this ID yet — enter the finder's name below and an account will be created on save.
                  </p>
                )}
                {lookupStatus === 'error' && (
                  <p className="mt-1 text-xs font-medium text-amber-600">
                    Couldn't reach User Management — enter the finder's name manually.
                  </p>
                )}
              </div>

              {/* Area Found — single select */}
              <div>
                <label className={labelClass}>Area Found *</label>
                <select
                  className={inputClass}
                  value={selectedLocations[0] || ""}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Select an area --</option>
                  {AREAS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>

                {selectedLocations.includes("Others") && (
                  <input
                    className={`${inputClass} mt-2`}
                    value={form.other_location || ""}
                    onChange={(e) => set("other_location", e.target.value)}
                    placeholder="Please specify the location"
                    required
                  />
                )}
              </div>
            </div>

            {/* ── 2. Found By — auto-filled and read-only when the ID Number
                   matches a registered account. `readOnly` (not `disabled`)
                   so the values still submit and still satisfy `required`. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Found By — First Name *
                  {nameLocked && (
                    <span className="ml-2 font-bold normal-case text-emerald-700">🔒 from account</span>
                  )}
                </label>
                <input
                  className={nameLocked ? lockedInputClass : inputClass}
                  value={form.poster_first_name || ""}
                  onChange={(e) => set("poster_first_name", e.target.value)}
                  placeholder={lookupStatus === 'loading' ? "Checking…" : "First name"}
                  readOnly={nameLocked}
                  title={nameLocked ? lockedTitle : undefined}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>
                  Found By — Last Name *
                  {nameLocked && (
                    <span className="ml-2 font-bold normal-case text-emerald-700">🔒 from account</span>
                  )}
                </label>
                <input
                  className={nameLocked ? lockedInputClass : inputClass}
                  value={form.poster_last_name || ""}
                  onChange={(e) => set("poster_last_name", e.target.value)}
                  placeholder={lookupStatus === 'loading' ? "Checking…" : "Last name"}
                  readOnly={nameLocked}
                  title={nameLocked ? lockedTitle : undefined}
                  required
                />
              </div>
            </div>

            {nameLocked && (
              <p className="text-xs font-medium text-slate-400">
                Name locked to the registered account for this ID Number. To correct it, update the account in User Management.
              </p>
            )}

            {/* ── 3. The item itself. Category is picked before Item Name —
                   the Item Name choices depend on it. ──────────────────── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Category</label>
                <select
                  className={inputClass}
                  value={form.category || "Accessories"}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Item Name *</label>
                <select
                  className={inputClass}
                  value={itemNameOther ? OTHER_ITEM_NAME : (form.title || "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === OTHER_ITEM_NAME) {
                      setItemNameOther(true);
                      set("title", "");
                    } else {
                      setItemNameOther(false);
                      set("title", val);
                    }
                  }}
                  required={!itemNameOther}
                >
                  <option value="" disabled>-- Select item name --</option>
                  {itemNamePresets.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value={OTHER_ITEM_NAME}>Other (please specify)</option>
                </select>

                {itemNameOther && (
                  <input
                    className={`${inputClass} mt-2`}
                    value={form.title || ""}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="Please specify the item name"
                    required
                  />
                )}
              </div>
            </div>

            {/* Date Found & Time Found — settable as a range (From / To) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Date Found *</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className={rangeLabelClass}>From</span>
                    <input
                      className={inputClass}
                      type="date"
                      value={form.created_date || ""}
                      onChange={(e) => set("created_date", e.target.value)}
                      max={form.created_date_to || today}
                      required
                    />
                  </div>
                  <div>
                    <span className={rangeLabelClass}>To</span>
                    <input
                      className={inputClass}
                      type="date"
                      value={form.created_date_to || ""}
                      onChange={(e) => set("created_date_to", e.target.value)}
                      min={form.created_date || undefined}
                      max={today}
                    />
                  </div>
                </div>
              </div>

              {!isEdit ? (
                <div>
                  <label className={labelClass}>Time Found</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className={rangeLabelClass}>From</span>
                      <input
                        className={inputClass}
                        type="time"
                        value={form.created_time || ""}
                        onChange={(e) => set("created_time", e.target.value)}
                      />
                    </div>
                    <div>
                      <span className={rangeLabelClass}>To</span>
                      <input
                        className={inputClass}
                        type="time"
                        value={form.created_time_to || ""}
                        onChange={(e) => set("created_time_to", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    className={inputClass}
                    value={form.status || "Pending"}
                    onChange={(e) => set("status", e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  {form.status !== "Approved" && (
                    <p className="mt-1 text-xs font-medium text-amber-600">
                      Only "Approved" items are visible on the public board.
                    </p>
                  )}
                </div>
              )}
            </div>

            {isEdit && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Time Found</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className={rangeLabelClass}>From</span>
                      <input
                        className={inputClass}
                        type="time"
                        value={form.created_time || ""}
                        onChange={(e) => set("created_time", e.target.value)}
                      />
                    </div>
                    <div>
                      <span className={rangeLabelClass}>To</span>
                      <input
                        className={inputClass}
                        type="time"
                        value={form.created_time_to || ""}
                        onChange={(e) => set("created_time_to", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className={labelClass}>Description</label>
              <textarea
                className="min-h-[88px] w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1478a7]"
                rows={2}
                value={form.description || ""}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Describe the item..."
              />
              <p className="mt-1 text-xs font-medium text-slate-400">
                Internal staff notes only — never shown to claimants.
              </p>
            </div>

            {/* Dynamic Ownership Verification Questions from Question Bank */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <label className="mb-1 block text-sm font-bold uppercase text-amber-800">
                Ownership Verification Questions (max 4)
              </label>
              <p className="mb-3 text-xs font-medium text-amber-700">
                Select a preset question from the Question Bank or write a custom one. Only
                "General" questions and questions matching the selected category are shown, and a
                preset already used in another question slot won't be offered again here. If the
                selected preset has predefined answer choices (set in the Question Bank), those
                exact choices are used for the correct-answer dropdown below — and are what the
                claimant will pick from when they submit a claim. Otherwise, questions containing
                "color" or "brand" fall back to a generic list based on Category and Item Name.
              </p>

              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => {
                  const questionText = form[`verification_question_${n}`] || "";
                  const answerOptions = getPresetAnswerOptions(questionText, form.category, form.title);

                  // The preset dropdown should reflect the current question
                  // text ONLY when that text still matches one of the
                  // currently visible presets — otherwise it shows the
                  // placeholder. Previously this was hard-coded to always
                  // render as "" (the placeholder), which meant the select
                  // fought its own controlled value on every re-render and
                  // could drop the user's click before the question text
                  // state actually updated.
                  const matchingPresetValue = visiblePresets.some((qObj) => {
                    const qText = typeof qObj === "string" ? qObj : qObj.text;
                    return qText === questionText;
                  })
                    ? questionText
                    : "";

                  // A preset already selected in one of the OTHER three
                  // slots shouldn't be offered again here, so the same
                  // question can't be picked twice across the 4 slots.
                  // (This only restricts the preset dropdown — staff can
                  // still freely type matching text into the manual
                  // question input if they really want to.)
                  const otherSelectedQuestions = [1, 2, 3, 4]
                    .filter((i) => i !== n)
                    .map((i) => form[`verification_question_${i}`])
                    .filter(Boolean);

                  const availablePresets = visiblePresets.filter((qObj) => {
                    const qText = typeof qObj === "string" ? qObj : qObj.text;
                    return !otherSelectedQuestions.includes(qText);
                  });

                  return (
                    <div key={n} className="rounded-lg border border-amber-200 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase text-amber-800">Question {n}</span>
                        <select
                          className="h-8 max-w-[280px] rounded-md border border-amber-300 bg-amber-50/50 px-2 text-xs font-medium text-amber-900 outline-none focus:border-amber-500 truncate"
                          onChange={(e) => {
                            if (e.target.value) {
                              set(`verification_question_${n}`, e.target.value);
                            }
                          }}
                          value={matchingPresetValue}
                        >
                          <option value="" disabled>-- Select Preset Question --</option>
                          {availablePresets.map((qObj, idx) => {
                            const qText = typeof qObj === "string" ? qObj : qObj.text;
                            const qCat = typeof qObj === "object" && qObj.category ? `[${qObj.category}] ` : '';
                            const hasChoices = typeof qObj === "object" && Array.isArray(qObj.options) && qObj.options.length > 0;
                            return (
                              <option key={idx} value={qText}>
                                {qCat}{qText}{hasChoices ? ' ✓' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          className="h-11 w-full rounded-lg border border-amber-300 bg-white px-3.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-amber-500"
                          value={questionText}
                          onChange={(e) => set(`verification_question_${n}`, e.target.value)}
                          placeholder={`Question ${n} (or pick preset above)`}
                          maxLength={150}
                        />

                        {answerOptions ? (
                          <select
                            className="h-11 w-full rounded-lg border border-amber-300 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-amber-500"
                            value={form[`verification_answer_${n}`] || ""}
                            onChange={(e) => set(`verification_answer_${n}`, e.target.value)}
                          >
                            <option value="" disabled>-- Select correct answer --</option>
                            {answerOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="h-11 w-full rounded-lg border border-amber-300 bg-white px-3.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-amber-500"
                            value={form[`verification_answer_${n}`] || ""}
                            onChange={(e) => set(`verification_answer_${n}`, e.target.value)}
                            placeholder={`Correct answer ${n}`}
                            maxLength={150}
                          />
                        )}
                      </div>

                      {answerOptions && (
                        <p className="text-[11px] font-semibold text-emerald-700">
                          🔗 {answerOptions.length} predefined choices linked — the claimant will see a dropdown of these same options.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {!isEdit && (
              <PhotoUpload name="image" value={form.image} onChange={handlePhotoChange} />
            )}

            <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-gradient-to-b from-[#384388] to-[#2D366D] text-white font-semibold uppercase tracking-wide hover:shadow-lg active:scale-[0.98]"
              >
                {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Item"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-12 rounded-xl bg-slate-200 text-sm font-black uppercase text-slate-500 hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const ConfirmModal = ({ message, onConfirm, onClose }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
    <div className="w-full max-w-sm rounded-[28px] bg-white px-8 py-8 text-center shadow-2xl">
      <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF4F8] text-[#0B6B8A]">
        <AlertCircle size={30} strokeWidth={2.5} />
      </div>

      <h5 className="mb-3 text-lg font-black text-[#144B70]">System Confirmation</h5>

      <p className="mx-auto mb-8 max-w-[280px] text-sm font-medium leading-6 text-[#5F6F8C]">
        {message}
      </p>

      <div className="space-y-3">
        <button
          onClick={onConfirm}
          className="h-12 w-full rounded-xl bg-[#0B6B8A] text-sm font-black uppercase tracking-wide text-white shadow-md transition hover:bg-[#095A74] active:scale-[0.98]"
        >
          Confirm
        </button>

        <button
          onClick={onClose}
          className="h-12 w-full rounded-xl border border-[#0B6B8A] bg-white text-sm font-black uppercase tracking-wide text-[#0B6B8A] transition hover:bg-[#EAF4FF]"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);

// ─── Claimant Info Prompt ───────────────────────────────────────────────────
// Shown when staff clicks "Mark as Claimed" from the Review modal. Unlike
// the ClaimRequests.jsx flow (where a full Claim record with claimant_name/
// claimant_contact/claimant_email already exists), a "Mark as Claimed"
// here has no such record behind it — see handleClaimItem's own comment
// header. So this collects the claimant's name (required) plus optional
// contact/email, which get saved onto the item itself, so "who claimed
// this" is always answerable from the Review modal afterward, not just
// "when".
//
// Best-effort convenience: if a Claim record already exists for this item
// (e.g. the claimant went through the public claim flow and staff is just
// finalizing it here rather than through Claim Requests), the fields are
// pre-filled from the most recent matching claim — see openClaimPrompt in
// FoundItems below. Staff can still edit anything before confirming.
const ClaimantInfoModal = ({ item, name, contact, email, prefillLoading, onChange, onConfirm, onClose, saving }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
    <div className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl">
      <div className="mb-4">
        <h5 className="text-lg font-black text-[#144B70]">Mark Item as Claimed</h5>
        <p className="mt-1 text-xs font-medium text-[#5F6F8C]">
          Enter who is claiming <span className="font-bold">{toTitleCase(item?.title)}</span>, so it's
          on record for this item.
        </p>
      </div>

      {prefillLoading && (
        <p className="mb-3 text-[11px] font-semibold text-slate-400">
          Checking for an existing claim on this item...
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-700">Claimant Name *</label>
          <input
            autoFocus
            className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1478a7]"
            value={name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-700">Contact Number</label>
          <input
            className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1478a7]"
            value={contact}
            onChange={(e) => onChange('contact', e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-700">Email</label>
          <input
            className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1478a7]"
            value={email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <button
          onClick={onConfirm}
          disabled={saving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B6B8A] text-sm font-black uppercase tracking-wide text-white shadow-md transition hover:bg-[#095A74] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            'Confirm Claimed'
          )}
        </button>

        <button
          onClick={onClose}
          disabled={saving}
          className="h-12 w-full rounded-xl border border-[#0B6B8A] bg-white text-sm font-black uppercase tracking-wide text-[#0B6B8A] transition hover:bg-[#EAF4FF] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);

// ─── FoundItems Component ──────────────────────────────────────────────────────
const FoundItems = ({ searchFilter }) => {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeConfirmation, setActiveConfirmation] = useState(null);
  // 'unclaimed' shows the working queue (default, matches prior behavior);
  // 'claimed' shows items that have already been picked up by their owner.
  // Archived items are excluded from both tabs.
  const [claimFilter, setClaimFilter] = useState('unclaimed');
  const tableContainerRef = useRef(null);

  // Claimant-info prompt shown from the Review modal's "Mark as Claimed"
  // button — see ClaimantInfoModal above and openClaimPrompt/
  // confirmClaimItem below. `null` when not open.
  const [claimPrompt, setClaimPrompt] = useState(null);
  const [claimPromptSaving, setClaimPromptSaving] = useState(false);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(() => {
      fetchItems();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchItems() {
    try {
      const response = await getItems();
      setItems(response);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  }

  const getImageUrl = (img) => {
    if (!img) return null;
    const first = Array.isArray(img) ? img[0] : img;
    if (!first) return null;
    const path = typeof first === 'string' ? first : (first.image || first.file || first.url);
    if (!path) return null;
    return path.startsWith('http') ? path : `${API_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  };

  // Resolves EVERY photo attached to an item (not just the first one) so the
  // review modal can show all 1-3 uploaded photos instead of just one.
  const getImageUrls = (img) => {
    if (!img) return [];
    const list = Array.isArray(img) ? img : [img];
    return list
      .map((item) => {
        if (!item) return null;
        const path = typeof item === 'string' ? item : (item.image || item.file || item.url);
        if (!path) return null;
        return path.startsWith('http') ? path : `${API_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
      })
      .filter(Boolean);
  };

  async function handleEdit(item) {
    try {
      const response = await getItemById(item.id);
      let data = Array.isArray(response) ? response[0] : (response.results ? response.results[0] : response);
      setEditItem({ ...data, created_date: data.created_date || '' });
    } catch {
      setEditItem({ ...item, created_date: item.created_date || '' });
    }
  }

  async function handleSaveEdit(updatedForm) {
    try {
      const formData = new FormData();
      Object.keys(updatedForm).forEach((key) => {
        if (key !== 'image' && updatedForm[key] !== undefined) {
          formData.append(key, updatedForm[key]);
        }
      });
      await editLostItem(editItem.id, formData);

      logActivity({
        actor_name: updatedForm.poster_name,
        action: 'updated',
        target_title: updatedForm.title,
        details: `updated details for "${updatedForm.title}"`,
      });

      window.alert('Found item updated successfully!');
      await fetchItems();
      setEditItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      window.alert('Failed to update item.');
    }
  }

  async function handleDeleteItem(id) {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      const target = items.find((i) => i.id === id);
      await deleteLostItem(id);

      logActivity({
        action: 'deleted',
        target_title: target?.title,
        details: target?.title ? `deleted "${target.title}"` : 'deleted a found item',
      });

      window.alert('Item deleted successfully!');
      await fetchItems();
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      window.alert('Failed to delete item.');
    }
  }

  async function handleArchiveItem(id) {
    try {
      const target = items.find((i) => i.id === id);
      const formData = new FormData();
      formData.append('status', 'Archived');

      await editLostItem(id, formData);

      logActivity({
        action: 'archived',
        target_title: target?.title,
        details: target?.title ? `archived "${target.title}"` : 'archived a found item',
      });

      window.alert('Item archived successfully!');
      await fetchItems();
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
      setActiveConfirmation(null);
    } catch (error) {
      console.error('Error archiving item:', error);
      window.alert('Failed to archive item.');
    }
  }

  async function handleAddItem(form) {
    try {
      const formData = new FormData();
      formData.append('type', 'Surrendered');

      // Items logged here are physically turned in and verified by staff
      // in person — unlike a public "Lost" report, there's no separate
      // review step needed. Force status to "Approved" on creation so the
      // item shows up immediately on the public board's "Surrendered" tab
      // (PublicBoard only lists items where status === 'Approved').
      // Excluded from the generic loop below via the `key !== 'status'`
      // check so the form's own default ('Pending') doesn't overwrite this.
      formData.append('status', 'Approved');

      let formattedTime = form.created_time;
      if (!formattedTime || formattedTime.trim() === '') {
        const now = new Date();
        formattedTime = now.toTimeString().slice(0, 5);
      } else if (formattedTime.length > 5) {
        formattedTime = formattedTime.slice(0, 5);
      }
      formData.append('created_time', formattedTime);

      Object.keys(form).forEach((key) => {
        if (key === 'image') {
          if (Array.isArray(form.image)) {
            form.image.forEach((file) => {
              if (file instanceof File) formData.append('image', file);
            });
          } else if (form.image instanceof File) {
            formData.append('image', form.image);
          }
        } else if (key !== 'created_time' && key !== 'status') {
          const val = form[key];
          if (val !== null && val !== undefined && val !== '') {
            formData.append(key, val);
          }
        }
      });

      const createdItem = await createLostItem(formData);

      logActivity({
        actor_name: form.poster_name,
        actor_role: 'reporter',
        action: 'created',
        target_title: form.title,
        details: 'turned in a found item',
      });

      // ------------------------------------------------------------------
      // STUDENT ACCOUNT AUTO-PROVISIONING — every finder logged here should
      // have a matching account in User Management. If their ID Number
      // isn't already registered, create one automatically (role:
      // 'student') so staff never have to leave this form to register a
      // first-time finder separately. See ensureStudentAccount() above.
      // Wrapped so a hiccup here never blocks the item from being saved —
      // the item is already created by this point.
      // ------------------------------------------------------------------
      const { warning: accountWarning } = await ensureStudentAccount(form);

      // ------------------------------------------------------------------
      // POINTS SYSTEM — award points to the finder for surrendering this
      // item, keyed by id_number (the unique identifier). `form.id_number`
      // here is already the full payload value set by ItemModal's
      // handleSave (8 digits + ID_NUMBER_DOMAIN suffix), not just the
      // digits. Points = category points + the SURRENDER_ITEM action bonus
      // (see utils/pointsSystem.js). Wrapped in its own try/catch so a
      // points-service hiccup never blocks the item from being saved —
      // the item is already created by this point. On failure, the error
      // is surfaced to the user (in addition to being logged) so a silent
      // points-service failure isn't mistaken for "everything worked".
      // ------------------------------------------------------------------
      let pointsWarning = '';
      try {
        await addPointsRecord({
          id_number: form.id_number,
          player_name: form.poster_name,
          reason: 'SURRENDER_ITEM',
          item_id: createdItem?.ticket_code || createdItem?.id || null,
          points: calculatePoints(form.category, 'SURRENDER_ITEM'),
        });
      } catch (pointsError) {
        console.error('Failed to award points for surrender:', pointsError.response?.data || pointsError.message);
        pointsWarning = '\n\n⚠️ However, points could not be awarded for this item (see console for details).';
      }

      window.alert(`Found item added successfully! It is now visible on the public board under Surrendered Items.${accountWarning}${pointsWarning}`);
      await fetchItems();
      setAddOpen(false);
    } catch (error) {
      console.error('Error adding item details:', error.response?.data || error.message);

      let errorMsg = 'Failed to add item.';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMsg = error.response.data;
        } else if (error.response.data.detail) {
          errorMsg = error.response.data.detail;
        } else {
          errorMsg = Object.entries(error.response.data)
            .map(([field, errs]) => `${field.toUpperCase()}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
            .join('\n');
        }
      }

      window.alert(errorMsg);
    }
  }

  // ------------------------------------------------------------------
  // CLAIMANT PROMPT — opened from the Review modal's "Mark as Claimed"
  // button (instead of calling handleClaimItem directly), so staff always
  // records WHO claimed the item, not just WHEN. See ClaimantInfoModal
  // above.
  //
  // Best-effort prefill: looks up any existing Claim record for this item
  // (via getClaims — the same endpoint ClaimRequests.jsx polls) and, if
  // found, pre-fills the claimant fields from the most recently submitted
  // matching claim. This covers the case where the claimant already went
  // through the public claim flow and staff is just finalizing pickup
  // here — staff can still edit any of the fields before confirming.
  // Failure to look this up never blocks manual entry.
  // ------------------------------------------------------------------
  async function openClaimPrompt(item) {
    if (item.status === 'Claimed') {
      window.alert('This item is already claimed.');
      return;
    }

    setClaimPrompt({ item, name: '', contact: '', email: '', prefillLoading: true });

    try {
      const response = await getClaims();
      const claimsList = Array.isArray(response)
        ? response
        : Array.isArray(response?.results)
        ? response.results
        : [];

      const matching = claimsList
        .filter((c) => {
          const claimItemId = c.item_details?.id ?? c.item?.id ?? c.item_id ?? c.item;
          return String(claimItemId) === String(item.id);
        })
        .sort((a, b) => new Date(b.claim_date) - new Date(a.claim_date))[0];

      setClaimPrompt((prev) =>
        prev && prev.item.id === item.id
          ? {
              ...prev,
              name: matching?.claimant_name || '',
              contact: matching?.claimant_contact || '',
              email: matching?.claimant_email || '',
              prefillLoading: false,
            }
          : prev
      );
    } catch (err) {
      console.error('Failed to look up existing claim for prefill:', err);
      setClaimPrompt((prev) => (prev && prev.item.id === item.id ? { ...prev, prefillLoading: false } : prev));
    }
  }

  const updateClaimPromptField = (field, value) => {
    setClaimPrompt((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  async function confirmClaimPrompt() {
    if (!claimPrompt) return;
    if (!claimPrompt.name.trim()) {
      window.alert('Please enter the name of the person claiming this item.');
      return;
    }

    setClaimPromptSaving(true);
    try {
      await handleClaimItem(claimPrompt.item, {
        name: claimPrompt.name.trim(),
        contact: claimPrompt.contact.trim(),
        email: claimPrompt.email.trim(),
      });
      setClaimPrompt(null);
    } finally {
      setClaimPromptSaving(false);
    }
  }

  // `claimantInfo` ({ name, contact, email }), when provided, is what
  // openClaimPrompt/confirmClaimPrompt above collected from staff (or
  // pre-filled from an existing Claim record) — persisted onto the item
  // as claimed_by_name/claimed_by_contact/claimed_by_email so the Review
  // modal can show WHO claimed an item, not just when.
  //
  // ASSUMPTION: the backend's item model/serializer accepts and persists
  // `claimed_by_name`, `claimed_by_contact`, and `claimed_by_email`. If
  // it doesn't yet, add them there (or swap these field names for
  // whatever equivalent already exists).
  async function handleClaimItem(item, claimantInfo = {}) {
    if (item.status === 'Claimed') {
      window.alert('This item is already claimed.');
      return;
    }

    try {
      // ------------------------------------------------------------------
      // Send the FULL item back with status flipped to 'Claimed', not just
      // a handful of fields. Previously only title/poster_name/category/
      // location/created_date/created_time/description/status were sent —
      // if the backend treats this update as a full replace (PUT-style)
      // rather than a partial patch, every other field (id_number,
      // ticket_code, verification questions/answers, images, etc.) could
      // get silently wiped out, and in some backend configurations an
      // incomplete/invalid payload can cause the status update itself to
      // fail — which is why a claimed item could keep showing up on the
      // public board under Surrendered. Sending everything back guards
      // against both.
      // ------------------------------------------------------------------
      const formData = new FormData();
      Object.entries(item).forEach(([key, value]) => {
        if (key === 'image' || key === 'images' || key === 'file') return; // don't resend file fields
        if (value === null || value === undefined) return;
        formData.append(key, value);
      });
      formData.set('status', 'Claimed');

      // If the list payload didn't carry id_number (or carried it blank),
      // don't send the item back without it — a PUT-style update on the
      // backend would then blank out the finder's ID permanently, and the
      // points award below would fail outright ("id_number ... required").
      // Re-fetch the full record and restore it before sending.
      if (!item.id_number) {
        try {
          const full = await getItemById(item.id);
          const data = Array.isArray(full)
            ? full[0]
            : (full?.results ? full.results[0] : full);
          if (data?.id_number) formData.set('id_number', data.id_number);
          if (data?.poster_name) formData.set('poster_name', data.poster_name);
        } catch (err) {
          console.error('Could not re-fetch item before claim update:', err);
        }
      }

      // Record exactly when this item was marked claimed, so the table
      // can show "Date Claimed" alongside "Date Found". Uses formData.set
      // (not append) since `item` may already carry a stale claimed_date/
      // claimed_time from a previous (e.g. re-claimed) record.
      const claimedNow = new Date();
      formData.set('claimed_date', claimedNow.toLocaleDateString('en-CA'));
      formData.set('claimed_time', claimedNow.toTimeString().slice(0, 5));

      // WHO claimed it — see the ASSUMPTION note above this function.
      formData.set('claimed_by_name', claimantInfo.name || '');
      formData.set('claimed_by_contact', claimantInfo.contact || '');
      formData.set('claimed_by_email', claimantInfo.email || '');

      await editLostItem(item.id, formData);

      logActivity({
        action: 'claimed',
        target_title: item.title,
        details: claimantInfo.name
          ? `marked "${item.title}" as claimed by ${claimantInfo.name}`
          : `marked "${item.title}" as claimed`,
      });

      // ------------------------------------------------------------------
      // POINTS SYSTEM — award points to the ORIGINAL FINDER (item.id_number)
      // when their surrendered item is successfully claimed by its rightful
      // owner. Points = category points + the ITEM_CLAIMED action bonus.
      //
      // `item` here comes from the table list, whose serializer may not
      // include id_number (or may return it blank) — the points endpoint
      // rejects the request outright in that case ("id_number and reason
      // are required"). So resolve the finder's ID first: try the item as
      // given, fall back to re-fetching the full record, and skip the
      // award (with a visible warning) rather than firing a call we
      // already know will fail.
      // ------------------------------------------------------------------
      let pointsWarning = '';
      try {
        let finderId = item.id_number;
        let finderName = item.poster_name;

        if (!finderId) {
          try {
            const full = await getItemById(item.id);
            const data = Array.isArray(full)
              ? full[0]
              : (full?.results ? full.results[0] : full);
            finderId = data?.id_number || '';
            finderName = data?.poster_name || finderName;
          } catch (lookupErr) {
            console.error('Could not re-fetch item for points award:', lookupErr);
          }
        }

        if (!finderId) {
          pointsWarning =
            '\n\n⚠️ Points were not awarded — this item has no ID Number on record for the finder.';
        } else {
          await addPointsRecord({
            id_number: finderId,
            player_name: finderName,
            reason: 'ITEM_CLAIMED',
            item_id: item.ticket_code || item.id,
            points: calculatePoints(item.category, 'ITEM_CLAIMED'),
          });
        }
      } catch (pointsError) {
        console.error('Failed to award points for claim:', pointsError.response?.data || pointsError.message);
        pointsWarning = '\n\n⚠️ However, points could not be awarded for this claim (see console for details).';
      }

      window.alert(`Item marked as claimed!${pointsWarning}`);
      await fetchItems();
      setSelectedItem(null);
    } catch (error) {
      console.error('Error claiming item:', error);
      window.alert('Failed to claim item.');
    }
  }

  // Switching tabs re-scopes the whole list, so always land back on page 1
  // to avoid landing on an out-of-range page for the new tab's item count.
  const setClaimFilterAndReset = (val) => {
    setClaimFilter(val);
    setCurrentPage(1);
  };

  // Base pool used by both the tab counts and the table: any Found/
  // Surrendered item that hasn't been archived.
  const activeFoundItems = items.filter((item) => {
    const itemType = item.type?.toUpperCase() || '';
    const isFoundType = itemType === 'SURRENDERED' || itemType === 'FOUND';
    return isFoundType && item.status?.toUpperCase() !== 'ARCHIVED';
  });

  const unclaimedCount = activeFoundItems.filter(
    (item) => item.status?.toUpperCase() !== 'CLAIMED'
  ).length;
  const claimedCount = activeFoundItems.filter(
    (item) => item.status?.toUpperCase() === 'CLAIMED'
  ).length;

  const filteredFound = activeFoundItems
    .filter((item) => {
      const query = search.toLowerCase();
      const status = item.status?.toUpperCase();
      const matchesClaimTab = claimFilter === 'claimed' ? status === 'CLAIMED' : status !== 'CLAIMED';

      return (
        matchesClaimTab &&
        (
          item.title?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query) ||
          item.poster_name?.toLowerCase().includes(query) ||
          item.location?.toLowerCase().includes(query)
        )
      );
    })
    .sort((a, b) => b.id - a.id);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredFound.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filteredFound.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const goToPage = (page) => setCurrentPage(page);

  const getVisiblePages = () => {
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    let startPage = currentPage < maxVisiblePages ? 1 : currentPage - 3;
    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = totalPages - maxVisiblePages + 1;
    }
    return Array.from(
      { length: endPage - startPage + 1 },
      (_, index) => startPage + index
    );
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="bg-white rounded-[18px] border border-[#D8E2EF] shadow-[0_8px_24px_rgba(45,54,109,0.08)] overflow-hidden flex flex-col h-[calc(100vh-135px)]">

        {/* Header */}
        <div className="bg-white px-6 sm:px-8 py-4 border-b border-[#D8E2EF] shrink-0">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              
              <div>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-[0.16em] text-[#071E3D]">
                  Found Items
                </h3>
                <p className="text-xs sm:text-sm text-[#7B8AA6] italic mt-0.5">
                  Manage all turned-in found items
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
              <div className="relative w-full sm:w-[300px]">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0B6B8A] text-sm">🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search found items..."
                  className="w-full pl-10 pr-4 py-2.5 border border-[#CBD8E8] rounded-full text-sm outline-none bg-white text-[#071E3D] placeholder:text-[#8A98B3] focus:ring-2 focus:ring-[#0B6B8A]/20 focus:border-[#0B6B8A]"
                />
              </div>

              <button
                onClick={() => setAddOpen(true)}
                className="px-6 py-2.5 rounded-full bg-[#2D366D] text-white font-black uppercase tracking-[0.1em] text-xs shadow-[0_6px_14px_rgba(45,54,109,0.25)] hover:bg-[#24305C] transition-all whitespace-nowrap"
              >
                📋 Add Found Item
              </button>
            </div>
          </div>

          {/* Claimed / Not Claimed tabs — connected segmented-switch
              style (matches ClaimRequests.jsx), aligned to the right
              side, in line with the search bar and Add button above. */}
          <div className="mt-4 flex justify-end">
            <div className="inline-flex items-center gap-1 rounded-full bg-[#F1F4F9] p-1">
              <button
                type="button"
                onClick={() => setClaimFilterAndReset('unclaimed')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition-all ${
                  claimFilter === 'unclaimed'
                    ? 'bg-white text-[#0B6B8A] shadow-sm'
                    : 'text-[#7B8AA6] hover:text-[#475569]'
                }`}
              >
                <span>Not Claimed</span>
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                    claimFilter === 'unclaimed' ? 'bg-[#0B6B8A]/10 text-[#0B6B8A]' : 'bg-white text-[#7B8AA6]'
                  }`}
                >
                  {unclaimedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setClaimFilterAndReset('claimed')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition-all ${
                  claimFilter === 'claimed'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-[#7B8AA6] hover:text-[#475569]'
                }`}
              >
                <span>Claimed</span>
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                    claimFilter === 'claimed' ? 'bg-purple-100 text-purple-600' : 'bg-white text-[#7B8AA6]'
                  }`}
                >
                  {claimedCount}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div ref={tableContainerRef} className="flex-1 overflow-auto bg-white">
          <table className="w-full min-w-[1120px] table-fixed border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-[10%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Ticket</th>
                <th className="w-[13%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Item Name</th>
                <th className="w-[10%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Category</th>
                <th className="w-[13%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Found By</th>
                <th className="w-[13%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Area Found</th>
                <th className="w-[11%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Date Found</th>
                <th className="w-[11%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Date Claimed</th>
                <th className="w-[9%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Status</th>
                <th className="w-[8%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Action</th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item, index) => (
                  <tr key={item.id} className={`h-[56px] ${index % 2 === 0 ? "bg-white" : "bg-[#F6FAFF]"} hover:bg-[#EAF4FF]`}>
                    <td className="border border-gray-300 p-2 text-center align-middle font-bold text-[#0B6B8A] text-xs">{item.ticket_code}</td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[13px]">{toTitleCase(item.title)}</td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-[#2D366D] text-[13px]">{toTitleCase(item.category) || '-'}</td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-600 text-[13px]">{toTitleCase(item.poster_name) || '-'}</td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[13px]">{toTitleCase(item.location) || '-'}</td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[13px]">
                      <span className="block">{item.created_date ? item.created_date : '-'}</span>
                      <span className="block text-xs text-slate-400">{item.created_time ? item.created_time : ''}</span>
                    </td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[13px]">
                      {item.status?.toUpperCase() === 'CLAIMED' && item.claimed_date ? (
                        <>
                          <span className="block">{item.claimed_date}</span>
                          <span className="block text-xs text-slate-400">{item.claimed_time ? item.claimed_time : ''}</span>
                        </>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="border border-gray-300 p-4 text-center align-middle">
                      <span className={`rounded px-3 py-1 text-[10px] font-black uppercase ${statusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="border border-gray-300 p-2 text-center align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedItem(item)}
                          title="Review Item"
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#0B6B8A] text-white transition hover:bg-[#095A74]"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => setActiveConfirmation({
                            text: "Are you sure you want to archive this item?",
                            action: () => handleArchiveItem(item.id)
                          })}
                          title="Archive Item"
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-amber-600 text-white transition hover:bg-amber-700"
                        >
                          <Archive size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="bg-white py-24 text-center text-[#7B8AA6] font-bold uppercase">
                    {claimFilter === 'claimed' ? 'No claimed items found' : 'No found items found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredFound.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-[#D8E2EF] bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-[#7B8AA6]">
              Showing {startIndex + 1}-
              {Math.min(startIndex + ITEMS_PER_PAGE, filteredFound.length)} of{" "}
              {filteredFound.length}
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 rounded-lg border border-[#D8E2EF] px-3 text-[11px] font-black uppercase tracking-wide text-[#0B6B8A] transition hover:bg-[#EAF4FF] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>

              {visiblePages.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => goToPage(page)}
                  className={`h-8 min-w-8 rounded-lg px-2.5 text-xs font-black transition ${
                    currentPage === page
                      ? "bg-[#0B6B8A] text-white shadow-md"
                      : "border border-[#D8E2EF] bg-white text-[#0B6B8A] hover:bg-[#EAF4FF]"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                onClick={() => goToPage(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-8 rounded-lg border border-[#D8E2EF] px-3 text-[11px] font-black uppercase tracking-wide text-[#0B6B8A] transition hover:bg-[#EAF4FF] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

      {/* Review Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItem(null);
          }}
        >
          <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-md bg-white shadow-2xl">
            <div className="flex items-start justify-between bg-gradient-to-r from-[#0B648D] to-[#155F87] px-6 py-3 text-white">
              <div>
                <h3 className="text-lg font-bold">Found Item Review</h3>
                <p className="mt-1 text-sm text-white/90">
                  Review details for this turned-in item
                </p>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-6 py-5">
              <div className="mx-auto max-w-3xl space-y-4">
                {(() => {
                  const imgs = getImageUrls(selectedItem.images || selectedItem.image || selectedItem.file);

                  if (imgs.length === 0) {
                    return (
                      <img
                        src="https://via.placeholder.com/900x500?text=No+Image"
                        className="h-72 w-full rounded-xl border border-slate-200 bg-slate-100 object-cover"
                        alt="No Item"
                      />
                    );
                  }

                  if (imgs.length === 1) {
                    return (
                      <img
                        src={imgs[0]}
                        className="h-72 w-full rounded-xl border border-slate-200 bg-slate-100 object-cover"
                        alt="Found Item Preview"
                      />
                    );
                  }

                  // 2+ photos: grid that adapts to the actual count instead
                  // of always reserving 3 columns (which left an empty gap
                  // when exactly 2 photos were uploaded).
                  const gridColsClass = imgs.length === 2 ? "grid-cols-2" : "grid-cols-3";

                  return (
                    <div className={`grid ${gridColsClass} gap-2`}>
                      {imgs.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          className="h-40 w-full rounded-xl border border-slate-200 bg-slate-100 object-cover cursor-pointer transition hover:opacity-90"
                          alt={`Found Item Preview ${idx + 1}`}
                          onClick={() => window.open(src, "_blank")}
                        />
                      ))}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">ID Number</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      {selectedItem.id_number || '-'}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Found By</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      {toTitleCase(selectedItem.poster_name) || '-'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Item Name</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">
                      {toTitleCase(selectedItem.title) || '-'}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Category</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      {toTitleCase(selectedItem.category) || '-'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Area Found</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      {toTitleCase(selectedItem.location) || '-'}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Date Found</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      {selectedItem.created_date || '-'}
                      {selectedItem.created_date_to ? ` – ${selectedItem.created_date_to}` : ''}
                    </div>
                  </div>
                </div>

                {/* ==========================================================
                    CLAIMED BY — only shown for items whose status is
                    "Claimed". Surfaces WHO claimed the item alongside the
                    existing Date Claimed info, using claimed_by_name/
                    claimed_by_contact/claimed_by_email saved on the item
                    at claim time (see handleClaimItem's ASSUMPTION note).
                    Items claimed before this field existed show "Not
                    recorded" rather than leaving the section out entirely,
                    so it's clear the data is simply missing, not that
                    nobody claimed it.
                ========================================================== */}
                {selectedItem.status?.toUpperCase() === 'CLAIMED' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Claimed By</p>
                      <div className="min-h-11 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-bold text-purple-800">
                        {toTitleCase(selectedItem.claimed_by_name) || 'Not recorded'}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Claimant Contact</p>
                      <div className="min-h-11 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
                        {selectedItem.claimed_by_contact || selectedItem.claimed_by_email || 'Not recorded'}
                      </div>
                    </div>
                  </div>
                )}

                {selectedItem.status?.toUpperCase() === 'CLAIMED' && selectedItem.claimed_date && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Date Claimed</p>
                      <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                        {selectedItem.claimed_date}
                        {selectedItem.claimed_time ? ` ${selectedItem.claimed_time}` : ''}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Status</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      <span className={`rounded-full px-3 py-1 text-[13px] font-black uppercase ${statusColor(selectedItem.status)}`}>
                        {selectedItem.status || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedItem.description && (
                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Description</p>
                    <div className="min-h-16 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      {selectedItem.description}
                    </div>
                  </div>
                )}

                {[1, 2, 3, 4]
                  .map((n) => selectedItem[`verification_question_${n}`])
                  .some(Boolean) && (
                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">
                      Ownership Verification Questions
                    </p>
                    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      {[1, 2, 3, 4].map((n) => {
                        const q = selectedItem[`verification_question_${n}`];
                        const a = selectedItem[`verification_answer_${n}`];
                        return q ? (
                          <p key={n} className="text-sm text-slate-700">
                            <span className="font-bold text-amber-700">{n}.</span> {q}
                            {a ? (
                              <span className="ml-1 text-emerald-700">
                                — Answer: <span className="font-semibold">{a}</span>
                              </span>
                            ) : null}
                          </p>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Review Modal Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      handleEdit(selectedItem);
                      setSelectedItem(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0B6B8A] text-white rounded-xl font-bold uppercase text-sm hover:bg-[#095A74] transition-all"
                  >
                    <Pencil size={16} /> Edit Item
                  </button>

                  {selectedItem.status !== 'Claimed' && (
                    <button
                      onClick={() => openClaimPrompt(selectedItem)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-bold uppercase text-sm hover:bg-purple-700 transition-all"
                    >
                      <CheckCircle size={16} /> Mark as Claimed
                    </button>
                  )}

                  <button
                    onClick={() => setActiveConfirmation({
                      text: "Are you sure you want to archive this item?",
                      action: () => handleArchiveItem(selectedItem.id)
                    })}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl font-bold uppercase text-sm hover:bg-amber-700 transition-all"
                  >
                    <Archive size={16} /> Archive Item
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addOpen && (
        <ItemModal
          onSave={handleAddItem}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Edit Modal */}
      {editItem && (
        <ItemModal
          item={editItem}
          onSave={handleSaveEdit}
          onClose={() => setEditItem(null)}
        />
      )}

      {/* Global Confirmation Dialog */}
      {activeConfirmation && (
        <ConfirmModal
          message={activeConfirmation.text}
          onConfirm={() => {
            activeConfirmation.action();
            setActiveConfirmation(null);
          }}
          onClose={() => setActiveConfirmation(null)}
        />
      )}

      {/* Claimant Info Prompt — opened from the Review modal's "Mark as
          Claimed" button (see openClaimPrompt above). */}
      {claimPrompt && (
        <ClaimantInfoModal
          item={claimPrompt.item}
          name={claimPrompt.name}
          contact={claimPrompt.contact}
          email={claimPrompt.email}
          prefillLoading={claimPrompt.prefillLoading}
          saving={claimPromptSaving}
          onChange={updateClaimPromptField}
          onConfirm={confirmClaimPrompt}
          onClose={() => setClaimPrompt(null)}
        />
      )}
    </div>
  );
};

export default FoundItems;
