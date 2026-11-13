"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Announcement = {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
};

export default function AnnouncementsPanel() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("NATIONAL UPDATE");
  const [message, setMessage] = useState("");

  async function loadAnnouncements() {
    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      setMessage("");

      if (!userData.user) {
        setItems([]);
        setIsAdmin(false);
        setMessage("Please sign in to view announcements.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, approval_status")
        .eq("id", userData.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.approval_status !== "approved") {
        setItems([]);
        setIsAdmin(false);
        setMessage("Your account must be approved to view announcements.");
        return;
      }

      setIsAdmin(profile.role === "national_admin");

      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, category, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setItems((data ?? []) as Announcement[]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load announcements.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnnouncements();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPublishing(true);
    setMessage("");

    try {
      const cleanTitle = title.trim();
      const cleanBody = body.trim();

      if (!cleanTitle || !cleanBody) {
        throw new Error("Please enter both a title and announcement details.");
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;
      if (!userData.user) throw new Error("Please sign in again.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, approval_status")
        .eq("id", userData.user.id)
        .single();

      if (profileError) throw profileError;

      if (
        profile.role !== "national_admin" ||
        profile.approval_status !== "approved"
      ) {
        throw new Error(
          "Only an approved National Administrator can publish announcements.",
        );
      }

      const { error: insertError } = await supabase
        .from("announcements")
        .insert({
          title: cleanTitle,
          body: cleanBody,
          category,
          published: true,
          created_by: userData.user.id,
        });

      if (insertError) throw insertError;

      setTitle("");
      setBody("");
      setCategory("NATIONAL UPDATE");
      setShowForm(false);
      setMessage("Announcement published successfully.");

      await loadAnnouncements();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not publish announcement.",
      );
    } finally {
      setPublishing(false);
    }
  }

  const filteredItems = items.filter((item) =>
    `${item.title} ${item.body} ${item.category}`
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
            Latest announcements
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Official updates for approved members of the Hub.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
          >
            {showForm ? "Cancel" : "Create announcement"}
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
          onSubmit={publishAnnouncement}
          className="space-y-4 rounded-2xl border border-gray-800 bg-gray-950 p-5"
        >
          <div>
            <label
              htmlFor="announcement-title"
              className="mb-2 block text-sm font-medium text-gray-200"
            >
              Announcement title
            </label>
            <input
              id="announcement-title"
              type="text"
              required
              maxLength={180}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter a clear title"
              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label
              htmlFor="announcement-category"
              className="mb-2 block text-sm font-medium text-gray-200"
            >
              Category
            </label>
            <select
              id="announcement-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-green-500"
            >
              <option value="NATIONAL UPDATE">National update</option>
              <option value="PROGRAMME PLANNING">Programme planning</option>
              <option value="MEETING NOTICE">Meeting notice</option>
              <option value="IMPORTANT NOTICE">Important notice</option>
              <option value="COMMUNITY">Community</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="announcement-body"
              className="mb-2 block text-sm font-medium text-gray-200"
            >
              Announcement details
            </label>
            <textarea
              id="announcement-body"
              required
              maxLength={10000}
              rows={6}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write the announcement for approved members..."
              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={publishing}
            className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishing ? "Publishing..." : "Publish announcement"}
          </button>
        </form>
      )}

      <div>
        <label htmlFor="announcement-search" className="sr-only">
          Search announcements
        </label>
        <input
          id="announcement-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search announcements..."
          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white outline-none focus:border-green-500"
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6 text-sm text-gray-400">
          Loading announcements...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-8 text-center">
          <h3 className="font-semibold text-white">
            {search ? "No matching announcements" : "No announcements yet"}
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            {search
              ? "Try another search term."
              : "Published announcements will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-gray-800 bg-gray-950 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full border border-green-800 bg-green-950/50 px-3 py-1 text-xs font-semibold text-green-300">
                  {item.category}
                </span>
                <time
                  dateTime={item.created_at}
                  className="text-xs text-gray-500"
                >
                  {new Date(item.created_at).toLocaleString("en-UG")}
                </time>
              </div>

              <h3 className="mt-4 text-lg font-bold text-white">
                {item.title}
              </h3>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-300">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
