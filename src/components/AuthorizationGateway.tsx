import React, { useState } from "react";
import { Key, User, Lock, ArrowRight, ShieldCheck, HelpCircle, Loader2 } from "lucide-react";

interface AuthorizationGatewayProps {
  onSuccess: (authType: "admin" | "user" | "guest" | "key", expiryTime: number, token?: string, userRole?: string) => void;
}

export default function AuthorizationGateway({ onSuccess }: AuthorizationGatewayProps) {
  const [activeTab, setActiveTab] = useState<"key" | "login">("key");
  const [keyCode, setKeyCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleKeyUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyCode.trim()) {
      setError("Please input a valid Access Key.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyCode.trim() })
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned a non-JSON response (Status ${res.status}). This usually indicates a gateway routing issue or network downtime. Please try again later.`);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid Access Key. Please check the code and try again.");
      }

      // Check key duration
      const durationMins = data.durationMinutes;
      let expiryTime = Infinity;
      if (durationMins > 0) {
        expiryTime = Date.now() + durationMins * 60 * 1000;
      }

      onSuccess("key", expiryTime, data.key, "Observer");
    } catch (err: any) {
      setError(err.message || "Failed to validate Access Key.");
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Both Email Address and Passcode variables are required.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned a non-JSON response (Status ${res.status}). This usually indicates a gateway routing issue or network downtime. Please try again later.`);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Staff authentication credentials mismatch.");
      }

      // If it's the admin arnesh, it grants Admin role
      const isSystemAdmin = email.trim().toLowerCase() === "meet.arnesh@gmail.com";
      const userRole = isSystemAdmin ? "Admin" : (data.user?.role || "Observer");

      onSuccess(isSystemAdmin ? "admin" : "user", Infinity, data.token, userRole);
    } catch (err: any) {
      setError(err.message || "Staff login authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestUnlock = () => {
    setError("");
    // Guest gets 2 minutes (120,000 milliseconds)
    const expiryTime = Date.now() + 2 * 60 * 1000;
    onSuccess("guest", expiryTime, undefined, "Observer");
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-mono text-xs">
      
      {/* Decorative cosmic background glows */}
      <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-10000" />
      <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse duration-10000" />

      {/* Main Lock Screen Card */}
      <div className="w-full max-w-md bg-slate-950/70 border border-slate-900/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="h-14 w-14 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.15)] mx-auto mb-4">
            <Key className="h-7 w-7 text-cyan-400" />
          </div>
          <h1 className="text-lg font-black tracking-tight text-white flex items-center justify-center gap-1.5 uppercase">
            Meteor<span className="text-cyan-400 text-xs font-bold px-1.5 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20">Intel</span>
          </h1>
          <p className="text-[9px] text-slate-500 tracking-widest uppercase mt-1">Operational Access Gateway</p>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 border border-slate-900 rounded-xl mb-6">
          <button
            onClick={() => { setActiveTab("key"); setError(""); }}
            className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === "key" 
                ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400" 
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            Access Key
          </button>
          <button
            onClick={() => { setActiveTab("login"); setError(""); }}
            className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === "login" 
                ? "bg-purple-500/10 border border-purple-500/20 text-purple-400" 
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Staff Login
          </button>
        </div>

        {/* Dynamic Alerts */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] leading-relaxed">
            {error}
          </div>
        )}

        {/* Tab 1: Access Key Unlocking */}
        {activeTab === "key" && (
          <div className="space-y-5">
            <form onSubmit={handleKeyUnlock} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Enter Observatory Access Key</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Key className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="KEY-XXXX-XXXX"
                    value={keyCode}
                    onChange={(e) => setKeyCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 focus:border-cyan-500/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none transition-all font-bold tracking-wider"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking Key Security...
                  </>
                ) : (
                  <>
                    Unlock Platform
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-900"></div>
              <span className="flex-shrink mx-4 text-[9px] text-slate-600 uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-slate-900"></div>
            </div>

            {/* Guest Entry Option */}
            <div className="text-center">
              <button
                onClick={handleGuestUnlock}
                className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-300 font-bold py-3 px-4 rounded-xl transition-all text-[11px] uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <HelpCircle className="h-4 w-4 text-cyan-400" />
                Guest Access (2 Min Free Preview)
              </button>
              <p className="text-[9px] text-slate-500 mt-2 italic">Free sandbox access will automatically lock after 2 minutes.</p>
            </div>
          </div>
        )}

        {/* Tab 2: Staff / Admin Login */}
        {activeTab === "login" && (
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="staff@observatory.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 focus:border-purple-500/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Staff Security Passcode</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 focus:border-purple-500/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none transition-all tracking-widest"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.15)] flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying Security Node...
                </>
              ) : (
                <>
                  Enter Secure Segment
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Footer */}
        <div className="mt-8 pt-4 border-t border-slate-900 text-center">
          <p className="text-[8px] text-slate-600 uppercase tracking-widest font-mono">
            System Node: SECURE // SECURE TRANSMISSIONS ENFORCED
          </p>
        </div>

      </div>
    </div>
  );
}
