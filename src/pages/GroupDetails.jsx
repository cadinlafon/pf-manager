import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Pencil, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { groupStore } from "../firebase/store";
import { listPeople } from "../firebase/people";
import { downloadCsv } from "../lib/format";
import Modal from "../components/ui/Modal";
import { GroupModal } from "./Groups";
import { STATUS_TONE, initials } from "./People";
import { Badge, Button, Card, CopyButton, EmptyState, ErrorState, LoadingState, Notice, PageHeader, SearchInput } from "../components/ui";

// Tick who belongs in the group. Saves the whole selection at once.
function PickPeopleModal({ group, people, onClose, onSaved }) {
  const [selected, setSelected] = useState(() => new Set(group.memberIds || []));
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sorted = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name)), [people]);
  const term = search.trim().toLowerCase();
  const shown = sorted.filter((person) => !term || `${person.name} ${person.email} ${person.status}`.toLowerCase().includes(term));

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSave = async () => {
    setBusy(true);
    setError("");
    try {
      // Keep only people who still exist in the directory.
      const valid = new Set(people.map((person) => person.id));
      await groupStore.update(group.id, { memberIds: [...selected].filter((id) => valid.has(id)) });
      onSaved();
      onClose();
    } catch (err) {
      setError(firestoreMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`People in ${group.name}`}
      onClose={onClose}
      footer={
        <>
          <span className="row-sub" style={{ marginRight: "auto" }}>{selected.size} selected</span>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={busy}>Save</Button>
        </>
      }
    >
      <div className="form">
        {error && <Notice tone="error">{error}</Notice>}
        {people.length === 0 ? (
          <Notice>There's nobody in the directory yet. Add people under All People first.</Notice>
        ) : (
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Search people..." />
            <div className="pick-list">
              {shown.length === 0 && <div className="menu-empty">No one matches "{search}".</div>}
              {shown.map((person) => (
                <label key={person.id}>
                  <input type="checkbox" checked={selected.has(person.id)} onChange={() => toggle(person.id)} />
                  <span className="avatar sm">{initials(person.name)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{person.name}</span>
                  <Badge tone={STATUS_TONE[person.status]}>{person.status}</Badge>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function GroupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const loader = useCallback(async () => {
    const [groups, people] = await Promise.all([groupStore.list(), listPeople()]);
    return { group: groups.find((group) => group.id === id) || null, people };
  }, [id]);
  const query = useQuery(loader);
  // Arriving straight from "New Group" opens the picker.
  const [picking, setPicking] = useState(Boolean(location.state?.addPeople));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const data = query.data && !Array.isArray(query.data) ? query.data : null;
  const group = data?.group;
  const members = useMemo(() => {
    if (!group) return [];
    const byId = new Map(data.people.map((person) => [person.id, person]));
    return (group.memberIds || []).map((personId) => byId.get(personId)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  }, [group, data]);

  const back = (
    <Link to="/people/groups" className="btn">
      <ArrowLeft size={16} aria-hidden />
      All Groups
    </Link>
  );

  if (query.loading && !data) return (<><PageHeader title="Group" action={back} /><Card><LoadingState rows={5} /></Card></>);
  if (query.error) return (<><PageHeader title="Group" action={back} /><section className="card"><ErrorState message={query.error} onRetry={query.reload} /></section></>);
  if (!group) return (<><PageHeader title="Group" action={back} /><section className="card"><EmptyState icon={UsersRound} title="Group not found" message="It may have been deleted." /></section></>);

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

  const removeMember = (person) => {
    if (!window.confirm(`Take ${person.name} out of ${group.name}? They stay in the directory.`)) return;
    run(person.id, () => groupStore.update(group.id, { memberIds: (group.memberIds || []).filter((personId) => personId !== person.id) }));
  };

  const deleteGroup = () => {
    if (!window.confirm(`Delete the group "${group.name}"? The people in it are not deleted.`)) return;
    run("delete", () => groupStore.remove(group.id), () => navigate("/people/groups", { replace: true }));
  };

  const emails = members.map((person) => person.email).filter(Boolean);
  const exportCsv = () =>
    downloadCsv(`${group.name}.csv`, [["Name", "Email", "Status", "Address"], ...members.map((p) => [p.name, p.email || "", p.status, p.address || ""])]);

  return (
    <>
      <PageHeader
        title={group.name}
        subtitle={group.description || `${members.length} ${members.length === 1 ? "person" : "people"}`}
        action={back}
      />

      <div className="stack">
        {error && <Notice tone="error">{error}</Notice>}

        <div className="btn-row">
          <Button variant="primary" icon={UserPlus} onClick={() => setPicking(true)}>{members.length ? "Add / Remove People" : "Add People"}</Button>
          <Button icon={Pencil} onClick={() => setEditing(true)}>Edit Group</Button>
          {emails.length > 0 && <CopyButton text={emails.join(", ")} label="Copy Emails" />}
          {members.length > 0 && <Button icon={Download} onClick={exportCsv}>Export CSV</Button>}
          <Button variant="danger" icon={Trash2} loading={busy === "delete"} onClick={deleteGroup}>Delete Group</Button>
        </div>

        <section className="card">
          {members.length === 0 ? (
            <EmptyState icon={UsersRound} title="Nobody in this group yet" message="Choose who belongs in it."
              action={<Button variant="primary" icon={UserPlus} onClick={() => setPicking(true)}>Add People</Button>} />
          ) : (
            <ul className="list">
              {members.map((person) => (
                <li key={person.id} className="row" style={{ padding: "10px 18px" }}>
                  <span className="avatar">{initials(person.name)}</span>
                  <div className="row-main">
                    <div className="row-title">{person.name}</div>
                    {person.email && <div className="row-sub">{person.email}</div>}
                  </div>
                  <Badge tone={STATUS_TONE[person.status]}>{person.status}</Badge>
                  <button type="button" className="icon-btn" aria-label={`Remove ${person.name} from the group`} disabled={busy === person.id} onClick={() => removeMember(person)}>
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {picking && <PickPeopleModal group={group} people={data.people} onClose={() => setPicking(false)} onSaved={query.reload} />}
      {editing && <GroupModal group={group} onClose={() => setEditing(false)} onSaved={query.reload} />}
    </>
  );
}
