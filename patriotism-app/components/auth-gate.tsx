"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";

type Screen = "loading" | "login" | "register" | "pending" | "rejected" | "approved" | "error";

type Profile = {
  full_name: string | null;
  email: string | null;
  role: string;
  approval_status: string;
};

export default function AuthGate({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkProfile(userId: string | null) {
    if (!userId) {
      setProfile(null);
      setScreen("login");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email, role, approval_status")
      .eq("id", userId)
      .single();

    if (error || !data) {
      setMessage(
        "We couldn't load your profile. Please try again or contact the administrator.",
      );
      setScreen("error");
      return;
    }

    setProfile(data as Profile);

    if (data.approval_status === "approved") {
      setScreen("approved");
    } else if (data.approval_status === "rejected") {
      setScreen("rejected");
    } else {
      setScreen("pending");
    }
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        void checkProfile(data.session?.user.id ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setTimeout(() => {
          if (active) {
            void checkProfile(session?.user.id ?? null);
          }
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (screen === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session && data.user) {
          await checkProfile(data.user.id);
        } else {
          setScreen("login");
          setMessage(
            "Registration received. Check your email if confirmation is required, then sign in. Your account must be approved by a National Administrator.",
          );
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        await checkProfile(data.user.id);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setMessage("");
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
    } else {
      setProfile(null);
      setPassword("");
      setScreen("login");
    }
  }

  const buttonStyle = {
    background: "#16A34A",
    color: "#FFFFFF",
    border: 0,
    borderRadius: 8,
    padding: "12px 16px",
    cursor: "pointer",
    fontWeight: 600 as const,
    width: "100%",
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: 12,
    border: "1px solid #44444D",
    borderRadius: 8,
    background: "#080B09",
    color: "#FFFFFF",
    marginTop: 6,
  };

  if (screen === "loading") {
    return <div className="auth-message">Checking your account…</div>;
  }

  if (screen === "approved") {
    return (
      <>
        <div
          style={{
            background: "#111914",
            color: "#FFFFFF",
            padding: "10px 20px",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>
            {profile?.full_name || profile?.email || "Signed-in user"}
            {" · "}
            {profile?.role === "national_admin"
              ? "National Administrator"
              : "School Coordinator"}
          </span>
          <button
            onClick={handleSignOut}
            style={{
              background: "transparent",
              border: "1px solid #55555D",
              color: "#FFFFFF",
              borderRadius: 6,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
        {children}
      </>
    );
  }

  if (screen === "pending" || screen === "rejected" || screen === "error") {
    const heading =
      screen === "pending"
        ? "Your account is awaiting approval"
        : screen === "rejected"
          ? "Account approval was not granted"
          : "Unable to load your account";

    const description =
      screen === "pending"
        ? "A National Administrator must approve your account before you can access the coordination workspace."
        : screen === "rejected"
          ? "Please contact the Patriotism School Hub administrator if you believe this decision was made in error."
          : message;

    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-emblem">P</div>
          <h1>{heading}</h1>
          <p>{description}</p>
          {profile?.email && <p>Account: {profile.email}</p>}
          {message && screen !== "error" && <p role="status">{message}</p>}
          <button style={buttonStyle} onClick={handleSignOut}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-emblem">P</div>
        <p className="auth-kicker">PATRIOTISM SCHOOL HUB</p>
        <h1>
          {screen === "register" ? "Request an account" : "Welcome back"}
        </h1>
        <p className="auth-description">
          {screen === "register"
            ? "Register as a school coordinator. A National Administrator must approve your account."
            : "Sign in to access your school coordination workspace."}
        </p>

        <form onSubmit={handleSubmit}>
          {screen === "register" && (
            <label className="auth-label">
              Full name
              <input
                style={inputStyle}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
                maxLength={100}
                placeholder="Enter your full name"
              />
            </label>
          )}

          <label className="auth-label">
            Email address
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>

          <label className="auth-label">
            Password
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                screen === "register" ? "new-password" : "current-password"
              }
              minLength={6}
              required
              placeholder="Enter your password"
            />
          </label>

          {message && (
            <p className="auth-feedback" role="status">
              {message}
            </p>
          )}

          <button
            type="submit"
            style={{ ...buttonStyle, marginTop: 18 }}
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : screen === "register"
                ? "Request account"
                : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {screen === "register"
            ? "Already have an account?"
            : "Need a coordinator account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setPassword("");
              setScreen(screen === "register" ? "login" : "register");
            }}
          >
            {screen === "register" ? "Sign in" : "Register"}
          </button>
        </p>
      </section>
    </main>
  );
}
