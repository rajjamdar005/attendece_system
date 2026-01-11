import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, UserPlus, Mail, Lock, Building2, Search, Shield } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import { PERMISSIONS, ROLES, getRoleDisplayName } from '../utils/permissions'

export default function Users() {
  const { hasPermission } = useAuth()
  const [users, setUsers] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'company_admin',
    company_id: ''
  })
  const [errors, setErrors] = useState({})

  // Only super admin can access this page
  const canManageUsers = hasPermission(PERMISSIONS.MANAGE_COMPANIES)

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers()
      fetchCompanies()
    }
  }, [canManageUsers])

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers()
      setUsers(data.data || [])
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanies = async () => {
    try {
      const data = await api.getCompanies()
      setCompanies(data.data || [])
    } catch (err) {
      console.error('Failed to fetch companies:', err)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    // Username validation
    if (!formData.username?.trim()) {
      newErrors.username = 'Username is required'
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters'
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores'
    }

    // Email validation
    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Password validation (only for new users)
    if (!editingUser) {
      if (!formData.password) {
        newErrors.password = 'Password is required'
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters'
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(formData.password)) {
        newErrors.password = 'Password must contain uppercase, lowercase, number, and special character'
      }
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = 'Role is required'
    }

    // Company validation (for non-super admin roles)
    if (formData.role !== 'incubation_head' && !formData.company_id) {
      newErrors.company_id = 'Company is required for company admin and technician roles'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      
      // Prepare data
      const userData = {
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        company_id: formData.role === 'incubation_head' ? null : formData.company_id
      }

      // Add password for new users
      if (!editingUser) {
        userData.password = formData.password
      }

      if (editingUser) {
        await api.updateUser(editingUser.id, userData)
      } else {
        await api.createUser(userData)
      }

      await fetchUsers()
      closeModal()
    } catch (err) {
      // Handle specific validation errors from backend
      if (err.message.includes('username')) {
        setErrors({ username: 'This username is already taken' })
      } else if (err.message.includes('email')) {
        setErrors({ email: 'This email is already registered' })
      } else {
        setErrors({ submit: err.message })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      setLoading(true)
      await api.deleteUser(userId)
      await fetchUsers()
    } catch (err) {
      alert('Failed to delete user: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        username: user.username,
        email: user.email || '',
        password: '',
        role: user.role,
        company_id: user.company_id || ''
      })
    } else {
      setEditingUser(null)
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'company_admin',
        company_id: ''
      })
    }
    setErrors({})
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'company_admin',
      company_id: ''
    })
    setErrors({})
  }

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId)
    return company?.name || 'N/A'
  }

  if (!canManageUsers) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Access Denied</h3>
          <p className="text-gray-500">Only super administrators can manage user accounts.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="User Management"
        description="Manage company administrator and technician accounts"
        icon={UserPlus}
      />

      {/* Search and Actions */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search users..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Add User Button */}
          <button onClick={() => openModal()} className="btn-primary">
            <Plus className="w-5 h-5" />
            Add User
          </button>
        </div>
      </div>

      {/* Users List */}
      <div className="card">
        {loading && users.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Users Found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'No users match your search.' : 'Get started by creating your first user account.'}
            </p>
            {!searchTerm && (
              <button onClick={() => openModal()} className="btn-primary">
                <Plus className="w-5 h-5" />
                Add User
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.username}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {user.email || 'No email'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        user.role === 'incubation_head' ? 'badge-red' :
                        user.role === 'company_admin' ? 'badge-blue' :
                        'badge-gray'
                      }`}>
                        {getRoleDisplayName(user.role)}
                      </span>
                    </td>
                    <td>
                      {user.role === 'incubation_head' ? (
                        <span className="text-gray-500 italic">All Companies</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {getCompanyName(user.company_id)}
                        </div>
                      )}
                    </td>
                    <td className="text-gray-600">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal(user)}
                          className="btn-secondary btn-sm"
                          title="Edit user"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="btn-danger btn-sm"
                          title="Delete user"
                          disabled={user.role === 'incubation_head'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingUser ? 'Edit User' : 'Add New User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="label">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.username ? 'border-red-500' : ''}`}
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Enter unique username"
              disabled={editingUser} // Username cannot be changed
            />
            {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
            <p className="text-gray-500 text-xs mt-1">
              Must be unique across all companies. Letters, numbers, and underscores only.
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="label">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className={`input ${errors.email ? 'border-red-500' : ''}`}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@company.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            <p className="text-gray-500 text-xs mt-1">
              Must be unique across all companies.
            </p>
          </div>

          {/* Password (only for new users) */}
          {!editingUser && (
            <div>
              <label className="label">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                className={`input ${errors.password ? 'border-red-500' : ''}`}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter secure password"
              />
              {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              <p className="text-gray-500 text-xs mt-1">
                Min 8 chars with uppercase, lowercase, number, and special character.
              </p>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="label">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              className={`input ${errors.role ? 'border-red-500' : ''}`}
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value, company_id: e.target.value === 'incubation_head' ? '' : formData.company_id })}
            >
              <option value="company_admin">Company Administrator</option>
              <option value="technician">Technician</option>
              <option value="incubation_head">Super Administrator</option>
            </select>
            {errors.role && <p className="text-red-500 text-sm mt-1">{errors.role}</p>}
          </div>

          {/* Company (only for non-super admin) */}
          {formData.role !== 'incubation_head' && (
            <div>
              <label className="label">
                Company <span className="text-red-500">*</span>
              </label>
              <select
                className={`input ${errors.company_id ? 'border-red-500' : ''}`}
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              >
                <option value="">Select Company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              {errors.company_id && <p className="text-red-500 text-sm mt-1">{errors.company_id}</p>}
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
            </button>
            <button type="button" onClick={closeModal} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
