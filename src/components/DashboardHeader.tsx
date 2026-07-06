import React, { useState } from "react";
import { Compass, Globe, Search, Eye, User, Landmark } from "lucide-react";
import { UserRole, UnitType, SavedLocation } from "../types";

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  currentUnit: UnitType;
  onUnitChange: (unit: UnitType) => void;
  onSearch: (query: string) => void;
  onLocationSelect: (lat: number, lon: number, name: string) => void;
  savedLocations: SavedLocation[];
  cityName?: string;
  lat?: number;
  lon?: number;
}

export default function DashboardHeader({
  currentRole,
  onRoleChange,
  currentUnit,
  onUnitChange,
  onSearch,
  onLocationSelect,
  savedLocations,
  cityName,
  lat,
  lon
}: HeaderProps) {
  const [searchVal, setSearchVal] = useState("");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      onSearch(searchVal);
    }
  };

  return (
    <div className="w-full py-4 flex flex-col gap-3.5" id="met-header">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand logo (only visible on mobile as it's in sidebar on desktop) */}
        <div className="flex items-center gap-3 md:hidden mr-auto">
          <div className="h-8.5 w-8.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Globe className="h-4.5 w-4.5 text-cyan-400 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 font-mono">
              METEOR <span className="text-cyan-400 text-[9px] font-semibold px-1 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20">INTEL</span>
            </h1>
          </div>
        </div>

        {/* Global Search form */}
        <form onSubmit={handleSearchSubmit} className="flex-grow max-w-lg w-full relative">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Query cities, coordinate arrays, or airport METAR identifiers..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-full pl-10 pr-24 py-2 bg-slate-900/60 border border-slate-850/50 rounded-xl text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:bg-slate-900/85 focus:ring-1 focus:ring-cyan-500/30 transition-all font-sans"
            />
            <button
              type="submit"
              className="absolute right-2 top-1.5 px-3 py-1 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-[10px] font-semibold rounded-lg transition-all"
            >
              Analyze
            </button>
          </div>
        </form>

        {/* Telemetry settings controls */}
        <div className="flex flex-wrap items-center gap-3 md:ml-auto">
          {/* Unit Toggle */}
          <div className="bg-slate-900/60 p-0.5 rounded-lg border border-slate-850/50 flex">
            <button
              onClick={() => onUnitChange("metric")}
              className={`px-2.5 py-1 rounded text-[9px] font-mono transition-all ${
                currentUnit === "metric" ? "bg-slate-800 text-cyan-400 font-semibold shadow-inner" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Metric
            </button>
            <button
              onClick={() => onUnitChange("imperial")}
              className={`px-2.5 py-1 rounded text-[9px] font-mono transition-all ${
                currentUnit === "imperial" ? "bg-slate-800 text-cyan-400 font-semibold shadow-inner" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Imperial
            </button>
          </div>

          {/* User Role Simulation dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="px-3 py-1.5 bg-slate-900/60 hover:bg-slate-900/80 border border-slate-850/50 rounded-xl text-xs text-slate-300 flex items-center gap-2 transition-all shadow-sm"
            >
              <User className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-mono text-[9px]">{currentRole} Mode</span>
            </button>
            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-slate-850/80 rounded-2xl shadow-2xl p-1.5 z-[1200] animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-3 py-2 border-b border-slate-900/80 mb-1">
                  <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">Select Security Role</p>
                </div>
                {((currentRole === "Admin" ? ["Observer", "Forecaster", "Meteorologist", "Admin"] : ["Observer", "Forecaster", "Meteorologist"]) as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      onRoleChange(r);
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center justify-between ${
                      currentRole === r ? "bg-cyan-500/10 text-cyan-400 font-semibold" : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                    }`}
                  >
                    {r} Mode
                    {r === "Meteorologist" && <Eye className="h-3.5 w-3.5 text-cyan-400" />}
                    {r === "Admin" && <Compass className="h-3.5 w-3.5 text-purple-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Core Status node badge */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/40 px-3 py-1.5 rounded-xl border border-slate-900/80 font-mono text-[10px] text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            WMO NODE
          </div>
        </div>
      </div>

      {/* Quick Access grids links */}
      <div className="w-full pt-2 border-t border-slate-900/40 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
          <Compass className="h-3.5 w-3.5 text-slate-500" />
          Synoptic Grids:
        </span>
        {savedLocations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => onLocationSelect(loc.lat, loc.lon, loc.name)}
            className="px-2.5 py-1 bg-slate-900/40 hover:bg-slate-900/70 border border-slate-850/30 hover:border-slate-850/60 rounded-lg text-[9px] text-slate-300 transition-all font-mono"
          >
            {loc.name}
          </button>
        ))}
      </div>
    </div>
  );
}
