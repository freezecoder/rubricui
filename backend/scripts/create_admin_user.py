import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.database import get_db
from app.models.user import User
from app.api.users import hash_password

def create_admin_user():
    """Create a default admin user"""
    print("Creating admin user...")
    
    # Get a database session
    db = next(get_db())
    
    try:
        # Check if admin user already exists
        existing_admin = db.query(User).filter(User.username == 'admin').first()
        if existing_admin:
            print("Admin user already exists!")
            print(f"  Username: {existing_admin.username}")
            print(f"  Role: {existing_admin.role}")
            print(f"  Email: {existing_admin.email}")
            return
        
        # Create admin user
        admin_user = User(
            username='admin',
            email='admin@example.com',
            full_name='System Administrator',
            hashed_password=hash_password('admin123'),
            role='admin',
            is_active=True,
            is_verified=True,
            organization='System',
            department='IT'
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("Admin user created successfully!")
        print(f"  Username: {admin_user.username}")
        print(f"  Password: admin123")
        print(f"  Role: {admin_user.role}")
        print(f"  Email: {admin_user.email}")
        print(f"  ID: {admin_user.id}")
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()
