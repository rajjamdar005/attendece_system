import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { PERMISSIONS } from './utils/permissions'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Users from './pages/Users'
import Employees from './pages/Employees'
import Devices from './pages/Devices'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

// Components
import Layout from './components/Layout'
import SplashScreen from './components/SplashScreen'
import RoleRoute from './components/RoleRoute'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" />
}

function AccessDenied() {
  const location = useLocation()
  const accessDenied = location.state?.accessDenied

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this page. Please contact your administrator if you believe this is an error.
        </p>
        <Navigate to="/" replace />
      </div>
    </div>
  )
}

function App() {
  const { user } = useAuth()
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    // Check if splash has been shown in this session
    const splashShown = sessionStorage.getItem('splashShown')
    if (splashShown) {
      setShowSplash(false)
    }
  }, [])

  const handleSplashComplete = () => {
    sessionStorage.setItem('splashShown', 'true')
    setShowSplash(false)
  }

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/access-denied" element={<AccessDenied />} />
      
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        
        {/* Companies - Only Incubation Head */}
        <Route 
          path="companies" 
          element={
            <RoleRoute 
              requiredPermissions={['VIEW_ALL_COMPANIES']}
              redirectTo="/access-denied"
            >
              <Companies />
            </RoleRoute>
          } 
        />
        
        {/* Users - Only Incubation Head */}
        <Route 
          path="users" 
          element={
            <RoleRoute 
              requiredPermissions={['MANAGE_COMPANIES']}
              redirectTo="/access-denied"
            >
              <Users />
            </RoleRoute>
          } 
        />
        
        {/* Employees - Incubation Head & Company Admin */}
        <Route 
          path="employees" 
          element={
            <RoleRoute 
              requiredPermissions={['VIEW_ALL_EMPLOYEES', 'VIEW_COMPANY_EMPLOYEES']}
              redirectTo="/access-denied"
            >
              <Employees />
            </RoleRoute>
          } 
        />
        
        {/* Devices - All roles can view */}
        <Route 
          path="devices" 
          element={
            <RoleRoute 
              requiredPermissions={['VIEW_ALL_DEVICES', 'VIEW_COMPANY_DEVICES']}
              redirectTo="/access-denied"
            >
              <Devices />
            </RoleRoute>
          } 
        />
        
        {/* Reports - Incubation Head & Company Admin */}
        <Route 
          path="reports" 
          element={
            <RoleRoute 
              requiredPermissions={['VIEW_ALL_REPORTS', 'VIEW_COMPANY_REPORTS']}
              redirectTo="/access-denied"
            >
              <Reports />
            </RoleRoute>
          } 
        />
        
        {/* Settings - All authenticated users */}
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default App

