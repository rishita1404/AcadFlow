#!/usr/bin/env python3
"""
AcadFlow - Redis Security Cache Inspector
Displays active rate limits, account lockouts, blacklisted JWT tokens, and TTLs.
"""
import sys
import redis

def inspect_redis():
    host = "localhost"
    port = 6379
    r = redis.Redis(host=host, port=port, db=0, decode_responses=True)

    try:
        r.ping()
    except Exception as e:
        print(f"\n❌ Could not connect to Redis at {host}:{port}")
        print("   Start Redis with: 'docker compose -f deploy/docker-compose.yml up -d redis'")
        sys.exit(1)

    print("=" * 65)
    print(" 🔴 AcadFlow Redis Inspector (Security & Cache Store)")
    print("=" * 65)
    print(f"✅ Connected to: redis://{host}:{port}/0")
    
    info = r.info("server")
    print(f"⚡ Redis Version: {info.get('redis_version')} | Uptime: {info.get('uptime_in_seconds')}s")
    
    keys = r.keys("*")
    print(f"📊 Total Keys in DB 0: {len(keys)}")
    print("-" * 65)

    if not keys:
        print("ℹ️ No keys currently in Redis (system is idle).")
        print("\n💡 To see keys appear live:")
        print("   1. Try logging in with a wrong password 5 times.")
        print("   2. You will see 'fail:<email>' appear with a 900s lockout TTL countdown.")
    else:
        print("🔑 Active Security Keys:\n")
        for k in sorted(keys):
            key_type = r.type(k)
            ttl = r.ttl(k)
            ttl_str = f"{ttl}s remaining" if ttl > 0 else ("No expiry" if ttl == -1 else "Expired")
            
            # Category explanation
            category = "Unknown"
            if k.startswith("fail:"):
                category = "🔒 Login Lockout Counter"
            elif k.startswith("rl:login"):
                category = "⏱️ Login Rate Limiter (Sliding Window)"
            elif k.startswith("rl:upload"):
                category = "⏱️ Upload Rate Limiter"
            elif k.startswith("blacklist:"):
                category = "🚫 Revoked JWT Token"
            elif k.startswith("session:"):
                category = "👤 Active Session"

            print(f"• Key: {k}")
            print(f"  Category: {category}")
            print(f"  Type: {key_type} | TTL: {ttl_str}")
            
            if key_type == "string":
                print(f"  Value: {r.get(k)}")
            elif key_type == "zset":
                print(f"  Entries count: {r.zcard(k)}")
            elif key_type == "set":
                print(f"  Members: {r.smembers(k)}")
            print()

    print("=" * 65)

if __name__ == "__main__":
    inspect_redis()
