# Why Three Data Stores?

1. **PostgreSQL**: Strict relational consistency, ACID guarantees, foreign key relations across users, courses, enrollments, attendance entries, and grade submissions.
2. **MongoDB**: High-throughput document storage for append-only audit trails, user access logs, and polymorphic notification payloads.
3. **Redis**: In-memory low-latency access for rate-limiting counters, active JWT token blacklist/session cache, and background task deduplication.
