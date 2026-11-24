# 0009. Automated Integration Chaos Test Verification

We decided to verify the durable agent runtime using an end-to-end automated chaos test suite rather than purely mocked unit tests or manual verification scripts. The test suite systematically reproduces the three core distributed failure modes: mid-tool worker SIGKILL with successful process re-attachment via opId, zombie worker rejection via stale epoch fences, and always-on mailbox wake-up from a parked state. This provides verifiable proof of crash resilience and system correctness directly runnable in CI.
