import React, { useState, useEffect } from "react";
import { ShieldAlert, Flame, Waves, AlertTriangle, RefreshCw, Layers } from "lucide-react";
import { EarthquakeFeature, EarthquakeResponse } from "../types";

export default function GeoHazardsTracker() {
  const [earthquakes, setEarthquakes] = useState<EarthquakeFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [magFilter, setMagFilter] = useState<number>(3.0);
  const [hazardsOverview] = useState({
    floodRisk: "Moderate",
    wildfireRisk: "High",
    droughtRisk: "Critical",
    atmosphericRivers: "Active"
  });

  const fetchEarthquakes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/earthquakes");
      if (!res.ok) throw new Error("USGS server down.");
      const data: EarthquakeResponse = await res.json();
      setEarthquakes(data.features || []);
    } catch (e) {
      console.error("Earthquake feed fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarthquakes();
  }, []);

  const filteredQuakes = earthquakes.filter(q => q.properties.mag >= magFilter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="met-geohazards-tracker">
      
      {/* 1. Seismic Feed Tracker */}
      <div className="lg:col-span-2 glass rounded-2xl p-6 flex flex-col justify-between bg-slate-950/20">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
              Real-time Global Seismic surveillance (USGS)
            </h3>
            
            <button
              onClick={fetchEarthquakes}
              disabled={loading}
              className="p-1.5 bg-slate-900/60 hover:bg-slate-900/90 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-all shadow"
              title="Refresh Seismic Telemetry"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Magnitude Filter */}
          <div className="flex items-center gap-3 bg-slate-900/30 px-3.5 py-2.5 rounded-xl border border-white/5 mb-5 text-[10px] font-mono">
            <span className="text-slate-500 uppercase">Seismic Threshold Filter:</span>
            <div className="flex gap-1.5">
              {[2.5, 3.0, 4.5, 6.0].map((m) => (
                <button
                  key={m}
                  onClick={() => setMagFilter(m)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${
                    magFilter === m ? "bg-rose-500/20 text-rose-400 border border-rose-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  M {m}+
                </button>
              ))}
            </div>
          </div>

          {/* Seismic Events list */}
          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {filteredQuakes.length === 0 ? (
              <div className="py-12 text-center text-[11px] text-slate-500 font-mono">
                No seismic telemetry matching M {magFilter} criteria inside last 24h.
              </div>
            ) : (
              filteredQuakes.slice(0, 10).map((q, idx) => {
                const isTsunami = q.properties.tsunami === 1;
                const date = new Date(q.properties.time);
                const isSevere = q.properties.mag >= 5.5;

                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900/20 hover:bg-slate-900/40 border border-white/5 hover:border-white/10 rounded-xl flex items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isSevere ? "bg-rose-500/25 text-rose-400 animate-pulse border border-rose-500/40" : "bg-slate-950/60 text-slate-300 border border-white/5"
                      }`}>
                        M {q.properties.mag.toFixed(1)}
                      </div>
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200 line-clamp-1">{q.properties.place}</h4>
                        <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">{date.toLocaleTimeString()} • Depth: {q.geometry.coordinates[2]}km</span>
                      </div>
                    </div>

                    {isTsunami && (
                      <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded text-[8px] font-mono text-cyan-400 font-bold tracking-wider animate-pulse uppercase">
                        TSUNAMI ADVISORY
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Active Nodes: Golden CO Seismic Bureau</span>
          <span>USGS GeoJSON Feed</span>
        </div>
      </div>

      {/* 2. Global Environmental Risk Metrics */}
      <div className="glass rounded-2xl p-6 flex flex-col justify-between bg-slate-950/20">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-cyan-400" />
              Meteorological Risks
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Indicators</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            Regional safety indicators calibrated across climate anomalies, low moisture indices, and convective atmospheric basins.
          </p>

          <div className="space-y-4">
            {/* Wildfire Risk */}
            <div className="flex items-center justify-between p-3.5 bg-orange-500/5 border border-orange-500/10 hover:border-orange-500/25 rounded-xl transition-all">
              <div className="flex items-center gap-2.5">
                <Flame className="h-4.5 w-4.5 text-orange-400 animate-pulse" />
                <div>
                  <span className="text-[10px] font-mono text-slate-500 block">WILDFIRE SPREAD INDEX</span>
                  <p className="text-xs font-bold text-slate-200 mt-0.5">Critical Extreme Risk</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 bg-orange-500/15 rounded text-[9px] font-bold text-orange-400 font-mono">
                Keetch-Byram Index
              </span>
            </div>

            {/* Flood Risk */}
            <div className="flex items-center justify-between p-3.5 bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/25 rounded-xl transition-all">
              <div className="flex items-center gap-2.5">
                <Waves className="h-4.5 w-4.5 text-blue-400" />
                <div>
                  <span className="text-[10px] font-mono text-slate-500 block">FLOODING / SATURATION INDEX</span>
                  <p className="text-xs font-bold text-slate-200 mt-0.5">Slight Hydrological Overflow</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 bg-blue-500/15 rounded text-[9px] font-bold text-blue-400 font-mono">
                90% Saturation
              </span>
            </div>

            {/* Drought Index */}
            <div className="flex items-center justify-between p-3.5 bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/25 rounded-xl transition-all">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                <div>
                  <span className="text-[10px] font-mono text-slate-500 block">PALMER DROUGHT SEVERITY</span>
                  <p className="text-xs font-bold text-slate-200 mt-0.5">Moderate Deficit anomalies</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 bg-amber-500/15 rounded text-[9px] font-bold text-amber-400 font-mono">
                PDSI -2.8
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Soil water metrics calculated daily</span>
          <span>Risk Matrix V2.1</span>
        </div>
      </div>

    </div>
  );
}
