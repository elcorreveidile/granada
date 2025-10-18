const SERVICES = [
  { name: 'Corte Pelo', duration: 30, price: 18 },
  { name: 'Corte+Barba', duration: 45, price: 25 },
  { name: 'Corte+Barba+Ceja', duration: 55, price: 28 },
  { name: 'Solo Barba', duration: 20, price: 12 },
  { name: 'Solo Ceja', duration: 10, price: 8 },
  { name: 'Depilación Cejas hilo', duration: 10, price: 10 },
  { name: 'Depilación Narina', duration: 5, price: 8 },
  { name: 'Depilación Oreja', duration: 5, price: 8 },
  { name: 'Full Facial', duration: 20, price: 25 },
  { name: 'Tinte', duration: 35, price: 12 },
  { name: 'Alisado', duration: 35, price: 12 },
];

const ServiceTable = () => (
  <div className="rounded-md bg-white p-4 shadow">
    <h2 className="mb-4 text-xl font-semibold">Servicios</h2>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-slate-600">
              Servicio
            </th>
            <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-slate-600">
              Duración
            </th>
            <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-slate-600">
              Precio
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {SERVICES.map((service) => (
            <tr key={service.name}>
              <td className="px-4 py-2 font-medium text-slate-800">{service.name}</td>
              <td className="px-4 py-2 text-slate-600">{service.duration} min</td>
              <td className="px-4 py-2 text-slate-600">{service.price.toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default ServiceTable;
