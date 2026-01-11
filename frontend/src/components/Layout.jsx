import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getNavigationForRole, getRoleDisplayName, getRoleColor } from '../utils/permissions'
import { 
  LayoutDashboard, 
  Building2, 
  Users,
  UserPlus, 
  Radio, 
  BarChart3, 
  Settings, 
  LogOut
} from 'lucide-react'

const ICON_MAP = {
  LayoutDashboard,
  Building2,
  Users,
  UserPlus,
  Radio,
  BarChart3,
  Settings,
}

export default function Layout() {
  const { user, logout } = useAuth()

  // Get navigation items based on user role
  const navigation = getNavigationForRole(user?.role).map(item => ({
    ...item,
    icon: ICON_MAP[item.icon] || LayoutDashboard,
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-pink-50/30">
      {/* Modern Sidebar */}
      <aside className="fixed inset-y-0 left-4 w-24 bg-gradient-to-b from-purple-600 via-purple-700 to-indigo-700 z-30 shadow-2xl rounded-2xl md:left-6 lg:left-8">
        <div className="flex flex-col h-full items-center py-6 relative">
          {/* Curved decorative elements */}
          <div className="pointer-events-none absolute right-[-32px] top-24 w-24 h-24 bg-white/10 rounded-full blur-md"></div>
          <div className="pointer-events-none absolute right-[-48px] bottom-32 w-32 h-32 bg-white/10 rounded-full blur-lg"></div>
          {/* Logo */}
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-8 shadow-lg">
            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
              <span className="text-purple-600 font-bold text-lg">A</span>
            </div>
          </div>

          {/* Navigation Icons */}
          <nav className="flex-1 flex flex-col items-center space-y-4 w-full px-3">
            {navigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `group relative w-16 h-16 flex items-center justify-center rounded-2xl transition-all duration-300 ${
                    isActive
                      ? 'bg-white shadow-xl shadow-purple-500/50'
                      : 'bg-white/10 hover:bg-white/20 backdrop-blur-sm'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active indicator bar */}
                    {isActive && (
                      <span className="absolute left-0 -ml-1 w-1 h-10 bg-white rounded-r-full shadow-md" />
                    )}
                    <item.icon 
                      size={26} 
                      className={`${isActive ? 'text-purple-600' : 'text-white'} transition-all duration-300`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {/* Tooltip */}
                    <div className="absolute left-20 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-xl">
                      {item.name}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User Profile */}
          <div className="mt-auto space-y-4 w-full px-3">
            {/* User Avatar */}
            <button className="group relative w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105">
              <span className="text-white font-bold text-lg">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
              <div className="absolute left-20 bg-gray-900 text-white px-4 py-3 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-xl min-w-[200px]">
                <p className="font-semibold">{user?.username || 'User'}</p>
                <p className="text-xs text-gray-400 mt-1">{user?.email || 'No email'}</p>
                <span className={`inline-block mt-2 px-2 py-1 rounded-md text-xs ${getRoleColor(user?.role)}`}>
                  {getRoleDisplayName(user?.role)}
                </span>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
              </div>
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="group relative w-14 h-14 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-red-500/20 backdrop-blur-sm transition-all duration-300"
            >
              <LogOut size={24} className="text-white group-hover:text-red-300" />
              <div className="absolute left-20 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-xl">
                Logout
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-4 md:ml-6 lg:ml-32">
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
