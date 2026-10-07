import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import Modal from "../ui/Modal";
import CalendarFrame from "./CalendarFrame";
import { Button, Notice, TextField } from "../ui";
import { useAuth } from "../../context/AuthContext";
import { firestoreMessage } from "../../hooks/useQuery";
import { saveCalendarConfig } from "../../firebase/calendarConfig";
import { parseCalendarInput } from "../../lib/googleCalendar";

const STEPS = [
  "Open Google Calendar.",
  "Find the church calendar.",
  "Open Settings and sharing.",
  "Find Integrate calendar.",
  "Copy the Embed code or calendar URL.",
  "Paste it below.",
];

// Two steps: paste + test (we check the link and show a live preview), then
// confirm. Nothing is saved until the leader confirms the preview looks right.
export default function ConnectCalendarModal({ onClose, onConnected, replacing = false }) {
  const { user, name } = useAuth();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleTest = (e) => {
    e.preventDefault();
    const result = parseCalendarInput(input);
    if (result.error) {
      setError(result.error);
      setParsed(null);
      return;
    }
    setError("");
    setParsed(result);
  };

  const handleConnect = async () => {
    setSaving(true);
    setError("");
    try {
      await saveCalendarConfig(parsed, { uid: user.uid, name });
      onConnected();
      onClose();
    } catch (err) {
      setError(firestoreMessage(err));
      setSaving(false);
    }
  };

  const title = replacing ? "Change Google Calendar" : "Connect Google Calendar";

  if (parsed) {
    return (
      <Modal
        title={title}
        onClose={onClose}
        footer={
          <>
            <Button onClick={() => setParsed(null)} disabled={saving}>Back</Button>
            <Button variant="primary" icon={CalendarCheck} onClick={handleConnect} loading={saving}>
              {saving ? "Connecting…" : "Connect This Calendar"}
            </Button>
          </>
        }
      >
        <div className="form">
          <Notice tone="success">
            Found {parsed.calendarIds.length === 1 ? "a calendar" : `${parsed.calendarIds.length} calendars`}:{" "}
            <span style={{ overflowWrap: "anywhere" }}>{parsed.calendarIds.join(", ")}</span>
          </Notice>
          {error && <Notice tone="error">{error}</Notice>}
          <CalendarFrame config={parsed} height={360} />
          <Notice>
            Check the preview shows the church's events. If it's empty or shows an error, the calendar isn't public yet:
            in Google Calendar open Settings and sharing → Access permissions and turn on "Make available to public".
          </Notice>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="connect-calendar" variant="primary">Test &amp; Connect</Button>
        </>
      }
    >
      <form id="connect-calendar" className="form" onSubmit={handleTest} noValidate>
        <div>
          <strong>Step 1 — Google Calendar</strong>
          <ol className="steps">
            {STEPS.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <TextField
          label="Calendar URL / Embed Code"
          id="calendar-input"
          as="textarea"
          rows={4}
          spellCheck={false}
          placeholder={'<iframe src="https://calendar.google.com/calendar/embed?src=…"></iframe>'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </form>
    </Modal>
  );
}
