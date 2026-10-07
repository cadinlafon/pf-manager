import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MapPin, Package, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { inventoryStore } from "../firebase/store";
import Modal from "../components/ui/Modal";
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, SearchInput, TextField } from "../components/ui";

const CATEGORIES = ["Audio/Visual", "Furniture", "Books", "Kitchen", "Office", "Grounds", "Other"];
const EMPTY_ITEM = { name: "", quantity: "1", category: CATEGORIES[0], location: "", notes: "" };

// Add and edit share one dialog; `item` is null when adding.
function ItemModal({ item, onClose, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState(
    item ? { name: item.name, quantity: String(item.quantity), category: item.category, location: item.location || "", notes: item.notes || "" } : EMPTY_ITEM
  );
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
    const quantity = Number(form.quantity);
    if (!form.name.trim()) return setError("Item name is required.");
    if (!Number.isInteger(quantity) || quantity < 0) return setError("Quantity must be a whole number, 0 or more.");
    const data = { name: form.name.trim(), quantity, category: form.category, location: form.location.trim(), notes: form.notes.trim() };
    run(() => (item ? inventoryStore.update(item.id, data) : inventoryStore.create(data, { uid: user.uid })));
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${item.name}" from inventory? This can't be undone.`)) return;
    run(() => inventoryStore.remove(item.id));
  };

  return (
    <Modal
      title={item ? "Edit Item" : "Add Item"}
      onClose={onClose}
      footer={
        <>
          {item && <Button variant="danger" icon={Trash2} onClick={handleDelete} disabled={busy} style={{ marginRight: "auto" }}>Delete</Button>}
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="item-form" variant="primary" loading={busy}>{item ? "Save" : "Add Item"}</Button>
        </>
      }
    >
      <form id="item-form" className="form" onSubmit={handleSubmit} noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <TextField label="Item Name" id="i-name" value={form.name} onChange={set("name")} />
        <div className="form-row">
          <TextField label="Quantity" id="i-qty" type="number" min="0" step="1" inputMode="numeric" value={form.quantity} onChange={set("quantity")} />
          <Field label="Category" id="i-category">
            <select id="i-category" className="input" value={form.category} onChange={set("category")}>
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </Field>
        </div>
        <TextField label="Location" id="i-location" placeholder="e.g. Storage Room" value={form.location} onChange={set("location")} />
        <TextField label="Notes" id="i-notes" as="textarea" value={form.notes} onChange={set("notes")} />
      </form>
    </Modal>
  );
}

export default function Inventory() {
  const query = useQuery(inventoryStore.list);
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  // `editing`: undefined = closed, null = adding, object = editing that item.
  const [editing, setEditing] = useState(location.state?.openAdd ? null : undefined);

  const items = query.data || [];
  const usedCategories = useMemo(() => CATEGORIES.filter((c) => items.some((item) => item.category === c)), [items]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => category === "All" || item.category === category)
      .filter((item) => !term || `${item.name} ${item.category} ${item.location} ${item.notes}`.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search, category]);

  const addButton = <Button variant="primary" icon={Plus} onClick={() => setEditing(null)}>Add Item</Button>;

  let body;
  if (query.loading && !query.data) {
    body = <section className="card"><div className="card-body"><LoadingState rows={5} /></div></section>;
  } else if (query.error) {
    body = <section className="card"><ErrorState message={query.error} onRetry={query.reload} /></section>;
  } else if (items.length === 0) {
    body = (
      <section className="card">
        <EmptyState icon={Package} title="No inventory yet" message="Add your first item to start tracking church equipment and supplies." action={addButton} />
      </section>
    );
  } else if (visible.length === 0) {
    body = (
      <section className="card">
        <EmptyState icon={Package} title="No matches" message="No items match the current search and filter."
          action={<Button onClick={() => { setSearch(""); setCategory("All"); }}>Clear filters</Button>} />
      </section>
    );
  } else {
    body = (
      <div className="grid cols-3">
        {visible.map((item) => (
          <button key={item.id} type="button" className="card card-button" onClick={() => setEditing(item)}>
            <div className="row" style={{ padding: 0, alignItems: "flex-start" }}>
              <div className="row-main">
                <div className="row-title" style={{ whiteSpace: "normal" }}>{item.name}</div>
                <Badge>{item.category}</Badge>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="stat-value" style={{ marginTop: 0, fontSize: 26 }}>{item.quantity}</div>
                <div className="row-sub">Quantity</div>
              </div>
            </div>
            <div className="row-sub" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={14} aria-hidden />
              {item.location || "No location set"}
            </div>
            {item.notes && <div className="row-sub clamp-2">{item.notes}</div>}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Inventory" subtitle="Church equipment and supplies." action={addButton} />

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search inventory..." />
        {query.data && items.length > 0 && <span className="toolbar-count">{visible.length} of {items.length}</span>}
      </div>

      {usedCategories.length > 1 && (
        <div className="chips" role="group" aria-label="Filter by category">
          {["All", ...usedCategories].map((option) => (
            <button key={option} type="button" className="chip" aria-pressed={category === option} onClick={() => setCategory(option)}>
              {option} <span>{option === "All" ? items.length : items.filter((item) => item.category === option).length}</span>
            </button>
          ))}
        </div>
      )}

      {body}

      {editing !== undefined && <ItemModal item={editing} onClose={() => setEditing(undefined)} onSaved={query.reload} />}
    </>
  );
}
