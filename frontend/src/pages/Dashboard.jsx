import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  Tooltip as LeafletTooltip,
  ZoomControl,
  useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FaExclamationCircle,
  FaCheckCircle,
  FaBox,
  FaBoxOpen,
  FaTag,
  FaUsers,
  FaShieldAlt,
  FaStar,
  FaHeartbeat,
  FaMapMarkerAlt,
  FaAward,
  FaChevronLeft,
  FaChevronRight,
  FaUserClock,
  FaTimes,
  FaCalendarAlt,
  FaClock,
  FaMap,
  FaCrosshairs,
  FaUniversity,
  FaWalking,
  FaLayerGroup,
  FaDoorOpen,
  FaInfoCircle,
  FaCompass,
  FaHistory,
  FaPlusCircle,
  FaTimesCircle,
  FaTrashAlt,
  FaPen,
  FaHandshake,
  FaCalendarCheck,
  FaSignInAlt,
  FaArrowRight
} from 'react-icons/fa';
import { getItems, getUsers, getClaims } from '../api/api';
import { getActivityLogsLocal, ACTIVITY_LOG_UPDATE_EVENT } from '../utils/activityLog';


// ================= HELPERS & UTILS =================

const statusColor = (s) =>
  s === 'Claimed'  ? 'bg-purple-50 text-purple-600 border border-purple-100' :
  s === 'Pending'  ? 'bg-orange-50 text-orange-600 border border-orange-100' :
  s === 'Approved' ? 'bg-green-50 text-green-600 border border-green-100'  :
  'bg-slate-100 text-slate-500 border border-slate-200';

const claimantLabel = (claim) => claim.claimant_name || 'Unnamed claimant';

const parseTimeRangeStart = (timeRange) => {
  if (!timeRange) return null;

  const startStr = timeRange.split('-')[0].trim();
  const match = startStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  let [, hh, mm, meridiem] = match;
  hh = parseInt(hh, 10);
  mm = parseInt(mm, 10);

  if (/PM/i.test(meridiem) && hh !== 12) hh += 12;
  if (/AM/i.test(meridiem) && hh === 12) hh = 0;

  return { hours: hh, minutes: mm };
};

const getScheduleDate = (claim) => {
  if (claim.meeting_date) {
    const base = new Date(`${claim.meeting_date}T00:00:00`);
    if (!isNaN(base.getTime())) {
      const time = parseTimeRangeStart(claim.meeting_time);
      if (time) base.setHours(time.hours, time.minutes, 0, 0);
      return base;
    }
  }

  const raw =
    claim.scheduled_date ||
    claim.scheduledDate ||
    claim.meetingDate ||
    claim.schedule_date ||
    claim.scheduleDate ||
    claim.appointment_date ||
    claim.appointmentDate;

  if (!raw) return null;

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

// ==========================================================
// STAFF-CONFIRMED SCHEDULE CHECK
//
// A claim can end up with a meeting_date/meeting_time two different
// ways:
//   1. The claimant self-picks a slot during submission (ClaimModal.jsx),
//      which only happens when their ownership-verification answers
//      matched the recorded answer — no staff involvement at all.
//   2. A moderator/admin explicitly reviews the claim in
//      ClaimRequests.jsx and walks it through "Continue to Schedule" →
//      "Confirm Schedule" (see that file's `send()` function).
//
// This dashboard calendar should only highlight case #2 — meetings a
// human staff member actually reviewed and locked in — not every claim
// that happens to have a date/time on it. `send()` in ClaimRequests.jsx
// tags the claim with `staff_scheduled: true` when it calls
// scheduleMeeting(), so that flag is what this checks for.
//
// ASSUMPTION: the backend's scheduleMeeting endpoint/serializer accepts
// and persists `staff_scheduled`, and returns it on claim objects from
// getClaims(). If your backend already exposes an equivalent field
// under a different name, update the checks below to match it instead.
// ==========================================================

const isStaffConfirmedSchedule = (claim) =>
  !!claim && (claim.staff_scheduled === true || claim.staffScheduled === true);

const ACTIVITY_META = {
  created: { label: 'Created', icon: FaPlusCircle, className: 'bg-blue-50 text-blue-600 border border-blue-100' },
  approved: { label: 'Approved', icon: FaCheckCircle, className: 'bg-green-50 text-green-600 border border-green-100' },
  declined: { label: 'Declined', icon: FaTimesCircle, className: 'bg-orange-50 text-orange-600 border border-orange-100' },
  claimed: { label: 'Claimed', icon: FaHandshake, className: 'bg-purple-50 text-purple-600 border border-purple-100' },
  updated: { label: 'Updated', icon: FaPen, className: 'bg-slate-100 text-slate-600 border border-slate-200' },
  deleted: { label: 'Deleted', icon: FaTrashAlt, className: 'bg-red-50 text-red-600 border border-red-100' },
  scheduled: { label: 'Scheduled', icon: FaCalendarCheck, className: 'bg-cyan-50 text-cyan-600 border border-cyan-100' },
  login: { label: 'Login', icon: FaSignInAlt, className: 'bg-indigo-50 text-indigo-600 border border-indigo-100' },
};

const activityMeta = (action) =>
  ACTIVITY_META[(action || '').toLowerCase()] || {
    label: action || 'Activity',
    icon: FaHistory,
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
  };

function formatRelativeTime(dateInput) {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ================= STAT CARD =================

const StatCard = ({ label, count, icon: Icon, color, bgColor, description }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 group relative flex flex-col justify-between overflow-hidden">
    <div className={`absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all duration-500 transform group-hover:scale-125 group-hover:-rotate-12 text-slate-900`}>
      <Icon size={120} />
    </div>

    <div className="flex justify-between items-start relative z-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">{label}</p>
        <h3 className="text-3xl font-black text-slate-800 tracking-tight font-sans">{count}</h3>
      </div>
      <div className={`${bgColor} ${color} p-3 rounded-2xl shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={20} className="stroke-[2.5]" />
      </div>
    </div>

    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between relative z-10">
      <span className="text-[11px] font-medium text-slate-400 tracking-wide w-full">{description}</span>
    </div>
  </div>
);

// ================= CAMPUS BUILDINGS (Leaflet) =================
//
// These used to be SVG polygons on a hand-drawn schematic. They're now
// plotted on a real Leaflet map. Real GPS coordinates aren't wired up yet,
// so each building falls back to an auto-generated point near
// CAMPUS_CENTER, laid out using the same relative positions the old
// schematic used (labelX/labelY), so the map's overall layout still looks
// roughly right until real coordinates are added.
//
// To use real coordinates: add an entry to REAL_COORDINATES keyed by the
// building's `id`, e.g. `1: { lat: 16.6152, lng: 120.3212 }`. Any building
// without an entry keeps using its auto-placed placeholder position.

// Saint Louis College of San Fernando, La Union — Carlatan, San Fernando, La Union, Philippines
// (16°38'12"N 120°18'48"E, per the school's own published coordinates —
// cross-checked against Google Places, which puts the campus pin at
// 16.6374683, 120.3128374, ~15m away. Both agree, so this is treated as
// the verified campus anchor.)
const CAMPUS_CENTER = { lat: 16.63673, lng: 120.31321 };
const COORD_SCALE = 0.00006; // degrees per old SVG unit — raise/lower to spread markers further apart/closer together

// Verified campus landmark — shown as a distinct labeled pin on the map
// so it's immediately clear which school this hotspot map belongs to.
const SLC_LANDMARK = {
  name: 'Saint Louis College',
  subtitle: 'San Fernando, La Union',
  lat: CAMPUS_CENTER.lat,
  lng: CAMPUS_CENTER.lng,
  mapsUrl: 'https://maps.google.com/?cid=9972838631775129005',
};

// Custom divIcon for the SLC landmark pin so it reads differently from
// the numbered building CircleMarkers (a labeled pill instead of a dot).
const slcIcon = L.divIcon({
  className: 'slc-landmark-icon',
  html: `
    <div style="
      display:flex; align-items:center; gap:6px;
      background:#0B6FA4; color:#fff; font-weight:900;
      font-size:11px; padding:5px 10px; border-radius:999px;
      box-shadow:0 2px 8px rgba(0,0,0,0.35); white-space:nowrap;
      border:2px solid #fff; transform: translate(-50%, -130%);
    ">
      📍 Saint Louis College
    </div>
  `,
  iconSize: [0, 0], // sizing handled by the inline styles above
});

// Derived from the user-supplied numbered satellite reference photo.
// Method: two points were independently verified via Google Places —
// the official "Saint Louis College La Union" pin (CAMPUS_CENTER) and
// "SLC Gymnasium" (#6, 16.636109, 120.3133693). Their pixel positions in
// the reference photo were used to solve a 2D similarity transform
// (uniform scale + rotation) from photo-pixel space to lat/lng, which was
// then applied to every other numbered pin's pixel position in the same
// photo. This is photo-calibrated, not individually GPS-surveyed per
// building — accurate enough to place each roof correctly relative to
// the two verified anchors, but not survey-grade. Replace any entry here
// with a real "copy coordinates" pin from Google Maps satellite for
// exact precision.
const REAL_COORDINATES = {
  1:  { lat: 16.636728, lng: 120.312682 }, // Grandstand Guardhouse
  2:  { lat: 16.637054, lng: 120.312432 }, // Verbist Building
  3:  { lat: 16.637191, lng: 120.312961 }, // Transfiguration of the Lord Chapel
  4:  { lat: 16.636619, lng: 120.313037 }, // Admin Bldg
  5:  { lat: 16.636802, lng: 120.313443 }, // Mission Library
  6:  { lat: 16.636110, lng: 120.313369 }, // Fr. Burgos Gymnasium — verified anchor
  7:  { lat: 16.636164, lng: 120.313630 }, // ICT Center
  8:  { lat: 16.636562, lng: 120.313948 }, // New Building (C)
  9:  { lat: 16.637145, lng: 120.313920 }, // New Elem Bldg
  10: { lat: 16.637480, lng: 120.313833 }, // SLC Canteen
  11: { lat: 16.637739, lng: 120.313819 }, // Old Elem (E)
  12: { lat: 16.638038, lng: 120.313798 }, // Sports Center
  13: { lat: 16.637693, lng: 120.313277 }, // SHS Dept Bldg
  14: { lat: 16.637518, lng: 120.313215 }, // HM Lab Bldg
  15: { lat: 16.636268, lng: 120.312908 }, // Main Parking Area
  16: { lat: 16.636311, lng: 120.313174 }, // SAO Lobby
};

const SLC_CSC_BUILDINGS = [
  { id: 1, name: "Grandstand Guardhouse", shortName: "Guardhouse", num: "1", labelX: 332, labelY: 377, type: "Facility" },
  { id: 2, name: "(V) Verbist Building", shortName: "Verbist Bldg", num: "2", labelX: 195, labelY: 430, type: "Academic" },
  { id: 3, name: "Transfiguration of the Lord Chapel", shortName: "SLC Chapel", num: "3", labelX: 202, labelY: 290, type: "Religious" },
  { id: 4, name: "Fr. Alfred Spincemaille, CICM (Admin Bldg)", shortName: "Admin Bldg", num: "4", labelX: 452, labelY: 262, type: "Administrative" },
  { id: 5, name: "Gerard De Boeck Mission Library", shortName: "Mission Library", num: "5", labelX: 452, labelY: 180, type: "Academic" },
  { id: 6, name: "Fr. Burgos Gymnasium", shortName: "Burgos Gym", num: "6", labelX: 667, labelY: 255, type: "Sports" },
  { id: 7, name: "(B) ICT Center", shortName: "ICT Center", num: "7", labelX: 670, labelY: 192, type: "Academic" },
  { id: 8, name: "(C) New Building", shortName: "New Building (C)", num: "8", labelX: 540, labelY: 65, type: "Academic" },
  { id: 9, name: "New Elementary Building", shortName: "New Elem Bldg", num: "9", labelX: 340, labelY: 55, type: "Academic" },
  { id: 10, name: "SLC Canteen", shortName: "SLC Canteen", num: "10", labelX: 235, labelY: 67, type: "Dining" },
  { id: 11, name: "(E) Bishop Wenceslao Padilla, CICM (Old Elem)", shortName: "Old Elem (E)", num: "11", labelX: 170, labelY: 65, type: "Academic" },
  { id: 12, name: "Conrado Dela Cruz Sports Center", shortName: "Sports Center", num: "12", labelX: 80, labelY: 40, type: "Sports" },
  { id: 13, name: "Fr. Roger Bruno Eduard Tjolle, CICM (SHS Bldg)", shortName: "SHS Dept Bldg", num: "13", labelX: 125, labelY: 205, type: "Academic" },
  { id: 14, name: "Rev. Fr. Clement Daelman, CICM (HM Lab)", shortName: "HM Lab Bldg", num: "14", labelX: 122, labelY: 255, type: "Academic" },
  { id: 15, name: "Main Parking Area", shortName: "Parking Area", num: "15", labelX: 475, labelY: 352, type: "Facility" },
  { id: 16, name: "SAO Lobby", shortName: "SAO Lobby", num: "16", labelX: 592, labelY: 250, type: "Administrative" }
];

// Turns a building's old schematic (labelX, labelY) into a lat/lng near
// CAMPUS_CENTER, unless a real coordinate has been provided above.
function getBuildingCoords(building) {
  if (REAL_COORDINATES[building.id]) return REAL_COORDINATES[building.id];

  const dx = building.labelX - 390; // 390 ≈ half of the old 780-wide viewBox
  const dy = building.labelY - 250; // 250 ≈ half of the old 500-tall viewBox

  return {
    lat: CAMPUS_CENTER.lat - dy * COORD_SCALE, // SVG y grows downward; latitude grows northward, so subtract
    lng: CAMPUS_CENTER.lng + dx * COORD_SCALE,
  };
}

const getHotspotColor = (count) => {
  if (count >= 5) return '#ef4444'; // Red (High Hotspot)
  if (count >= 3) return '#f97316'; // Orange (Medium Hotspot)
  if (count >= 1) return '#eab308'; // Yellow (Low Hotspot)
  return '#22c55e';                 // Green (0 Reports / Safe)
};

// Finds the single best-matching building id for a raw location string.
// Rather than "last substring match wins" (which could silently overwrite
// a good match with a worse one further down the list), this scores every
// building candidate and picks the longest/most specific match — falling
// back to Admin Bldg (id 4) only when nothing matches at all, and making
// that fallback explicit via `matched: false` so callers/analytics can
// tell "really at Admin" apart from "unrecognized location".
function matchBuildingId(rawLocation) {
  const locStr = (rawLocation || '').toLowerCase().trim();
  if (!locStr) return { id: 4, matched: false };

  let best = null; // { id, score }

  SLC_CSC_BUILDINGS.forEach((b) => {
    const candidates = [
      b.shortName.toLowerCase(),
      b.name.toLowerCase(),
      `building ${b.num}`,
      `#${b.num}`,
    ];

    candidates.forEach((candidate) => {
      if (candidate && locStr.includes(candidate)) {
        // Prefer the longest matching candidate string — longer matches
        // are more specific (e.g. "hm lab bldg" beats a bare "#1" match).
        const score = candidate.length;
        if (!best || score > best.score) {
          best = { id: b.id, score };
        }
      }
    });
  });

  return best ? { id: best.id, matched: true } : { id: 4, matched: false };
}

// Fits the map's viewport to whatever markers currently exist, once on
// mount (and whenever the marker set changes size).
const FitToMarkers = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 17);
      return;
    }
    const bounds = points.map((p) => [p.lat, p.lng]);
    map.fitBounds(bounds, { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);

  return null;
};

const HotspotMap = ({ items = [] }) => {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  const buildingStats = useMemo(() => {
    const map = {};

    SLC_CSC_BUILDINGS.forEach((b) => {
      map[b.id] = {
        ...b,
        ...getBuildingCoords(b),
        total: 0,
        lost: 0,
        surrendered: 0,
        claimed: 0,
        items: []
      };
    });

    items.forEach((item) => {
      const { id: matchedId } = matchBuildingId(item.location);

      if (map[matchedId]) {
        map[matchedId].total += 1;
        map[matchedId].items.push(item);
        if (item.type === 'Lost') map[matchedId].lost += 1;
        if (item.type === 'Surrendered') map[matchedId].surrendered += 1;
        if (item.status === 'Claimed') map[matchedId].claimed += 1;
      }
    });

    return map;
  }, [items]);

  const markerPoints = useMemo(
    () => Object.values(buildingStats).map((b) => ({ lat: b.lat, lng: b.lng })),
    [buildingStats]
  );

  const sortedStats = useMemo(() => {
    return Object.values(buildingStats).sort((a, b) => b.lost - a.lost);
  }, [buildingStats]);

  const topHotspot = sortedStats.find((l) => l.lost > 0);
  const topHotspotLabel = topHotspot ? `#${topHotspot.num} ${topHotspot.shortName}` : 'None';

  const selectedStat = selectedBuilding ? buildingStats[selectedBuilding.id] : null;

  return (
    <div className="bg-white w-full rounded-3xl border border-slate-200/80 p-6 shadow-sm relative flex flex-col justify-between">
      {/* Small inline styles for Leaflet marker labels & popups, since this
          is a single-file component with no separate stylesheet. */}
      <style>{`
        .building-marker-label {
          background: transparent;
          border: none;
          box-shadow: none;
          color: #ffffff;
          font-weight: 900;
          font-size: 11px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.6);
        }
        .building-marker-label::before { display: none; }
        .building-roof-label {
          background: transparent;
          border: none;
          box-shadow: none;
          pointer-events: none;
        }
        .building-roof-label::before { display: none; }
        .building-roof-label-text {
          color: #ffffff;
          font-weight: 800;
          font-size: 11px;
          line-height: 1.2;
          text-align: center;
          text-shadow:
            -1px -1px 0 rgba(0,0,0,0.85),
             1px -1px 0 rgba(0,0,0,0.85),
            -1px  1px 0 rgba(0,0,0,0.85),
             1px  1px 0 rgba(0,0,0,0.85),
             0 1px 3px rgba(0,0,0,0.6);
          white-space: nowrap;
        }
        .slc-landmark-icon { background: transparent; border: none; }
        .leaflet-container { font-family: inherit; }
      `}</style>

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0B6FA4] flex items-center gap-1.5">
              <FaUniversity size={12} /> Campus Hotspot Map
            </h3>
            <p className="text-xs font-bold text-slate-800 mt-0.5">
              Saint Louis College
            </p>
          </div>

          <div className="rounded-full bg-rose-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 flex items-center gap-1.5 shrink-0 border border-rose-100">
            <FaCrosshairs size={10} className="animate-pulse" />
            Hotspot: {topHotspotLabel}
          </div>
        </div>

        {/* Leaflet Map Container */}
        <div className="mt-4 relative z-0 w-full h-[580px] bg-[#f8fafc] rounded-2xl overflow-hidden border border-slate-300/80 shadow-inner">
          <MapContainer
            center={[CAMPUS_CENTER.lat, CAMPUS_CENTER.lng]}
            zoom={17}
            zoomControl={false}
            scrollWheelZoom
            style={{ width: '100%', height: '100%' }}
          >
            {/* Satellite base layer (Esri World Imagery — free, no API key)
                so buildings show as real rooftops, like Google's satellite
                view, instead of an OSM street map. */}
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            {/* Thin label/road overlay on top of the imagery, so street
                names still read the way they do in Google's hybrid view. */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              opacity={0.9}
            />
            <ZoomControl position="topright" />
            <FitToMarkers points={markerPoints} />

            {/* Clearly labeled campus landmark pin — verified against
                Google Places and the school's published coordinates. */}
            <Marker position={[SLC_LANDMARK.lat, SLC_LANDMARK.lng]} icon={slcIcon}>
              <LeafletTooltip direction="top" offset={[0, -20]}>
                {SLC_LANDMARK.name}
              </LeafletTooltip>
              <Popup>
                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  {SLC_LANDMARK.name}
                  <br />
                  <span style={{ fontWeight: 400, color: '#64748b' }}>
                    {SLC_LANDMARK.subtitle}
                  </span>
                  <br />
                  <a
                    href={SLC_LANDMARK.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#0B6FA4', fontWeight: 700 }}
                  >
                    Open in Google Maps →
                  </a>
                </div>
              </Popup>
            </Marker>

            {Object.values(buildingStats).map((b) => {
              const buildingFillColor = getHotspotColor(b.total);
              const isSelected = selectedBuilding?.id === b.id;

              return (
                <React.Fragment key={`bldg-${b.id}`}>
                  {/* Numbered dot — click for the full stats modal */}
                  <CircleMarker
                    center={[b.lat, b.lng]}
                    radius={isSelected ? 16 : 13}
                    pathOptions={{
                      fillColor: buildingFillColor,
                      fillOpacity: 0.9,
                      color: isSelected ? '#000000' : '#ffffff',
                      weight: isSelected ? 3 : 1.5,
                    }}
                    eventHandlers={{
                      click: () => setSelectedBuilding(b),
                    }}
                  >
                    <LeafletTooltip
                      permanent
                      direction="center"
                      className="building-marker-label"
                    >
                      {b.num}
                    </LeafletTooltip>
                  </CircleMarker>

                  {/* Always-on rooftop label, like Google's satellite
                      building labels — sits just above the dot so the
                      name reads directly on the roof. */}
                  <Marker
                    position={[b.lat, b.lng]}
                    icon={L.divIcon({
                      className: 'building-roof-label',
                      html: `<div class="building-roof-label-text">${b.shortName}</div>`,
                      iconSize: [0, 0],
                      iconAnchor: [-14, 26],
                    })}
                    interactive={false}
                  />
                </React.Fragment>
              );
            })}
          </MapContainer>

          {/* Footer Legend */}
          <div className="absolute bottom-2 left-3 right-3 flex justify-between items-center text-[9px] text-slate-700 font-bold bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-sm pointer-events-none z-[1000]">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> No Reports (0)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" /> Low Hotspot (1-2)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" /> Mild (3-4)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> High (5+)</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-black">Building pins are approximate — see REAL_COORDINATES</span>
            </span>
          </div>
        </div>
      </div>

      {/* Details Modal — this is where clicking a building shows how many
          items were reported Lost, how many were Surrendered/Found, and
          how many have been Claimed at that location, plus the underlying
          list of items. */}
      {selectedBuilding && selectedStat && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 relative"
          >
            <button
              onClick={() => setSelectedBuilding(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
            >
              <FaTimes size={14} />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <span
                className="w-12 h-12 rounded-2xl text-white font-black text-xl flex items-center justify-center shadow-md shrink-0"
                style={{ backgroundColor: getHotspotColor(selectedStat.total) }}
              >
                {selectedBuilding.num}
              </span>
              <div>
                <h4 className="font-bold text-slate-900 text-base leading-tight">
                  {selectedBuilding.name}
                </h4>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                  {selectedBuilding.type}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 my-4">
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-center">
                <span className="block text-2xl font-black text-rose-600">
                  {selectedStat.lost}
                </span>
                <span className="text-[10px] uppercase font-extrabold text-rose-500 tracking-wider">
                  Lost
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
                <span className="block text-2xl font-black text-amber-600">
                  {selectedStat.surrendered}
                </span>
                <span className="text-[10px] uppercase font-extrabold text-amber-500 tracking-wider">
                  Found
                </span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                <span className="block text-2xl font-black text-emerald-600">
                  {selectedStat.claimed}
                </span>
                <span className="text-[10px] uppercase font-extrabold text-emerald-500 tracking-wider">
                  Claimed
                </span>
              </div>
            </div>

            <div className="mt-5">
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <FaBoxOpen size={13} className="text-slate-400" />
                Reported Items ({selectedStat.items.length})
              </h5>

              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {selectedStat.items.length > 0 ? (
                  selectedStat.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FaTag className="text-slate-400 shrink-0" size={10} />
                        <span className="font-semibold text-slate-800">{item.title || item.name || "Item"}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        item.type === 'Lost' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No items reported at this location.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ================= CLAIM SCHEDULE CALENDAR =================

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const dateKeyFor = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const ClaimScheduleCalendar = ({ claims }) => {
  const [current, setCurrent] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const year = current.getFullYear();
  const month = current.getMonth();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthLabel = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const today = new Date();
  const todayKey = dateKeyFor(today.getFullYear(), today.getMonth(), today.getDate());

  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  // Only claims a moderator/admin explicitly scheduled via
  // ClaimRequests.jsx's "Continue to Schedule" → "Confirm Schedule" flow
  // count toward this calendar — see isStaffConfirmedSchedule above.
  // Claimant self-picked slots (matched-answer submissions from
  // ClaimModal.jsx) are excluded even though they also carry a
  // meeting_date/meeting_time.
  const staffConfirmedClaims = useMemo(
    () => claims.filter(isStaffConfirmedSchedule),
    [claims]
  );

  const scheduleByDate = useMemo(() => {
    const map = {};

    staffConfirmedClaims.forEach((claim) => {
      const scheduled = getScheduleDate(claim);
      if (!scheduled) return;

      const key = dateKeyFor(scheduled.getFullYear(), scheduled.getMonth(), scheduled.getDate());
      if (!map[key]) map[key] = [];
      map[key].push(claim);
    });

    return map;
  }, [staffConfirmedClaims]);

  const totalScheduled = Object.values(scheduleByDate).reduce(
    (sum, entries) => sum + entries.length,
    0
  );

  const goPrev = () => {
    setCurrent(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const goNext = () => {
    setCurrent(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const handleDateClick = (key) => {
    setSelectedDate(key);
    setIsModalOpen(true);
  };

  const scheduledForSelected = selectedDate
    ? [...(scheduleByDate[selectedDate] || [])].sort((a, b) => {
        const timeA = getScheduleDate(a)?.getTime() || 0;
        const timeB = getScheduleDate(b)?.getTime() || 0;
        return timeA - timeB;
      })
    : [];

  return (
    <div className="bg-white w-full lg:w-1/2 rounded-3xl border border-slate-200/80 p-6 shadow-sm relative flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">
              Claim Schedule
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Claimants booked for verification meetings
            </p>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-1.5 shrink-0">
            <FaUserClock size={10} />
            {totalScheduled} Scheduled
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={goPrev}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <FaChevronLeft size={12} />
          </button>

          <span className="text-xs font-black uppercase tracking-wide text-slate-700">
            {monthLabel}
          </span>

          <button
            onClick={goNext}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <FaChevronRight size={12} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((d, i) => (
            <span key={i} className="text-[9px] font-black text-slate-300 uppercase py-1">
              {d}
            </span>
          ))}

          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;

            const key = dateKeyFor(year, month, day);
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            const count = (scheduleByDate[key] || []).length;

            return (
              <button
                key={idx}
                onClick={() => handleDateClick(key)}
                className={`
                  relative aspect-square rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5
                  transition-all
                  ${isSelected ? 'bg-[#2D366D] text-white shadow-md' : isToday ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}
                `}
              >
                <span>{day}</span>
                {count > 0 && (
                  <span
                    className={`
                      text-[9px] leading-none font-black px-1.5 py-0.5 rounded-full
                      ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}
                    `}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* MODAL PREVIEW FOR SCHEDULES ON SELECTED DATE */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-[#0B6B8A] flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl">
                  <FaCalendarAlt size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">
                    {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    {scheduledForSelected.length} {scheduledForSelected.length === 1 ? 'Meeting Scheduled' : 'Meetings Scheduled'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <FaTimes size={14} />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 bg-slate-50/50">
              {scheduledForSelected.length > 0 ? (
                scheduledForSelected.map((claim, idx) => (
                  <div
                    key={claim.id || idx}
                    className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-800 truncate">
                          {claimantLabel(claim)}
                        </h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {claim.claimant_email || 'No email provided'}
                        </p>
                      </div>

                      <span className="shrink-0 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-bold px-3 py-1 rounded-full">
                        <FaClock size={11} />
                        {claim.meeting_time || 'Time set'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Contact</span>
                        <span className="font-semibold text-slate-700">{claim.claimant_contact || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Claim ID</span>
                        <span className="font-semibold text-slate-700">#{claim.id || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <FaUserClock size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">No Meetings Scheduled</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    There are no claimant verification meetings set for this day.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ================= MAIN DASHBOARD =================

const Dashboard = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [claims, setClaims] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchItems();
    fetchUsers();
    fetchClaims();
    fetchLogs();

    const interval = setInterval(() => {
      fetchItems();
      fetchUsers();
      fetchClaims();
      fetchLogs();
    }, 5000);

    const handleUpdate = () => fetchLogs();
    window.addEventListener(ACTIVITY_LOG_UPDATE_EVENT, handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener(ACTIVITY_LOG_UPDATE_EVENT, handleUpdate);
    };
  }, []);

  async function fetchItems() {
    try {
      const data = await getItems();
      setItems(data || []);
    } catch (error) {
      console.error('Fetching of items error: ', error);
    }
  }

  async function fetchUsers() {
    try {
      const data = await getUsers();
      setUsers(data || []);
    } catch (error) {
      console.error('Fetching of users error: ', error);
    }
  }

  async function fetchClaims() {
    try {
      const data = await getClaims();
      setClaims(data || []);
    } catch (error) {
      console.error('Fetching of claims error: ', error);
    }
  }

  async function fetchLogs() {
    try {
      const data = await getActivityLogsLocal();
      setLogs(data || []);
    } catch (error) {
      console.error('Fetching of activity logs error: ', error);
    }
  }

  const totalLost = items.filter(i => i.type === 'Lost').length;
  const totalSurrendered = items.filter(i => i.type === 'Surrendered').length;
  const totalClaimed = items.filter(i => i.status === 'Claimed').length;
  const totalUsers = users.length;

  const locations = {};

  items.forEach(item => {
    if(item.type === "Lost"){
      locations[item.location] =
        (locations[item.location] || 0) + 1;
    }
  });

  const hotspot =
    Object.keys(locations).length > 0
    ? Object.keys(locations).reduce((a,b)=>
        locations[a] > locations[b] ? a : b
      )
    : "None";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans pb-10">
      {/* Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0B6FA4] to-[#0A5A8C] rounded-2xl p-5 text-white shadow-lg border border-blue-400/20">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-lg md:text-xl font-bold text-white mb-1">
              Dashboard
            </h2>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur rounded-lg p-3 flex-1 md:flex-none text-center min-w-fit">
              <p className="text-blue-200 text-[10px] font-semibold mb-0.5">Top SLC Hotspot</p>
              <p className="text-base font-bold text-white">{hotspot}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Lost Reports" count={totalLost} icon={FaExclamationCircle} color="text-rose-500" bgColor="bg-rose-50" description="Active unresolved reports" />
        <StatCard label="Surrendered Items" count={totalSurrendered} icon={FaCheckCircle} color="text-emerald-500" bgColor="bg-emerald-50" description="Awaiting identity match" />
        <StatCard label="Resolved Matches" count={totalClaimed} icon={FaBox} color="text-purple-500" bgColor="bg-purple-50" description="Successfully returned" />
        <StatCard label="System Operators" count={totalUsers} icon={FaUsers} color="text-indigo-500" bgColor="bg-indigo-50" description="Authorized active roles" />
      </div>

      {/* Main Content Grid: Leaflet Campus Map + Calendar */}
      <div className="flex flex-col lg:flex-row w-full gap-6">
        <HotspotMap items={items} />
        <ClaimScheduleCalendar claims={claims} />
      </div>
    </div>
  );
};

export default Dashboard;
