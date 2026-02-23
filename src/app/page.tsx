"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [accessState, setAccessState] = useState<"idle" | "verifying" | "granted" | "denied">("idle");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAccessState("verifying");

    setTimeout(() => {
      let role = null;
      if (studentId === "jinha" && password === "j2data2025!@") role = "jinha";
      else if (studentId === "taeyeon" && password === "j2data2025!@") role = "taeyeon";
      else if (studentId && password) role = "student"; // Any other ID is a mock student

      if (role) {
        sessionStorage.setItem("currentUser", role);
        setAccessState("granted");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } else {
        setAccessState("denied");
        setTimeout(() => setAccessState("idle"), 2000);
      }
    }, 1500);
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] relative overflow-hidden font-mono">
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }}
      />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-primary)] opacity-5 rounded-full blur-[100px] pointer-events-none" />

      <div className="z-10 w-full max-w-md p-8 border border-[var(--color-card-border)] bg-[var(--color-card)]/50 backdrop-blur-md rounded-xl shadow-2xl relative">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] tracking-widest uppercase mb-2">
            YONSEI Q.S.T.
          </h1>
          <p className="text-[var(--color-foreground)]/60 text-sm uppercase tracking-[0.2em]">P.L.A.Y. Agent Protocol</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-[var(--color-primary)] font-semibold">Username / Agent ID</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full bg-black/50 border border-[var(--color-card-border)] rounded-md px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
              placeholder="홍길동"
              disabled={accessState !== "idle"}
            />
          </div>

          <button
            type="submit"
            disabled={accessState !== "idle"}
            className="w-full relative overflow-hidden rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-6 py-3 font-semibold text-[var(--color-accent)] transition-all hover:bg-[var(--color-primary)]/30 active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-4"
          >
            <span className="relative z-10 uppercase tracking-widest">
              {accessState === "idle" ? "Initialize Sequence" : "Processing..."}
            </span>
          </button>
        </form>

        {accessState !== "idle" && (
          <div className={`absolute inset-0 z-20 flex items-center justify-center rounded-xl backdrop-blur-sm transition-all duration-500
            ${accessState === "granted" ? "bg-[var(--color-accent)]/20" : ""}
            ${accessState === "denied" ? "bg-red-500/20" : ""}
            ${accessState === "verifying" ? "bg-black/40" : ""}
          `}>
            <div className="text-center p-6 border bg-black/90 rounded-lg shadow-2xl border-[var(--color-card-border)]">
              {accessState === "verifying" && (
                <p className="text-[var(--color-primary)] animate-pulse uppercase tracking-widest font-bold">Verifying Credentials...</p>
              )}
              {accessState === "granted" && (
                <p className="text-[var(--color-accent)] uppercase tracking-widest font-black text-xl drop-shadow-[0_0_10px_rgba(0,255,209,0.8)]">Access Granted</p>
              )}
              {accessState === "denied" && (
                <p className="text-red-500 uppercase tracking-widest font-black text-xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">Access Denied</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
