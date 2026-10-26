#!/usr/bin/env python3
"""
AcadFlow - MongoDB Audit Trail Inspector
Displays database statistics, collections, and live audit records from MongoDB.
"""
import asyncio
import json
import sys
from motor.motor_asyncio import AsyncIOMotorClient

async def inspect_mongo():
    uri = "mongodb://localhost:27017"
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=3000)
    
    try:
        # Check connection
        await client.admin.command('ping')
    except Exception as e:
        print(f"\n❌ Could not connect to MongoDB at {uri}")
        print("   Make sure MongoDB is running (e.g. 'docker compose up -d mongo' or local mongod)")
        sys.exit(1)

    db_names = await client.list_database_names()
    print("=" * 65)
    print(" 🍃 AcadFlow MongoDB Inspector (Document & Audit Store)")
    print("=" * 65)
    print(f"✅ Connected to: {uri}")
    print(f"📁 Available Databases: {', '.join(db_names)}")
    
    db = client.acadflow_mongo
    collections = await db.list_collection_names()
    print(f"📦 Active Database: acadflow_mongo")
    print(f"📂 Collections: {collections}")
    print("-" * 65)
    
    if "audit_logs" in collections:
        count = await db.audit_logs.count_documents({})
        print(f"📊 Collection 'audit_logs': {count} total documents\n")
        print("📄 Recent Audit Events (Sanitized & Redacted):")
        
        docs = await db.audit_logs.find({}, {"_id": 0}).sort("_id", -1).to_list(5)
        for idx, doc in enumerate(docs, 1):
            print(f"\n[Event #{idx}] - Action: {doc.get('action')} | Actor: {doc.get('actor_role')} (ID: {doc.get('actor_id')})")
            print(f"   Resource: {doc.get('resource_type')} #{doc.get('resource_id')} | Outcome: {doc.get('outcome')}")
            print(f"   Timestamp: {doc.get('timestamp')}")
            print(f"   Metadata: {json.dumps(doc.get('metadata', {}), indent=4)}")
    else:
        print("ℹ️ Collection 'audit_logs' is empty or not yet created.")

    print("\n" + "=" * 65)

if __name__ == "__main__":
    asyncio.run(inspect_mongo())
