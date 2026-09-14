import React, { useEffect, useState, useRef } from "react";
import { getLeaderboard, getLeaderboardSettings } from "../api/api";
import { useApp } from "../context/AppContext";
import {
  FaInfoCircle,
  FaTimes,
  FaTrophy,
  FaBoxOpen,
  FaHandHolding,
} from "react-icons/fa";

const getSchoolYearAndSemFromDate = (dateString) => {
  const referenceDate = dateString ? new Date(dateString) : new Date();
  const finalDate = isNaN(referenceDate.getTime()) ? new Date() : referenceDate;

  const year = finalDate.getFullYear();
  const month = finalDate.getMonth();

  let sem = "";
  let schoolYear = "";

  if (month >= 7 && month <= 11) {
    sem = "1st Semester";
    schoolYear = `${year}-${year + 1}`;
  } else if (month >= 0 && month <= 4) {
    sem = "2nd Semester";
    schoolYear = `${year - 1}-${year}`;
  } else {
    sem = "Short Term";
    schoolYear = `${year}`;
  }

  return { schoolYear, sem };
};

// Podium accent styling per rank, kept inside the site's navy/blue palette
// so gold/silver/bronze read as accents rather than a clashing color scheme.
const PODIUM_STYLES = {
  1: {
    ring: "border-2 border-[#F5C451]",
    chip: "bg-[#F5C451] text-[#5B4300]",
    bg: "bg-gradient-to-b from-[#FFF9E9] to-white",
    minH: "min-h-[160px] sm:min-h-[240px]",
  },
  2: {
    ring: "border border-slate-300",
    chip: "bg-slate-300 text-slate-800",
    bg: "bg-slate-50",
    minH: "min-h-[125px] sm:min-h-[190px]",
  },
  3: {
    ring: "border border-[#E3B98C]",
    chip: "bg-[#E3B98C] text-[#5A3A17]",
    bg: "bg-[#FFF6EC]",
    minH: "min-h-[105px] sm:min-h-[160px]",
  },
};

function ScoringInfoPopover() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="How leaderboard scoring works"
        className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
          open
            ? "border-[#0B6FA4] bg-[#EAF6FC] text-[#0B6FA4]"
            : "border-slate-300 text-slate-400 hover:border-[#0B6FA4] hover:text-[#0B6FA4]"
        }`}
      >
        <FaInfoCircle size={14} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[88vw] max-w-sm rounded-2xl border border-[#D8E2EE] bg-white p-5 text-left shadow-xl sm:right-0 sm:w-96">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-black text-[#163B65]">
                <FaInfoCircle className="text-[#0B6FA4]" size={14} />
                Leaderboard Scoring
              </h4>
              <p className="mt-0.5 text-xs italic text-slate-400">
                How are points earned?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-300 hover:text-slate-500"
              aria-label="Close"
            >
              <FaTimes size={12} />
            </button>
          </div>

          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📦</span>
              <span>
                <span className="font-bold text-slate-800">Surrender (turn in) a found item</span> — earn 8 points per item, credited to you as the finder
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">🤝</span>
              <span>
                <span className="font-bold text-slate-800">Your surrendered item gets claimed</span> — +2 bonus points, credited to you as the finder
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">🏆</span>
              <span>Your total points determine your rank on the leaderboard.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📊</span>
              <span>The leaderboard is ranked from highest to lowest total points.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">🔄</span>
              <span>Points and rankings may update periodically as new claims and surrenders are recorded.</span>
            </li>
          </ul>

          <div className="mt-4 rounded-xl bg-[#EAF6FC] px-3 py-2.5 text-[11px] leading-relaxed text-[#0B6FA4]">
            <span className="font-black">Example:</span> You surrender an item (+8), and it's
            later claimed by its owner (+2 bonus):
            8 + 2 ={" "}
            <span className="font-black">10 points</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Leaderboard() {
  const { currentUser } = useApp() || {};
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardActive, setLeaderboardActive] = useState(true);

  const [config, setConfig] = useState({ auto_mode: false, open_date: "" });

  useEffect(() => {
    fetchInitialData();

    const interval = setInterval(fetchLeaderboard, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    try {
      // Kunin muna ang settings para alam kung anong date ang susundin
      const settingsData = await getLeaderboardSettings();
      if (settingsData) {
        setConfig({
          auto_mode: Boolean(settingsData.auto_mode),
          open_date: settingsData.open_date || "",
        });
      }
    } catch (e) {
      console.error("Failed to load configs:", e);
    }
    await fetchLeaderboard();
    setLoading(false);
  };

  const fetchLeaderboard = async () => {
    try {
      const data = await getLeaderboard();
      if (Array.isArray(data)) {
        setLeaderboardActive(true);
        setLeaders(data);
      } else {
        setLeaderboardActive(Boolean(data.active));
        setLeaders(Array.isArray(data.leaders) ? data.leaders : []);
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
      setLeaders([]);
      setLeaderboardActive(false);
    }
  };

  const safeLeaders = Array.isArray(leaders) ? leaders : [];
  const topLeaders = safeLeaders.slice(0, 3);
  const otherLeaders = safeLeaders.slice(3);

  const { schoolYear, sem } = getSchoolYearAndSemFromDate(
    config.auto_mode ? config.open_date : null
  );

  // Digits-only comparison so "12345678", "12345678@slc-sflu.edu.ph", and
  // any other formatting of the same student ID all match each other.
  const normalizeId = (value) => (value || "").toString().replace(/\D/g, "");

  // The Student ID is the unique identifier for matching the logged-in
  // account to its leaderboard row — unlike full_name, two students can
  // share a name, but never a student ID. The display itself still shows
  // full_name as before; only the "is this me?" comparison changes.
  const myStudentId = normalizeId(
    currentUser?.id_number || currentUser?.student_id || currentUser?.username
  );
  const myFullName = currentUser
    ? `${currentUser.first_name || ""} ${currentUser.last_name || ""}`
        .trim()
        .toLowerCase()
    : "";

  const isMe = (leader) => {
    const leaderId = normalizeId(leader.student_id);
    if (myStudentId && leaderId) {
      return myStudentId === leaderId;
    }
    // Fallback for rows/accounts missing a student ID on either side.
    return (
      !!myFullName &&
      !!leader.full_name &&
      leader.full_name.trim().toLowerCase() === myFullName
    );
  };

  // Podium is rendered in visual order 2nd, 1st, 3rd (1st in the middle,
  // tallest bar), but each cell still needs to know its real rank.
  const podiumOrder = [
    { leader: topLeaders[1], rank: 2 },
    { leader: topLeaders[0], rank: 1 },
    { leader: topLeaders[2], rank: 3 },
  ];

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-6 flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:justify-center sm:gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#163B65] sm:text-3xl">
            Honest Finders Leaderboard for SY {schoolYear} ({sem})
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Ranked by earned surrender and claim points
          </p>
        </div>
        <div className="mt-1 sm:mt-1.5">
          <ScoringInfoPopover />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          Loading leaderboard...
        </div>
      ) : safeLeaders.length === 0 ? (
        <div className="px-4 py-20 text-center">
          <h3 className="text-lg font-bold text-slate-600">
            Leaderboard is currently closed.
          </h3>
          <p className="mt-2 text-slate-400">
            The leaderboard for SY {schoolYear} ({sem}) is inactive. Please wait for the administrator to open the scoring window.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-5 lg:items-start">
          {/* LEFT — TOP 3 PODIUM (1st in the middle, tallest bar) */}
          <section className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#163B65]">
                <FaTrophy className="text-[#F5C451]" size={14} />
                Top {Math.min(safeLeaders.length, 3)}
              </h3>
              <span className="w-fit rounded-full bg-[#EAF6FC] px-3 py-1 text-xs font-bold text-[#0B6FA4]">
                {safeLeaders.length} ranked
              </span>
            </div>

            <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
              {podiumOrder.map(({ leader, rank }) => {
                const style = PODIUM_STYLES[rank];

                if (!leader) return <div key={rank} />;

                const mine = isMe(leader);

                return (
                  <div
                    key={leader.id}
                    className={`flex flex-col justify-between rounded-t-2xl p-2 text-center transition sm:rounded-t-3xl sm:p-4 ${style.minH} ${style.bg} ${
                      mine
                        ? "border-2 border-[#0B6FA4] ring-2 ring-[#0B6FA4]/25"
                        : style.ring
                    } ${rank === 1 ? "shadow-md" : ""}`}
                  >
                    <div className="min-w-0">
                      <div
                        className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black sm:h-12 sm:w-12 sm:text-lg ${style.chip}`}
                      >
                        {rank}
                      </div>
                      <p className="mt-2 line-clamp-2 break-words text-[10px] font-black leading-tight text-slate-900 sm:mt-3 sm:text-sm">
                        {leader.full_name}
                      </p>
                      {mine && (
                        <span className="mt-1 inline-block rounded-full bg-[#0B6FA4] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white sm:text-[9px]">
                          You
                        </span>
                      )}
                    </div>

                    <div className="mt-2 rounded-lg bg-white/90 py-1 text-[10px] font-black text-[#0B6FA4] sm:rounded-xl sm:py-2 sm:text-sm">
                      {leader.points}
                      <span className="ml-1 text-[8px] font-bold uppercase text-slate-400 sm:text-[10px]">
                        pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* RIGHT — OTHER RANKINGS, laid out as-is (no wrapping card) */}
          <section className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-center gap-2">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#163B65]">
                <FaBoxOpen className="text-[#0B6FA4]" size={13} />
                Other Rankings
              </h3>
              {otherLeaders.length > 0 && (
                <span className="w-fit rounded-full bg-[#EAF6FC] px-3 py-1 text-xs font-bold text-[#0B6FA4]">
                  Rank 4+
                </span>
              )}
            </div>

            {otherLeaders.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                No other rankings yet
              </div>
            ) : (
              <div className="space-y-2">
                {otherLeaders.map((leader, index) => {
                  const rank = index + 4;
                  const mine = isMe(leader);

                  return (
                    <div
                      key={leader.id}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 transition sm:gap-4 ${
                        mine
                          ? "border-[#0B6FA4] bg-[#EAF6FC] ring-1 ring-[#0B6FA4]/30"
                          : "border-slate-200 bg-[#F8FAFC] hover:border-[#0B6FA4]/40 hover:bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          mine
                            ? "bg-[#0B6FA4] text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {rank}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-800">
                            {leader.full_name}
                          </p>
                          {mine && (
                            <span className="shrink-0 rounded-full bg-[#0B6FA4] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                              You
                            </span>
                          )}
                        </div>
                        {leader.student_id && (
                          <p className="truncate text-[11px] text-slate-400">
                            ID: {leader.student_id}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 text-sm font-black text-[#0B6FA4]">
                        <FaHandHolding className="hidden text-slate-300 sm:block" size={11} />
                        {leader.points}
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
