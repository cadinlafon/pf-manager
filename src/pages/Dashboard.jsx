import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CalendarPlus, HandCoins, HeartHandshake, Mail, Megaphone, Package, PackagePlus, UserPlus, Users, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAnnouncements } from "../context/AnnouncementsContext";
import { useCalendarConfig } from "../hooks/useCalendarConfig";
import { useQuery } from "../hooks/useQuery";
import { listPeople } from "../firebase/people";
import { listSignups } from "../firebase/volunteers";
import { emailListStore, inventoryStore } from "../firebase/store";
import { FINANCE_ENABLED } from "../lib/features";
import { displayStatus, formatTimeRange, sortSignups, totals } from "../lib/volunteers";
import { formatDay } from "../lib/format";
import CalendarFrame from "../components/calendar/CalendarFrame";
import { ProgressBar } from "../components/volunteers/VolunteerBits";
import { AnnouncementAuthor, AttachmentLink } from "./Announcements";
import { Badge, Card, EmptyState, ErrorState, LoadingState } from "../components/ui";

const QUICK_ACTIONS = [
  { label: "Add Person", to: "/people", state: { openAdd: true }, icon: UserPlus },
  // Finance shortcuts only exist while the Finance page is switched on.
  ...(FINANCE_ENABLED ? [{ label: "Record Tithe", to: "/finance", hash: "#record-tithe", icon: HandCoins }] : []),
  { label: "View Calendar", to: "/calendar", icon: CalendarDays },
  { label: "Add Inventory Item", to: "/inventory", state: { openAdd: true }, icon: PackagePlus },
  { label: "New Announcement", to: "/announcements", state: { openNew: true }, icon: Megaphone },
  { label: "Email List", to: "/email-list", icon: Mail },
];

const AGENDA = { mode: "AGENDA", size: "compact", weekStart: "1" };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function StatTile({ to, label, icon: Icon, query, value }) {
  return (
    <Link to={to} className="card stat stat-link">
      <div className="stat-label">
        <span>{label}</span>
        <Icon size={18} aria-hidden />
      </div>
      <div className="stat-value">{query.data ? value : query.error ? "—" : "…"}</div>
    </Link>
  );
}

export default function Dashboard() {
  const { name, role } = useAuth();
  const news = useAnnouncements();
  const calendar = useCalendarConfig();
  const people = useQuery(listPeople);
  const signups = useQuery(listSignups);
  const inventory = useQuery(inventoryStore.list);
  const contacts = useQuery(emailListStore.list);

  const firstName = name.split(" ")[0];
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Upcoming signups that still need people.
  const needs = useMemo(
    () => sortSignups((signups.data || []).filter((signup) => displayStatus(signup) === "Open")).slice(0, 4),
    [signups.data]
  );
  const openSpots = useMemo(
    () => (signups.data || []).filter((signup) => displayStatus(signup) === "Open").reduce((sum, signup) => sum + totals(signup).available, 0),
    [signups.data]
  );
  return (
    <>
      <div className="welcome">
        <h1>{greeting()}, {firstName}</h1>
        <p>{dateLabel}</p>
      </div>

      <div className="stack">
        <div className="grid cols-4">
          <StatTile to="/people" label="People" icon={Users} query={people} value={people.data?.length} />
          <StatTile to="/volunteers" label="Volunteer Spots Open" icon={HeartHandshake} query={signups} value={openSpots} />
          <StatTile to="/inventory" label="Inventory Items" icon={Package} query={inventory} value={inventory.data?.length} />
          <StatTile to="/email-list" label="Email Contacts" icon={Mail} query={contacts} value={contacts.data?.length} />
        </div>

        <Card title="Quick Actions" icon={Zap}>
          <div className="quick-actions">
            {QUICK_ACTIONS.map(({ label, to, hash, state, icon: Icon }) => (
              <Link key={label} to={{ pathname: to, hash }} state={state} className="quick-action">
                <span className="qa-icon"><Icon size={18} aria-hidden /></span>
                {label}
              </Link>
            ))}
          </div>
        </Card>

        <div className="grid cols-2" style={{ alignItems: "start" }}>
          <Card title="Upcoming Events" icon={CalendarPlus} action={<Link to="/calendar" className="btn ghost">Calendar</Link>}>
            {calendar.loading ? (
              <LoadingState rows={4} />
            ) : calendar.error ? (
              <ErrorState message={calendar.error} onRetry={calendar.reload} />
            ) : calendar.config ? (
              <CalendarFrame config={calendar.config} display={AGENDA} height={380} />
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No calendar connected"
                message={role === "main_admin" ? "Connect the church's Google Calendar to see upcoming events here." : "A main admin can connect the church's Google Calendar to show events here."}
                action={role === "main_admin" && <Link to="/settings" state={{ connectCalendar: true }} className="btn primary">Connect Google Calendar</Link>}
              />
            )}
          </Card>

          <Card title="Volunteers Needed" icon={HeartHandshake} action={<Link to="/volunteers" className="btn ghost">View all</Link>}>
            {signups.loading && !signups.data ? (
              <LoadingState rows={4} />
            ) : signups.error ? (
              <ErrorState message={signups.error} onRetry={signups.reload} />
            ) : needs.length === 0 ? (
              <EmptyState icon={HeartHandshake} title="No open volunteer signups" message="Signups that still need people will show up here."
                action={<Link to="/volunteers/new" className="btn">Create Signup</Link>} />
            ) : (
              <ul className="list">
                {needs.map((signup) => {
                  const { filled, needed, available } = totals(signup);
                  const time = formatTimeRange(signup);
                  return (
                    <li key={signup.id} className="row" style={{ alignItems: "flex-start" }}>
                      <span className="date-chip">
                        <small>{new Date(`${signup.date}T00:00`).toLocaleDateString("en-US", { month: "short" })}</small>
                        <b>{Number(signup.date.slice(8))}</b>
                      </span>
                      <div className="row-main">
                        <Link to={`/volunteers/${signup.id}`} className="row-title card-link">{signup.title}</Link>
                        <div className="row-sub">{[formatDay(signup.date), time, signup.location].filter(Boolean).join(" · ")}</div>
                        <div className="row-sub" style={{ margin: "4px 0 6px" }}>{filled} of {needed} filled · {available} still needed</div>
                        <ProgressBar filled={filled} needed={needed} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card
          title="Announcements"
          icon={Megaphone}
          action={<Link to="/announcements" className="btn ghost">{news.items.length > 0 ? "View all" : "Post one"}</Link>}
        >
          {news.loading ? (
            <LoadingState rows={2} />
          ) : news.error ? (
            <ErrorState message={news.error} />
          ) : news.items.length === 0 ? (
            <EmptyState icon={Megaphone} title="No announcements" message="Announcements from managers will show up here." />
          ) : (
            <ul className="list">
              {news.items.slice(0, 3).map((item) => (
                <li key={item.id} className="row" style={{ alignItems: "flex-start" }}>
                  <div className="row-main">
                    <div className="row-title" style={{ whiteSpace: "normal" }}>
                      {item.title} {news.isUnread(item) && <Badge tone="info">New</Badge>}
                    </div>
                    <div className="row-sub clamp-2" style={{ margin: "2px 0 8px" }}>{item.body}</div>
                    {item.attachment && <div style={{ marginBottom: 8 }}><AttachmentLink attachment={item.attachment} /></div>}
                    <AnnouncementAuthor item={item} />
                    {item.commentCount > 0 && (
                      <div className="row-sub" style={{ marginTop: 4 }}>
                        {item.commentCount} {item.commentCount === 1 ? "comment" : "comments"}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
