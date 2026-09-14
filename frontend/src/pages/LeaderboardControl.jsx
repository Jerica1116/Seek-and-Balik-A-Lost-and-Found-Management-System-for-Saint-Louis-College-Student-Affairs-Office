import React, { useEffect, useState, useRef } from "react";
import { Filter, X, Printer, ChevronDown, Check, Settings } from "lucide-react";
import { getLeaderboardSettings, updateLeaderboardSettings, getPointsTracking } from "../api/api";

// Default semester configuration (Months are 0-indexed)
const DEFAULT_SEMESTER_CONFIG = {
  firstSem: { startMonth: 7, endMonth: 11 }, // Aug - Dec
  secondSem: { startMonth: 0, endMonth: 4 }, // Jan - May
  shortTerm: { startMonth: 5, endMonth: 6 }, // Jun - Jul
};

const getSchoolYearAndSemFromDate = (dateString, semConfig = DEFAULT_SEMESTER_CONFIG) => {
  const referenceDate = dateString ? new Date(dateString) : new Date();
  const finalDate = isNaN(referenceDate.getTime()) ? new Date() : referenceDate;

  const year = finalDate.getFullYear();
  const month = finalDate.getMonth(); // 0 = Jan, 11 = Dec

  let sem = "";
  let schoolYear = "";

  const { firstSem, secondSem, shortTerm } = semConfig;

  // Function to check if a month is in range (handles year wrap-around if needed)
  const isMonthInRange = (m, start, end) => {
    if (start <= end) return m >= start && m <= end;
    return m >= start || m <= end; // Crosses calendar year border
  };

  if (isMonthInRange(month, Number(firstSem.startMonth), Number(firstSem.endMonth))) {
    sem = "1st Semester";
    schoolYear = `${year}-${year + 1}`;
  } else if (isMonthInRange(month, Number(secondSem.startMonth), Number(secondSem.endMonth))) {
    sem = "2nd Semester";
    schoolYear = `${year - 1}-${year}`;
  } else if (isMonthInRange(month, Number(shortTerm.startMonth), Number(shortTerm.endMonth))) {
    sem = "Short Term";
    schoolYear = `${year}`;
  } else {
    sem = "Custom Term";
    schoolYear = `${year}`;
  }

  return { schoolYear, sem };
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester", "Short Term"];

const buildYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
};

const YEAR_OPTIONS = buildYearOptions();

const EMPTY_FILTERS = { year: [], month: [], semester: "" };

// ─── Multi-Select Dropdown Component ─────────────────────────────────────────
const MultiSelectFilter = ({ label, selectedValues, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option) => {
    if (selectedValues.includes(option)) {
      onChange(selectedValues.filter((v) => v !== option));
    } else {
      onChange([...selectedValues, option]);
    }
  };

  const displayText =
    selectedValues.length === 0
      ? "All"
      : selectedValues.length === 1
      ? selectedValues[0]
      : `${selectedValues.length} Selected`;

  return (
    <div className="flex flex-col gap-1 text-xs font-bold text-slate-500 min-w-[170px]" ref={containerRef}>
      <span>{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B6B8A]/30 focus:border-[#0B6B8A]"
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown size={12} className="text-slate-400 ml-2 shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-56 overflow-y-auto p-1.5 space-y-1">
            {options.map((option) => {
              const isSelected = selectedValues.includes(option);
              return (
                <div
                  key={option}
                  onClick={() => toggleOption(option)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs font-semibold transition ${
                    isSelected ? "bg-[#0B6B8A]/10 text-[#0B6B8A]" : "hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <span>{option}</span>
                  {isSelected && <Check size={13} className="text-[#0B6B8A]" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Single Select Dropdown Component ───────────────────────────────────────
const FilterSelect = ({ label, value, onChange, options }) => (
  <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 min-w-[170px]">
    {label}
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-3 py-2 pr-9 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B6B8A]/30 focus:border-[#0B6B8A]"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  </label>
);

// ─── Leaderboard Settings Modal ─────────────────────────────────────────────
const SettingsModal = ({ settings, set, saving, onSave, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="flex items-start justify-between bg-gradient-to-r from-[#0B648D] to-[#155F87] px-6 py-3 text-white">
          <div>
            <h3 className="text-2xl font-bold">Leaderboard Settings</h3>
            <p className="mt-1 text-sm text-white/90">Manage visibility, auto scheduling, and semester boundaries</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/25"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-6 py-5">
          <div className="mx-auto max-w-xl space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">Leaderboard Status</p>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                  settings.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                }`}
              >
                {settings.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            {/* Manual & Auto Controls */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">Manual On / Off</h4>
                    <p className="text-xs text-slate-500">Turn visibility on or off immediately.</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.is_active}
                      onChange={(e) => set("is_active", e.target.checked)}
                      disabled={settings.auto_mode}
                      className="peer sr-only"
                    />
                    <div className="h-7 w-12 rounded-full bg-slate-300 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-[#0B6B8A] peer-checked:after:translate-x-5 peer-disabled:opacity-50" />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">Automatic Mode</h4>
                    <p className="text-xs text-slate-500">Activate between selected dates.</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.auto_mode}
                      onChange={(e) => set("auto_mode", e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-7 w-12 rounded-full bg-slate-300 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-[#0B6B8A] peer-checked:after:translate-x-5" />
                  </label>
                </div>
              </div>
            </div>

            {/* Dates Configuration */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase text-slate-600">Start Date</label>
                <input
                  type="date"
                  value={settings.open_date}
                  onChange={(e) => set("open_date", e.target.value)}
                  disabled={!settings.auto_mode}
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#0B6B8A] disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase text-slate-600">Turn Off Date</label>
                <input
                  type="date"
                  value={settings.close_date}
                  onChange={(e) => set("close_date", e.target.value)}
                  disabled={!settings.auto_mode}
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#0B6B8A] disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Semester Configuration Section */}
            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-black text-slate-800 text-sm mb-1">Semester Boundaries Configuration</h4>
              <p className="text-xs text-slate-500 mb-3">Define month ranges used for automated semester assignment.</p>

              <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {/* 1st Semester */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 w-28">1st Semester</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={settings.semConfig?.firstSem?.startMonth ?? 7}
                      onChange={(e) => set("semConfig", { ...settings.semConfig, firstSem: { ...settings.semConfig.firstSem, startMonth: Number(e.target.value) } })}
                      className="border border-slate-300 rounded-lg p-1 text-xs font-semibold"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-400">to</span>
                    <select
                      value={settings.semConfig?.firstSem?.endMonth ?? 11}
                      onChange={(e) => set("semConfig", { ...settings.semConfig, firstSem: { ...settings.semConfig.firstSem, endMonth: Number(e.target.value) } })}
                      className="border border-slate-300 rounded-lg p-1 text-xs font-semibold"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2nd Semester */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 w-28">2nd Semester</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={settings.semConfig?.secondSem?.startMonth ?? 0}
                      onChange={(e) => set("semConfig", { ...settings.semConfig, secondSem: { ...settings.semConfig.secondSem, startMonth: Number(e.target.value) } })}
                      className="border border-slate-300 rounded-lg p-1 text-xs font-semibold"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-400">to</span>
                    <select
                      value={settings.semConfig?.secondSem?.endMonth ?? 4}
                      onChange={(e) => set("semConfig", { ...settings.semConfig, secondSem: { ...settings.semConfig.secondSem, endMonth: Number(e.target.value) } })}
                      className="border border-slate-300 rounded-lg p-1 text-xs font-semibold"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Short Term */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 w-28">Short Term</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={settings.semConfig?.shortTerm?.startMonth ?? 5}
                      onChange={(e) => set("semConfig", { ...settings.semConfig, shortTerm: { ...settings.semConfig.shortTerm, startMonth: Number(e.target.value) } })}
                      className="border border-slate-300 rounded-lg p-1 text-xs font-semibold"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-400">to</span>
                    <select
                      value={settings.semConfig?.shortTerm?.endMonth ?? 6}
                      onChange={(e) => set("semConfig", { ...settings.semConfig, shortTerm: { ...settings.semConfig.shortTerm, endMonth: Number(e.target.value) } })}
                      className="border border-slate-300 rounded-lg p-1 text-xs font-semibold"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={`mt-2 w-full rounded-xl py-3 font-black uppercase tracking-wide text-white transition ${
                saving ? "cursor-not-allowed bg-slate-400" : "bg-[#2D366D] hover:bg-[#24305C]"
              }`}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function LeaderboardControl() {
  const [settings, setSettings] = useState({
    is_active: false,
    auto_mode: false,
    open_date: "",
    close_date: "",
    semConfig: DEFAULT_SEMESTER_CONFIG,
  });

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const activeFilterCount =
    filters.year.length + filters.month.length + (filters.semester ? 1 : 0);
  const isFiltered = activeFilterCount > 0;

  useEffect(() => {
    fetchInitialData();

    const interval = setInterval(fetchRecords, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters]);

  const fetchInitialData = async () => {
    try {
      await Promise.all([fetchSettings(), fetchRecords()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await getLeaderboardSettings();

      setSettings({
        is_active: Boolean(data.is_active),
        auto_mode: Boolean(data.auto_mode),
        open_date: data.open_date || "",
        close_date: data.close_date || "",
        semConfig: data.semConfig || DEFAULT_SEMESTER_CONFIG,
      });
    } catch (error) {
      console.error("Failed to fetch leaderboard settings:", error);
    }
  };

  const fetchRecords = async () => {
    try {
      const data = await getPointsTracking();
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch points records:", error);
      setRecords([]);
    }
  };

  const set = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (saving) return;

    if (
      settings.auto_mode &&
      settings.open_date &&
      settings.close_date &&
      settings.open_date > settings.close_date
    ) {
      window.alert("Open date cannot be later than close date.");
      return;
    }

    setSaving(true);

    try {
      await updateLeaderboardSettings({
        is_active: settings.is_active,
        auto_mode: settings.auto_mode,
        open_date: settings.open_date || null,
        close_date: settings.close_date || null,
        semConfig: settings.semConfig,
      });

      window.alert("Leaderboard settings updated.");
      await fetchSettings();
    } catch (error) {
      console.error("Failed to update leaderboard settings:", error);
      window.alert("Failed to update leaderboard settings.");
    } finally {
      setSaving(false);
    }
  };

  const reasonLabel = (reason) => {
    if (reason === "SURRENDER_ITEM") return "Surrendered item";
    if (reason === "ITEM_CLAIMED") return "Item claimed by owner";
    return reason;
  };

  const resetFilters = () => setFilters(EMPTY_FILTERS);

  if (loading) {
    return (
      <div className="bg-white rounded-[18px] border border-[#D8E2EF] shadow-[0_8px_24px_rgba(45,54,109,0.08)] overflow-hidden flex flex-col items-center justify-center gap-3 h-[calc(100vh-135px)] text-center">
        <span className="text-4xl font-black tracking-tighter text-[#071E3D] opacity-20">
          LOADING
        </span>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7B8AA6]">
          Fetching leaderboard control...
        </p>
      </div>
    );
  }

  const { schoolYear: liveSchoolYear, sem: liveSem } = getSchoolYearAndSemFromDate(
    settings.auto_mode ? settings.open_date : null,
    settings.semConfig
  );

  const reportSchoolYear = filters.year.length > 0 ? filters.year.join(", ") : liveSchoolYear;
  const reportSem = filters.semester || liveSem;

  const ITEMS_PER_PAGE = 10;

  const filteredRecords = records.filter((record) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      record.player_name?.toLowerCase().includes(searchText) ||
      reasonLabel(record.reason)?.toLowerCase().includes(searchText) ||
      String(record.item_id || "").toLowerCase().includes(searchText);

    if (!matchesSearch) return false;

    if (isFiltered) {
      const recordDate = new Date(record.created_at);
      if (isNaN(recordDate.getTime())) return false;

      const { schoolYear, sem } = getSchoolYearAndSemFromDate(record.created_at, settings.semConfig);

      if (filters.year.length > 0 && !filters.year.includes(schoolYear)) return false;
      if (filters.semester && sem !== filters.semester) return false;

      if (filters.month.length > 0) {
        const monthName = recordDate.toLocaleString("default", { month: "long" });
        if (!filters.month.includes(monthName)) return false;
      }
    }

    return true;
  });

  const totalPoints = filteredRecords.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="bg-white rounded-[18px] border border-[#D8E2EF] shadow-[0_8px_24px_rgba(45,54,109,0.08)] overflow-hidden flex flex-col h-[calc(100vh-135px)]">
      <style>
        {`
          @media print {
            body { background: white !important; }
            body * { visibility: hidden; }
            #print-report, #print-report * { visibility: visible; }
            #print-report {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              padding: 0 !important;
              background: white !important;
            }
            .no-print { display: none !important; }
            table { page-break-inside: auto; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            @page { size: A4 landscape; margin: 10mm; }
          }
        `}
      </style>

      {/* Header */}
        <div className="bg-white px-6 sm:px-8 py-4 border-b border-[#D8E2EF] shrink-0">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 rounded-full bg-[#0B6B8A]" />
              <div>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-[0.16em] text-[#071E3D]">
                  Leaderboard Control for SY {liveSchoolYear} ({liveSem})
                </h3>
                <p className="text-xs sm:text-sm text-[#7B8AA6] italic mt-0.5">
                  Manage leaderboard visibility, scheduling, and point records
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
              <div className="relative w-full sm:w-[300px]">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0B6B8A] text-sm">🔍</span>
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search point records..."
                  className="w-full pl-10 pr-4 py-2.5 border border-[#CBD8E8] rounded-full text-sm outline-none bg-white text-[#071E3D] placeholder:text-[#8A98B3] focus:ring-2 focus:ring-[#0B6B8A]/20 focus:border-[#0B6B8A] transition-all"
                />
              </div>

              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase ${
                  settings.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                }`}
              >
                {settings.is_active ? "Active" : "Inactive"}
              </span>

              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2D366D] text-white font-black uppercase tracking-[0.1em] text-xs shadow-[0_6px_14px_rgba(45,54,109,0.25)] hover:bg-[#24305C] transition-all whitespace-nowrap"
              >
                <Settings size={14} /> Settings
              </button>
            </div>
          </div>
        </div>

        {/* Filters + Report */}
        <div className="px-6 sm:px-8 py-4 border-b border-[#D8E2EF] shrink-0 no-print">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 text-slate-400 pb-2.5">
              <Filter size={14} />
            </div>

            {/* Multi-Select Year Filter */}
            <MultiSelectFilter
              label="School Year"
              selectedValues={filters.year}
              onChange={(v) => setFilters((f) => ({ ...f, year: v }))}
              options={YEAR_OPTIONS}
            />

            {/* Multi-Select Month Filter */}
            <MultiSelectFilter
              label="Month"
              selectedValues={filters.month}
              onChange={(v) => setFilters((f) => ({ ...f, month: v }))}
              options={MONTH_NAMES}
            />

            {/* Single Select Semester Filter */}
            <FilterSelect
              label="Semester"
              value={filters.semester}
              onChange={(v) => setFilters((f) => ({ ...f, semester: v }))}
              options={SEMESTER_OPTIONS}
            />

            <div className="flex items-center gap-4 ml-auto">
              {isFiltered && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs font-black text-rose-500 hover:text-rose-600 pb-2.5"
                >
                  <X size={12} />
                  Clear ({activeFilterCount})
                </button>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2D366D] text-white font-black uppercase tracking-[0.1em] text-xs shadow-[0_6px_14px_rgba(45,54,109,0.25)] hover:bg-[#24305C] transition-all whitespace-nowrap shrink-0"
              >
                <Printer size={14} />
                Generate Report
              </button>
            </div>
          </div>
        </div>

        {/* Content Table */}
        <div id="print-report" className="flex-1 overflow-auto bg-white">
          <div className="hidden print:block px-6 pt-6 pb-2">
            <h2 className="text-xl font-black text-[#071E3D]">
              Points Tracking Report — SY {reportSchoolYear} ({reportSem})
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Generated: {new Date().toLocaleDateString()}{" "}
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {filteredRecords.length} records &middot; {totalPoints} total points awarded
            </p>
          </div>

          <table className="w-full min-w-[1000px] table-fixed border-collapse print:hidden">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-[18%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Date</th>
                <th className="w-[20%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Student</th>
                <th className="w-[26%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Reason</th>
                <th className="w-[18%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Item ID</th>
                <th className="w-[18%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Points</th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((record, index) => (
                  <tr key={record.id} className={`h-[70px] transition-colors ${index % 2 === 0 ? "bg-white" : "bg-[#F6FAFF]"} hover:bg-[#EAF4FF]`}>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-600 text-[14px]">
                      {new Date(record.created_at).toLocaleString()}
                    </td>
                    <td className="truncate border border-gray-300 p-4 text-center align-middle font-bold text-[#071E3D]">
                      {record.player_name}
                    </td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-600 text-[14px]">
                      {reasonLabel(record.reason)}
                    </td>
                    <td className="border border-gray-300 p-4 text-center align-middle text-slate-600 text-[14px]">
                      {record.item_id || "-"}
                    </td>
                    <td className="border border-gray-300 p-4 text-center align-middle font-black text-[#0B6B8A]">
                      +{record.points}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="bg-white py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <span className="text-4xl font-black tracking-tighter text-[#071E3D] opacity-20">
                        EMPTY
                      </span>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7B8AA6]">
                        {isFiltered ? "No point records for this period" : "No point records yet"}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Print-only Table */}
          <table className="hidden print:table w-full table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[18%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Date</th>
                <th className="w-[20%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Student</th>
                <th className="w-[26%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Reason</th>
                <th className="w-[18%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Item ID</th>
                <th className="w-[18%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Points</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredRecords.map((record, index) => (
                <tr key={record.id} className={index % 2 === 0 ? "bg-white" : "bg-[#F6FAFF]"}>
                  <td className="border border-gray-300 p-3 text-center align-middle text-slate-600 text-[13px]">
                    {new Date(record.created_at).toLocaleString()}
                  </td>
                  <td className="border border-gray-300 p-3 text-center align-middle font-bold text-[#071E3D] text-[13px]">
                    {record.player_name}
                  </td>
                  <td className="border border-gray-300 p-3 text-center align-middle text-slate-600 text-[13px]">
                    {reasonLabel(record.reason)}
                  </td>
                  <td className="border border-gray-300 p-3 text-center align-middle text-slate-600 text-[13px]">
                    {record.item_id || "-"}
                  </td>
                  <td className="border border-gray-300 p-3 text-center align-middle font-black text-[#0B6B8A] text-[13px]">
                    +{record.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredRecords.length > 0 && (
          <div className="border-t border-[#D8E2EF] bg-white px-6 py-4 flex items-center justify-between shrink-0 no-print">
            <p className="text-xs font-bold text-[#7B8AA6]">
              Showing {startIndex + 1}-
              {Math.min(startIndex + ITEMS_PER_PAGE, filteredRecords.length)} of{" "}
              {filteredRecords.length}
              {isFiltered && (
                <span className="ml-2 text-[#0B6B8A]">({totalPoints} pts in view)</span>
              )}
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

        {/* Settings Modal */}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          set={set}
          saving={saving}
          onSave={handleSave}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default LeaderboardControl;