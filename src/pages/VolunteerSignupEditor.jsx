import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, Plus, SlidersHorizontal, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { createSignup, getSignup, updateSignup } from "../firebase/volunteers";
import { filledFor, newPosition, validateSignup } from "../lib/volunteers";
import VolunteerPositionEditor from "../components/volunteers/VolunteerPositionEditor";
import { Button, Card, EmptyState, ErrorState, LoadingState, Notice, PageHeader, TextField } from "../components/ui";

const SETTINGS = [
  { key: "allowCancellation", label: "Allow volunteers to cancel their own signup from the public page" },
];

const EMPTY = {
  title: "", description: "", date: "", startTime: "", endTime: "", location: "",
  allowCancellation: true,
};

export default function VolunteerSignupEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const loader = useCallback(() => (isNew ? Promise.resolve(null) : getSignup(id)), [isNew, id]);
  const existing = useQuery(loader);
  const original = existing.data && !Array.isArray(existing.data) ? existing.data : null;

  const [form, setForm] = useState(EMPTY);
  const [positions, setPositions] = useState(() => [newPosition()]);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!original) return;
    setForm(Object.fromEntries(Object.keys(EMPTY).map((key) => [key, original[key] ?? EMPTY[key]])));
    setPositions(original.positions);
  }, [original]);

  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const filled = (position) => (original ? filledFor(original, position.id) : 0);

  const removePosition = (position) => {
    const count = filled(position);
    if (count > 0 && !window.confirm(`${count} ${count === 1 ? "person is" : "people are"} signed up for "${position.name}". Deleting it removes them from this signup when you save. Continue?`)) return;
    setPositions((list) => list.filter((p) => p.id !== position.id));
  };

  const save = async (status) => {
    const problem = validateSignup({ ...form, positions });
    if (problem) return setError(problem);

    setSaving(status);
    setError("");
    const data = {
      title: form.title.trim(),
      description: form.description.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location.trim(),
      allowCancellation: form.allowCancellation,
      positions: positions.map((p) => ({ id: p.id, name: p.name.trim(), description: p.description.trim(), spotsNeeded: p.spotsNeeded })),
    };

    try {
      if (isNew) {
        const newId = await createSignup({ ...data, status }, { uid: user.uid });
        navigate(`/volunteers/${newId}`, { replace: true });
      } else {
        const kept = new Set(positions.map((p) => p.id));
        await updateSignup(id, data, original.positions.filter((p) => !kept.has(p.id)).map((p) => p.id));
        navigate(`/volunteers/${id}`);
      }
    } catch (err) {
      setError(firestoreMessage(err));
      setSaving("");
    }
  };

  const backTo = isNew ? "/volunteers" : `/volunteers/${id}`;
  const back = (
    <Link to={backTo} className="btn">
      <ArrowLeft size={16} aria-hidden />
      {isNew ? "All Signups" : "Back to Signup"}
    </Link>
  );

  if (!isNew && existing.loading) return (<><PageHeader title="Edit Signup" action={back} /><Card><LoadingState rows={6} /></Card></>);
  if (!isNew && existing.error) return (<><PageHeader title="Edit Signup" action={back} /><section className="card"><ErrorState message={existing.error} onRetry={existing.reload} /></section></>);
  if (!isNew && !original) return (<><PageHeader title="Edit Signup" action={back} /><section className="card"><EmptyState title="Signup not found" message="It may have been deleted." /></section></>);

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(isNew ? "open" : original.status); }} noValidate>
      <PageHeader title={isNew ? "Create Signup" : "Edit Signup"} subtitle="Set up the event, then list the positions you need filled." action={back} />

      <div className="stack" style={{ maxWidth: 760 }}>
        <Card title="Basic Information" icon={ClipboardList}>
          <div className="form">
            <TextField label="Title" id="v-title" value={form.title} placeholder="e.g. Fellowship Dinner Volunteers" onChange={set("title")} />
            <TextField label="Description" id="v-description" as="textarea" value={form.description}
              placeholder="Optional — e.g. Help us prepare, serve, and clean up after the fellowship dinner." onChange={set("description")} />
            <TextField label="Date" id="v-date" type="date" value={form.date} onChange={set("date")} />
            <div className="form-row">
              <TextField label="Start Time (optional)" id="v-start" type="time" value={form.startTime} onChange={set("startTime")} />
              <TextField label="End Time (optional)" id="v-end" type="time" value={form.endTime} onChange={set("endTime")} />
            </div>
            <TextField label="Location" id="v-location" value={form.location} placeholder="Optional — e.g. Fellowship Hall" onChange={set("location")} />
          </div>
        </Card>

        <Card title="Volunteer Positions" icon={Users}>
          <div className="form">
            {positions.length === 0 && <p className="row-sub">No positions yet. Add the first one below.</p>}
            {positions.map((position) => (
              <VolunteerPositionEditor
                key={position.id}
                position={position}
                filled={filled(position)}
                onChange={(next) => setPositions((list) => list.map((p) => (p.id === next.id ? next : p)))}
                onRemove={() => removePosition(position)}
              />
            ))}
            <div><Button icon={Plus} onClick={() => setPositions((list) => [...list, newPosition()])}>Add Position</Button></div>
          </div>
        </Card>

        <Card title="Signup Settings" icon={SlidersHorizontal}>
          <div className="form">
            {SETTINGS.map(({ key, label }) => (
              <label key={key} className="check">
                <input type="checkbox" checked={form[key]} onChange={set(key)} />
                {label}
              </label>
            ))}
          </div>
        </Card>

        {error && <Notice tone="error">{error}</Notice>}
        <div className="btn-row">
          <Button type="submit" variant="primary" loading={saving === "open" || saving === "closed" || (!isNew && Boolean(saving))} disabled={Boolean(saving)}>
            {isNew ? "Create Signup" : "Save Changes"}
          </Button>
          {isNew && <Button onClick={() => save("draft")} loading={saving === "draft"} disabled={Boolean(saving)}>Save as Draft</Button>}
          <Link to={backTo} className="btn">Cancel</Link>
        </div>
      </div>
    </form>
  );
}
