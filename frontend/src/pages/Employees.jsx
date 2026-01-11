import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, User, Mail, Phone, Building2, Search, Upload, CreditCard } from 'lucide-react'
import { PageLoader, SpinnerOverlay } from '../components/Loaders'
import SectionHeader from '../components/SectionHeader'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { PERMISSIONS } from '../utils/permissions'
import api from '../utils/api'

export default function Employees() {
  const { user, hasPermission } = useAuth()
  const [employees, setEmployees] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [assigningTagEmployee, setAssigningTagEmployee] = useState(null)
  const [tagUid, setTagUid] = useState('')
  const [formData, setFormData] = useState({
    employee_id: '',
    name: '',
    email: '',
    phone: '',
    designation: '',
    company_id: '',
    is_active: true
  })
  const [errors, setErrors] = useState({})
  
  const canViewAllCompanies = hasPermission(PERMISSIONS.VIEW_ALL_COMPANIES)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Company admins should only see their own company's data
      const employeeParams = canViewAllCompanies ? {} : { company_id: user?.company_id }
      
      const promises = [
        api.getEmployees(employeeParams)
      ]
      
      // Only fetch companies list for incubation_head
      if (canViewAllCompanies) {
        promises.push(api.getCompanies())
      }
      
      const results = await Promise.all(promises)
      setEmployees(results[0].data)
      
      if (canViewAllCompanies && results[1]) {
        setCompanies(results[1].data)
      } else {
        // For company admins, only show their own company
        setCompanies(user?.company_id ? [{ id: user.company_id, name: 'Your Company' }] : [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (employee = null) => {
    if (employee) {
      setEditingEmployee(employee)
      setFormData({
        employee_id: employee.employee_id,
        name: employee.name,
        email: employee.email || '',
        phone: employee.phone || '',
        designation: employee.designation || '',
        company_id: employee.company_id,
        is_active: employee.is_active
      })
    } else {
      setEditingEmployee(null)
      setFormData({
        employee_id: '',
        name: '',
        email: '',
        phone: '',
        designation: '',
        company_id: canViewAllCompanies ? '' : user?.company_id || '',
        is_active: true
      })
    }
    setErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingEmployee(null)
    setErrors({})
  }

  const openTagModal = (employee) => {
    setAssigningTagEmployee(employee)
    setTagUid('')
    setIsTagModalOpen(true)
  }

  const closeTagModal = () => {
    setIsTagModalOpen(false)
    setAssigningTagEmployee(null)
    setTagUid('')
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.employee_id.trim()) newErrors.employee_id = 'Employee ID is required'
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.company_id) newErrors.company_id = 'Company is required'
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setProcessing(true)
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, formData)
      } else {
        await api.createEmployee(formData)
      }
      await fetchData()
      closeModal()
    } catch (error) {
      console.error('Error saving employee:', error)
      alert(error.response?.data?.error || 'Failed to save employee')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      setProcessing(true)
      await api.deleteEmployee(id)
      await fetchData()
    } catch (error) {
      console.error('Error deleting employee:', error)
      alert(error.response?.data?.error || 'Failed to delete employee')
    } finally {
      setProcessing(false)
    }
  }

  const handleAssignTag = async (e) => {
    e.preventDefault()
    if (!tagUid.trim()) {
      alert('Please enter a tag UID')
      return
    }

    try {
      setProcessing(true)
      await api.assignTag(tagUid, assigningTagEmployee.id)
      await fetchData()
      closeTagModal()
    } catch (error) {
      console.error('Error assigning tag:', error)
      alert(error.response?.data?.error || 'Failed to assign tag')
    } finally {
      setProcessing(false)
    }
  }

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCompany = !filterCompany || emp.company_id === filterCompany
    return matchesSearch && matchesCompany
  })

  if (loading) return <PageLoader message="Loading employees..." />

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Employees"
        subtitle="Manage employee records and RFID tags"
        actions={(
          <>
            <button className="btn btn-secondary flex items-center space-x-2">
              <Upload className="w-5 h-5" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={() => openModal()}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add Employee</span>
            </button>
          </>
        )}
      />

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        {/* Only show company filter for incubation_head */}
        {canViewAllCompanies && (
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="input md:w-64"
          >
            <option value="">All Companies</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Employees Table */}
      {filteredEmployees.length === 0 ? (
        <div className="card text-center py-12">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No employees found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filterCompany ? 'Try adjusting your filters' : 'Get started by adding your first employee'}
          </p>
          {!searchTerm && !filterCompany && (
            <button onClick={() => openModal()} className="btn btn-primary">
              Add Employee
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RFID Tag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                          <div className="text-sm text-gray-500">{employee.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                        {employee.company_name}
                      </div>
                      {employee.designation && (
                        <div className="text-xs text-gray-500">{employee.designation}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {employee.email && (
                        <div className="flex items-center">
                          <Mail className="w-4 h-4 mr-2" />
                          {employee.email}
                        </div>
                      )}
                      {employee.phone && (
                        <div className="flex items-center mt-1">
                          <Phone className="w-4 h-4 mr-2" />
                          {employee.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employee.rfid_tag ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CreditCard className="w-3 h-3 mr-1" />
                          Assigned
                        </span>
                      ) : (
                        <button
                          onClick={() => openTagModal(employee)}
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Assign Tag
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        employee.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openModal(employee)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee.id, employee.name)}
                          className="text-red-600 hover:text-red-900"
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
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Employee ID *</label>
              <input
                type="text"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className={`input w-full ${errors.employee_id ? 'border-red-500' : ''}`}
                placeholder="EMP001"
              />
              {errors.employee_id && <p className="text-red-500 text-sm mt-1">{errors.employee_id}</p>}
            </div>

            <div>
              <label className="label">Company *</label>
              {canViewAllCompanies ? (
                <select
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className={`input w-full ${errors.company_id ? 'border-red-500' : ''}`}
                >
                  <option value="">Select Company</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={companies.find(c => c.id === formData.company_id)?.name || 'Your Company'}
                  disabled
                  className="input w-full bg-gray-100 cursor-not-allowed"
                />
              )}
              {errors.company_id && <p className="text-red-500 text-sm mt-1">{errors.company_id}</p>}
            </div>
          </div>

          <div>
            <label className="label">Full Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`input w-full ${errors.name ? 'border-red-500' : ''}`}
              placeholder="John Doe"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="label">Designation</label>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              className="input w-full"
              placeholder="Software Engineer"
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`input w-full ${errors.email ? 'border-red-500' : ''}`}
              placeholder="john@company.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="label">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input w-full"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              Active Employee
            </label>
          </div>

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
              {processing ? 'Saving...' : editingEmployee ? 'Update Employee' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Tag Assignment Modal */}
      <Modal
        isOpen={isTagModalOpen}
        onClose={closeTagModal}
        title={`Assign RFID Tag to ${assigningTagEmployee?.name}`}
        size="small"
      >
        <form onSubmit={handleAssignTag} className="space-y-4">
          <div>
            <label className="label">Tag UID</label>
            <input
              type="text"
              value={tagUid}
              onChange={(e) => setTagUid(e.target.value)}
              className="input w-full font-mono"
              placeholder="Enter tag UID (e.g., A1B2C3D4)"
              autoFocus
            />
            <p className="text-sm text-gray-500 mt-2">
              Scan the RFID card or enter the UID manually
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={closeTagModal}
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
              {processing ? 'Assigning...' : 'Assign Tag'}
            </button>
          </div>
        </form>
      </Modal>

      {processing && <SpinnerOverlay message="Processing..." />}
    </div>
  )
}
