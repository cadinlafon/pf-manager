import { Link } from "react-router-dom";

export default function Brand() {
  return (
    <Link to="/dashboard" className="brand" aria-label="PF Management — Dashboard">
      <img src="/icons/icon-192.png" alt="" className="brand-mark" />
      <span>
        <span className="brand-name">PF Management</span>
        <br />
        <span className="brand-sub">Palouse Fellowship</span>
      </span>
    </Link>
  );
}
