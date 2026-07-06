import React, { useState, useEffect } from "react";
import { Key, Plus, Trash2, Clock, Calendar, ShieldAlert, Copy, Check, FileText } from "lucide-react";

interface AccessKey {
  id: string;
  durationMinutes: number;
  validUntil: string;
  createdAt: string;
  notes: string;
}

interface AdminKeysDeskProps {
  userToken: string | null;
  currentRole: string;
}

export default function AdminKeysDesk({ userToken, currentRole }: AdminKeysDeskProps) {
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form states
  const [customCode, setCustomCode] = useState("");
  const [durationOption, setDurationOption] = useState("60"); // default 1 hr
  const [customMinutes, setCustomMinutes] = useState("");
  const [validUntilDate, setValidUntilDate] = useState("");
  const [notes, setNotes] = useState("");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchKeys = async () => {
    if (!userToken || currentRole !== "Admin") return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/keys", {
        headers: { "Authorization": `Bearer ${userToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch access keys.");
      setKeys(data.keys || []);
    } catch (err: any) {
      setError(err.message || "Failed to load keys.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [userToken, currentRole]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!userToken) {
      setError("Authentication credentials missing.");
      return;
    }

    // Determine final duration
    let finalDuration = 60;
    if (durationOption === "infinite") {
      finalDuration = -1;
    } else if (durationOption === "custom") {
      const parsed = parseInt(customMinutes);
      if (isNaN(parsed) || parsed <= 0) {
        setError("Please enter a valid positive number for custom minutes.");
        return;
      }
      finalDuration = parsed;
    } else {
      finalDuration = parseInt(durationOption);
    }

    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}`
        },
        body: JSON.stringify({
          key: customCode ? customCode.trim() : undefined,
          durationMinutes: finalDuration,
          validUntil: validUntilDate ? new Date(validUntilDate).toISOString() : "",
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create Access Key.");

      setKeys(data.keys || []);
      setSuccess(`Access Key "${data.newKey.id}" provisioned successfully!`);
      
      // Clear fields
      setCustomCode("");
      setDurationOption("60");
      setCustomMinutes("");
      setValidUntilDate("");
      setNotes("");

      // Autohide success
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      setError(err.message || "Failed to create key.");
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm(`Are you sure you want to revoke key "${keyId}"? It will lock out any active user sessions utilizing it.`)) {
      return;
    }

    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/keys/${keyId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${userToken}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke Access Key.");

      setKeys(data.keys || []);
      setSuccess(`Access Key "${keyId}" revoked.`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to revoke key.");
    }
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (currentRole !== "Admin") {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center" id="admin-restricted-desk">
        <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black font-mono tracking-wider text-white uppercase">RESTRICTED ACCESS SEGMENT</h2>
        <p className="text-xs text-slate-400 mt-2 font-mono">Your current clearance level is insufficient to access the Operational Access Key generator.</p>
        <p className="text-[10px] text-slate-500 mt-4 font-mono">Contact Meet Arnesh (meet.arnesh@gmail.com) for administrator elevation.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8" id="admin-keys-desk">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded font-mono font-bold uppercase tracking-wider">
              Admin clearance active
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2.5 font-mono">
            <Key className="h-6 w-6 text-purple-400 animate-pulse" />
            OPERATIONAL KEY DESK
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">Generate, customize, and audit secure token credentials for client guest passes.</p>
        </div>
        <button
          onClick={fetchKeys}
          className="px-4 py-2 rounded-xl text-xs font-mono border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 transition-all flex items-center gap-2"
        >
          <Clock className="h-3.5 w-3.5" />
          Refresh Keys Index
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-2xl p-6 bg-slate-950/40 border border-slate-900">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest font-mono mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-purple-400" />
              Generate Token
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                {success}
              </div>
            )}

            <form onSubmit={handleCreateKey} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Custom Key Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ARNESH-PASS-2026"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 transition-all text-xs"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">Leave blank to auto-generate a secure random format.</span>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Validity Duration</label>
                <select
                  value={durationOption}
                  onChange={(e) => setDurationOption(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 transition-all text-xs"
                >
                  <option value="2">2 Minutes (Fast Trial)</option>
                  <option value="15">15 Minutes</option>
                  <option value="60">1 Hour (Default)</option>
                  <option value="1440">24 Hours (Full Day)</option>
                  <option value="10080">7 Days (Weekly Pass)</option>
                  <option value="custom">Custom Minutes...</option>
                  <option value="infinite">Infinite (No Timer Expiry)</option>
                </select>
              </div>

              {durationOption === "custom" && (
                <div className="animate-in slide-in-from-top duration-200">
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Custom Minutes</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter minutes of access"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 transition-all text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Key Activation Expiry (Optional)</label>
                <input
                  type="date"
                  value={validUntilDate}
                  onChange={(e) => setValidUntilDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 transition-all text-xs"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">The absolute date after which the code becomes invalid to unlock the page.</span>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Purpose / Notes</label>
                <textarea
                  placeholder="e.g. VIP client temporary preview link"
                  value={notes}
                  rows={2}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 transition-all text-xs resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] flex items-center justify-center gap-2 mt-2"
              >
                <Plus className="h-4 w-4" />
                Provision Access Key
              </button>
            </form>
          </div>
        </div>

        {/* Right Active Keys Listing Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-6 bg-slate-950/40 border border-slate-900 min-h-[450px] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest font-mono mb-6 flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-400" />
                Active Key Registry ({keys.length})
              </h3>

              {loading && keys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-mono text-xs gap-3">
                  <span className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full" />
                  Querying Key Index...
                </div>
              ) : keys.length === 0 ? (
                <div className="text-center py-20 text-slate-500 font-mono text-xs border border-dashed border-slate-900 rounded-2xl bg-slate-950/20">
                  No active guest pass tokens found in the database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] font-mono">
                    <thead>
                      <tr className="border-b border-slate-900 text-slate-400">
                        <th className="pb-3 font-bold uppercase tracking-wider">Access Key</th>
                        <th className="pb-3 font-bold uppercase tracking-wider">Duration</th>
                        <th className="pb-3 font-bold uppercase tracking-wider">Validity Date</th>
                        <th className="pb-3 font-bold uppercase tracking-wider">Notes</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {keys.map((k) => (
                        <tr key={k.id} className="hover:bg-slate-900/20 transition-all group">
                          <td className="py-3.5 pr-3 font-bold text-slate-100 flex items-center gap-2">
                            <span className="text-purple-400 font-bold tracking-wide">{k.id}</span>
                            <button
                              onClick={() => handleCopy(k.id)}
                              className="p-1 rounded bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-all"
                              title="Copy key code"
                            >
                              {copiedKey === k.id ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 text-slate-300">
                            {k.durationMinutes === -1 ? (
                              <span className="text-emerald-400 font-bold uppercase text-[9px]">Infinite</span>
                            ) : (
                              <span>{k.durationMinutes} mins</span>
                            )}
                          </td>
                          <td className="py-3.5 text-slate-300">
                            {k.validUntil ? (
                              <span className="text-yellow-500">
                                {new Date(k.validUntil).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3.5 text-slate-400 italic max-w-[150px] truncate" title={k.notes}>
                            {k.notes}
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => handleRevokeKey(k.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:text-white hover:bg-red-600 transition-all opacity-80 group-hover:opacity-100"
                              title="Revoke key"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-950/50 border border-slate-900 flex items-start gap-3 text-[10px] text-slate-500 font-mono">
              <ShieldAlert className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-300 font-bold block">Security Notice:</span>
                Revoking keys immediately invalidates any active sessions holding that key. Guests will be logged out dynamically on their next client heartbeat or action.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
