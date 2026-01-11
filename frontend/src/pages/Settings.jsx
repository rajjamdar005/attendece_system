import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, Lock, Bell, Shield, Database, Save } from 'lucide-react'
import { SpinnerOverlay } from '../components/Loaders'

export default function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    role: user?.role || ''
  })
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [notifications, setNotifications] = useState({
    email_alerts: true,
    device_offline: true,
    daily_summary: false,
    webhook_url: ''
  })

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      // API call to update profile
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      alert('Profile updated successfully!')
    } catch (error) {
      alert('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwordData.new_password !== passwordData.confirm_password) {
      alert('New passwords do not match')
      return
    }
    if (passwordData.new_password.length < 8) {
      alert('Password must be at least 8 characters')
      return
    }
    try {
      setSaving(true)
      // API call to change password
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert('Password changed successfully!')
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
    } catch (error) {
      alert('Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotifications = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      // API call to update notification settings
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert('Notification settings updated!')
    } catch (error) {
      alert('Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'security', name: 'Security', icon: Lock },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'system', name: 'System', icon: Database }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and system preferences</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar Navigation */}
        <div className="col-span-12 lg:col-span-3">
          <div className="card">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.name}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="col-span-12 lg:col-span-9">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Profile Information</h2>
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="flex items-center space-x-6">
                  <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User className="w-10 h-10 text-indigo-600" />
                  </div>
                  <div>
                    <button type="button" className="btn btn-secondary text-sm">
                      Change Avatar
                    </button>
                    <p className="text-xs text-gray-500 mt-2">JPG, PNG. Max 2MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">Username</label>
                    <input
                      type="text"
                      value={profileData.username}
                      onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                      className="input w-full"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="label">Role</label>
                    <input
                      type="text"
                      value={profileData.role}
                      className="input w-full bg-gray-50"
                      disabled
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary flex items-center space-x-2">
                    <Save className="w-5 h-5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Security Settings</h2>
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div>
                  <label className="label">Current Password</label>
                  <input
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    className="input w-full"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
                </div>

                <div>
                  <label className="label">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary flex items-center space-x-2">
                    <Shield className="w-5 h-5" />
                    <span>Change Password</span>
                  </button>
                </div>
              </form>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Two-Factor Authentication</h3>
                <p className="text-gray-600 mb-4">Add an extra layer of security to your account</p>
                <button className="btn btn-secondary">Enable 2FA</button>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Notification Preferences</h2>
              <form onSubmit={handleSaveNotifications} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Email Alerts</p>
                      <p className="text-sm text-gray-500">Receive email notifications for important events</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.email_alerts}
                        onChange={(e) => setNotifications({ ...notifications, email_alerts: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Device Offline Alerts</p>
                      <p className="text-sm text-gray-500">Get notified when devices go offline</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.device_offline}
                        onChange={(e) => setNotifications({ ...notifications, device_offline: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Daily Summary</p>
                      <p className="text-sm text-gray-500">Receive daily attendance summary reports</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.daily_summary}
                        onChange={(e) => setNotifications({ ...notifications, daily_summary: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="label">Webhook URL (Optional)</label>
                  <input
                    type="url"
                    value={notifications.webhook_url}
                    onChange={(e) => setNotifications({ ...notifications, webhook_url: e.target.value })}
                    className="input w-full"
                    placeholder="https://your-webhook.com/endpoint"
                  />
                  <p className="text-xs text-gray-500 mt-1">Receive real-time events via webhook</p>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary flex items-center space-x-2">
                    <Save className="w-5 h-5" />
                    <span>Save Preferences</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">System Information</h2>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600 mb-1">Version</p>
                    <p className="font-semibold text-gray-900">1.0.0</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600 mb-1">Database</p>
                    <p className="font-semibold text-gray-900">PostgreSQL 15</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600 mb-1">Environment</p>
                    <p className="font-semibold text-gray-900">Production</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600 mb-1">API Status</p>
                    <p className="font-semibold text-green-600">Online</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Maintenance</h3>
                  <div className="space-y-3">
                    <button className="btn btn-secondary w-full">Clear Cache</button>
                    <button className="btn btn-secondary w-full">Export System Logs</button>
                    <button className="btn btn-secondary w-full text-red-600 hover:bg-red-50">
                      Reset System Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {saving && <SpinnerOverlay message="Saving..." />}
    </div>
  )
}
