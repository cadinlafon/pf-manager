// Small pieces shared by the volunteer pages (leader and public).
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { Badge } from "../ui";
import { displayStatus, formatDate, formatTimeRange } from "../../lib/volunteers";

const STATUS_TONE = { Open: "success", Full: "info", Closed: "", Draft: "warn", Past: "" };

export function VolunteerStatusBadge({ signup }) {
  const status = displayStatus(signup);
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

export function ProgressBar({ filled, needed }) {
  const percent = needed ? Math.min(100, Math.round((filled / needed) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={needed} aria-valuenow={filled}
      aria-label={`${filled} of ${needed} spots filled`}>
      <div className={`progress-fill${percent >= 100 ? " full" : ""}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

// Date / time / location lines, each only if present.
export function SignupMeta({ signup }) {
  const time = formatTimeRange(signup);
  return (
    <div className="meta">
      <span><CalendarDays size={15} aria-hidden />{formatDate(signup.date)}</span>
      {time && <span><Clock size={15} aria-hidden />{time}</span>}
      {signup.location && <span><MapPin size={15} aria-hidden />{signup.location}</span>}
    </div>
  );
}
