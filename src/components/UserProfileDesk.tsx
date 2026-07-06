import React, { useState, useEffect } from "react";
import { User, Lock, Mail, Globe, MapPin, Trash2, Heart, Plus, Settings, Sliders, LogOut, CheckCircle, Database } from "lucide-react";
import { SavedLocation, UserRole, UnitType } from "../types";

interface UserProfileDeskProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  currentUnit: UnitType;
  onUnitChange: (unit: UnitType) => void;
  savedLocations: SavedLocation[];
  onSyncFavorites: () => void;
  onLocationSelect: (lat: number, lon: number, name: string) => void;
  userToken: string | null;
  onLoginSuccess: (token: string, user: any) => void;
  onLogout: () => void;
}

export default function UserProfileDesk({
  currentRole,
  onRoleChange,
  currentUnit,
  onUnitChange,
  savedLocations,
  onSyncFavorites,
  onLocationSelect,
  userToken,
  onLoginSuccess,
  onLogout
}: UserProfileDeskProps) {
  // Auth view toggles
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("Observer");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  // Favorites form
  const [favName, setFavName] = useState("");
  const [favLat, setFavLat] = useState("");
  const [favLon, setFavLon] = useState("");
  const [favNotes, setFavNotes] = useState("");

  // User Profile preferences state
  const [prefProvider, setPrefProvider] = useState<string>("consensus");
  const [prefTheme, setPrefTheme] = useState<"dark" | "light">("dark");
  const [profileData, setProfileData] = useState<any>(null);

  // Sync profile data if token changes
  useEffect(() => {
    if (userToken) {
      fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${userToken}` }
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) {
            setProfileData(data);
            if (data.preferences) {
              setPrefProvider(data.preferences.preferredProvider || "consensus");
              setPrefTheme(data.preferences.theme || "dark");
              onUnitChange(data.preferences.unit || "metric");
              onRoleChange(data.role || "Observer");
            }
          }
        })
        .catch(() => {});
    } else {
      setProfileData(null);
    }
  }, [userToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login credentials mismatch.");
      }

      onLoginSuccess(data.token, data.user);
      setAuthSuccess(`Secure node access authorized. Welcome, ${data.user.fullName}!`);
      // Clear forms
      setEmail("");
      setPassword("");
    } catch (err: any) {
      setAuthError(err.message || "Authentication error.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    if (!email || !password || !fullName) {
      setAuthError("All authentication variables must be declared.");
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role: selectedRole })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create security account.");
      }

      onLoginSuccess(data.token, data.user);
      setAuthSuccess("Security account provisioned! Synchronization active.");
      setIsRegistering(false);
      // Clear forms
      setEmail("");
      setPassword("");
      setFullName("");
    } catch (err: any) {
      setAuthError(err.message || "Registration error.");
    }
  };

  const handleUpdatePreferences = async (providerVal: string, unitVal: string, themeVal: "dark" | "light") => {
    if (!userToken) {
      setPrefProvider(providerVal);
      onUnitChange(unitVal as UnitType);
      setPrefTheme(themeVal);
      return;
    }

    try {
      const res = await fetch("/api/auth/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}`
        },
        body: JSON.stringify({
          preferredProvider: providerVal,
          unit: unitVal,
          theme: themeVal,
          role: currentRole
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPrefProvider(providerVal);
        onUnitChange(unitVal as UnitType);
        setPrefTheme(themeVal);
        setAuthSuccess("Profile synchronizer matched successfully.");
        // Re-sync profile
        const profileRes = await fetch("/api/auth/me", {
          headers: { "Authorization": `Bearer ${userToken}` }
        });
        const profileJson = await profileRes.json();
        setProfileData(profileJson);
      }
    } catch (e) {
      console.error("Preferences sync error:", e);
    }
  };

  const handleAddFavorite = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!favName || !favLat || !favLon) {
      setAuthError("All core coordinate parameters are required to index favorite grid.");
      return;
    }

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userToken ? { "Authorization": `Bearer ${userToken}` } : {})
        },
        body: JSON.stringify({
          name: favName,
          lat: parseFloat(favLat),
          lon: parseFloat(favLon),
          notes: favNotes,
          role: currentRole
        })
      });

      if (!res.ok) {
        throw new Error("Failed to index favorite station.");
      }

      // Clear Form
      setFavName("");
      setFavLat("");
      setFavLon("");
      setFavNotes("");
      onSyncFavorites();
      setAuthSuccess("Coordinate grid successfully added to favorites.");
    } catch (err: any) {
      setAuthError(err.message || "Favorite indexing error.");
    }
  };

  const handleDeleteFavorite = async (id: string) => {
    try {
      const res = await fetch(`/api/favorites/${id}`, {
        method: "DELETE",
        headers: userToken ? { "Authorization": `Bearer ${userToken}` } : {}
      });

      if (res.ok) {
        onSyncFavorites();
        setAuthSuccess("Station removed from favorites indices.");
      }
    } catch (err) {
      console.error("Delete favorite failed:", err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
      
      {/* COLUMN 1: SECURITY SYSTEM AUTHENTICATION */}
      <div className="glass p-6 rounded-2xl bg-slate-950/20 border border-slate-900 flex flex-col justify-between min-h-[460px]">
        {profileData ? (
          // Logged In view
          <div className="space-y-6">
            <div className="flex items-center gap-4.5">
              <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border-2 border-cyan-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                <User className="h-8.5 w-8.5 text-cyan-400" />
              </div>
              <div>
                <span className="text-[10px] text-cyan-400 font-mono font-bold tracking-widest uppercase">LOGGED IN NODE</span>
                <h3 className="text-lg font-extrabold text-white mt-0.5">{profileData.fullName}</h3>
                <p className="text-xs text-slate-400 font-mono">{profileData.email}</p>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-900/80">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500">SYSTEM CLEARANCE:</span>
                <span className="px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/25 rounded-md text-cyan-400 font-bold text-[10px]">
                  {profileData.role}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500">PERSISTENT DB SYNC:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px]">
                  <CheckCircle className="h-3.5 w-3.5" />
                  DURABLE CLOUD
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500">FAVORITES COUNT:</span>
                <span className="text-white font-medium font-mono">{savedLocations.length} grids</span>
              </div>
            </div>

            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 text-[10px] text-slate-400 leading-relaxed font-mono">
              Your preferences and telemetry coordinates are saved in the central persistent data system. They will reload across different sessions, browsers, or deployments.
            </div>

            <button
              onClick={onLogout}
              className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-slate-950 border border-rose-500/20 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sever Session Connection
            </button>
          </div>
        ) : (
          // Login Form
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Lock className="h-4.5 w-4.5 text-cyan-400" />
                {isRegistering ? "Register Security Profile" : "Security Gateway Access"}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                {isRegistering
                  ? "Index your meteorological credential matrix to initialize synchronized cloud storage data streams."
                  : "Input your credential matrix to synchronize telemetry saved favorites and display parameters."}
              </p>
            </div>

            {isRegistering && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Observer Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Chief Forecaster John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Observer Email Channel</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="name@meteor.intel"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Decryption Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {isRegistering && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Select Security Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-cyan-400 outline-none focus:border-cyan-500"
                >
                  <option value="Observer">Observer Mode (Basic Grid Display)</option>
                  <option value="Forecaster">Forecaster Mode (Advanced Analysis Graphs)</option>
                  <option value="Meteorologist">Meteorologist Mode (Crisis Sirens Authorized)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-cyan-500/10"
            >
              {isRegistering ? "Assemble Profile Database" : "Verify Security Gateway"}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setAuthError("");
                  setAuthSuccess("");
                }}
                className="text-[10px] text-cyan-400 hover:underline font-mono"
              >
                {isRegistering
                  ? "Already have an observer clearance? Sign in"
                  : "Request new meteorologist registration clearance"}
              </button>
            </div>
          </form>
        )}

        {/* Status feedbacks */}
        {(authError || authSuccess) && (
          <div className="mt-4 pt-3 border-t border-slate-900 font-mono text-[9px] leading-relaxed">
            {authError && <p className="text-rose-400 flex items-center gap-1">⚠ {authError}</p>}
            {authSuccess && <p className="text-emerald-400 flex items-center gap-1">✔ {authSuccess}</p>}
          </div>
        )}
      </div>

      {/* COLUMN 2: CUSTOMIZE COGNITIVE METEOROLOGICAL PREFERENCES */}
      <div className="glass p-6 rounded-2xl bg-slate-950/20 border border-slate-900 flex flex-col justify-between min-h-[460px]">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Settings className="h-4.5 w-4.5 text-cyan-400" />
            Telemetry Customization
          </h3>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
            Fine-tune core rendering standards, data calculation systems, and telemetry providers used to resolve synoptic calculations.
          </p>
        </div>

        <div className="space-y-5 my-6 flex-grow">
          {/* Preferred Weather Source Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase flex items-center justify-between">
              <span>Meteorological Provider Strategy</span>
              <span className="text-[9px] text-cyan-400 font-bold">MULTI-API INTEGRATION</span>
            </label>
            <select
              value={prefProvider}
              onChange={(e) => handleUpdatePreferences(e.target.value, currentUnit, prefTheme)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-cyan-500 font-mono"
            >
              <option value="consensus">Multi-API Consensus Ensemble (Average)</option>
              <option value="open-meteo">Open-Meteo IFS (Live Global)</option>
              <option value="noaa">NOAA NWS / GFS (Live US / Global GFS)</option>
              <option value="tomorrow-io">Tomorrow.io Engine (High-Resolution Radar)</option>
              <option value="weather-api">WeatherAPI Cloud Stream (Micro-Climate)</option>
              <option value="open-weather-map">OpenWeatherMap Core (Global Standard)</option>
            </select>
          </div>

          {/* Unit selection toggler */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Atmospheric Units System</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleUpdatePreferences(prefProvider, "metric", prefTheme)}
                className={`py-2 px-3 text-xs rounded-xl font-mono transition-all border ${
                  currentUnit === "metric"
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/35 font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Metric (°C, km/h, mm)
              </button>
              <button
                type="button"
                onClick={() => handleUpdatePreferences(prefProvider, "imperial", prefTheme)}
                className={`py-2 px-3 text-xs rounded-xl font-mono transition-all border ${
                  currentUnit === "imperial"
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/35 font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Imperial (°F, mph, in)
              </button>
            </div>
          </div>

          {/* Visual theme selection toggler */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Visual Layout Theme</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleUpdatePreferences(prefProvider, currentUnit, "dark")}
                className={`py-2 px-3 text-xs rounded-xl font-mono transition-all border ${
                  prefTheme === "dark"
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/35 font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Carbon (Dark Canvas)
              </button>
              <button
                type="button"
                onClick={() => handleUpdatePreferences(prefProvider, currentUnit, "light")}
                className={`py-2 px-3 text-xs rounded-xl font-mono transition-all border ${
                  prefTheme === "light"
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/35 font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Ice Blue (Light Canvas)
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 text-[9px] text-slate-500 leading-relaxed font-mono">
          <Database className="h-3.5 w-3.5 text-purple-400 inline mr-1.5" />
          The platform operates on a resilient active-active routing architecture. Changing the provider dynamically queries the appropriate proxy server, ensuring uninterrupted synoptic coverage.
        </div>
      </div>

      {/* COLUMN 3: FAVORITE SAVED GEOLOGICAL STATIONS */}
      <div className="glass p-6 rounded-2xl bg-slate-950/20 border border-slate-900 flex flex-col justify-between min-h-[460px]">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Heart className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
            Saved Operational Stations
          </h3>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
            Pin specialized regional coordinate ranges to display quick action synoptic grids instantly on the header deck.
          </p>
        </div>

        {/* Favorites list */}
        <div className="flex-grow my-4 max-h-[180px] overflow-y-auto space-y-2 pr-1.5 scrollbar-thin">
          {savedLocations.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-4">
              <p className="text-[10px] text-slate-500 font-mono">No favorite locations indexed yet.</p>
            </div>
          ) : (
            savedLocations.map((loc) => (
              <div
                key={loc.id}
                className="p-2 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-850/50 rounded-xl flex items-center justify-between transition-all"
              >
                <button
                  type="button"
                  onClick={() => onLocationSelect(loc.lat, loc.lon, loc.name)}
                  className="flex-grow text-left flex flex-col min-w-0"
                >
                  <span className="text-xs text-white font-semibold truncate">{loc.name}</span>
                  <span className="text-[9px] text-slate-500 font-mono truncate">
                    Lat: {loc.lat}° | Lon: {loc.lon}° • {loc.notes}
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteFavorite(loc.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all ml-2"
                  title="Remove Station Grid"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add New Favorite Form */}
        <form onSubmit={handleAddFavorite} className="space-y-3 pt-3 border-t border-slate-900/80">
          <div className="flex items-center gap-1">
            <Plus className="h-4 w-4 text-cyan-400" />
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Save Current Target coordinates</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              placeholder="Tokyo Port"
              value={favName}
              onChange={(e) => setFavName(e.target.value)}
              className="col-span-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <input
              type="number"
              step="any"
              required
              placeholder="Latitude (35.6)"
              value={favLat}
              onChange={(e) => setFavLat(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <input
              type="number"
              step="any"
              required
              placeholder="Longitude (139.6)"
              value={favLon}
              onChange={(e) => setFavLon(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <input
              type="text"
              placeholder="Tsunami Alert Station Comments"
              value={favNotes}
              onChange={(e) => setFavNotes(e.target.value)}
              className="col-span-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-semibold rounded-lg transition-all"
          >
            Index Coordinate grid
          </button>
        </form>
      </div>

    </div>
  );
}
