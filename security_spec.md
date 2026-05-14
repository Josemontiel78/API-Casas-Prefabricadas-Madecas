# Security Specification - Prefab Contracts AI

## Data Invariants
1. A **Client** must have a unique RUT and be assigned to a `vendedor_id`.
2. A **Project** is associated with a `Client` (via `cliente_id`) and a `vendedor_id`.
3. A **Budget** must reference a valid `Client` and `Project`.
4. A **Contract** is the final stage of a `Budget` and must remain immutable in certain fields (like `monto_total`) once signed.
5. All documents MUST have a `vendedor_id` or `ownerId` for access control, except for global configs.

## The "Dirty Dozen" Payloads (Red Team Test Cases)

1. **Identity Spoofing (Create)**: Create a client with a different `vendedor_id` than the authenticated user.
2. **Identity Spoofing (Update)**: Update a client and try to change its `vendedor_id`.
3. **Cross-Tenant Read**: Try to list clients without filtering by `vendedor_id` (should fail unless admin).
4. **Unauthenticated Read**: Try to read anything without being signed in.
5. **Admin Escallation**: Try to create a document in the `admins` collection to become an admin.
6. **Path Poisoning**: Try to create a document with a 2KB long ID string.
7. **Type Mismatch**: Try to set `precio_base` as a string instead of a number.
8. **Shadow Field Injection**: Try to add an `isVerified: true` field to a project that isn't in the schema.
9. **Outcome Tampering**: Try to change a contract status from 'Finalizado' back to 'Borrador'.
10. **Resource Exhaustion**: Try to upload a 2MB string into a `nombre` field.
11. **Orphaned Record**: Create a budget for a non-existent project ID.
12. **PII Leak**: Try to read the `admins` collection as a non-admin.

## Access Matrix

| Collection | Create | Read (List/Get) | Update | Delete |
|------------|--------|-----------------|--------|--------|
| clients    | Auth   | Owner / Admin   | Owner  | Admin  |
| projects   | Auth   | Owner / Admin   | Owner  | Admin  |
| budgets    | Auth   | Owner / Admin   | Owner  | Admin  |
| contracts  | Auth   | Owner / Admin   | Owner  | Admin  |
| vendors    | Admin  | Auth            | Admin  | Admin  |
| admins     | Admin  | Admin           | Admin  | Admin  |
