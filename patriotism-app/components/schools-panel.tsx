"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type School = {
  id: string;
  name: string;
  district: string;
  region: string;
  registration_number: string | null;
  verification_status: "pending" | "verified" | "rejected";
  created_at: string;
};

export default function SchoolsPanel() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [region, setRegion] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [message, setMessage] = useState("");

  const loadSchools = useCallback(async () => {
    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      setMessage("");

      if (!authData.user) {
        setSchools([]);
        setIsAdmin(false);
        setMessage("Please sign in again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, approval_status")
        .eq("id", authData.user.id)
        .single();

      if (profileError) throw profileError;

      const admin =
        profile.role === "national_admin" &&
        profile.approval_status === "approved";

      setIsAdmin(admin);

      if (!admin) {
        setSchools([]);
        setMessage(
          "Only an approved National Administrator can manage schools.",
        );
        return;
      }

      const { data, error } = await supabase
        .from("schools")
        .select(
          "id, name, district, region, registration_number, verification_status, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSchools((data ?? []) as School[]);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load schools.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSchools();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSchools]);

  async function registerSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData.user) throw new Error("Please sign in again.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, approval_status")
        .eq("id", authData.user.id)
        .single();

      if (profileError) throw profileError;

      if (
        profile.role !== "national_admin" ||
        profile.approval_status !== "approved"
      ) {
        throw new Error(
          "Only an approved National Administrator can register schools.",
        );
      }

      const cleanName = name.trim();
      const cleanDistrict = district.trim();
      const cleanRegion = region.trim();
      const cleanRegistrationNumber = registrationNumber.trim();

      if (!cleanName || !cleanDistrict || !cleanRegion) {
        throw new Error("Please complete the school name, district, and region.");
      }

      const { error: insertError } = await supabase.from("schools").insert({
        name: cleanName,
        district: cleanDistrict,
        region: cleanRegion,
        registration_number: cleanRegistrationNumber || null,
        verification_status: "pending",
      });

      if (insertError) throw insertError;

      setName("");
      setDistrict("");
      setRegion("");
      setRegistrationNumber("");
      setShowForm(false);
      setMessage("School registered successfully.");

      await loadSchools();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not register school.",
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredSchools = schools.filter((school) =>
    [
      school.name,
      school.district,
      school.region,
      school.registration_number ?? "",
      school.verification_status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-500">
            National coordination
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Registered schools
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Register and review schools participating in patriotism programmes.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
          >
            {showForm ? "Cancel" : "Register school"}
          </button>
        )}
      </div>

      {message && (
        <div
          role="status"
          className="rounded-xl border border-green-800 bg-green-950/40 p-4 text-sm text-green-200"
        >
          {message}
        </div>
      )}

      {showForm && isAdmin && (
        <form
          onSubmit={registerSchool}
          className="space-y-4 rounded-2xl border border-gray-800 bg-gray-950 p-5"
        >
          <div>
            <label
              htmlFor="school-name"
              className="mb-2 block text-sm font-medium text-gray-200"
            >
              School name
            </label>
            <input
              id="school-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter school name"
              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-green-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="school-district"
                className="mb-2 block text-sm font-medium text-gray-200"
              >
                District
              </label>
              <input
                id="school-district"
                required
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                placeholder="Enter district"
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label
                htmlFor="school-region"
                className="mb-2 block text-sm font-medium text-gray-200"
              >
                Region
              </label>
              <select
                id="school-region"
                required
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-green-500"
              >
                <option value="">Select region</option>
                <option value="Central">Central</option>
                <option value="Eastern">Eastern</option>
                <option value="Northern">Northern</option>
                <option value="Western">Western</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="school-registration-number"
              className="mb-2 block text-sm font-medium text-gray-200"
            >
              Registration number (optional)
            </label>
            <input
              id="school-registration-number"
              value={registrationNumber}
              onChange={(event) => setRegistrationNumber(event.target.value)}
              placeholder="Enter registration number"
              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Registering..." : "Register school"}
          </button>
        </form>
      )}

      <div>
        <label htmlFor="school-search" className="sr-only">
          Search schools
        </label>
        <input
          id="school-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by school, district, region, or status..."
          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white outline-none focus:border-green-500"
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6 text-sm text-gray-400">
          Loading schools...
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-8 text-center">
          <h3 className="font-semibold text-white">
            {search ? "No matching schools" : "No schools registered yet"}
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            {search
              ? "Try another search term."
              : "Registered schools will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSchools.map((school) => (
            <article
              key={school.id}
              className="rounded-2xl border border-gray-800 bg-gray-950 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white">{school.name}</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    {school.district} · {school.region}
                  </p>
                  {school.registration_number && (
                    <p className="mt-1 text-xs text-gray-500">
                      Registration number: {school.registration_number}
                    </p>
                  )}
                </div>

                <span className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300">
                  {school.verification_status}
                </span>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Registered{" "}
                {new Date(school.created_at).toLocaleDateString("en-UG")}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
