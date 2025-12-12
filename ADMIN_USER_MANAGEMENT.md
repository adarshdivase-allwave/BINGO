# BINGO Admin User Management System

## Overview

The BINGO application now features a comprehensive admin-based user management system that replaces the previous domain-based access control. Only administrators can add, modify, delete users, and assign roles. The system includes complete activity logging for audit purposes.

## Features

### 1. **Role-Based Access Control**
- **ADMIN**: Full access to user management and activity logs
- **USER**: Regular access to the application features

### 2. **User Status Management**
- **ACTIVE**: User can access the application
- **INACTIVE**: User cannot access the application
- **SUSPENDED**: User account is temporarily blocked

### 3. **User Management**
- Admins can create new users
- Admins can update user roles (promote/demote users)
- Admins can change user status
- Admins can delete users
- View all users with creation dates and last login times

### 4. **Activity Logging**
- Track all user logins and logouts
- Log all project operations (create, edit, delete, view)
- Log BOQ exports
- Log user management activities (create, update, delete, role changes)
- Record IP addresses and user agents
- Export activity logs as CSV

### 5. **User-Friendly Admin Dashboard**
- Search and filter users by email
- View user roles and status at a glance
- Quick action buttons to manage users
- Activity log viewer with detailed information
- Export functionality for compliance and auditing

## Architecture

### Database Schema

#### User Model
```typescript
interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  createdBy: string; // Email of admin who created the user
  lastLogin: string | null;
  updatedAt: string;
  updatedBy?: string; // Email of admin who last updated the user
}
```

#### Activity Log Model
```typescript
interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  action: ActivityAction;
  timestamp: string;
  resourceType?: string; // 'Project', 'User', etc.
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}
```

### Services

#### User Management Service (`userManagementService.ts`)
Handles all user operations:
- `createUser()` - Create new user with Cognito and database records
- `getAllUsers()` - Fetch all users
- `getUserByEmail()` - Get specific user
- `updateUserRole()` - Change user role
- `updateUserStatus()` - Change user status
- `deleteUserAccount()` - Remove user
- `isUserAdmin()` - Check admin privileges
- `getCurrentUserWithDetails()` - Get current user info
- `updateLastLogin()` - Update last login timestamp
- `logUserLogout()` - Log logout event

#### Activity Logging Service (`activityLogService.ts`)
Handles all activity tracking:
- `logActivity()` - Log any activity to database
- `fetchActivityLogs()` - Retrieve logs with filters
- `getUserActivitySummary()` - Get user activity stats
- `exportActivityLogsAsCSV()` - Export logs as CSV file

### Components

#### Admin Dashboard (`AdminDashboard.tsx`)
The main admin interface with two tabs:

**Users Tab**:
- User list with search functionality
- Email, Name, Role, Status, Created date, Last login columns
- Dropdown selectors to change role and status
- Delete button with confirmation modal

**Activity Logs Tab**:
- Complete activity history
- Timestamp, User, Action, Resource, IP Address columns
- CSV export button
- Sortable by timestamp

#### Create User Modal (`CreateUserModal.tsx`)
Form for creating new users:
- Email field with validation
- Name field
- Password field with strength requirements (8+ characters)
- Confirm password field
- Role dropdown (USER or ADMIN)
- Error handling and feedback

#### Updated AuthGate (`AuthGate.tsx`)
Enhanced authentication component that:
- Validates user exists in database
- Checks if user status is ACTIVE
- Prevents access for INACTIVE/SUSPENDED users
- Logs all login attempts
- Provides clear error messages

#### AppWrapper (`AppWrapper.tsx`)
Container component that:
- Manages global user context
- Provides admin dashboard access
- Handles user data loading
- Shows admin button for privileged users

## Usage Flow

### For Initial Setup (First Admin)

1. **Deploy Application**
   - AWS Amplify will create Cognito user pool and database

2. **Create First Admin User**
   - Sign up via Cognito authentication
   - Admin must manually update user record in database to set role='ADMIN'
   - This can be done via AWS Console or AWS CLI:
   ```bash
   aws dynamodb update-item \
     --table-name User \
     --key '{"id": {"S": "user-id"}}' \
     --attribute-updates '{"role": {"Value": {"S": "ADMIN"}}}'
   ```

### For Regular Admin Operations

1. **Create New User**
   - Admin logs in
   - Clicks "Admin" button (bottom right)
   - Goes to "Users Management" tab
   - Clicks "Create New User" button
   - Fills in user details
   - User receives email with temporary password

2. **Manage User Roles**
   - Admin views users list
   - Changes role via dropdown (USER/ADMIN)
   - System logs the action

3. **Suspend User Access**
   - Admin can set status to SUSPENDED
   - User will be denied access on next login
   - Can reactivate later

4. **View Activity Logs**
   - Admin goes to "Activity Logs" tab
   - Searches for specific user or time period
   - Exports CSV for records

### For Regular Users

1. **Sign In**
   - Enter email and password (provided by admin)
   - System validates account is ACTIVE
   - Updates last login timestamp
   - Activity log entry created

2. **Use Application**
   - All project operations are logged
   - Export operations are tracked
   - Logout is recorded

3. **Sign Out**
   - Logout event is logged
   - Session ends

## Activity Tracking

### Tracked Actions
- **LOGIN** - User signs in
- **LOGOUT** - User signs out
- **CREATE_PROJECT** - User creates new BOQ project
- **EDIT_PROJECT** - User modifies project
- **DELETE_PROJECT** - User deletes project
- **EXPORT_BOQ** - User exports BOQ to Excel
- **VIEW_PROJECT** - User opens project
- **USER_CREATED** - Admin creates new user
- **USER_UPDATED** - Admin modifies user
- **USER_DELETED** - Admin deletes user
- **ROLE_CHANGED** - Admin changes user role
- **USER_SUSPENDED** - Admin suspends user

### Log Information Captured
- Timestamp (ISO format)
- User email and ID
- Action type
- Resource information (type, ID, name)
- IP address (via ipify API)
- User agent (browser info)
- Additional details (JSON)

## Security Considerations

### Authorization Rules
- Only ADMIN users can create/update/delete users
- All users can read activity logs (filtered to their own activity)
- Admins can see all activity logs
- User passwords are handled by Cognito (never stored in app)

### Best Practices
1. **Create strong passwords** when adding users
2. **Regularly review activity logs** for suspicious activity
3. **Promptly suspend** accounts of departing employees
4. **Keep admin accounts secure** - limit number of admins
5. **Export logs regularly** for backup and compliance

## Compliance & Auditing

### Audit Trail
- Complete record of who did what and when
- IP addresses recorded for access tracking
- Exportable CSV format for compliance reports
- Timestamps in ISO 8601 format (UTC)

### Export Format
CSV with columns:
- Timestamp
- User Email
- Action
- Resource Type
- Resource Name
- IP Address
- Details (JSON)

### Data Retention
- Activity logs are retained indefinitely in database
- Regular exports recommended for long-term storage
- Consider implementing log retention policies per company requirements

## Troubleshooting

### User Cannot Access Application
1. Check user status is ACTIVE (not INACTIVE or SUSPENDED)
2. Verify user exists in database
3. Check last login timestamp
4. Review activity logs for error entries

### Activity Log Not Showing
1. Verify user performed the action
2. Check internet connection (logs sync to database)
3. Refresh page to see latest entries
4. Check filters are not hiding logs

### Cannot Create User
1. Verify you are logged in as ADMIN
2. Check password meets requirements (8+ characters)
3. Verify email is valid format
4. Check email is not already in use

## Integration Points

### Email Notifications (Future)
- Send new user credentials to email
- Send password reset links
- Notify on account suspension

### Analytics Integration (Future)
- Dashboard showing user adoption
- Feature usage statistics
- Peak usage times

### Advanced Reporting (Future)
- Compliance reports
- Usage analytics
- Security audit reports

## API Integration

All user management and activity logging operations use Amplify Data Client:
- Automatic sync with backend
- Real-time updates
- Offline support (pending connection)

## Migration from Old System

If migrating from domain-based access:
1. Create users for all existing users
2. Review and assign appropriate roles
3. Enable activity logging
4. Archive old access control records

---

**Version**: 1.0  
**Last Updated**: 2024-12-10  
**Maintained By**: Development Team
