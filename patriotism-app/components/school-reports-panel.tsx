"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  role: string;
  approval_status: string;
  school_id: string | null;
  full_name: string | null;
};

type School = {
  id: string;
  name: string;
};

type SchoolReport = {
  id: string;
  school_id: string | null;
  submitted_by: string;
  title: string;
  description: string;
  category: string;
  status: string;
  administrator_notes: string | null;
  created_at: string;
  updated_at: string;
};

const categories = [
  "Patriotism activities",
  "Resources and materials",
  "Infrastructure",
  "School coordination",
  "Suggestion",
  "Other issue",
];

const statuses = ["open", "under_review", "resolved"];

const statusLabels: Record<string, string> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
};

export default function SchoolReportsPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [reports, setReports] = useState<SchoolReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [schoolId, setSchoolId] = useState("");
  const [editingReportId, setEditingReportId] = useState("");
  const [editingStatus, setEditingStatus] = useState("open");
  const [editingNotes, setEditingNotes] = useState("");

  const isAdmin = profile?.role === "national_admin";

  const loadReports = useCallback(async (currentProfile: Profile) => {
    let query = supabase
      .from("school_reports")
      .select(
        "id, school_id, submitted_by, title, description, category, status, administrator_notes, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("submitted_by", currentProfile.id);
    }

    const { data, error } = await query;

    if (error) throw error;

    setReports((data ?? []) as SchoolReport[]);
  }, [isAdmin]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Please sign in to access school reports.");
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, approval_status, school_id, full_name")
        .eq("id", authData.user.id)
        .single();

      if (profileError) throw profileError;

      const currentProfile = profileData as Profile;

      if (currentProfile.approval_status !== "approved") {
        throw new Error(
          "Your account must be approved before you can access reports.",
        );
      }

      setProfile(currentProfile);

      const { data: schoolData, error: schoolError } = await supabase
        .from("schools")
        .select("id, name")
        .order("name", { ascending: true });

      if (schoolError) throw schoolError;

      setSchools((schoolData ?? []) as School[]);

      if (currentProfile.role !== "national_admin" && !currentProfile.school_id) {
        setErrorMessage(
          "Your account is not linked to a school yet. Ask the National Administrator to link your account to your school before submitting reports.",
        );
        setReports([]);
        return;
      }

      await loadReports(currentProfile);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load school reports.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadReports]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      if (profile.approval_status !== "approved") {
        throw new Error("An approved account is required.");
      }

      const reportSchoolId = isAdmin
        ? schoolId || null
        : profile.school_id;

      if (!reportSchoolId) {
        throw new Error("Select the school this report concerns.");
      }

      const { error } = await supabase.from("school_reports").insert({
        school_id: reportSchoolId,
        submitted_by: profile.id,
        title: title.trim(),
        description: description.trim(),
        category,
        status: "open",
      });

      if (error) throw error;

      setTitle("");
      setDescription("");
      setCategory(categories[0]);
      setSchoolId("");
      setShowForm(false);
      setMessage("Report submitted successfully.");
      await loadReports(profile);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to submit the report.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditing(report: SchoolReport) {
    setEditingReportId(report.id);
    setEditingStatus(report.status);
    setEditingNotes(report.administrator_notes ?? "");
    setErrorMessage("");
    setMessage("");
  }

  async function saveReportUpdate(
    event: FormEvent<HTMLFormElement>,
    reportId: string,
  ) {
    event.preventDefault();

    if (!isAdmin || !profile) return;

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const { error } = await supabase
        .from("school_reports")
        .update({
          status: editingStatus,
          administrator_notes: editingNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      if (error) throw error;

      setEditingReportId("");
      setMessage("Report status and administrator notes updated.");
      await loadReports(profile);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update this report.",
      );
    } finally {
      setSaving(false);
    }
  }

  const panelStyle = {
    border: "1px solid #26352B",
    borderRadius: 16,
    background: "#101511",
    padding: 20,
    minWidth: 0,
  } as const;

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "11px 12px",
    border: "1px solid #344139",
    borderRadius: 9,
    background: "#080B09",
    color: "#FFFFFF",
    marginTop: 6,
  } as const;

  const buttonStyle = {
    border: "1px solid #31543A",
    borderRadius: 9,
    padding: "10px 14px",
    background: "#163820",
    color: "#FFFFFF",
    cursor: "pointer",
  } as const;

  if (loading) {
    return (
      <section style={panelStyle}>
        <p style={{ color: "#D1D5DB" }}>Loading school reports…</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section style={panelStyle}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>
          School reports unavailable
        </h2>
        <p role="alert" style={{ color: "#FCA5A5", marginTop: 10 }}>
          {errorMessage || "Unable to verify your account."}
        </p>
        <button
          type="button"
          onClick={() => void loadData()}
          style={{ ...buttonStyle, marginTop: 14 }}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section style={{ color: "#FFFFFF", display: "grid", gap: 20 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              color: "#4ADE80",
              fontSize: 11,
              letterSpacing: 2,
              fontWeight: 700,
            }}
          >
            SCHOOL SUPPORT AND COORDINATION
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 5 }}>
            School Reports
          </h1>
          <p style={{ color: "#A7B0A9", marginTop: 5 }}>
            Report issues, submit suggestions and track action taken.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void loadData()}
            style={buttonStyle}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            style={{ ...buttonStyle, background: "#15803D" }}
          >
            {showForm ? "Cancel" : "+ Submit report"}
          </button>
        </div>
      </header>

      {message && (
        <div
          role="status"
          style={{
            padding: 12,
            border: "1px solid #166534",
            borderRadius: 10,
            background: "#102417",
            color: "#86EFAC",
          }}
        >
          {message}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: 12,
            border: "1px solid #7F1D1D",
            borderRadius: 10,
            background: "#2A1111",
            color: "#FCA5A5",
            overflowWrap: "anywhere",
          }}
        >
          {errorMessage}
        </div>
      )}

      {showForm && (
        <form onSubmit={submitReport} style={panelStyle}>
          <h2 style={{ fontSize: 19, fontWeight: 700 }}>
            Submit a school report
          </h2>
          <p style={{ color: "#A7B0A9", fontSize: 13, marginTop: 5 }}>
            Provide enough detail for the national team to understand and act on
            the issue or suggestion.
          </p>

          {isAdmin && (
            <label style={{ display: "block", marginTop: 14 }}>
              School concerned
              <select
                value={schoolId}
                onChange={(event) => setSchoolId(event.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Select a school…</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!isAdmin && (
            <p style={{ color: "#A7B0A9", fontSize: 13, marginTop: 12 }}>
              Your report will be linked to your registered school.
            </p>
          )}

          <label style={{ display: "block", marginTop: 14 }}>
            Report title
            <input
              style={inputStyle}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={180}
              placeholder="Briefly describe the issue or suggestion"
            />
          </label>

          <label style={{ display: "block", marginTop: 14 }}>
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              style={inputStyle}
              required
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "block", marginTop: 14 }}>
            Details
            <textarea
              style={inputStyle}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              minLength={5}
              maxLength={10000}
              rows={5}
              placeholder="Explain the situation, its effect, and any action you recommend…"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            style={{
              ...buttonStyle,
              marginTop: 14,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Submitting…" : "Submit report"}
          </button>
        </form>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
          gap: 12,
        }}
      >
        {[
          {
            label: "Total reports",
            count: reports.length,
          },
          {
            label: "Open",
            count: reports.filter((report) => report.status === "open").length,
          },
          {
            label: "Under review",
            count: reports.filter(
              (report) => report.status === "under_review",
            ).length,
          },
          {
            label: "Resolved",
            count: reports.filter((report) => report.status === "resolved")
              .length,
          },
        ].map((item) => (
          <div key={item.label} style={{ ...panelStyle, padding: 16 }}>
            <p style={{ color: "#A7B0A9", fontSize: 12 }}>{item.label}</p>
            <p
              style={{
                fontSize: 28,
                fontWeight: 800,
                marginTop: 6,
                color: "#4ADE80",
              }}
            >
              {item.count}
            </p>
          </div>
        ))}
      </div>

      <section style={panelStyle}>
        <h2 style={{ fontSize: 20, fontWeight: 750 }}>
          {isAdmin ? "All school reports" : "My school reports"}
        </h2>
        <p style={{ color: "#A7B0A9", fontSize: 13, marginTop: 5 }}>
          {isAdmin
            ? "Review submitted issues and record the action taken."
            : "Follow the status of reports you have submitted."}
        </p>

        {reports.length === 0 ? (
          <div
            style={{
              marginTop: 16,
              padding: 20,
              border: "1px dashed #344139",
              borderRadius: 12,
            }}
          >
            <p style={{ fontWeight: 600 }}>No reports to display</p>
            <p style={{ color: "#A7B0A9", fontSize: 13, marginTop: 5 }}>
              Submitted reports will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            {reports.map((report) => {
              const school = schools.find(
                (item) => item.id === report.school_id,
              );
              const editing = editingReportId === report.id;

              return (
                <article
                  key={report.id}
                  style={{
                    border: "1px solid #26352B",
                    borderRadius: 12,
                    padding: 16,
                    background: "#080B09",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                      <p
                        style={{
                          color: "#4ADE80",
                          fontSize: 11,
                          letterSpacing: 1,
                          fontWeight: 700,
                        }}
                      >
                        {report.category}
                      </p>
                      <h3
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          marginTop: 6,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {report.title}
                      </h3>
                    </div>

                    <span
                      style={{
                        border: "1px solid #31543A",
                        borderRadius: 20,
                        padding: "5px 10px",
                        color:
                          report.status === "resolved"
                            ? "#86EFAC"
                            : report.status === "under_review"
                              ? "#FDE68A"
                              : "#D1D5DB",
                        background:
                          report.status === "resolved"
                            ? "#102417"
                            : report.status === "under_review"
                              ? "#29230F"
                              : "#151A16",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statusLabels[report.status] ?? report.status}
                    </span>
                  </div>

                  <p
                    style={{
                      color: "#D1D5DB",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      marginTop: 12,
                      lineHeight: 1.65,
                    }}
                  >
                    {report.description}
                  </p>

                  <div
                    style={{
                      color: "#8D998F",
                      fontSize: 12,
                      display: "grid",
                      gap: 4,
                      marginTop: 12,
                    }}
                  >
                    <p>School: {school?.name ?? "School not specified"}</p>
                    <p>
                      Submitted: {new Date(report.created_at).toLocaleString()}
                    </p>
                    <p>
                      Last updated: {new Date(report.updated_at).toLocaleString()}
                    </p>
                  </div>

                  {report.administrator_notes && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: 12,
                        borderLeft: "3px solid #22C55E",
                        background: "#101A12",
                        borderRadius: "0 8px 8px 0",
                      }}
                    >
                      <p
                        style={{
                          color: "#86EFAC",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Administrator notes
                      </p>
                      <p
                        style={{
                          color: "#D1D5DB",
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          marginTop: 6,
                        }}
                      >
                        {report.administrator_notes}
                      </p>
                    </div>
                  )}

                  {isAdmin && (
                    <div style={{ marginTop: 16 }}>
                      {!editing ? (
                        <button
                          type="button"
                          onClick={() => startEditing(report)}
                          style={buttonStyle}
                        >
                          Update report
                        </button>
                      ) : (
                        <form
                          onSubmit={(event) =>
                            void saveReportUpdate(event, report.id)
                          }
                        >
                          <label style={{ display: "block" }}>
                            Report status
                            <select
                              value={editingStatus}
                              onChange={(event) =>
                                setEditingStatus(event.target.value)
                              }
                              style={inputStyle}
                            >
                              {statuses.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabels[status]}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label style={{ display: "block", marginTop: 12 }}>
                            Administrator notes
                            <textarea
                              value={editingNotes}
                              onChange={(event) =>
                                setEditingNotes(event.target.value)
                              }
                              style={inputStyle}
                              rows={3}
                              maxLength={5000}
                              placeholder="Record the action taken or feedback for the school…"
                            />
                          </label>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              marginTop: 12,
                            }}
                          >
                            <button
                              type="submit"
                              disabled={saving}
                              style={{
                                ...buttonStyle,
                                background: "#15803D",
                                opacity: saving ? 0.6 : 1,
                              }}
                            >
                              {saving ? "Saving…" : "Save update"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingReportId("")}
                              style={buttonStyle}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <p style={{ color: "#718075", fontSize: 12 }}>
        Reports are stored in Supabase. Only approved users should have access,
        according to the database permissions configured for this project.
      </p>
    </section>
  );
}
