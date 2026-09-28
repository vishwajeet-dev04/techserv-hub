import { NavLink, Outlet } from 'react-router-dom'

export default function SettingsLayout() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className="w-48 shrink-0 border-r border-line bg-surface/90 backdrop-blur-md px-3 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand px-3">Settings</p>
        <p className="text-xs text-muted mt-2 px-3">Admin only. More options will land here later.</p>
        <nav className="mt-4 space-y-1">
          <NavLink
            to="/settings/users"
            className={({ isActive }) =>
              `block rounded-xl px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink hover:bg-canvas'
              }`
            }
          >
            Users
          </NavLink>
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
