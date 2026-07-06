import React, { useState, useEffect } from "react";
import { 
  CloudSun, Map, Plane, ShieldAlert, Sparkles, AlertTriangle, 
  Settings, Loader2, Compass, Globe, Info, Activity, Radio,
  Menu, X, Database, Terminal, ShieldCheck, Key
} from "lucide-react";

import DashboardHeader from "./components/DashboardHeader";
import WeatherConsole from "./components/WeatherConsole";
import MeteorologicalMap from "./components/MeteorologicalMap";
import MarineAviationTerminal from "./components/MarineAviationTerminal";
import GeoHazardsTracker from "./components/GeoHazardsTracker";
import ClimateAIIntelligence from "./components/ClimateAIIntelligence";
import AlertCenter from "./components/AlertCenter";
import UserProfileDesk from "./components/UserProfileDesk";
import WeatherParticles from "./components/WeatherParticles";
import AuthorizationGateway from "./components/AuthorizationGateway";
import AdminKeysDesk from "./components/AdminKeysDesk";

import { WeatherData, SavedLocation, UserRole, UnitType } from "./types";

export default function App() {
  const [lat, setLat] = useState(20.4625);
  const [lon, setLon] = useState(85.8792);
  const [cityName, setCityName] = useState("Cuttack, India");
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>("Observer");
  const [currentUnit, setCurrentUnit] = useState<UnitType>("metric");
  // Authorization gateway states
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    const savedType = localStorage.getItem("met_auth_type");
    const savedExpiryStr = localStorage.getItem("met_auth_expiry");
    const savedToken = localStorage.getItem("met_intel_token");
    if (!savedType) return false;
    
    // Admin or user roles MUST have an accompanying token
    if (savedType === "admin" || savedType === "user") {
      return !!savedToken;
    }
    
    // Check key or guest expiry
    if (savedExpiryStr) {
      const expiry = parseFloat(savedExpiryStr);
      if (expiry > Date.now()) {
        return true;
      }
    }
    return false;
  });

  const [authType, setAuthType] = useState<"admin" | "user" | "guest" | "key" | null>(() => {
    return localStorage.getItem("met_auth_type") as any;
  });

  const [authExpiry, setAuthExpiry] = useState<number | null>(() => {
    const str = localStorage.getItem("met_auth_expiry");
    return str ? parseFloat(str) : null;
  });

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<"weather" | "gis" | "marine" | "geohazards" | "climate" | "alerts" | "config" | "keys">("weather");
  const [loading, setLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Authentication states
  const [userToken, setUserToken] = useState<string | null>(localStorage.getItem("met_intel_token"));

  // Running the ticking countdown interval for guest / key limited sessions
  useEffect(() => {
    if (!isAuthorized || !authExpiry || authExpiry === Infinity) {
      setTimeLeft(null);
      return;
    }

    const checkTime = () => {
      const diff = authExpiry - Date.now();
      if (diff <= 0) {
        setIsAuthorized(false);
        setAuthType(null);
        setAuthExpiry(null);
        setTimeLeft(null);
        localStorage.removeItem("met_auth_type");
        localStorage.removeItem("met_auth_expiry");
        localStorage.removeItem("met_intel_token");
        setUserToken(null);
        setCurrentRole("Observer");
        alert("Your access session has expired. Please unlock the platform with an Access Key or login.");
      } else {
        setTimeLeft(Math.ceil(diff / 1000));
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [isAuthorized, authExpiry]);

  // Periodically pulse the Access Key session to the server to decrement remaining seconds and verify validity
  useEffect(() => {
    if (!isAuthorized || authType !== "key" || !userToken) return;

    const pulseInterval = setInterval(() => {
      fetch("/api/auth/pulse-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: userToken })
      })
        .then(res => {
          if (!res.ok) {
            return res.json().then(err => { throw err; });
          }
          return res.json();
        })
        .then(data => {
          if (data.success) {
            if (data.remainingSeconds !== undefined && data.remainingSeconds >= 0) {
              const newExpiry = Date.now() + data.remainingSeconds * 1000;
              setAuthExpiry(newExpiry);
              localStorage.setItem("met_auth_expiry", newExpiry.toString());
            }
          }
        })
        .catch((err) => {
          console.error("Pulse validation error:", err);
          setUserToken(null);
          localStorage.removeItem("met_intel_token");
          localStorage.removeItem("met_auth_type");
          localStorage.removeItem("met_auth_expiry");
          setIsAuthorized(false);
          setAuthType(null);
          setAuthExpiry(null);
          setCurrentRole("Observer");
          alert(err.error || "Your Access Key session has ended.");
        });
    }, 5000); // Pulse every 5 seconds for precise active-time tracking

    return () => clearInterval(pulseInterval);
  }, [isAuthorized, authType, userToken]);

  const handleAuthSuccess = (type: "admin" | "user" | "guest" | "key", expiry: number, token?: string, role?: string) => {
    localStorage.setItem("met_auth_type", type);
    localStorage.setItem("met_auth_expiry", expiry.toString());
    
    if (token) {
      localStorage.setItem("met_intel_token", token);
      setUserToken(token);
    }

    if (role) {
      setCurrentRole(role as UserRole);
    } else {
      setCurrentRole("Observer");
    }

    setAuthType(type);
    setAuthExpiry(expiry);
    setIsAuthorized(true);
  };

  // Synchronize dynamic meteorological telemetry
  const fetchTelemetry = async (targetLat: number, targetLon: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/weather?lat=${targetLat}&lon=${targetLon}`);
      if (!res.ok) throw new Error("Telemetry hub down.");
      const data: WeatherData = await res.json();
      setWeatherData(data);
    } catch (error) {
      console.error("Telemetry fetch failure:", error);
    } finally {
      setLoading(false);
    }
  };

  // Sync Saved Locations
  const fetchFavorites = async () => {
    try {
      const headers: any = {};
      if (userToken) {
        headers["Authorization"] = `Bearer ${userToken}`;
      }
      const res = await fetch("/api/favorites", { headers });
      if (res.ok) {
        const data = await res.json();
        setSavedLocations(data);
      }
    } catch (error) {
      console.error("Failed to sync favorites:", error);
    }
  };

  // Check and sync user session on start
  useEffect(() => {
    if (userToken) {
      fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${userToken}` }
      })
        .then(res => res.json())
        .then(user => {
          if (!user.error) {
            setCurrentRole(user.role || "Observer");
            if (user.preferences) {
              setCurrentUnit(user.preferences.unit || "metric");
              setLat(user.preferences.defaultLat || 20.4625);
              setLon(user.preferences.defaultLon || 85.8792);
            }
          } else {
            // Token expired/invalid - clear full session state
            setUserToken(null);
            localStorage.removeItem("met_intel_token");
            localStorage.removeItem("met_auth_type");
            localStorage.removeItem("met_auth_expiry");
            setIsAuthorized(false);
            setAuthType(null);
            setAuthExpiry(null);
            setCurrentRole("Observer");
          }
        })
        .catch(() => {});
    }
  }, [userToken]);

  useEffect(() => {
    fetchTelemetry(lat, lon);
    fetchFavorites();
  }, [lat, lon, userToken]);

  // Handle global search queries with geocode suggestions
  const handleGlobalSearch = async (query: string) => {
    setLoading(true);
    try {
      // Use free high-speed OSM nominatim geocoder for global compliance
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(geocodeUrl);
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const matched = results[0];
          const targetLat = parseFloat(matched.lat);
          const targetLon = parseFloat(matched.lon);
          setLat(targetLat);
          setLon(targetLon);
          setCityName(matched.display_name.split(",")[0] + ", " + (matched.address?.country || "Unified Sector"));
          fetchTelemetry(targetLat, targetLon);
        } else {
          alert("Station coordinates not found. Rendering fallback grid.");
          setLoading(false);
        }
      }
    } catch (e) {
      console.error("Geocoding failed:", e);
      setLoading(false);
    }
  };

  // Dynamic selector for specific stations
  const handleLocationSelect = (selectedLat: number, selectedLon: number, name: string) => {
    setLat(selectedLat);
    setLon(selectedLon);
    setCityName(name);
  };

  if (!isAuthorized) {
    return <AuthorizationGateway onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans selection:bg-cyan-500/30 selection:text-cyan-300 overflow-hidden h-screen w-screen">
      
      {/* 1. Sleek Left Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-[1200] w-64 glass border-r border-slate-900/90 flex flex-col transition-transform duration-300 md:sticky md:h-screen md:translate-x-0 ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Sidebar Header with Branding */}
        <div className="p-6 border-b border-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <Globe className="h-5 w-5 text-cyan-400 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5 font-mono">
                METEOR<span className="text-cyan-400 text-[10px] font-bold px-1.5 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20">INTEL</span>
              </h1>
              <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase mt-0.5">PLATFORM v4.2</p>
            </div>
          </div>
          <button 
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 py-6 space-y-6 px-4 overflow-y-auto">
          {/* Observatory Link Items */}
          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-widest font-mono">Observatory</div>
            <div className="space-y-1">
              <button
                onClick={() => { setActiveTab("weather"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === "weather" 
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold border-l-2 border-cyan-400 pl-3.5 shadow-sm" 
                    : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                }`}
              >
                <CloudSun className="h-4 w-4" />
                Operational Desk
              </button>

              <button
                onClick={() => { setActiveTab("gis"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === "gis" 
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold border-l-2 border-cyan-400 pl-3.5 shadow-sm" 
                    : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                }`}
              >
                <Map className="h-4 w-4" />
                GIS Satellite Map
              </button>

              <button
                onClick={() => { setActiveTab("marine"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === "marine" 
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold border-l-2 border-cyan-400 pl-3.5 shadow-sm" 
                    : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                }`}
              >
                <Plane className="h-4 w-4" />
                Marine & Aviation
              </button>
            </div>
          </div>

          {/* Climate Analysis Link Items */}
          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-widest font-mono">Climate Analysis</div>
            <div className="space-y-1">
              <button
                onClick={() => { setActiveTab("climate"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === "climate" 
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold border-l-2 border-cyan-400 pl-3.5 shadow-sm" 
                    : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Climate AI Insights
              </button>

              <button
                onClick={() => { setActiveTab("geohazards"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === "geohazards" 
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold border-l-2 border-cyan-400 pl-3.5 shadow-sm" 
                    : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                }`}
              >
                <Activity className="h-4 w-4" />
                Global Geo-Hazards
              </button>

              <button
                onClick={() => { setActiveTab("alerts"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === "alerts" 
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold border-l-2 border-cyan-400 pl-3.5 shadow-sm" 
                    : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                Crisis Alerts
              </button>
            </div>
          </div>

          {/* Configuration Link Items */}
          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-widest font-mono">System Preferences</div>
            <div className="space-y-1">
              <button
                onClick={() => { setActiveTab("config"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === "config" 
                    ? "bg-cyan-500/10 text-cyan-400 font-semibold border-l-2 border-cyan-400 pl-3.5 shadow-sm" 
                    : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                }`}
              >
                <Settings className="h-4 w-4 animate-spin-slow" />
                Security & Config
              </button>

              {currentRole === "Admin" && (
                <button
                  onClick={() => { setActiveTab("keys"); setMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    activeTab === "keys" 
                      ? "bg-purple-500/10 text-purple-400 font-semibold border-l-2 border-purple-400 pl-3.5 shadow-sm" 
                      : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                  }`}
                >
                  <Key className="h-4 w-4 text-purple-400" />
                  Operational Key Desk
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Sidebar Footer metadata */}
        <div className="p-4 border-t border-slate-900/90 text-[10px] text-slate-500 font-mono space-y-2 bg-slate-950/20">
          <div className="flex items-center justify-between">
            <span>SYS_STATUS:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
              NOMINAL
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>REF MODEL:</span>
            <span className="text-slate-300 font-bold">ECMWF-HRES</span>
          </div>
          <div className="flex items-center justify-between">
            <span>CO2 RATE:</span>
            <span className="text-purple-400">424.1 PPM</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Space Panel on the Right */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        <WeatherParticles weatherData={weatherData} />

        {timeLeft !== null && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1250] px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-pulse">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest">
              {authType === "guest" ? "GUEST SESSION" : "ACCESS KEY PASS"}: {Math.floor(timeLeft / 60).toString().padStart(2, "0")}:{(timeLeft % 60).toString().padStart(2, "0")} REMAINING
            </span>
          </div>
        )}
        
        {/* Top Header bar styled with premium glassmorphism */}
        <div className="sticky top-0 z-[1100] flex items-center bg-slate-950/80 backdrop-blur-md border-b border-slate-900/90 px-4">
          <button 
            className="md:hidden p-2 mr-2 text-slate-400 hover:text-white hover:bg-slate-900/60 rounded-xl transition-all"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-grow">
            <DashboardHeader
              currentRole={currentRole}
              onRoleChange={setCurrentRole}
              currentUnit={currentUnit}
              onUnitChange={setCurrentUnit}
              onSearch={handleGlobalSearch}
              onLocationSelect={handleLocationSelect}
              savedLocations={savedLocations}
              cityName={cityName}
              lat={lat}
              lon={lon}
            />
          </div>
        </div>

        {/* Scrolling Workspace viewport */}
        <div className="flex-grow overflow-y-auto">
          
          <main className="max-w-7xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
            
            {/* Realtime Alert & Location Indicator strip */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl glass border border-slate-900/80">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Location Telemetry Grid</span>
                <span className="text-sm text-white font-semibold flex items-center gap-2">
                  <Compass className="h-4 w-4 text-cyan-400 animate-spin-slow" />
                  {cityName} — {lat.toFixed(4)}° N, {lon.toFixed(4)}° W
                </span>
              </div>
              <div className="h-px w-full sm:h-8 sm:w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Active Warnings Code</span>
                <span className="text-xs text-orange-400 font-bold flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-orange-500 rounded-full animate-ping" />
                  Sustained Air Velocity Front Established
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-white/5 font-mono text-[10px]">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                <span>LIVE_DATA_STREAM</span>
              </div>
            </div>

            {/* Primary workstation tabs render area */}
            <div className="flex-grow min-h-[500px]" id="met-main-stage">
              {loading ? (
                <div className="w-full h-[500px] glass rounded-2xl flex flex-col items-center justify-center text-center">
                  <Loader2 className="h-10 w-10 text-cyan-400 animate-spin mb-4" />
                  <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Syncing Global Telemetry Streams...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeTab === "weather" && (
                    <WeatherConsole 
                      weatherData={weatherData} 
                      unit={currentUnit} 
                      cityName={cityName} 
                      lat={lat}
                      lon={lon}
                    />
                  )}
                  {activeTab === "gis" && (
                    <div className="h-[550px] w-full">
                      <MeteorologicalMap 
                        lat={lat} 
                        lon={lon} 
                        weatherData={weatherData} 
                        onCoordinateChange={(newLat, newLon) => {
                          setLat(newLat);
                          setLon(newLon);
                        }} 
                      />
                    </div>
                  )}
                  {activeTab === "marine" && (
                    <MarineAviationTerminal 
                      weatherData={weatherData} 
                      lat={lat} 
                      lon={lon} 
                    />
                  )}
                  {activeTab === "geohazards" && (
                    <GeoHazardsTracker />
                  )}
                  {activeTab === "climate" && (
                    <ClimateAIIntelligence 
                      weatherData={weatherData} 
                      cityName={cityName} 
                    />
                  )}
                  {activeTab === "alerts" && (
                    <AlertCenter 
                      currentRole={currentRole} 
                      lat={lat} 
                      lon={lon} 
                    />
                  )}
                  {activeTab === "config" && (
                    <UserProfileDesk
                      currentRole={currentRole}
                      onRoleChange={setCurrentRole}
                      currentUnit={currentUnit}
                      onUnitChange={setCurrentUnit}
                      savedLocations={savedLocations}
                      onSyncFavorites={fetchFavorites}
                      onLocationSelect={handleLocationSelect}
                      userToken={userToken}
                      onLoginSuccess={(token, user) => {
                        setUserToken(token);
                        localStorage.setItem("met_intel_token", token);
                        const isSystemAdmin = user.email === "meet.arnesh@gmail.com";
                        const finalRole = isSystemAdmin ? "Admin" : (user.role || "Observer");
                        handleAuthSuccess(isSystemAdmin ? "admin" : "user", Infinity, token, finalRole);
                        if (user.preferences) {
                          setCurrentUnit(user.preferences.unit || "metric");
                          if (user.preferences.defaultLat) setLat(user.preferences.defaultLat);
                          if (user.preferences.defaultLon) setLon(user.preferences.defaultLon);
                        }
                        fetchFavorites();
                      }}
                      onLogout={async () => {
                        if (authType === "key" && userToken) {
                          try {
                            await fetch("/api/auth/logout-key", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ key: userToken })
                            });
                          } catch (e) {
                            console.error("Error pausing key session on logout:", e);
                          }
                        }
                        setUserToken(null);
                        localStorage.removeItem("met_intel_token");
                        localStorage.removeItem("met_auth_type");
                        localStorage.removeItem("met_auth_expiry");
                        setIsAuthorized(false);
                        setAuthType(null);
                        setAuthExpiry(null);
                        setCurrentRole("Observer");
                        fetchFavorites();
                      }}
                    />
                  )}
                  {activeTab === "keys" && (
                    <AdminKeysDesk 
                      userToken={userToken} 
                      currentRole={currentRole} 
                    />
                  )}
                </div>
              )}
            </div>

          </main>

          {/* Footer bar */}
          <footer className="bg-slate-950/90 border-t border-slate-900/90 py-5 px-6 mt-12" id="met-footer">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] font-mono text-slate-500">
              <p>© 2026 METEOR Weather Intelligence. All telemetry conforms to ISO/IEC and WMO standard codes.</p>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  SYSTEM NODE: ONLINE
                </span>
                <span>DATA SOURCE: MULTI-API CONSENSUS & GEMINI 3.5</span>
              </div>
            </div>
          </footer>
        </div>

      </div>

    </div>
  );
}
