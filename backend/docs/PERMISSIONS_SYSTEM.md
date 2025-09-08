# Permissions System Documentation

## Overview

The permissions system provides fine-grained access control for different views and functionalities in the RubricRunner application. It allows administrators to control which users can access specific areas of the application and what actions they can perform.

## Architecture

The permissions system consists of four main components:

### 1. ViewPermission
Defines available views and their permission types in the application.

**Table**: `view_permissions`

**Key Fields**:
- `view_name`: Unique identifier (e.g., "rules", "rubrics", "projects")
- `view_display_name`: Human-readable name (e.g., "Rules Management")
- `available_permissions`: JSON array of available permission types
- `view_category`: Category for organization (general, admin, analysis, data, user_management)
- `is_system_view`: Whether this is a system view that cannot be deleted

### 2. UserViewPermission
Controls which users have access to which views and with what permissions.

**Table**: `user_view_permissions`

**Key Fields**:
- `user_id`: Reference to the user
- `view_permission_id`: Reference to the view permission
- `can_view`, `can_create`, `can_edit`, `can_delete`, `can_admin`: Boolean permission flags
- `granted_by`: Who granted these permissions
- `expires_at`: Optional expiration date
- `is_active`: Whether the permission is currently active

### 3. PermissionGroup
Groups of permissions that can be assigned to users as a set.

**Table**: `permission_groups`

**Key Fields**:
- `group_name`: Unique identifier (e.g., "researcher", "admin")
- `group_display_name`: Human-readable name
- `default_permissions`: JSON mapping of view_name to permission arrays
- `is_system_group`: Whether this is a system group that cannot be deleted

### 4. UserPermissionGroup
Associates users with permission groups.

**Table**: `user_permission_groups`

**Key Fields**:
- `user_id`: Reference to the user
- `permission_group_id`: Reference to the permission group
- `assigned_by`: Who assigned the group
- `expires_at`: Optional expiration date
- `is_active`: Whether the assignment is currently active

## Permission Types

The system supports five permission types with a hierarchical structure:

1. **view**: Can view/list items in the area
2. **create**: Can create new items (requires view)
3. **edit**: Can edit existing items (requires view)
4. **delete**: Can delete items (requires edit)
5. **admin**: Full administrative access (overrides all others)

### Permission Hierarchy
- `admin` > `delete` > `edit` > `create` > `view`
- Higher permissions automatically include lower permissions
- `admin` permission grants all other permissions

## Default Views

The system comes with predefined views for the main application areas:

| View Name | Display Name | Category | Available Permissions |
|-----------|--------------|----------|----------------------|
| rules | Rules Management | general | view, create, edit, delete, admin |
| rubrics | Rubrics Management | general | view, create, edit, delete, admin |
| projects | Projects Management | general | view, create, edit, delete, admin |
| datasets | Datasets Management | data | view, create, edit, delete, admin |
| analysis | Analysis Execution | analysis | view, create, edit, delete, admin |
| users | User Management | user_management | view, create, edit, delete, admin |
| admin | Admin Panel | admin | view, admin |
| permissions | Permissions Management | admin | view, create, edit, delete, admin |

## Default Permission Groups

The system includes four default permission groups:

### 1. Viewer
- **Purpose**: Read-only access to most views
- **Permissions**: `view` permission on all non-admin views
- **Use Case**: Users who need to browse and view data but not modify anything

### 2. Researcher
- **Purpose**: Full access to research tools
- **Permissions**: `view`, `create`, `edit`, `delete` on rules, rubrics, projects, datasets, analysis
- **Use Case**: Research scientists who need to create and manage their own content

### 3. Data Analyst
- **Purpose**: Access to datasets and analysis tools
- **Permissions**: 
  - `view`, `create`, `edit` on datasets, analysis, projects
  - `view` on rules, rubrics
- **Use Case**: Analysts who work with data and run analyses but don't create rules

### 4. Administrator
- **Purpose**: Full system access
- **Permissions**: `view`, `create`, `edit`, `delete`, `admin` on all views
- **Use Case**: System administrators who manage users and system configuration

## API Endpoints

### View Permissions Management
- `POST /api/view-permissions/views` - Create new view permission (admin only)
- `GET /api/view-permissions/views` - List all view permissions
- `GET /api/view-permissions/views/{view_id}` - Get specific view permission
- `PUT /api/view-permissions/views/{view_id}` - Update view permission (admin only)
- `DELETE /api/view-permissions/views/{view_id}` - Delete view permission (admin only)

### User View Permissions
- `POST /api/view-permissions/user-permissions` - Create user view permission (admin only)
- `GET /api/view-permissions/user-permissions` - List user view permissions
- `GET /api/view-permissions/user-permissions/{permission_id}` - Get specific user permission
- `PUT /api/view-permissions/user-permissions/{permission_id}` - Update user permission (admin only)
- `DELETE /api/view-permissions/user-permissions/{permission_id}` - Delete user permission (admin only)

### Bulk Operations
- `POST /api/view-permissions/user-permissions/bulk` - Bulk update user permissions (admin only)

### User Permission Summary
- `GET /api/view-permissions/users/{user_id}/permissions` - Get complete permission summary for user (admin only)
- `GET /api/view-permissions/matrix` - Get permission matrix for all users and views (admin only)

## Database Migration

### Running the Migration

```bash
# Navigate to backend directory
cd backend

# Run the migration (creates backup automatically)
python scripts/migrate_permissions_system.py

# Dry run to see what would be done
python scripts/migrate_permissions_system.py --dry-run

# Rollback if needed (requires backup timestamp)
python scripts/migrate_permissions_system.py --rollback --backup-timestamp 20241208_143022
```

### Migration Process

1. **Backup Creation**: Creates timestamped backup tables for all existing data
2. **Table Creation**: Creates the four new permissions tables
3. **Default Data**: Populates default view permissions and permission groups
4. **Admin Assignment**: Automatically assigns admin permissions to existing admin users
5. **Verification**: Verifies that all tables and data were created correctly

### Backup and Rollback

- All existing tables are automatically backed up before migration
- Backup timestamp is provided for rollback purposes
- Rollback drops new tables and restores from backups
- Migration script provides clear success/failure feedback

## Usage Examples

### Granting Permissions to a User

```python
# Create a user view permission
permission_data = {
    "user_id": "user123",
    "view_permission_id": "rules_view_id",
    "can_view": True,
    "can_create": True,
    "can_edit": True,
    "can_delete": False,
    "can_admin": False,
    "granted_by": "admin_user_id",
    "notes": "Granted for research project"
}

# API call
POST /api/view-permissions/user-permissions
```

### Assigning User to Permission Group

```python
# Assign user to researcher group
group_assignment = {
    "user_id": "user123",
    "permission_group_id": "researcher_group_id",
    "assigned_by": "admin_user_id",
    "assignment_notes": "Promoted to researcher role"
}

# API call
POST /api/view-permissions/user-groups
```

### Bulk Permission Updates

```python
# Update permissions for multiple users
bulk_update = {
    "user_ids": ["user1", "user2", "user3"],
    "view_permission_id": "datasets_view_id",
    "permissions": {
        "can_view": True,
        "can_create": True,
        "can_edit": False,
        "can_delete": False,
        "can_admin": False
    },
    "granted_by": "admin_user_id",
    "notes": "Granted dataset access for analysis team"
}

# API call
POST /api/view-permissions/user-permissions/bulk
```

## Integration with Existing System

### Authentication Integration
- All permission endpoints require admin authentication
- Uses existing `get_current_admin_user` dependency
- Integrates with existing user system

### Frontend Integration
- Frontend can check user permissions before showing UI elements
- Permission checks can be done via API calls
- Supports role-based UI rendering

### API Integration
- Existing API endpoints can be enhanced with permission checks
- Middleware can validate user permissions before allowing access
- Supports both direct permissions and group-based permissions

## Security Considerations

### Permission Validation
- Permission hierarchy is automatically enforced
- Invalid permission combinations are rejected
- System views and groups cannot be deleted

### Access Control
- All permission management requires admin authentication
- Permission changes are logged with timestamps and user info
- Expiration dates can be set for temporary access

### Data Integrity
- Foreign key constraints ensure data consistency
- Unique constraints prevent duplicate permissions
- Cascade deletes maintain referential integrity

## Future Enhancements

### Planned Features
1. **Permission Templates**: Predefined permission sets for common roles
2. **Time-based Permissions**: Automatic permission expiration and renewal
3. **Audit Logging**: Detailed logs of all permission changes
4. **Permission Inheritance**: Hierarchical permission structures
5. **Resource-level Permissions**: Permissions for specific resources (e.g., specific projects)
6. **API Rate Limiting**: Rate limiting based on user permissions
7. **Permission Analytics**: Usage statistics and permission effectiveness metrics

### Integration Opportunities
1. **LDAP/Active Directory**: Integration with enterprise directory services
2. **OAuth/SAML**: Integration with external authentication providers
3. **Multi-tenant Support**: Organization-level permission isolation
4. **Workflow Integration**: Permission-based approval workflows

## Troubleshooting

### Common Issues

1. **Permission Not Working**
   - Check if user has direct permissions or group permissions
   - Verify permission is active and not expired
   - Check permission hierarchy (admin overrides all)

2. **Migration Failures**
   - Ensure database is not locked by other processes
   - Check disk space for backup creation
   - Verify SQLite database file permissions

3. **API Errors**
   - Ensure admin authentication is working
   - Check that view permissions exist
   - Verify user exists in the system

### Debug Commands

```bash
# Check migration status
python scripts/migrate_permissions_system.py --dry-run

# Verify database schema
sqlite3 rubrics.db ".schema view_permissions"

# Check user permissions
curl -H "Authorization: Bearer <admin_token>" \
     http://localhost:8000/api/view-permissions/users/{user_id}/permissions
```

## Support

For issues or questions about the permissions system:
1. Check this documentation first
2. Review the API documentation at `/docs`
3. Check the migration script logs
4. Contact the development team
