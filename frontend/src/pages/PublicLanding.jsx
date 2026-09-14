import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getItems, API_URL } from '../api/api';
import { useApp } from '../context/AppContext';
import Header from "../components/Header";
import Leaderboard from "./Leaderboards";
import UserProfile from "../components/UserProfile"; // adjust path if UserProfile lives elsewhere
import {
  FaFileAlt,
  FaSearch,
  FaTrophy,
  FaArrowLeft,
  FaEye,
  FaHandHolding,
  FaExclamationCircle,
  FaBoxOpen,
  FaChevronLeft,
  FaChevronRight,
  FaPlusCircle,
  FaQuestionCircle,
  FaFilter,
  FaUserCircle
} from 'react-icons/fa';


// Components
import ReportLostModal from '../components/ReportLostModal';
import ItemDetailModal from '../components/ItemDetailModal';
import ClaimModal from '../components/ClaimModal';
import TrackItemModal from '../components/TrackItemModal';

// Local-storage key for items the current user has already scheduled a
// claim for. Keyed per user id so switching accounts on the same device
// never leaks one user's claimed items into another's.
const claimedStorageKey = (userId) => `claimedItems_${userId}`;

// ==========================================================
// ITEM ID RESOLUTION
//
// Different parts of the backend/serializers refer to an item's
// identifier as `id`, `_id` (Mongo-style), or occasionally `claim_id`.
// ClaimRequests.jsx already has to account for this
// (`c.id || c._id || c.claim_id`) — this does the same thing here so
// every place in this file that keys off "the item's id" (React list
// keys, the claimedItems map, hasUserClaimed) agrees on the same value.
//
// Without this, if items only carry `_id`, every `item.id` reference
// resolves to `undefined` — every row's React `key` collides, and
// React can attach a stale/mismatched click handler to whichever
// button you actually click (especially with fetchItems() polling
// every 5s), making the Claim button appear to do nothing.
// ==========================================================
const getItemId = (item) => item?.id ?? item?._id ?? item?.claim_id ?? null;

// Works out the Date/time the claimant's scheduled slot ends, e.g. for
// meetingDate "2026-09-05" and meetingTime "9:00 AM - 10:00 AM" this
// returns a Date for 2026-09-05 10:00 AM local time. Returns null if
// either input is missing or unparseable, in which case the caller
// should treat the claim as never expiring (safer than guessing).
const parseSlotEnd = (meetingDate, meetingTimeSlot) => {
  if (!meetingDate || !meetingTimeSlot) return null;

  const endLabel = meetingTimeSlot.split('-')[1]?.trim();
  if (!endLabel) return null;

  const match = endLabel.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const [y, m, d] = meetingDate.split('-').map(Number);
  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d, hours, minutes, 0, 0);
};

const PublicBoard = ({ onOpenLogin }) => {
  const { isLoggedIn, user } = useApp();
  const [reportedItems, setReportedItems] = useState([]);
  const [filter, setFilter] = useState('Lost');
  const [categoryFilter, setCategoryFilter] = useState('All');
  // The category filter dropdown stays hidden until the visitor
  // actively picks a tab (clicks "Lost" or "Surrendered"), rather than
  // appearing automatically just because "Lost" happens to be the
  // default selection on first load.
  const [hasPickedFilter, setHasPickedFilter] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [claimItem, setClaimItem] = useState(null);
  const [claimBlockedNotice, setClaimBlockedNotice] = useState(null); // { title, meetingDate, meetingTime }
  const [showReport, setShowReport] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  // "items" | "leaderboard" | "profile"
  const [activeView, setActiveView] = useState("items");
  const [showTrackModal, setShowTrackModal] = useState(false);

  // Item ids the current user has already scheduled a claim for, mapped
  // to when that scheduled slot ends: { [itemId]: { meetingDate,
  // meetingTime, expiresAt } }. This is used as an OPTIMISTIC fallback —
  // set the instant ClaimModal reports a successful submission (see
  // onSuccess below) and persisted to localStorage, so the button locks
  // immediately and survives a refresh even before the backend's own
  // claims data has caught up. Once the backend returns this claim (see
  // hasUserClaimed below), that data takes over as the source of truth,
  // since it's the only thing that can reflect a meeting staff later
  // schedules for a pending-review claim.
  const [claimedItems, setClaimedItems] = useState({});

  const boardRef = useRef(null);

  function scrollToBoardTop() {
    setTimeout(() => {
      boardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  useEffect(() => {
    fetchItems();

    const interval = setInterval(() => {
      fetchItems();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Load this user's previously-claimed items whenever the logged-in
  // user changes (login, logout, account switch). Entries whose slot has
  // already ended are dropped on load — no reason to keep them around.
  useEffect(() => {
    if (!user?.id) {
      setClaimedItems({});
      return;
    }

    try {
      const raw = localStorage.getItem(claimedStorageKey(user.id));
      const parsed = raw ? JSON.parse(raw) : {};

      // Defensive: older versions of this feature stored claimed items
      // as a plain array of ids instead of an { id: {...} } map. If we
      // find that shape (or anything else that isn't a plain object),
      // discard it rather than let malformed data reach hasUserClaimed.
      const isValidMap =
        parsed && typeof parsed === "object" && !Array.isArray(parsed);
      const safeParsed = isValidMap ? parsed : {};

      const now = Date.now();
      const stillActive = Object.fromEntries(
        Object.entries(safeParsed).filter(
          ([, entry]) =>
            entry &&
            typeof entry === "object" &&
            (!entry.expiresAt || entry.expiresAt > now)
        )
      );

      setClaimedItems(stillActive);

      // Persist the pruned/cleaned version so bad or expired entries
      // don't keep reappearing on future loads.
      if (
        Object.keys(stillActive).length !==
        Object.keys(safeParsed).length
      ) {
        localStorage.setItem(claimedStorageKey(user.id), JSON.stringify(stillActive));
      }
    } catch (err) {
      console.error("Failed to load claimed items:", err);
      setClaimedItems({});
    }
  }, [user?.id]);

  // Records that the current user has scheduled a claim for this item,
  // both in state (so the UI updates immediately) and in localStorage (so
  // it survives a reload). Called from ClaimModal's onSuccess the moment
  // a claim request is submitted successfully. meetingDate/meetingTime
  // let us work out exactly when this claim's slot ends, so the button
  // can unlock itself for a reschedule once that time has passed.
  //
  // NOTE: this is only ever written ONCE, at submission time. For a
  // pending-review claim (mismatched/unverified answers), meetingDate/
  // meetingTime are null here — this snapshot has no way of knowing
  // staff later schedules a real meeting for it from ClaimRequests.jsx.
  // That's why hasUserClaimed below treats the BACKEND's claims data as
  // the source of truth whenever it's available, and only falls back to
  // this local snapshot until that backend data arrives.
  const markItemClaimed = (itemId, meetingDate, meetingTime) => {
    if (!user?.id || !itemId) return;

    const expiresAt = parseSlotEnd(meetingDate, meetingTime)?.getTime() ?? null;

    setClaimedItems((prev) => {
      const updated = {
        ...prev,
        [itemId]: { meetingDate, meetingTime, expiresAt },
      };

      try {
        localStorage.setItem(claimedStorageKey(user.id), JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to persist claimed item:", err);
      }

      return updated;
    });
  };

  async function fetchItems() {
    try {
      const response = await getItems();
      if (Array.isArray(response)) {
        setReportedItems(response);
      } else if (response && Array.isArray(response.data)) {
        setReportedItems(response.data);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  }

  // Gate any interactive action behind login: if the visitor isn't
  // authenticated yet, clicking an action button opens the login/register
  // modal instead of performing the action.
  const requireAuth = (fn) => (...args) => {
    if (!isLoggedIn) {
      if (onOpenLogin) onOpenLogin();
      return;
    }
    return fn(...args);
  };

  // ==========================================================
  // Check if the current user currently has an active claim on this
  // item — "active" meaning either a still-pending review, or a
  // scheduled slot that hasn't ended yet.
  //
  // PRIORITY ORDER (this is the actual fix):
  //   1. Backend claim data (item.claims / item.claim_requests) — this
  //      is the source of truth, since it's the only place that reflects
  //      a meeting staff schedules LATER for a claim that started out
  //      pending review. Once staff sets meeting_date/meeting_time from
  //      ClaimRequests.jsx and that slot passes, this correctly unlocks
  //      the button again.
  //   2. The local optimistic snapshot (claimedItems / markItemClaimed)
  //      — used ONLY as a fallback for the brief window right after the
  //      claimant submits, before the item's backend data has actually
  //      caught up (fetchItems() polls every 5s).
  //
  // Previously the local snapshot was checked FIRST, and for a
  // pending-review claim it stores expiresAt: null forever (no meeting
  // was scheduled at submission time) — so this returned `true`
  // permanently and the Claim button never unlocked, even long after
  // staff scheduled and that meeting time had passed.
  // ==========================================================
  const hasUserClaimed = (item) => {
    if (!user) return false;

    const itemId = getItemId(item);

    const claimsList = item.claims || item.claim_requests;
    const match = claimsList?.find(
      (claim) => claim && (claim.user_id === user.id || claim.userId === user.id)
    );

    if (match) {
      // Still pending review — staff hasn't scheduled a meeting for it
      // yet, so there's no expiry to check yet; treat as still claimed.
      if (!match.meeting_date || !match.meeting_time) return true;

      const remoteExpiresAt = parseSlotEnd(match.meeting_date, match.meeting_time)?.getTime();
      return !remoteExpiresAt || remoteExpiresAt > Date.now();
    }

    // Backend hasn't returned this claim yet (e.g. it was just
    // submitted a moment ago and the next poll hasn't landed) — fall
    // back to the local optimistic record so the button locks
    // immediately on submit instead of flickering unlocked.
    const localClaim = itemId !== null ? claimedItems[itemId] : undefined;
    if (localClaim) {
      return !localClaim.expiresAt || localClaim.expiresAt > Date.now();
    }

    return false;
  };

  const filteredItems = reportedItems.filter((item) => {
    return item.type?.toLowerCase() === filter.toLowerCase();
  });

  function toTitleCase(text) {
    if (!text) return "";

    return text
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Items of the currently selected type (Lost/Surrendered) that are
  // actually visible on the public board (status Approved). Category
  // filter options are derived from this set — before the category
  // filter itself is applied — so the dropdown only ever offers
  // categories that have at least one visible item under the current
  // Lost/Surrendered tab, and never shows a category from the "other"
  // type that wouldn't match anything here anyway.
  const typeApprovedItems = filteredItems.filter((item) => item.status === 'Approved');

  const categoryOptions = Array.from(
    new Set(
      typeApprovedItems
        .map((item) => item.category)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const approvedItems = typeApprovedItems
    .filter((item) => categoryFilter === 'All' || item.category === categoryFilter)
    .sort((a, b) => (b.id || 0) - (a.id || 0));

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(approvedItems.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const paginatedItems = approvedItems.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // Switching between Lost/Surrendered (or leaving the items view) resets
  // the category filter back to "All" — the two tabs' category lists
  // rarely overlap, so keeping a category selected across the switch
  // would silently filter out everything.
  useEffect(() => {
    setCategoryFilter('All');
  }, [filter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, activeView, categoryFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FE]">
      <Header
        showLogin={true}
        onOpenLogin={onOpenLogin}
      />

      {/* Main Container */}
      <main className="flex-1 px-4 sm:px-8 mt-12 pb-16">
        <div
          ref={boardRef}
          className="scroll-mt-48 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[520px]"
        >
          {/* Top Controls */}
          <div className="bg-white p-4 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center shrink-0 z-20">
            <div className="min-w-0 flex-1 flex items-center gap-3">
              {/* PROFILE ICON BUTTON — icon-only, left of the title, always
                  visible regardless of which view is active. */}
              <button
                onClick={requireAuth(() => setActiveView("profile"))}
                title={!isLoggedIn ? "Log in or register to view your profile" : "My Profile"}
                aria-label="My Profile"
                className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-full border transition-all shadow-sm ${
                  activeView === "profile"
                    ? "bg-[#2D366D] border-[#2D366D] text-white"
                    : "bg-white border-slate-300 text-slate-700 hover:shadow-md"
                } ${!isLoggedIn ? "opacity-60" : ""}`}
              >
                <FaUserCircle size={20} />
              </button>

              <div className="min-w-0">
                <h3 className="text-sm font-black tracking-widest text-slate-800 font-sans">
                  {activeView === "leaderboard"
                    ? "Leaderboards"
                    : activeView === "profile"
                      ? "My Profile"
                      : filter === "Lost"
                        ? "Lost Items"
                        : "Surrendered Items"}
                </h3>

                <p className="text-xs text-slate-500 font-sans italic mt-1 max-w-xl">
                  {activeView === "leaderboard"
                    ? "View the top honest finders based on claimed and surrendered items."
                    : activeView === "profile"
                      ? "View and update your account details."
                      : filter === "Lost"
                        ? "Browse reported items missing within the campus."
                        : "View items found and registered in the system."}
                </p>
              </div>
            </div>

            {activeView === "items" ? (
              <div className="w-full lg:w-auto lg:ml-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 sm:flex-wrap">
                {/* ACTION BUTTONS WRAPPER */}
                <div className="w-full sm:w-auto grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-4">
                  {/* REPORT BUTTON */}
                  <button
                    onClick={requireAuth(() => setShowReport(true))}
                    title={!isLoggedIn ? "Log in or register to report an item" : undefined}
                    className={`w-full col-span-2 sm:w-auto sm:col-span-1 bg-[#2D366D] text-white px-4 sm:px-6 py-3 sm:py-2.5 rounded-2xl sm:rounded-full font-black tracking-wide sm:tracking-widest text-xs hover:shadow-lg transition-all shadow-md font-sans whitespace-nowrap flex items-center justify-center gap-2 ${!isLoggedIn ? "opacity-60" : ""}`}
                  >
                    <FaPlusCircle size={14} className="text-white" />
                    Report a Lost Item
                  </button>

                  <button
                    onClick={() => window.location.href = "/help"}
                    className="w-full sm:w-auto bg-white border border-slate-300 text-slate-700 px-4 sm:px-6 py-3 sm:py-2.5 rounded-2xl sm:rounded-full font-black tracking-wide sm:tracking-widest text-xs hover:shadow-lg transition-all shadow-md font-sans whitespace-nowrap flex items-center justify-center gap-2"
                    >
                    <FaQuestionCircle size={14} />
                       Help Center
                    </button>

                  {/* TRACK BUTTON */}
                  <button
                    onClick={requireAuth(() => setShowTrackModal(true))}
                    title={!isLoggedIn ? "Log in or register to track an item" : undefined}
                    className={`w-full sm:w-auto bg-white border border-slate-300 text-slate-700 px-4 sm:px-6 py-3 sm:py-2.5 rounded-2xl sm:rounded-full font-black tracking-wide sm:tracking-widest text-xs hover:shadow-lg transition-all shadow-md font-sans whitespace-nowrap flex items-center justify-center gap-2 ${!isLoggedIn ? "opacity-60" : ""}`}
                  >
                    <FaSearch size={14} className="text-slate-700" />
                    Track Item
                  </button>

                  {/* LEADERBOARD BUTTON */}
                  <button
                    onClick={requireAuth(() => setActiveView("leaderboard"))}
                    title={!isLoggedIn ? "Log in or register to view leaderboards" : undefined}
                    className={`w-full sm:w-auto bg-white border border-slate-300 text-slate-700 px-4 sm:px-6 py-3 sm:py-2.5 rounded-2xl sm:rounded-full font-black tracking-wide sm:tracking-widest text-xs hover:shadow-lg transition-all shadow-md font-sans whitespace-nowrap flex items-center justify-center gap-2 ${!isLoggedIn ? "opacity-60" : ""}`}
                  >
                    <FaTrophy size={14} className="text-slate-700" />
                    Leaderboards
                  </button>
                </div>

                {/* LOST / SURRENDERED TOGGLE */}
                <div className="w-full sm:w-auto flex bg-slate-100 p-1 rounded-2xl sm:rounded-full shadow-inner sm:shadow-none">
                  {["Lost", "Surrendered"].map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setFilter(f);
                        setHasPickedFilter(true);
                      }}
                      className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-2 rounded-xl sm:rounded-full text-xs font-black uppercase tracking-widest font-sans transition-all min-w-0 sm:min-w-[100px] flex items-center justify-center gap-2 ${
                        filter === f
                          ? "bg-white text-[#2D366D] shadow-sm"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {f === "Lost" ? (
                        <FaExclamationCircle size={12} />
                      ) : (
                        <FaBoxOpen size={12} />
                      )}
                      <span>{f}</span>
                    </button>
                  ))}
                </div>

                {/* CATEGORY FILTER — only appears once the visitor has
                    actively clicked "Lost" or "Surrendered" above.
                    Options are derived from whichever tab is currently
                    active, so this always offers only categories that
                    actually appear there. */}
                {hasPickedFilter && (
                  <div className="w-full sm:w-auto relative">
                    <FaFilter
                      size={11}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full sm:w-auto appearance-none bg-white border border-slate-300 text-slate-700 pl-8 pr-8 py-2.5 rounded-2xl sm:rounded-full font-black tracking-wide sm:tracking-widest text-xs hover:shadow-lg transition-all shadow-md font-sans focus:outline-none focus:ring-2 focus:ring-[#0B6C9C]/30"
                    >
                      <option value="All">All Categories</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {toTitleCase(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setActiveView("items")}
                className="bg-[#2D366D] text-white px-6 py-2.5 rounded-full font-black tracking-widest text-xs hover:shadow-lg transition-all shadow-md font-sans flex items-center gap-2"
              >
                <FaArrowLeft size={14} />
                Back
              </button>
            )}
          </div>

          {/* Desktop Table */}
          {activeView === "items" ? (
            <>
              <div className="hidden md:block overflow-y-auto scrollbar-hide flex-grow bg-white relative">
                <table className="w-full text-xs min-w-[900px] table-fixed border-collapse font-sans">
                  <thead className="sticky top-0 z-0">
                    <tr className="bg-[#0B6C9C] text-white">
                      <th className="border border-gray-300 px-4 py-3 font-semibold text-center text-sm">
                        Item Name
                      </th>
                      <th className="border border-gray-300 px-4 py-3 font-semibold text-center text-sm">
                        Category
                      </th>
                      <th className="border border-gray-300 px-4 py-3 font-semibold text-center text-sm">
                        Location
                      </th>
                      <th className="border border-gray-300 px-4 py-3 font-semibold text-center text-sm">
                        Date Logged
                      </th>
                      <th className="border border-gray-300 px-4 py-3 font-semibold text-center text-sm w-[180px]">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="w-full text-xs uppercase min-w-[900px]">
                    {paginatedItems.length > 0 ? (
                      paginatedItems.map((item, index) => {
                        const itemId = getItemId(item);
                        const claimed = hasUserClaimed(item);

                        return (
                          <tr
                            key={itemId ?? `row-${index}`}
                            className={`${
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            } hover:bg-blue-50 transition`}
                          >
                            <td className="border border-gray-300 px-4 py-3 text-center font-semibold">
                              {toTitleCase(item.title || item.name)}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center">
                              {toTitleCase(item.category)}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center">
                              {toTitleCase(item.location)}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center">
                              <div>{item.created_date}</div>
                              <div>{item.created_time}</div>
                            </td>
                            <td className="border border-gray-300 px-4 py-3 w-[180px]">
                              <div className="flex justify-center items-center gap-2">
                                {/* VIEW ICON BUTTON */}
                                <button
                                  onClick={requireAuth(() => setDetailItem(item))}
                                  title="View Details"
                                  className="bg-[#0B6C9C] text-white px-3 py-1.5 rounded hover:bg-[#09597F] transition flex items-center justify-center gap-1.5 text-xs font-semibold"
                                >
                                  <FaEye size={13} />
                                  View
                                </button>

                                {/* CLAIM ICON BUTTON */}
                                {filter === "Surrendered" && (
                                  <button
                                    onClick={requireAuth(() => setClaimItem(item))}
                                    disabled={claimed}
                                    title={claimed ? "You have already requested to claim this item" : "Claim Item"}
                                    className={`px-3 py-1.5 rounded transition flex items-center justify-center gap-1.5 text-xs font-semibold ${
                                      claimed
                                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                        : "bg-[#2D366D] text-white hover:opacity-90"
                                    }`}
                                  >
                                    <FaHandHolding size={13} />
                                    {claimed ? "Claimed" : "Claim"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="bg-white text-center py-40">
                          <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
                            <span className="text-5xl opacity-10 font-black tracking-tighter">
                              EMPTY
                            </span>
                            <p className="text-xs font-sans tracking-[0.2em] uppercase font-bold text-slate-400">
                              No active records found
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden flex-grow overflow-y-auto bg-slate-50 p-3 space-y-3">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((item, index) => {
                    const itemId = getItemId(item);
                    const claimed = hasUserClaimed(item);

                    return (
                      <div
                        key={itemId ?? `card-${index}`}
                        className="bg-white border border-slate-200 rounded-lg shadow-sm p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-slate-800 leading-snug">
                              {toTitleCase(item.title || item.category)}
                            </h3>
                            <p className="text-xs font-semibold uppercase text-slate-400 mt-1">
                              {toTitleCase(item.category)}
                            </p>
                          </div>

                          <span className="text-xs font-bold uppercase text-[#0B6C9C] bg-blue-50 px-2 py-1 rounded">
                            {item.type}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2 text-xs text-slate-600">
                          <div className="flex justify-between gap-3">
                            <span className="font-semibold text-slate-400">Location</span>
                            <span className="text-right">
                              {toTitleCase(item.location)}
                            </span>
                          </div>

                          <div className="flex justify-between gap-3">
                            <span className="font-semibold text-slate-400">Date</span>
                            <span className="text-right">
                              {item.created_date} {item.created_time}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={requireAuth(() => setDetailItem(item))}
                            className="flex-1 bg-[#0B6C9C] text-white py-2 rounded font-semibold text-xs flex items-center justify-center gap-2"
                          >
                            <FaEye size={14} />
                            View
                          </button>

                          {filter === "Surrendered" && (
                            <button
                              onClick={requireAuth(() => setClaimItem(item))}
                              disabled={claimed}
                              title={claimed ? "You have already requested to claim this item" : undefined}
                              className={`flex-1 py-2 rounded font-semibold text-xs flex items-center justify-center gap-2 ${
                                claimed
                                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                  : "bg-[#2D366D] text-white"
                              }`}
                            >
                              <FaHandHolding size={14} />
                              {claimed ? "Claimed" : "Claim"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-white min-h-[320px] flex flex-col items-center justify-center text-slate-300 rounded-lg border border-slate-200">
                    <span className="text-4xl opacity-10 font-black tracking-tighter">
                      EMPTY
                    </span>

                    <p className="text-xs font-sans tracking-[0.2em] uppercase font-bold text-slate-400 mt-2">
                      No active records found
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination Section */}
              {approvedItems.length > 0 && (
                <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs text-slate-500 font-semibold">
                    Showing {startIndex + 1}-
                    {Math.min(startIndex + ITEMS_PER_PAGE, approvedItems.length)} of{" "}
                    {approvedItems.length} items
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCurrentPage((page) => Math.max(page - 1, 1));
                        scrollToBoardTop();
                      }}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <FaChevronLeft size={11} />
                      Previous
                    </button>

                    <span className="px-4 py-2 rounded-lg bg-[#0B6C9C] text-white text-xs font-bold">
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      onClick={() => {
                        setCurrentPage((page) => Math.min(page + 1, totalPages));
                        scrollToBoardTop();
                      }}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      Next
                      <FaChevronRight size={11} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : activeView === "leaderboard" ? (
            <div className="flex-grow relative">
              <Leaderboard />
            </div>
          ) : (
            <div className="flex-grow relative overflow-y-auto">
              <UserProfile userRole={user?.role} />
            </div>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 w-full bg-slate-50 border-t border-slate-200 py-2 z-50">
        <p className="text-right text-[12px] text-slate-400 font-sans tracking-[0.2em] pr-4 sm:pr-8">
          © 2021 Saint Louis College, City of San Fernando, La Union. All rights reserved
        </p>
      </footer>

      {/* Modals Section */}
      {showReport && (
        <ReportLostModal
          onClose={() => setShowReport(false)}
          onSuccess={() => {
            fetchItems();
            setShowReport(false);
          }}
        />
      )}

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClaim={(item) => {
            setDetailItem(null);
            setClaimItem(item);
          }}
          onClose={() => setDetailItem(null)}
        />
      )}

      {claimItem && (
        <ClaimModal
          item={claimItem}
          onClose={() => setClaimItem(null)}
          onSuccess={(itemId, meetingDate, meetingTime) => {
            // Fires the moment ClaimModal's submission succeeds — lock
            // the Claim button for this item right away, don't wait for
            // the modal to close or the next poll to refetch. The modal
            // itself stays open (showing its confirmation screen) until
            // the claimant dismisses it via onClose. The button unlocks
            // itself again automatically once meetingDate/meetingTime's
            // slot has ended, so a missed meeting can be rescheduled.
            markItemClaimed(itemId ?? getItemId(claimItem), meetingDate, meetingTime);
            fetchItems();
          }}
        />
      )}

      {showTrackModal && (
        <TrackItemModal onClose={() => setShowTrackModal(false)} />
      )}
    </div>
  );
};

export default PublicBoard;
