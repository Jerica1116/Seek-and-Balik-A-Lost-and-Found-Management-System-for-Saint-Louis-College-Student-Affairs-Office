import React, { useEffect, useState } from "react";
import {
  FiCalendar,
  FiEye,
  FiSearch,
  FiX,
  FiCheck,
  FiArrowRight,
  FiChevronLeft,
  FiChevronRight,
  FiArrowLeft,
  FiAlertTriangle,
  FiThumbsUp,
  FiThumbsDown,
} from "react-icons/fi";
import {
  getClaims,
  getItemById,
  scheduleMeeting,
  declineClaim,
} from "../api/api";
import { logActivity } from "../utils/activityLog";

// ==========================================================
// ANSWER COMPARISON (STAFF-ONLY)
//
// ClaimModal.jsx intentionally never receives the "correct" answer for
// a verification question — only the option list (verification_options_N)
// is sent to the claimant, so there is nothing for them to reverse-engineer
// from the network tab. The correct answer only ever needs to be compared
// here, on the authenticated staff view, once a claim has already been
// submitted.
//
// ASSUMPTION: the recorded correct answer for question N lives on the
// item as `verification_answer_N` (mirroring the existing
// verification_question_N / verification_options_N naming). If your
// backend/serializer uses a different field name (e.g. correct_answer_N),
// update `getRecordedAnswer` below to match.
// ==========================================================

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

// `itemOverride`, when provided, is a FULL item record fetched fresh via
// getItemById() (see fetchFullItem below) — the same source of truth
// FoundItems.jsx reads from when staff edits an item's verification
// answers. It's preferred over claim.item_details/claim.item because
// the claims list endpoint (getClaims()) is not guaranteed to return
// verification_answer_N on the embedded item — that field is meant to
// stay hidden from the claimant-facing flow, so some serializers strip
// it out of any item payload that isn't specifically the admin item
// lookup. Falls back to whatever's already on the claim if the fetch
// hasn't completed yet or failed, so something still renders.
const getRecordedAnswer = (claim, index, itemOverride) => {
  const n = index + 1;
  const item = itemOverride || claim?.item_details || claim?.item || {};

  return (
    item[`verification_answer_${n}`] ??
    item[`correct_answer_${n}`] ??
    null
  );
};

// FALLBACK FOR LEGACY CLAIMS (pre-dating question_1..4 columns)
//
// ClaimModal.jsx has always built a `proof_description` string shaped like:
//   "1. <question>\nAnswer: <answer>\n\n2. <question>\nAnswer: <answer>..."
// (see legacyProof in ClaimModal.jsx) for EVERY claim, regardless of
// whether the structured question_N/answer_N columns exist/are filled.
// Any claim submitted before those columns were added to the Claim model
// has them blank, so buildAnswerComparison below has nothing structured
// to read — this parses proof_description back into the same
// {index, question, answer} shape so the panel still shows something
// instead of an empty state.
//
// There is no admin-recorded correct answer to compare against in this
// legacy shape (that mapping only exists via question_N/answer_N plus
// the item's verification_answer_N, matched up by position), so every
// parsed row here is always isMatch: null ("Not auto-checked") — this
// never invents a false mismatch, it only recovers what the claimant
// actually typed for display. Because nothing here can be flagged, a
// legacy claim is never blocked from scheduling by the mismatch rule.
const parseLegacyProof = (proofDescription) => {
  if (!proofDescription || typeof proofDescription !== "string") return [];

  const blocks = proofDescription.split(/\n\n+/);
  const parsed = [];

  blocks.forEach((block) => {
    const match = block.match(/^\s*(\d+)\.\s*([\s\S]*?)\nAnswer:\s*([\s\S]*)$/i);
    if (!match) return; // skips the "Other Unique Description" block too — no "Answer:" line there

    const [, indexStr, question, answer] = match;
    const index = parseInt(indexStr, 10);
    if (!index || !question.trim()) return;

    parsed.push({
      index,
      question: question.trim(),
      answer: answer.trim(),
      recorded: null,
      hasRecorded: false,
      isMatch: null,
    });
  });

  return parsed;
};

// Builds a per-question comparison list for the Review modal (and the
// Schedule modal's answer-check panel). Only questions that actually
// have a recorded correct answer to compare against get a match/
// mismatch flag — free-text category-fallback questions (Accessories,
// ID, etc., which have no admin-defined correct answer) are shown as
// "not auto-checked" instead of silently treated as a mismatch.
//
// Falls back to parseLegacyProof() when question_1..4 are all empty —
// see that function's comment for why (legacy claims predating those
// columns). That fallback path never marks anything as a mismatch,
// since there's no recorded answer available to compare against in that
// shape.
const buildAnswerComparison = (claim, itemOverride) => {
  if (!claim) return [];

  const structured = [1, 2, 3, 4]
    .map((n) => {
      const question = claim[`question_${n}`];
      const answer = claim[`answer_${n}`];

      if (!question) return null;

      const recorded = getRecordedAnswer(claim, n - 1, itemOverride);
      const hasRecorded =
        recorded !== null && recorded !== undefined && String(recorded).trim() !== "";

      const isMatch = hasRecorded
        ? normalize(recorded) === normalize(answer)
        : null; // null = no recorded answer to check against

      return {
        index: n,
        question,
        answer,
        recorded,
        hasRecorded,
        isMatch,
      };
    })
    .filter(Boolean);

  if (structured.length > 0) return structured;

  return parseLegacyProof(claim.proof_description);
};

// Number of questions on this claim flagged against the item's recorded
// correct answer. Used both for the warning banners and — since the
// mismatch rule below now BLOCKS scheduling rather than merely advising
// — as the gate on every scheduling control.
const countMismatches = (claim, itemOverride) =>
  buildAnswerComparison(claim, itemOverride).filter((a) => a.isMatch === false).length;

// A claim submitted by ClaimModal.jsx with mismatched (or unverified)
// answers goes through with no meeting_date/meeting_time — the claimant
// never saw a Schedule step for it, so it always needs staff to review
// the answers first before a meeting is arranged. Anything with a
// meeting_date already set was either scheduled by the claimant
// themselves (matched answers) or already scheduled by staff.
//
// Also honors the `needs_manual_review` flag ClaimModal.jsx sends at
// submission time, in case the backend ever schedules a slot on its own
// for a claim that was still flagged unverified — either signal alone
// is enough to count as pending.
const isPendingReview = (claim) =>
  !!claim && (!claim.meeting_date || !claim.meeting_time || !!claim.needs_manual_review);

// True when at least one of this claim's answers was flagged against
// the item's recorded correct answer — regardless of whether a meeting
// slot exists yet. A claim can be both scheduled AND mismatched (e.g.
// it was scheduled before the item's recorded answers were corrected),
// so this stays independent of isPendingReview.
const hasMismatch = (claim) => countMismatches(claim) > 0;

// True once staff has explicitly approved a flagged claim and scheduled
// it anyway (see handleApprove / send below, which persists this via
// scheduleMeeting's `staff_approved_despite_mismatch` field). Read
// straight off the claim record so this holds even after the page
// reloads or the 5s poll refreshes the list — not just for the current
// modal session.
//
// ASSUMPTION: scheduleMeeting's serializer accepts and RETURNS
// `staff_approved_despite_mismatch` on the claim object from
// getClaims(). If your backend doesn't persist/return this field yet,
// add it there — otherwise an approved-and-scheduled mismatched claim
// will keep reappearing in "Needs Attention" every time the list
// refreshes, since there'd be nothing here to read.
const isMismatchApproved = (claim) => !!claim?.staff_approved_despite_mismatch;

// True once staff has explicitly declined a claim through the Review
// modal's "Decline" button (see handleDecline below).
//
// ASSUMPTION: the backend's claim record exposes a `status` field and
// declineClaim() persists it as "declined" (see the ASSUMPTION note by
// the declineClaim import above). If your backend uses a different
// field/value, adjust this check to match.
const isDeclined = (claim) => normalize(claim?.status) === "declined";

// A claim belongs in the "Needs Attention" table whenever it's either
// pending (no claimant-picked schedule yet), or has a flagged mismatch
// that staff hasn't already approved. Once a mismatched claim has been
// approved (isMismatchApproved), it drops out of Needs Attention and
// only shows up in Scheduled Meetings (assuming it also has a
// meeting_date/time set) — it no longer needs a second look.
const needsAttention = (claim) =>
  isPendingReview(claim) || (hasMismatch(claim) && !isMismatchApproved(claim));

// ==========================================================
// ITEM-ALREADY-CLAIMED DETECTION
//
// FoundItems.jsx's "Mark as Claimed" button (handleClaimItem) sets the
// ITEM's status straight to "Claimed" via editLostItem — completely
// outside this claim-request flow, with no reference back to any
// specific Claim record. That means a claim could otherwise sit in this
// table pointing at an item staff already resolved by hand from the
// Found Items screen.
//
// Those claims are now filtered OUT of both tables entirely (see
// visibleClaims below) rather than shown with a badge, since the item
// is already resolved and nothing on this screen can act on it.
//
// `itemOverride`, when provided, is the full item record fetched via
// getItemById() for whichever claim is open in the Review/Schedule
// modals (see fetchFullItem) — the most current source of truth. Table
// rows fall back to whatever item payload getClaims() embedded on the
// claim (item_details / item), which should carry `status` the same way
// it already carries title/category/location. The modal banners are
// kept as a backstop for the case where that embedded payload omits
// `status` and a stale claim slips into the table anyway.
const getItemStatus = (claim, itemOverride) => {
  const item = itemOverride || claim?.item_details || claim?.item || {};
  return item?.status || null;
};

const isItemAlreadyClaimed = (claim, itemOverride) =>
  normalize(getItemStatus(claim, itemOverride)) === "claimed";

// ==========================================================
// SHARED COMPARISON UI
//
// One two-column, divider-separated card per question: claimant's
// submitted answer on the left, the admin-recorded correct answer (set
// in FoundItems.jsx) on the right. Used by both the Review modal and
// the Schedule modal's inline "Answer Check" panel so the two stay in
// sync instead of drifting apart over edits.
//
// `compact`: renders a tighter version for the Schedule modal, where
// space is more limited.
//
// Mismatches are flagged in RED (not blue) so a wrong answer reads as
// an actual warning at a glance, while both the claimant's answer and
// the staff-recorded answer stay visible side-by-side underneath —
// the flag never hides either value, it just calls attention to them.
// ==========================================================

const AnswerComparisonList = ({ comparisons, compact = false }) => {
  const sorted = [...comparisons].sort((a, b) => {
    // Mismatches first, then matches, then not-auto-checked — keeps the
    // questions that need a human look at the top of the list.
    const rank = (isMatch) => (isMatch === false ? 0 : isMatch === true ? 1 : 2);
    return rank(a.isMatch) - rank(b.isMatch);
  });

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {sorted.map((a) => (
        <div
          key={a.index}
          className={`overflow-hidden rounded-xl border ${
            a.isMatch === false
              ? "border-red-300"
              : a.isMatch === true
              ? "border-emerald-200"
              : "border-slate-200"
          }`}
        >
          {/* Question header */}
          <div
            className={`flex items-center justify-between gap-3 px-3 py-2 ${
              a.isMatch === false
                ? "bg-red-50"
                : a.isMatch === true
                ? "bg-emerald-50"
                : "bg-slate-50"
            }`}
          >
            <p
              className={`font-bold text-slate-600 ${
                compact ? "text-[10px] truncate" : "text-[11px]"
              }`}
            >
              {a.isMatch === false && (
                <FiAlertTriangle
                  className="mr-1 inline-block shrink-0 text-red-600"
                  size={compact ? 11 : 12}
                />
              )}
              {a.index}. {a.question}
            </p>
            <span
              className={`shrink-0 inline-flex items-center gap-1 rounded-full font-black uppercase ${
                compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
              } ${
                a.isMatch === false
                  ? "bg-red-200 text-red-800"
                  : a.isMatch === true
                  ? "bg-emerald-200 text-emerald-800"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {a.isMatch === false ? "Mismatch" : a.isMatch === true ? "Match" : "Not auto-checked"}
            </span>
          </div>

          {/* Two-column comparison, divided down the middle — always
              shows BOTH the claimant's answer and the staff-recorded
              answer, whether or not this question is flagged. */}
          <div className="grid grid-cols-1 divide-y divide-slate-200 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className={compact ? "p-2" : "p-3"}>
              <p
                className={`mb-1 font-black uppercase tracking-wide text-slate-400 ${
                  compact ? "text-[9px]" : "text-[10px]"
                }`}
              >
                Claimant's Answer
              </p>
              <p
                className={`break-words font-bold ${
                  a.isMatch === false ? "text-red-700" : "text-slate-800"
                } ${compact ? "text-xs" : "text-sm"}`}
              >
                {a.answer || "—"}
              </p>
            </div>
            <div className={compact ? "p-2" : "p-3"}>
              <p
                className={`mb-1 font-black uppercase tracking-wide ${
                  a.isMatch === false ? "text-red-600" : "text-blue-600"
                } ${compact ? "text-[9px]" : "text-[10px]"}`}
              >
                Recorded Answer (Staff Only)
              </p>
              <p
                className={`break-words font-bold text-slate-800 ${
                  compact ? "text-xs" : "text-sm"
                }`}
              >
                {a.hasRecorded ? String(a.recorded) : "Not auto-checked"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ClaimRequests = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [showReview, setShowReview] = useState(false);

  // Full item record for whichever claim is currently open in the
  // Review/Schedule modals — fetched via getItemById() the same way
  // FoundItems.jsx does, so verification_answer_N (the staff-recorded
  // correct answers) is guaranteed to be present, even if the claims
  // list endpoint's embedded item payload omits it. Cleared whenever
  // the modal closes or a different claim is opened.
  const [fullItem, setFullItem] = useState(null);
  const [fullItemLoading, setFullItemLoading] = useState(false);

  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [sending, setSending] = useState(false);

  // True once staff has approved a claim with flagged (mismatched)
  // answers, overriding the automatic block so scheduling can continue
  // anyway. Initialized from the claim's own persisted
  // staff_approved_despite_mismatch flag when a claim is opened (see
  // openReview), so a claim that was already approved and scheduled on
  // a previous pass doesn't show the block again — but can also be set
  // fresh via handleApprove for a claim being approved right now.
  const [approvedMismatch, setApprovedMismatch] = useState(false);

  // Loading flag for the "Decline" action, separate from `sending`
  // (which is scoped to the schedule-confirm call) so the two buttons
  // can show independent spinners if a claim is somehow both flagged
  // and mid-schedule at once.
  const [declining, setDeclining] = useState(false);

  const [search, setSearch] = useState("");

  // Which table is currently visible — "attention" (default) or
  // "scheduled". Replaces the old always-visible two-stacked-tables
  // layout with a single table switched by the pill toggle below.
  const [activeTab, setActiveTab] = useState("attention");

  const [scheduledPage, setScheduledPage] = useState(1);
  const [attentionPage, setAttentionPage] = useState(1);

  const [notification, setNotification] = useState(null);

  // Fixed set of bookable time slots. Previously these could be
  // supplemented/overridden by staff-configured slots via "Manage
  // Slots" — that feature has been removed, so this static list is now
  // the only source of times offered in the Schedule modal.
  const TIME_OPTIONS = [
    "8:00 AM - 9:00 AM",
    "9:00 AM - 10:00 AM",
    "10:00 AM - 11:00 AM",
    "11:00 AM - 12:00 PM",
    "1:00 PM - 2:00 PM",
    "2:00 PM - 3:00 PM",
    "3:00 PM - 4:00 PM",
    "4:00 PM - 5:00 PM",
  ];

  useEffect(() => {
    load();

    // A claimant can submit a new claim from the public board's
    // ClaimModal at any time — that submission already carries the
    // meeting_date/meeting_time they requested (or leaves it blank if
    // mismatched/unverified). Poll in the background (same 5s interval
    // PublicBoard.jsx uses for items) so both tables below pick up new/
    // updated claims without a manual refresh — a claim that comes in
    // mismatched lands straight in the "Needs Attention" table on the
    // very next tick, same as a cleanly-scheduled one lands in
    // "Scheduled Meetings". `silent` keeps this from flashing the
    // full-page loading spinner over the tables — or over an open
    // Review/Schedule modal — on every tick.
    //
    // This poll is also what makes a claim disappear from the tables
    // shortly after its item is marked "Claimed" over in Found Items:
    // the refreshed claim carries the item's new status, and
    // visibleClaims below filters it out.
    const interval = setInterval(() => {
      load(true);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // `silent`: when true, skips the loading spinner and error toast so
  // background polling doesn't disrupt whatever the staff member is
  // currently doing (e.g. reviewing a claim, scheduling a meeting).
  //
  // FIX: getClaims() can return either a plain array or a DRF-paginated
  // object ({ count, next, previous, results: [...] }) depending on the
  // backend's pagination settings for the claim/ viewset. The old code
  // did `setClaims(data || [])` assuming a plain array — if the backend
  // is paginated, `claims` ended up holding the wrapper OBJECT instead
  // of the list, and every render's `[...claims].sort(...)` below would
  // either throw or silently misbehave. That meant a claim newly
  // submitted via ClaimModal.jsx could never appear in either table, no
  // matter how many times the 5s poll fired, because `claims` was never
  // actually the array being filtered/rendered. Normalizing both shapes
  // here (same approach fetchFullItem already uses below) fixes it.
  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await getClaims();

      const data = Array.isArray(response)
        ? response
        : Array.isArray(response?.results)
        ? response.results
        : [];

      setClaims(data);
    } catch (err) {
      console.error(err);
      if (!silent) showNotification("Failed to load claim requests", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // --- Review -> Schedule flow ---

  // Fetches the full item record for a claim, same call FoundItems.jsx
  // uses when opening its Edit modal (getItemById). This is what
  // guarantees the Answer Comparison panel has the real
  // verification_answer_N values to compare against, rather than
  // relying on whatever (possibly trimmed) item payload came bundled
  // with the claim from getClaims().
  const fetchFullItem = async (claim) => {
    const itemId =
      claim?.item_details?.id ??
      claim?.item?.id ??
      claim?.item_id ??
      claim?.item;

    if (!itemId) {
      setFullItem(null);
      return;
    }

    try {
      setFullItemLoading(true);
      const response = await getItemById(itemId);
      const data = Array.isArray(response)
        ? response[0]
        : response?.results
        ? response.results[0]
        : response;
      setFullItem(data || null);
    } catch (err) {
      console.error("Failed to load full item details for claim review:", err);
      setFullItem(null);
    } finally {
      setFullItemLoading(false);
    }
  };

  const openReview = (claim) => {
    setSelected(claim);
    setShowReview(true);
    setFullItem(null);
    // Restore from the claim's own persisted flag rather than always
    // resetting to false — otherwise reopening a claim that was already
    // approved-and-scheduled on a previous pass would show the mismatch
    // block again for no reason.
    setApprovedMismatch(isMismatchApproved(claim));
    fetchFullItem(claim);
  };

  const closeReview = () => {
    setShowReview(false);
    setSelected(null);
    setFullItem(null);
    setApprovedMismatch(false);
  };

  const continueToSchedule = () => {
    // Guard in addition to the disabled button below — a flagged claim
    // never reaches the Schedule step unless staff has explicitly
    // approved it via handleApprove.
    if (countMismatches(selected, fullItem) > 0 && !approvedMismatch) {
      showNotification(
        "Scheduling is unavailable while an answer doesn't match the recorded answer.",
        "error"
      );
      return;
    }

    setShowReview(false);
    setMeetingDate(selected?.meeting_date || "");
    setMeetingTime(selected?.meeting_time || "");
  };

  // Staff override for a flagged claim: acknowledges the mismatch and
  // moves straight on to the Schedule step anyway, same destination as
  // continueToSchedule for a clean claim. Used from the Review modal's
  // footer in place of the disabled "Scheduling Unavailable" button
  // whenever schedulingBlocked is true.
  const handleApprove = () => {
    setApprovedMismatch(true);
    setShowReview(false);
    setMeetingDate(selected?.meeting_date || "");
    setMeetingTime(selected?.meeting_time || "");
  };

  // Staff override for a flagged claim in the other direction: rejects
  // the claim outright instead of scheduling a meeting for it.
  //
  // ASSUMPTION: api.js exposes a `declineClaim(id, payload)` helper
  // that PATCHes the claim's `status` to "declined" (see isDeclined
  // above). If your backend uses a different endpoint/field, update
  // this call and isDeclined() to match — everything else here (the
  // notification, the activity log entry, closing the modal, and
  // dropping the claim from both tables via the isDeclined filter in
  // visibleClaims) will keep working unchanged.
  const handleDecline = async () => {
    if (!selected) return;

    const targetId = selected.id || selected._id || selected.claim_id;
    if (!targetId) {
      showNotification("Error: Invalid or missing Claim ID", "error");
      return;
    }

    try {
      setDeclining(true);
      await declineClaim(targetId, { status: "declined" });

      try {
        await logActivity({
          action: "Decline Claim",
          details: `Declined claim for ${selected.claimant_name || "claimant"} (mismatched answers)`,
        });
      } catch (logErr) {
        console.error("Activity log error:", logErr);
      }

      showNotification("Claim declined.", "success");
      closeReview();
      await load();
    } catch (err) {
      console.error(err);
      showNotification("Failed to decline claim", "error");
    } finally {
      setDeclining(false);
    }
  };

  const backToReview = () => {
    setShowReview(true);
  };

  const send = async () => {
    if (!selected) return;

    // Support flexible ID lookups across MongoDB / PostgreSQL formats
    const targetId = selected.id || selected._id || selected.claim_id;
    if (!targetId) {
      showNotification("Error: Invalid or missing Claim ID", "error");
      return;
    }

    // MISMATCH BLOCKS SCHEDULING — unless staff has explicitly approved
    // the flagged claim via handleApprove (see approvedMismatch state).
    //
    // Recomputed here rather than reading the `selectedMismatchCount`
    // defined further down the component body — that binding lives
    // below this function and isn't reachable on every render path, so
    // this stays self-contained. Final backstop behind the disabled
    // Confirm button.
    if (countMismatches(selected, fullItem) > 0 && !approvedMismatch) {
      showNotification(
        "Scheduling is blocked — this claim has mismatched answers.",
        "error"
      );
      return;
    }

    if (!meetingDate || !meetingTime) {
      showNotification("Please select both a date and a time slot", "error");
      return;
    }

    try {
      setSending(true);

      // `staff_scheduled: true` marks this meeting as explicitly
      // confirmed by a moderator/admin through this Review → Schedule →
      // Confirm flow — as opposed to a claimant self-picking their own
      // slot during initial submission (ClaimModal.jsx, when their
      // verification answers matched). Dashboard.jsx's ClaimScheduleCalendar
      // filters on this flag so it only highlights meetings staff has
      // actually reviewed and locked in.
      //
      // `staff_approved_despite_mismatch: true` is only ever sent when
      // approvedMismatch is set — i.e. staff clicked "Approve" on a
      // flagged claim rather than "Decline" (or the claim was already
      // approved on a previous pass — see openReview). This is also
      // what needsAttention/isMismatchApproved above read to move an
      // approved, scheduled claim out of "Needs Attention" and into
      // "Scheduled Meetings" only.
      //
      // ASSUMPTION: the backend's scheduleMeeting endpoint/serializer
      // accepts and persists `staff_scheduled` and
      // `staff_approved_despite_mismatch`, and returns them on claim
      // objects from getClaims(). If it doesn't yet, add them there (or
      // swap these field names for whatever equivalent already exists).
      await scheduleMeeting(targetId, {
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        staff_scheduled: true,
        ...(approvedMismatch ? { staff_approved_despite_mismatch: true } : {}),
      });

      try {
        await logActivity({
          action: "Schedule Verification Meeting",
          details: `Scheduled meeting for ${selected.claimant_name || "claimant"} on ${meetingDate} at ${meetingTime}`,
        });
      } catch (logErr) {
        console.error("Activity log error:", logErr);
      }

      setSelected(null);
      setFullItem(null);
      setMeetingDate("");
      setMeetingTime("");
      setApprovedMismatch(false);
      await load();

      showNotification("Meeting scheduled successfully!", "success");
    } catch (err) {
      console.error(err);
      showNotification("Failed to schedule meeting", "error");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center p-6 text-[#7B8AA6]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0B6B8A] border-t-transparent" />
          <p className="text-sm font-semibold tracking-wide">Loading claim requests...</p>
        </div>
      </div>
    );
  }

  const ITEMS_PER_PAGE = 10;

  const sortedClaims = [...claims].sort(
    (a, b) => new Date(b.claim_date) - new Date(a.claim_date)
  );

  const searchText = search.toLowerCase();
  const matchesSearch = (c) =>
    c.claimant_name?.toLowerCase().includes(searchText) ||
    c.claimant_email?.toLowerCase().includes(searchText) ||
    String(c.claimant_contact || "").toLowerCase().includes(searchText);

  // ==========================================================
  // ALREADY-CLAIMED ITEMS / DECLINED CLAIMS ARE EXCLUDED
  //
  // A claim whose item was already marked "Claimed" — e.g. by hand via
  // FoundItems.jsx's "Mark as Claimed", which never touches this Claim
  // record — is resolved outside this flow entirely. Those claims are
  // dropped here so they don't sit in either table looking actionable,
  // and so the tab counts reflect only work that's actually open.
  //
  // A claim staff has explicitly declined (see handleDecline above) is
  // dropped the same way — it's been resolved (by rejection rather than
  // scheduling), so it shouldn't keep showing up in "Needs Attention".
  //
  // Table rows can only read the item payload getClaims() embedded on
  // the claim, so if a serializer omits `status` there a stale claim
  // may still slip through — the purple banners in the Review/Schedule
  // modals (which read the fresh getItemById() record) stay in place as
  // the backstop for exactly that case.
  // ==========================================================
  const visibleClaims = sortedClaims.filter((c) => !isItemAlreadyClaimed(c) && !isDeclined(c));

  // ==========================================================
  // TWO SEPARATE BUCKETS
  //
  // Claims are split into two buckets — only one is shown at a time,
  // switched via the pill toggle in the header:
  //   - scheduledClaims: has a meeting_date & meeting_time already set
  //     (claimant-picked because their answers matched, or staff set
  //     one manually from the Needs Attention table).
  //   - attentionClaims: isPendingReview (no schedule yet), or has a
  //     flagged mismatch staff hasn't approved yet (needsAttention
  //     above) — these are NOT mutually exclusive with scheduledClaims
  //     for a claim that's pending mismatch approval but was previously
  //     scheduled. Once a mismatch is approved (isMismatchApproved), the
  //     claim drops out of attentionClaims and lives only in
  //     scheduledClaims going forward.
  // ==========================================================

  const scheduledClaims = visibleClaims.filter((c) => !isPendingReview(c) && matchesSearch(c));
  const attentionClaims = visibleClaims.filter((c) => needsAttention(c) && matchesSearch(c));

  const scheduledTotalPages = Math.ceil(scheduledClaims.length / ITEMS_PER_PAGE) || 1;
  const attentionTotalPages = Math.ceil(attentionClaims.length / ITEMS_PER_PAGE) || 1;

  const scheduledStart = (scheduledPage - 1) * ITEMS_PER_PAGE;
  const attentionStart = (attentionPage - 1) * ITEMS_PER_PAGE;

  const paginatedScheduled = scheduledClaims.slice(scheduledStart, scheduledStart + ITEMS_PER_PAGE);
  const paginatedAttention = attentionClaims.slice(attentionStart, attentionStart + ITEMS_PER_PAGE);

  const todayDate = new Date().toLocaleDateString("en-CA");

  // Per-question comparison for whichever claim is currently open in the
  // Review modal (and reused in the Schedule modal below). Computed
  // here (not stored in state) so it always reflects the latest
  // `selected` claim without an extra effect.
  const answerComparison = buildAnswerComparison(selected, fullItem);
  const selectedMismatchCount = answerComparison.filter((a) => a.isMatch === false).length;

  // Any flagged answer disables the whole scheduling path — the
  // Review modal's "Continue to Schedule" button and the Schedule
  // modal's "Confirm Schedule" button both read this — UNLESS staff has
  // explicitly approved the flagged claim via handleApprove
  // (approvedMismatch), in which case the block lifts for this claim
  // only, for the rest of this modal session.
  const schedulingBlocked = selectedMismatchCount > 0 && !approvedMismatch;

  // True when the claim currently open in the Review/Schedule modals
  // already has a meeting_date & meeting_time set — i.e. it's already
  // scheduled (either by the claimant themselves, or by staff on a
  // previous pass). Used to warn staff before they re-confirm and
  // silently overwrite an existing appointment.
  const selectedAlreadyScheduled = !!selected && !isPendingReview(selected);

  // True when the item behind the claim currently open in the Review/
  // Schedule modals has already been marked "Claimed" directly from
  // Found Items. Such claims are normally filtered out of the tables
  // above, so this only fires when the claims-list payload omitted
  // `status` and the fresh getItemById() record revealed it after the
  // modal was opened.
  const selectedItemAlreadyClaimed = isItemAlreadyClaimed(selected, fullItem);

  // Shared row renderer for both tables — keeps the two markup blocks
  // in sync instead of drifting apart over edits. `variant` controls
  // which column the second badge/status cell shows.
  const renderClaimRow = (c, index, variant) => {
    const pending = isPendingReview(c);
    // Suppress the "Answer Mismatch" badge once staff has approved the
    // mismatch — an approved claim reads as resolved, not flagged.
    const mismatched = hasMismatch(c) && !isMismatchApproved(c);

    return (
      <tr key={c.id || c._id || index} className={`h-[56px] ${index % 2 === 0 ? "bg-white" : "bg-[#F6FAFF]"} hover:bg-[#EAF4FF]`}>
        <td className="border border-gray-300 p-4 text-center align-middle font-bold text-[#0B6B8A] text-[13px]">
          <span className="inline-flex flex-col items-center gap-1">
            <span>{c.claimant_name || "N/A"}</span>
            {mismatched && (
              <span
                title="An answer doesn't match the recorded answer — review before scheduling"
                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase text-red-700"
              >
                <FiAlertTriangle size={9} />
                Answer Mismatch
              </span>
            )}
          </span>
        </td>
        <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[13px]">{c.claimant_email || "N/A"}</td>
        <td className="border border-gray-300 p-4 text-center align-middle text-slate-700 text-[13px]">{c.claimant_contact || "—"}</td>
        <td className="border border-gray-300 p-4 text-center align-middle text-[13px]">
          {pending ? (
            <span
              title="Submitted with no claimant-picked meeting slot — needs staff review first"
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700"
            >
              Pending Review
            </span>
          ) : (
            <span className="inline-flex flex-col items-center gap-1">
              <span className="text-[#0B6B8A] font-semibold">{`${c.meeting_date} (${c.meeting_time})`}</span>
              {variant === "attention" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700">
                  Already Scheduled
                </span>
              )}
            </span>
          )}
        </td>
        <td className="border border-gray-300 p-2 text-center align-middle">
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => openReview(c)}
              title="Review Claim"
              aria-label="Review Claim"
              className="inline-flex h-9 px-3 items-center gap-1.5 rounded bg-[#0B6B8A] text-xs font-bold text-white hover:bg-[#095A74] transition-colors"
            >
              <FiEye size={16} />
              <span>Review</span>
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderPagination = (page, setPage, totalPages, totalCount) => (
    <div className="shrink-0 border-t border-[#D8E2EF] bg-slate-50 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs font-semibold text-[#7B8AA6]">
        Showing {totalCount > 0 ? (page - 1) * ITEMS_PER_PAGE + 1 : 0} to{" "}
        {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} entries
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={page === 1}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBD8E8] bg-white px-3 text-xs font-bold text-[#071E3D] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <FiChevronLeft size={16} /> Previous
        </button>
        <span className="text-xs font-bold text-[#071E3D] px-2">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={page === totalPages || totalPages === 0}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBD8E8] bg-white px-3 text-xs font-bold text-[#071E3D] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Next <FiChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  // Which bucket is currently on screen, driven by the pill toggle.
  const isAttentionTab = activeTab === "attention";
  const visibleRows = isAttentionTab ? paginatedAttention : paginatedScheduled;
  const visibleVariant = isAttentionTab ? "attention" : "scheduled";
  const visibleEmptyText = isAttentionTab
    ? "Nothing needs attention right now."
    : "No scheduled meetings found.";
  const visiblePagination = isAttentionTab
    ? renderPagination(attentionPage, setAttentionPage, attentionTotalPages, attentionClaims.length)
    : renderPagination(scheduledPage, setScheduledPage, scheduledTotalPages, scheduledClaims.length);

  return (
    <div className="flex h-full min-h-[calc(100vh-120px)] flex-col gap-6 rounded-[20px] p-0">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-[100] flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-bold shadow-lg transition-all ${
            notification.type === "error" ? "bg-rose-600 text-white" : "bg-[#0B6B8A] text-white"
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            title="Close Notification"
            aria-label="Close Notification"
            className="ml-2 text-white/80 hover:text-white"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Header + search + tab switcher */}
      <div className="shrink-0 rounded-[20px] border border-[#D8E2EF] bg-white shadow-[0_8px_24px_rgba(45,54,109,0.06)] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3.5">
            <div>
              <h3 className="text-xl font-black uppercase tracking-[0.15em] text-[#071E3D] sm:text-2xl">
                Claim Requests
              </h3>
              <p className="mt-0.5 text-sm font-medium text-[#7B8AA6]">
                Review ownership claims and schedule verification appointments.
              </p>
            </div>
          </div>

          {/* Right side: search only — "Manage Slots" has been removed */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="relative w-full sm:w-[280px]">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B8AA6]" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setScheduledPage(1);
                  setAttentionPage(1);
                }}
                placeholder="Search claimant..."
                className="w-full rounded-full border border-[#CBD8E8] bg-[#F8FAFC] py-2.5 pl-9 pr-9 text-sm font-medium text-[#071E3D] outline-none focus:border-[#0B6B8A]"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setScheduledPage(1);
                    setAttentionPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B8AA6] hover:text-[#071E3D]"
                  title="Clear Search"
                >
                  <FiX size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ==========================================================
            TAB SWITCHER (pill toggle) — styled to match the Claimed /
            Not Claimed filter buttons in FoundItems.jsx, and aligned to
            the right side of the header (same as those buttons).
            "Needs Attention" is the default tab since it's what staff
            should check first. Counts stay visible on both segments so
            nothing is out of sight just because it's not the active tab.
        ========================================================== */}
        <div className="mt-4 flex justify-end">
          <div className="inline-flex items-center gap-1 rounded-full bg-[#F1F4F9] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("attention")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition-all ${
                isAttentionTab
                  ? "bg-white text-red-700 shadow-sm"
                  : "text-[#7B8AA6] hover:text-[#475569]"
              }`}
            >
              <FiAlertTriangle size={14} />
              <span>Needs Attention</span>
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                  isAttentionTab ? "bg-red-100 text-red-700" : "bg-white text-[#7B8AA6]"
                }`}
              >
                {attentionClaims.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("scheduled")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition-all ${
                !isAttentionTab
                  ? "bg-white text-[#0B6B8A] shadow-sm"
                  : "text-[#7B8AA6] hover:text-[#475569]"
              }`}
            >
              <FiCalendar size={14} />
              <span>Scheduled Meetings</span>
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                  !isAttentionTab ? "bg-[#0B6B8A]/10 text-[#0B6B8A]" : "bg-white text-[#7B8AA6]"
                }`}
              >
                {scheduledClaims.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* =================================================
          ACTIVE TABLE
          Shows whichever bucket the pill toggle above selects. Rows,
          empty state, and pagination all switch together based on
          `activeTab` — see renderClaimRow / renderPagination above.
          Table markup mirrors FoundItems.jsx's bordered table style.
      ================================================= */}
      <div className="bg-white rounded-[18px] border border-[#D8E2EF] shadow-[0_8px_24px_rgba(45,54,109,0.08)] overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full min-w-[850px] table-fixed border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-[22%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Claimant Name</th>
                <th className="w-[26%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Email Address</th>
                <th className="w-[18%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Contact Number</th>
                <th className="w-[22%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Scheduled Date/Time</th>
                <th className="w-[12%] bg-[#0B6B8A] p-4 border border-gray-300 text-center text-[11px] font-black uppercase text-white">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {visibleRows.length > 0 ? (
                visibleRows.map((c, index) => renderClaimRow(c, index, visibleVariant))
              ) : (
                <tr>
                  <td colSpan={5} className="bg-white py-24 text-center text-[#7B8AA6] font-bold uppercase">
                    {visibleEmptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {visiblePagination}
      </div>

      {/* REVIEW CLAIM MODAL */}
      {showReview && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#071E3D]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="bg-[#0B6B8A] px-6 py-5 text-white shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-black">Claim Verification</h2>
                  <p className="mt-1 text-xs text-white/80">
                    Review the claimant's ownership information before continuing.
                  </p>
                </div>
                <button
                  onClick={closeReview}
                  title="Close Modal"
                  aria-label="Close Modal"
                  className="rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* ==========================================================
                  ITEM-ALREADY-CLAIMED BANNER — the single most decisive
                  piece of context, so it sits above every other banner.
                  Claims on already-claimed items are filtered out of the
                  tables entirely, so this only appears when the claims-
                  list payload omitted `status` and the fresh
                  getItemById() record revealed it after the modal opened.
                  Purple to match the "Claimed" status color used
                  throughout FoundItems.jsx.
              ========================================================== */}
              {selectedItemAlreadyClaimed && (
                <div className="flex items-start gap-3 rounded-xl border border-purple-300 bg-purple-50 p-4">
                  <FiCheck className="mt-0.5 shrink-0 text-purple-600" size={18} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-purple-700">
                      Item Already Marked Claimed
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-purple-700/90 leading-relaxed">
                      This item's status was already set to "Claimed" (e.g. from Found Items).
                      This claim request may be outdated or refer to a claimant who was not the
                      one who ultimately picked it up. It will drop off this list on the next
                      refresh — double-check before acting on it further.
                    </p>
                  </div>
                </div>
              )}

              {/* ==========================================================
                  RED "WRONG ANSWER" BANNER — sits at the very top of the
                  modal body, above everything else (item info, claimant
                  info, Pending Review notice), so a flagged claim reads
                  as a warning the instant staff opens Review. A flagged
                  claim's scheduling controls stay disabled until staff
                  makes an explicit call below: "Approve" overrides the
                  block and moves on to Schedule anyway, "Decline" rejects
                  the claim outright. Both answers stay visible in full in
                  the Answer Comparison panel below either way.
              ========================================================== */}
              {selectedMismatchCount > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4">
                  <FiAlertTriangle className="mt-0.5 shrink-0 text-red-600" size={18} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-red-700">
                      {selectedMismatchCount} Answer{selectedMismatchCount > 1 ? "s" : ""} Don't Match Records
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-red-700/90 leading-relaxed">
                      One or more of the claimant's answers don't match the answer recorded on the
                      item. Compare both answers side-by-side in the Answer Comparison section
                      below, then either <span className="font-black">Approve</span> to continue to
                      scheduling anyway, or <span className="font-black">Decline</span> to reject
                      this claim.
                    </p>
                  </div>
                </div>
              )}

              {/* ==========================================================
                  ALREADY-SCHEDULED NOTICE
                  A meeting_date/meeting_time is already set on this claim
                  (claimant self-picked one at submission, or staff already
                  ran through Review → Schedule → Confirm before). Surfacing
                  this here — before staff even clicks "Continue to
                  Schedule" — avoids staff re-scheduling the same claim/item
                  a second time without realizing one is already booked.
              ========================================================== */}
              {selectedAlreadyScheduled && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                  <FiCalendar className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                      Meeting Already Scheduled
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-emerald-700/90 leading-relaxed">
                      A meeting is already set for{" "}
                      <span className="font-black">{selected.meeting_date}</span> at{" "}
                      <span className="font-black">{selected.meeting_time}</span>. Only continue to
                      Schedule if you need to change this existing appointment — otherwise you're
                      about to book this claim twice.
                    </p>
                  </div>
                </div>
              )}

              {/* Pending Review status — this claim was submitted by
                  ClaimModal.jsx with no claimant-picked meeting slot,
                  meaning the answers didn't verify (or couldn't be
                  auto-checked) and it's waiting on a staff decision
                  before any meeting exists. */}
              {isPendingReview(selected) && (
                <div className="flex items-start gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4">
                  <FiAlertTriangle className="mt-0.5 shrink-0 text-blue-600" size={18} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                      Pending Review — No Meeting Scheduled
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-blue-700/90 leading-relaxed">
                      The claimant's answers didn't fully match our records (or couldn't be
                      auto-checked), so they weren't shown a scheduling step. Review their
                      answers below, then use "Continue to Schedule" to set a meeting yourself
                      once you're satisfied.
                    </p>
                  </div>
                </div>
              )}

              {/* Item */}
              <div className="rounded-xl border border-[#D8E2EF] bg-[#F8FAFC] p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#0B6B8A]">
                  Item Being Claimed
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Item</p>
                    <p className="font-bold text-[#071E3D]">
                      {selected.item_details?.title ||
                        selected.item_title ||
                        selected.item?.title ||
                        `Item #${selected.item}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Category</p>
                    <p className="font-bold text-[#0B6B8A]">
                      {selected.item_details?.category ||
                        selected.item_category ||
                        selected.item?.category ||
                        "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Location</p>
                    <p className="font-semibold text-slate-700">
                      {selected.item_details?.location ||
                        selected.item_location ||
                        selected.item?.location ||
                        "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Item Type</p>
                    <p className="font-semibold text-slate-700">
                      {selected.item_details?.type || "Surrendered"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Claimant */}
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#0B6B8A]">
                  Claimant Information
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-slate-400">Name</p>
                    <p className="font-bold text-slate-800">{selected.claimant_name || "N/A"}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-slate-400">Contact</p>
                    <p className="font-bold text-slate-800">{selected.claimant_contact || "N/A"}</p>
                  </div>
                  <div className="rounded-xl border p-3 sm:col-span-2">
                    <p className="text-xs text-slate-400">Email</p>
                    <p className="font-bold text-slate-800">{selected.claimant_email || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* ==========================================================
                  ANSWER COMPARISON (STAFF ONLY) — sole comparison surface

                  Two-column comparison per question — claimant's answer
                  vs. the correct answer recorded on the item, where one
                  is available — separated by a divider.

                  A flagged mismatch requires an explicit staff decision
                  (Approve or Decline, in the footer below) before
                  scheduling can continue. Questions with no recorded
                  correct answer (e.g. generic category fallback questions
                  with no admin-defined answer) show "Not auto-checked" on
                  the right instead of a false mismatch, and never block
                  anything.

                  Mismatched questions are sorted to the top and flagged
                  in red so staff sees them first without having to scan
                  the whole list — but both the claimant's answer and the
                  staff-recorded answer always stay visible underneath the
                  flag, for every question, matched or not.
              ========================================================== */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-[#0B6B8A]">
                    Answer Comparison (Staff Only)
                  </p>
                  {selectedMismatchCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
                      <FiAlertTriangle size={12} />
                      {selectedMismatchCount} mismatch{selectedMismatchCount > 1 ? "es" : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      <FiCheck size={12} />
                      No flags
                    </span>
                  )}
                </div>

                {fullItemLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-400">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                    Loading recorded answers...
                  </div>
                ) : answerComparison.length > 0 ? (
                  <AnswerComparisonList comparisons={answerComparison} />
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm italic text-slate-400">
                    No answers were recorded for this claim.
                  </p>
                )}

                <p className="mt-2 text-[10px] font-semibold text-slate-400">
                  Claimants never see this comparison. A flagged mismatch requires an explicit
                  Approve or Decline decision before this claim can be scheduled.
                </p>
              </div>
            </div>

            {/* ==========================================================
                FOOTER — two layouts:
                  - Flagged (schedulingBlocked): "Approve" / "Decline"
                    replace the old disabled "Scheduling Unavailable"
                    button, so a mismatched claim always has a clear next
                    action instead of a dead end.
                  - Clean (or already approved): the original single
                    "Continue to Schedule" button.
            ========================================================== */}
            <div className="flex gap-3 border-t bg-slate-50 p-4 justify-end shrink-0">
              <button
                type="button"
                onClick={closeReview}
                className="flex h-10 px-4 items-center justify-center rounded-xl bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-300 transition-colors"
              >
                Close
              </button>

              {schedulingBlocked ? (
                <>
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={declining}
                    className="flex h-10 px-5 items-center justify-center gap-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {declining ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <FiThumbsDown size={16} />
                        <span>Decline</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={declining}
                    title="Override the flagged answer(s) and continue to scheduling anyway"
                    className="flex h-10 px-5 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiThumbsUp size={16} />
                    <span>Approve</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={continueToSchedule}
                  className="flex h-10 px-5 items-center justify-center gap-2 rounded-xl bg-[#0B6B8A] text-white font-bold text-xs hover:bg-[#095A74] transition-colors"
                >
                  <span>
                    {selectedAlreadyScheduled ? "Continue to Reschedule" : "Continue to Schedule"}
                  </span>
                  <FiArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE MEETING MODAL */}
      {selected && !showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071E3D]/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#0B6B8A] px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold">
                  {selectedAlreadyScheduled ? "Update Verification Schedule" : "Schedule Verification"}
                </h2>
                <p className="text-xs opacity-80">Claimant: {selected.claimant_name}</p>
              </div>
              <button
                type="button"
                onClick={backToReview}
                className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg transition-colors"
                title="Back to Review"
              >
                <FiArrowLeft size={14} /> Back
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Compact purple banner — mirrors the Review modal's
                  item-already-claimed notice. Reaching this modal with
                  an already-claimed item means the status only surfaced
                  after the fresh item fetch completed. */}
              {selectedItemAlreadyClaimed && (
                <div className="flex items-start gap-2 rounded-xl border border-purple-300 bg-purple-50 p-3">
                  <FiCheck className="mt-0.5 shrink-0 text-purple-600" size={15} />
                  <p className="text-[11px] font-bold text-purple-700 leading-relaxed">
                    This item is already marked "Claimed" — double-check this claim is still
                    relevant before confirming a meeting.
                  </p>
                </div>
              )}

              {/* Compact amber banner — this claim only reaches the
                  Schedule modal despite a flag because staff clicked
                  "Approve" (now or on a previous pass). Restated here so
                  it's clear on this screen too why a flagged claim is
                  still schedulable. */}
              {approvedMismatch && selectedMismatchCount > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <FiThumbsUp className="mt-0.5 shrink-0 text-amber-600" size={15} />
                  <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                    {selectedMismatchCount} mismatch{selectedMismatchCount > 1 ? "es were" : " was"}{" "}
                    approved by staff — see the comparison below.
                  </p>
                </div>
              )}

              {/* ==========================================================
                  ANSWER COMPARISON OVERVIEW (inline, staff-only)

                  Lets staff see at a glance — right here in the
                  scheduling step, without having to go "Back" to the
                  Review screen — the same two-column comparison (claimant
                  vs. recorded) as the Review modal, just in a more compact
                  layout.
              ========================================================== */}
              {answerComparison.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Answer Comparison
                    </p>
                    {selectedMismatchCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        <FiAlertTriangle size={11} />
                        {selectedMismatchCount} mismatch{selectedMismatchCount > 1 ? "es" : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <FiCheck size={11} />
                        No flags
                      </span>
                    )}
                  </div>

                  <AnswerComparisonList comparisons={answerComparison} compact />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#071E3D] mb-1">Meeting Date</label>
                <input
                  type="date"
                  value={meetingDate}
                  min={todayDate}
                  onChange={(e) => {
                    setMeetingDate(e.target.value);
                    setMeetingTime("");
                  }}
                  className="w-full rounded-xl border p-3 text-sm outline-none focus:border-[#0B6B8A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#071E3D] mb-1">Meeting Time Slot</label>
                <select
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  disabled={!meetingDate}
                  className="w-full rounded-xl border p-3 text-sm outline-none focus:border-[#0B6B8A] disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select available time</option>
                  {TIME_OPTIONS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs text-blue-700">
                  The claimant will receive an email containing the verification meeting date, time, and location.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setFullItem(null);
                    setMeetingDate("");
                    setMeetingTime("");
                    setApprovedMismatch(false);
                  }}
                  className="flex h-10 flex-1 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={sending || !meetingDate || !meetingTime}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B6B8A] text-white font-bold text-xs hover:bg-[#095A74] disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <FiCheck size={16} />
                      <span>{selectedAlreadyScheduled ? "Update Schedule" : "Confirm Schedule"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimRequests;
