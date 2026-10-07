import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, UsersRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { groupStore } from "../firebase/store";
import { listPeople } from "../firebase/people";
import Modal from "../components/ui/Modal";
import PeopleTabs from "../components/people/PeopleTabs";
import { initials } from "./People";
import { Button, EmptyState, ErrorState, LoadingState, Notice, PageHeader, SearchInput, TextField } from "../components/ui";

// Create and rename share one dialog; `group` is null when creating.
export function GroupModal({ group, onClose, onSaved }) {
  const { user } = useAuth();
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { name: name.trim(), description: description.trim() };
    if (!data.name) return setError("Give the group a name.");
    setBusy(true);
    setError("");
    try {
      if (group) await groupStore.update(group.id, data);
      else await groupStore.create({ ...data, memberIds: [] }, { uid: user.uid });
      onSaved(data.name);
      onClose();
    } catch (err) {
      setError(firestoreMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={group ? "Edit Group" : "New Group"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="group-form" variant="primary" loading={busy}>{group ? "Save" : "Create Group"}</Button>
        </>
      }
    >
      <form id="group-form" className="form" onSubmit={handleSubmit} noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <TextField label="Group Name" id="g-name" maxLength={80} placeholder="e.g. 1st Service" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Description (optional)" id="g-description" as="textarea" rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
        {!group && <span className="row-sub">You'll choose who's in it next.</span>}
      </form>
    </Modal>
  );
}

export default function Groups() {
  const navigate = useNavigate();
  // Groups and people together, so each card can show who's in it.
  const loader = useCallback(async () => {
    const [groups, people] = await Promise.all([groupStore.list(), listPeople()]);
    return { groups, people };
  }, []);
  const query = useQuery(loader);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const data = query.data && !Array.isArray(query.data) ? query.data : null;
  const groups = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.people.map((person) => [person.id, person]));
    return data.groups
      // People deleted from the directory simply drop out of the group.
      .map((group) => ({ ...group, members: (group.memberIds || []).map((id) => byId.get(id)).filter(Boolean) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  const visible = groups.filter((group) => !search.trim() || `${group.name} ${group.description}`.toLowerCase().includes(search.trim().toLowerCase()));

  // After creating, go straight to the newest group to add people.
  const handleCreated = async (name) => {
    const all = await groupStore.list().catch(() => []);
    const made = all.filter((group) => group.name === name).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    if (made) navigate(`/people/groups/${made.id}`, { state: { addPeople: true } });
    else query.reload();
  };

  const newButton = <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New Group</Button>;

  let body;
  if (query.loading && !data) {
    body = <section className="card"><div className="card-body"><LoadingState rows={4} /></div></section>;
  } else if (query.error) {
    body = <section className="card"><ErrorState message={query.error} onRetry={query.reload} /></section>;
  } else if (groups.length === 0) {
    body = (
      <section className="card">
        <EmptyState icon={UsersRound} title="No groups yet"
          message={'Make a group like "1st Service" or "Youth Leaders" and choose who belongs in it.'} action={newButton} />
      </section>
    );
  } else if (visible.length === 0) {
    body = <section className="card"><EmptyState icon={UsersRound} title="No matches" message={`No groups match "${search}".`} /></section>;
  } else {
    body = (
      <div className="grid cols-3">
        {visible.map((group) => (
          <Link key={group.id} to={`/people/groups/${group.id}`} className="card card-button" style={{ textDecoration: "none" }}>
            <div>
              <div className="row-title" style={{ fontSize: 16, whiteSpace: "normal" }}>{group.name}</div>
              {group.description && <div className="row-sub clamp-2">{group.description}</div>}
            </div>
            <div className="row" style={{ padding: 0 }}>
              {group.members.length > 0 && (
                <span className="avatar-stack">
                  {group.members.slice(0, 5).map((person) => <span key={person.id} className="avatar sm">{initials(person.name)}</span>)}
                </span>
              )}
              <span className="row-sub">
                {group.members.length} {group.members.length === 1 ? "person" : "people"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Groups" subtitle="Put people into groups you can come back to." action={newButton} />
      <PeopleTabs />
      {groups.length > 0 && (
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search groups..." />
          <span className="toolbar-count">{visible.length} of {groups.length}</span>
        </div>
      )}
      {body}
      {creating && <GroupModal onClose={() => setCreating(false)} onSaved={handleCreated} />}
    </>
  );
}
