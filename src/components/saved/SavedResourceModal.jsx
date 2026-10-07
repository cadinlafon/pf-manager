import { useState } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import Modal from "../ui/Modal";
import { Button, Field, Notice, TextField } from "../ui";
import { useAuth } from "../../context/AuthContext";
import { firestoreMessage } from "../../hooks/useQuery";
import { createSaved, updateSaved } from "../../firebase/saved";
import { formatBytes, normalizeUrl } from "../../lib/format";
import { CATEGORIES, FILE_ACCEPT, TYPES, TYPE_ORDER, VISIBILITY, fileProblem, isFileType, parseTags } from "../../lib/saved";

// One dialog for saving and editing every kind of resource.
//   - new:  starts on the "What would you like to save?" menu, then the form
//   - edit: pass `resource`; goes straight to the form
// `onSaved(id, { favorite })` is called after a successful save.
export default function SavedResourceModal({ resource, onClose, onSaved }) {
  const { user, name, role } = useAuth();
  const editing = Boolean(resource);
  const [type, setType] = useState(resource?.type || null);
  const [form, setForm] = useState({
    title: resource?.title || "",
    description: resource?.description || "",
    url: resource?.url || "",
    content: resource?.content || "",
    category: resource?.category || "Resources",
    tags: (resource?.tags || []).join(", "),
    visibility: resource?.visibility || "leaders",
    pinned: Boolean(resource?.pinned),
    favorite: false,
  });
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const isMainAdmin = role === "main_admin";
  // Only main admins may create or keep admins-only resources.
  const visibilityOptions = Object.keys(VISIBILITY).filter((key) => key !== "admins" || isMainAdmin);
  const mayPin = isMainAdmin && form.visibility !== "personal";

  const pickFile = (picked) => {
    setError("");
    if (!picked) return setFile(null);
    const problem = fileProblem(picked, type);
    if (problem) {
      setFile(null);
      return setError(problem);
    }
    setFile(picked);
    // Use the file's name as the title if none has been typed yet.
    if (!form.title.trim()) setForm((current) => ({ ...current, title: picked.name.replace(/\.[^.]+$/, "") }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return setError("Give it a title.");

    const data = {
      type,
      title,
      description: form.description.trim(),
      category: form.category,
      tags: parseTags(form.tags),
      visibility: form.visibility,
      // A personal resource is never pinned; a non-admin keeps whatever it was.
      pinned: form.visibility === "personal" ? false : isMainAdmin ? form.pinned : Boolean(resource?.pinned),
    };
    if (type === "link") {
      data.url = normalizeUrl(form.url);
      if (!data.url) return setError("Enter a valid web address.");
    }
    if (type === "note") {
      data.content = form.content.trim();
      if (!data.content) return setError("Write the note.");
    }
    if (isFileType(type) && !editing && !file) return setError("Choose a file to upload.");

    setBusy(true);
    setError("");
    try {
      if (editing) {
        await updateSaved(resource, data, file, setProgress);
        onSaved(resource.id, {});
      } else {
        const id = await createSaved(data, file, { uid: user.uid, name }, setProgress);
        onSaved(id, { favorite: form.favorite });
      }
      onClose();
    } catch (err) {
      setError(
        err.code?.startsWith("storage/")
          ? "The file couldn't be uploaded. Check your connection and that it's under 25 MB, then try again."
          : err.message?.startsWith("Preview mode") ? err.message : firestoreMessage(err)
      );
      setBusy(false);
      setProgress(null);
    }
  };

  // Step 1: choose what to save.
  if (!type) {
    return (
      <Modal title="What would you like to save?" onClose={onClose}>
        <div className="type-menu">
          {TYPE_ORDER.map((key) => {
            const { addLabel, hint, icon: Icon } = TYPES[key];
            return (
              <button key={key} type="button" className="type-option" onClick={() => setType(key)}>
                <span className={`type-icon type-${key}`}><Icon size={20} aria-hidden /></span>
                <span>
                  <strong>{addLabel}</strong>
                  <span className="row-sub">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    );
  }

  const typeLabel = TYPES[type].label;
  return (
    <Modal
      title={editing ? `Edit ${typeLabel}` : `Save ${type === "image" ? "an" : "a"} ${typeLabel}`}
      onClose={onClose}
      footer={
        <>
          {!editing && <Button icon={ArrowLeft} onClick={() => { setType(null); setFile(null); setError(""); }} disabled={busy} style={{ marginRight: "auto" }}>Back</Button>}
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="saved-form" variant="primary" loading={busy}>
            {busy && progress != null ? `Uploading ${Math.round(progress * 100)}%` : editing ? "Save Changes" : "Save"}
          </Button>
        </>
      }
    >
      <form id="saved-form" className="form" onSubmit={handleSubmit} noValidate>
        {error && <Notice tone="error">{error}</Notice>}

        {isFileType(type) && (
          <Field label={editing ? "Replace File (optional)" : "File"} id="sv-file">
            <label className={`file-drop${file ? " has-file" : ""}`}>
              <Upload size={18} aria-hidden />
              <span>
                {file
                  ? <><strong>{file.name}</strong> · {formatBytes(file.size)}</>
                  : editing ? <>Current: <strong>{resource.fileName}</strong>. Choose a file to replace it.</>
                  : <>Choose {type === "image" ? "an image" : "a file"} — up to 25 MB</>}
              </span>
              <input id="sv-file" type="file" className="sr-only" accept={FILE_ACCEPT[type] || undefined} disabled={busy}
                onChange={(e) => pickFile(e.target.files?.[0] || null)} />
            </label>
          </Field>
        )}

        {type === "link" && (
          <TextField label="Web Address" id="sv-url" type="url" inputMode="url" placeholder="https://" value={form.url} onChange={set("url")} />
        )}
        <TextField label="Title" id="sv-title" maxLength={120} value={form.title} onChange={set("title")} />
        {type === "note" && (
          <TextField label="Note" id="sv-content" as="textarea" rows={7} maxLength={20000} value={form.content} onChange={set("content")} />
        )}
        <TextField label="Description (optional)" id="sv-description" as="textarea" rows={2} maxLength={500} value={form.description} onChange={set("description")} />

        <div className="form-row">
          <Field label="Category" id="sv-category">
            <select id="sv-category" className="input" value={form.category} onChange={set("category")}>
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </Field>
          <TextField label="Tags" id="sv-tags" placeholder="finance, 2026, policy" value={form.tags} onChange={set("tags")} />
        </div>

        <Field label="Who can see it" id="sv-visibility">
          <div className="segmented" role="group" aria-label="Who can see it" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
            {visibilityOptions.map((key) => {
              const { label, icon: Icon } = VISIBILITY[key];
              return (
                <button key={key} type="button" aria-pressed={form.visibility === key} onClick={() => setForm((current) => ({ ...current, visibility: key }))}>
                  <Icon size={15} aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
          <span className="row-sub">{VISIBILITY[form.visibility].hint} can see this.</span>
        </Field>

        {!editing && (
          <label className="check">
            <input type="checkbox" checked={form.favorite} onChange={set("favorite")} />
            Add to my favorites
          </label>
        )}
        {mayPin && (
          <label className="check">
            <input type="checkbox" checked={form.pinned} onChange={set("pinned")} />
            Pin to the top for everyone who can see it
          </label>
        )}
      </form>
    </Modal>
  );
}
