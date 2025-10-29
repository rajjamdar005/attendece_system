import { useState, useEffect } from 'react'
import { Activity, Users, Radio, TrendingUp } from 'lucide-react'
import api from '../utils/api'

export default function Dashboard() {
  const [liveFeed, setLiveFeed] = useState([])
  const [stats, setStats] = useState({
    totalScans: 0,
    activeDevices: 0,
    totalEmployees: 0,
  })

  useEffect(() => {
    // Fetch initial data
    fetchStats()
    fetchRecentAttendance()

    // Connect to WebSocket for live feed
    const ws = new WebSocket(import.meta.env.VITE_WS_URL)

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'attendance_event') {
        setLiveFeed((prev) => [message.data, ...prev].slice(0, 20))
      }
    }

    return () => ws.close()
  }, [])

  const fetchStats = async () => {
    try {
      const [attendance, devices, employees] = await Promise.all([
        api.getAttendance({ limit: 1 }),
        api.getDeviceHealth(),
        api.getEmployees({ limit: 1 }),
      ])

      setStats({
        totalScans: attendance.pagination?.total || 0,
        activeDevices: devices.data?.filter(d => d.status === 'online').length || 0,
        totalEmployees: employees.pagination?.total || 0,
      })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchRecentAttendance = async () => {
    try {
      const response = await api.getAttendance({ limit: 20 })
      setLiveFeed(response.data)
    } catch (error) {
      console.error('Failed to fetch attendance:', error)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Real-time attendance monitoring</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Scans Today</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalScans}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Activity className="text-primary-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Devices</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeDevices}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Radio className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalEmployees}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Live Feed */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Live Attendance Feed</h2>
        <div className="space-y-3">
          {liveFeed.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          ) : (
            liveFeed.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-medium">
                      {log.employees?.full_name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {log.employees?.full_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {log.devices?.location || 'Unknown location'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(log.recorded_at).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-gray-600">{log.tag_uid}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
