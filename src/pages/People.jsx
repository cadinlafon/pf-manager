import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight, Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { PEOPLE_STATUSES, createPerson, deletePerson, listPeople, updatePerson } from "../firebase/people";
import Modal from "../components/ui/Modal";
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, SearchInput, TextField } from "../components/ui";

const STATUS_TONE = { Member: "success", "Regular Attender": "info", Visitor: "warn", Inactive: "" };
const EMPTY_PERSON = { name: "", email: "", status: PEOPLE_STATUSES[0], address: "" };

const SORTS = {
  name: { label: "Name (A–Z)", compare: (a, b) => a.name.localeCompare(b.name) },
  newest: { label: "Recently added", compare: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) },
};

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";

// Add and edit share one dialog; `person` is null when adding.
function PersonModal({ person, onClose, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState(person ? { name: person.name, email: person.email || "", status: person.status, address: person.address || "" } : EMPTY_PERSON);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      onSaved();
      onClose();
    } catch (err) {
      setError(firestoreMessage(err));
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { name: form.name.trim(), email: form.email.trim(), status: form.status, address: form.address.trim() };
    if (!data.name) return setError("Name is required.");
    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) return setError("Enter a valid email address, or leave it blank.");
    run(() => (person ? updatePerson(person.id, data) : createPerson(data, { uid: user.uid })));
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete ${person.name}? This can't be undone.`)) return;
    run(() => deletePerson(person.id));
  };

  return (
    <Modal
      title={person ? "Edit Person" : "Add Person"}
      onClose={onClose}
      footer={
        <>
          {person && <Button variant="danger" icon={Trash2} onClick={handleDelete} disabled={busy} style={{ marginRight: "auto" }}>Delete</Button>}
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="person-form" variant="primary" loading={busy}>{person ? "Save" : "Add Person"}</Button>
        </>
      }
    >
      <form id="person-form" className="form" onSubmit={handleSubmit} noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <TextField label="Name" id="p-name" value={form.name} autoComplete="off" onChange={set("name")} />
        <TextField label="Email" id="p-email" type="email" value={form.email} autoComplete="off" onChange={set("email")} />
        <Field label="Member Status" id="p-status">
          <select id="p-status" className="input" value={form.status} onChange={set("status")}>
            {PEOPLE_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </Field>
        <TextField label="Address" id="p-address" as="textarea" rows={2} value={form.address} autoComplete="off" onChange={set("address")} />
      </form>
    </Modal>
  );
}

export default function People() {
  const query = useQuery(listPeople);
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("name");
  // `editing`: undefined = closed, null = adding, object = editing that person.
  const [editing, setEditing] = useState(location.state?.openAdd ? null : undefined);

  const people = query.data || [];
  const counts = useMemo(() => {
    const tally = { All: people.length };
    for (const person of people) tally[person.status] = (tally[person.status] || 0) + 1;
    return tally;
  }, [people]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return people
      .filter((person) => status === "All" || person.status === status)
      .filter((person) => !term || `${person.name} ${person.email} ${person.address}`.toLowerCase().includes(term))
      .sort(SORTS[sort].compare);
  }, [people, search, status, sort]);

  const addButton = <Button variant="primary" icon={Plus} onClick={() => setEditing(null)}>Add Person</Button>;

  let body;
  if (query.loading) {
    body = <div className="card-body"><LoadingState rows={5} /></div>;
  } else if (query.error) {
    body = <ErrorState message={query.error} onRetry={query.reload} />;
  } else if (people.length === 0) {
    body = <EmptyState icon={Users} title="No people yet" message="Add the first person to start the directory." action={addButton} />;
  } else if (visible.length === 0) {
    body = (
      <EmptyState icon={Users} title="No matches" message="No one matches the current search and filters."
        action={<Button onClick={() => { setSearch(""); setStatus("All"); }}>Clear filters</Button>} />
    );
  } else {
    body = (
      <ul className="list">
        {visible.map((person) => (
          <li key={person.id}>
            <button type="button" className="row row-btn" onClick={() => setEditing(person)}>
              <span className="avatar">{initials(person.name)}</span>
              <div className="row-main">
                <div className="row-title">{person.name}</div>
                {person.email && <div className="row-sub">{person.email}</div>}
                {person.address && <div className="row-sub">{person.address}</div>}
              </div>
              <Badge tone={STATUS_TONE[person.status]}>{person.status}</Badge>
              <ChevronRight size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <PageHeader title="People" subtitle="Everyone connected to the church." action={addButton} />

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search people..." />
        <select className="input" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          {Object.entries(SORTS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {!query.loading && !query.error && <span className="toolbar-count">{visible.length} of {people.length}</span>}
      </div>

      <div className="chips" role="group" aria-label="Filter by member status">
        {["All", ...PEOPLE_STATUSES].map((option) => (
          <button key={option} type="button" className="chip" aria-pressed={status === option} onClick={() => setStatus(option)}>
            {option} <span>{counts[option] || 0}</span>
          </button>
        ))}
      </div>

      <section className="card">{body}</section>

      {editing !== undefined && <PersonModal person={editing} onClose={() => setEditing(undefined)} onSaved={query.reload} />}
    </>
  );
}
