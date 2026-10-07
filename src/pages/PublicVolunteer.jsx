import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarX, UserPlus } from "lucide-react";
import { useQuery } from "../hooks/useQuery";
import { cancelSelfSignup, getSignup, listRoster, selfSignup } from "../firebase/volunteers";
import { displayStatus, totals } from "../lib/volunteers";
import Modal from "../components/ui/Modal";
import { ProgressBar, SignupMeta } from "../components/volunteers/VolunteerBits";
import { Badge, Button, EmptyState, LoadingState, Notice, TextField } from "../components/ui";

// Public volunteer signup page, in the spirit of a paper signup sheet: anyone
// with the link sees the event, each position and the names of who has signed
// up, and can take an open spot without an account. Only names are public —
// emails and phone numbers are never loaded here.

const CLOSED_MESSAGE = {
  Full: "Every spot is filled. Thank you!",
  Closed: "This signup is closed.",
  Past: "This event has already happened.",
};

// A visitor's own signups are remembered in this browser only, with the
// secret that lets them cancel. { [signupId]: [{ volunteerId, secret, positionId, name }] }
const MINE_KEY = "pf-volunteer-my-signups";
function readMine(signupId) {
  try {
    return JSON.parse(localStorage.getItem(MINE_KEY))?.[signupId] || [];
  } catch {
    return [];
  }
}
function writeMine(signupId, entries) {
  try {
    const all = JSON.parse(localStorage.getItem(MINE_KEY)) || {};
    if (entries.length) all[signupId] = entries;
    else delete all[signupId];
    localStorage.setItem(MINE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable — signing up still works, cancelling from here won't.
  }
}

function SignUpModal({ signup, position, onClose, onDone }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [website, setWebsite] = useState(""); // honeypot: real people never see or fill this
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { name: form.name.trim().slice(0, 100), email: form.email.trim(), phone: form.phone.trim().slice(0, 40) };
    if (!data.name) return setError("Please enter your name.");
    if (!data.email && !data.phone) return setError("Please add an email or phone number so the church can reach you.");
    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) return setError("Please enter a valid email address.");

    setBusy(true);
    setError("");
    try {
      const saved = website ? null : await selfSignup(signup.id, position.id, data);
      onDone(saved && { ...saved, positionId: position.id, name: data.name });
      onClose();
    } catch (err) {
      // Rules refuse the write if the spot filled or the signup closed in the meantime.
      setError(
        err.code === "permission-denied"
          ? "That spot is no longer available — it may have just been taken. Close this and check what's still open."
          : "Something went wrong. Please check your connection and try again."
      );
      onDone(null);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Sign up — ${position.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="self-signup" variant="primary" loading={busy}>{busy ? "Signing up…" : "Sign Up"}</Button>
        </>
      }
    >
      <form id="self-signup" className="form" onSubmit={handleSubmit} noValidate>
        {position.description && <p className="row-sub">{position.description}</p>}
        {error && <Notice tone="error">{error}</Notice>}
        <TextField label="Your Name" id="ss-name" autoComplete="name" value={form.name} onChange={set("name")} />
        <TextField label="Email" id="ss-email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} />
        <TextField label="Phone" id="ss-phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set("phone")} />
        <span className="row-sub">
          Your name will be shown on this page so others can see who's helping. Your email and phone are only seen by the people who manage this signup.
        </span>
        <div className="sr-only" aria-hidden>
          <label>Leave this empty<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
        </div>
      </form>
    </Modal>
  );
}

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";

function PositionCard({ position, names, mine, canSignUp, canCancel, busy, onSignUp, onCancel }) {
  const filled = Math.min(names.length, position.spotsNeeded);
  const open = Math.max(0, position.spotsNeeded - names.length);

  return (
    <section className="card position-card">
      <div className="row" style={{ padding: 0, alignItems: "flex-start" }}>
        <div className="row-main">
          <h3>{position.name}</h3>
          {position.description && <p className="row-sub">{position.description}</p>}
        </div>
        <Badge tone={open > 0 ? "success" : ""}>{open > 0 ? `${open} ${open === 1 ? "spot" : "spots"} open` : "Full"}</Badge>
      </div>

      <div>
        <div className="progress-label">
          <strong>{filled} of {position.spotsNeeded} filled</strong>
        </div>
        <ProgressBar filled={filled} needed={position.spotsNeeded} />
      </div>

      <ul className="name-list">
        {names.map((entry) => {
          const own = mine.find((item) => item.volunteerId === entry.id);
          return (
            <li key={entry.id} className={own ? "own" : ""}>
              <span className="avatar sm">{initials(entry.name)}</span>
              <span className="name">{entry.name}{own && <em> (you)</em>}</span>
              {own && canCancel && (
                <button type="button" className="link-btn" disabled={busy === entry.id} onClick={() => onCancel(own, position.name)}>
                  {busy === entry.id ? "Cancelling…" : "Cancel"}
                </button>
              )}
            </li>
          );
        })}
        {Array.from({ length: open }, (_, i) => (
          <li key={`open-${i}`} className="open-slot">
            <span className="avatar sm empty" aria-hidden />
            <span className="name">Open spot</span>
          </li>
        ))}
      </ul>

      {canSignUp && open > 0 && (
        <Button variant="primary" block icon={UserPlus} onClick={onSignUp}>Sign Up</Button>
      )}
    </section>
  );
}

function SignupView({ signup, roster, onChanged }) {
  const [mine, setMine] = useState(() => readMine(signup.id));
  const [signingUpFor, setSigningUpFor] = useState(null);
  const [justSignedUp, setJustSignedUp] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const status = displayStatus(signup);
  const { filled, needed } = totals(signup);

  const remember = (entries) => {
    setMine(entries);
    writeMine(signup.id, entries);
  };

  const handleDone = (saved) => {
    if (saved) {
      remember([...mine, saved]);
      setJustSignedUp(signup.positions.find((p) => p.id === saved.positionId)?.name || "");
    }
    onChanged();
  };

  const handleCancel = async (entry, positionName) => {
    if (!window.confirm(`Cancel your signup for ${positionName}?`)) return;
    setBusy(entry.volunteerId);
    setError("");
    setJustSignedUp("");
    try {
      await cancelSelfSignup(signup.id, entry);
      remember(mine.filter((item) => item.volunteerId !== entry.volunteerId));
      onChanged();
    } catch {
      setError("We couldn't cancel that here. It may already have been removed — please contact the church.");
    }
    setBusy("");
  };

  return (
    <div className="stack">
      <section className="card auth-card">
        <div className="form">
          <div>
            <h2>{signup.title}</h2>
            <div style={{ marginTop: 8 }}><SignupMeta signup={signup} /></div>
            {signup.description && <p className="lede" style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{signup.description}</p>}
          </div>
          <div>
            <div className="progress-label">
              <strong>{filled} of {needed} spots filled</strong>
              <span>{Math.max(0, needed - filled)} still needed</span>
            </div>
            <ProgressBar filled={filled} needed={needed} />
          </div>
          {justSignedUp && <Notice tone="success">You're signed up for {justSignedUp}. Thank you for serving!</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          {status !== "Open" && <Notice tone="warn">{CLOSED_MESSAGE[status]}</Notice>}
          {mine.length > 0 && !signup.allowCancellation && <span className="row-sub">Need to cancel? Please contact the church.</span>}
        </div>
      </section>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        {signup.positions.map((position) => (
          <PositionCard
            key={position.id}
            position={position}
            names={roster.filter((entry) => entry.positionId === position.id)}
            mine={mine}
            canSignUp={status === "Open"}
            canCancel={signup.allowCancellation && status !== "Past"}
            busy={busy}
            onSignUp={() => { setJustSignedUp(""); setSigningUpFor(position); }}
            onCancel={handleCancel}
          />
        ))}
      </div>

      {signingUpFor && <SignUpModal signup={signup} position={signingUpFor} onClose={() => setSigningUpFor(null)} onDone={handleDone} />}
    </div>
  );
}

export default function PublicVolunteer() {
  const { id } = useParams();
  const loader = useCallback(async () => {
    const signup = await getSignup(id);
    if (!signup || signup.status === "draft") return null;
    return { signup, roster: await listRoster(id) };
  }, [id]);
  const query = useQuery(loader);
  const data = query.data && !Array.isArray(query.data) ? query.data : null;

  let body;
  if (query.loading && !data) {
    body = <div className="card auth-card"><LoadingState rows={5} /></div>;
  } else if (!data) {
    // Missing, still a draft, or blocked by rules — all look the same to the public.
    body = (
      <div className="card auth-card">
        <EmptyState icon={CalendarX} title="Signup not available" message="This link may be mistyped, or the signup may not be open yet." />
      </div>
    );
  } else {
    body = <SignupView signup={data.signup} roster={data.roster} onChanged={query.reload} />;
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <img src="/icons/icon-192.png" alt="" />
        <h1>Palouse Fellowship</h1>
        <p>Volunteer Signup</p>
      </div>
      <div className="auth-body" style={{ maxWidth: 860 }}>{body}</div>
    </div>
  );
}
