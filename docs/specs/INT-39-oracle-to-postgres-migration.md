# INT-39 — Migrate from Oracle to PostgreSQL (Amazon RDS)

| Field | Value |
| --- | --- |
| Jira | INT-39 |
| Summary | Migrate from Oracle to Postgres |
| Original description | "Prepare a plan to move DB to RDS" |
| Status of this document | Draft — requirements derived from a one-line ticket; see [Open questions](#10-open-questions) |

## 1. Problem statement

The ticket asks for a plan to move the current Oracle database to PostgreSQL hosted on Amazon RDS.
The ticket does not identify the source system, its size, the consuming applications, or the
target availability requirements. This spec therefore defines the **deliverables and requirements
for the migration plan and the migration itself**, with explicit assumptions and open questions
that must be resolved before execution.

Note: this repository (`cog-autodev`) is a stateless Next.js control plane that reads from the
Devin API and has no database of its own. The Oracle database in scope is external to this repo;
the spec is stored here for tracking purposes only.

## 2. Goals

- G1. Replace Oracle as the system of record with PostgreSQL on Amazon RDS (or Aurora PostgreSQL —
  see OQ-3) with no data loss.
- G2. Cut over with a bounded, pre-agreed downtime window (target: near-zero using CDC; hard cap to
  be agreed — see OQ-6).
- G3. Preserve functional behaviour of all consuming applications (same query results, same
  constraints, same integrations).
- G4. Eliminate Oracle licence dependency after a defined decommission period.
- G5. Provide a tested, rehearsed rollback path up to and including cutover.

## 3. Non-goals

- Re-architecting application data models or splitting the database into services.
- Migrating non-database Oracle components (Oracle Forms/Reports, OBIEE, etc.) unless discovered
  in inventory and explicitly added to scope.
- Performance improvements beyond parity with the current Oracle system.

## 4. Assumptions (to be validated)

- A1. AWS is the approved target cloud and an account/VPC/landing zone already exists.
- A2. The source is a single Oracle instance (or RAC cluster) reachable from AWS via VPN/Direct
  Connect, or can be made reachable for the migration period.
- A3. Applications connect through a driver layer (JDBC/ODP.NET/cx_Oracle/ORM) that can be
  re-pointed at PostgreSQL with code changes rather than a rewrite.
- A4. The team has or can obtain licences for the AWS Schema Conversion Tool (free) and AWS DMS.

## 5. Deliverable: the migration plan

The output of INT-39 is a plan document (this spec is its skeleton) containing the following
sections, each with an owner and a completion criterion.

### 5.1 Discovery & inventory

- R1. Inventory every Oracle schema, with per-schema: size (GB), row counts for the largest 20
  tables, growth rate, and owning team.
- R2. Inventory all database objects by type: tables, views, materialized views, sequences,
  triggers, PL/SQL packages/procedures/functions, types, synonyms, DB links, scheduler jobs,
  partitions, LOBs, Oracle Text indexes, Spatial, Advanced Queuing.
- R3. Inventory Oracle-specific features in use: `ROWNUM`/`ROWID`, `CONNECT BY`, `(+)` outer
  joins, `MERGE`, `NVL/DECODE`, `DUAL`, `SYSDATE`, `NUMBER` precision semantics, empty-string vs
  NULL behaviour, case-insensitive identifiers, `VARCHAR2` byte/char semantics, autonomous
  transactions, flashback, VPD/RLS, TDE, Data Guard.
- R4. Inventory every consumer: applications, reporting/BI tools, ETL jobs, cron/scheduler jobs,
  ad-hoc SQL users, external DB links. Capture connection method and driver version.
- R5. Capture current non-functional baseline: peak TPS, p50/p95/p99 latency of top queries,
  backup RPO/RTO, HA/DR topology, compliance constraints (encryption, residency, audit).
- Completion criterion: inventory spreadsheet/report signed off by the DBA and each application
  owner.

### 5.2 Target architecture

- R6. Choose the engine: RDS for PostgreSQL vs Aurora PostgreSQL-Compatible. Record the decision
  and rationale (cost, HA needs, storage growth, read-replica needs, PostgreSQL version/extension
  requirements).
- R7. Specify: PostgreSQL major version (latest RDS-supported LTS at execution time), instance
  class, storage type/size/IOPS, Multi-AZ, read replicas, parameter group (e.g. `max_connections`,
  `work_mem`, `shared_buffers`, `timezone`, `client_encoding = UTF8`), option/extension list
  (`pg_stat_statements`, `pgaudit`, `pg_trgm`, `postgis` if Spatial in use, `oracle_fdw` if a
  transitional bridge is required).
- R8. Networking & security: private subnets, security groups, no public endpoint, TLS enforced
  (`rds.force_ssl = 1`), encryption at rest with KMS CMK, IAM database authentication or Secrets
  Manager-managed credentials with rotation, least-privilege DB roles per application.
- R9. Operations: automated backups (retention ≥ current Oracle RPO), point-in-time recovery,
  snapshot export policy, Performance Insights, Enhanced Monitoring, CloudWatch alarms
  (CPU, free storage, replication lag, connections, deadlocks), maintenance window, deletion
  protection, tagging.
- R10. Infrastructure defined as code (Terraform or CloudFormation — match existing org standard,
  see OQ-4) and reviewed via PR.
- Completion criterion: architecture diagram + IaC merged and a non-prod RDS instance provisioned.

### 5.3 Schema conversion

- R11. Run AWS Schema Conversion Tool (SCT) against every schema; produce the assessment report
  and classify each object as: auto-converted / needs manual fix / needs redesign / drop.
- R12. Define the data type mapping table (e.g. `NUMBER(p,0)` → `INTEGER`/`BIGINT`/`NUMERIC`,
  `NUMBER` w/o precision → `NUMERIC`, `VARCHAR2` → `VARCHAR`/`TEXT`, `DATE` → `TIMESTAMP(0)`,
  `TIMESTAMP WITH TIME ZONE` → `TIMESTAMPTZ`, `CLOB` → `TEXT`, `BLOB` → `BYTEA` or S3 offload,
  `RAW(16)` GUIDs → `UUID`, `XMLTYPE` → `XML`). Decide on identifier casing convention (all
  lower-case, unquoted).
- R13. Convert PL/SQL to PL/pgSQL or move logic into the application. Each converted routine
  requires a unit test with equivalent inputs/outputs against Oracle and PostgreSQL.
- R14. Sequences: map to `IDENTITY` columns or PostgreSQL sequences; set start values above the
  Oracle high-water mark at cutover.
- R15. Constraints, indexes, partitioning strategy, and materialized-view refresh strategy are
  defined for the target and reviewed for equivalence.
- R16. Schema is version-controlled in a migration tool (Flyway/Liquibase/sqitch — see OQ-5) so
  the target schema is reproducible.
- Completion criterion: target schema deploys cleanly to the non-prod RDS instance from IaC/migration
  scripts; SCT report has zero unresolved "needs manual fix" items.

### 5.4 Data migration

- R17. Use AWS DMS (or an agreed equivalent, e.g. ora2pg + logical replication) for full load
  followed by continuous CDC replication from Oracle (LogMiner or Binary Reader) to RDS.
- R18. Define LOB handling mode, batch sizes, parallel load settings, and table-level task splits
  for tables > N GB (N from inventory).
- R19. Data validation: row counts per table, checksums/hash comparisons on primary key + business
  columns, DMS validation feature, and spot-checks on edge cases (NULL vs empty string, trailing
  spaces, numeric precision, time zones, character-set conversion from the Oracle NLS charset to
  UTF-8).
- R20. Replication lag must be monitored and must be < 1 minute for at least 24 hours before
  cutover is approved.
- Completion criterion: full load + CDC running in non-prod with validation report showing 100%
  match on all in-scope tables.

### 5.5 Application changes

- R21. For each consumer in R4: driver swap, connection string/secret change, SQL dialect fixes
  (identified via R3 plus a test-suite run against PostgreSQL), ORM dialect change, transaction
  isolation review, pagination (`ROWNUM` → `LIMIT/OFFSET` or keyset), and error-code mapping.
- R22. Introduce connection pooling (RDS Proxy or PgBouncer) where the Oracle side relied on
  shared server / DRCP or where connection counts exceed RDS instance limits.
- R23. Each application must pass its full automated test suite and an agreed manual regression
  pack against PostgreSQL before it is eligible for cutover.
- Completion criterion: per-application sign-off recorded in the plan.

### 5.6 Testing & rehearsal

- R24. Functional parity testing (per R23).
- R25. Performance testing against the R5 baseline: p95 latency and peak TPS within ±10% (or
  better) of Oracle for the top-N queries; identify and fix regressions via `EXPLAIN ANALYZE`,
  indexes, statistics targets, or query rewrites.
- R26. Operational drills: failover (Multi-AZ), restore from snapshot, PITR, credential rotation.
- R27. At least two full cutover rehearsals into a production-like environment, each producing a
  timed runbook with actual durations.
- Completion criterion: rehearsal runbook fits within the agreed downtime window (OQ-6) with margin.

### 5.7 Cutover plan

- R28. Runbook with numbered steps, owner, expected duration, verification, and rollback action
  per step. Minimum contents: freeze writes on Oracle → wait for CDC lag = 0 → final validation →
  reset sequences → switch application config/secrets → smoke tests → open traffic → monitor.
- R29. Go/no-go checklist with named approvers.
- R30. Rollback: applications can be repointed to Oracle within the window; decide whether reverse
  CDC (Postgres → Oracle) is required to make post-cutover rollback possible (OQ-7).
- R31. Communication plan: stakeholders, status cadence, incident escalation path.

### 5.8 Post-migration & decommission

- R32. Hypercare period (suggested 2 weeks) with on-call DBA/app owners and daily review of slow
  queries, errors, and alarms.
- R33. Oracle kept read-only for an agreed retention period, then final backup exported and
  archived per compliance requirements; licences released; DMS tasks and replication instances
  deleted; network paths removed.
- R34. Update runbooks, architecture docs, DR plan, and cost tracking.

## 6. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR1 | Zero data loss at cutover (validated by R19). |
| NFR2 | Downtime ≤ agreed window (OQ-6). |
| NFR3 | Performance parity within ±10% of baseline (R25). |
| NFR4 | Encryption in transit and at rest; audit logging enabled (`pgaudit`). |
| NFR5 | RPO/RTO at least equal to current Oracle values (R5). |
| NFR6 | All infrastructure and schema changes are code-reviewed and reproducible. |
| NFR7 | Monthly run cost estimate produced and approved before provisioning production. |

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Large volume of PL/SQL business logic | Early SCT assessment; budget for manual conversion; consider moving logic to the application. |
| Hidden consumers (ad-hoc reports, DB links) | Enable Oracle auditing of logins/sessions for ≥ 30 days during discovery. |
| Character-set / NULL-semantics differences cause silent data changes | Explicit validation rules in R19; checksum comparison, not just counts. |
| Performance regressions from planner differences | Baseline early, performance-test in rehearsal, tune before cutover. |
| CDC unsupported for some Oracle features (e.g. certain LOB modes, unsupported data types) | Verify DMS source limitations against inventory in Phase 1. |
| Underestimated downtime | Two timed rehearsals (R27). |

## 8. Phasing & rough effort

Sequencing (each phase gated by the completion criterion above):

1. Discovery & inventory (5.1) → 2. Target architecture + IaC (5.2) → 3. Schema conversion (5.3)
→ 4. Data migration in non-prod (5.4) → 5. Application changes (5.5) → 6. Testing & rehearsals
(5.6) → 7. Cutover (5.7) → 8. Hypercare & decommission (5.8).

Effort cannot be estimated credibly until R1–R5 are complete; the inventory should include an
estimate per phase.

## 9. Acceptance criteria for INT-39

- [ ] Sections 5.1–5.8 populated with concrete values from discovery (no placeholders).
- [ ] Open questions in Section 10 answered and recorded.
- [ ] Target architecture and cost estimate approved by the platform/infra owner.
- [ ] Plan reviewed by DBA, application owners, security, and the product/project owner.

## 10. Open questions

| ID | Question | Owner |
| --- | --- | --- |
| OQ-1 | Which Oracle database(s)/version(s) and which applications are in scope? | Ticket reporter |
| OQ-2 | Current data volume, growth rate, and peak load? | DBA |
| OQ-3 | RDS for PostgreSQL or Aurora PostgreSQL? Any preference on PostgreSQL version? | Infra |
| OQ-4 | IaC standard (Terraform vs CloudFormation/CDK) and AWS account/region to use? | Infra |
| OQ-5 | Preferred schema migration tool (Flyway/Liquibase/other)? | App teams |
| OQ-6 | Maximum acceptable downtime for cutover? | Product owner |
| OQ-7 | Is post-cutover rollback (reverse replication) required, and for how long? | Product owner |
| OQ-8 | Compliance constraints: data residency, retention, audit, PII handling? | Security |
| OQ-9 | Target date / business deadline (e.g. Oracle licence renewal)? | Ticket reporter |
| OQ-10 | Budget for AWS run cost and for migration tooling/consulting? | Finance/owner |
