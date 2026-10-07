import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, CalendarDays, KeyRound, LogOut, Monitor, Moon, Palette, Pencil, Plug, ShieldCheck, Sun, UserMinus, UserPlus, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import {
  createInvitation,
  getLeader,
  invitationState,
  inviteUrl,
  listInvitations,
  listLeaders,
  removeLeader,
  revokeInvitation,
  saveOwnProfile,
  sendInvitationEmail,
  updateLeader,
} from "../firebase/invitations";
import { LEADER_ROLES } from "../firebase/collections";
import { EMPTY_CHURCH, getChurchInfo, saveChurchInfo } from "../firebase/churchInfo";
import Modal from "../components/ui/Modal";
import ConnectCalendarModal from "../components/calendar/ConnectCalendarModal";
import { useCalendarConfig } from "../hooks/useCalendarConfig";
import { Badge, Button, Card, CopyButton, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, QueryView, TextField } from "../components/ui";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function ChurchInfoCard() {
  const { user, role } = useAuth();
  const canEdit = role === "main_admin";
  const query = useQuery(getChurchInfo);
  const [form, setForm] = useState(EMPTY_CHURCH);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (query.data && !Array.isArray(query.data)) setForm(query.data);
  }, [query.data]);

  const set = (key) => (e) => {
    setMessage(null);
    setForm((current) => ({ ...current, [key]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const info = Object.fromEntries(Object.keys(EMPTY_CHURCH).map((key) => [key, (form[key] || "").trim()]));
    if (!info.name) return setMessage({ tone: "error", text: "Church name is required." });
    if (info.email && !/^\S+@\S+\.\S+$/.test(info.email)) return setMessage({ tone: "error", text: "Enter a valid email address, or leave it blank." });
    setBusy(true);
    setMessage(null);
    try {
      await saveChurchInfo(info, { uid: user.uid });
      setForm(info);
      setMessage({ tone: "success", text: "Church information saved." });
    } catch (err) {
      setMessage({ tone: "error", text: firestoreMessage(err) });
    }
    setBusy(false);
  };

  if (query.loading) return <Card title="Church Information" icon={Building2}><LoadingState rows={5} /></Card>;
  if (query.error) return <Card title="Church Information" icon={Building2}><ErrorState message={query.error} onRetry={query.reload} /></Card>;

  return (
    <Card title="Church Information" icon={Building2}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <TextField label="Church Name" id="c-name" value={form.name} disabled={!canEdit} onChange={set("name")} />
        <TextField label="Address" id="c-address" placeholder={canEdit ? "Street, city, state" : ""} value={form.address} disabled={!canEdit} onChange={set("address")} />
        <div className="form-row">
          <TextField label="Phone" id="c-phone" type="tel" value={form.phone} disabled={!canEdit} onChange={set("phone")} />
          <TextField label="Email" id="c-email" type="email" value={form.email} disabled={!canEdit} onChange={set("email")} />
        </div>
        <TextField label="Website" id="c-website" type="url" placeholder={canEdit ? "https://" : ""} value={form.website} disabled={!canEdit} onChange={set("website")} />
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {canEdit
          ? <div><Button type="submit" variant="primary" loading={busy}>Save Changes</Button></div>
          : <span className="row-sub">Only a main admin can change church information.</span>}
      </form>
    </Card>
  );
}

// Edit a manager's details. `self` = editing your own (name and phone only);
// otherwise a main admin editing someone else, who may also change their role.
function ProfileModal({ person, self, onClose, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: person.name || "", phone: person.phone || "", role: person.role || "leader" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { name: form.name.trim(), phone: form.phone.trim(), role: form.role };
    if (!data.name) return setError("Name is required.");
    setBusy(true);
    setError("");
    try {
      if (self) await saveOwnProfile(user, data);
      else await updateLeader(person.id, data);
      await onSaved(data);
      onClose();
    } catch (err) {
      setError(firestoreMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={self ? "Edit Your Details" : `Edit ${person.name || "Manager"}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="profile-form" variant="primary" loading={busy}>Save</Button>
        </>
      }
    >
      <form id="profile-form" className="form" onSubmit={handleSubmit} noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <TextField label="Name" id="pr-name" maxLength={100} autoComplete={self ? "name" : "off"} value={form.name} onChange={set("name")} />
        <TextField label="Phone" id="pr-phone" type="tel" maxLength={40} autoComplete={self ? "tel" : "off"} value={form.phone} onChange={set("phone")} />
        <Field label="Email" id="pr-email">
          <input id="pr-email" className="input" type="email" value={person.email || ""} disabled readOnly />
          <span className="row-sub">This is the sign-in email, so it can't be changed here.</span>
        </Field>
        {!self && (
          <Field label="Role" id="pr-role">
            <select id="pr-role" className="input" value={form.role} onChange={set("role")}>
              {Object.entries(LEADER_ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <span className="row-sub">Main admins can invite, edit and remove managers and change church settings.</span>
          </Field>
        )}
        <span className="row-sub">A new name shows on anything posted from now on; earlier posts keep the old one.</span>
      </form>
    </Modal>
  );
}

function AccountCard() {
  const { user, name, role, signOut, resetPassword, refreshAccess, isPreview } = useAuth();
  const [message, setMessage] = useState(null);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  // Your own manager record holds the phone number (and may not exist yet).
  const loadSelf = useCallback(() => getLeader(user.uid), [user.uid]);
  const self = useQuery(loadSelf, { enabled: !isPreview });
  const phone = self.data && !Array.isArray(self.data) ? self.data.phone : "";

  const handleChangePassword = async () => {
    if (isPreview) {
      setMessage({ tone: "warn", text: "Preview mode — no email was sent." });
      return;
    }
    setSending(true);
    try {
      await resetPassword(user.email);
      setMessage({ tone: "success", text: `We emailed a password reset link to ${user.email}.` });
    } catch {
      setMessage({ tone: "error", text: "Couldn't send the reset email. Please try again." });
    }
    setSending(false);
  };

  return (
    <Card title="Account" icon={UserRound}>
      <dl className="kv">
        <dt>Name</dt><dd>{name}</dd>
        <dt>Email</dt><dd>{user?.email}</dd>
        <dt>Phone</dt><dd>{phone || "—"}</dd>
        <dt>Role</dt><dd>{LEADER_ROLES[role]}</dd>
      </dl>
      {message && <div style={{ marginTop: 14 }}><Notice tone={message.tone}>{message.text}</Notice></div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <Button icon={Pencil} onClick={() => setEditing(true)} disabled={isPreview}>Edit Details</Button>
        <Button icon={KeyRound} onClick={handleChangePassword} loading={sending}>Change Password</Button>
        <Button variant="danger" icon={LogOut} onClick={signOut}>Sign Out</Button>
      </div>
      {editing && (
        <ProfileModal
          self
          person={{ name, phone, email: user.email }}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setMessage({ tone: "success", text: "Your details were saved." });
            self.reload();
            await refreshAccess();
          }}
        />
      )}
    </Card>
  );
}

function AppearanceCard() {
  const { preference, setPreference } = useTheme();
  return (
    <Card title="Appearance" icon={Palette}>
      <div className="segmented" role="group" aria-label="Theme">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" aria-pressed={preference === value} onClick={() => setPreference(value)}>
            <Icon size={15} aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function InviteLeaderModal({ onClose, onInvited }) {
  const { user, name } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", role: "leader" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // Set when the invitation was saved but the email failed, so the admin can
  // still pass the link along themselves.
  const [fallbackLink, setFallbackLink] = useState("");
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError("Enter a name and a valid email address.");
      return;
    }
    setSending(true);
    setError("");

    let invitation;
    try {
      invitation = await createInvitation(form, { uid: user.uid, name });
    } catch (err) {
      setError(firestoreMessage(err));
      setSending(false);
      return;
    }

    try {
      await sendInvitationEmail(invitation);
      onInvited(`Invitation emailed to ${invitation.email}.`);
      onClose();
    } catch {
      onInvited(null);
      setFallbackLink(inviteUrl(invitation.token));
      setSending(false);
    }
  };

  if (fallbackLink) {
    return (
      <Modal title="Invite Manager" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <div className="form">
          <Notice tone="warn">
            The invitation was created, but the email couldn't be sent. Copy this link and send it to {form.email.trim()} yourself.
          </Notice>
          <TextField label="Invitation Link" id="l-link" value={fallbackLink} readOnly onFocus={(e) => e.target.select()} />
          <div><CopyButton text={fallbackLink} /></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Invite Manager"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="invite-leader" variant="primary" loading={sending}>
            {sending ? "Sending…" : "Send Invitation"}
          </Button>
        </>
      }
    >
      <form id="invite-leader" className="form" onSubmit={handleSubmit} noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <TextField label="Name" id="l-name" value={form.name} onChange={set("name")} />
        <TextField label="Email" id="l-email" type="email" value={form.email} onChange={set("email")} />
        <Field label="Role" id="l-role">
          <select id="l-role" className="input" value={form.role} onChange={set("role")}>
            {Object.entries(LEADER_ROLES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <span className="row-sub">They'll get an email with a link to set a password. The link works for 7 days.</span>
      </form>
    </Modal>
  );
}

function PendingInvitations({ query }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const revoke = async (invitation) => {
    if (!window.confirm(`Revoke the invitation for ${invitation.email}? Their link will stop working.`)) return;
    setBusy(invitation.token);
    setError("");
    try {
      await revokeInvitation(invitation.token);
      query.reload();
    } catch (err) {
      setError(firestoreMessage(err));
    }
    setBusy("");
  };

  const pending = (query.data || []).filter((invitation) => invitation.status === "pending");
  if (query.loading || query.error || pending.length === 0) return null;

  return (
    <>
      <div className="sidebar-section" style={{ color: "var(--text-faint)", padding: "16px 0 0" }}>Pending Invitations</div>
      {error && <Notice tone="error">{error}</Notice>}
      <ul className="list">
        {pending.map((invitation) => {
          const expired = invitationState(invitation) === "expired";
          return (
            <li key={invitation.token} className="row" style={{ flexWrap: "wrap" }}>
              <div className="row-main">
                <div className="row-title">{invitation.name}</div>
                <div className="row-sub">{invitation.email} · {LEADER_ROLES[invitation.role]}</div>
                <div className="row-sub">
                  {expired ? "Expired" : `Expires ${invitation.expiresAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </div>
              </div>
              {expired ? <Badge tone="danger">Expired</Badge> : <CopyButton text={inviteUrl(invitation.token)} />}
              <Button variant="danger" onClick={() => revoke(invitation)} loading={busy === invitation.token}>Revoke</Button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function LeadersCard() {
  const { user, role, isPreview } = useAuth();
  const isMainAdmin = role === "main_admin";
  const leaders = useQuery(listLeaders, { enabled: !isPreview });
  const [removing, setRemoving] = useState("");
  const [editingLeader, setEditingLeader] = useState(null);
  const [removeError, setRemoveError] = useState("");

  const handleRemove = async (leader) => {
    const sure = window.confirm(
      `Remove ${leader.name} as a manager?\n\nThey will lose access to PF Management right away. Their sign-in account and anything they added stay; you can invite them again later.`
    );
    if (!sure) return;
    setRemoving(leader.id);
    setRemoveError("");
    setNotice("");
    try {
      await removeLeader(leader.id);
      setNotice(`${leader.name} was removed.`);
      leaders.reload();
    } catch (err) {
      setRemoveError(firestoreMessage(err));
    }
    setRemoving("");
  };
  const invitations = useQuery(listInvitations, { enabled: !isPreview && isMainAdmin });
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState("");

  const handleInvited = (message) => {
    if (message) setNotice(message);
    invitations.reload();
  };

  return (
    <Card
      title="Managers"
      icon={ShieldCheck}
      action={isMainAdmin && <Button icon={UserPlus} onClick={() => setInviting(true)} disabled={isPreview}>Invite Manager</Button>}
    >
      {isPreview && <Notice tone="warn">Preview mode — managers and invitations aren't loaded without signing in.</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {removeError && <Notice tone="error">{removeError}</Notice>}
      <QueryView
        query={leaders}
        rows={2}
        empty={
          <EmptyState icon={ShieldCheck} title="No invited managers yet"
            message="PF Audio App admins already have access. Invite others to add them here." />
        }
      >
        {(rows) => (
          <ul className="list">
            {rows.map((leader) => (
              <li key={leader.id} className="row" style={{ flexWrap: "wrap" }}>
                <div className="row-main">
                  <div className="row-title">{leader.name}{leader.id === user.uid && " (you)"}</div>
                  <div className="row-sub">{[leader.email, leader.phone].filter(Boolean).join(" · ")}</div>
                </div>
                <Badge tone={leader.role === "main_admin" ? "info" : ""}>{LEADER_ROLES[leader.role]}</Badge>
                {isMainAdmin && leader.id !== user.uid && (
                  <Button icon={Pencil} onClick={() => setEditingLeader(leader)}>Edit</Button>
                )}
                {/* You can't remove yourself: that could leave nobody able to manage access. */}
                {isMainAdmin && leader.id !== user.uid && (
                  <Button variant="danger" icon={UserMinus} loading={removing === leader.id} onClick={() => handleRemove(leader)}>Remove</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryView>
      {invitations.error && <Notice tone="error">Couldn't load pending invitations. {invitations.error}</Notice>}
      <PendingInvitations query={invitations} />
      {!isMainAdmin && <p className="row-sub" style={{ marginTop: 8 }}>Only a main admin can invite or remove managers.</p>}
      {editingLeader && (
        <ProfileModal
          person={editingLeader}
          onClose={() => setEditingLeader(null)}
          onSaved={(data) => {
            setNotice(`${data.name}'s details were saved.`);
            leaders.reload();
          }}
        />
      )}
      {inviting && <InviteLeaderModal onClose={() => setInviting(false)} onInvited={handleInvited} />}
    </Card>
  );
}

function IntegrationsCard() {
  const { role } = useAuth();
  const location = useLocation();
  const calendar = useCalendarConfig();
  // The Calendar page's "Connect Google Calendar" button lands here with this flag.
  const [connecting, setConnecting] = useState(Boolean(location.state?.connectCalendar) && role === "main_admin");

  const calendarAction = () => {
    if (calendar.loading) return <Badge>Checking…</Badge>;
    if (calendar.error) return <Button onClick={calendar.reload}>Retry</Button>;
    if (calendar.config) {
      return (
        <>
          <Badge tone="success">Connected</Badge>
          <Link to="/calendar" className="btn">Manage</Link>
        </>
      );
    }
    return (
      <>
        <Badge>Not Connected</Badge>
        {role === "main_admin" && <Button variant="primary" onClick={() => setConnecting(true)}>Connect</Button>}
      </>
    );
  };

  return (
    <Card title="Integrations" icon={Plug}>
      <ul className="list">
        <li className="integration" style={{ flexWrap: "wrap" }}>
          <span className="integration-icon"><CalendarDays size={18} aria-hidden /></span>
          <div className="row-main">
            <div className="row-title">Google Calendar</div>
            <div className="row-sub">
              {calendar.config ? calendar.config.calendarIds.join(", ") : "Show the church calendar in PF Management."}
            </div>
          </div>
          {calendarAction()}
        </li>
      </ul>
      {calendar.error && <Notice tone="error">Couldn't check Google Calendar. {calendar.error}</Notice>}
      {connecting && <ConnectCalendarModal onClose={() => setConnecting(false)} onConnected={calendar.reload} />}
    </Card>
  );
}

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Church details, your account and who can manage." />
      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <div className="stack">
          <ChurchInfoCard />
          <IntegrationsCard />
        </div>
        <div className="stack">
          <AccountCard />
          <LeadersCard />
          <AppearanceCard />
        </div>
      </div>
    </>
  );
}
