"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  role: string;
  approval_status: string;
};

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  meet_url: string;
  created_by: string;
  created_at: string;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#101713",
  color: "#f3f4f6",
  border: "1px solid #37483c",
  borderRadius: 10,
  padding: "12px",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#d1d5db",
  fontSize: 13,
  marginBottom: 7,
};

export default function MeetingsPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetUrl, setMeetUrl] = useState("");

  const isAdmin = profile?.role === "national_admin";

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setError("Please sign in to view meetings.");
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, approval_status")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (userProfile.approval_status !== "approved") {
        setError("Your account must be approved before you can access meetings.");
        return;
      }

      setProfile(userProfile as Profile);

      const { data, error: meetingsError } = await supabase
        .from("meetings")
        .select("*")
        .order("meeting_date", { ascending: true });

      if (meetingsError) throw meetingsError;

      setMeetings((data ?? []) as Meeting[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We could not load the meetings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      setCurrentTime(Date.now());
      void loadMeetings();
    }, 0);

    const clock = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(clock);
    };
  }, [loadMeetings]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setMeetingDate("");
    setMeetUrl("");
    setEditingId(null);
  }

  function startEditing(meeting: Meeting) {
    setEditingId(meeting.id);
    setTitle(meeting.title);
    setDescription(meeting.description ?? "");
    setMeetingDate(
      new Date(meeting.meeting_date).toISOString().slice(0, 16)
    );
    setMeetUrl(meeting.meet_url);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!isAdmin || !profile) {
      setError("Only the National Administrator can manage meetings.");
      return;
    }

    if (!title.trim() || !meetingDate || !meetUrl.trim()) {
      setError("Please complete the meeting title, date and Google Meet link.");
      return;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(meetUrl.trim());
    } catch {
      setError("Enter a valid Google Meet link, such as https://meet.google.com/...");
      return;
    }

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "meet.google.com"
    ) {
      setError("Use a valid HTTPS Google Meet link from meet.google.com.");
      return;
    }

    const date = new Date(meetingDate);

    if (Number.isNaN(date.getTime())) {
      setError("Please choose a valid meeting date and time.");
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      meeting_date: date.toISOString(),
      meet_url: parsedUrl.toString(),
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from("meetings")
          .update(payload)
          .eq("id", editingId);

        if (updateError) throw updateError;

        setSuccess("Meeting updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("meetings")
          .insert({
            ...payload,
            created_by: profile.id,
          });

        if (insertError) throw insertError;

        setSuccess("Meeting scheduled successfully.");
      }

      resetForm();
      await loadMeetings();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The meeting could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(meeting: Meeting) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Delete the meeting "${meeting.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("meetings")
      .delete()
      .eq("id", meeting.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMeetings((current) =>
      current.filter((item) => item.id !== meeting.id)
    );
    setSuccess("Meeting deleted.");
  }

  const upcomingMeetings = meetings.filter(
    (meeting) => new Date(meeting.meeting_date).getTime() >= (currentTime ?? 0)
  );

  const pastMeetings = meetings.filter(
    (meeting) => new Date(meeting.meeting_date).getTime() < (currentTime ?? 0)
  );

  function renderMeeting(meeting: Meeting) {
    const date = new Date(meeting.meeting_date);
    const isPast = date.getTime() < (currentTime ?? 0);

    return (
      <article
        key={meeting.id}
        style={{
          background: "#101713",
          border: "1px solid #26392c",
          borderRadius: 16,
          padding: 20,
          opacity: isPast ? 0.8 : 1,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span
              style={{
                display: "inline-block",
                background: isPast ? "#292929" : "#123b25",
                color: isPast ? "#d1d5db" : "#86efac",
                borderRadius: 20,
                padding: "4px 10px",
                fontSize: 11,
                marginBottom: 10,
              }}
            >
              {isPast ? "PAST MEETING" : "SCHEDULED"}
            </span>

            <h3 className="text-lg font-semibold text-white">
              {meeting.title}
            </h3>

            <p className="mt-2 text-sm text-green-300">
              {date.toLocaleDateString("en-UG", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>

            <p className="mt-1 text-sm text-gray-300">
              {date.toLocaleTimeString("en-UG", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {isAdmin && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startEditing(meeting)}
                className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:border-green-500"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(meeting)}
                className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {meeting.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-300">
            {meeting.description}
          </p>
        )}

        <a
          href={meeting.meet_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
        >
          Join with Google Meet ↗
        </a>
      </article>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-green-400">
          National Coordination
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Meetings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
          Coordinate patriotism programmes across Uganda through scheduled
          online meetings. Join directly using the Google Meet link.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-800 bg-green-950/40 p-4 text-sm text-green-200"
        >
          {success}
        </div>
      )}

      {isAdmin && (
        <section className="rounded-2xl border border-green-900/70 bg-[#0b110d] p-5 sm:p-7">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">
              {editingId ? "Edit meeting" : "Schedule a meeting"}
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Add the meeting details and paste the Google Meet link you
              created.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label htmlFor="meeting-title" style={labelStyle}>
                Meeting title *
              </label>
              <input
                id="meeting-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={150}
                required
                placeholder="e.g. National Patriotism Coordinators Meeting"
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="meeting-date" style={labelStyle}>
                Date and time *
              </label>
              <input
                id="meeting-date"
                type="datetime-local"
                value={meetingDate}
                onChange={(event) => setMeetingDate(event.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="meeting-link" style={labelStyle}>
                Google Meet link *
              </label>
              <input
                id="meeting-link"
                type="url"
                value={meetUrl}
                onChange={(event) => setMeetUrl(event.target.value)}
                required
                placeholder="https://meet.google.com/..."
                style={inputStyle}
              />
              <p className="mt-2 text-xs text-gray-500">
                Create the meeting in Google Meet or Google Calendar, then paste
                its link here.
              </p>
            </div>

            <div>
              <label htmlFor="meeting-description" style={labelStyle}>
                Description or agenda
              </label>
              <textarea
                id="meeting-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={5000}
                placeholder="Meeting purpose, agenda and preparation..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Schedule meeting"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-gray-700 px-5 py-3 text-sm text-gray-200 hover:border-gray-500"
                >
                  Cancel editing
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">
            Upcoming meetings
          </h2>
          <span className="rounded-full border border-green-900 bg-green-950/50 px-3 py-1 text-xs text-green-300">
            {upcomingMeetings.length} scheduled
          </span>
        </div>

        {loading ? (
          <p className="rounded-xl border border-gray-800 p-6 text-sm text-gray-400">
            Loading meetings...
          </p>
        ) : upcomingMeetings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 p-8 text-center">
            <p className="font-medium text-gray-200">No upcoming meetings</p>
            <p className="mt-2 text-sm text-gray-500">
              {isAdmin
                ? "Use the form above to schedule the first meeting."
                : "Upcoming meetings will appear here when they are scheduled."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {upcomingMeetings.map(renderMeeting)}
          </div>
        )}
      </section>

      {pastMeetings.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">
            Previous meetings
          </h2>
          <div className="grid gap-4">
            {pastMeetings.map(renderMeeting)}
          </div>
        </section>
      )}
    </section>
  );
}
