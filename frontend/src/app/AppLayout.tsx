import { NavLink } from "react-router-dom";

type Props = {
  children: React.ReactNode;
};

const navItems = [
  { label: "Investigations", to: "/" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "Agents", to: "/agents" },
  { label: "Tasks", to: "/tasks" },
  { label: "Metrics", to: "/metrics" }
];

export default function AppLayout({ children }: Props) {
  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand">
          <div className="brand__mark" />
          <div>
            <p className="brand__name">AgentOps</p>
            <p className="brand__tag">Agent reliability, inspected</p>
          </div>
        </div>
        <nav className="nav-links" aria-label="Primary">
          {navItems.filter(item => import.meta.env.VITE_DEMO_MODE !== "true" || item.to === "/").map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-meta">
          <span className="pill">Evidence before confidence</span>
        </div>
      </header>

      <main className="content-area">{children}</main>
    </div>
  );
}
