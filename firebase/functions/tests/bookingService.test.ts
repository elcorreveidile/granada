import { DateTime } from 'luxon';
import * as admin from 'firebase-admin';
import {
  BookingService,
  calculateAvailability,
  EMPLOYEES,
  SERVICES,
} from '../src/index';

type BookingRecord = {
  id: string;
  employeeId: string;
  start: DateTime;
  end: DateTime;
  data: any;
};

const fakeTimestamp = (date: Date): admin.firestore.Timestamp => ({
  toDate: () => date,
  isEqual: () => false,
} as unknown as admin.firestore.Timestamp);

describe('BookingService', () => {
  const service = SERVICES[0];
  const employee = EMPLOYEES[0];
  const day = DateTime.now().setZone('Europe/Madrid').plus({ days: 1 }).startOf('day');

  const repositoryFactory = () => {
    const bookings: BookingRecord[] = [];
    return {
      bookings,
      repository: {
        async listActiveBookingsForDate(dateIso: string, employeeIds: string[]) {
          return bookings
            .filter(
              (booking) =>
                booking.start.toISODate() === dateIso && employeeIds.includes(booking.employeeId),
            )
            .map((booking) => ({
              id: booking.id,
              employeeId: booking.employeeId,
              startTime: fakeTimestamp(booking.start.toJSDate()),
              endTime: fakeTimestamp(booking.end.toJSDate()),
              status: 'active',
              ...booking.data,
            }));
        },
        async createBooking(data: any) {
          const id = `booking_${bookings.length + 1}`;
          bookings.push({
            id,
            employeeId: data.employeeId,
            start: DateTime.fromJSDate(data.startTime.toDate()).setZone('Europe/Madrid'),
            end: DateTime.fromJSDate(data.endTime.toDate()).setZone('Europe/Madrid'),
            data,
          });
          return id;
        },
        async getBookingById(id: string) {
          const booking = bookings.find((item) => item.id === id);
          return (
            booking && {
              id: booking.id,
              employeeId: booking.employeeId,
              startTime: fakeTimestamp(booking.start.toJSDate()),
              endTime: fakeTimestamp(booking.end.toJSDate()),
              status: booking.data.status,
              googleEventId: booking.data.googleEventId,
              ...booking.data,
            }
          );
        },
        async updateBooking(id: string, data: any) {
          const booking = bookings.find((item) => item.id === id);
          if (booking) {
            booking.data = { ...booking.data, ...data };
          }
        },
      },
    };
  };

  beforeAll(() => {
    jest.spyOn(admin.firestore.FieldValue, 'serverTimestamp').mockImplementation(
      () => 'serverTimestamp' as unknown as admin.firestore.FieldValue,
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('calcula huecos disponibles excluyendo reservas existentes', async () => {
    const { bookings, repository } = repositoryFactory();
    const existingStart = day.set({ hour: 9, minute: 0 });
    bookings.push({
      id: 'existing',
      employeeId: employee.id,
      start: existingStart,
      end: existingStart.plus({ minutes: service.duration }),
      data: { status: 'active' },
    });
    const fakeSync = jest.fn();
    const bookingService = new BookingService(repository as any, fakeSync as any);
    const slots = await bookingService.getAvailableSlots({
      date: day.toISODate(),
      service: service.id,
      employee: employee.id,
    });
    expect(slots.some((slot) => DateTime.fromISO(slot.startIso).hour === 9)).toBe(false);
  });

  it('crea una reserva válida y sincroniza calendario', async () => {
    const { repository } = repositoryFactory();
    const fakeSync = jest.fn().mockResolvedValue('event_1');
    const bookingService = new BookingService(repository as any, fakeSync as any);
    const startIso = day.set({ hour: 10 }).toISO();
    const result = await bookingService.createBooking({
      clientName: 'Juan Pérez',
      phone: '+34600111222',
      service: service.id,
      employee: employee.id,
      startIso,
    });
    expect(result.bookingId).toBeDefined();
    expect(fakeSync).toHaveBeenCalledWith(
      'create',
      expect.objectContaining({ clientName: 'Juan Pérez' }),
    );
  });

  it('cancela una reserva existente', async () => {
    const { bookings, repository } = repositoryFactory();
    const start = day.set({ hour: 11 });
    bookings.push({
      id: 'booking_1',
      employeeId: employee.id,
      start,
      end: start.plus({ minutes: service.duration }),
      data: {
        status: 'active',
        googleEventId: 'event_123',
      },
    });
    const fakeSync = jest.fn();
    const bookingService = new BookingService(repository as any, fakeSync as any);
    await bookingService.cancelBooking({ bookingId: 'booking_1' });
    expect(bookings[0].data.status).toBe('cancelled');
    expect(fakeSync).toHaveBeenCalledWith('delete', expect.objectContaining({ id: 'booking_1' }));
  });
});
