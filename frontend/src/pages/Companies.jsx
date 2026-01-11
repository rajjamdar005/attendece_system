import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Building2, Users, MapPin, Search, UserPlus, Lock, Mail } from 'lucide-react'
import { PageLoader, SpinnerOverlay } from '../components/Loaders'
import Modal from '../components/Modal'
import api from '../utils/api'

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    // Admin account fields (only for new company)
    admin_username: '',
    admin_email: '',
    admin_password: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      setLoading(true)
      const response = await api.getCompanies()
      setCompanies(response.data || [])
    } catch (error) {
      console.error('Error fetching companies:', error)
      alert('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (company = null) => {
    if (company) {
      setEditingCompany(company)
      setFormData({
        name: company.name,
        address: company.address || '',
        contact_person: company.contact_person || '',
        contact_email: company.contact_email || '',
        contact_phone: company.contact_phone || '',
        admin_username: '',
        admin_email: '',
        admin_password: ''
      })
    } else {
      setEditingCompany(null)
      setFormData({
        name: '',
        address: '',
        contact_person: '',
        contact_email: '',
        contact_phone: '',
        admin_username: '',
        admin_email: '',
        admin_password: ''
      })
    }
    setErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingCompany(null)
    setFormData({
      name: '',
      address: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      admin_username: '',
      admin_email: '',
      admin_password: ''
    })
    setErrors({})
  }

  const validateForm = () => {
    const newErrors = {}
    
    // Company fields
    if (!formData.name.trim()) newErrors.name = 'Company name is required'
    if (formData.contact_email && !/\S+@\S+\.\S+/.test(formData.contact_email)) {
      newErrors.contact_email = 'Invalid email format'
    }
    
    // Admin account fields (only for new company)
    if (!editingCompany) {
      if (!formData.admin_username?.trim()) {
        newErrors.admin_username = 'Admin username is required'
      } else if (formData.admin_username.length < 3) {
        newErrors.admin_username = 'Username must be at least 3 characters'
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.admin_username)) {
        newErrors.admin_username = 'Username can only contain letters, numbers, and underscores'
      }
      
      if (!formData.admin_email?.trim()) {
        newErrors.admin_email = 'Admin email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
        newErrors.admin_email = 'Please enter a valid email address'
      }
      
      if (!formData.admin_password) {
        newErrors.admin_password = 'Admin password is required'
      } else if (formData.admin_password.length < 8) {
        newErrors.admin_password = 'Password must be at least 8 characters'
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(formData.admin_password)) {
        newErrors.admin_password = 'Password must contain uppercase, lowercase, number, and special character'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setProcessing(true)
      if (editingCompany) {
        // Update existing company
        await api.updateCompany(editingCompany.id, {
          name: formData.name,
          address: formData.address,
          contact_person: formData.contact_person,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone
        })
      } else {
        // Create new company with admin account
        await api.createCompanyWithAdmin({
          company: {
            name: formData.name,
            address: formData.address,
            contact_person: formData.contact_person,
            contact_email: formData.contact_email,
            contact_phone: formData.contact_phone
          },
          admin: {
            username: formData.admin_username.trim(),
            email: formData.admin_email.trim().toLowerCase(),
            password: formData.admin_password
          }
        })
      }
      await fetchCompanies()
      closeModal()
    } catch (error) {
      console.error('Error saving company:', error)
      const errorMsg = error.message || 'Failed to save company'
      
      // Handle specific validation errors
      if (errorMsg.includes('username')) {
        setErrors({ admin_username: 'This username is already taken' })
      } else if (errorMsg.includes('email')) {
        setErrors({ admin_email: 'This email is already registered' })
      } else {
        alert(errorMsg)
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all associated employees and data.`)) {
      return
    }

    try {
      setProcessing(true)
      await api.deleteCompany(id)
      await fetchCompanies()
    } catch (error) {
      console.error('Error deleting company:', error)
      alert(error.response?.data?.error || 'Failed to delete company')
    } finally {
      setProcessing(false)
    }
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <PageLoader message="Loading companies..." />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-600 mt-1">Manage tenant organizations in your incubation center</p>
        </div>
        <button
          onClick={() => openModal()}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add Company</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search companies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pl-10 w-full md:w-96"
        />
      </div>

      {/* Companies Grid */}
      {filteredCompanies.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No companies found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'Try adjusting your search' : 'Get started by adding your first company'}
          </p>
          {!searchTerm && (
            <button onClick={() => openModal()} className="btn btn-primary">
              Add Company
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="card hover:shadow-lg transition-shadow duration-200 border border-gray-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{company.name}</h3>
                    <p className="text-sm text-gray-500">{company.employee_count || 0} employees</p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => openModal(company)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(company.id, company.name)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {company.address && (
                  <div className="flex items-start space-x-2 text-gray-600">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{company.address}</span>
                  </div>
                )}
                {company.contact_person && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span>{company.contact_person}</span>
                  </div>
                )}
                {company.contact_email && (
                  <div className="text-gray-600">
                    <a href={`mailto:${company.contact_email}`} className="hover:text-indigo-600">
                      {company.contact_email}
                    </a>
                  </div>
                )}
                {company.contact_phone && (
                  <div className="text-gray-600">
                    {company.contact_phone}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCompany ? 'Edit Company' : 'Add New Company'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Company Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`input w-full ${errors.name ? 'border-red-500' : ''}`}
              placeholder="Acme Corporation"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="label">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input w-full"
              rows="2"
              placeholder="123 Business Street, City, State"
            />
          </div>

          <div>
            <label className="label">Contact Person</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              className="input w-full"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="label">Contact Email</label>
            <input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              className={`input w-full ${errors.contact_email ? 'border-red-500' : ''}`}
              placeholder="john@acme.com"
            />
            {errors.contact_email && <p className="text-red-500 text-sm mt-1">{errors.contact_email}</p>}
          </div>

          <div>
            <label className="label">Contact Phone</label>
            <input
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              className="input w-full"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          {/* Admin Account Section - Only for New Company */}
          {!editingCompany && (
            <>
              <div className="border-t border-gray-200 pt-4 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Company Administrator Account</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Create login credentials for the company administrator. They will use these to manage their company.
                </p>
              </div>

              <div>
                <label className="label">
                  Admin Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.admin_username}
                  onChange={(e) => setFormData({ ...formData, admin_username: e.target.value })}
                  className={`input w-full ${errors.admin_username ? 'border-red-500' : ''}`}
                  placeholder="companyadmin"
                />
                {errors.admin_username && <p className="text-red-500 text-sm mt-1">{errors.admin_username}</p>}
                <p className="text-gray-500 text-xs mt-1">
                  Must be unique. Letters, numbers, and underscores only.
                </p>
              </div>

              <div>
                <label className="label">
                  Admin Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={formData.admin_email}
                    onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                    className={`input w-full pl-10 ${errors.admin_email ? 'border-red-500' : ''}`}
                    placeholder="admin@company.com"
                  />
                </div>
                {errors.admin_email && <p className="text-red-500 text-sm mt-1">{errors.admin_email}</p>}
                <p className="text-gray-500 text-xs mt-1">
                  Must be unique across all companies.
                </p>
              </div>

              <div>
                <label className="label">
                  Admin Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    value={formData.admin_password}
                    onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                    className={`input w-full pl-10 ${errors.admin_password ? 'border-red-500' : ''}`}
                    placeholder="Enter secure password"
                  />
                </div>
                {errors.admin_password && <p className="text-red-500 text-sm mt-1">{errors.admin_password}</p>}
                <p className="text-gray-500 text-xs mt-1">
                  Min 8 chars with uppercase, lowercase, number, and special character.
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="btn btn-secondary"
              disabled={processing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={processing}
            >
              {processing ? 'Saving...' : editingCompany ? 'Update Company' : 'Create Company'}
            </button>
          </div>
        </form>
      </Modal>

      {processing && <SpinnerOverlay message="Processing..." />}
    </div>
  )
}

