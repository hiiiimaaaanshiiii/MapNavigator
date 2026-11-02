import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Search, Navigation, MapPin, LocateFixed, Route, Clock3, Footprints, CarFront, Bike, X, Compass, ArrowUpRight } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const fallback = [28.6139, 77.2090];

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

function FitRoute({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions?.length) map.fitBounds(positions, { padding: [60, 60] });
  }, [positions, map]);
  return null;
}

function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatDuration(s) {
  const mins = Math.round(s / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins} min`;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState(null);
  const [mode, setMode] = useState("driving");
  const [activeTab, setActiveTab] = useState("search");

  const positions = useMemo(() => route?.geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || [], [route]);

  async function searchPlaces(event) {
    event?.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true); setError(""); setResults([]);
    try {
      const response = await fetch(`${API}/api/geocode?q=${encodeURIComponent(query)}&limit=6`);
      if (!response.ok) throw new Error((await response.json()).detail || "Search failed");
      setResults(await response.json());
    } catch (e) { setError(e.message || "Unable to search right now."); }
    finally { setBusy(false); }
  }

  function choosePlace(place) {
    setDestination(place);
    setResults([]);
    setQuery(place.name || place.display_name);
    setRoute(null);
    setActiveTab("route");
  }

  function useMyLocation() {
    setError("");
    if (!navigator.geolocation) { setError("Geolocation is not supported by this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      p => {
        const here = { name: "My location", lat: p.coords.latitude, lon: p.coords.longitude };
        setLocation(here); setOrigin(here);
      },
      () => setError("Location permission was denied or your location is unavailable."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function buildRoute() {
    if (!origin || !destination) { setError("Set both a starting point and a destination."); return; }
    setBusy(true); setError(""); setRoute(null);
    try {
      const response = await fetch(`${API}/api/route`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: { lat: origin.lat, lon: origin.lon }, destination: { lat: destination.lat, lon: destination.lon }, profile: mode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not calculate route");
      setRoute(data);
    } catch (e) { setError(e.message || "Route calculation failed."); }
    finally { setBusy(false); }
  }

  const center = location ? [location.lat, location.lon] : destination ? [destination.lat, destination.lon] : fallback;

  return <main className="app-shell">
    <aside className="sidebar">
      <header className="brand"><div className="brand-mark"><Compass size={22}/></div><div><strong>Map Navigator</strong><span>Explore without limits</span></div></header>
      <div className="tabs">
        <button className={activeTab === "search" ? "tab active" : "tab"} onClick={() => setActiveTab("search")}><Search size={16}/> Explore</button>
        <button className={activeTab === "route" ? "tab active" : "tab"} onClick={() => setActiveTab("route")}><Route size={16}/> Directions</button>
      </div>

      {activeTab === "search" ? <section className="panel">
        <p className="eyebrow">DISCOVER A PLACE</p>
        <h1>Where to next?</h1>
        <p className="muted">Search for a city, landmark or address.</p>
        <form className="search-box" onSubmit={searchPlaces}>
          <Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Try India Gate, New Delhi..." />
          {query && <button type="button" className="icon-btn" onClick={() => {setQuery("");setResults([])}}><X size={15}/></button>}
          <button className="search-submit" disabled={busy}><ArrowUpRight size={18}/></button>
        </form>
        <button className="location-button" onClick={useMyLocation}><LocateFixed size={17}/> Use my current location</button>
        {results.length > 0 && <div className="result-list">{results.map((p,i)=><button className="result" key={`${p.lat}-${p.lon}-${i}`} onClick={() => choosePlace(p)}><MapPin size={17}/><span><b>{p.name}</b><small>{p.display_name}</small></span></button>)}</div>}
        <div className="tip-card"><div className="tip-icon"><Compass size={19}/></div><div><b>Make every journey count</b><p>Find a place, choose your starting point and get a route in seconds.</p></div></div>
      </section> : <section className="panel">
        <p className="eyebrow">PLAN YOUR JOURNEY</p><h1>Get directions</h1><p className="muted">Choose your start and destination.</p>
        <div className="route-fields">
          <label><span className="field-dot start-dot"></span><input value={origin?.name || ""} placeholder="Starting point" onChange={e => setOrigin(e.target.value ? {...(origin||{}),name:e.target.value} : null)}/></label>
          <label><span className="field-dot end-dot"></span><input value={destination?.name || ""} placeholder="Destination (search Explore)" readOnly /></label>
        </div>
        <button className="location-button" onClick={useMyLocation}><LocateFixed size={17}/> Set start to my location</button>
        <p className="field-label">TRAVEL MODE</p>
        <div className="mode-picker">
          <button className={mode==="driving"?"mode selected":"mode"} onClick={()=>setMode("driving")}><CarFront size={18}/>Drive</button>
          <button className={mode==="cycling"?"mode selected":"mode"} onClick={()=>setMode("cycling")}><Bike size={18}/>Cycle</button>
          <button className={mode==="walking"?"mode selected":"mode"} onClick={()=>setMode("walking")}><Footprints size={18}/>Walk</button>
        </div>
        <button className="primary-btn" onClick={buildRoute} disabled={busy || !origin || !destination}>{busy ? "Finding route..." : "Find route"} <Navigation size={17}/></button>
        {route && <div className="route-summary"><div className="summary-stats"><div><b>{formatDistance(route.distance_m)}</b><small>Distance</small></div><div><b>{formatDuration(route.duration_s)}</b><small>Estimated time</small></div></div><h3>Route instructions</h3><div className="steps">{route.steps.slice(0,12).map((s,i)=><div className="step" key={i}><span>{i+1}</span><div><b>{s.instruction}</b><small>{s.road || "Continue"} · {formatDistance(s.distance_m)}</small></div></div>)}</div></div>}
      </section>}
      {error && <div className="error">{error}</div>}
      <footer>Map data © OpenStreetMap contributors <span>•</span> Routing by OSRM</footer>
    </aside>

    <section className="map-area">
      <div className="map-topbar"><div className="map-status"><span className="status-dot"></span> Live map <span className="map-divider">/</span> OpenStreetMap</div><button onClick={useMyLocation} className="map-locate"><LocateFixed size={17}/> Locate me</button></div>
      <MapContainer center={center} zoom={13} zoomControl={false} className="map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        {location && <Marker position={[location.lat,location.lon]} icon={markerIcon}><Popup>You are here</Popup></Marker>}
        {destination && <Marker position={[destination.lat,destination.lon]} icon={markerIcon}><Popup>{destination.display_name || destination.name}</Popup></Marker>}
        {origin && <Marker position={[origin.lat,origin.lon]} icon={markerIcon}><Popup>{origin.name || "Starting point"}</Popup></Marker>}
        {positions.length > 0 && <><Polyline positions={positions} pathOptions={{color:"#315ee8",weight:6,opacity:.88}}/><FitRoute positions={positions}/></>}
      </MapContainer>
      {!route && <div className="map-hint"><MapPin size={16}/> Search a destination to get started</div>}
      <div className="map-credit">Designed for exploration <span>·</span> Map Navigator</div>
    </section>
  </main>;
}
