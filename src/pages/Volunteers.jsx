import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HeartHandshake, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "../hooks/useQuery";
import { listSignups, loadDemoSignups } from "../firebase/volunteers";
import { STATUS_FILTERS, displayStatus, sortSignups } from "../lib/volunteers";
import VolunteerSignupCard from "../components/volunteers/VolunteerSignupCard";
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, SearchInput } from "../components/ui";

export default function Volunteers() {
  const { isPreview } = useAuth();
  const query = useQuery(listSignups);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const signups = useMemo(() => sortSignups(query.data || []), [query.data]);
  const counts = useMemo(() => {
    const tally = { All: signups.length };
    for (const signup of signups) {
      const status = displayStatus(signup);
      tally[status] = (tally[status] || 0) + 1;
    }
    return tally;
  }, [signups]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return signups
      .filter((signup) => filter === "All" || displayStatus(signup) === filter)
      .filter((signup) => !term || `${signup.title} ${signup.location}`.toLowerCase().includes(term));
  }, [signups, search, filter]);

  const createButton = (
    <Link to="/volunteers/new" className="btn primary">
      <Plus size={16} aria-hidden />
      Create Signup
    </Link>
  );

  let body;
  if (query.loading) {
    body = <section className="card"><div className="card-body"><LoadingState rows={5} /></div></section>;
  } else if (query.error) {
    body = <section className="card"><ErrorState message={query.error} onRetry={query.reload} /></section>;
  } else if (signups.length === 0) {
    body = (
      <section className="card">
        <EmptyState
          icon={HeartHandshake}
          title="No volunteer signups yet"
          message="Create your first volunteer signup to start organizing people for church events and ministries."
          action={
            <div className="btn-row" style={{ justifyContent: "center" }}>
              {createButton}
              {isPreview && <Button onClick={() => { loadDemoSignups(); query.reload(); }}>Load demo signups (preview only)</Button>}
            </div>
          }
        />
      </section>
    );
  } else if (visible.length === 0) {
    body = (
      <section className="card">
        <EmptyState icon={HeartHandshake} title="No matches" message="No signups match the current search and filter."
          action={<Button onClick={() => { setSearch(""); setFilter("All"); }}>Clear filters</Button>} />
      </section>
    );
  } else {
    body = (
      <div className="grid cols-2">
        {visible.map((signup) => <VolunteerSignupCard key={signup.id} signup={signup} />)}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Volunteers" subtitle="Create and manage volunteer opportunities, signup sheets, and schedules." action={createButton} />

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search volunteer signups..." />
        {!query.loading && !query.error && signups.length > 0 && (
          <span className="toolbar-count">{visible.length} of {signups.length}</span>
        )}
      </div>

      <div className="chips" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.filter((option) => option !== "Draft" || counts.Draft).map((option) => (
          <button key={option} type="button" className="chip" aria-pressed={filter === option} onClick={() => setFilter(option)}>
            {option} <span>{counts[option] || 0}</span>
          </button>
        ))}
      </div>

      {body}
    </>
  );
}
