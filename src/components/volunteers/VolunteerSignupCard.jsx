import { Link } from "react-router-dom";
import { ExternalLink, Settings2 } from "lucide-react";
import { ProgressBar, SignupMeta, VolunteerStatusBadge } from "./VolunteerBits";
import { totals, volunteerPath } from "../../lib/volunteers";

export default function VolunteerSignupCard({ signup }) {
  const { needed, filled, available, percent } = totals(signup);
  const positions = signup.positions.length;

  return (
    <section className="card">
      <div className="card-body" style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="row" style={{ padding: 0, alignItems: "flex-start" }}>
          <div className="row-main">
            <Link to={`/volunteers/${signup.id}`} className="row-title card-link" style={{ fontSize: 16.5, whiteSpace: "normal" }}>
              {signup.title}
            </Link>
          </div>
          <VolunteerStatusBadge signup={signup} />
        </div>

        <SignupMeta signup={signup} />
        {signup.description && <p className="row-sub clamp-2">{signup.description}</p>}

        <div>
          <div className="progress-label">
            <strong>{filled} of {needed} spots filled</strong>
            <span>{percent}%</span>
          </div>
          <ProgressBar filled={filled} needed={needed} />
          <div className="row-sub" style={{ marginTop: 6 }}>
            {positions} {positions === 1 ? "position" : "positions"} · {available} {available === 1 ? "spot" : "spots"} available
          </div>
        </div>

        <div className="btn-row">
          {signup.status !== "draft" && (
            <a className="btn" href={volunteerPath(signup.id)} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden />
              View
            </a>
          )}
          <Link className="btn primary" to={`/volunteers/${signup.id}`}>
            <Settings2 size={16} aria-hidden />
            Manage
          </Link>
        </div>
      </div>
    </section>
  );
}
