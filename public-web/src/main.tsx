import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const SERVICES = [
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

const EMPLOYEES = [
  { id: 'david', name: 'David' },
  { id: 'marta', name: 'Marta' },
];

type Slot = {
  employeeId: string;
  startIso: string;
  endIso: string;
};

const App = () => {
  const [service, setService] = useState(SERVICES[0].id);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [employee, setEmployee] = useState<string>('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceOptions = useMemo(() => SERVICES, []);

  useEffect(() => {
    setSlots([]);
    setSelectedSlot(null);
  }, [service, date, employee]);

  const fetchSlots = async () => {
    try {
      setLoadingSlots(true);
      setError(null);
      const callable = httpsCallable(functions, 'getAvailableSlots');
      const result = await callable({
        date,
        service,
        employee: employee || undefined,
      });
      const data = result.data as { employeeId: string; startIso: string; endIso: string }[];
      setSlots(data);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los huecos.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const createBooking = async () => {
    if (!selectedSlot) {
      setError('Selecciona un horario.');
      return;
    }
    try {
      setError(null);
      setMessage(null);
      const callable = httpsCallable(functions, 'createBooking');
      await callable({
        clientName,
        phone,
        service,
        employee: selectedSlot.employeeId,
        startIso: selectedSlot.startIso,
      });
      setMessage('Reserva confirmada. ¡Te esperamos!');
      setClientName('');
      setPhone('');
      setSlots([]);
      setSelectedSlot(null);
    } catch (err) {
      console.error(err);
      setError('No se pudo crear la reserva. Revisa los datos.');
    }
  };

  return (
    <div
      style={{
        fontFamily: 'inherit',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '420px',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#0f172a' }}>
        Reserva en Barbería David Martín
      </h1>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Servicio
        <select
          value={service}
          onChange={(event) => setService(event.target.value)}
          style={{
            marginTop: '0.25rem',
            width: '100%',
            padding: '0.5rem',
            borderRadius: '8px',
            border: '1px solid #cbd5f5',
          }}
        >
          {serviceOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} – {option.duration} min
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Fecha
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          style={{
            marginTop: '0.25rem',
            width: '100%',
            padding: '0.5rem',
            borderRadius: '8px',
            border: '1px solid #cbd5f5',
          }}
        />
      </label>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Profesional (opcional)
        <select
          value={employee}
          onChange={(event) => setEmployee(event.target.value)}
          style={{
            marginTop: '0.25rem',
            width: '100%',
            padding: '0.5rem',
            borderRadius: '8px',
            border: '1px solid #cbd5f5',
          }}
        >
          <option value="">Cualquiera</option>
          {EMPLOYEES.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={fetchSlots}
        disabled={loadingSlots}
        style={{
          width: '100%',
          marginTop: '0.75rem',
          padding: '0.75rem',
          backgroundColor: '#f97316',
          color: '#fff',
          borderRadius: '9999px',
          border: 'none',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {loadingSlots ? 'Buscando huecos...' : 'Buscar disponibilidad'}
      </button>
      {slots.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
            Elige horario
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {slots.map((slot) => {
              const start = new Date(slot.startIso);
              const label = start.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const isSelected = selectedSlot?.startIso === slot.startIso;
              return (
                <button
                  key={`${slot.employeeId}-${slot.startIso}`}
                  onClick={() => setSelectedSlot(slot)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '9999px',
                    border: isSelected ? '2px solid #f97316' : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? '#fff7ed' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {label} · {EMPLOYEES.find((member) => member.id === slot.employeeId)?.name ?? ''}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {slots.length === 0 && !loadingSlots && (
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
          Selecciona un servicio y fecha para ver la disponibilidad.
        </p>
      )}
      {selectedSlot && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
            Tus datos
          </h3>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Nombre
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder="Nombre y apellidos"
              style={{
                marginTop: '0.25rem',
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #cbd5f5',
              }}
            />
          </label>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Teléfono (formato +34...)
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+34..."
              style={{
                marginTop: '0.25rem',
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #cbd5f5',
              }}
            />
          </label>
          <button
            onClick={createBooking}
            style={{
              width: '100%',
              marginTop: '0.75rem',
              padding: '0.75rem',
              backgroundColor: '#0ea5e9',
              color: '#fff',
              borderRadius: '9999px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Confirmar reserva
          </button>
        </div>
      )}
      {message && (
        <div style={{ marginTop: '1rem', color: '#15803d', fontSize: '0.875rem', fontWeight: 600 }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ marginTop: '1rem', color: '#dc2626', fontSize: '0.875rem', fontWeight: 600 }}>
          {error}
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
