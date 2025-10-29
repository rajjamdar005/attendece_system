import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Radio, 
  BarChart3, 
  Settings, 
  LogOut 
} from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuth()

  const navigation = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Companies', to: '/companies', icon: Building2, adminOnly: true },
    { name: 'Employees', to: '/employees', icon: Users },
    { name: 'Devices', to: '/devices', icon: Radio },
    { name: 'Reports', to: '/reports', icon: BarChart3 },
    { name: 'Settings', to: '/settings', icon: Settings },
  ]

  const filteredNav = navigation.filter(
    item => !item.adminOnly || user.role === 'incubation_head'
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">RFID Attendance</h1>
            <p className="text-sm text-gray-600 mt-1">{user.full_name}</p>
            <span className="inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800">
              {user.role.replace('_', ' ')}
            </span>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {filteredNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon size={20} />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={logout}
              className="flex items-center space-x-3 w-full px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
