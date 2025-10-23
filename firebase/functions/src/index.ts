import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { DateTime, Interval } from 'luxon';
import fetch from 'node-fetch';
import { google } from 'googleapis';

// Inicializamos Firebase admin una sola vez.
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const TIMEZONE = 'Europe/Madrid';
const SLOT_INTERVAL_MINUTES = 5;
const EMPLOYEES = [
  { id: 'david', name: 'David' },
  { id: 'marta', name: 'Marta' },
];

type ServiceDefinition = {
  id: string;
  name: string;
  duration: number;
  price: number;
};

type BookingStatus = 'active' | 'cancelled';

type Booking = {
  id?: string;
  clientName: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  employeeId: string;
  startTime: admin.firestore.Timestamp;
  endTime: admin.firestore.Timestamp;
  status: BookingStatus;
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
  googleEventId?: string | null;
};

const SERVICES: ServiceDefinition[] = [
  { id: 'haircut', name: 'Corte Pelo', duration: 30, price: 18 },
  { id: 'haircut_beard', name: 'Corte+Barba', duration: 45, price: 25 },
  { id: 'full_package', name: 'Corte+Barba+Ceja', duration: 55, price: 28 },
  { id: 'beard_only', name: 'Solo Barba', duration: 20, price: 12 },
  { id: 'brow_only', name: 'Solo Ceja', duration: 10, price: 8 },
  { id: 'thread_brow', name: 'Depilación Cejas hilo', duration: 10, price: 10 },
  { id: 'nostril', name: 'Depilación Narina', duration: 5, price: 8 },
  { id: 'ear', name: 'Depilación Oreja', duration: 5, price: 8 },
  { id: 'full_facial', name: 'Full Facial', duration: 20, price: 25 },
  { id: 'dye', name: 'Tinte', duration: 35, price: 12 },
  { id: 'straightening', name: 'Alisado', duration: 35, price: 12 },
];

const SERVICE_MAP = new Map(SERVICES.map((service) => [service.id, service]));

const WORKING_SHIFTS = [
  { start: { hour: 9, minute: 0 }, end: { hour: 13, minute: 0 } },
  { start: { hour: 16, minute: 0 }, end: { hour: 20, minute: 0 } },
];

const BOOKINGS_COLLECTION = 'bookings';

interface BookingRepository {
  listActiveBookingsForDate(
    dateIso: string,
    employeeIds: string[],
  ): Promise<Array<Booking & { id: string }>>;
  createBooking(data: Omit<Booking, 'id'>): Promise<string>;
  getBookingById(id: string): Promise<(Booking & { id: string }) | null>;
  updateBooking(id: string, data: Partial<Booking>): Promise<void>;
}

type CalendarSyncAction = 'create' | 'delete';

type CalendarSyncFn = (
  action: CalendarSyncAction,
  booking: Booking & { id: string },
) => Promise<string | void>;

class FirestoreBookingRepository implements BookingRepository {
  constructor(private readonly firestore: admin.firestore.Firestore) {}

  async listActiveBookingsForDate(
    dateIso: string,
    employeeIds: string[],
  ): Promise<Array<Booking & { id: string }>> {
    const start = DateTime.fromISO(dateIso, { zone: TIMEZONE }).startOf('day');
    const end = start.endOf('day');
    let query: FirebaseFirestore.Query = this.firestore
      .collection(BOOKINGS_COLLECTION)
      .where('status', '==', 'active')
      .where('startTime', '>=', admin.firestore.Timestamp.fromDate(start.toJSDate()))
      .where('startTime', '<=', admin.firestore.Timestamp.fromDate(end.toJSDate()));

    if (employeeIds.length === 1) {
      query = query.where('employeeId', '==', employeeIds[0]);
    }

    const snapshot = await query.get();
    return snapshot.docs
      .filter((doc) => employeeIds.includes(doc.get('employeeId')))
      .map((doc) => ({ id: doc.id, ...(doc.data() as Booking) }));
  }

  async createBooking(data: Omit<Booking, 'id'>): Promise<string> {
    const docRef = await this.firestore.collection(BOOKINGS_COLLECTION).add({
      ...data,
    });
    return docRef.id;
  }

  async getBookingById(id: string): Promise<(Booking & { id: string }) | null> {
    const doc = await this.firestore.collection(BOOKINGS_COLLECTION).doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...(doc.data() as Booking) };
  }

  async updateBooking(id: string, data: Partial<Booking>): Promise<void> {
    await this.firestore.collection(BOOKINGS_COLLECTION).doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

const isValidPhone = (phone: string): boolean => /^\+[1-9]\d{6,14}$/.test(phone);

const getEmployee = (employeeId: string) =>
  EMPLOYEES.find((employee) => employee.id === employeeId);

const nowMadrid = () => DateTime.now().setZone(TIMEZONE);

const ensureService = (serviceId: string): ServiceDefinition => {
  const service = SERVICE_MAP.get(serviceId);
  if (!service) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Servicio no soportado: ${serviceId}`,
    );
  }
  return service;
};

const calculateAvailability = (
  dateIso: string,
  service: ServiceDefinition,
  bookings: Array<Booking & { id: string }>,
  employeeId: string,
) => {
  const day = DateTime.fromISO(dateIso, { zone: TIMEZONE });
  const duration = service.duration;
  const now = nowMadrid();
  const availability: Array<{ employeeId: string; startIso: string; endIso: string }> = [];

  const employeeBookings = bookings
    .filter((booking) => booking.employeeId === employeeId)
    .map((booking) => ({
      start: DateTime.fromJSDate(booking.startTime.toDate()).setZone(TIMEZONE),
      end: DateTime.fromJSDate(booking.endTime.toDate()).setZone(TIMEZONE),
    }));

  for (const shift of WORKING_SHIFTS) {
    const shiftStart = day.set(shift.start);
    const shiftEnd = day.set(shift.end);
    let cursor = shiftStart;

    while (cursor.plus({ minutes: duration }) <= shiftEnd) {
      const slot = Interval.fromDateTimes(cursor, cursor.plus({ minutes: duration }));
      const overlaps = employeeBookings.some((booking) =>
        slot.overlaps(Interval.fromDateTimes(booking.start, booking.end)),
      );
      const slotInPast = slot.end <= now;

      if (!overlaps && !slotInPast) {
        availability.push({
          employeeId,
          startIso: slot.start.toISO(),
          endIso: slot.end.toISO(),
        });
      }

      cursor = cursor.plus({ minutes: SLOT_INTERVAL_MINUTES });
    }
  }

  return availability;
};

class BookingService {
  constructor(
    private readonly repository: BookingRepository,
    private readonly calendarSync: CalendarSyncFn,
  ) {}

  async getAvailableSlots(args: {
    date: string;
    employee?: string;
    service: string;
  }): Promise<Array<{ employeeId: string; startIso: string; endIso: string }>> {
    if (!args.date) {
      throw new functions.https.HttpsError('invalid-argument', 'La fecha es obligatoria.');
    }
    if (!args.service) {
      throw new functions.https.HttpsError('invalid-argument', 'El servicio es obligatorio.');
    }

    const day = DateTime.fromISO(args.date, { zone: TIMEZONE });
    if (!day.isValid) {
      throw new functions.https.HttpsError('invalid-argument', 'Fecha inválida.');
    }

    const service = ensureService(args.service);

    const employees = args.employee
      ? [args.employee]
      : EMPLOYEES.map((employee) => employee.id);

    employees.forEach((employeeId) => {
      if (!getEmployee(employeeId)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Empleado no válido: ${employeeId}`,
        );
      }
    });

    const bookings = await this.repository.listActiveBookingsForDate(args.date, employees);
    return employees.flatMap((employeeId) =>
      calculateAvailability(args.date, service, bookings, employeeId),
    );
  }

  async createBooking(args: {
    clientName: string;
    phone: string;
    service: string;
    employee: string;
    startIso: string;
  }): Promise<{ bookingId: string }>
  async createBooking(args: {
    clientName: string;
    phone: string;
    service: string;
    employee: string;
    startIso: string;
  }): Promise<{ bookingId: string }> {
    const { clientName, phone, service: serviceId, employee, startIso } = args;

    if (!clientName?.trim()) {
      throw new functions.https.HttpsError('invalid-argument', 'El nombre es obligatorio.');
    }

    if (!isValidPhone(phone)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'El teléfono debe estar en formato E.164.',
      );
    }

    const service = ensureService(serviceId);
    const employeeInfo = getEmployee(employee);
    if (!employeeInfo) {
      throw new functions.https.HttpsError('invalid-argument', 'Empleado no encontrado.');
    }

    const start = DateTime.fromISO(startIso, { zone: TIMEZONE });
    if (!start.isValid) {
      throw new functions.https.HttpsError('invalid-argument', 'Fecha de inicio inválida.');
    }

    const end = start.plus({ minutes: service.duration });

    const validShift = WORKING_SHIFTS.some((shift) => {
      const shiftStart = start.set(shift.start);
      const shiftEnd = start.set(shift.end);
      return start >= shiftStart && end <= shiftEnd;
    });

    if (!validShift) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'La cita no encaja en el horario laboral.',
      );
    }

    if (end <= nowMadrid()) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No se pueden crear citas en el pasado.',
      );
    }

    const bookings = await this.repository.listActiveBookingsForDate(start.toISODate(), [employee]);
    const overlaps = bookings.some((booking) => {
      const existing = Interval.fromDateTimes(
        DateTime.fromJSDate(booking.startTime.toDate()).setZone(TIMEZONE),
        DateTime.fromJSDate(booking.endTime.toDate()).setZone(TIMEZONE),
      );
      const candidate = Interval.fromDateTimes(start, end);
      return existing.overlaps(candidate);
    });

    if (overlaps) {
      throw new functions.https.HttpsError(
        'already-exists',
        'El horario seleccionado ya está reservado.',
      );
    }

    const bookingData: Omit<Booking, 'id'> = {
      clientName: clientName.trim(),
      phone,
      serviceId: service.id,
      serviceName: service.name,
      durationMinutes: service.duration,
      employeeId: employeeInfo.id,
      startTime: admin.firestore.Timestamp.fromDate(start.toJSDate()),
      endTime: admin.firestore.Timestamp.fromDate(end.toJSDate()),
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      googleEventId: null,
    };

    const bookingId = await this.repository.createBooking(bookingData);
    const bookingForSync: Booking & { id: string } = {
      ...bookingData,
      id: bookingId,
    };

    const eventId = await this.calendarSync('create', bookingForSync);
    if (eventId) {
      await this.repository.updateBooking(bookingId, {
        googleEventId: eventId,
      } as Partial<Booking>);
    }

    return { bookingId };
  }

  async cancelBooking(args: { bookingId: string }): Promise<void> {
    if (!args.bookingId) {
      throw new functions.https.HttpsError('invalid-argument', 'El ID es obligatorio.');
    }

    const booking = await this.repository.getBookingById(args.bookingId);
    if (!booking) {
      throw new functions.https.HttpsError('not-found', 'Reserva no encontrada.');
    }

    if (booking.status === 'cancelled') {
      return;
    }

    await this.repository.updateBooking(args.bookingId, {
      status: 'cancelled',
    });

    await this.calendarSync('delete', booking);
  }
}

const syncGoogleCalendar: CalendarSyncFn = async (action, booking) => {
  const calendarId = process.env.GOOGLE_CAL_ID;
  const serviceAccountJson = process.env.GOOGLE_KEY_JSON;

  if (!calendarId || !serviceAccountJson) {
    console.warn('Google Calendar no configurado, se omite sincronización.');
    return;
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  const calendar = google.calendar({ version: 'v3', auth });

  if (action === 'create') {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `${booking.serviceName} - ${booking.clientName}`,
        description: `Teléfono: ${booking.phone}`,
        start: {
          dateTime: booking.startTime.toDate().toISOString(),
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: booking.endTime.toDate().toISOString(),
          timeZone: TIMEZONE,
        },
        attendees: [
          {
            email: `${booking.employeeId}@example.com`,
            displayName: booking.employeeId,
          },
        ],
      },
    });
    return response.data.id ?? undefined;
  }

  if (action === 'delete' && booking.googleEventId) {
    await calendar.events.delete({
      calendarId,
      eventId: booking.googleEventId,
    });
  }
};

const repository = new FirestoreBookingRepository(db);
const bookingService = new BookingService(repository, syncGoogleCalendar);

export const getAvailableSlots = functions.https.onCall((data) =>
  bookingService.getAvailableSlots({
    date: data.date,
    employee: data.employee,
    service: data.service,
  }),
);

export const createBooking = functions.https.onCall((data) =>
  bookingService.createBooking({
    clientName: data.clientName,
    phone: data.phone,
    service: data.service,
    employee: data.employee,
    startIso: data.startIso,
  }),
);

export const cancelBooking = functions.https.onCall((data) =>
  bookingService.cancelBooking({
    bookingId: data.bookingId,
  }),
);

export const webhookVerifyWhatsApp = functions.https.onRequest(async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
    return;
  }

  if (req.method === 'POST') {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    if (message && message.from) {
      const reply = {
        messaging_product: 'whatsapp',
        to: message.from,
        type: 'text',
        text: {
          preview_url: false,
          body: '¡Gracias por contactar con Barbería David Martín! Usa nuestro enlace para reservar: https://peluqueria-david-martin.web.app',
        },
      };
      await fetch(
        `https://graph.facebook.com/v19.0/${process.env.META_PHONE_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.META_TOKEN}`,
          },
          body: JSON.stringify(reply),
        },
      );
    }
    res.status(200).json({ received: true });
    return;
  }

  res.status(405).send('Method Not Allowed');
});

export const webhookTwilioVoice = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const event = req.body;

  switch (event.event) {
    case 'connected':
      console.log('Stream conectado', event.streamSid);
      break;
    case 'media':
      // Aquí se podría enviar audio a OpenAI + ElevenLabs.
      break;
    case 'stop':
      console.log('Stream finalizado', event.streamSid);
      break;
    default:
      console.log('Evento Twilio no reconocido', event.event);
  }

  res.status(200).send('ok');
});

export { BookingService, FirestoreBookingRepository, calculateAvailability, SERVICES, EMPLOYEES };
