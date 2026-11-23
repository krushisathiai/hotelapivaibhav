/**
 * Role-Based Access Control Middleware
 * Checks if the authenticated user has one of the allowed roles.
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'You do not have permission to perform this action' 
      });
    }

    next();
  };
};

// Role hierarchy for convenience
const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HOTEL_ADMIN: 'HOTEL_ADMIN',
  MANAGER: 'MANAGER',
  RECEPTIONIST: 'RECEPTIONIST',
  HOUSEKEEPING: 'HOUSEKEEPING',
  ACCOUNTANT: 'ACCOUNTANT',
  STAFF: 'STAFF',
};

// Permission groups
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.HOTEL_ADMIN];
const MANAGEMENT_ROLES = [...ADMIN_ROLES, ROLES.MANAGER];
const DESK_ROLES = [...MANAGEMENT_ROLES, ROLES.RECEPTIONIST];
const FINANCE_ROLES = [...MANAGEMENT_ROLES, ROLES.ACCOUNTANT];
const ALL_ROLES = Object.values(ROLES);

module.exports = { authorize, ROLES, ADMIN_ROLES, MANAGEMENT_ROLES, DESK_ROLES, FINANCE_ROLES, ALL_ROLES };
