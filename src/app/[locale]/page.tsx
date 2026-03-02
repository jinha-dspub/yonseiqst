"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabaseClient"; 

export default function LandingPage() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<"idle" | "verifying" | "granted" | "denied">("idle");
  const [mounted, setMounted] = useState(false);

  const supabase = createClient();

  useEffect(() => setMounted(true), []);

  const handleGoogleLogin = async () => {
    setAccessState("verifying");
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
       console.error("Login failed", error);
       setAccessState("denied");
       setTimeout(() => setAccessState("idle"), 2000);
    }
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

        <div className="space-y-6">
          <p className="text-[10px] text-[var(--color-primary)] uppercase font-bold tracking-widest text-center mb-4">
            Authorized Personnel Only
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={accessState !== "idle"}
            className="w-full relative overflow-hidden flex items-center justify-center gap-3 rounded-md border border-[var(--color-primary)] bg-[var(--color-card)] px-6 py-4 font-semibold text-white transition-all hover:bg-[var(--color-primary)]/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-4 shadow-[0_0_15px_rgba(0,103,172,0.3)]"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            <span className="relative z-10 uppercase tracking-widest text-sm">
              {accessState === "idle" ? "Sign In with Google" : "Connecting..."}
            </span>
          </button>
        </div>

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
