import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import esLocale from '@fullcalendar/core/locales/es';
import { signOut } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, firestore, functions } from '../firebase';
import ServiceTable from '../components/ServiceTable';

const COLOR_BY_EMPLOYEE: Record<string, string> = {
  david: '#0ea5e9',
  marta: '#f97316',
};

type BookingEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  employeeId: string;
  clientName: string;
  phone: string;
  serviceName: string;
};

const CalendarPage = () => {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<BookingEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bookingsRef = collection(firestore, 'bookings');
    const q = query(bookingsRef, where('status', '==', 'active'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const nextEvents: BookingEvent[] = snapshot.docs.map((doc) => {
          const data = doc.data() as DocumentData;
          const start = (data.startTime as Timestamp).toDate();
          const end = (data.endTime as Timestamp).toDate();
          return {
            id: doc.id,
            title: `${data.serviceName} - ${data.clientName}`,
            start,
            end,
            employeeId: data.employeeId,
            clientName: data.clientName,
            phone: data.phone,
            serviceName: data.serviceName,
          };
        });
        setEvents(nextEvents);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('No se pudieron cargar las reservas.');
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const calendarEvents = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        backgroundColor: COLOR_BY_EMPLOYEE[event.employeeId] ?? '#6366f1',
        borderColor: COLOR_BY_EMPLOYEE[event.employeeId] ?? '#6366f1',
      })),
    [events],
  );

  const cancelBooking = async (bookingId: string) => {
    try {
      setError(null);
      const callable = httpsCallable(functions, 'cancelBooking');
      await callable({ bookingId });
      setSelectedEvent(null);
    } catch (err) {
      console.error(err);
      setError('No se pudo cancelar la reserva.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-white p-4 shadow">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Agenda semanal – Barbería David Martín
          </h1>
          <p className="text-sm text-slate-500">Gestiona citas y servicios del equipo.</p>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
        >
          Salir
        </button>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 p-6 md:grid-cols-3">
        <section className="md:col-span-2">
          {loading ? (
            <div className="rounded-md bg-white p-6 text-center shadow">Cargando agenda...</div>
          ) : (
            <div className="overflow-hidden rounded-md bg-white p-4 shadow">
              <FullCalendar
                plugins={[timeGridPlugin]}
                initialView="timeGridWeek"
                locales={[esLocale]}
                locale="es"
                slotMinTime="09:00:00"
                slotMaxTime="20:00:00"
                events={calendarEvents}
                slotDuration="00:05:00"
                eventClick={(info) => {
                  const event = events.find((item) => item.id === info.event.id) ?? null;
                  setSelectedEvent(event);
                }}
                headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              />
            </div>
          )}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          {selectedEvent && (
            <div className="mt-6 rounded-md bg-white p-4 shadow">
              <h2 className="mb-2 text-lg font-semibold">Detalles de la cita</h2>
              <p className="text-sm text-slate-600">
                Cliente: <span className="font-medium text-slate-900">{selectedEvent.clientName}</span>
              </p>
              <p className="text-sm text-slate-600">
                Servicio: <span className="font-medium text-slate-900">{selectedEvent.serviceName}</span>
              </p>
              <p className="text-sm text-slate-600">
                Profesional:{' '}
                <span className="font-medium text-slate-900">{selectedEvent.employeeId}</span>
              </p>
              <p className="text-sm text-slate-600">
                Teléfono: <span className="font-medium text-slate-900">{selectedEvent.phone}</span>
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => cancelBooking(selectedEvent.id)}
                  className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                >
                  Cancelar cita
                </button>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="space-y-6">
          <ServiceTable />
          <div className="rounded-md bg-white p-4 shadow">
            <h2 className="mb-2 text-lg font-semibold">Leyenda</h2>
            <ul className="space-y-1 text-sm text-slate-600">
              <li>
                <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#0ea5e9' }} />
                David
              </li>
              <li>
                <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#f97316' }} />
                Marta
              </li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default CalendarPage;
