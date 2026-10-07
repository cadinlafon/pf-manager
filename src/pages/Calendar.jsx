import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CalendarX, ExternalLink, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCalendarConfig, useCalendarDisplay } from "../hooks/useCalendarConfig";
import { firestoreMessage } from "../hooks/useQuery";
import { clearCalendarConfig } from "../firebase/calendarConfig";
import { buildEmbedUrl, SIZES, VIEW_MODES, WEEK_STARTS } from "../lib/googleCalendar";
import CalendarFrame from "../components/calendar/CalendarFrame";
import ConnectCalendarModal from "../components/calendar/ConnectCalendarModal";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Notice, PageHeader } from "../components/ui";

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CalendarSettings({ config, display, onDisplayChange, onChanged }) {
  const { role } = useAuth();
  const isMainAdmin = role === "main_admin";
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const disconnect = async () => {
    if (!window.confirm("Disconnect this Google Calendar? Managers will no longer see it in PF Management. The calendar itself isn't changed.")) return;
    setBusy(true);
    setError("");
    try {
      await clearCalendarConfig();
      onChanged();
    } catch (err) {
      setError(firestoreMessage(err));
      setBusy(false);
    }
  };

  return (
    <div id="calendar-settings" style={{ scrollMarginTop: 80 }}>
      <Card title="Calendar Settings" icon={SettingsIcon}>
        {error && <div style={{ marginBottom: 12 }}><Notice tone="error">{error}</Notice></div>}

        <div className="setting-row">
          <span>Connected calendar</span>
          <div style={{ minWidth: 0, textAlign: "right" }}>
            {config.calendarIds.map((id) => (
              <div key={id} className="row-sub" style={{ color: "var(--text)" }}>{id}</div>
            ))}
            {config.connectedByName && <div className="row-sub">Connected by {config.connectedByName}</div>}
          </div>
        </div>

        <Segmented label="View" options={VIEW_MODES} value={display.mode} onChange={(v) => onDisplayChange("mode", v)} />
        <Segmented label="Calendar display size" options={SIZES} value={display.size} onChange={(v) => onDisplayChange("size", v)} />
        <Segmented label="Week starts on" options={WEEK_STARTS} value={display.weekStart} onChange={(v) => onDisplayChange("weekStart", v)} />
        <p className="row-sub" style={{ marginTop: 10 }}>View, size and week start are saved on this device only.</p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <a className="btn" href={buildEmbedUrl(config, display)} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden />
            Open in Google Calendar
          </a>
          {isMainAdmin && <Button onClick={() => setChanging(true)}>Change Calendar</Button>}
          {isMainAdmin && <Button variant="danger" onClick={disconnect} loading={busy}>Disconnect Calendar</Button>}
        </div>
        {!isMainAdmin && <p className="row-sub" style={{ marginTop: 10 }}>Only a main admin can change or disconnect the calendar.</p>}
      </Card>

      {changing && <ConnectCalendarModal replacing onClose={() => setChanging(false)} onConnected={onChanged} />}
    </div>
  );
}

export default function Calendar() {
  const { role } = useAuth();
  const { config, loading, error, reload } = useCalendarConfig();
  const [display, updateDisplay] = useCalendarDisplay();

  if (loading) {
    return (
      <>
        <PageHeader title="Calendar" subtitle="Church events and schedule." />
        <Card><LoadingState rows={6} /></Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Calendar" subtitle="Church events and schedule." />
        <section className="card"><ErrorState message={error} onRetry={reload} /></section>
      </>
    );
  }

  if (!config) {
    return (
      <>
        <PageHeader title="Calendar" subtitle="Church events and schedule." />
        <section className="card">
          <EmptyState
            icon={CalendarX}
            title="No Google Calendar connected"
            message={
              role === "main_admin"
                ? "Connect a Google Calendar to see church events here."
                : "A main admin needs to connect the church's Google Calendar before events show here."
            }
            action={
              role === "main_admin" && (
                <Link to="/settings" state={{ connectCalendar: true }} className="btn primary">
                  Connect Google Calendar
                </Link>
              )
            }
          />
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Church events and schedule."
        action={
          <a href="#calendar-settings" className="btn">
            <SettingsIcon size={16} aria-hidden />
            Settings
          </a>
        }
      />
      <div className="stack">
        <Card title="Google Calendar" icon={CalendarDays} action={<Badge tone="success">Connected</Badge>}>
          <CalendarFrame config={config} display={display} />
        </Card>
        <CalendarSettings config={config} display={display} onDisplayChange={updateDisplay} onChanged={reload} />
      </div>
    </>
  );
}
