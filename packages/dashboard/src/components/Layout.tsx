import { NavLink, Outlet } from 'react-router-dom';
import { useSSE } from '../hooks/useSSE';

const navItems = [
  { to: '/', label: 'Overview', icon: '~' },
  { to: '/sessions', label: 'Sessions', icon: '>' },
  { to: '/detections', label: 'Detections', icon: '!' },
  { to: '/settings', label: 'Settings', icon: '*' },
];

export function Layout() {
  const { connected } = useSSE();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            <span style={{ color: 'var(--accent-amber)' }}>Claw</span>Watch
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
            agent efficiency monitor
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'text-amber-400'
                    : 'hover:text-white'
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                color: isActive ? 'var(--accent-amber)' : 'var(--text-secondary)',
              })}
            >
              <span className="font-mono text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Status */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: connected ? 'var(--accent-green)' : 'var(--accent-red)',
                boxShadow: connected ? 'var(--glow-green)' : 'var(--glow-red)',
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              {connected ? 'connected' : 'disconnected'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6" style={{ backgroundColor: 'var(--bg-base)' }}>
        <Outlet />
      </main>
    </div>
  );
}
