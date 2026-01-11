import { createContext, useContext, useState, useEffect } from 'react'
import { hasPermission, hasAnyPermission, hasAllPermissions, canAccessCompany } from '../utils/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Login failed')
    }

    const data = await response.json()
    
    localStorage.setItem('token', data.data.token)
    localStorage.setItem('user', JSON.stringify(data.data.user))
    setUser(data.data.user)
    
    return data.data.user
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  // Permission check helpers
  const checkPermission = (permission) => {
    return hasPermission(user?.role, permission)
  }

  const checkAnyPermission = (permissions) => {
    return hasAnyPermission(user?.role, permissions)
  }

  const checkAllPermissions = (permissions) => {
    return hasAllPermissions(user?.role, permissions)
  }

  const checkCompanyAccess = (companyId) => {
    return canAccessCompany(user, companyId)
  }

  const value = {
    user,
    loading,
    login,
    logout,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
    canAccessCompany: checkCompanyAccess,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
