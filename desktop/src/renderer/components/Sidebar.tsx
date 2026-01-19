import { NavLink } from 'react-router-dom'
import { Home, Wand2, Settings, AlertCircle } from 'lucide-react'

interface SidebarProps {
  keysValid: boolean | null
}

export default function Sidebar({ keysValid }: SidebarProps) {
  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/generate', icon: Wand2, label: 'Generate' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          Open Lovable
        </h1>
        <p className="text-xs text-gray-500 mt-1">Desktop Edition</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-purple-600/20 text-purple-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <Icon size={20} />
                <span>{label}</span>
                {to === '/settings' && keysValid === false && (
                  <AlertCircle className="ml-auto text-amber-500" size={16} />
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Status */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-2 text-sm">
          <div
            className={`w-2 h-2 rounded-full ${
              keysValid ? 'bg-green-500' : 'bg-amber-500'
            }`}
          />
          <span className="text-gray-400">
            {keysValid === null
              ? 'Checking...'
              : keysValid
              ? 'Ready'
              : 'Setup required'}
          </span>
        </div>
      </div>
    </aside>
  )
}
