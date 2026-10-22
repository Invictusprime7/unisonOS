import { describe, expect, it, vi } from 'vitest';
import { dispatchBookingNotifications } from '../../supabase/functions/_shared/bookingNotifications';

const booking = {
  businessId: 'business-1',
  ownerEmail: 'owner@example.test',
  customerEmail: 'customer@example.test',
  customerName: 'Sam Customer',
  customerPhone: '+1 555 0100',
  serviceName: 'Design consultation',
  startsAt: '2026-10-23T15:00:00.000Z',
  bookingId: 'booking-1',
  notes: 'Discuss a new site',
};

describe('booking notification dispatch', () => {
  it('sends customer and private owner notifications with server-committed booking details', async () => {
    const send = vi.fn(async () => 'sent' as const);
    const result = await dispatchBookingNotifications(booking, send);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      template: 'booking_confirm_email',
      to: booking.customerEmail,
      businessId: booking.businessId,
      context: expect.objectContaining({ bookingId: booking.bookingId, service: booking.serviceName }),
    }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      template: 'booking_owner_notification',
      to: booking.ownerEmail,
      businessId: booking.businessId,
      context: expect.objectContaining({ customerEmail: booking.customerEmail, notes: booking.notes }),
    }));
    expect(result).toEqual({ customer: 'sent', owner: 'sent' });
  });

  it('does not email twice on idempotent booking retries and reports missing owner routing', async () => {
    const send = vi.fn(async () => 'sent' as const);
    expect(await dispatchBookingNotifications({ ...booking, duplicate: true }, send))
      .toEqual({ customer: 'duplicate', owner: 'duplicate' });
    expect(send).not.toHaveBeenCalled();

    expect(await dispatchBookingNotifications({ ...booking, ownerEmail: null }, send))
      .toEqual({ customer: 'sent', owner: 'not_configured' });
    expect(await dispatchBookingNotifications({ ...booking, ownerNotificationsDisabled: true }, send))
      .toEqual({ customer: 'sent', owner: 'disabled' });
  });

  it('reports provider failures instead of changing a committed booking into success mail', async () => {
    const send = vi.fn(async () => 'failed' as const);
    expect(await dispatchBookingNotifications(booking, send))
      .toEqual({ customer: 'failed', owner: 'failed' });
  });
});