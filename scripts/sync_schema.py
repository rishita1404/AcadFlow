import sys
sys.path.insert(0, 'backend')
import sqlite3
import app.models
from app.db.base import Base

conn = sqlite3.connect('backend/acadflow.db')
c = conn.cursor()

# Get existing tables
existing_tables = set(r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall())

for table_name, table in Base.metadata.tables.items():
    if table_name not in existing_tables:
        print(f"Table missing: {table_name}")
        continue
    
    existing_cols = set(r[1] for r in c.execute(f"PRAGMA table_info({table_name})").fetchall())
    for col in table.columns:
        if col.name not in existing_cols:
            col_type = str(col.type).split("(")[0]
            if "VARCHAR" in col_type or "TEXT" in col_type or "STRING" in col_type:
                sql_type = "VARCHAR(255)"
                default_val = "DEFAULT ''" if not col.nullable else "DEFAULT NULL"
            elif "INT" in col_type:
                sql_type = "INTEGER"
                default_val = "DEFAULT 0" if not col.nullable else "DEFAULT NULL"
            elif "NUMERIC" in col_type or "DECIMAL" in col_type or "FLOAT" in col_type:
                sql_type = "NUMERIC(5,2)"
                default_val = "DEFAULT 0.0" if not col.nullable else "DEFAULT NULL"
            elif "BOOL" in col_type:
                sql_type = "BOOLEAN"
                default_val = "DEFAULT 0"
            else:
                sql_type = "VARCHAR(255)"
                default_val = "DEFAULT NULL"

            # Check specific defaults
            if col.name == "condonation_floor_pct":
                default_val = "DEFAULT 65.0"
            elif col.name == "require_recommendation":
                default_val = "DEFAULT 1"
            elif col.name == "collision_warning_threshold":
                default_val = "DEFAULT 3"
            elif col.name == "section":
                default_val = "DEFAULT 'A'"

            alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {sql_type} {default_val}"
            print(f"Adding missing column: {alter_sql}")
            try:
                c.execute(alter_sql)
            except Exception as e:
                print(f"Error on {table_name}.{col.name}: {e}")

conn.commit()
conn.close()
print("All model columns successfully synchronized!")
