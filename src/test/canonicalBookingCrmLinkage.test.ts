import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('canonicalBooking CRM linkage', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'supabase/functions/_shared/canonicalBooking.ts'),
    'utf8',
  );

  it('links a committed booking to a business-scoped CRM contact and activity', () => {
    expect(source).toContain('linkBookingToCrm');
    expect(source).toContain('createCrmContact');
    expect(source).toContain('createCrmActivity');
    expect(source).not.toContain('INSERT INTO public.crm_contacts');
    expect(source).not.toContain('INSERT INTO public.crm_activities');
  });

  it('never links a duplicate (idempotent-retry) booking to the CRM', () => {
    const callSite = source.slice(source.indexOf('if (!booking) throw new Error("BOOKING_RESULT_MISSING");'));
    expect(callSite).toContain('if (!booking.duplicate) {');
    expect(callSite.indexOf('if (!booking.duplicate) {')).toBeLessThan(callSite.indexOf('linkBookingToCrm('));
  });

  it('never lets a CRM linkage failure fail an already-committed booking', () => {
    const fn = source.slice(source.indexOf('async function linkBookingToCrm'));
    expect(fn).toContain('try {');
    expect(fn).toContain('} catch (error) {');
    expect(fn).toContain('console.error(');
    // The catch block must not re-throw.
    const catchBlock = fn.slice(fn.indexOf('} catch (error) {'), fn.indexOf('} catch (error) {') + 200);
    expect(catchBlock).not.toContain('throw');
  });

  it('creates a CRM lead inside the same atomic booking transaction', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261022155702_booking_crm_lead.sql'),
      'utf8',
    );
    expect(migration).toContain('CREATE TRIGGER bookings_create_crm_lead');
    expect(migration).toContain('AFTER INSERT ON public.bookings');
    expect(migration).toContain('INSERT INTO public.crm_leads');
    expect(migration).toContain("'booking.create'");
    expect(migration).toContain("'booking_id', NEW.id");
  });
});
