import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-functions.js';

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

const createFirebaseFunctions = () => {
  const config = window.DM_WIDGET_CONFIG;
  if (!config) {
    throw new Error('Debes definir window.DM_WIDGET_CONFIG con credenciales de Firebase.');
  }
  const app = initializeApp(config.firebaseConfig);
  return getFunctions(app, config.region ?? 'europe-west1');
};

const functions = createFirebaseFunctions();

const App = () => {
  const [service, setService] = useState(SERVICES[0].id);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [employee, setEmployee] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const serviceOptions = useMemo(() => SERVICES, []);

  useEffect(() => {
    setSlots([]);
    setSelectedSlot(null);
  }, [service, date, employee]);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      setError(null);
      const callable = httpsCallable(functions, 'getAvailableSlots');
      const result = await callable({ date, service, employee: employee || undefined });
      setSlots(result.data ?? []);
    } catch (err) {
      console.error(err);
      setError('No hay disponibilidad.');
    } finally {
      setLoading(false);
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
      setMessage('Reserva confirmada.');
      setSlots([]);
      setClientName('');
      setPhone('');
      setSelectedSlot(null);
    } catch (err) {
      console.error(err);
      setError('No se pudo crear la reserva.');
    }
  };

  return (
    React.createElement(
      'div',
      {
        style: {
          fontFamily: 'Inter, system-ui, sans-serif',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          maxWidth: '420px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
        },
      },
      React.createElement(
        'h1',
        { style: { fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' } },
        'Reserva en Barbería David Martín',
      ),
      React.createElement(
        'label',
        { style: { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' } },
        'Servicio',
        React.createElement(
          'select',
          {
            value: service,
            onChange: (event) => setService(event.target.value),
            style: {
              marginTop: '0.25rem',
              width: '100%',
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #cbd5f5',
            },
          },
          serviceOptions.map((option) =>
            React.createElement(
              'option',
              { key: option.id, value: option.id },
              `${option.name} – ${option.duration} min`,
            ),
          ),
        ),
      ),
      React.createElement(
        'label',
        { style: { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' } },
        'Fecha',
        React.createElement('input', {
          type: 'date',
          value: date,
          onChange: (event) => setDate(event.target.value),
          style: {
            marginTop: '0.25rem',
            width: '100%',
            padding: '0.5rem',
            borderRadius: '8px',
            border: '1px solid #cbd5f5',
          },
        }),
      ),
      React.createElement(
        'label',
        { style: { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' } },
        'Profesional (opcional)',
        React.createElement(
          'select',
          {
            value: employee,
            onChange: (event) => setEmployee(event.target.value),
            style: {
              marginTop: '0.25rem',
              width: '100%',
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #cbd5f5',
            },
          },
          React.createElement('option', { value: '' }, 'Cualquiera'),
          EMPLOYEES.map((member) =>
            React.createElement('option', { key: member.id, value: member.id }, member.name),
          ),
        ),
      ),
      React.createElement(
        'button',
        {
          onClick: fetchSlots,
          disabled: loading,
          style: {
            width: '100%',
            marginTop: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#f97316',
            color: '#fff',
            borderRadius: '9999px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          },
        },
        loading ? 'Buscando huecos...' : 'Buscar disponibilidad',
      ),
      slots.length > 0
        ? React.createElement(
            'div',
            { style: { marginTop: '1.5rem' } },
            React.createElement(
              'h2',
              { style: { fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' } },
              'Elige horario',
            ),
            React.createElement(
              'div',
              { style: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' } },
              slots.map((slot) => {
                const start = new Date(slot.startIso);
                const label = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const isSelected = selectedSlot && selectedSlot.startIso === slot.startIso;
                return React.createElement(
                  'button',
                  {
                    key: `${slot.employeeId}-${slot.startIso}`,
                    onClick: () => setSelectedSlot(slot),
                    style: {
                      padding: '0.5rem 0.75rem',
                      borderRadius: '9999px',
                      border: isSelected ? '2px solid #f97316' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#fff7ed' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    },
                  },
                  `${label} · ${EMPLOYEES.find((member) => member.id === slot.employeeId)?.name ?? ''}`,
                );
              }),
            ),
          )
        : React.createElement(
            'p',
            { style: { marginTop: '1rem', fontSize: '0.875rem', color: '#64748b' } },
            'Selecciona un servicio y fecha para ver la disponibilidad.',
          ),
      selectedSlot &&
        React.createElement(
          'div',
          { style: { marginTop: '1.5rem' } },
          React.createElement(
            'h3',
            { style: { fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' } },
            'Tus datos',
          ),
          React.createElement(
            'label',
            { style: { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' } },
            'Nombre',
            React.createElement('input', {
              value: clientName,
              onChange: (event) => setClientName(event.target.value),
              placeholder: 'Nombre y apellidos',
              style: {
                marginTop: '0.25rem',
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #cbd5f5',
              },
            }),
          ),
          React.createElement(
            'label',
            { style: { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' } },
            'Teléfono (formato +34...)',
            React.createElement('input', {
              value: phone,
              onChange: (event) => setPhone(event.target.value),
              placeholder: '+34...',
              style: {
                marginTop: '0.25rem',
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #cbd5f5',
              },
            }),
          ),
          React.createElement(
            'button',
            {
              onClick: createBooking,
              style: {
                width: '100%',
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: '#0ea5e9',
                color: '#fff',
                borderRadius: '9999px',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              },
            },
            'Confirmar reserva',
          ),
        ),
      message &&
        React.createElement(
          'div',
          { style: { marginTop: '1rem', color: '#15803d', fontSize: '0.875rem', fontWeight: 600 } },
          message,
        ),
      error &&
        React.createElement(
          'div',
          { style: { marginTop: '1rem', color: '#dc2626', fontSize: '0.875rem', fontWeight: 600 } },
          error,
        ),
    )
  );
};

createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode, null, React.createElement(App)));
