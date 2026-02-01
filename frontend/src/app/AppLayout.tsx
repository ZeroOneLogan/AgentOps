import { NavLink } from "react-router-dom";

type Props = {
  children: React.ReactNode;
};

const navItems = [
  { label: "Dashboard", to: "/" },
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
            <p className="brand__tag">Milestone 2</p>
          </div>
        </div>
        <nav className="nav-links" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-meta">
          <span className="pill">API /api</span>
        </div>
      </header>

      <main className="content-area">{children}</main>
    </div>
  );
}
