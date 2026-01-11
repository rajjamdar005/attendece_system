import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hasAnyPermission } from '../utils/permissions'

/**
 * Route wrapper that checks if user has required permissions
 */
export default function RoleRoute({ children, requiredPermissions = [], redirectTo = '/' }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If no specific permissions required, just check authentication
  if (requiredPermissions.length === 0) {
    return children
  }

  // Check if user has any of the required permissions
  const hasAccess = hasAnyPermission(user.role, requiredPermissions)

  if (!hasAccess) {
    // Redirect to dashboard with access denied message
    return <Navigate to={redirectTo} replace state={{ accessDenied: true }} />
  }

  return children
}
