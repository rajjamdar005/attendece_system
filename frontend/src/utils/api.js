const API_URL = import.meta.env.VITE_API_URL

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Request failed')
  }
  return response.json()
}

export const api = {
  // Auth
  login: (username, password) =>
    fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(handleResponse),

  // Companies
  getCompanies: () =>
    fetch(`${API_URL}/companies`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  createCompany: (data) =>
    fetch(`${API_URL}/companies`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  createCompanyWithAdmin: (data) =>
    fetch(`${API_URL}/companies/with-admin`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateCompany: (id, data) =>
    fetch(`${API_URL}/companies/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  deleteCompany: (id) =>
    fetch(`${API_URL}/companies/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }).then(handleResponse),

  // Employees
  getEmployees: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetch(`${API_URL}/employees?${query}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse)
  },

  createEmployee: (data) =>
    fetch(`${API_URL}/employees`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateEmployee: (id, data) =>
    fetch(`${API_URL}/employees/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  deleteEmployee: (id) =>
    fetch(`${API_URL}/employees/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }).then(handleResponse),

  // Tags
  getTags: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetch(`${API_URL}/tags?${query}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse)
  },

  assignTag: (tag_uid, employee_id, note) =>
    fetch(`${API_URL}/tags/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tag_uid, employee_id, note }),
    }).then(handleResponse),

  // Devices
  getDevices: () =>
    fetch(`${API_URL}/devices`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  // Attendance
  getAttendance: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetch(`${API_URL}/attendance?${query}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse)
  },

  // Reports
  getDailyReport: (company_id, start_date, end_date) => {
    const params = new URLSearchParams()
    if (company_id) params.append('company_id', company_id)
    if (start_date) params.append('start_date', start_date)
    if (end_date) params.append('end_date', end_date)
    return fetch(`${API_URL}/reports/daily?${params.toString()}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse)
  },

  getDeviceHealth: () =>
    fetch(`${API_URL}/reports/device-health`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  exportAttendance: (company_id, from, to, format = 'csv') => {
    const params = new URLSearchParams({ from, to, format })
    if (company_id) params.append('company_id', company_id)
    return fetch(`${API_URL}/reports/export?${params.toString()}`, {
      headers: getAuthHeaders(),
    }).then(response => {
      if (!response.ok) {
        throw new Error('Export failed')
      }
      return response.blob()
    })
  },

  // Users
  getUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetch(`${API_URL}/users?${query}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse)
  },

  createUser: (data) =>
    fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateUser: (id, data) =>
    fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  deleteUser: (id) =>
    fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }).then(handleResponse),
}

export default api
