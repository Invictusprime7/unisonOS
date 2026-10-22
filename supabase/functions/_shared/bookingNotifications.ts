export type BookingEmailStatus = 'sent' | 'unconfigured' | 'failed' | 'not_configured' | 'disabled' | 'duplicate';

export interface BookingNotificationInput {
  businessId: string;
  ownerEmail?: string | null;
  ownerNotificationsDisabled?: boolean;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
  serviceName: string;
  startsAt: string;
  bookingId: string;
  notes?: string | null;
  duplicate?: boolean;
}

export interface BookingNotificationResult {
  customer: BookingEmailStatus;
  owner: BookingEmailStatus;
}

export type SendBookingEmail = (message: {
  template: 'booking_confirm_email' | 'booking_owner_notification';
  to: string;
  businessId: string;
  context: Record<string, unknown>;
}) => Promise<BookingEmailStatus>;

export async function dispatchBookingNotifications(
  input: BookingNotificationInput,
  send: SendBookingEmail,
): Promise<BookingNotificationResult> {
  if (input.duplicate) return { customer: 'duplicate', owner: 'duplicate' };

  const context = {
    contactName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone ?? '',
    service: input.serviceName,
    scheduledAt: input.startsAt,
    bookingId: input.bookingId,
    notes: input.notes ?? '',
  };
  const customerPromise = send({
    template: 'booking_confirm_email',
    to: input.customerEmail,
    businessId: input.businessId,
    context,
  }).catch((): BookingEmailStatus => 'failed');
  const ownerPromise = input.ownerNotificationsDisabled
    ? Promise.resolve<BookingEmailStatus>('disabled')
    : input.ownerEmail?.trim()
    ? send({
        template: 'booking_owner_notification',
        to: input.ownerEmail.trim(),
        businessId: input.businessId,
        context,
      }).catch((): BookingEmailStatus => 'failed')
    : Promise.resolve<BookingEmailStatus>('not_configured');

  const [customer, owner] = await Promise.all([customerPromise, ownerPromise]);
  return { customer, owner };
}