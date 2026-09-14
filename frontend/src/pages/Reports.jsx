import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaAward,
  FaExclamationTriangle,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaPrint,
  FaFilter,
  FaTimes,
  FaInbox,
  FaChevronDown,
  FaCalendarAlt
} from "react-icons/fa";
import { getItems } from "../api/api";

// School letterhead logo (embedded so the printed report is self-contained)
const SCHOOL_LOGO = "data:image/png;base64,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";
const SCHOOL_NAME = "Saint Louis College";
const SCHOOL_ADDRESS = "City of San Fernando, La Union";

// Canonical filter option lists (used instead of deriving from live data,
// which can produce duplicate/inconsistent entries)
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

// Legacy/synonym location strings seen in older records, mapped to the
// canonical AREAS entry they actually refer to. Anything that's neither an
// exact AREAS match nor a known synonym falls back to "Others" so it groups
// with everything else non-standard instead of each raw string becoming its
// own row in the Location Hotspots table (e.g. "Basement", "All").
const LOCATION_SYNONYMS = {
  'canteen': 'SLC Canteen',
  'gym': 'Gymnasium',
  'gymnasium ': 'Gymnasium',
  'main building': 'Administrative Building (Main Building)',
  'admin building': 'Administrative Building (Main Building)',
  'administrative building': 'Administrative Building (Main Building)',
  'grandstand area': 'Grandstand',
};

/**
 * Turn a raw stored `location` string into an array of one or more
 * canonical AREAS entries. Location is stored as a single text field that
 * can hold: a single canonical area, a legacy synonym ("Gym"), a
 * comma-separated list of several areas ("Grandstand, Chapel, Library"),
 * or junk that predates the current area list ("All", "Basement"). Without
 * this, a multi-area record becomes its own one-off row instead of
 * contributing to each area it actually lists, and legacy synonyms
 * fragment into duplicate-looking rows next to their canonical name.
 */
function normalizeAreas(rawLocation) {
  if (!rawLocation || typeof rawLocation !== 'string') return [];
  const parts = rawLocation.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [];

  const resolved = parts.map((part) => {
    if (AREAS.includes(part)) return part;
    const synonym = LOCATION_SYNONYMS[part.toLowerCase()];
    return synonym || 'Others';
  });

  // De-duplicate — a record might list the same area twice, or two
  // unrecognized parts might both resolve to "Others".
  return Array.from(new Set(resolved));
}

// ================= HELPERS =================

// `a` is always expected to be a subset of `b` (e.g. claimed items out of
// all logged items, or recovered items out of all items at a location), so
// the result is mathematically bounded at 100%. Math.min(100, ...) is kept
// as a defensive floor/ceiling only — it guards against bad/duplicate data
// producing a nonsensical >100% figure, it is not what makes the math work.
const pct = (a, b) => (b === 0 ? 0 : Math.min(100, Math.round((a / b) * 100)));

const riskLevel = (lost) =>
  lost >= 15 ? "High Risk" : lost >= 8 ? "Medium Risk" : "Low Risk";

const riskColor = (risk) =>
  risk.startsWith("High")
    ? "bg-rose-50 text-rose-600 border border-rose-100"
    : risk.startsWith("Medium")
    ? "bg-amber-50 text-amber-600 border border-amber-100"
    : "bg-emerald-50 text-emerald-600 border border-emerald-100";

const pctColor = (p) =>
  p >= 70 ? "text-emerald-600" : p >= 50 ? "text-amber-600" : "text-rose-500";

const EMPTY_FILTERS = {
  locations: [],
  categories: [],
  statuses: [],
  types: [],
  dateRange: { start: "", end: "" }
};

// ================= STAT CARD =================

const StatCard = ({ label, count, icon: Icon, color, bgColor, description }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow print:shadow-none h-full flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
          {label}
        </p>
        <h3 className="text-3xl font-black text-slate-800 mt-1 truncate">
          {count}
        </h3>
      </div>

      <div className={`${bgColor} ${color} p-3 rounded-xl shrink-0`}>
        <Icon size={18} />
      </div>
    </div>

    <p className="mt-4 text-xs text-slate-400">{description}</p>
  </div>
);

// ================= DONUT =================

const Donut = ({ value, label, color = "#2D366D" }) => {
  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;

  return (
    <svg width="160" height="160">
      <circle cx="80" cy="80" r={radius} stroke="#E2E8F0" strokeWidth="16" fill="none" />

      <circle
        cx="80"
        cy="80"
        r={radius}
        stroke={color}
        strokeWidth="16"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${progress} ${circumference}`}
        transform="rotate(-90 80 80)"
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />

      <text x="80" y="76" textAnchor="middle" fontSize="26" fontWeight="900" fill="#1E254E">
        {value}%
      </text>

      <text x="80" y="96" textAnchor="middle" fontSize="9" fontWeight="800" fill="#94A3B8" letterSpacing="1">
        {label}
      </text>
    </svg>
  );
};

// ================= HORIZONTAL BAR =================

const HBar = ({ value, max, color = "#2D366D" }) => (
  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
    <div
      className="h-full rounded-full transition-all duration-300"
      style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color }}
    />
  </div>
);

const BAR_PALETTE = ["#2D366D", "#4F5FA8", "#7C88C9", "#B7BEE4", "#E08B4F", "#3FAE8A"];

const BarChart = ({ data }) => {
  const max = Math.max(...data.map((x) => x.value), 1);

  if (data.length === 0) {
    return <EmptyState message="No data for the current filters" />;
  }

  return (
    <div className="space-y-4">
      {data.map((item, index) => (
        <div key={index}>
          <div className="flex justify-between text-xs font-bold mb-2 text-slate-600">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>

          <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: BAR_PALETTE[index % BAR_PALETTE.length]
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ================= EMPTY STATE =================

const EmptyState = ({ message = "No records match these filters" }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-300">
    <FaInbox size={28} />
    <p className="text-xs font-bold text-slate-400">{message}</p>
  </div>
);

// ================= SECTION WRAPPER =================

const Section = ({ title, className = "", children }) => (
  <div className={`bg-white rounded-2xl p-7 border border-slate-200/70 print-section flex flex-col justify-between ${className}`}>
    <h2 className="font-black uppercase text-sm tracking-widest text-slate-700 mb-7">
      {title}
    </h2>
    <div className="flex-1">{children}</div>
  </div>
);

// ================= SUMMARY REPORT (PRINT-ONLY) =================
// This is what actually gets printed / exported when "Print Report" is
// pressed. It's a plain, formal written summary of the filtered data —
// not the dashboard cards/charts — built for a reader (e.g. a supervisor
// or "navigator") who just needs the key figures and findings.

const SummaryReport = ({
  totalItems,
  lostItems,
  surrendered,
  claimed,
  recoveryRate,
  areaStats,
  catStats,
  statusStats,
  topHotspot,
  activeChips,
  filters
}) => {
  const now = new Date();
  const generatedOn = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;

  const highRiskAreas = areaStats.filter((a) => riskLevel(a.lost) === "High Risk");
  const mediumRiskAreas = areaStats.filter((a) => riskLevel(a.lost) === "Medium Risk");

  const topArea = areaStats[0];
  const topCategory = catStats[0];

  const periodLabel =
    filters.dateRange.start && filters.dateRange.end
      ? `${filters.dateRange.start} to ${filters.dateRange.end}`
      : filters.dateRange.start
      ? `From ${filters.dateRange.start}`
      : filters.dateRange.end
      ? `Up to ${filters.dateRange.end}`
      : "All available records";

  return (
    <div className="summary-report">
      <div className="sr-letterhead">
        <img src={SCHOOL_LOGO} alt={`${SCHOOL_NAME} seal`} className="sr-logo" />
        <div className="sr-letterhead-text">
          <p className="sr-school-name">{SCHOOL_NAME}</p>
          <p className="sr-school-address">{SCHOOL_ADDRESS}</p>
        </div>
      </div>

      <h1 className="sr-title">Lost &amp; Found Statistical Summary Report</h1>

      <table className="sr-meta">
        <tbody>
          <tr>
            <td>Generated</td>
            <td>{generatedOn}</td>
          </tr>
          <tr>
            <td>Reporting Period</td>
            <td>{periodLabel}</td>
          </tr>
          {activeChips.length > 0 && (
            <tr>
              <td>Filters Applied</td>
              <td>{activeChips.map((c) => c.label).join("; ")}</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="sr-heading">1. Overview</h2>
      <p className="sr-body">
        During the period covered by this report, {totalItems} item record{totalItems === 1 ? "" : "s"} were
        logged, comprising {lostItems.length} lost item report{lostItems.length === 1 ? "" : "s"} and{" "}
        {surrendered.length} surrendered item report{surrendered.length === 1 ? "" : "s"}. Of these,{" "}
        {claimed.length} item{claimed.length === 1 ? "" : "s"} {claimed.length === 1 ? "has" : "have"} been
        claimed or returned to their owner, giving an overall recovery rate of {recoveryRate}%.
      </p>

      <h2 className="sr-heading">2. Key Metrics</h2>
      <table className="sr-table">
        <tbody>
          <tr>
            <td>Recovery Rate</td>
            <td>{recoveryRate}%</td>
          </tr>
          <tr>
            <td>Lost Items Reported</td>
            <td>{lostItems.length}</td>
          </tr>
          <tr>
            <td>Found (Surrendered) Items</td>
            <td>{surrendered.length}</td>
          </tr>
          <tr>
            <td>Claimed / Returned Items</td>
            <td>{claimed.length}</td>
          </tr>
          <tr>
            <td>Top Hotspot</td>
            <td>{topHotspot}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="sr-heading">3. Location Risk Analysis</h2>
      <p className="sr-body">
        {areaStats.length === 0 ? (
          "No location data is available for the current filters."
        ) : (
          <>
            {topArea?.area} recorded the highest number of lost items ({topArea?.lost} report
            {topArea?.lost === 1 ? "" : "s"}) among all locations.{" "}
            {highRiskAreas.length > 0
              ? `${highRiskAreas.length} location${highRiskAreas.length === 1 ? " is" : "s are"} currently classified as High Risk: ${highRiskAreas
                  .map((a) => a.area)
                  .join(", ")}.`
              : "No locations currently meet the High Risk threshold."}{" "}
            {mediumRiskAreas.length > 0 &&
              `${mediumRiskAreas.length} additional location${
                mediumRiskAreas.length === 1 ? " is" : "s are"
              } at Medium Risk: ${mediumRiskAreas.map((a) => a.area).join(", ")}.`}
          </>
        )}
      </p>

      {areaStats.length > 0 && (
        <table className="sr-table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Lost</th>
              <th>Recovered</th>
              <th>Rate</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {areaStats.slice(0, 8).map((area, index) => (
              <tr key={index}>
                <td>{area.area}</td>
                <td>{area.lost}</td>
                <td>{area.recovered}</td>
                <td>{pct(area.recovered, area.total)}%</td>
                <td>{riskLevel(area.lost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="sr-heading">4. Category Breakdown</h2>
      <p className="sr-body">
        {catStats.length === 0 ? (
          "No category data is available for the current filters."
        ) : (
          <>
            The most frequently reported item category is "{topCategory?.cat}", accounting for{" "}
            {topCategory?.count} record{topCategory?.count === 1 ? "" : "s"} ({pct(topCategory?.count || 0, totalItems)}% of
            all filtered items). {catStats.length > 1 ? "Other reported categories include " : ""}
            {catStats
              .slice(1, 6)
              .map((c) => `${c.cat} (${c.count})`)
              .join(", ")}
            {catStats.length > 1 ? "." : ""}
          </>
        )}
      </p>

      <h2 className="sr-heading">5. Status Distribution</h2>
      <p className="sr-body">
        {statusStats.length === 0
          ? "No status data is available for the current filters."
          : statusStats.map((s) => `${s.label}: ${s.value}`).join(" · ")}
      </p>

      <p className="sr-footer">
        This report was generated automatically by the Lost &amp; Found Management System on {generatedOn}.
      </p>
    </div>
  );
};

// ================= MULTI-SELECT DROPDOWN =================

const MultiSelectDropdown = ({ label, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((o) => o !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const displayLabel =
    selected.length === 0
      ? "All"
      : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div className="relative flex-1 min-w-[150px]" ref={ref}>
      <label className="text-xs font-bold text-slate-500">{label}</label>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="
          w-full mt-1 flex items-center justify-between gap-2
          bg-white border border-slate-200 rounded-xl
          px-3 py-2 text-sm font-bold text-slate-700
          hover:border-slate-300
          focus:outline-none focus:ring-2 focus:ring-[#2D366D]/30
        "
      >
        <span className="truncate">{displayLabel}</span>
        <FaChevronDown
          size={10}
          className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="
            absolute z-20 mt-2 w-52
            bg-white border border-slate-200 rounded-xl shadow-lg
            p-2 max-h-60 overflow-y-auto
          "
        >
          {options.length === 0 ? (
            <p className="text-xs font-bold text-slate-400 px-2 py-1.5">No options</p>
          ) : (
            options.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-600"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggleOption(opt)}
                  className="accent-[#2D366D] w-3.5 h-3.5"
                />
                {opt}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ================= DATE RANGE PICKER =================

const DATE_PRESETS = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "last30", label: "Last 30 Days" },
  { key: "year", label: "This Year" }
];

const toISODate = (d) => {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
};

const DateRangePicker = ({ range, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const applyPreset = (key) => {
    const today = new Date();
    let start;
    let end;

    if (key === "week") {
      start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (key === "month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (key === "last30") {
      end = today;
      start = new Date(today);
      start.setDate(today.getDate() - 30);
    } else if (key === "year") {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
    }

    onChange({ start: toISODate(start), end: toISODate(end) });
  };

  const displayLabel =
    range.start && range.end
      ? `${range.start} → ${range.end}`
      : range.start
      ? `From ${range.start}`
      : range.end
      ? `Until ${range.end}`
      : "All dates";

  return (
    <div className="relative flex-1 min-w-[200px]" ref={ref}>
      <label className="text-xs font-bold text-slate-500">Date Range</label>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="
          w-full mt-1 flex items-center justify-between gap-2
          bg-white border border-slate-200 rounded-xl
          px-3 py-2 text-sm font-bold text-slate-700
          hover:border-slate-300
          focus:outline-none focus:ring-2 focus:ring-[#2D366D]/30
        "
      >
        <span className="truncate flex items-center gap-2 min-w-0">
          <FaCalendarAlt size={12} className="text-slate-400 shrink-0" />
          <span className="truncate">{displayLabel}</span>
        </span>
        <FaChevronDown
          size={10}
          className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="
            absolute z-20 mt-2 w-72
            bg-white border border-slate-200 rounded-xl shadow-lg
            p-4
          "
        >
          <div className="flex flex-wrap gap-2 mb-4">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className="text-[11px] font-black uppercase tracking-wide bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">From</label>
              <input
                type="date"
                value={range.start}
                max={range.end || undefined}
                onChange={(e) => onChange({ ...range, start: e.target.value })}
                className="
                  w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg
                  px-2 py-1.5 text-xs font-bold text-slate-700
                  focus:outline-none focus:ring-2 focus:ring-[#2D366D]/30
                "
              />
            </div>

            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">To</label>
              <input
                type="date"
                value={range.end}
                min={range.start || undefined}
                onChange={(e) => onChange({ ...range, end: e.target.value })}
                className="
                  w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg
                  px-2 py-1.5 text-xs font-bold text-slate-700
                  focus:outline-none focus:ring-2 focus:ring-[#2D366D]/30
                "
              />
            </div>
          </div>

          {(range.start || range.end) && (
            <button
              type="button"
              onClick={() => onChange({ start: "", end: "" })}
              className="mt-3 text-[11px] font-black text-rose-500 hover:text-rose-600"
            >
              Clear dates
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ================= FILTER BAR =================

const FilterBar = ({ filters, setFilters, options, activeCount, onReset, onPrint }) => (
  <div className="bg-white rounded-2xl px-6 py-4 border border-slate-200/70 print-section w-full">
    <div className="flex flex-wrap items-end gap-4 w-full">
      <div className="flex items-center gap-2 text-slate-400 pb-2.5 shrink-0">
        <FaFilter size={14} />
      </div>

      <div className="flex flex-1 flex-wrap items-end gap-4 min-w-0">
        <MultiSelectDropdown
          label="Location"
          options={options.locations}
          selected={filters.locations}
          onChange={(v) => setFilters((f) => ({ ...f, locations: v }))}
        />

        <MultiSelectDropdown
          label="Category"
          options={options.categories}
          selected={filters.categories}
          onChange={(v) => setFilters((f) => ({ ...f, categories: v }))}
        />

        <MultiSelectDropdown
          label="Status"
          options={options.statuses}
          selected={filters.statuses}
          onChange={(v) => setFilters((f) => ({ ...f, statuses: v }))}
        />

        <MultiSelectDropdown
          label="Item Type"
          options={options.types}
          selected={filters.types}
          onChange={(v) => setFilters((f) => ({ ...f, types: v }))}
        />

        <DateRangePicker
          range={filters.dateRange}
          onChange={(v) => setFilters((f) => ({ ...f, dateRange: v }))}
        />
      </div>

      <div className="flex items-center gap-4 ml-auto shrink-0 no-print">
        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs font-black text-rose-500 hover:text-rose-600 pb-2.5"
          >
            <FaTimes size={10} />
            Clear ({activeCount})
          </button>
        )}

        <button
          onClick={onPrint}
          className="
            flex items-center gap-2
            bg-[#2D366D] text-white
            px-5 py-2.5 rounded-xl
            font-black text-sm
            hover:opacity-90 transition-opacity
            shrink-0
          "
        >
          <FaPrint size={15} />
          Print Report
        </button>
      </div>
    </div>
  </div>
);

// ================= MAIN =================

export default function Reports() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    async function fetchItems() {
      try {
        const data = await getItems();
        setItems(data || []);
      } catch (error) {
        console.log("Reports fetch error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchItems();

    const interval = setInterval(() => {
      fetchItems();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // ================= DATE HELPERS =================

  const getItemDate = (item) => {
    const raw = item.date || item.dateReported || item.createdAt;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  // ================= FILTER OPTIONS =================
  // Location and Category now come from the fixed AREAS/CATS lists above,
  // so the dropdowns always show the full canonical set (no duplicates or
  // stray values from inconsistent data entry). Status and Type are still
  // derived live since there's no fixed list for those.

  const filterOptions = useMemo(() => {
    const uniq = (key) =>
      Array.from(new Set(items.map((i) => i[key]).filter(Boolean))).sort();

    return {
      locations: AREAS,
      categories: CATS,
      statuses: uniq("status"),
      types: uniq("type")
    };
  }, [items]);

  const activeFilterCount =
    filters.locations.length +
    filters.categories.length +
    filters.statuses.length +
    filters.types.length +
    (filters.dateRange.start || filters.dateRange.end ? 1 : 0);

  const resetFilters = () => setFilters(EMPTY_FILTERS);

  // ================= FILTERED DATA =================

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Match against every canonical area this item actually belongs to
      // (splitting multi-area records and resolving legacy synonyms), not
      // just an exact match on the raw stored string — otherwise selecting
      // "Grandstand" would miss a record stored as "Grandstand, Chapel" or
      // as the legacy synonym "Grandstand area".
      if (filters.locations.length) {
        const itemAreas = normalizeAreas(item.location);
        if (!filters.locations.some((loc) => itemAreas.includes(loc))) return false;
      }

      if (filters.categories.length && !filters.categories.includes(item.category))
        return false;

      if (filters.statuses.length && !filters.statuses.includes(item.status))
        return false;

      if (filters.types.length && !filters.types.includes(item.type)) return false;

      if (filters.dateRange.start || filters.dateRange.end) {
        const itemDate = getItemDate(item);

        if (!itemDate) return false;

        const itemDateStr = toISODate(itemDate);

        if (filters.dateRange.start && itemDateStr < filters.dateRange.start) return false;
        if (filters.dateRange.end && itemDateStr > filters.dateRange.end) return false;
      }

      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filters]);

  // ================= DATA PROCESSING =================

  const lostItems = filteredItems.filter((item) => item.type === "Lost");

  const surrendered = filteredItems.filter((item) => item.type === "Surrendered");

  const claimed = filteredItems.filter(
    (item) => item.status === "Claimed" || item.status === "Returned"
  );

  // Recovery rate = resolved items (Claimed/Returned) out of ALL logged
  // items (Lost reports + Surrendered items), not just Lost reports.
  // Previously this divided by lostItems.length alone, but `claimed` counts
  // BOTH Lost items marked Claimed and Surrendered items marked
  // Claimed/Returned (see LostItems.jsx and FoundItems.jsx — both types can
  // reach that status). Since claimed can include Surrendered-and-claimed
  // items that were never counted in lostItems, the old rate could exceed
  // 100%. Dividing by filteredItems.length instead is mathematically safe:
  // `claimed` is filtered FROM filteredItems, so it's always a subset of it.
  const recoveryRate = pct(claimed.length, filteredItems.length);

  const locations = {};

  filteredItems.forEach((item) => {
    // Attribute this item to EVERY canonical area it actually belongs to,
    // instead of using the raw stored string as the bucket key. That's what
    // was fragmenting the table: a record stored as "Grandstand, Chapel"
    // was becoming its own single combined row instead of adding one count
    // to "Grandstand" and one to "Chapel"; legacy synonyms like "Gym" were
    // showing up as separate rows next to the canonical "Gymnasium".
    const areas = normalizeAreas(item.location);
    if (areas.length === 0) return;

    areas.forEach((area) => {
      if (!locations[area]) locations[area] = { total: 0, lost: 0, recovered: 0 };

      // `total` = every item logged at this location (Lost + Surrendered),
      // used as the denominator for that location's recovery rate below so
      // `recovered` (which isn't restricted to Lost-type items) can never
      // outnumber it.
      locations[area].total++;

      // `lost` stays specific to Lost-type reports — it's used only for the
      // risk-level classification (riskLevel), which is about how many
      // active Lost reports came from a location, not about the rate.
      if (item.type === "Lost") locations[area].lost++;

      if (item.status === "Claimed" || item.status === "Returned")
        locations[area].recovered++;
    });
  });

  const areaStats = Object.entries(locations)
    .map(([area, data]) => ({ area, ...data }))
    .sort((a, b) => b.lost - a.lost);

  const categories = {};

  filteredItems.forEach((item) => {
    categories[item.category] = (categories[item.category] || 0) + 1;
  });

  const catStats = Object.entries(categories)
    .map(([cat, count]) => ({ cat, count }))
    .sort((a, b) => b.count - a.count);

  const statuses = {};

  filteredItems.forEach((item) => {
    statuses[item.status] = (statuses[item.status] || 0) + 1;
  });

  const statusStats = Object.entries(statuses).map(([label, value]) => ({
    label,
    value
  }));

  const comparisonData = [
    { label: "Lost Items", value: lostItems.length },
    { label: "Surrendered Items", value: surrendered.length },
    { label: "Claimed Items", value: claimed.length }
  ];

  const totalItems = filteredItems.length;

  const topHotspot = areaStats[0]?.area || "None";

  // ================= ACTIVE FILTER CHIPS =================

  const activeChips = [
    ...filters.locations.map((v) => ({ key: `location-${v}`, label: `Location: ${v}` })),
    ...filters.categories.map((v) => ({ key: `category-${v}`, label: `Category: ${v}` })),
    ...filters.statuses.map((v) => ({ key: `status-${v}`, label: `Status: ${v}` })),
    ...filters.types.map((v) => ({ key: `type-${v}`, label: `Type: ${v}` })),
    ...(filters.dateRange.start || filters.dateRange.end
      ? [
          {
            key: "date-range",
            label:
              filters.dateRange.start && filters.dateRange.end
                ? `Date: ${filters.dateRange.start} → ${filters.dateRange.end}`
                : filters.dateRange.start
                ? `Date: From ${filters.dateRange.start}`
                : `Date: Until ${filters.dateRange.end}`
          }
        ]
      : [])
  ];

  if (loading)
    return (
      <div className="min-h-screen w-full flex items-center justify-center font-black text-slate-400">
        Loading Reports...
      </div>
    );

  return (
    <>
      <style>
        {`
.print-report-only {
  display: none;
}

@media print {
  body {
    background: white !important;
  }

  body * {
    visibility: hidden;
  }

  #print-report,
  #print-report * {
    visibility: visible;
  }

  #print-report {
    display: block !important;
    position: absolute;
    top: 0;
    left: 0;
    width: 100% !important;
    padding: 0 !important;
    background: white !important;
  }

  .no-print {
    display: none !important;
  }

  table {
    page-break-inside: auto;
  }

  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  @page {
    size: A4 portrait;
    margin: 15mm;
  }

  /* ---- formal summary report styling ---- */
  .summary-report {
    font-family: Georgia, "Times New Roman", serif;
    color: #1a1a1a;
    line-height: 1.5;
  }

  .sr-letterhead {
    display: flex;
    align-items: center;
    gap: 16px;
    justify-content: center;
    margin-bottom: 14px;
  }

  .sr-logo {
    width: 56px;
    height: 56px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .sr-letterhead-text {
    text-align: left;
  }

  .sr-school-name {
    font-size: 18px;
    font-weight: 700;
    color: #4a5c7a;
    margin: 0;
    letter-spacing: 0.3px;
  }

  .sr-school-address {
    font-size: 12px;
    font-weight: 700;
    color: #5d89ad;
    margin: 2px 0 0 0;
  }

  .sr-title {
    font-size: 16px;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 16px 0;
    padding-bottom: 12px;
    border-bottom: 2px solid #1a1a1a;
  }

  .sr-meta {
    width: 100%;
    margin-bottom: 20px;
    font-size: 12px;
  }

  .sr-meta td {
    padding: 2px 0;
    vertical-align: top;
  }

  .sr-meta td:first-child {
    font-weight: 700;
    width: 160px;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
    color: #444;
  }

  .sr-heading {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 20px 0 8px 0;
    border-bottom: 1px solid #999;
    padding-bottom: 4px;
  }

  .sr-body {
    font-size: 12.5px;
    text-align: justify;
    margin: 0 0 10px 0;
  }

  .sr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-bottom: 10px;
  }

  .sr-table th,
  .sr-table td {
    border: 1px solid #ccc;
    padding: 5px 8px;
    text-align: left;
  }

  .sr-table th {
    background: #f2f2f2;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
  }

  .sr-footer {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid #999;
    font-size: 10.5px;
    font-style: italic;
    color: #555;
  }
}
`}
      </style>

      {/* FULL-SCREEN CONTAINER */}
      <div className="w-full min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
        {/* ON-SCREEN DASHBOARD (hidden on print, replaced by the formal summary below) */}
        <div className="space-y-6 w-full">
          {/* HEADER */}
          <div className="bg-gradient-to-br from-[#2D366D] to-[#1E254E] rounded-2xl p-8 text-white w-full">
            <h1 className="text-3xl font-black uppercase italic tracking-wide">
              Lost &amp; Found Statistics
            </h1>

            <p className="mt-3 text-white/70 text-sm">
              Generated from live campus item records. Current recovery efficiency:
              <b className="ml-2 text-white">{recoveryRate}%</b>
              <br />
              <span className="text-xs text-white/50">
                Generated: {new Date().toLocaleDateString()}{" "}
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>

            {activeChips.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {activeChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="bg-white/15 text-white text-[10px] font-black uppercase tracking-wide px-3 py-1 rounded-full"
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* FILTERS + PRINT */}
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            options={filterOptions}
            activeCount={activeFilterCount}
            onReset={resetFilters}
            onPrint={() => window.print()}
          />

          {/* STAT CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 print-section w-full">
            <StatCard
              label="Recovery Rate"
              count={`${recoveryRate}%`}
              icon={FaAward}
              color="text-indigo-600"
              bgColor="bg-indigo-50"
              description={`${claimed.length} recovered cases`}
            />

            <StatCard
              label="Lost Items"
              count={lostItems.length}
              icon={FaExclamationTriangle}
              color="text-rose-600"
              bgColor="bg-rose-50"
              description="Reported missing items"
            />

            <StatCard
              label="Found Items"
              count={surrendered.length}
              icon={FaCheckCircle}
              color="text-emerald-600"
              bgColor="bg-emerald-50"
              description="Surrendered items"
            />

            <StatCard
              label="Top Hotspot"
              count={topHotspot}
              icon={FaMapMarkerAlt}
              color="text-amber-600"
              bgColor="bg-amber-50"
              description="Highest reported area"
            />
          </div>

          {/* RESPONSIVE FULL-WIDTH CHARTS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* RECOVERY GRAPH */}
            <Section title="Recovery Performance">
              {totalItems === 0 ? (
                <EmptyState />
              ) : (
                <div className="flex justify-center items-center h-full py-4">
                  <Donut value={recoveryRate} label="RECOVERED" />
                </div>
              )}
            </Section>

            {/* ITEM ACTIVITY COMPARISON */}
            <Section title="Item Activity Overview">
              <BarChart data={comparisonData} />
            </Section>

            {/* STATUS BREAKDOWN */}
            <Section title="Current Status Distribution">
              <BarChart data={statusStats} />
            </Section>

            {/* CATEGORY REPORT */}
            <Section title="Item Categories">
              {catStats.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-5">
                  {catStats.map((cat, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-xs font-bold mb-2 text-slate-600">
                        <span>{cat.cat}</span>
                        <span>{cat.count}</span>
                      </div>

                      <HBar value={cat.count} max={totalItems} />
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* LOCATION TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden print-section w-full">
            <div className="p-7 pb-0">
              <h2 className="font-black uppercase text-sm tracking-widest text-slate-700">
                Location Hotspots
              </h2>
            </div>

            {areaStats.length === 0 ? (
              <div className="p-7">
                <EmptyState />
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm mt-5 mb-2">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="p-4 text-left">Location</th>
                      <th className="p-4 text-center">Lost</th>
                      <th className="p-4 text-center">Recovered</th>
                      <th className="p-4 text-center">Rate</th>
                      <th className="p-4 text-center">Risk</th>
                    </tr>
                  </thead>

                  <tbody>
                    {areaStats.map((area, index) => {
                      // Rate = recovered out of ALL items logged at this
                      // location (area.total), not just Lost-type reports
                      // (area.lost) — recovered items aren't restricted to
                      // Lost type, so dividing by area.lost could exceed 100%.
                      const rate = pct(area.recovered, area.total);
                      const risk = riskLevel(area.lost);

                      return (
                        <tr key={index} className="border-t border-slate-100 hover:bg-slate-50/60">
                          <td className="p-4 font-black text-slate-700">{area.area}</td>

                          <td className="p-4 text-center">{area.lost}</td>

                          <td className="p-4 text-center text-emerald-600 font-bold">
                            {area.recovered}
                          </td>

                          <td className={`p-4 text-center font-black ${pctColor(rate)}`}>
                            {rate}%
                          </td>

                          <td className="p-4 text-center">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-black ${riskColor(
                                risk
                              )}`}
                            >
                              {risk}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* PRINT-ONLY FORMAL SUMMARY REPORT */}
        <div id="print-report" className="print-report-only">
          <SummaryReport
            totalItems={totalItems}
            lostItems={lostItems}
            surrendered={surrendered}
            claimed={claimed}
            recoveryRate={recoveryRate}
            areaStats={areaStats}
            catStats={catStats}
            statusStats={statusStats}
            topHotspot={topHotspot}
            activeChips={activeChips}
            filters={filters}
          />
        </div>
      </div>
    </>
  );
}
