"""
Seed the Supabase database with data for 'The Velvet Trap'.
"""
import json
import os
import sys
from datetime import date
from uuid import uuid4

# Add backend to path so we can import from db and models
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from db.models import (
    Budget, CastMember, Equipment, Location, Project, Scene,
    SceneEquipment
)
from db.session import SessionLocal

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "data")


def load_json(filename: str):
    with open(os.path.join(DATA_DIR, filename), "r") as f:
        return json.load(f)


def seed():
    # User ID to own the seed data (must match an existing auth.users ID in Supabase)
    # For local development, this can be any UUID if RLS is bypassed, but for Supabase
    # it's best to use an environment variable or a known test user ID.
    owner_id = os.environ.get("SEED_USER_ID", str(uuid4()))
    
    print(f"Seeding database for owner_id: {owner_id}")

    db = SessionLocal()
    try:
        # Create Project
        project = Project(
            id=str(uuid4()),
            name="The Velvet Trap",
            description="A neo-noir thriller short film.",
            owner_id=owner_id,
        )
        db.add(project)
        db.flush()
        print(f"Created project: {project.id}")

        # Load data
        locations_data = load_json("seed_locations.json")
        cast_data = load_json("seed_cast.json")
        equipment_data = load_json("seed_equipment.json")
        budget_data = load_json("seed_budget.json")
        scenes_data = load_json("seed_scenes.json")

        # Create Locations
        loc_map = {}
        for l_data in locations_data:
            key = l_data.pop("key")
            l_data.pop("notes", None) # Remove notes
            loc = Location(id=str(uuid4()), project_id=project.id, **l_data)
            db.add(loc)
            loc_map[key] = loc
        db.flush()
        print(f"Created {len(loc_map)} locations.")

        # Create Cast
        cast_map = {}
        for c_data in cast_data:
            key = c_data.pop("key")
            c_data.pop("notes", None)
            cm = CastMember(id=str(uuid4()), project_id=project.id, **c_data)
            db.add(cm)
            cast_map[key] = cm
        db.flush()
        print(f"Created {len(cast_map)} cast members.")

        # Create Equipment
        equip_map = {}
        for e_data in equipment_data:
            key = e_data.pop("key")
            e_data.pop("notes", None)
            eq = Equipment(id=str(uuid4()), project_id=project.id, **e_data)
            db.add(eq)
            equip_map[key] = eq
        db.flush()
        print(f"Created {len(equip_map)} equipment items.")

        # Create Budget
        budget_data.pop("notes", None)
        budget = Budget(id=str(uuid4()), project_id=project.id, **budget_data)
        db.add(budget)
        db.flush()
        print("Created budget.")

        # Create Scenes
        for s_data in scenes_data:
            loc_key = s_data.pop("location_key", None)
            cast_keys = s_data.pop("cast_keys", [])
            equip_keys = s_data.pop("equipment_keys", {})
            s_data.pop("tension_note", None)

            scene = Scene(
                id=str(uuid4()),
                project_id=project.id,
                location_id=loc_map[loc_key].id if loc_key else None,
                **s_data
            )
            db.add(scene)
            db.flush()

            for ck in cast_keys:
                scene.cast_members.append(cast_map[ck])
            
            for ek, qty in equip_keys.items():
                se = SceneEquipment(
                    scene_id=scene.id,
                    equipment_id=equip_map[ek].id,
                    quantity_required=qty
                )
                db.add(se)
        
        db.commit()
        print("Successfully seeded all scenes and relationships.")
        print(f"Seed complete! Project ID: {project.id}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
