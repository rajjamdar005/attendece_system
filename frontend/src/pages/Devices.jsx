import { useState, useEffect } from 'react'
import { Radio, MapPin, Wifi, WifiOff, AlertCircle, Activity, Clock, Search } from 'lucide-react'
import { PageLoader, SpinnerOverlay } from '../components/Loaders'
import SectionHeader from '../components/SectionHeader'
import KpiCard from '../components/KpiCard'
import { formatDistanceToNow } from 'date-fns'
import api from '../utils/api'

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    fetchData()
    // Refresh device status every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      if (devices.length === 0) setLoading(true)
      const [devicesRes, companiesRes] = await Promise.all([
        api.getDevices(),
        api.getCompanies()
      ])
      setDevices(devicesRes.data?.devices || devicesRes.data || [])
      setCompanies(companiesRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      if (devices.length === 0) alert('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  const handleResetDevice = async (deviceId, deviceName) => {
    if (!confirm(`Reset device "${deviceName}"? This will clear its local cache.`)) return

    try {
      setProcessing(true)
      // In a real implementation, this would send a reset command via MQTT or HTTP
      alert('Reset command sent (feature to be implemented on ESP32)')
    } catch (error) {
      console.error('Error resetting device:', error)
      alert('Failed to reset device')
    } finally {
      setProcessing(false)
    }
  }

  const getDeviceStatus = (lastSeen) => {
    if (!lastSeen) return { status: 'offline', color: 'gray', label: 'Never Connected' }
    
    const minutes = (Date.now() - new Date(lastSeen).getTime()) / 60000
    if (minutes < 10) return { status: 'online', color: 'green', label: 'Online' }
    if (minutes < 60) return { status: 'warning', color: 'yellow', label: 'Warning' }
    return { status: 'offline', color: 'red', label: 'Offline' }
  }

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.device_uuid.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          device.location?.toLowerCase().includes(searchTerm.toLowerCase())
    const deviceStatus = getDeviceStatus(device.last_seen).status
    const matchesStatus = !filterStatus || deviceStatus === filterStatus
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: devices.length,
    online: devices.filter(d => getDeviceStatus(d.last_seen).status === 'online').length,
    warning: devices.filter(d => getDeviceStatus(d.last_seen).status === 'warning').length,
    offline: devices.filter(d => getDeviceStatus(d.last_seen).status === 'offline').length
  }

  if (loading) return <PageLoader message="Loading devices..." />

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Devices"
        subtitle="Monitor and manage RFID reader devices"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard title="Total Devices" value={stats.total} icon={Radio} tone="indigo" />
        <KpiCard title="Online" value={stats.online} icon={Wifi} tone="green" />
        <KpiCard title="Warning" value={stats.warning} icon={AlertCircle} tone="yellow" />
        <KpiCard title="Offline" value={stats.offline} icon={WifiOff} tone="red" />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search devices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input md:w-48"
        >
          <option value="">All Status</option>
          <option value="online">Online</option>
          <option value="warning">Warning</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {/* Devices Grid */}
      {filteredDevices.length === 0 ? (
        <div className="card text-center py-12">
          <Radio className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No devices found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filterStatus ? 'Try adjusting your filters' : 'Devices will appear here once they register'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDevices.map((device) => {
            const status = getDeviceStatus(device.last_seen)
            return (
              <div
                key={device.id}
                className="card hover:shadow-lg transition-all duration-200 border-2"
                style={{
                  borderColor: status.color === 'green' ? '#10b981' :
                               status.color === 'yellow' ? '#f59e0b' :
                               status.color === 'red' ? '#ef4444' : '#e5e7eb'
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      status.color === 'green' ? 'bg-green-100' :
                      status.color === 'yellow' ? 'bg-yellow-100' :
                      status.color === 'red' ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      <Radio className={`w-6 h-6 ${
                        status.color === 'green' ? 'text-green-600' :
                        status.color === 'yellow' ? 'text-yellow-600' :
                        status.color === 'red' ? 'text-red-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {device.device_uuid.substring(0, 8)}...
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        status.color === 'green' ? 'bg-green-100 text-green-800' :
                        status.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                        status.color === 'red' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${
                      status.color === 'green' ? 'bg-green-500' :
                      status.color === 'yellow' ? 'bg-yellow-500' :
                      status.color === 'red' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  {device.location && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span>{device.location}</span>
                    </div>
                  )}
                  
                  {device.company_name && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Activity className="w-4 h-4 flex-shrink-0" />
                      <span>{device.company_name}</span>
                    </div>
                  )}

                  {device.last_seen && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>
                        {formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })}
                      </span>
                    </div>
                  )}

                  {device.firmware_version && (
                    <div className="text-xs text-gray-500">
                      Firmware: v{device.firmware_version}
                    </div>
                  )}

                  {device.buffer_count > 0 && (
                    <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 px-2 py-1 rounded">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {device.buffer_count} events buffered
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleResetDevice(device.id, device.device_uuid)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Reset Device
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <Activity className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Device Status Guide</p>
            <ul className="space-y-1 text-blue-700">
              <li>• <strong>Online:</strong> Last seen within 10 minutes</li>
              <li>• <strong>Warning:</strong> Last seen 10-60 minutes ago</li>
              <li>• <strong>Offline:</strong> No connection for over 1 hour</li>
            </ul>
          </div>
        </div>
      </div>

      {processing && <SpinnerOverlay message="Processing..." />}
    </div>
  )
}
