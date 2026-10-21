// Server-side mirror of the capability pack database contracts.
//
// Deno edge functions cannot import from `src/`, so the table contracts and the
// SQL generator are mirrored here. `src/test/capabilityMigrationSql.test.ts`
// asserts this mirror produces byte-identical SQL to
// `src/platform/core/capabilityMigrationSql.ts`, so drift fails CI.
//
// This is the ONLY source of executable capability DDL. The apply function
// never runs SQL that came from a client or from a model.

export type PackRole = 'anon' | 'authenticated' | 'service_role';
export type PackPrivilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';

export interface PackGrant {
  role: PackRole;
  privileges: PackPrivilege[];
}

export interface PackTableContract {
  table: string;
  ownershipColumn: string | null;
  publicRead: boolean;
  publicInsert: boolean;
  grants: PackGrant[];
}

export interface PackDatabaseContract {
  id: string;
  dependsOn: string[];
  /** Capabilities this pack satisfies (its own id plus aliases). */
  provides: string[];
  tables: PackTableContract[];
}

export interface SiteCapabilityInstallRecord {
  siteId: string;
  capabilityId: string;
  status: 'enabled';
  enabledBy: string;
  configuration: {
    manifestVersion: '1.0';
    source: 'capability-migration-apply';
    packId: string;
    provides: string[];
    requiredTables: string[];
  };
}

export function buildSiteCapabilityInstallRecord(
  siteId: string,
  enabledBy: string,
  pack: PackDatabaseContract,
): SiteCapabilityInstallRecord {
  return {
    siteId,
    capabilityId: pack.id,
    status: 'enabled',
    enabledBy,
    configuration: {
      manifestVersion: '1.0',
      source: 'capability-migration-apply',
      packId: pack.id,
      provides: [...pack.provides],
      requiredTables: [...new Set(pack.tables.map((table) => table.table))],
    },
  };
}

const OWNER_MANAGED_GRANTS: PackGrant[] = [
  { role: 'authenticated', privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { role: 'service_role', privileges: ['ALL'] },
];

const PUBLIC_READ_GRANTS: PackGrant[] = [
  { role: 'anon', privileges: ['SELECT'] },
  ...OWNER_MANAGED_GRANTS,
];

const PUBLIC_SUBMIT_GRANTS: PackGrant[] = [
  { role: 'anon', privileges: ['INSERT'] },
  ...OWNER_MANAGED_GRANTS,
];

const PUBLIC_SESSION_GRANTS: PackGrant[] = [
  { role: 'anon', privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  ...OWNER_MANAGED_GRANTS,
];


export const PACK_DATABASE_CONTRACTS: PackDatabaseContract[] = [
  {
    id: 'business_profile',
    dependsOn: [],
    provides: ['business_profile'],
    tables: [
      {
        table: 'businesses',
        ownershipColumn: 'owner_id',
        publicRead: true,
        publicInsert: false,
        grants: PUBLIC_READ_GRANTS,
      },
    ],
  },
  {
    id: 'catalog.services',
    dependsOn: ['business_profile'],
    provides: ['catalog.services'],
    tables: [
      {
        table: 'services',
        ownershipColumn: 'business_id',
        publicRead: true,
        publicInsert: false,
        grants: PUBLIC_READ_GRANTS,
      },
    ],
  },
  {
    id: 'crm.leads',
    dependsOn: ['business_profile'],
    provides: ['crm.leads', 'crm.contacts', 'forms.contact', 'forms.quote', 'notifications.email'],
    tables: [
      {
        table: 'crm_leads',
        ownershipColumn: 'business_id',
        publicRead: false,
        publicInsert: true,
        grants: PUBLIC_SUBMIT_GRANTS,
      },
      {
        table: 'crm_contacts',
        ownershipColumn: 'user_id',
        publicRead: false,
        publicInsert: false,
        grants: OWNER_MANAGED_GRANTS,
      },
      {
        table: 'crm_activities',
        ownershipColumn: 'business_id',
        publicRead: false,
        publicInsert: false,
        grants: OWNER_MANAGED_GRANTS,
      },
    ],
  },
  {
    id: 'booking.appointments',
    dependsOn: ['business_profile', 'catalog.services', 'crm.leads'],
    provides: ['booking.appointments'],
    tables: [
      {
        table: 'availability_slots',
        ownershipColumn: 'business_id',
        publicRead: true,
        publicInsert: false,
        grants: PUBLIC_READ_GRANTS,
      },
      {
        table: 'bookings',
        ownershipColumn: 'business_id',
        publicRead: false,
        publicInsert: false,
        grants: OWNER_MANAGED_GRANTS,
      },
    ],
  },
  {
    id: 'catalog.menu',
    dependsOn: ['business_profile'],
    provides: ['catalog.menu'],
    tables: [
      {
        table: 'menu_items',
        ownershipColumn: 'business_id',
        publicRead: true,
        publicInsert: false,
        grants: PUBLIC_READ_GRANTS,
      },
    ],
  },
  {
    id: 'catalog.products',
    dependsOn: ['business_profile'],
    provides: ['catalog.products'],
    tables: [
      {
        table: 'products',
        ownershipColumn: 'business_id',
        publicRead: true,
        publicInsert: false,
        grants: PUBLIC_READ_GRANTS,
      },
    ],
  },
  {
    id: 'commerce.cart',
    dependsOn: ['business_profile', 'catalog.products'],
    provides: ['commerce.cart'],
    tables: [
      {
        table: 'cart_items',
        ownershipColumn: 'user_id',
        publicRead: false,
        publicInsert: true,
        grants: PUBLIC_SESSION_GRANTS,
      },
    ],
  },
  {
    id: 'commerce.checkout',
    dependsOn: ['business_profile', 'catalog.products', 'commerce.cart', 'crm.leads'],
    provides: ['commerce.checkout'],
    tables: [
      {
        table: 'orders',
        ownershipColumn: 'business_id',
        publicRead: false,
        publicInsert: true,
        grants: PUBLIC_SUBMIT_GRANTS,
      },
    ],
  },
  {
    id: 'automation.follow_up',
    dependsOn: ['business_profile', 'crm.leads'],
    provides: ['automation.follow_up'],
    tables: [
      {
        table: 'crm_workflows',
        ownershipColumn: 'user_id',
        publicRead: false,
        publicInsert: false,
        grants: OWNER_MANAGED_GRANTS,
      },
      {
        table: 'crm_automations',
        ownershipColumn: 'user_id',
        publicRead: false,
        publicInsert: false,
        grants: OWNER_MANAGED_GRANTS,
      },
    ],
  },
];


const BY_PROVIDED = new Map<string, PackDatabaseContract>();
for (const pack of PACK_DATABASE_CONTRACTS) {
  for (const provided of [pack.id, ...pack.provides]) {
    if (!BY_PROVIDED.has(provided)) BY_PROVIDED.set(provided, pack);
  }
}

/** Dependency-first expansion, mirroring `resolveCapabilityPacks`. */
export function resolveDatabaseContracts(requested: string[]): {
  order: PackDatabaseContract[];
  unsupported: string[];
} {
  const order: PackDatabaseContract[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const unsupported: string[] = [];

  const visit = (capability: string): void => {
    const pack = BY_PROVIDED.get(capability);
    if (!pack) {
      if (!unsupported.includes(capability)) unsupported.push(capability);
      return;
    }
    if (placed.has(pack.id) || visiting.has(pack.id)) return;
    visiting.add(pack.id);
    for (const dependency of pack.dependsOn) visit(dependency);
    visiting.delete(pack.id);
    placed.add(pack.id);
    order.push(pack);
  };

  for (const capability of requested) visit(capability);
  return { order, unsupported };
}

// ============================================================================
// SQL generation (mirror of src/platform/core/capabilityMigrationSql.ts)
// ============================================================================

export type MigrationStatementKind = 'rls' | 'grant' | 'policy';

export interface MigrationStatement {
  id: string;
  kind: MigrationStatementKind;
  table: string;
  description: string;
  sql: string;
}

const PRIVILEGE_ORDER: PackPrivilege[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'];
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function assertIdentifier(value: string, what: string): string {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Unsafe ${what} in capability contract: ${value}`);
  }
  return value;
}

function formatPrivileges(grant: PackGrant): string {
  if (grant.privileges.includes('ALL')) return 'ALL';
  return PRIVILEGE_ORDER
    .filter((privilege) => privilege !== 'ALL' && grant.privileges.includes(privilege))
    .join(', ');
}

function ownershipPredicate(contract: PackTableContract): string | null {
  const column = contract.ownershipColumn;
  if (!column) return null;
  assertIdentifier(column, 'ownership column');
  if (column === 'business_id') return `public.is_business_member(${column})`;
  if (column === 'owner_id' || column === 'user_id') return `${column} = auth.uid()`;
  return null;
}

interface PolicySpec {
  name: string;
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  roles: string[];
  using?: string;
  withCheck?: string;
  description: string;
}

function policySpecs(contract: PackTableContract): PolicySpec[] {
  const table = contract.table;
  const owner = ownershipPredicate(contract);
  const specs: PolicySpec[] = [];

  if (contract.publicRead) {
    specs.push({
      name: `${table}_select_public`,
      command: 'SELECT',
      roles: ['anon', 'authenticated'],
      using: 'true',
      description: `Visitors can read ${table}.`,
    });
  } else if (owner) {
    specs.push({
      name: `${table}_select_member`,
      command: 'SELECT',
      roles: ['authenticated'],
      using: owner,
      description: `Only the owning business can read ${table}.`,
    });
  }

  if (contract.publicInsert) {
    const check = contract.ownershipColumn
      ? `${contract.ownershipColumn} IS NOT NULL`
      : 'true';
    specs.push({
      name: `${table}_insert_public_valid`,
      command: 'INSERT',
      roles: ['anon', 'authenticated'],
      withCheck: check,
      description: `Visitors can submit to ${table} without signing in.`,
    });
  } else if (owner) {
    specs.push({
      name: `${table}_insert_member`,
      command: 'INSERT',
      roles: ['authenticated'],
      withCheck: owner,
      description: `Only the owning business can create ${table} rows.`,
    });
  }

  if (owner) {
    specs.push({
      name: `${table}_update_member`,
      command: 'UPDATE',
      roles: ['authenticated'],
      using: owner,
      withCheck: owner,
      description: `Only the owning business can edit ${table}.`,
    });
    specs.push({
      name: `${table}_delete_member`,
      command: 'DELETE',
      roles: ['authenticated'],
      using: owner,
      description: `Only the owning business can delete from ${table}.`,
    });
  }

  return specs;
}

function policyStatement(contract: PackTableContract, spec: PolicySpec): MigrationStatement {
  const table = assertIdentifier(contract.table, 'table name');
  assertIdentifier(spec.name, 'policy name');

  const clauses = [
    `CREATE POLICY "${spec.name}" ON public.${table}`,
    `FOR ${spec.command}`,
    `TO ${spec.roles.join(', ')}`,
  ];
  if (spec.using) clauses.push(`USING (${spec.using})`);
  if (spec.withCheck) clauses.push(`WITH CHECK (${spec.withCheck})`);
  const create = clauses.join(' ');

  const sql = [
    'DO $$',
    'BEGIN',
    '  IF NOT EXISTS (',
    '    SELECT 1 FROM pg_policies',
    `    WHERE schemaname = 'public'`,
    `      AND tablename = '${table}'`,
    `      AND (policyname = '${spec.name}' OR cmd IN ('${spec.command}', 'ALL'))`,
    '  ) THEN',
    `    EXECUTE '${create.replace(/'/g, "''")}';`,
    '  END IF;',
    'END $$;',
  ].join('\n');

  return {
    id: `policy:${table}:${spec.name}`,
    kind: 'policy',
    table,
    description: spec.description,
    sql,
  };
}

export function statementsForTable(contract: PackTableContract): MigrationStatement[] {
  const table = assertIdentifier(contract.table, 'table name');
  const statements: MigrationStatement[] = [];

  for (const grant of contract.grants) {
    const privileges = formatPrivileges(grant);
    if (!privileges) continue;
    statements.push({
      id: `grant:${table}:${grant.role}`,
      kind: 'grant',
      table,
      description: `Give ${grant.role} ${privileges.toLowerCase()} access to ${table} through the data API.`,
      sql: `GRANT ${privileges} ON public.${table} TO ${grant.role};`,
    });
  }

  statements.push({
    id: `rls:${table}`,
    kind: 'rls',
    table,
    description: `Turn on row-level security for ${table}.`,
    sql: `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
  });

  for (const spec of policySpecs(contract)) {
    statements.push(policyStatement(contract, spec));
  }

  return statements;
}

export interface CapabilityMigration {
  statements: MigrationStatement[];
  sql: string;
  tables: string[];
}

/** Builds the executable migration for a dependency-ordered contract set. */
export function buildContractMigration(packs: PackDatabaseContract[]): CapabilityMigration {
  const statements: MigrationStatement[] = [];
  const seen = new Set<string>();
  const tables: string[] = [];

  for (const pack of packs) {
    for (const contract of pack.tables) {
      if (tables.includes(contract.table)) continue;
      tables.push(contract.table);
      for (const statement of statementsForTable(contract)) {
        if (seen.has(statement.id)) continue;
        seen.add(statement.id);
        statements.push(statement);
      }
    }
  }

  return { statements, sql: statements.map((s) => s.sql).join('\n\n'), tables };
}

/**
 * Last line of defence before execution. Every statement must be one the
 * generator itself produced for the approved capability set — anything else
 * (a client-supplied string, a model hallucination, a DROP) is rejected.
 */
export function assertExecutable(statement: MigrationStatement, allowed: MigrationStatement[]): void {
  const match = allowed.find((candidate) => candidate.id === statement.id);
  if (!match || match.sql !== statement.sql) {
    throw new Error(`Statement is not part of the approved capability migration: ${statement.id}`);
  }
  const forbidden = /\b(drop|truncate|revoke|delete\s+from|update\s+\w|insert\s+into|alter\s+database|alter\s+role|create\s+extension|grant\s+all\s+on\s+schema)\b/i;
  if (forbidden.test(statement.sql)) {
    throw new Error(`Statement contains a forbidden operation: ${statement.id}`);
  }
}
