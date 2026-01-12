import { useState, useEffect } from 'react'
import { Activity, Users, Radio, TrendingUp, Clock, MapPin, Zap, Building2 } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import KpiCard from '../components/KpiCard'
import { useAuth } from '../context/AuthContext'
import { PERMISSIONS } from '../utils/permissions'
import api from '../utils/api'


export default function Dashboard() {
  const { user, hasPermission } = useAuth()
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [liveFeed, setLiveFeed] = useState([])
  const [stats, setStats] = useState({
    totalScans: 0,
    activeDevices: 0,
    totalEmployees: 0,
  })
  const [currentTime, setCurrentTime] = useState(new Date())
  
  const canViewAllCompanies = hasPermission(PERMISSIONS.VIEW_ALL_COMPANIES)

  useEffect(() => {
    // Fetch companies for super admin
    if (canViewAllCompanies) {
      fetchCompanies()
    }
  }, [canViewAllCompanies])

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)

    // Fetch initial data
    fetchStats()
    fetchRecentAttendance()

    // Connect to WebSocket for live feed
    const ws = new WebSocket(import.meta.env.VITE_WS_URL)
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'attendance_event' && message.data) {
          setLiveFeed((prev) => [message.data, ...prev].slice(0, 8))
        }
      } catch (err) {
        console.error('WS message parse error:', err)
      }
    }

    return () => {
      try { ws.close() } catch {}
      clearInterval(timer)
    }
  }, [selectedCompany])

  const fetchCompanies = async () => {
    try {
      const data = await api.getCompanies()
      setCompanies(data.data || [])
    } catch (err) {
      console.error('Failed to fetch companies:', err)
    }
  }

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const companyId = canViewAllCompanies ? selectedCompany : user?.company_id
      
      const [dailyReportRes, devicesRes, employeesRes] = await Promise.all([
        api.getDailyReport(companyId || '', today),
        api.getDevices(),
        api.getEmployees(companyId ? { company_id: companyId } : {})
      ])

      const totalScans = dailyReportRes?.data?.summary?.total_scans || 0
      const devices = devicesRes?.data?.devices || devicesRes?.data || []
      const activeDevices = devices.filter(d => {
        if (!d.last_seen) return false
        const minutes = (Date.now() - new Date(d.last_seen).getTime()) / 60000
        return minutes < 10
      }).length
      const totalEmployees = (employeesRes?.data || []).length

      setStats({ totalScans, activeDevices, totalEmployees })
    }
    catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchRecentAttendance = async () => {
    try {
      const companyId = canViewAllCompanies ? selectedCompany : user?.company_id
      const params = companyId ? { company_id: companyId, limit: 8 } : { limit: 8 }
      const res = await api.getAttendance(params)
      setLiveFeed(res?.data || [])
    } catch (error) {
      console.error('Failed to fetch attendance:', error)
    }
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric',
      timeZone: 'Asia/Kolkata'
    })
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Dashboard"
        subtitle={
          !canViewAllCompanies && user?.company_name 
            ? `${user.company_name} - Real-time attendance monitoring`
            : "Real-time attendance monitoring"
        }
        actions={
          <div className="flex items-center gap-4">
            {/* Company Filter for Super Admin */}
            {canViewAllCompanies && (
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100">
                <Building2 className="w-5 h-5 text-indigo-500" />
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="border-none bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="">All Companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Company Badge for Company Admin */}
            {!canViewAllCompanies && user?.company_name && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 rounded-2xl shadow-lg">
                <Building2 className="w-5 h-5 text-white" />
                <span className="font-semibold text-white">{user.company_name}</span>
              </div>
            )}
            <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100">
              <Clock className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-gray-700">{formatTime(currentTime)}</span>
            </div>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Total Scans Today" value={stats.totalScans} icon={Activity} tone="indigo" />
        <KpiCard title="Active Devices" value={stats.activeDevices} icon={Radio} tone="green" />
        <KpiCard title="Total Employees" value={stats.totalEmployees} icon={Users} tone="blue" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 rounded-3xl p-8 shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white text-xl font-semibold">Today's Activity</h2>
                <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
                  <Activity className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">Live</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5">
                  <p className="text-purple-100 text-sm mb-2">Total Scans</p>
                  <p className="text-white text-4xl font-bold">{stats.totalScans}</p>
                  <p className="text-purple-200 text-xs mt-2">+{Math.floor(stats.totalScans * 0.12)} today</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5">
                  <p className="text-purple-100 text-sm mb-2">Employees</p>
                  <p className="text-white text-4xl font-bold">{stats.totalEmployees}</p>
                  <p className="text-purple-200 text-xs mt-2">Active</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5">
                  <p className="text-purple-100 text-sm mb-2">Devices</p>
                  <p className="text-white text-4xl font-bold">{stats.activeDevices}</p>
                  <p className="text-green-300 text-xs mt-2 flex items-center">
                    <Zap className="w-3 h-3 mr-1" />
                    Online
                  </p>
                </div>
              </div>
            </div>
            
            {/* Decorative background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>
          </div>

          {/* Activity Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Activity Card */}
            <div className="bg-gradient-to-br from-pink-400 to-pink-600 rounded-3xl p-6 shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-white/20 backdrop-blur-sm p-3 rounded-2xl">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h3 className="text-white text-lg font-semibold mb-2">Recent Scans</h3>
                <p className="text-7xl font-bold text-white mb-2">
                  {Math.floor(stats.totalScans / 24)}
                </p>
                <p className="text-pink-100 text-sm">Last Hour</p>
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mb-16"></div>
            </div>

            {/* Attendance Rate Card */}
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 p-3 rounded-2xl">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-green-500 text-sm font-semibold bg-green-50 px-3 py-1 rounded-full">
                  +12%
                </span>
              </div>
              <h3 className="text-gray-700 text-lg font-semibold mb-2">Attendance Rate</h3>
              <p className="text-5xl font-bold text-gray-900 mb-2">95%</p>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full" style={{width: '95%'}}></div>
              </div>
              <p className="text-gray-500 text-sm">Excellent performance this week</p>
            </div>
          </div>
        </div>

        {/* Right Column - Live Feed */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800">Live Feed</h3>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-500">Live</span>
              </div>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
              {liveFeed.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Activity className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-400 text-sm">No recent activity</p>
                </div>
              ) : (
                liveFeed.map((log, index) => (
                  <div
                    key={log.id}
                    className="flex items-center space-x-3 p-3 rounded-2xl hover:bg-gray-50 transition-all duration-200 cursor-pointer group"
                    style={{
                      animation: index === 0 ? 'slideIn 0.3s ease-out' : 'none'
                    }}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                        {log.employees?.name?.charAt(0) || '?'}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate text-sm">
                        {log.employees?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {log.devices?.location || 'Unknown location'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-600">
                        {new Date(log.recorded_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata'
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c084fc;
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a855f7;
        }
      `}</style>
    </div>
  )
}
