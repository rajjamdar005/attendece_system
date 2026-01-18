import { useState, useEffect } from 'react'
import { Radio, MapPin, Wifi, WifiOff, AlertCircle, Activity, Clock, Search, Upload, Download, Trash2, Check, Package } from 'lucide-react'
import { PageLoader, SpinnerOverlay } from '../components/Loaders'
import SectionHeader from '../components/SectionHeader'
import KpiCard from '../components/KpiCard'
import { formatDistanceToNow } from 'date-fns'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

export default function Devices() {
  const { user } = useAuth()
  const [devices, setDevices] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // Firmware management state
  const [firmwareList, setFirmwareList] = useState([])
  const [showFirmwarePanel, setShowFirmwarePanel] = useState(false)
  const [uploadingFirmware, setUploadingFirmware] = useState(false)
  const [firmwareForm, setFirmwareForm] = useState({
    version: '',
    release_notes: '',
    set_active: false
  })

  const isTechnician = user?.role === 'technician' || user?.role === 'incubation_head'

  useEffect(() => {
    fetchData()
    // Refresh device status every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isTechnician) {
      fetchFirmwareList()
    }
  }, [isTechnician])

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

  const fetchFirmwareList = async () => {
    try {
      const res = await api.getFirmwareList()
      setFirmwareList(res.data || [])
    } catch (error) {
      console.error('Error fetching firmware list:', error)
    }
  }

  const handleFirmwareUpload = async (e) => {
    e.preventDefault()
    const fileInput = document.getElementById('firmware-file')
    const file = fileInput?.files?.[0]
    
    if (!file) {
      alert('Please select a firmware file')
      return
    }

    if (!firmwareForm.version) {
      alert('Please enter a version number')
      return
    }

    try {
      setUploadingFirmware(true)
      const formData = new FormData()
      formData.append('firmware', file)
      formData.append('version', firmwareForm.version)
      formData.append('release_notes', firmwareForm.release_notes)
      formData.append('set_active', firmwareForm.set_active)

      await api.uploadFirmware(formData)
      alert('Firmware uploaded successfully!')
      setFirmwareForm({ version: '', release_notes: '', set_active: false })
      fileInput.value = ''
      fetchFirmwareList()
    } catch (error) {
      console.error('Error uploading firmware:', error)
      alert(error.message || 'Failed to upload firmware')
    } finally {
      setUploadingFirmware(false)
    }
  }

  const handleActivateFirmware = async (id, version) => {
    if (!confirm(`Activate firmware v${version}? All devices will update to this version.`)) return
    
    try {
      setProcessing(true)
      await api.activateFirmware(id)
      alert(`Firmware v${version} is now active. Devices will update on next check.`)
      fetchFirmwareList()
    } catch (error) {
      console.error('Error activating firmware:', error)
      alert(error.message || 'Failed to activate firmware')
    } finally {
      setProcessing(false)
    }
  }

  const handleDeleteFirmware = async (id, version) => {
    if (!confirm(`Delete firmware v${version}? This cannot be undone.`)) return
    
    try {
      setProcessing(true)
      await api.deleteFirmware(id)
      fetchFirmwareList()
    } catch (error) {
      console.error('Error deleting firmware:', error)
      alert(error.message || 'Failed to delete firmware')
    } finally {
      setProcessing(false)
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

      {/* Firmware Management Panel (Technician Only) */}
      {isTechnician && (
        <div className="card">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowFirmwarePanel(!showFirmwarePanel)}
          >
            <div className="flex items-center space-x-3">
              <Package className="w-6 h-6 text-indigo-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Firmware Management</h3>
                <p className="text-sm text-gray-500">
                  {firmwareList.find(f => f.is_active)?.version 
                    ? `Active: v${firmwareList.find(f => f.is_active).version}` 
                    : 'No active firmware'}
                </p>
              </div>
            </div>
            <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              {showFirmwarePanel ? 'Hide' : 'Manage'}
            </button>
          </div>

          {showFirmwarePanel && (
            <div className="mt-6 space-y-6">
              {/* Upload Form */}
              <form onSubmit={handleFirmwareUpload} className="bg-gray-50 rounded-lg p-4 space-y-4">
                <h4 className="font-medium text-gray-900">Upload New Firmware</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Version *
                    </label>
                    <input
                      type="text"
                      value={firmwareForm.version}
                      onChange={(e) => setFirmwareForm({ ...firmwareForm, version: e.target.value })}
                      placeholder="e.g., 2.1.0"
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Firmware File (.bin) *
                    </label>
                    <input
                      id="firmware-file"
                      type="file"
                      accept=".bin"
                      className="input w-full file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Release Notes
                  </label>
                  <textarea
                    value={firmwareForm.release_notes}
                    onChange={(e) => setFirmwareForm({ ...firmwareForm, release_notes: e.target.value })}
                    placeholder="What's new in this version?"
                    className="input w-full"
                    rows={2}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={firmwareForm.set_active}
                      onChange={(e) => setFirmwareForm({ ...firmwareForm, set_active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Set as active (rollout to devices)</span>
                  </label>
                  <button
                    type="submit"
                    disabled={uploadingFirmware}
                    className="btn btn-primary flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploadingFirmware ? 'Uploading...' : 'Upload Firmware'}</span>
                  </button>
                </div>
              </form>

              {/* Firmware List */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Available Firmware Versions</h4>
                {firmwareList.length === 0 ? (
                  <p className="text-gray-500 text-sm">No firmware uploaded yet</p>
                ) : (
                  <div className="space-y-2">
                    {firmwareList.map((fw) => (
                      <div 
                        key={fw.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          fw.is_active ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {fw.is_active && (
                            <span className="flex items-center justify-center w-6 h-6 bg-green-500 rounded-full">
                              <Check className="w-4 h-4 text-white" />
                            </span>
                          )}
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">v{fw.version}</span>
                              {fw.is_active && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {(fw.file_size / 1024).toFixed(1)} KB • 
                              Uploaded {formatDistanceToNow(new Date(fw.created_at), { addSuffix: true })}
                              {fw.users?.username && ` by ${fw.users.username}`}
                            </div>
                            {fw.release_notes && (
                              <p className="text-sm text-gray-600 mt-1">{fw.release_notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!fw.is_active && (
                            <>
                              <button
                                onClick={() => handleActivateFirmware(fw.id, fw.version)}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                Activate
                              </button>
                              <button
                                onClick={() => handleDeleteFirmware(fw.id, fw.version)}
                                className="text-sm text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
