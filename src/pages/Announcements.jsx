import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ClipboardList, HeartHandshake, Link2, Megaphone, MessageSquare, Paperclip, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { timeAgo, useAnnouncements } from "../context/AnnouncementsContext";
import {
  addComment,
  createAnnouncement,
  deleteAnnouncement,
  deleteComment,
  subscribeComments,
  updateAnnouncement,
} from "../firebase/announcements";
import { listForms } from "../firebase/forms";
import { listSignups } from "../firebase/volunteers";
import { formPath } from "../lib/forms";
import { sortSignups, volunteerPath } from "../lib/volunteers";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { normalizeUrl } from "../lib/format";
import Modal from "../components/ui/Modal";
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, TextField } from "../components/ui";

const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";

// ── Attachments ──────────────────────────────────────────────────────
// One per announcement: an outside link, or one of the church's own signup
// pages (a signup form or a volunteer signup). Stored as { type, url, label }.
const ATTACH_TYPES = [
  { value: "link", label: "Link", icon: Link2 },
  { value: "form", label: "Signup Form", icon: ClipboardList },
  { value: "volunteer", label: "Volunteer Signup", icon: HeartHandshake },
];

export function AttachmentLink({ attachment }) {
  const Icon = ATTACH_TYPES.find((type) => type.value === attachment.type)?.icon || Link2;
  // Signup pages are stored as paths inside this app; links are full addresses.
  const safe = attachment.type === "link" ? normalizeUrl(attachment.url) : attachment.url?.startsWith("/") ? attachment.url : null;
  if (!safe) return null;
  return (
    <a className="attachment" href={safe} target="_blank" rel="noopener noreferrer">
      <Icon size={16} aria-hidden />
      <span>{attachment.label}</span>
    </a>
  );
}

function AttachmentPicker({ value, onChange, onRemove }) {
  const forms = useQuery(listForms, { enabled: value.type === "form" });
  const signups = useQuery(listSignups, { enabled: value.type === "volunteer" });

  const formOptions = (forms.data || []).map((form) => ({ url: formPath(form.slug), label: form.title, note: form.status === "open" ? "" : " (closed)" }));
  const signupOptions = sortSignups((signups.data || []).filter((signup) => signup.status !== "draft"))
    .map((signup) => ({ url: volunteerPath(signup.id), label: signup.title, note: signup.status === "closed" ? " (closed)" : "" }));

  const pagePicker = (query, options, emptyText) => {
    if (query.loading) return <span className="row-sub">Loading…</span>;
    if (query.error) return <Notice tone="error">{query.error}</Notice>;
    if (options.length === 0) return <span className="row-sub">{emptyText}</span>;
    return (
      <select className="input" aria-label="Choose a signup page" value={value.url}
        onChange={(e) => onChange({ ...value, url: e.target.value, label: options.find((o) => o.url === e.target.value)?.label || "" })}>
        <option value="">Choose one…</option>
        {options.map((option) => <option key={option.url} value={option.url}>{option.label}{option.note}</option>)}
      </select>
    );
  };

  return (
    <div className="attach-box">
      <div className="field-card-head">
        <div className="segmented" role="group" aria-label="Attachment type" style={{ flexWrap: "wrap" }}>
          {ATTACH_TYPES.map(({ value: type, label, icon: Icon }) => (
            <button key={type} type="button" aria-pressed={value.type === type} onClick={() => onChange({ type, url: "", label: "" })}>
              <Icon size={15} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn" aria-label="Remove attachment" onClick={onRemove}><X size={16} /></button>
      </div>

      {value.type === "link" && (
        <>
          <TextField label="Link Address" id="an-link-url" type="url" inputMode="url" placeholder="https://" value={value.url}
            onChange={(e) => onChange({ ...value, url: e.target.value })} />
          <TextField label="Button Text (optional)" id="an-link-label" placeholder="e.g. Read more" maxLength={60} value={value.label}
            onChange={(e) => onChange({ ...value, label: e.target.value })} />
        </>
      )}
      {value.type === "form" && pagePicker(forms, formOptions, "There are no signup forms yet. Create one under Signup Forms.")}
      {value.type === "volunteer" && pagePicker(signups, signupOptions, "There are no published volunteer signups yet.")}
    </div>
  );
}

// Returns { attachment } (null when none) or { error }.
function finishAttachment(draft) {
  if (!draft) return { attachment: null };
  if (draft.type === "link") {
    const url = normalizeUrl(draft.url);
    if (!url) return { error: "Enter a valid link address, or remove the attachment." };
    return { attachment: { type: "link", url, label: draft.label.trim() || new URL(url).hostname.replace(/^www\./, "") } };
  }
  if (!draft.url) return { error: "Choose a signup page to attach, or remove the attachment." };
  return { attachment: { type: draft.type, url: draft.url, label: draft.label } };
}

// ── Create / edit ────────────────────────────────────────────────────
// `announcement` is null when creating.
function AnnouncementModal({ announcement, onClose }) {
  const { user, name } = useAuth();
  const [title, setTitle] = useState(announcement?.title || "");
  const [body, setBody] = useState(announcement?.body || "");
  const [attachment, setAttachment] = useState(announcement?.attachment || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { title: title.trim(), body: body.trim() };
    if (!data.title) return setError("Give the announcement a title.");
    if (!data.body) return setError("Write the announcement.");
    const attached = finishAttachment(attachment);
    if (attached.error) return setError(attached.error);

    setBusy(true);
    setError("");
    try {
      if (announcement) await updateAnnouncement(announcement.id, { ...data, attachment: attached.attachment });
      else await createAnnouncement({ ...data, attachment: attached.attachment }, { uid: user.uid, name });
      onClose();
    } catch (err) {
      setError(firestoreMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={announcement ? "Edit Announcement" : "New Announcement"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="announcement-form" variant="primary" loading={busy}>{announcement ? "Save" : "Post Announcement"}</Button>
        </>
      }
    >
      <form id="announcement-form" className="form" onSubmit={handleSubmit} noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <TextField label="Title" id="an-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <TextField label="Announcement" id="an-body" as="textarea" rows={6} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />

        {attachment ? (
          <AttachmentPicker value={attachment} onChange={setAttachment} onRemove={() => setAttachment(null)} />
        ) : (
          <div>
            <Button icon={Paperclip} onClick={() => setAttachment({ type: "link", url: "", label: "" })}>Attach</Button>
            <span className="row-sub" style={{ marginLeft: 10 }}>Add a link or one of your signup pages.</span>
          </div>
        )}

        {!announcement && <span className="row-sub">Every manager will see this, posted under your name ({name}).</span>}
      </form>
    </Modal>
  );
}

export function AnnouncementAuthor({ item }) {
  return (
    <div className="byline">
      <span className="avatar sm">{initials(item.createdByName)}</span>
      <span>
        <strong>{item.createdByName || "A manager"}</strong> · {timeAgo(item.createdAt)}
        {item.edited && " · edited"}
      </span>
    </div>
  );
}

// ── Comments ─────────────────────────────────────────────────────────
function Comments({ announcement }) {
  const { user, name, role } = useAuth();
  const [comments, setComments] = useState(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(
    () => subscribeComments(announcement.id, setComments, (err) => setError(firestoreMessage(err))),
    [announcement.id]
  );

  const canDelete = (comment) => comment.createdBy === user.uid || announcement.createdBy === user.uid || role === "main_admin";

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      await addComment(announcement.id, body, { uid: user.uid, name });
      setText("");
    } catch (err) {
      setError(firestoreMessage(err));
    }
    setSending(false);
  };

  const remove = async (comment) => {
    if (!window.confirm("Delete this comment?")) return;
    setError("");
    try {
      await deleteComment(announcement.id, comment.id);
    } catch (err) {
      setError(firestoreMessage(err));
    }
  };

  return (
    <div className="comments">
      {error && <Notice tone="error">{error}</Notice>}
      {comments === null && !error && <LoadingState rows={2} />}
      {comments?.length === 0 && <span className="row-sub">No comments yet. Be the first.</span>}
      {comments?.map((comment) => (
        <div key={comment.id} className="comment">
          <span className="avatar sm">{initials(comment.createdByName)}</span>
          <div className="comment-bubble">
            <div className="byline">
              <span><strong>{comment.createdByName || "A manager"}</strong> · {timeAgo(comment.createdAt)}</span>
            </div>
            <p>{comment.body}</p>
          </div>
          {canDelete(comment) && (
            <button type="button" className="icon-btn" aria-label={`Delete comment by ${comment.createdByName}`} onClick={() => remove(comment)}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}

      <form className="comment-form" onSubmit={send}>
        <textarea
          className="input"
          rows={1}
          maxLength={2000}
          placeholder="Write a comment…"
          aria-label="Write a comment"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line.
            if (e.key === "Enter" && !e.shiftKey) send(e);
          }}
        />
        <Button type="submit" variant="primary" icon={Send} loading={sending} disabled={!text.trim()} aria-label="Post comment">Post</Button>
      </form>
    </div>
  );
}

function AnnouncementCard({ item, isNew, hasNewComment, startOpen, focused, canManage, onEdit, onDelete }) {
  const [open, setOpen] = useState(startOpen);
  const ref = useRef(null);
  const count = item.commentCount || 0;

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "center" });
  }, [focused]);

  return (
    <article ref={ref} className={`card announcement${focused ? " focused" : ""}`}>
      <div className="row" style={{ padding: 0, alignItems: "flex-start" }}>
        <div className="row-main">
          <h2>{item.title}</h2>
        </div>
        {isNew && <Badge tone="info">New</Badge>}
      </div>
      <p className="announcement-body">{item.body}</p>
      {item.attachment && <div><AttachmentLink attachment={item.attachment} /></div>}

      <div className="row announcement-foot">
        <div className="row-main"><AnnouncementAuthor item={item} /></div>
        <div className="btn-row" style={{ gap: 2 }}>
          <button type="button" className="btn ghost" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            <MessageSquare size={16} aria-hidden />
            {count === 0 ? "Comment" : `${count} ${count === 1 ? "comment" : "comments"}`}
            {hasNewComment && !open && <Badge tone="info">New</Badge>}
          </button>
          {canManage && (
            <>
              <button type="button" className="icon-btn" aria-label="Edit announcement" onClick={onEdit}><Pencil size={16} /></button>
              <button type="button" className="icon-btn" aria-label="Delete announcement" onClick={onDelete}><Trash2 size={16} /></button>
            </>
          )}
        </div>
      </div>

      {open && <Comments announcement={item} />}
    </article>
  );
}

export default function Announcements() {
  const { user, role } = useAuth();
  const { items, loading, error, isUnread, hasNewComment, markAllSeen } = useAnnouncements();
  const location = useLocation();
  // `editing`: undefined = closed, null = creating, object = editing it.
  const [editing, setEditing] = useState(location.state?.openNew ? null : undefined);
  const [actionError, setActionError] = useState("");
  // Remember what was unread when the page opened, so it stays highlighted for
  // this visit even though opening the page marks everything as seen.
  const [fresh, setFresh] = useState(null);

  useEffect(() => {
    if (loading || fresh) return;
    setFresh({
      posts: new Set(items.filter(isUnread).map((item) => item.id)),
      comments: new Set(items.filter(hasNewComment).map((item) => item.id)),
    });
    markAllSeen();
  }, [loading, fresh, items, isUnread, hasNewComment, markAllSeen]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.title}" and its comments? It will be removed for every manager.`)) return;
    setActionError("");
    try {
      await deleteAnnouncement(item.id);
    } catch (err) {
      setActionError(firestoreMessage(err));
    }
  };

  const newButton = <Button variant="primary" icon={Plus} onClick={() => setEditing(null)}>New Announcement</Button>;
  // Arriving from a notification: which announcement to jump to.
  const focusId = location.state?.focus;

  let body;
  if (loading) {
    body = <section className="card"><div className="card-body"><LoadingState rows={5} /></div></section>;
  } else if (error) {
    body = <section className="card"><ErrorState message={error} /></section>;
  } else if (items.length === 0) {
    body = (
      <section className="card">
        <EmptyState icon={Megaphone} title="No announcements yet" message="Post an announcement to share news with every manager." action={newButton} />
      </section>
    );
  } else {
    body = (
      <div className="stack" style={{ maxWidth: 760 }}>
        {items.map((item) => (
          <AnnouncementCard
            key={item.id}
            item={item}
            isNew={Boolean(fresh?.posts.has(item.id))}
            hasNewComment={Boolean(fresh?.comments.has(item.id))}
            focused={focusId === item.id}
            startOpen={focusId === item.id && Boolean(location.state?.openComments)}
            canManage={item.createdBy === user.uid || role === "main_admin"}
            onEdit={() => setEditing(item)}
            onDelete={() => handleDelete(item)}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Announcements" subtitle="News and updates for every manager." action={newButton} />
      {actionError && <div style={{ marginBottom: 16 }}><Notice tone="error">{actionError}</Notice></div>}
      {body}
      {editing !== undefined && <AnnouncementModal announcement={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}
