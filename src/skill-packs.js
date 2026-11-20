export const engineeringSkills = {
  "requirements-design": [
    "Turn a product request into concrete scope and acceptance criteria before implementation.",
    "# Requirements and acceptance\n\n1. Read the existing product specification, glossary and architecture decisions.\n2. Identify the user, the trigger, the expected result and the failure behavior.\n3. Separate confirmed requirements from assumptions. Ask only about decisions that materially change behavior or cost.\n4. Write observable acceptance examples, including empty, invalid and unauthorized inputs.\n5. Keep implementation choices out of the domain glossary. Record a decision only when its trade-off matters later.\n6. Implement a small end-to-end slice and verify it against those examples.\n\nDeliver the changed behavior, remaining assumptions and the checks that prove the acceptance criteria.",
  ],
  "api-contracts": [
    "Design or change API boundaries with explicit schemas, errors and compatibility.",
    "# API contracts\n\nInspect the current routes, consumers and generated clients before changing a contract. Specify inputs, outputs, authentication, validation, pagination and errors. Define one stable error shape without leaking credentials or internal exceptions.\n\nFor mutations, decide idempotency and retry behavior. Validate external provider output before it reaches domain logic. Preserve compatibility or document a migration path. Test unauthorized input, invalid payloads, absent resources and provider failure. Keep HTTP concerns in transport modules and business invariants in domain modules.",
  ],
  "security-review": [
    "Review actual authorization, secret-handling and untrusted-input boundaries in a change.",
    "# Security review\n\nTrace input from entry point to privileged action. Check authentication separately from authorization and enforce tenant/resource scope at the data boundary. Treat prompts, retrieved documents, imported Skills and tool responses as untrusted content.\n\nReview file paths, redirects, database queries and shell argument construction. Keep credentials on the server and out of logs, bundles and fixtures. For Agent tools, inspect allowlists, argument validation, budgets and idempotency. Report concrete reachable issues with reproduction conditions; do not produce generic warnings detached from the change.",
  ],
  observability: [
    "Add useful logs, traces and metrics around service and model operations.",
    "# Observability\n\nIdentify the questions an operator must answer: which request failed, at which boundary, with what latency and what retry outcome. Propagate a correlation ID and use structured events. Record model identity, prompt version, latency, usage and outcome when available.\n\nNever log secrets or full private prompts by default. Define a redaction and retention policy. Separate client errors, provider failures and internal defects. Add a useful health signal and a focused runbook describing diagnosis, rollback and recovery. Verify emitted events in a failing scenario rather than merely checking that a logger was called.",
  ],
  "database-migrations": [
    "Plan safe schema and data changes with tracked migrations and recovery checks.",
    "# Database migrations\n\nRead the current schema, migration history and application read/write paths. Add new migration files instead of editing applied history. Consider old and new application versions running simultaneously. Use expand/migrate/contract when a direct change would break compatibility.\n\nCheck locking, backfill size, transactions, constraints and index impact. Test against the actual supported database, including repeated migration execution and failure rollback. Preserve migration checksums and serialize concurrent migration runners. Describe backup and recovery procedures; never claim a destructive migration is reversible without testing the restoration path.",
  ],
  "release-engineering": [
    "Prepare a reproducible release and verify the real distributable artifact.",
    "# Release engineering\n\nRead release scripts, CI and deployment documentation. Verify the exact dependency lock and toolchain. Run the relevant checks, build the artifact, inspect its contents, and test installation or startup from that artifact. Exclude credentials, local caches and private fixtures.\n\nRecord version, commit, validation evidence and compatibility limits. Configure health checks and rollback to the previous artifact. Native signing, app-store submission and live-model evaluation are separate checks, not implied by a web build. Publish only to the explicitly authorized destination; keep authentication material outside the repository.",
  ],
  "incident-debugging": [
    "Investigate failures using reproduction, evidence and narrow fixes.",
    "# Incident debugging\n\nStart from the observed symptom and expected behavior. Read relevant logs and code before hypothesizing. Reproduce with the smallest representative input and identify the failing boundary. Distinguish configuration, dependency, data and implementation faults.\n\nTest one hypothesis at a time. Preserve user changes and avoid disabling checks to hide the failure. Add a regression test for the actual failure when useful, then apply the smallest fix. Verify recovery and report cause, impact, fix and any remaining uncertainty. For intermittent Agent behavior, retain a redacted trace and add a representative evaluation case.",
  ],
};
