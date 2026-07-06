import React, { useState, useEffect } from "react";
import { AlertTriangle, Volume2, ShieldAlert, Check, Plus, Calendar, Megaphone, Trash2 } from "lucide-react";
import { Alert, UserRole } from "../types";

interface AlertProps {
  currentRole: UserRole;
  lat: number;
  lon: number;
}

export default function AlertCenter({ currentRole, lat, lon }: AlertProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPlayingSiren, setIsPlayingSiren] = useState(false);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [oscillator, setOscillator] = useState<OscillatorNode | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);

  // Custom alert dispatch states (Admin/Meteorologist only)
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSeverity, setNewSeverity] = useState<"Moderate" | "Severe" | "Extreme">("Severe");
  const [newCategory, setNewCategory] = useState("Cyclone");

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAlerts(data);
    } catch (e) {
      console.error("Alerts fetching failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  // Dispatch a real meteorological alert onto the dashboard
  const handleDispatchAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDesc) return;

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          severity: newSeverity,
          category: newCategory,
          lat,
          lon
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts);
        setNewTitle("");
        setNewDesc("");
        // Play a short simulated dispatch notification beep
        beep(880, 0.1);
      }
    } catch (error) {
      console.error("Alert dispatch failed:", error);
    }
  };

  // Web Audio Synthesizer Beep Helper
  const beep = (freq: number, duration: number) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context blocked by policy.");
    }
  };

  // Synthesizing a real Civil Defense Weather Siren (warble oscillator sound!)
  const toggleSiren = () => {
    if (isPlayingSiren) {
      // Stop Siren
      if (oscillator) {
        try {
          oscillator.stop();
        } catch (e) {}
        setOscillator(null);
      }
      setIsPlayingSiren(false);
      return;
    }

    try {
      const ctx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioCtx) setAudioCtx(ctx);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // Base warning freq

      // Add Siren low-frequency warble
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.5; // Warbles every 2 seconds
      lfoGain.gain.value = 80;   // 80Hz pitch swing

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.08, ctx.currentTime); // keep volume conservative and safe

      osc.connect(gain);
      gain.connect(ctx.destination);

      lfo.start();
      osc.start();

      setOscillator(osc);
      setGainNode(gain);
      setIsPlayingSiren(true);
    } catch (error) {
      console.warn("Siren synth initialization blocked:", error);
    }
  };

  // Terminate siren on unmount
  useEffect(() => {
    return () => {
      if (oscillator) {
        try {
          oscillator.stop();
        } catch (e) {}
      }
    };
  }, [oscillator]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="met-alerts-center">
      
      {/* 1. Alerts bulletin & Weather Siren trigger */}
      <div className="lg:col-span-2 glass rounded-2xl p-6 flex flex-col justify-between bg-slate-950/20">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
              Meteorological Crisis Alert Center
            </h3>

            {/* Siren Synth trigger button */}
            <button
              onClick={toggleSiren}
              className={`px-3 py-1.5 rounded-xl border font-mono text-[10px] flex items-center gap-1.5 transition-all shadow-sm ${
                isPlayingSiren 
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse font-bold" 
                  : "bg-slate-900/50 hover:bg-slate-900/85 text-slate-300 border-white/10"
              }`}
            >
              <Volume2 className={`h-3.5 w-3.5 ${isPlayingSiren ? "animate-bounce" : ""}`} />
              {isPlayingSiren ? "Mute Siren Test" : "Trigger Sirens"}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            Real-time critical warnings dispatched globally. Simulated siren test reproduces an authentic acoustic wave warble calibrated for emergency broadcasts.
          </p>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <p className="text-[11px] text-slate-500 font-mono text-center py-12">No active hazard alerts currently logged.</p>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 justify-between items-start transition-all ${
                    a.severity === "Extreme" 
                      ? "bg-red-500/5 border-red-500/15 hover:border-red-500/25" 
                      : "bg-amber-500/5 border-amber-500/15 hover:border-amber-500/25"
                  }`}
                >
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-widest font-mono uppercase ${
                        a.severity === "Extreme" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {a.severity}
                      </span>
                      <h4 className="text-xs font-bold text-slate-200">{a.title}</h4>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{a.description}</p>
                    <span className="text-[9px] text-slate-500 font-mono mt-3 block">
                      Dispatched: {new Date(a.issuedAt).toLocaleTimeString()} • Coordinates: {a.coordinates.lat.toFixed(2)}°, {a.coordinates.lon.toFixed(2)}°
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Siren Synth: 440Hz SAW + 0.5Hz LFO</span>
          <span>Emergency Broadcast system live</span>
        </div>
      </div>

      {/* 2. Meteorologist Role Alerts Dispatch (Role Restricted Simulation!) */}
      <div className="glass rounded-2xl p-6 flex flex-col justify-between bg-slate-950/20">
        {currentRole === "Meteorologist" || currentRole === "Forecaster" ? (
          <form onSubmit={handleDispatchAlert} className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Megaphone className="h-4.5 w-4.5 text-cyan-400 animate-pulse" />
                Regional Dispatch Node
              </h3>
              <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-mono font-bold">DISPATCH ENABLED</span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed mb-1">
              Your security role permits broadcasting meteorological emergencies. Alerts will propagate onto the map telemetry and warning bulletin feeds.
            </p>

            {/* Title */}
            <div>
              <label className="text-[9px] text-slate-500 font-mono uppercase tracking-widest block mb-1">Warning Heading / Sector</label>
              <input
                type="text"
                required
                placeholder="e.g. Blizzard Warning / Southern Alps Grid"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-900/45 border border-white/5 focus:border-cyan-500/50 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-sans focus:outline-none transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[9px] text-slate-500 font-mono uppercase tracking-widest block mb-1">Detailed synoptic description</label>
              <textarea
                required
                rows={3}
                placeholder="Document atmospheric wind gradients, surface moisture models, and required civilian precautions..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full bg-slate-900/45 border border-white/5 focus:border-cyan-500/50 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-sans focus:outline-none transition-all resize-none"
              />
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-3 font-mono text-[9px]">
              <div>
                <label className="text-[8px] text-slate-500 uppercase block mb-1">Severity</label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value as any)}
                  className="w-full bg-slate-900/45 border border-white/5 rounded-lg px-2 py-1 text-slate-300 outline-none"
                >
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                  <option value="Extreme">Extreme</option>
                </select>
              </div>
              <div>
                <label className="text-[8px] text-slate-500 uppercase block mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-slate-900/45 border border-white/5 rounded-lg px-2 py-1 text-slate-300 outline-none"
                >
                  <option value="Cyclone">Cyclone</option>
                  <option value="Flood">Flood</option>
                  <option value="Blizzard">Blizzard</option>
                  <option value="Wildfire">Wildfire</option>
                </select>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full mt-2 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Broadcast Warning
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-24 font-mono">
            <ShieldAlert className="h-10 w-10 text-slate-600 mb-3" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">RESTRICTED DISPATCH PANEL</h4>
            <p className="text-[10px] text-slate-500 mt-2 max-w-[200px] leading-relaxed">
              Your security authorization (currently Observer Mode) lacks write-access to the live emergency broadcast transponder.
            </p>
            <span className="text-[9px] text-cyan-400 mt-4.5">Switch role in the header to activate.</span>
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Active Grid Lat: {lat}</span>
          <span>Station Code SEC-1</span>
        </div>
      </div>

    </div>
  );
}
