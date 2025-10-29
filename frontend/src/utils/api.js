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

  updateCompany: (id, data) =>
    fetch(`${API_URL}/companies/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
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

  // Attendance
  getAttendance: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetch(`${API_URL}/attendance?${query}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse)
  },

  // Reports
  getDailyReport: (company_id, date) =>
    fetch(`${API_URL}/reports/daily?company_id=${company_id}&date=${date}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  getDeviceHealth: () =>
    fetch(`${API_URL}/reports/device-health`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  exportAttendance: (company_id, from, to) => {
    const query = new URLSearchParams({ company_id, from, to }).toString()
    return fetch(`${API_URL}/reports/export?${query}`, {
      headers: getAuthHeaders(),
    }).then(response => response.blob())
  },
}

export default api
