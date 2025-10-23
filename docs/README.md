# Barbería David Martín – Guía de despliegue y operaciones

Esta guía describe cómo desplegar el MVP completo (Functions, Firestore, Hosting, Admin y widget público) y cómo integrar Meta WhatsApp, Twilio Media Streams, Google Calendar y las integraciones de IA.

## 1. Preparación del proyecto Firebase

1. Instala las dependencias globales necesarias:
   ```bash
   npm install -g firebase-tools
   ```
2. Autentícate en Firebase y selecciona el proyecto existente o crea uno nuevo.
   ```bash
   firebase login
   firebase use --add
   ```
3. Habilita Firestore en modo producción, Authentication (correo/contraseña) y Functions en región `europe-west1` desde la consola de Firebase.
4. Crea dos usuarios en Authentication para el panel administrativo (ej. `david@peluqueria.com`, `marta@peluqueria.com`).

## 2. Configuración de variables de entorno

1. Duplica `firebase/.env.example` en `firebase/.env` y completa:
   - `META_TOKEN` y `META_PHONE_ID` desde [Meta Cloud-API](https://developers.facebook.com/docs/whatsapp/cloud-api/).
   - `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH` desde el panel de Twilio.
   - `OPENAI_KEY` (GPT-4o) y `ELEVEN_KEY` (ElevenLabs) para futuras ampliaciones.
   - `GOOGLE_CAL_ID` (ID de calendario compartido) y `GOOGLE_KEY_JSON` (JSON del servicio con acceso a ese calendario).
2. Exporta las variables antes de desplegar Functions:
   ```bash
   cd firebase/functions
   npm install
   npm run build
   firebase functions:config:set meta.token="$(grep META_TOKEN ../.env | cut -d'=' -f2-)" \
     meta.phone_id="$(grep META_PHONE_ID ../.env | cut -d'=' -f2-)" \
     twilio.sid="$(grep TWILIO_ACCOUNT_SID ../.env | cut -d'=' -f2-)" \
     twilio.auth="$(grep TWILIO_AUTH ../.env | cut -d'=' -f2-)"
   ```
   > Para `GOOGLE_KEY_JSON` utiliza `firebase functions:config:set google.key_json="$(cat ../google-key.json | tr -d '\n')"` si prefieres gestionarlo vía `functions:config` en lugar de `.env`.
3. Crea los archivos `.env` en `react-admin` y `public-web` con las claves del proyecto (ver `.env.example`).

## 3. Inicialización de Firestore

1. Importa colecciones básicas:
   - `services` con los datos del catálogo (puedes usar la tabla del panel admin como referencia).
   - `employees` con `{ id: 'david', name: 'David' }` y `{ id: 'marta', name: 'Marta' }`.
2. Publica las reglas e índices:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

## 4. Despliegue de Firebase Functions

1. Desde `firebase/functions` instala dependencias y ejecuta tests:
   ```bash
   npm install
   npm test
   ```
2. Construye y despliega:
   ```bash
   npm run build
   firebase deploy --only functions
   ```
3. Registra las URLs resultantes para:
   - `webhookVerifyWhatsApp`
   - `webhookTwilioVoice`

## 5. Configuración de Meta Cloud-API (WhatsApp)

1. En el *App Dashboard* de Meta agrega un webhook para WhatsApp y copia la URL de `webhookVerifyWhatsApp`.
2. Configura el token de verificación con el mismo valor que `META_TOKEN`.
3. Asegúrate de suscribirte a los eventos `messages` y `message_template_status_update`.
4. Prueba enviando un mensaje desde un número verificado; deberías recibir la respuesta automática con el enlace al widget.

## 6. Configuración de Twilio Media Streams

1. Crea un número de voz en Twilio y habilita **Programmable Voice**.
2. Dentro de la sección **Voice > Manage > Numbers**, asigna la URL de `webhookTwilioVoice` como webhook para eventos de voz entrantes (método `POST`).
3. Activa **Media Streams** en la consola. Actualmente el webhook registra la conexión y deja preparado el punto de integración con OpenAI/ElevenLabs.
4. Realiza una llamada de prueba y verifica en los logs de Functions que se registran los eventos `connected` y `stop`.

## 7. Sincronización con Google Calendar

1. Crea un proyecto en Google Cloud y habilita la API de Calendar.
2. Genera una cuenta de servicio con rol `Calendar Editor` y descarga el JSON.
3. Comparte el calendario empresarial con el correo de la cuenta de servicio (permisos de editor) y copia el `calendarId`.
4. Introduce `GOOGLE_CAL_ID` y el contenido de `GOOGLE_KEY_JSON` en `.env` o en `functions:config`.
5. Tras desplegar, crea y cancela citas desde el widget y confirma que los eventos se insertan/eliminan en el calendario.

## 8. Panel administrativo (React)

1. Instala dependencias y construye:
   ```bash
   cd react-admin
   npm install
   npm run build
   ```
2. Sube el resultado (`dist/`) a Firebase Hosting o configúralo como app secundaria.
3. Accede a `/login`, autentícate y comprueba:
   - Visualización semanal de citas con colores por empleado.
   - Botón “Cancelar cita” realiza soft delete a través de Cloud Functions.
   - Tabla de servicios en modo solo lectura.

## 9. Widget público embebible

1. En `public-web` instala dependencias y construye:
   ```bash
   cd public-web
   npm install
  npm run build
   ```
2. Copia el contenido de `dist/` a la carpeta de Hosting público (`public/`).
3. Antes de insertar el widget en una web externa, define la configuración mínima:
   ```html
   <script>
     window.DM_WIDGET_CONFIG = {
       firebaseConfig: {
         apiKey: '...',
         authDomain: '...',
         projectId: '...',
         storageBucket: '...',
         messagingSenderId: '...',
         appId: '...'
       },
       region: 'europe-west1'
     };
   </script>
   <iframe src="https://peluqueria-david-martin.web.app" style="width:100%;height:640px;border:0"></iframe>
   ```
4. Verifica que el flujo reserva → confirmación → Firestore → Calendar funciona de extremo a extremo.

## 10. Integración con OpenAI y ElevenLabs

- Las claves (`OPENAI_KEY`, `ELEVEN_KEY`) se reservan para ampliar el webhook de Twilio.
- Usa `prompts/prompts.json` como configuración base para GPT-4o (function calling) y ElevenLabs (voz `pNInz6obpgDQGcFmaJgB`).

## 11. Pruebas y calidad

- Ejecuta `npm test` en `firebase/functions` para validar `getAvailableSlots`, `createBooking` y `cancelBooking`.
- Comprueba manualmente desde el panel y el widget la cancelación (soft delete) y la sincronización de calendario.

## 12. Despliegue final

Una vez verificado todo, despliega Functions y Hosting con un único comando:
```bash
firebase deploy --only functions,hosting
```
