import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  FaUniversity, 
  FaSearch, 
  FaFilter, 
  FaUndoAlt, 
  FaBoxOpen, 
  FaTag, 
  FaTimes,
  FaExclamationCircle
} from 'react-icons/fa';

// Saint Louis College, San Fernando, La Union Coordinates (~16.6159, 120.3209)
const CAMPUS_CENTER = [16.6159, 120.3209];

// Campus Buildings with Geographical Boundaries (Lat/Lng)
const SLC_BUILDINGS = [
  {
    id: 1,
    name: "Admin Building (Fr. Alfred Spincemaille)",
    shortName: "Admin Bldg",
    num: "4",
    type: "Administrative",
    coordinates: [16.6162, 120.3212],
    polygon: [
      [16.6163, 120.3210],
      [16.6164, 120.3214],
      [16.6160, 120.3215],
      [16.6160, 120.3211]
    ]
  },
  {
    id: 2,
    name: "Gerard De Boeck Mission Library",
    shortName: "Mission Library",
    num: "5",
    type: "Academic",
    coordinates: [16.6165, 120.3210],
    polygon: [
      [16.6166, 120.3208],
      [16.6167, 120.3212],
      [16.6164, 120.3213],
      [16.6163, 120.3209]
    ]
  },
  {
    id: 3,
    name: "Fr. Burgos Gymnasium",
    shortName: "Burgos Gym",
    num: "6",
    type: "Sports",
    coordinates: [16.6158, 120.3218],
    polygon: [
      [16.6160, 120.3216],
      [16.6161, 120.3220],
      [16.6156, 120.3221],
      [16.6155, 120.3217]
    ]
  },
  {
    id: 4,
    name: "SHS Department Building",
    shortName: "SHS Dept",
    num: "13",
    type: "Academic",
    coordinates: [16.6153, 120.3204],
    polygon: [
      [16.6155, 120.3201],
      [16.6156, 120.3207],
      [16.6151, 120.3208],
      [16.6150, 120.3202]
    ]
  },
  {
    id: 5,
    name: "SLC Canteen",
    shortName: "Canteen",
    num: "10",
    type: "Dining",
    coordinates: [16.6168, 120.3202],
    polygon: [
      [16.6170, 120.3200],
      [16.6171, 120.3204],
      [16.6166, 120.3205],
      [16.6165, 120.3201]
    ]
  }
];

const DEFAULT_SAMPLE_ITEMS = [
  { id: '1', title: 'Blue Hydroflask 32oz', location: 'Canteen', type: 'Lost', status: 'Unclaimed', date: '2026-08-28' },
  { id: '2', title: 'Scientific Calculator fx-991EX', location: 'SHS Dept', type: 'Lost', status: 'Unclaimed', date: '2026-08-27' },
  { id: '3', title: 'Black Leather Wallet', location: 'SHS Dept', type: 'Surrendered', status: 'Unclaimed', date: '2026-08-26' },
  { id: '4', title: 'Car Keys (Toyota)', location: 'Admin Bldg', type: 'Lost', status: 'Unclaimed', date: '2026-08-29' },
  { id: '5', title: 'AirPods Pro Case', location: 'Admin Bldg', type: 'Lost', status: 'Unclaimed', date: '2026-08-25' },
  { id: '6', title: 'Denim Jacket', location: 'Burgos Gym', type: 'Surrendered', status: 'Claimed', date: '2026-08-24' },
  { id: '7', title: 'MacBook Charger 67W', location: 'Mission Library', type: 'Lost', status: 'Unclaimed', date: '2026-08-28' }
];

const CATEGORIES = ["All", "Academic", "Administrative", "Dining", "Sports"];

const getHotspotLevel = (count) => {
  if (count >= 4) return { color: '#ef4444', label: 'High Density', fillOpacity: 0.55 };
  if (count >= 2) return { color: '#f97316', label: 'Medium Density', fillOpacity: 0.45 };
  if (count >= 1) return { color: '#eab308', label: 'Low Density', fillOpacity: 0.35 };
  return { color: '#0B6FA4', label: 'Normal', fillOpacity: 0.25 };
};

// Custom Leaflet DivIcon Generator for Badges
const createCustomMarkerIcon = (num, count, levelColor) => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        background: #0f172a;
        border: 2px solid ${levelColor};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 800;
        font-size: 11px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      ">
        ${num}
        ${count > 0 ? `
          <span style="
            position: absolute;
            top: -4px;
            right: -4px;
            background: #ef4444;
            color: white;
            font-size: 9px;
            font-weight: 900;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1.5px solid #0f172a;
          ">${count}</span>
        ` : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// Map Recenter Controller
function MapController({ center, zoom }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function CampusLeafletMap({ items = DEFAULT_SAMPLE_ITEMS, onSelectItem }) {
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [zoomLevel] = useState(18);

  // Stats calculation
  const buildingStats = useMemo(() => {
    const stats = {};
    SLC_BUILDINGS.forEach((b) => {
      stats[b.id] = { ...b, total: 0, items: [] };
    });

    items.forEach((item) => {
      const loc = (item.location || '').toLowerCase();
      const match = SLC_BUILDINGS.find(
        (b) => loc.includes(b.shortName.toLowerCase()) || loc.includes(b.name.toLowerCase())
      );
      if (match && stats[match.id]) {
        stats[match.id].total += 1;
        stats[match.id].items.push(item);
      }
    });

    return stats;
  }, [items]);

  // Filtered Buildings
  const filteredBuildings = useMemo(() => {
    return SLC_BUILDINGS.filter((b) => {
      const matchesSearch = searchQuery === '' || 
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.num.includes(searchQuery);

      const matchesCat = activeCategory === 'All' || b.type === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [searchQuery, activeCategory]);

  return (
    <div className="w-full bg-slate-950 text-slate-100 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 font-sans">
      
      {/* HEADER BAR */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#0B6FA4]/20 text-[#0B6FA4] rounded-2xl border border-[#0B6FA4]/30">
            <FaUniversity size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Saint Louis College Leaflet Map</h2>
            <p className="text-xs text-slate-400">OpenStreetMap & GIS Hotspot Directory</p>
          </div>
        </div>

        <button
          onClick={() => {
            setSearchQuery('');
            setActiveCategory('All');
            setSelectedBuilding(null);
          }}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs text-slate-300 flex items-center gap-2 transition-colors self-end sm:self-auto"
        >
          <FaUndoAlt size={10} /> Reset Filters
        </button>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-64">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={11} />
          <input
            type="text"
            placeholder="Search building..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 text-xs text-white placeholder-slate-500 pl-8 pr-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-[#0B6FA4]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <FaFilter className="text-slate-500 mr-1 shrink-0" size={10} />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all shrink-0 ${
                activeCategory === cat
                  ? 'bg-[#0B6FA4] text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* LEAFLET CONTAINER */}
      <div className="relative w-full h-[500px]">
        <MapContainer
          center={CAMPUS_CENTER}
          zoom={zoomLevel}
          scrollWheelZoom={true}
          className="w-full h-full z-10"
        >
          <MapController center={CAMPUS_CENTER} zoom={zoomLevel} />

          {/* Dark Matter GIS Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={20}
          />

          {/* Render Building Polygons and Markers */}
          {filteredBuildings.map((b) => {
            const stat = buildingStats[b.id] || { total: 0, items: [] };
            const level = getHotspotLevel(stat.total);
            const isSelected = selectedBuilding?.id === b.id;

            return (
              <React.Fragment key={b.id}>
                {/* Building Footprint Polygon */}
                <Polygon
                  positions={b.polygon}
                  pathOptions={{
                    color: isSelected ? '#38bdf8' : level.color,
                    fillColor: level.color,
                    fillOpacity: isSelected ? 0.75 : level.fillOpacity,
                    weight: isSelected ? 3 : 1.5
                  }}
                  eventHandlers={{
                    click: () => setSelectedBuilding(b)
                  }}
                />

                {/* Building Badge Pin */}
                <Marker
                  position={b.coordinates}
                  icon={createCustomMarkerIcon(b.num, stat.total, level.color)}
                  eventHandlers={{
                    click: () => setSelectedBuilding(b)
                  }}
                >
                  <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
                    <div className="text-xs font-bold text-slate-900">
                      {b.name} ({stat.total} items)
                    </div>
                  </Tooltip>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* DETAILED SIDE MODAL OVERLAY */}
        {selectedBuilding && (
          <div className="absolute top-4 right-4 z-[500] w-80 bg-slate-900/95 border border-slate-700 backdrop-blur p-4 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-right duration-200">
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#0B6FA4] tracking-wider">
                  {selectedBuilding.type}
                </span>
                <h3 className="text-sm font-bold text-white leading-tight mt-0.5">
                  {selectedBuilding.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBuilding(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <FaTimes size={12} />
              </button>
            </div>

            <div className="my-3">
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                <FaBoxOpen className="text-[#0B6FA4]" />
                Logged Items ({buildingStats[selectedBuilding.id]?.items.length || 0})
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {buildingStats[selectedBuilding.id]?.items.length > 0 ? (
                  buildingStats[selectedBuilding.id].items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onSelectItem && onSelectItem(item)}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs flex justify-between items-center cursor-pointer"
                    >
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <FaTag size={9} className="text-slate-400" />
                          {item.title}
                        </div>
                        <span className="text-[10px] text-slate-500">{item.date}</span>
                      </div>
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                        item.type === 'Lost' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">No active logs for this location.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}