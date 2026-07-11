import sys
import os
import uuid
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from db.session import engine, SessionLocal
from db.models import Base

def migrate():
    print("Starting Phase 3 Organization Migration...")
    
    # 1. Create new tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 2. Add org_id to projects if it doesn't exist
        print("Checking if projects table needs org_id column...")
        try:
            db.execute(text("ALTER TABLE projects ADD COLUMN org_id UUID;"))
            db.commit()
            print("Added org_id to projects.")
        except Exception as e:
            db.rollback()
            print("org_id might already exist, ignoring error.")

        # 3. Add user_id and linked_email to cast_members if they don't exist
        print("Checking if cast_members table needs user_id and linked_email columns...")
        try:
            db.execute(text("ALTER TABLE cast_members ADD COLUMN user_id UUID;"))
            db.execute(text("ALTER TABLE cast_members ADD COLUMN linked_email VARCHAR;"))
            db.commit()
            print("Added user_id and linked_email to cast_members.")
        except Exception as e:
            db.rollback()
            print("Columns might already exist on cast_members, ignoring error.")

        # 4. Migrate Users -> Organizations -> OrgMembers -> Projects
        print("Migrating users and projects...")
        # Get all projects that still rely on owner_id (we can query raw to get owner_id)
        # Note: owner_id is not in the ORM model anymore, so we use raw SQL.
        result = db.execute(text("SELECT id, owner_id FROM projects WHERE org_id IS NULL"))
        projects = result.fetchall()
        
        user_orgs = {}
        
        for project in projects:
            proj_id = project[0]
            owner_id = project[1]
            
            if not owner_id:
                continue
                
            # See if we already created an org for this owner
            if owner_id not in user_orgs:
                # Get user name
                user_res = db.execute(text("SELECT name FROM users WHERE id = :id"), {"id": owner_id}).fetchone()
                user_name = user_res[0] if user_res else "Unknown"
                
                # Create org
                new_org_id = str(uuid.uuid4())
                db.execute(text(
                    "INSERT INTO organizations (id, name, owner_user_id) VALUES (:id, :name, :owner_id)"
                ), {"id": new_org_id, "name": f"{user_name}'s Productions", "owner_id": owner_id})
                
                # Add owner to org_members
                new_member_id = str(uuid.uuid4())
                db.execute(text(
                    "INSERT INTO org_members (id, org_id, user_id, org_role, status) VALUES (:id, :org_id, :owner_id, 'owner', 'active')"
                ), {"id": new_member_id, "org_id": new_org_id, "owner_id": owner_id})
                
                user_orgs[owner_id] = new_org_id
            
            org_id = user_orgs[owner_id]
            
            # Update project
            db.execute(text("UPDATE projects SET org_id = :org_id WHERE id = :proj_id"), {"org_id": org_id, "proj_id": proj_id})
        
        db.commit()
        print("Migration complete!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
