# Gestor de Citas Avanzado

Este repositorio contiene una implementación desde cero de un gestor de citas sencillo pero robusto. Incluye:

- Modelos de dominio (`Client` y `Appointment`).
- Servicio de negocio con validaciones de solapamientos y filtros de consulta.
- Persistencia ligera en ficheros JSON.
- Interfaz de línea de comandos para crear, listar y actualizar citas.
- Suite de pruebas con `pytest` que cubre la lógica central.

## Requisitos

- Python 3.10 o superior.
- `pip` para instalar dependencias opcionales de desarrollo.

## Instalación y uso

1. **Crear y activar un entorno virtual (recomendado):**

   ```bash
   python -m venv .venv
   source .venv/bin/activate      # Linux / macOS
   .\.venv\Scripts\activate      # Windows PowerShell
   ```

2. **Instalar dependencias:**

   ```bash
   python -m pip install --upgrade pip
   pip install -r requirements-dev.txt
   ```

3. **Consultar la ayuda general del CLI:**

   ```bash
   python -m gestor_citas_avanzado.cli --help
   ```

4. **Ejecutar los subcomandos principales:**

   - **Crear una cita nueva** (genera un identificador único):

     ```bash
     python -m gestor_citas_avanzado.cli add \
         --name "Cliente 1" \
         --service "Consulta inicial" \
         --start 2024-02-01T10:00 \
         --duration 60 \
         --notes "Traer estudios previos"
     ```

   - **Listar todas las citas** (con filtros opcionales por cliente o rango horario):

     ```bash
     python -m gestor_citas_avanzado.cli list
     python -m gestor_citas_avanzado.cli list --client "Cliente 1"
     python -m gestor_citas_avanzado.cli list --from 2024-02-01T00:00 --to 2024-02-02T00:00
     ```

   - **Actualizar una cita existente** (requiere el identificador mostrado al crear/listar):

     ```bash
     python -m gestor_citas_avanzado.cli update <ID_GENERADO> --duration 90 --notes "Sesión extendida"
     ```

   - **Marcar como completada o cancelada:**

     ```bash
     python -m gestor_citas_avanzado.cli complete <ID_GENERADO>
     python -m gestor_citas_avanzado.cli cancel <ID_GENERADO>
     ```

   Todos los comandos aceptan el modificador `--database <ruta.json>` para trabajar con un fichero distinto a `appointments.json` (creado automáticamente en el directorio actual si no existe).

## Ejecutar las pruebas

```bash
pytest
```

## Estructura principal

```
├── README.md
├── src/
│   └── gestor_citas_avanzado/
│       ├── __init__.py
│       ├── cli.py
│       ├── models.py
│       ├── service.py
│       └── storage.py
└── tests/
    └── test_scheduler.py
```
