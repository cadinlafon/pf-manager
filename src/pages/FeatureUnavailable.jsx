import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { EmptyState, PageHeader } from "../components/ui";

// Shown in place of a page that has been switched off (see src/lib/features.js).
export default function FeatureUnavailable({ title }) {
  return (
    <>
      <PageHeader title={title} />
      <section className="card">
        <EmptyState
          icon={Lock}
          title={`${title} is unavailable`}
          message="This part of PF Management is turned off right now."
          action={<Link to="/dashboard" className="btn primary">Back to Dashboard</Link>}
        />
      </section>
    </>
  );
}
