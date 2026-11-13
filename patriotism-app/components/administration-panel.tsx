"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  approval_status: string;
  school_id: string | null;
  created_at: string;
};

type School = {
  id: string;
  name: string;
  district: string;
};

export default function AdministrationPanel() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setMessage("");

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData.user) throw new Error("Please sign in again.");

      const { data: current, error: profileError } = await supabase
        .from("profiles")
        .select("role, approval_status")
        .eq("id", authData.user.id)
        .single();

      if (profileError) throw profileError;

      const authorized =
        current.role === "national_admin" &&
        current.approval_status === "approved";

      setIsAdmin(authorized);

      if (!authorized) {
        throw new Error("Only an approved National Administrator can manage accounts.");
      }

      const [profilesResult, schoolsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, role, approval_status, school_id, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("schools")
          .select("id, name, district")
          .order("name"),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (schoolsResult.error) throw schoolsResult.error;

      setUsers((profilesResult.data ?? []) as Profile[]);
      setSchools((schoolsResult.data ?? []) as School[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load administration data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function updateUser(
    user: Profile,
    changes: Partial<Pick<Profile, "approval_status" | "school_id">>,
  ) {
    setBusyId(user.id);
    setMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData.user) throw new Error("Please sign in again.");
      if (authData.user.id === user.id && changes.approval_status !== undefined) {
        throw new Error("You cannot change your own approval status here.");
      }

      const { error } = await supabase
        .from("profiles")
        .update(changes)
        .eq("id", user.id);

      if (error) throw error;

      setMessage("Account updated successfully.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update account.");
    } finally {
      setBusyId(null);
    }
  }

  const visibleUsers = users.filter((user) => {
    if (filter === "all") return true;
    return user.approval_status === filter;
  });

  const counts = {
    pending: users.filter((user) => user.approval_status === "pending").length,
    approved: users.filter((user) => user.approval_status === "approved").length,
    rejected: users.filter((user) => user.approval_status === "rejected").length,
  };

  if (loading) {
    return <section className="p-6 text-gray-300">Loading administration…</section>;
  }

  if (!isAdmin) {
    return (
      <section className="rounded-2xl border border-red-900 bg-gray-950 p-6 text-white">
        <h2 className="text-xl font-bold">Administration unavailable</h2>
        <p className="mt-2 text-gray-400">{message || "Administrator access is required."}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 text-white">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-500">
          National coordination
        </p>
        <h2 className="mt-2 text-3xl font-bold">Administration</h2>
        <p className="mt-2 text-gray-400">
          Review registrations and connect coordinators to their schools.
        </p>
      </div>

      {message && (
        <p role="status" className="rounded-xl border border-gray-700 bg-gray-900 p-3 text-sm">
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Awaiting approval", value: counts.pending },
          { label: "Approved accounts", value: counts.approved },
          { label: "Rejected accounts", value: counts.rejected },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-400">{item.label}</p>
            <p className="mt-2 text-3xl font-bold text-green-400">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "all", label: "All accounts" },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-xl border px-4 py-2 text-sm ${
              filter === item.value
                ? "border-green-500 bg-green-950 text-green-300"
                : "border-gray-700 text-gray-300 hover:border-green-600"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visibleUsers.length === 0 && (
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            No accounts found in this category.
          </div>
        )}

        {visibleUsers.map((user) => {
          const school = schools.find((item) => item.id === user.school_id);
          const isBusy = busyId === user.id;
          const isNationalAdmin = user.role === "national_admin";

          return (
            <article key={user.id} className="space-y-4 rounded-2xl border border-gray-800 bg-gray-950 p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h3 className="text-lg font-semibold">
                    {user.full_name || "Name not provided"}
                  </h3>
                  <p className="break-all text-sm text-gray-400">{user.email || "No email recorded"}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    Registered {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="w-fit rounded-full border border-gray-700 px-3 py-1 text-xs capitalize text-gray-300">
                  {user.approval_status.replaceAll("_", " ")}
                  {" · "}
                  {isNationalAdmin ? "National admin" : "Coordinator"}
                </span>
              </div>

              {!isNationalAdmin && user.approval_status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void updateUser(user, { approval_status: "approved" })}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
                  >
                    {isBusy ? "Saving…" : "Approve account"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void updateUser(user, { approval_status: "rejected" })}
                    className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-300 hover:bg-red-950 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}

              {!isNationalAdmin && user.approval_status === "rejected" && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void updateUser(user, { approval_status: "approved" })}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm hover:bg-green-600 disabled:opacity-50"
                >
                  Approve account
                </button>
              )}

              {!isNationalAdmin && user.approval_status === "approved" && (
                <div className="max-w-xl space-y-2">
                  <label htmlFor={`school-${user.id}`} className="block text-sm text-gray-300">
                    Assigned school
                  </label>
                  <select
                    id={`school-${user.id}`}
                    value={user.school_id ?? ""}
                    disabled={isBusy}
                    onChange={(event) =>
                      void updateUser(user, { school_id: event.target.value || null })
                    }
                    className="w-full rounded-xl border border-gray-700 bg-black px-3 py-3 text-white disabled:opacity-50"
                  >
                    <option value="">No school assigned</option>
                    {schools.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {item.district}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    Current assignment: {school ? `${school.name}, ${school.district}` : "None"}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
