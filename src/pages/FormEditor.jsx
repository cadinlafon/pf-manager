import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, ListChecks, Plus, Settings2, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { createForm, deleteForm, getForm, updateForm } from "../firebase/forms";
import { FIELD_TYPES, SLUG_PATTERN, cleanSlug, formPath, newField, randomSlug, tidyFields, validateForm } from "../lib/forms";
import FormFields from "../components/forms/FormFields";
import { Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, TextField } from "../components/ui";

function FieldEditor({ field, index, count, onChange, onMove, onRemove }) {
  const set = (patch) => onChange({ ...field, ...patch });
  const setOption = (i, value) => set({ options: field.options.map((option, n) => (n === i ? value : option)) });

  return (
    <div className="field-card">
      <div className="field-card-head">
        <Badge tone="info">{FIELD_TYPES[field.type].label}</Badge>
        <div className="btn-row" style={{ gap: 2 }}>
          <button type="button" className="icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up"><ArrowUp size={16} /></button>
          <button type="button" className="icon-btn" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move down"><ArrowDown size={16} /></button>
          <button type="button" className="icon-btn" onClick={onRemove} aria-label="Remove field"><Trash2 size={16} /></button>
        </div>
      </div>

      <TextField
        label={field.type === "text" || field.type === "select" ? "Question" : "Label"}
        id={`label-${field.id}`}
        value={field.label}
        placeholder={field.type === "select" ? "e.g. What will you bring?" : field.type === "text" ? "e.g. Any allergies?" : ""}
        onChange={(e) => set({ label: e.target.value })}
      />

      {field.type === "select" && (
        <div className="field">
          <label>Options</label>
          {field.options.map((option, i) => (
            <div key={i} className="btn-row" style={{ flexWrap: "nowrap" }}>
              <input className="input" value={option} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`}
                onChange={(e) => setOption(i, e.target.value)} />
              <button type="button" className="icon-btn" aria-label={`Remove option ${i + 1}`} disabled={field.options.length <= 2}
                onClick={() => set({ options: field.options.filter((_, n) => n !== i) })}>
                <X size={16} />
              </button>
            </div>
          ))}
          <div><Button variant="ghost" icon={Plus} onClick={() => set({ options: [...field.options, ""] })}>Add option</Button></div>
        </div>
      )}

      <div className="btn-row" style={{ gap: 18 }}>
        <label className="check">
          <input type="checkbox" checked={field.required} onChange={(e) => set({ required: e.target.checked })} />
          Required
        </label>
        {field.type === "select" && (
          <label className="check">
            <input type="checkbox" checked={field.multiple} onChange={(e) => set({ multiple: e.target.checked })} />
            Allow selecting multiple
          </label>
        )}
      </div>
    </div>
  );
}

export default function FormEditor() {
  const { slug: editingSlug } = useParams();
  const isNew = !editingSlug;
  const navigate = useNavigate();
  const { user, name } = useAuth();

  const loader = useCallback(() => (isNew ? Promise.resolve(null) : getForm(editingSlug)), [isNew, editingSlug]);
  const existing = useQuery(loader);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState(() => [newField("name"), newField("email")]);
  const [status, setStatus] = useState("open");
  const [linkMode, setLinkMode] = useState("auto"); // "auto" | "custom"
  const [customSlug, setCustomSlug] = useState("");
  const [previewAnswers, setPreviewAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!existing.data || Array.isArray(existing.data)) return;
    setTitle(existing.data.title);
    setDescription(existing.data.description || "");
    setFields(existing.data.fields);
    setStatus(existing.data.status);
  }, [existing.data]);

  const updateField = (index, next) => setFields((list) => list.map((field, i) => (i === index ? next : field)));
  const moveField = (index, delta) =>
    setFields((list) => {
      const next = [...list];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });

  const handleSave = async (e) => {
    e.preventDefault();
    const problem = validateForm({ title, fields });
    if (problem) return setError(problem);
    if (isNew && linkMode === "custom" && !SLUG_PATTERN.test(customSlug)) {
      return setError("The link ending needs 3–40 characters: lowercase letters, numbers and dashes.");
    }

    setSaving(true);
    setError("");
    const data = { title: title.trim(), description: description.trim(), fields: tidyFields(fields), status };

    try {
      if (!isNew) {
        await updateForm(editingSlug, data);
      } else if (linkMode === "custom") {
        await createForm(customSlug, data, { uid: user.uid, name });
      } else {
        // Generated endings: on the rare collision, just draw another.
        for (let attempt = 0; ; attempt++) {
          try {
            await createForm(randomSlug(), data, { uid: user.uid, name });
            break;
          } catch (err) {
            if (err.code !== "slug-taken" || attempt >= 4) throw err;
          }
        }
      }
      navigate("/forms");
    } catch (err) {
      setError(err.code === "slug-taken" ? `"/form/${customSlug}" is already used by another form. Choose a different ending.` : firestoreMessage(err));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${title}" and all of its submissions? This can't be undone.`)) return;
    setSaving(true);
    try {
      await deleteForm(editingSlug);
      navigate("/forms");
    } catch (err) {
      setError(firestoreMessage(err));
      setSaving(false);
    }
  };

  const back = (
    <Link to="/forms" className="btn">
      <ArrowLeft size={16} aria-hidden />
      All Forms
    </Link>
  );

  if (!isNew && existing.loading) {
    return (<><PageHeader title="Edit Form" action={back} /><Card><LoadingState rows={6} /></Card></>);
  }
  if (!isNew && existing.error) {
    return (<><PageHeader title="Edit Form" action={back} /><section className="card"><ErrorState message={existing.error} onRetry={existing.reload} /></section></>);
  }
  if (!isNew && !existing.data) {
    return (<><PageHeader title="Edit Form" action={back} /><section className="card"><EmptyState title="Form not found" message="It may have been deleted." /></section></>);
  }

  return (
    <form onSubmit={handleSave} noValidate>
      <PageHeader title={isNew ? "Create Form" : "Edit Form"} subtitle={isNew ? "Build a signup form and get a shareable link." : formPath(editingSlug)} action={back} />

      <div className="grid main-side">
        <div className="stack">
          <Card title="Details" icon={Settings2}>
            <div className="form">
              <TextField label="Form Title" id="form-title" value={title} placeholder="e.g. Fall Potluck Signup" onChange={(e) => setTitle(e.target.value)} />
              <TextField label="Description" id="form-description" as="textarea" value={description} placeholder="Optional — shown at the top of the form."
                onChange={(e) => setDescription(e.target.value)} />

              {isNew ? (
                <Field label="Form Link" id="form-slug">
                  <div className="segmented" role="group" aria-label="Form link" style={{ alignSelf: "flex-start" }}>
                    <button type="button" aria-pressed={linkMode === "auto"} onClick={() => setLinkMode("auto")}>Auto-generate</button>
                    <button type="button" aria-pressed={linkMode === "custom"} onClick={() => setLinkMode("custom")}>Choose my own</button>
                  </div>
                  {linkMode === "auto" ? (
                    <span className="row-sub">The link will end in 8 random digits, like /form/48203917.</span>
                  ) : (
                    <>
                      <div className="slug-input">
                        <span>/form/</span>
                        <input id="form-slug" className="input" value={customSlug} placeholder="potluckform" spellCheck={false}
                          autoCapitalize="none" onChange={(e) => setCustomSlug(cleanSlug(e.target.value))} />
                      </div>
                      <span className="row-sub">Lowercase letters, numbers and dashes. This can't be changed after the form is created.</span>
                    </>
                  )}
                </Field>
              ) : (
                <Field label="Accepting Responses" id="form-status">
                  <div className="segmented" role="group" aria-label="Accepting responses" style={{ alignSelf: "flex-start" }}>
                    <button type="button" aria-pressed={status === "open"} onClick={() => setStatus("open")}>Open</button>
                    <button type="button" aria-pressed={status === "closed"} onClick={() => setStatus("closed")}>Closed</button>
                  </div>
                  <span className="row-sub">A closed form shows visitors a "no longer accepting responses" message.</span>
                </Field>
              )}
            </div>
          </Card>

          <Card title="Fields" icon={ListChecks}>
            <div className="form">
              {fields.length === 0 && <p className="row-sub">No fields yet. Add one below.</p>}
              {fields.map((field, index) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  index={index}
                  count={fields.length}
                  onChange={(next) => updateField(index, next)}
                  onMove={(delta) => moveField(index, delta)}
                  onRemove={() => setFields((list) => list.filter((_, i) => i !== index))}
                />
              ))}
              <div>
                <div className="row-sub" style={{ marginBottom: 6 }}>Add a field</div>
                <div className="btn-row">
                  {Object.entries(FIELD_TYPES).map(([type, { label }]) => (
                    <Button key={type} icon={Plus} onClick={() => setFields((list) => [...list, newField(type)])}>{label}</Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {error && <Notice tone="error">{error}</Notice>}
          <div className="btn-row" style={{ justifyContent: "space-between" }}>
            <div className="btn-row">
              <Button type="submit" variant="primary" loading={saving}>{isNew ? "Create Form" : "Save Changes"}</Button>
              <Link to="/forms" className="btn">Cancel</Link>
            </div>
            {!isNew && <Button variant="danger" icon={Trash2} onClick={handleDelete} disabled={saving}>Delete Form</Button>}
          </div>
        </div>

        <Card title="Preview" icon={Eye}>
          <div className="form">
            <div>
              <div className="row-title" style={{ fontSize: 17, whiteSpace: "normal" }}>{title || "Untitled form"}</div>
              {description && <div className="row-sub">{description}</div>}
            </div>
            <FormFields fields={fields} answers={previewAnswers} idPrefix="preview"
              onChange={(id, value) => setPreviewAnswers((current) => ({ ...current, [id]: value }))} />
            <Button variant="primary" block disabled>Submit</Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
