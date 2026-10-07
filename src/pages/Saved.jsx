import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Clock, Pin, Plus, Star, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { timeAgo } from "../context/AnnouncementsContext";
import { useQuery } from "../hooks/useQuery";
import { useSavedUser } from "../hooks/useSavedUser";
import { listSaved } from "../firebase/saved";
import { CATEGORIES, EMPTY_FILTERS, TYPES, TYPE_ORDER, VISIBILITY, matchesFilters, savedPath, sortSaved } from "../lib/saved";
import SavedCard from "../components/saved/SavedCard";
import SavedResourceModal from "../components/saved/SavedResourceModal";
import { ResourceTypeIcon } from "../components/saved/SavedBits";
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, SearchInput } from "../components/ui";

const VIEWS = [
  { value: "all", label: "All" },
  { value: "mine", label: "My Saved" },
  { value: "church", label: "Church Resources" },
];

export default function Saved() {
  const { user, role } = useAuth();
  const loader = useCallback(() => listSaved(user.uid, role), [user.uid, role]);
  const query = useQuery(loader);
  const { favorites, recent, toggleFavorite, markOpened } = useSavedUser();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const resources = query.data || [];
  const visible = useMemo(
    () => sortSaved(resources.filter((resource) => matchesFilters(resource, filters, { uid: user.uid, favorites, search }))),
    [resources, filters, favorites, search, user.uid]
  );

  const filtering = search.trim() !== "" || JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  // Only resources this leader can still see; shown when nothing is being filtered.
  const recentlyOpened = useMemo(() => {
    const byId = new Map(resources.map((resource) => [resource.id, resource]));
    return Object.entries(recent)
      .sort((a, b) => b[1] - a[1])
      .map(([id, at]) => ({ resource: byId.get(id), at }))
      .filter((entry) => entry.resource)
      .slice(0, 4);
  }, [recent, resources]);

  const handleSaved = (id, { favorite }) => {
    if (favorite) toggleFavorite(id);
    query.reload();
  };

  const addButton = <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add</Button>;
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
  };

  let body;
  if (query.loading && !query.data) {
    body = <section className="card"><div className="card-body"><LoadingState rows={5} /></div></section>;
  } else if (query.error) {
    body = <section className="card"><ErrorState message={query.error} onRetry={query.reload} /></section>;
  } else if (resources.length === 0) {
    body = (
      <section className="card">
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          message="Save important church documents, links, files, and notes here so they're easy to find later."
          action={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add Resource</Button>}
        />
      </section>
    );
  } else if (visible.length === 0) {
    body = (
      <section className="card">
        <EmptyState icon={Bookmark} title="No matches" message="Nothing saved matches the current search and filters."
          action={<Button onClick={clearFilters}>Clear filters</Button>} />
      </section>
    );
  } else {
    body = (
      <div className="grid cols-3">
        {visible.map((resource) => (
          <SavedCard
            key={resource.id}
            resource={resource}
            isFavorite={favorites.has(resource.id)}
            isMine={resource.createdBy === user.uid}
            onToggleFavorite={() => toggleFavorite(resource.id)}
            onPickTag={(tag) => setFilter("tag", tag)}
            onOpenLink={() => markOpened(resource.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Saved" subtitle="Save and organize important church resources, documents, links, and notes." action={addButton} />

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search saved resources..." />
        <div className="segmented" role="group" aria-label="Show">
          {VIEWS.map(({ value, label }) => (
            <button key={value} type="button" aria-pressed={filters.view === value} onClick={() => setFilter("view", value)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filter by type">
        <button type="button" className="chip" aria-pressed={filters.type === "all"} onClick={() => setFilter("type", "all")}>All types</button>
        {TYPE_ORDER.map((type) => (
          <button key={type} type="button" className="chip" aria-pressed={filters.type === type} onClick={() => setFilter("type", type)}>
            {TYPES[type].plural}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={filters.favorites} onClick={() => setFilter("favorites", !filters.favorites)}>
          <Star size={13} aria-hidden /> Favorites
        </button>
        <button type="button" className="chip" aria-pressed={filters.pinned} onClick={() => setFilter("pinned", !filters.pinned)}>
          <Pin size={13} aria-hidden /> Pinned
        </button>
      </div>

      <div className="toolbar">
        <select className="input" style={{ width: "auto" }} aria-label="Category" value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
        </select>
        <select className="input" style={{ width: "auto" }} aria-label="Visibility" value={filters.visibility} onChange={(e) => setFilter("visibility", e.target.value)}>
          <option value="all">Any visibility</option>
          {Object.entries(VISIBILITY).filter(([key]) => key !== "admins" || role === "main_admin").map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
        </select>
        {filters.tag && (
          <button type="button" className="chip" aria-pressed="true" onClick={() => setFilter("tag", "")}>
            #{filters.tag} <X size={13} aria-label="Remove tag filter" />
          </button>
        )}
        {query.data && resources.length > 0 && <span className="toolbar-count">{visible.length} of {resources.length}</span>}
        {filtering && <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
      </div>

      {!filtering && recentlyOpened.length > 0 && (
        <section className="card recent-strip">
          <h2><Clock size={15} aria-hidden /> Recently Opened</h2>
          <div className="recent-list">
            {recentlyOpened.map(({ resource, at }) => (
              <Link key={resource.id} to={savedPath(resource.id)} className="recent-item">
                <ResourceTypeIcon type={resource.type} size={16} />
                <span>
                  <strong>{resource.title}</strong>
                  <span className="row-sub">Opened {timeAgo(at).replace(/^Just now$/, "just now")}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {body}

      {adding && <SavedResourceModal onClose={() => setAdding(false)} onSaved={handleSaved} />}
    </>
  );
}
