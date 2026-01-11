/**
 * Role-based Access Control (RBAC) Configuration
 * 
 * Roles:
 * - incubation_head: Full system access (super admin)
 * - company_admin: Company-specific access
 * - technician: Read-only access for maintenance
 */

export const ROLES = {
  INCUBATION_HEAD: 'incubation_head',
  COMPANY_ADMIN: 'company_admin',
  TECHNICIAN: 'technician',
}

export const PERMISSIONS = {
  // Company Management
  VIEW_ALL_COMPANIES: [ROLES.INCUBATION_HEAD],
  CREATE_COMPANY: [ROLES.INCUBATION_HEAD],
  EDIT_COMPANY: [ROLES.INCUBATION_HEAD],
  DELETE_COMPANY: [ROLES.INCUBATION_HEAD],
  VIEW_OWN_COMPANY: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN],

  // Employee Management
  VIEW_ALL_EMPLOYEES: [ROLES.INCUBATION_HEAD],
  VIEW_COMPANY_EMPLOYEES: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN],
  CREATE_EMPLOYEE: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN],
  EDIT_EMPLOYEE: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN],
  DELETE_EMPLOYEE: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN],
  ASSIGN_RFID_TAG: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN],

  // Device Management
  VIEW_ALL_DEVICES: [ROLES.INCUBATION_HEAD, ROLES.TECHNICIAN],
  VIEW_COMPANY_DEVICES: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN, ROLES.TECHNICIAN],
  CREATE_DEVICE: [ROLES.INCUBATION_HEAD, ROLES.TECHNICIAN],
  EDIT_DEVICE: [ROLES.INCUBATION_HEAD, ROLES.TECHNICIAN],
  DELETE_DEVICE: [ROLES.INCUBATION_HEAD],
  RESET_DEVICE: [ROLES.INCUBATION_HEAD, ROLES.TECHNICIAN],

  // Reports & Analytics
  VIEW_ALL_REPORTS: [ROLES.INCUBATION_HEAD],
  VIEW_COMPANY_REPORTS: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN],
  EXPORT_REPORTS: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN],

  // System Settings
  VIEW_SYSTEM_SETTINGS: [ROLES.INCUBATION_HEAD],
  MANAGE_USERS: [ROLES.INCUBATION_HEAD],
  VIEW_AUDIT_LOGS: [ROLES.INCUBATION_HEAD],

  // User Settings
  VIEW_PROFILE: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN, ROLES.TECHNICIAN],
  EDIT_PROFILE: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN, ROLES.TECHNICIAN],
}

/**
 * Check if user has specific permission
 */
export function hasPermission(userRole, permission) {
  if (!userRole || !permission) return false
  const allowedRoles = PERMISSIONS[permission]
  return allowedRoles ? allowedRoles.includes(userRole) : false
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userRole, permissions) {
  return permissions.some(permission => hasPermission(userRole, permission))
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(userRole, permissions) {
  return permissions.every(permission => hasPermission(userRole, permission))
}

/**
 * Get user role display name
 */
export function getRoleDisplayName(role) {
  const roleNames = {
    [ROLES.INCUBATION_HEAD]: 'Incubation Head',
    [ROLES.COMPANY_ADMIN]: 'Company Admin',
    [ROLES.TECHNICIAN]: 'Technician',
  }
  return roleNames[role] || role
}

/**
 * Get user role color for badges
 */
export function getRoleColor(role) {
  const roleColors = {
    [ROLES.INCUBATION_HEAD]: 'bg-purple-100 text-purple-800',
    [ROLES.COMPANY_ADMIN]: 'bg-blue-100 text-blue-800',
    [ROLES.TECHNICIAN]: 'bg-gray-100 text-gray-800',
  }
  return roleColors[role] || 'bg-gray-100 text-gray-800'
}

/**
 * Check if user can access company data
 */
export function canAccessCompany(user, companyId) {
  if (!user) return false
  
  // Incubation head can access all companies
  if (user.role === ROLES.INCUBATION_HEAD) return true
  
  // Company admin can only access their own company
  if (user.role === ROLES.COMPANY_ADMIN) {
    return user.company_id === companyId
  }
  
  // Technician can view but not modify
  if (user.role === ROLES.TECHNICIAN) return true
  
  return false
}

/**
 * Navigation items with role-based visibility
 */
export const NAVIGATION_ITEMS = [
  {
    name: 'Dashboard',
    path: '/',
    icon: 'LayoutDashboard',
    roles: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN, ROLES.TECHNICIAN],
  },
  {
    name: 'Companies',
    path: '/companies',
    icon: 'Building2',
    roles: [ROLES.INCUBATION_HEAD], // Only incubation head
  },
  {
    name: 'Employees',
    path: '/employees',
    icon: 'Users',
    roles: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN],
  },
  {
    name: 'Devices',
    path: '/devices',
    icon: 'Radio',
    roles: [ROLES.COMPANY_ADMIN, ROLES.TECHNICIAN],
  },
  {
    name: 'Reports',
    path: '/reports',
    icon: 'BarChart3',
    roles: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN],
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: 'Settings',
    roles: [ROLES.INCUBATION_HEAD, ROLES.COMPANY_ADMIN, ROLES.TECHNICIAN],
  },
]

/**
 * Get navigation items for specific role
 */
export function getNavigationForRole(role) {
  return NAVIGATION_ITEMS.filter(item => item.roles.includes(role))
}
