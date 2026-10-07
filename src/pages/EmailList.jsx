import { useMemo, useState } from "react";
import { Download, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { emailListStore } from "../firebase/store";
import { listPeople } from "../firebase/people";
import { downloadCsv } from "../lib/format";
import { Button, Card, CopyButton, EmptyState, ErrorState, LoadingState, Notice, PageHeader, SearchInput, TextField } from "../components/ui";

// The church email list, kept in PF Management. It can be exported as a CSV
// (Email Address / First Name / Last Name — the column names Mailchimp and
// most email tools import directly) or copied as a list of addresses.

const EMPTY_FORM = { firstName: "", lastName: "", email: "" };
const validEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

function AddPersonForm({ contacts, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim().toLowerCase() };
    if (!data.firstName || !validEmail(data.email)) return setMessage({ tone: "error", text: "Enter a first name and a valid email address." });
    if (contacts.some((contact) => contact.email === data.email)) return setMessage({ tone: "error", text: `${data.email} is already on the list.` });

    setBusy(true);
    setMessage(null);
    try {
      await emailListStore.create(data, { uid: user.uid });
      setForm(EMPTY_FORM);
      setMessage({ tone: "success", text: `Added ${data.email}.` });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: firestoreMessage(err) });
    }
    setBusy(false);
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className="form-row">
        <TextField label="First Name" id="e-first" value={form.firstName} onChange={set("firstName")} />
        <TextField label="Last Name" id="e-last" value={form.lastName} onChange={set("lastName")} />
      </div>
      <TextField label="Email" id="e-email" type="email" placeholder="name@example.com" value={form.email} onChange={set("email")} />
      <Button type="submit" variant="primary" icon={UserPlus} loading={busy}>Add to Email List</Button>
    </form>
  );
}

// Offers to copy over everyone in the People directory who has an email and
// isn't on the list yet.
function ImportFromPeople({ contacts, onSaved }) {
  const { user } = useAuth();
  const people = useQuery(listPeople);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const missing = useMemo(() => {
    const onList = new Set(contacts.map((contact) => contact.email));
    const seen = new Set();
    return (people.data || []).filter((person) => {
      const email = (person.email || "").trim().toLowerCase();
      if (!validEmail(email) || onList.has(email) || seen.has(email)) return false;
      seen.add(email);
      return true;
    });
  }, [people.data, contacts]);

  const handleImport = async () => {
    setBusy(true);
    setMessage(null);
    try {
      for (const person of missing) {
        const [firstName, ...rest] = person.name.trim().split(/\s+/);
        await emailListStore.create({ firstName, lastName: rest.join(" "), email: person.email.trim().toLowerCase() }, { uid: user.uid });
      }
      setMessage({ tone: "success", text: `Added ${missing.length} ${missing.length === 1 ? "person" : "people"} from People.` });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: firestoreMessage(err) });
      onSaved();
    }
    setBusy(false);
  };

  if (!message && missing.length === 0) return null;

  return (
    <Card title="Add from People" icon={Users}>
      <div className="form">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {missing.length > 0 && (
          <>
            <p className="row-sub">
              {missing.length} {missing.length === 1 ? "person" : "people"} in the People directory {missing.length === 1 ? "has" : "have"} an
              email address that isn't on this list yet.
            </p>
            <div><Button onClick={handleImport} loading={busy}>Add {missing.length === 1 ? "them" : `all ${missing.length}`}</Button></div>
          </>
        )}
      </div>
    </Card>
  );
}

export default function EmailList() {
  const query = useQuery(emailListStore.list);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const contacts = useMemo(
    () => [...(query.data || [])].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
    [query.data]
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? contacts.filter((c) => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(term)) : contacts;
  }, [contacts, search]);

  const remove = async (contact) => {
    if (!window.confirm(`Remove ${contact.email} from the email list?`)) return;
    setError("");
    try {
      await emailListStore.remove(contact.id);
      query.reload();
    } catch (err) {
      setError(firestoreMessage(err));
    }
  };

  const exportCsv = () =>
    downloadCsv("email-list.csv", [["Email Address", "First Name", "Last Name"], ...contacts.map((c) => [c.email, c.firstName, c.lastName])]);

  return (
    <>
      <PageHeader title="Email List" subtitle="The church's email contacts, ready to copy or export." />

      <div className="grid main-side">
        <Card
          title={`Contacts${query.data ? ` (${contacts.length})` : ""}`}
          icon={Mail}
          action={
            contacts.length > 0 && (
              <div className="btn-row">
                <CopyButton text={contacts.map((c) => c.email).join(", ")} label="Copy Emails" />
                <Button icon={Download} onClick={exportCsv}>Export CSV</Button>
              </div>
            )
          }
        >
          {error && <div style={{ marginBottom: 12 }}><Notice tone="error">{error}</Notice></div>}
          {query.loading && !query.data ? (
            <LoadingState rows={4} />
          ) : query.error ? (
            <ErrorState message={query.error} onRetry={query.reload} />
          ) : contacts.length === 0 ? (
            <EmptyState icon={Mail} title="No contacts yet" message="Add people here to build the church's email list." />
          ) : (
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Search contacts..." />
              {visible.length === 0 ? (
                <EmptyState icon={Mail} title="No matches" message={`No contacts match "${search}".`} />
              ) : (
                <ul className="list" style={{ marginTop: 6 }}>
                  {visible.map((contact) => (
                    <li key={contact.id} className="row">
                      <div className="row-main">
                        <div className="row-title">{contact.firstName} {contact.lastName}</div>
                        <div className="row-sub">{contact.email}</div>
                      </div>
                      <button type="button" className="icon-btn" aria-label={`Remove ${contact.email}`} onClick={() => remove(contact)}>
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>

        <div className="stack">
          <Card title="Add Person" icon={UserPlus}>
            <AddPersonForm contacts={contacts} onSaved={query.reload} />
          </Card>
          {query.data && <ImportFromPeople contacts={contacts} onSaved={query.reload} />}
        </div>
      </div>
    </>
  );
}
