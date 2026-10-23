"use client";

import { useState } from "react";

const navigation = [
  { name: "Overview", icon: "◫" },
  { name: "Announcements", icon: "▤" },
  { name: "Discussions", icon: "◎" },
  { name: "School reports", icon: "▥" },
  { name: "Meetings", icon: "▦" },
  { name: "Schools", icon: "⌂" },
];

const announcements = [
  {
    category: "NATIONAL UPDATE",
    title: "Welcome to Patriotism School Hub",
    description:
      "A central space for school coordinators to share updates, exchange ideas and coordinate patriotism programmes.",
    date: "Platform announcement",
    color: "gold",
  },
  {
    category: "PROGRAMME PLANNING",
    title: "Share your school's programme priorities",
    description:
      "Coordinators will be able to submit suggestions and highlight challenges affecting activities at their schools.",
    date: "Planning and coordination",
    color: "blue",
  },
  {
    category: "COMMUNITY",
    title: "Building a stronger coordination network",
    description:
      "Use the hub to support constructive discussion, collaboration and the exchange of practical ideas.",
    date: "Community update",
    color: "green",
  },
];

const activities = [
  {
    initials: "NA",
    title: "National announcements",
    detail: "Updates shared with school coordinators",
    status: "Coming soon",
  },
  {
    initials: "SR",
    title: "School reports",
    detail: "Suggestions, challenges and follow-up",
    status: "Coming soon",
  },
  {
    initials: "MT",
    title: "Programme meetings",
    detail: "Meeting schedules and joining links",
    status: "Coming soon",
  },
];

export default function Home() {
  const [activePage, setActivePage] = useState("Overview");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const visibleAnnouncements = announcements.filter((item) =>
    `${item.title} ${item.description} ${item.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function choosePage(name: string) {
    setActivePage(name);
    setNotice(
      name === "Overview"
        ? ""
        : `${name} workspace selected. Database and account features will be connected in the next stages.`,
    );
  }

  function quickAction(name: string) {
    setNotice(
      `${name} is planned for the next development stage. This prototype does not submit or save real information yet.`,
    );
  }

  return (
    <main className="hub">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-emblem">P</div>
          <div>
            <div className="brand-name">PATRIOTISM</div>
            <div className="brand-subtitle">SCHOOL HUB</div>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace">
          <div className="workspace-icon">UG</div>
          <div className="workspace-copy">
            <strong>National Coordination</strong>
            <span>Uganda · Pilot workspace</span>
          </div>
          <span className="workspace-arrow">⌄</span>
        </div>

        <div className="nav-label">MAIN MENU</div>
        <nav className="navigation" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              className={`nav-item ${activePage === item.name ? "active" : ""}`}
              key={item.name}
              onClick={() => choosePage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
              {item.name === "School reports" && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-symbol">✳</div>
            <strong>Working together</strong>
            <p>A shared space for better coordination across schools.</p>
          </div>
          <div className="profile">
            <div className="avatar">GU</div>
            <div className="profile-copy">
              <strong>Guest user</strong>
              <span>Preview mode</span>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Patriotism Hub</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{activePage}</strong>
          </div>
          <div className="topbar-right">
            <span className="preview-badge">
              <span className="status-dot" />
              Prototype
            </span>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() =>
                setNotice("Notifications will be available after account setup.")
              }
            >
              ♧
            </button>
            <div className="top-avatar">GU</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                NATIONAL COORDINATION PLATFORM
              </div>
              <h1>
                {activePage === "Overview"
                  ? "Welcome to the Hub"
                  : activePage}
              </h1>
              <p className="welcome-description">
                {activePage === "Overview"
                  ? "One connected space to coordinate patriotism programmes across Uganda's schools."
                  : `A shared workspace for ${activePage.toLowerCase()} and national school coordination.`}
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => quickAction("Create announcement")}
            >
              <span>＋</span> New announcement
            </button>
          </section>

          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}

          <section className="welcome-banner">
            <div className="banner-content">
              <div className="banner-tag">
                <span className="banner-tag-dot" />
                A SHARED NATIONAL MISSION
              </div>
              <h2>Connected schools. Shared purpose.</h2>
              <p>
                Bringing coordinators together to share information,
                strengthen collaboration and support patriotism programmes.
              </p>
              <button
                className="banner-button"
                onClick={() => choosePage("Announcements")}
              >
                Explore announcements <span>→</span>
              </button>
            </div>
            <div className="banner-art" aria-hidden="true">
              <div className="art-orbit orbit-one" />
              <div className="art-orbit orbit-two" />
              <div className="art-circle">
                <span>UG</span>
                <div className="art-star">✦</div>
              </div>
              <div className="art-caption">ONE COMMUNITY</div>
            </div>
          </section>

          <section className="section-heading">
            <div>
              <h2>Coordination overview</h2>
              <p>Your programme information, organised in one place.</p>
            </div>
            <span className="period-label">PILOT WORKSPACE</span>
          </section>

          <section className="stat-grid">
            <article className="stat-card">
              <div className="stat-top">
                <span className="stat-icon icon-schools">⌂</span>
                <span className="stat-label">NETWORK</span>
              </div>
              <div className="stat-value">—</div>
              <div className="stat-title">Registered schools</div>
              <div className="stat-foot">Available after database setup</div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span className="stat-icon icon-updates">▤</span>
                <span className="stat-label">INFORMATION</span>
              </div>
              <div className="stat-value">03</div>
              <div className="stat-title">Sample announcements</div>
              <div className="stat-foot">Illustrative content only</div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span className="stat-icon icon-reports">▥</span>
                <span className="stat-label">FOLLOW-UP</span>
              </div>
              <div className="stat-value">—</div>
              <div className="stat-title">Open school issues</div>
              <div className="stat-foot">Issue tracking not connected yet</div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span className="stat-icon icon-meetings">▦</span>
                <span className="stat-label">SCHEDULING</span>
              </div>
              <div className="stat-value">—</div>
              <div className="stat-title">Upcoming meetings</div>
              <div className="stat-foot">Meeting service not connected yet</div>
            </article>
          </section>

          <div className="content-grid">
            <section className="panel announcements-panel">
              <div className="panel-heading">
                <div>
                  <h2>Latest announcements</h2>
                  <p>Important information for the network</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => choosePage("Announcements")}
                >
                  View all <span>→</span>
                </button>
              </div>

              <div className="search-box">
                <span>⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search announcements..."
                  aria-label="Search announcements"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="announcement-list">
                {visibleAnnouncements.map((item) => (
                  <article className="announcement" key={item.title}>
                    <div className={`announcement-marker ${item.color}`}>
                      {item.color === "gold"
                        ? "✦"
                        : item.color === "blue"
                          ? "↗"
                          : "◎"}
                    </div>
                    <div className="announcement-body">
                      <div className="announcement-category">
                        {item.category}
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <div className="announcement-date">{item.date}</div>
                    </div>
                    <span className="announcement-arrow">↗</span>
                  </article>
                ))}
                {visibleAnnouncements.length === 0 && (
                  <div className="empty-state">
                    No announcements match your search.
                  </div>
                )}
              </div>
            </section>

            <section className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <h2>Programme centre</h2>
                  <p>Tools for coordinating activities</p>
                </div>
                <span className="panel-more">•••</span>
              </div>

              <div className="activity-list">
                {activities.map((item) => (
                  <button
                    className="activity-item"
                    key={item.title}
                    onClick={() => quickAction(item.title)}
                  >
                    <div className="activity-avatar">{item.initials}</div>
                    <div className="activity-copy">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                      <span className="coming-soon">{item.status}</span>
                    </div>
                    <span className="activity-arrow">→</span>
                  </button>
                ))}
              </div>

              <div className="coordination-note">
                <span className="note-icon">✧</span>
                <div>
                  <strong>Designed for collaboration</strong>
                  <p>
                    Share ideas, raise challenges and coordinate action
                    across the school network.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <footer className="footer">
            <span>Patriotism School Hub</span>
            <span>Early prototype · Sample data only</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
