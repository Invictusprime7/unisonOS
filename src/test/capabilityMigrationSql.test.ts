import { describe, it, expect } from 'vitest';
import {
  buildCapabilityMigration,
  statementsForTable,
} from '@/platform/core/capabilityMigrationSql';
import { CAPABILITY_PACKS, resolveCapabilityPacks } from '@/platform/core/capabilityPacks';
import {
  buildContractMigration,
  buildSiteCapabilityInstallRecord,
  resolveDatabaseContracts,
  assertExecutable,
} from '../../supabase/functions/_shared/capabilityPackContracts';

describe('capability migration SQL', () => {
  it('emits grants, RLS and policies in apply order for a table', () => {
    const statements = statementsForTable({
      table: 'services',
      purpose: 'test',
      requiredColumns: [],
      ownershipColumn: 'business_id',
      publicRead: true,
      publicInsert: false,
      policies: [],
      grants: [
        { role: 'anon', privileges: ['SELECT'] },
        { role: 'service_role', privileges: ['ALL'] },
      ],
    });

    expect(statements.map((s) => s.kind)).toEqual([
      'grant', 'grant', 'rls', 'policy', 'policy', 'policy', 'policy',
    ]);
    expect(statements[0].sql).toBe('GRANT SELECT ON public.services TO anon;');
    expect(statements[1].sql).toBe('GRANT ALL ON public.services TO service_role;');
    expect(statements[2].sql).toBe('ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;');
  });

  it('scopes business-owned tables through the security-definer membership check', () => {
    const migration = buildCapabilityMigration(resolveCapabilityPacks(['catalog.services']).order);
    const policies = migration.statements.filter((s) => s.kind === 'policy');
    expect(policies.some((s) => s.sql.includes('public.is_business_member(business_id)'))).toBe(true);
    expect(policies.every((s) => !s.sql.includes('USING (true) WITH CHECK (true)'))).toBe(true);
  });

  it('never widens anon beyond what the contract allows', () => {
    const migration = buildCapabilityMigration(CAPABILITY_PACKS);
    const anonGrants = migration.statements.filter(
      (s) => s.kind === 'grant' && s.sql.includes('TO anon'),
    );
    for (const grant of anonGrants) {
      // anon may get explicit DML on its own rows, but never blanket ALL.
      expect(grant.sql).toMatch(/^GRANT (SELECT|INSERT)(, (INSERT|UPDATE|DELETE))* ON/);
      expect(grant.sql).not.toContain('GRANT ALL');
    }

    // Canonical public submit tables must not become publicly readable.
    const leadReads = migration.statements.filter(
      (s) => s.table === 'crm_leads' && s.kind === 'policy' && s.sql.includes('FOR SELECT'),
    );
    expect(leadReads.every((s) => !s.sql.includes('anon'))).toBe(true);
    expect(migration.tables).not.toContain('leads');
  });

  it('guards every policy so re-applying a pack is a no-op', () => {
    const migration = buildCapabilityMigration(CAPABILITY_PACKS);
    for (const statement of migration.statements.filter((s) => s.kind === 'policy')) {
      expect(statement.sql).toContain('IF NOT EXISTS (');
      expect(statement.sql).toContain('FROM pg_policies');
    }
  });

  it('contains no destructive statements for any pack', () => {
    const migration = buildCapabilityMigration(CAPABILITY_PACKS);
    expect(migration.sql).not.toMatch(/\b(DROP|TRUNCATE|REVOKE|DELETE FROM|ALTER DATABASE)\b/i);
  });

  it('rejects statements that were not generated from the contracts', () => {
    const migration = buildContractMigration(resolveDatabaseContracts(['catalog.services']).order);
    expect(() =>
      assertExecutable(
        { id: 'grant:services:anon', kind: 'grant', table: 'services', description: '', sql: 'DROP TABLE public.services;' },
        migration.statements,
      ),
    ).toThrow(/not part of the approved/);
    expect(() =>
      assertExecutable(
        { id: 'evil', kind: 'grant', table: 'services', description: '', sql: 'GRANT ALL ON public.services TO anon;' },
        migration.statements,
      ),
    ).toThrow();
  });
});

describe('server mirror stays in sync with the client contracts', () => {
  const capabilitySets = [
    ['business_profile'],
    ['catalog.services'],
    ['crm.leads'],
    ['booking.appointments'],
    ['booking.appointments', 'catalog.services'],
  ];

  for (const capabilities of capabilitySets) {
    it(`produces identical SQL for ${capabilities.join(' + ')}`, () => {
      const client = buildCapabilityMigration(
        resolveCapabilityPacks(capabilities as never).order,
      );
      const server = buildContractMigration(resolveDatabaseContracts(capabilities).order);
      expect(server.tables).toEqual(client.tables);
      expect(server.statements.map((s) => s.id)).toEqual(client.statements.map((s) => s.id));
      expect(server.sql).toBe(client.sql);
    });
  }

  it('resolves dependencies in the same order on both sides', () => {
    const client = resolveCapabilityPacks(['booking.appointments']).order.map((p) => p.id);
    const server = resolveDatabaseContracts(['booking.appointments']).order.map((p) => p.id);
    expect(server).toEqual(client);
  });

  it('reports unsupported capabilities instead of guessing', () => {
    const { order, unsupported } = resolveDatabaseContracts(['not.a.capability']);
    expect(order).toEqual([]);
    expect(unsupported).toEqual(['not.a.capability']);
  });

  it('builds site installation records from canonical packs, not client configuration', () => {
    const { order } = resolveDatabaseContracts(['booking.appointments']);
    const pack = order.find((candidate) => candidate.id === 'booking.appointments');
    expect(pack).toBeDefined();
    if (!pack) throw new Error('Booking pack was not resolved');

    expect(buildSiteCapabilityInstallRecord('site-1', 'owner-1', pack)).toMatchObject({
      siteId: 'site-1',
      capabilityId: 'booking.appointments',
      status: 'enabled',
      enabledBy: 'owner-1',
      configuration: {
        manifestVersion: '1.0',
        source: 'capability-migration-apply',
        packId: 'booking.appointments',
        requiredTables: expect.arrayContaining(['bookings']),
      },
    });
  });
});
