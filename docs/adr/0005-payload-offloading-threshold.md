# 0005. Payload Offloading Threshold for Step Histories

We decided to enforce a strict 32KB payload boundary for step history storage in PostgreSQL. Any tool output or execution payload under or equal to 32KB is stored inline in the DurableStep table. Any payload exceeding 32KB is written to external object storage (S3 or local blob storage), leaving only a reference identifier and a truncated summary in the database record. This prevents PostgreSQL write-ahead log bloat, controls table size, and ensures fast queries for streaming and historical turns.
