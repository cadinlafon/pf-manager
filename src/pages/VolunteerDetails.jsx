import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Download, Lock, LockOpen, Pencil, QrCode, Send, Share2, Trash2, UserPlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { addVolunteer, deleteSignup, getSignup, listVolunteers, removeVolunteer, setSignupStatus, syncRoster } from "../firebase/volunteers";
import { listPeople } from "../firebase/people";
import { filledFor, totals, volunteerUrl } from "../lib/volunteers";
import Modal from "../components/ui/Modal";
import { ProgressBar, SignupMeta, VolunteerStatusBadge } from "../components/volunteers/VolunteerBits";
import { Button, Card, CopyButton, EmptyState, ErrorState, LoadingState, Notice, PageHeader, TextField } from "../components/ui";

function AddVolunteerModal({ signupId, position, onClose, onAdded }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Suggest names from the People directory; it's fine if that can't load.
  useEffect(() => {
    listPeople().then(setPeople).catch(() => {});
  }, []);

  const setName = (name) => {
    const match = people.find((person) => person.name === name);
    setForm((current) => ({ ...current, name, email: match?.email || current.email }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() };
    if (!data.name) return setError("Enter the volunteer's name.");
    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) return setError("Enter a valid email address, or leave it blank.");
    setBusy(true);
    setError("");
    try {
      await addVolunteer(signupId, position.id, data, { uid: user.uid });
      onAdded();
      onClose();
    } catch (err) {
      setError(firestoreMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Add Volunteer — ${position.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="add-volunteer" variant="primary" loading={busy}>Add Volunteer</Button>
        </>
      }
    >
      <form id="add-volunteer" className="form" onSubmit={handleSubmit} noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <TextField label="Name" id="av-name" value={form.name} list="av-people" autoComplete="off" onChange={(e) => setName(e.target.value)} />
        <datalist id="av-people">
          {people.map((person) => <option key={person.id} value={person.name} />)}
        </datalist>
        <div className="form-row">
          <TextField label="Email (optional)" id="av-email" type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Phone (optional)" id="av-phone" type="tel" autoComplete="off" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </form>
    </Modal>
  );
}

function QrModal({ url, title, onClose }) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#3d2200", light: "#ffffff" } }))
      .then((result) => !cancelled && setDataUrl(result))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <Modal title="QR Code" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="form" style={{ alignItems: "center", textAlign: "center" }}>
        {failed && <Notice tone="error">Couldn't create the QR code. Use the link instead.</Notice>}
        {!failed && (dataUrl
          ? <img src={dataUrl} alt={`QR code linking to ${title}`} className="qr" />
          : <div className="qr skel" />)}
        <span className="link-chip">{url}</span>
        {dataUrl && (
          <a className="btn" href={dataUrl} download="volunteer-signup-qr.png">
            <Download size={16} aria-hidden />
            Download PNG
          </a>
        )}
      </div>
    </Modal>
  );
}

function PositionCard({ position, signup, volunteers, onAdd, onRemove, busyId }) {
  const filled = Math.min(filledFor(signup, position.id), position.spotsNeeded);
  const full = volunteers.length >= position.spotsNeeded;

  return (
    <section className="card">
      <div className="card-body" style={{ paddingTop: 16 }}>
        <div className="row" style={{ padding: 0, alignItems: "flex-start" }}>
          <div className="row-main">
            <div className="row-title" style={{ fontSize: 16, whiteSpace: "normal" }}>{position.name}</div>
            {position.description && <div className="row-sub">{position.description}</div>}
          </div>
          <strong style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{filled} / {position.spotsNeeded} filled</strong>
        </div>
        <div style={{ margin: "10px 0 4px" }}><ProgressBar filled={filled} needed={position.spotsNeeded} /></div>

        {volunteers.length === 0 ? (
          <p className="row-sub" style={{ padding: "10px 0" }}>No one has signed up yet.</p>
        ) : (
          <ul className="list">
            {volunteers.map((volunteer) => (
              <li key={volunteer.id} className="row" style={{ padding: "8px 0" }}>
                <span className="check-dot"><Check size={13} aria-hidden /></span>
                <div className="row-main">
                  <div className="row-title" style={{ fontWeight: 500 }}>{volunteer.name}</div>
                  {(volunteer.email || volunteer.phone) && (
                    <div className="row-sub">{[volunteer.email, volunteer.phone].filter(Boolean).join(" · ")}</div>
                  )}
                  {volunteer.source === "self" && <div className="row-sub">Signed up online</div>}
                </div>
                <button type="button" className="icon-btn" aria-label={`Remove ${volunteer.name}`} disabled={busyId === volunteer.id} onClick={() => onRemove(volunteer)}>
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: 8 }}>
          <Button icon={UserPlus} onClick={onAdd} disabled={full}>{full ? "Position Full" : "Add Volunteer"}</Button>
        </div>
      </div>
    </section>
  );
}

export default function VolunteerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const loader = useCallback(async () => {
    const signup = await getSignup(id);
    if (!signup) return null;
    const volunteers = await listVolunteers(id);
    // Keep the public name list in step (matters for volunteers added before it existed).
    await syncRoster(id, volunteers).catch(() => {});
    return { signup, volunteers };
  }, [id]);
  const query = useQuery(loader);

  const [addingTo, setAddingTo] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const back = (
    <Link to="/volunteers" className="btn">
      <ArrowLeft size={16} aria-hidden />
      All Signups
    </Link>
  );

  // Keep showing the page while it refreshes after a change.
  if (query.loading && !query.data) return (<><PageHeader title="Volunteer Signup" action={back} /><Card><LoadingState rows={6} /></Card></>);
  if (query.error) return (<><PageHeader title="Volunteer Signup" action={back} /><section className="card"><ErrorState message={query.error} onRetry={query.reload} /></section></>);
  if (!query.data || Array.isArray(query.data)) return (<><PageHeader title="Volunteer Signup" action={back} /><section className="card"><EmptyState title="Signup not found" message="It may have been deleted." /></section></>);

  const { signup, volunteers } = query.data;
  const { needed, filled, available, percent } = totals(signup);
  const url = volunteerUrl(id);

  const run = async (key, action, after = query.reload) => {
    setBusy(key);
    setError("");
    try {
      await action();
      after();
    } catch (err) {
      setError(firestoreMessage(err));
    }
    setBusy("");
  };

  const handleRemove = (volunteer) => {
    if (!window.confirm(`Remove ${volunteer.name} from this signup?`)) return;
    run(volunteer.id, () => removeVolunteer(id, volunteer));
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${signup.title}" and everyone signed up for it? This can't be undone.`)) return;
    run("delete", () => deleteSignup(id), () => navigate("/volunteers", { replace: true }));
  };

  return (
    <>
      <PageHeader title={signup.title} action={back} />

      <div className="stack">
        {error && <Notice tone="error">{error}</Notice>}

        <section className="card">
          <div className="card-body" style={{ paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="row" style={{ padding: 0, alignItems: "flex-start" }}>
              <div className="row-main"><SignupMeta signup={signup} /></div>
              <VolunteerStatusBadge signup={signup} />
            </div>
            {signup.description && <p style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>{signup.description}</p>}

            <div>
              <div className="progress-label">
                <strong>{filled} / {needed} spots filled</strong>
                <span>{available} available · {percent}%</span>
              </div>
              <ProgressBar filled={filled} needed={needed} />
            </div>

            <div className="btn-row">
              <Link to={`/volunteers/${id}/edit`} className="btn">
                <Pencil size={16} aria-hidden />
                Edit Signup
              </Link>
              {signup.status === "draft" && (
                <Button variant="primary" icon={Send} loading={busy === "status"} onClick={() => run("status", () => setSignupStatus(id, "open"))}>Publish</Button>
              )}
              {signup.status === "open" && (
                <Button icon={Lock} loading={busy === "status"} onClick={() => run("status", () => setSignupStatus(id, "closed"))}>Close Signup</Button>
              )}
              {signup.status === "closed" && (
                <Button icon={LockOpen} loading={busy === "status"} onClick={() => run("status", () => setSignupStatus(id, "open"))}>Reopen Signup</Button>
              )}
              <Button variant="danger" icon={Trash2} loading={busy === "delete"} onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </section>

        <div className="grid cols-2" style={{ alignItems: "start" }}>
          {signup.positions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              signup={signup}
              volunteers={volunteers.filter((v) => v.positionId === position.id)}
              busyId={busy}
              onAdd={() => setAddingTo(position)}
              onRemove={handleRemove}
            />
          ))}
        </div>

        <Card title="Share Signup" icon={Share2}>
          <div className="form">
            {signup.status === "draft" ? (
              <Notice tone="warn">This signup is a draft. Publish it before sharing — the link won't show anything until then.</Notice>
            ) : (
              <p className="row-sub">
                Anyone with this link can see the event, the names of who has signed up, and take an open spot — no account
                needed. Emails and phone numbers are never shown.{signup.status === "closed" && " This signup is closed, so the link is view-only right now."}
              </p>
            )}
            <div className="btn-row">
              <span className="link-chip">{url}</span>
            </div>
            <div className="btn-row">
              <CopyButton text={url} />
              <Button icon={QrCode} onClick={() => setShowQr(true)} disabled={signup.status === "draft"}>Generate QR Code</Button>
            </div>
          </div>
        </Card>
      </div>

      {addingTo && <AddVolunteerModal signupId={id} position={addingTo} onClose={() => setAddingTo(null)} onAdded={query.reload} />}
      {showQr && <QrModal url={url} title={signup.title} onClose={() => setShowQr(false)} />}
    </>
  );
}
