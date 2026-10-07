import { Link } from "react-router-dom";
import { ClipboardList, ExternalLink, Inbox, Pencil, Plus } from "lucide-react";
import { useQuery } from "../hooks/useQuery";
import { listForms } from "../firebase/forms";
import { formPath, formUrl } from "../lib/forms";
import { Badge, CopyButton, EmptyState, PageHeader, QueryView } from "../components/ui";

function FormCard({ form }) {
  const count = form.submissionCount;
  return (
    <section className="card">
      <div className="card-body" style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="row" style={{ padding: 0, alignItems: "flex-start" }}>
          <div className="row-main">
            <div className="row-title" style={{ fontSize: 16.5, whiteSpace: "normal" }}>{form.title}</div>
            {form.description && <div className="row-sub">{form.description}</div>}
          </div>
          <Badge tone={form.status === "open" ? "success" : ""}>{form.status === "open" ? "Open" : "Closed"}</Badge>
        </div>

        <div className="btn-row">
          <span className="link-chip">{formPath(form.slug)}</span>
          <CopyButton text={formUrl(form.slug)} />
        </div>

        <div className="row-sub">
          {form.fields.length} {form.fields.length === 1 ? "field" : "fields"}
          {count != null && ` · ${count} ${count === 1 ? "submission" : "submissions"}`}
        </div>

        <div className="btn-row">
          <a className="btn" href={formPath(form.slug)} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden />
            View Form
          </a>
          <Link className="btn" to={`/forms/${form.slug}/submissions`}>
            <Inbox size={16} aria-hidden />
            View Submissions
          </Link>
          <Link className="btn" to={`/forms/${form.slug}/edit`}>
            <Pencil size={16} aria-hidden />
            Edit Form
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Forms() {
  const query = useQuery(listForms);
  const createButton = (
    <Link to="/forms/new" className="btn primary">
      <Plus size={16} aria-hidden />
      Create Form
    </Link>
  );

  return (
    <>
      <PageHeader title="Signup Forms" subtitle="Build a form, share its link, and collect responses." action={createButton} />
      <QueryView
        query={query}
        empty={
          <section className="card">
            <EmptyState icon={ClipboardList} title="No signup forms yet"
              message="Create a form for an event or signup, then share its link." action={createButton} />
          </section>
        }
      >
        {(forms) => (
          <div className="grid cols-2">
            {forms.map((form) => <FormCard key={form.slug} form={form} />)}
          </div>
        )}
      </QueryView>
    </>
  );
}
