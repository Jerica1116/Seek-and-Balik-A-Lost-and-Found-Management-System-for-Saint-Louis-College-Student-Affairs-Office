import React, { useEffect, useState, useRef } from 'react';
import { Eye, Pencil, Archive, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getItems, getItemById, API_URL, editLostItem, createLostItem, deleteLostItem } from "../api/api";
import PhotoUpload from '../components/PhotoUpload';
import { logActivity } from '../utils/activityLog';

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
  'Others'
];
const CATS = ['Personal', 'Accessories', 'Id', 'Electronics', 'Keys', 'Valuables'];
// 'Declined' included so it can be reflected/reset from the Edit modal too.
const STATUSES = ['Pending', 'Approved', 'Declined', 'Claimed'];
const MAX_IMAGES = 3;
// Maximum number of areas that can be selected in the "Area Lost" multi-select.
const MAX_LOCATIONS = 5;

// ─── Item Name presets ──────────────────────────────────────────────────────
// Predefined Item Name choices per Category, used to drive the Item Name
// dropdown once a Category is selected — same pattern as the Found Items
// admin page. Keys must match the CATS values above exactly. "Other (please
// specify)" is always appended in the UI so staff/users can still type
// something not on the list.
const ITEM_NAME_OPTIONS = {
  'Personal': [
    'Umbrella', 'Water Bottle', 'Tumbler', 'Lunch Box', 'Notebook', 'Book',
    'Wallet', 'Bag', 'Eyeglasses', 'Sunglasses', 'Cap/Hat', 'ID Lace', 'Towel'
  ],
  'Accessories': [
    'Watch', 'Bracelet', 'Necklace', 'Ring', 'Earrings', 'Hair Clip', 'Hair Tie',
    'Sunglasses', 'Eyeglasses', 'Cap/Hat', 'Keychain', 'ID Lace', 'Brooch/Pin', 'Belt'
  ],
  'Id': [
    'Student ID', 'School ID', "Driver's License", 'Passport', 'Government ID',
    'Company/Employee ID', 'PhilHealth ID', 'UMID', 'ATM/Debit Card', 'Library Card',
    'Other Identification Card'
  ],
  'Electronics': [
    'Mobile Phone', 'Laptop', 'Tablet', 'iPad', 'Smartwatch', 'Digital Camera',
    'Calculator', 'Power Bank', 'Charger', 'Charging Cable', 'Earphones', 'Earbuds',
    'Headphones', 'Bluetooth Speaker', 'USB Flash Drive', 'External Hard Drive', 'Mouse',
    'Keyboard', 'Adapter'
  ],
  'Keys': [
    'House Key', 'Room Key', 'Classroom Key', 'Office Key', 'Cabinet Key', 'Locker Key',
    'Padlock Key', 'Motorcycle Key', 'Car Key', 'Key Set', 'Duplicate Key',
    'Keychain with Keys'
  ],
  'Valuables': [
    'Cash', 'Jewelry', 'Watch', 'Ring', 'Necklace', 'Bracelet', 'Earrings',
    'Wallet', 'Important Documents', 'Gadget', 'Passbook'
  ]
};

// Marker value used by the Item Name <select> to represent "the user wants
// to type a custom name that isn't on the predefined list for this Category".
const OTHER_ITEM_NAME = '__other__';

/** True when `title` is non-empty and not one of the predefined choices for
 * `category` — i.e. the Item Name field should show as free-text/custom. */
function isCustomItemName(title, category) {
  if (!title) return false;
  const options = ITEM_NAME_OPTIONS[category] || [];
  return !options.includes(title);
}

const statusColor = (s) =>
  s === 'Claimed' ? 'bg-purple-100 text-purple-500' :
  s === 'Pending' ? 'bg-orange-100 text-orange-500' :
  s === 'Declined' ? 'bg-red-100 text-red-500' :
  'bg-green-100 text-green-500';

const EMPTY = {
  title: '',
  category: 'Personal',
  poster_first_name: '',
  poster_last_name: '',
  location: [],
  created_date: '',
  created_date_to: '',
  created_time: '',
  created_time_to: '',
  description: '',
  status: 'Pending',
  // Reason staff gave when declining a report. Only meaningful once
  // status === 'Declined', but kept on the form at all times so it
  // round-trips cleanly through edit/save.
  declined_remarks: '',
  image: []
};

function toTitleCase(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ─── Reported-by name helpers ───────────────────────────────────────────────
// "Reported By" is still stored on the backend as a single `poster_name`
// field, but the form works with separate First Name / Last Name inputs.
// This converts between the two, splitting on the first whitespace when
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

// ─── Image helpers ─────────────────────────────────────────────────────────
// Resolves EVERY photo attached to an item (not just the first one). Prefers
// the backend's nested `images` list (one row per uploaded photo), and falls
// back to a legacy single `image`/`file` field for older records.
function resolveImageUrl(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function getImageUrls(item) {
  if (!item) return [];

  if (Array.isArray(item.images) && item.images.length > 0) {
    return item.images
      .map((entry) => resolveImageUrl(typeof entry === 'string' ? entry : (entry.image || entry.file || entry.url)))
      .filter(Boolean);
  }

  const legacy = item.image || item.file;
  if (!legacy) return [];
  const list = Array.isArray(legacy) ? legacy : [legacy];
  return list
    .map((entry) => resolveImageUrl(typeof entry === 'string' ? entry : (entry.image || entry.file || entry.url)))
    .filter(Boolean);
}

// ─── Location helpers ──────────────────────────────────────────────────────
// The item's "location" is stored on the backend as a single text field, so
// multiple selected areas are joined into one comma-separated string (e.g.
// "Library, Chapel, Gymnasium"). These helpers convert between that stored
// string and the array the multi-select UI works with.

/** Turn a stored location value (string or array) into a working array of
 * selected AREAS values (using "Others" as the marker for custom entries),
 * plus the free-text for any custom ("Others") entries. */
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

  const selected = [...known];
  let otherText = storedOtherText || '';

  if (custom.length > 0) {
    selected.push('Others');
    otherText = custom.join(', ');
  } else if (hadOthersMarker) {
    selected.push('Others');
  }

  return { selected, otherText };
}

/** Turn the working { location: [...], other_location } form state back into
 * a single comma-separated string for saving to the backend. */
function serializeLocation(locationArr, otherText) {
  const list = Array.isArray(locationArr) ? locationArr : [];
  const named = list.filter((a) => a !== 'Others');
  const custom = list.includes('Others')
    ? (otherText || '').split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return [...named, ...custom].join(', ');
}

// ─── Item Modal (Add/Edit) ───────────────────────────────────────────────────
const ItemModal = ({ item, onSave, onClose }) => {
  const [saving, setSaving] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const locationRef = useRef(null);

  const normalizeForm = (source) => {
    const base = source || EMPTY;
    const { selected, otherText } = parseStoredLocation(base.location, base.other_location);
    const { first, last } = parsePosterName(base);

    // Pre-populate the photo picker with any existing photo URLs so editing
    // an item shows its current photos (as strings) alongside room for new
    // File objects the user adds. PhotoUpload already supports mixed arrays
    // of File objects and existing URL strings.
    const existingImageUrls = source ? getImageUrls(source) : [];

    return {
      ...base,
      location: selected,
      other_location: otherText,
      poster_first_name: first,
      poster_last_name: last,
      image: existingImageUrls,
      created_date_to: base.created_date_to || '',
      created_time_to: base.created_time_to || '',
      declined_remarks: base.declined_remarks || '',
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

  useEffect(() => {
    const normalized = normalizeForm(item);
    setForm(normalized);
    setItemNameOther(isCustomItemName(normalized.title, normalized.category));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

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

  // Close the Area Lost dropdown when clicking outside of it
  useEffect(() => {
    function handleClickOutside(e) {
      if (locationRef.current && !locationRef.current.contains(e.target)) {
        setLocationOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const set = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Toggle a single area on/off in the multi-select. Unchecking "Others"
  // also clears the free-text field for custom locations. Selection is
  // capped at MAX_LOCATIONS — attempting to add beyond that is a no-op.
  const toggleLocation = (area) => {
    setForm((prev) => {
      const current = Array.isArray(prev.location) ? prev.location : [];
      const exists = current.includes(area);

      if (!exists && current.length >= MAX_LOCATIONS) {
        // Already at the cap — ignore attempts to select another area.
        return prev;
      }

      const next = exists ? current.filter((a) => a !== area) : [...current, area];
      return {
        ...prev,
        location: next,
        ...(area === 'Others' && exists ? { other_location: '' } : {}),
      };
    });
  };

  // Changing the Status away from "Declined" clears any previously entered
  // decline reason so a stale remark doesn't silently linger on a
  // re-approved / re-opened report.
  const setStatus = (newStatus) => {
    setForm((prev) => ({
      ...prev,
      status: newStatus,
      declined_remarks: newStatus === 'Declined' ? prev.declined_remarks : '',
    }));
  };

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
      window.alert("Date Reported 'To' cannot be before 'From'.");
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
      window.alert("Time Reported 'To' cannot be before 'From'.");
      return;
    }

    const hasLocation = Array.isArray(form.location) && form.location.length > 0;

    if (Array.isArray(form.location) && form.location.length > MAX_LOCATIONS) {
      window.alert(`You can select up to ${MAX_LOCATIONS} areas only.`);
      return;
    }

    if (
      !form.title?.trim() ||
      !form.poster_first_name?.trim() ||
      !form.poster_last_name?.trim() ||
      !form.created_date?.trim() ||
      !hasLocation ||
      (form.location.includes("Others") && !form.other_location?.trim()) ||
      (form.status === "Declined" && !form.declined_remarks?.trim())
    ) {
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        location: serializeLocation(form.location, form.other_location),
        // Backend still stores a single combined name; the split
        // first/last inputs are only a form-side convenience.
        poster_name: `${form.poster_first_name.trim()} ${form.poster_last_name.trim()}`.trim(),
      };

      delete payload.other_location;
      delete payload.poster_first_name;
      delete payload.poster_last_name;

      await onSave(payload);
    } catch (error) {
      console.error("Error saving lost item:", error);
    } finally {
      setSaving(false);
    }
  };

  // PhotoUpload's value is a mixed array of existing URL strings (already
  // saved photos) and new File objects (freshly picked, not yet uploaded).
  const handlePhotoChange = (e) => {
    const { name, value } = e.target;
    set(name, value);
  };

  const inputClass =
    "h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1478a7] disabled:bg-slate-100";
  const labelClass = "mb-2 block text-xs font-bold uppercase text-slate-700";
  const rangeLabelClass = "mb-1 block text-[10px] font-bold uppercase text-slate-400";
  const today = new Date().toLocaleDateString("en-CA");
  const selectedLocations = Array.isArray(form.location) ? form.location : [];
  const itemNamePresets = ITEM_NAME_OPTIONS[form.category] || [];
  const locationLimitReached = selectedLocations.length >= MAX_LOCATIONS;

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
            <h3 className="text-lg font-bold">
              {isEdit ? "Edit Lost Item" : "Add Lost Item"}
            </h3>
            <p className="mt-1 text-sm text-white/90">
              {isEdit ? "Update lost item details" : "Submit details for a lost item"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base text-white transition hover:bg-white/25"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="max-h-[calc(92vh-88px)] overflow-y-auto px-6 py-5"
        >
          <div className="mx-auto max-w-3xl space-y-3">
            {/* Category is picked FIRST — the Item Name choices to its right
                depend on it. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Category</label>
                <select
                  className={inputClass}
                  value={form.category || "Personal"}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Reported By — First Name *</label>
                <input
                  className={inputClass}
                  value={form.poster_first_name || ""}
                  onChange={(e) => set("poster_first_name", e.target.value)}
                  placeholder="First name"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Reported By — Last Name *</label>
                <input
                  className={inputClass}
                  value={form.poster_last_name || ""}
                  onChange={(e) => set("poster_last_name", e.target.value)}
                  placeholder="Last name"
                  required
                />
              </div>
            </div>

            {/* Area Lost — multi-select, capped at MAX_LOCATIONS */}
            <div className="relative" ref={locationRef}>
              <div className="mb-2 flex items-center justify-between">
                <label className={`${labelClass} mb-0`}>Area Lost *</label>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {selectedLocations.length}/{MAX_LOCATIONS} selected
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLocationOpen((o) => !o)}
                className={`${inputClass} flex h-auto min-h-[44px] flex-wrap items-center gap-1.5 py-2 text-left`}
              >
                {selectedLocations.length > 0 ? (
                  selectedLocations.map((loc) => (
                    <span
                      key={loc}
                      className="inline-flex items-center gap-1 rounded-full bg-[#EAF4F8] px-2.5 py-1 text-xs font-semibold text-[#0B6B8A]"
                    >
                      {loc}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">Select one or more areas</span>
                )}
              </button>

              {locationOpen && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-300 bg-white p-2 shadow-lg">
                  <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Select up to {MAX_LOCATIONS} areas
                  </p>

                  {AREAS.map((a) => {
                    const checked = selectedLocations.includes(a);
                    const disabled = !checked && locationLimitReached;
                    return (
                      <label
                        key={a}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                          disabled
                            ? "cursor-not-allowed text-slate-300"
                            : "cursor-pointer text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleLocation(a)}
                          className="h-4 w-4 rounded border-slate-300 text-[#0B6B8A] focus:ring-[#0B6B8A] disabled:cursor-not-allowed"
                        />
                        {a}
                      </label>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setLocationOpen(false)}
                    className="mt-1 w-full rounded-lg bg-[#0B6B8A] py-1.5 text-xs font-bold uppercase text-white hover:bg-[#095A74]"
                  >
                    Done
                  </button>
                </div>
              )}

              {selectedLocations.includes("Others") && (
                <input
                  className={`${inputClass} mt-2`}
                  value={form.other_location || ""}
                  onChange={(e) => set("other_location", e.target.value)}
                  placeholder="Please specify location(s), separated by commas"
                  required
                />
              )}
            </div>

            {/* Date Reported & Time Reported — now settable as a range (From / To) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Date Reported *</label>
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
                  <label className={labelClass}>Time Reported</label>
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
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {isEdit && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Time Reported</label>
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

            {/* Declined Remarks — only relevant (and required) once Status is
                set to "Declined". Lets staff record/edit why a report was
                declined directly from the edit form, not just the Decline
                confirmation prompt. */}
            {isEdit && form.status === "Declined" && (
              <div>
                <label className={labelClass}>Declined Remarks *</label>
                <textarea
                  className="min-h-[72px] w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1478a7]"
                  rows={2}
                  value={form.declined_remarks || ""}
                  onChange={(e) => set("declined_remarks", e.target.value)}
                  placeholder="Explain why this report was declined..."
                  required
                />
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
            </div>

            {/* Photo upload — now available for both Add and Edit. In Edit
                mode this is pre-populated with the item's existing photos
                (shown as previews) plus room for new ones, up to 3 total. */}
            <PhotoUpload
              name="image"
              value={form.image}
              onChange={handlePhotoChange}
            />

            <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 py-3 rounded-xl text-white text-sm font-semibold uppercase tracking-wide shadow-md transition-all duration-200 ${
                  saving
                    ? "bg-slate-400 cursor-not-allowed opacity-70"
                    : "bg-gradient-to-b from-[#384388] to-[#2D366D] hover:from-[#44509B] hover:to-[#2D366D] hover:shadow-lg active:scale-[0.98]"
                }`}
              >
                {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Item"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="h-12 rounded-xl bg-slate-200 text-sm font-black uppercase tracking-wide text-slate-500 transition hover:bg-slate-300"
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

// ─── Confirm Dialog ─────────────────────────────────────────────────────────
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
          className="h-12 w-full rounded-xl border border-[#0B6B8A] bg-white text-sm font-black uppercase tracking-wide text-[#0B6B8A] transition hover:bg-[#EAF4F8]"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);

// ─── Decline Dialog ─────────────────────────────────────────────────────────
// Like ConfirmModal, but collects a required remarks/reason before the
// report is marked Declined. This is what keeps a declined report
// self-explanatory later, both to staff and to the reporter checking their
// ticket code.
const DeclineModal = ({ item, onConfirm, onClose }) => {
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmed = remarks.trim();

  const handleConfirm = async () => {
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] bg-white px-8 py-8 text-center shadow-2xl">
        <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
          <AlertCircle size={30} strokeWidth={2.5} />
        </div>

        <h5 className="mb-3 text-lg font-black text-[#144B70]">Decline Report</h5>

        <p className="mx-auto mb-4 max-w-[280px] text-sm font-medium leading-6 text-[#5F6F8C]">
          {item?.title
            ? `Add a reason for declining "${item.title}". This will be visible when the report is looked up by ticket code.`
            : "Add a reason for declining this report."}
        </p>

        <textarea
          autoFocus
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder="e.g. Duplicate report, insufficient details, item already claimed..."
          className="mb-6 min-h-[84px] w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-left text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-red-400"
        />

        <div className="space-y-3">
          <button
            onClick={handleConfirm}
            disabled={!trimmed || submitting}
            className={`h-12 w-full rounded-xl text-sm font-black uppercase tracking-wide text-white shadow-md transition active:scale-[0.98] ${
              !trimmed || submitting
                ? "cursor-not-allowed bg-slate-300"
                : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {submitting ? "Declining..." : "Confirm Decline"}
          </button>

          <button
            onClick={onClose}
            disabled={submitting}
            className="h-12 w-full rounded-xl border border-[#0B6B8A] bg-white text-sm font-black uppercase tracking-wide text-[#0B6B8A] transition hover:bg-[#EAF4F8] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── LostItems Main Page ────────────────────────────────────────────────────
// Status tabs shown above the table. Order controls display order.
const STATUS_FILTERS = ['Pending', 'Approved', 'Declined'];

const LostItems = ({ currentFilter, role }) => {
  const { lostItems, addLostItem, updateLostItem } = useApp();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeConfirmation, setActiveConfirmation] = useState(null);
  // Item currently being declined via DeclineModal (separate from
  // activeConfirmation because this one needs a text input, not just a
  // yes/no confirm).
  const [declineTarget, setDeclineTarget] = useState(null);
  const [notificationMessage, setNotificationMessage] = useState(null);

  const tableContainerRef = useRef(null);

  useEffect(() => {
    fetchItems();

    const interval = setInterval(() => {
      fetchItems();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [currentFilter, statusFilter]);

  const goToPage = (page) => {
    setCurrentPage(page);
    tableContainerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  async function fetchItems() {
    try {
      const response = await getItems();
      setItems(response);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  }

  async function handleView(item) {
    try {
      const response = await getItemById(item.id);
      let data = response;
      if (Array.isArray(response)) data = response[0];
      else if (response && response.results) data = response.results[0];

      setSelectedItem(data);
    } catch (error) {
      console.error("Error fetching item details:", error);
      setSelectedItem(item);
    }
  }

  async function handleEdit(item) {
    try {
      const response = await getItemById(item.id);
      let data = response;
      if (Array.isArray(response)) data = response[0];
      else if (response && response.results) data = response.results[0];

      setEditItem({
        ...data,
        created_date: data.created_date || '',
      });
    } catch (error) {
      console.error('Error fetching item for edit:', error);
      setEditItem({
        ...item,
        created_date: item.created_date || '',
      });
    }
  }

  // Builds the FormData shared by add/edit: all scalar fields, plus every
  // newly-picked File in form.image appended under the repeated `image` key
  // (existing URL strings in form.image are already saved server-side and
  // are skipped here — only new Files need to be uploaded).
  function buildFormData(form) {
    const formData = new FormData();
    formData.append('title', form.title || '');
    formData.append('poster_name', form.poster_name || '');
    formData.append('category', form.category || '');
    formData.append('location', form.location || '');
    formData.append('created_date', form.created_date || '');
    formData.append('created_date_to', form.created_date_to || '');
    formData.append('created_time', form.created_time || '');
    formData.append('created_time_to', form.created_time_to || '');
    formData.append('description', form.description || '');
    if (form.status) formData.append('status', form.status);
    // Only carry a decline reason when the report is actually Declined —
    // otherwise send an empty string so a stale remark doesn't linger after
    // a status change back out of Declined.
    formData.append('declined_remarks', form.status === 'Declined' ? (form.declined_remarks || '') : '');

    const images = Array.isArray(form.image) ? form.image : (form.image ? [form.image] : []);
    images.forEach((file) => {
      if (file instanceof File) formData.append('image', file);
    });

    return formData;
  }

  async function handleSaveEdit(updatedForm) {
    try {
      const formData = buildFormData(updatedForm);
      await editLostItem(editItem.id, formData);

      window.alert('Item updated successfully!');
      await fetchItems();
      setEditItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      window.alert('Failed to update item. Please try again.');
    }
  }

  async function handleAddItem(form) {
    try {
      const formData = buildFormData(form);

      // Admin/Moderator reports skip Pending review and go straight to Approved
      const isStaff = ['admin', 'moderator'].includes((role || '').toLowerCase());
      formData.set('status', isStaff ? 'Approved' : 'Pending');

      await createLostItem(formData);

      logActivity({
        actor_name: form.poster_name,
        actor_role: isStaff ? (role || '').toLowerCase() : 'reporter',
        action: 'created',
        target_title: form.title,
        details: 'reported a lost item',
      });

      window.alert(isStaff ? 'Item added and approved successfully!' : 'Item added successfully!');
      await fetchItems();
      setAddOpen(false);
    } catch (error) {
      console.error('Error adding item:', error);
      window.alert('Failed to add item. Please try again.');
    }
  }

  // Updates an item's status in place (Approved / Claimed / Declined, etc.)
  // without deleting the record — this is what keeps the item trackable by
  // ticket code afterwards (e.g. so a declined report still shows up when
  // the reporter checks their ticket). `remarks` is only meaningful (and
  // saved) when newStatus is 'Declined'.
  async function handleUpdateStatus(item, newStatus, remarks = '') {
    try {
      const formData = new FormData();
      formData.append('title', item.title || '');
      formData.append('poster_name', item.poster_name || '');
      formData.append('category', item.category || '');
      formData.append('location', item.location || '');
      formData.append('created_date', item.created_date || '');
      formData.append('created_time', item.created_time || '');
      formData.append('description', item.description || '');
      formData.append('status', newStatus);
      formData.append('declined_remarks', newStatus === 'Declined' ? remarks : '');

      await editLostItem(item.id, formData);

      logActivity({
        action: newStatus.toLowerCase(),
        target_title: item.title,
        details:
          newStatus === 'Declined' && remarks
            ? `declined "${item.title}" — ${remarks}`
            : `marked "${item.title}" as ${newStatus}`,
      });

      setNotificationMessage(
        newStatus === 'Declined'
          ? `"${item.title}" was declined.`
          : `Item marked as ${newStatus}.`
      );
      await fetchItems();
      setSelectedItem(null);
    } catch (error) {
      console.error('Error updating item status:', error);
      setNotificationMessage('Failed to update item status. Please try again.');
    }
  }

  // Archives (deletes) an item and logs the action. Server errors are
  // surfaced with their real message so failures are visible instead of
  // silently stopping before logActivity ever runs.
  // NOTE: this is a hard delete — used only for the table's "Archive" action.
  // Declining a report no longer goes through here; see handleUpdateStatus,
  // which keeps the record around (as status "Declined") so it stays
  // trackable by ticket code.
  async function handleArchive(id) {
    try {
      const target = items.find((i) => i.id === id);
      await deleteLostItem(id);

      logActivity({
        action: 'archived',
        target_title: target?.title,
        details: target?.title ? `archived "${target.title}"` : 'archived an item',
      });

      setNotificationMessage('Item archived.');
      await fetchItems();
      setSelectedItem(null);
      setActiveConfirmation(null);
    } catch (error) {
      console.error('Error archiving item:', error.response?.data || error.message || error);

      const serverMsg =
        error.response?.data?.detail ||
        (typeof error.response?.data === 'string' ? error.response.data : null);

      setNotificationMessage(serverMsg || 'Failed to archive item. Please try again.');
    }
  }

  // Shared by the filtered table and the per-tab counts below, so both stay
  // in sync with the search box.
  const matchesSearch = (item) => {
    const searchText = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(searchText) ||
      item.category?.toLowerCase().includes(searchText) ||
      item.poster_name?.toLowerCase().includes(searchText) ||
      item.location?.toLowerCase().includes(searchText) ||
      item.status?.toLowerCase().includes(searchText)
    );
  };

  const filteredLost = items
    .filter((item) =>
      item.type?.toUpperCase() === 'LOST' &&
      item.status === statusFilter &&
      matchesSearch(item)
    )
    .sort((a, b) => b.id - a.id);

  const statusCounts = STATUS_FILTERS.reduce((acc, s) => {
    acc[s] = items.filter(
      (item) => item.type?.toUpperCase() === 'LOST' && item.status === s && matchesSearch(item)
    ).length;
    return acc;
  }, {});

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredLost.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filteredLost.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="bg-white rounded-[18px] border border-[#D8E2EF] shadow-[0_8px_24px_rgba(45,54,109,0.08)] overflow-hidden flex flex-col h-[calc(100vh-135px)]">

        {/* Header */}
        <div className="bg-white px-6 sm:px-8 py-4 border-b border-[#D8E2EF] shrink-0">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 shrink-0">
            <div>
              <div className="flex items-center gap-3">
                
                <div>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-[0.16em] text-[#071E3D]">
                    Lost Items
                  </h3>
                  <p className="text-xs sm:text-sm text-[#7B8AA6] italic mt-0.5">
                    Manage all reported lost items within the campus
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
              <div className="relative w-full sm:w-[300px]">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0B6B8A] text-sm">
                  🔍
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search lost items..."
                  className="w-full pl-10 pr-4 py-2.5 border border-[#CBD8E8] rounded-full text-sm outline-none bg-white text-[#071E3D] placeholder:text-[#8A98B3] focus:ring-2 focus:ring-[#0B6B8A]/20 focus:border-[#0B6B8A] transition-all"
                />
              </div>

              <button
                onClick={() => setAddOpen(true)}
                className="px-6 py-2.5 rounded-full bg-[#2D366D] text-white font-black uppercase tracking-[0.1em] text-xs shadow-[0_6px_14px_rgba(45,54,109,0.25)] hover:bg-[#24305C] transition-all whitespace-nowrap"
              >
                📋 Add Lost Item
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Switch — sliding pill toggle, aligned to the right */}
        <div className="flex items-center justify-end border-b border-[#D8E2EF] bg-white px-6 sm:px-8 py-3 shrink-0">
          <div className="relative inline-flex rounded-full bg-slate-100 p-1">
            {/* Sliding indicator that moves behind the active label */}
            <div
              className="absolute inset-y-1 rounded-full bg-[#0B6B8A] shadow-md transition-all duration-300 ease-out"
              style={{
                width: `calc(${100 / STATUS_FILTERS.length}% - 4px)`,
                left: `calc(${(100 / STATUS_FILTERS.length) * STATUS_FILTERS.indexOf(statusFilter)}% + 2px)`,
              }}
            />

            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`relative z-10 whitespace-nowrap rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-wide transition-colors duration-300 ${
                  statusFilter === s ? "text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {s}
                <span className={`ml-1.5 ${statusFilter === s ? "text-white/80" : "text-slate-400"}`}>
                  ({statusCounts[s] ?? 0})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div ref={tableContainerRef} className="flex-1 overflow-auto bg-white">
          <table className="w-full min-w-[1000px] table-fixed border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-[12%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Ticket</th>
                <th className="w-[15%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Item Name</th>
                <th className="w-[12%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Category</th>
                <th className="w-[16%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Reported By</th>
                <th className="w-[16%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Area</th>
                <th className="w-[12%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Date</th>
                <th className="w-[9%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Status</th>
                <th className="w-[8%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Action</th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item, index) => (
                  <tr key={item.id} className={`h-[56px] transition-colors ${index % 2 === 0 ? "bg-white" : "bg-[#F6FAFF]"} hover:bg-[#EAF4FF]`}>
                    <td className="border border-gray-300 p-2 text-center align-middle font-bold text-[#0B6B8A] text-xs">{item.ticket_code}</td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[13px]">{toTitleCase(item.title)}</td>
                    <td className="border border-gray-300 p-4 text-center align-middle">
                      <span className="inline-flex items-center justify-center px-3 py-1 text-[13px] uppercase text-[#2D366D]">
                        {toTitleCase(item.category) || '-'}
                      </span>
                    </td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-600 text-[13px]">{toTitleCase(item.poster_name) || '-'}</td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[13px]">
                      <div className="flex items-center justify-center whitespace-normal leading-tight">
                        <span>{toTitleCase(item.location) || '-'}</span>
                      </div>
                    </td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[13px]">
                      <span className="block">{item.created_date || '-'}</span>
                      <span className="block">{item.created_time || '-'}</span>
                    </td>
                    <td className="border border-gray-300 p-4 text-center align-middle">
                      <span className={`rounded px-3 py-1 text-[10px] font-black uppercase ${statusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="border border-gray-300 p-2 text-center align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleView(item)}
                          title="Review Item"
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#0B6B8A] text-white transition hover:bg-[#095A74]"
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          onClick={() => handleEdit(item)}
                          title="Edit Item"
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#2D366D] text-white transition hover:opacity-90"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => setActiveConfirmation({
                            text: `Are you sure you want to archive "${item.title}"?`,
                            action: () => handleArchive(item.id)
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
                  <td colSpan={8} className="bg-white py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <span className="text-4xl font-black tracking-tighter text-[#071E3D] opacity-20">
                        EMPTY
                      </span>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7B8AA6]">
                        {search
                          ? `No ${statusFilter.toLowerCase()} items found for "${search}"`
                          : `No ${statusFilter.toLowerCase()} items found`}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredLost.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-[#D8E2EF] bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-[#7B8AA6]">
              Showing {startIndex + 1}-
              {Math.min(startIndex + ITEMS_PER_PAGE, filteredLost.length)} of{" "}
              {filteredLost.length}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => goToPage(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 rounded-lg border border-[#D8E2EF] px-4 text-[11px] font-black uppercase tracking-wide text-[#0B6B8A] transition hover:bg-[#EAF4FF] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>

              <span className="text-xs font-bold text-[#7B8AA6]">
                Page {currentPage} of {totalPages || 1}
              </span>

              <button
                type="button"
                onClick={() => goToPage(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-8 rounded-lg border border-[#D8E2EF] px-4 text-[11px] font-black uppercase tracking-wide text-[#0B6B8A] transition hover:bg-[#EAF4FF] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

      {/* Add Item Modal */}
      {addOpen && (
        <ItemModal
          item={null}
          onSave={handleAddItem}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Edit Item Modal */}
      {editItem && (
        <ItemModal
          item={editItem}
          onSave={handleSaveEdit}
          onClose={() => setEditItem(null)}
        />
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
                <h3 className="text-lg font-bold">Item Review</h3>
                <p className="mt-1 text-sm text-white/90">
                  Review lost item details before approval
                </p>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-6 py-5">
              <div className="mx-auto max-w-3xl space-y-4">
                {(() => {
                  const imgs = getImageUrls(selectedItem);
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
                        alt="Item Preview"
                      />
                    );
                  }
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      {imgs.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          className="h-40 w-full rounded-xl border border-slate-200 bg-slate-100 object-cover"
                          alt={`Item Preview ${idx + 1}`}
                        />
                      ))}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Item Name</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">
                      {toTitleCase(selectedItem.title) || '-'}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Reported By</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      {toTitleCase(selectedItem.poster_name) || '-'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Category</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      {toTitleCase(selectedItem.category) || '-'}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Area Lost</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      {toTitleCase(selectedItem.location) || '-'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Date Reported</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                      {selectedItem.created_date || '-'}
                      {selectedItem.created_date_to ? ` – ${selectedItem.created_date_to}` : ''}
                      {selectedItem.created_time ? ` at ${selectedItem.created_time}` : ''}
                      {selectedItem.created_time_to ? ` – ${selectedItem.created_time_to}` : ''}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Status</p>
                    <div className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">
                      <span className={`inline-block rounded px-3 py-1 text-xs font-black uppercase ${statusColor(selectedItem.status)}`}>
                        {selectedItem.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 block text-xs font-bold uppercase text-slate-700">Description</p>
                  <div className="min-h-[80px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                    {selectedItem.description || 'No description provided.'}
                  </div>
                </div>

                {/* Declined Remarks — shown whenever a reason is on file,
                    regardless of current status, so history isn't lost. */}
                {selectedItem.declined_remarks && (
                  <div>
                    <p className="mb-2 block text-xs font-bold uppercase text-red-700">Declined Remarks</p>
                    <div className="min-h-[60px] w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {selectedItem.declined_remarks}
                    </div>
                  </div>
                )}

                {selectedItem.status === 'Approved' && (
                  <div className="flex items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="rounded-xl bg-green-500 p-2 text-white shadow-md">
                      <CheckCircle size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase text-green-700">Item Publicly Visible</p>
                      <p className="text-xs font-bold uppercase text-green-600">
                        This item has been approved and is now visible to users.
                      </p>
                    </div>
                  </div>
                )}

                {selectedItem.status === 'Declined' && (
                  <div className="flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="rounded-xl bg-red-500 p-2 text-white shadow-md">
                      <AlertCircle size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase text-red-700">Report Declined</p>
                      <p className="text-xs font-bold uppercase text-red-600">
                        This report was declined and is no longer active. It remains
                        trackable by its ticket code.
                      </p>
                    </div>
                  </div>
                )}

                {/* Review Action Controls — gated by current status */}
                <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                  {selectedItem.status === 'Pending' ? (
                    <>
                      <button
                        onClick={() => setActiveConfirmation({
                          text: "Are you sure you want to approve this item?",
                          action: () => handleUpdateStatus(selectedItem, 'Approved')
                        })}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#384388] to-[#2D366D] text-sm font-semibold uppercase tracking-wide text-white shadow-md transition-all duration-200 hover:from-[#44509B] hover:to-[#2D366D] hover:shadow-lg active:scale-[0.98]"
                      >
                        <CheckCircle size={18} />
                        Approve Item
                      </button>
                      <button
                        onClick={() => setDeclineTarget(selectedItem)}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-200 text-sm font-black uppercase tracking-wide text-slate-500 transition hover:bg-slate-300"
                      >
                        <AlertCircle size={18} />
                        Decline
                      </button>
                    </>
                  ) : (
                    <>
                      {selectedItem.status === 'Approved' && (
                        <button
                          onClick={() => setActiveConfirmation({
                            text: "Are you sure you want to mark this item as Claimed?",
                            action: () => handleUpdateStatus(selectedItem, 'Claimed')
                          })}
                          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#384388] to-[#2D366D] text-sm font-semibold uppercase tracking-wide text-white shadow-md transition-all duration-200 hover:from-[#44509B] hover:to-[#2D366D]"
                        >
                          <CheckCircle size={18} />
                          Mark Claimed
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-200 text-sm font-black uppercase tracking-wide text-slate-500 transition hover:bg-slate-300"
                      >
                        Close
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
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

      {/* Decline Dialog — captures a required reason, then applies it */}
      {declineTarget && (
        <DeclineModal
          item={declineTarget}
          onConfirm={async (remarks) => {
            await handleUpdateStatus(declineTarget, 'Declined', remarks);
            setDeclineTarget(null);
          }}
          onClose={() => setDeclineTarget(null)}
        />
      )}

      {/* Global Toast Notification */}
      {notificationMessage && (
        <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-3 rounded-xl bg-slate-800 px-5 py-3 text-white shadow-xl">
          <span className="text-sm font-medium">{notificationMessage}</span>
          <button
            onClick={() => setNotificationMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default LostItems;
