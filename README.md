# Tempo

Planificador de bloques de tiempo con agenda de día, semana y mes, To‑Do, Rutinas, Inbox, fechas futuras, series recurrentes, pausas y temporizador. Funciona localmente con `localStorage` y habilita cuentas/sincronización cuando se configura Supabase.

## Arrancar

```bash
npm install
npm run dev
```

Abrí http://localhost:5173

## Cómo se usa

| Acción | Cómo |
|---|---|
| Agendar una tarea | Arrastrala del panel a la grilla |
| Crear un bloque suelto | Arrastrá sobre un hueco vacío (o tocá, en móvil) |
| Editar un bloque | El lápiz dentro del bloque, o doble clic |
| Crear o frenar una repetición | Abrí el bloque → *Repetir/Serie*. La regla pertenece al evento, no a la tarea plantilla |
| Modificar una serie | Desde cualquier referencia: aplicá a esta, desde esa fecha o a toda la serie |
| Mover un bloque | Arrastralo — se puede llevar a otro día |
| Mover el día entero | Activá el candado de la barra y arrastrá: los siguientes lo acompañan |
| Clavar un bloque | El candadito dentro del bloque: queda fijo y corta la cadena |
| Cambiar la duración | Estirá desde el borde de abajo o el de arriba (snap de 10 min) |
| Seleccionar varios bloques | `Ctrl`/`Cmd` + clic; al arrastrar uno se mueve todo el grupo |
| Duplicar al arrastrar | `Ctrl`/`Cmd` + arrastre; mantiene las distancias del grupo seleccionado |
| Copiar y pegar bloques | `Ctrl`/`Cmd` + `C`, luego `Ctrl`/`Cmd` + `V` |
| Crear una rutina | Panel lateral → pestaña *Rutinas* |
| Definir frecuencia | Abrí un bloque → *Repetir*: diaria, semanal, mensual o anual |
| Insertar una pausa | Marcá una franja vacía y elegí *Pausa* |
| Marcar como hecho | Click en el círculo del bloque |
| Administrar tareas | Botón *Tareas* |
| Captura natural | `Informe mañana 45m prioridad alta #Trabajo` · `Pagar vence 30/8` |

Atajos: `Ctrl+Z` deshace, `Ctrl+Shift+Z` rehace, `Supr` (o `Retroceso`), que borra lo seleccionado. Los atajos de una sola letra se sacaron porque se disparaban mientras escribías.

## Reglas de la agenda

- **Nada se superpone.** Si soltás un bloque encima de otro, el nuevo se queda con el lugar y el que estaba baja, en cadena. Sirve para reordenar el día empujando.
- **Horario de 24 h** en toda la app, con dos dígitos.
- **Los paneles de atención no crecen sin límite.** *Sin cerrar* y *Pendientes por ubicar* muestran cuatro referencias y permiten expandir el resto; tocar una tarea sin cerrar navega a su día y la centra en la agenda.
- **La selección múltiple conserva la estructura temporal.** Con `Ctrl`/`Cmd` + clic acumulás bloques; al mover o duplicar la selección se mantienen sus diferencias de día y hora. Las copias se desacoplan de cualquier serie recurrente.
- **La agenda muestra siempre las 24 horas.** La jornada configurada resalta el horario habitual y guía a Organizar, pero nunca oculta ni impide agendar bloques afuera.
- **Todo es múltiplo de 10 minutos**, siempre: el store redondea toda escritura, venga del arrastre, del modal o de una importación.
- **El reloj corre siempre.** No hay botón de play: la agenda ya define los límites del día, así que Tempo solo mira el reloj de pared. El bloque en curso se va rellenando solo y la barra de abajo muestra cuánto le queda. Al empezar y al terminar cada bloque suena el aviso y aparece una tarjeta dentro de la app — nunca notificaciones del navegador.
- **Tres estados por bloque:** pendiente, completado y **omitido**. Omitido significa "no lo hice": el bloque queda en su lugar, rayado y en gris, como registro de lo que habías planificado, y la tarea vuelve a estar disponible en su grupo. Se revierte con un clic.
- **Los bloques se cierran a mano.** Cuando uno termina, Tempo pregunta: *Completado* o *Más tiempo*. La segunda opción cierra el original y agenda la continuación con la duración que le digas. Un bloque que pasó y sigue abierto se marca en el color de "ahora".
- **Organizar** acomoda tus pendientes en los huecos libres sin mover nada de lo que ya agendaste. Desde una sola ventana podés respetar el orden de tus listas, mezclarlo o priorizar tareas largas o cortas, con el mismo aviso de qué quedó afuera y por qué.
- **Un clic en el panel de tareas no agenda nada.** Solo selecciona; para llevarla al día hay que arrastrarla hasta la grilla.
- **Soltar sobre otro bloque expresa una intención.** La mitad superior inserta antes y la mitad inferior inserta después; la guía de destino lo muestra antes de soltar.
- **Estirar hacia arriba empuja lo de encima**, en cascada, sin superponer ni borrar. Si topa contra un bloque fijo o contra las 00:00, cede el que estás estirando.
- **Inbox, Hoy, To‑Do, Rutinas y Archivo tienen responsabilidades distintas.** Un To‑Do sin completar sigue disponible; sólo se archiva al completar su bloque. Una tarea con fecha futura aparece en el día correspondiente mientras no tenga horario. Las Rutinas permanecen disponibles. To‑Do y Rutinas tienen clasificaciones independientes.
- **La repetición vive en el bloque de agenda.** Una misma Rutina puede usarse una vez, crear una serie diaria y otra mensual sin que una regla pise a las demás. Desde cualquier ocurrencia se puede editar o borrar sólo esa referencia, desde esa fecha o la serie completa.
- **Comentarios e íconos son propios de cada ocurrencia.** Una referencia puede decir “Examen” y llevar 🎓 sin modificar las demás; la propagación a la serie requiere una acción explícita.
- **Las series resuelven choques antes de crearse.** La revisión muestra cada fecha ocupada y puede mover solo esa ocurrencia al próximo hueco libre, sin alterar los bloques existentes. También podés optar por excluir fechas puntuales.
- **Reasignar tiempo**, dentro de Organizar: podés pisar la duración de toda la tanda seleccionada, solo para esta vez, sin tocar lo guardado en cada tarea. *Manual* le da a todas la misma duración que elijas y avisa si no entran todas. *Automático* calcula la duración más grande posible para que entren todas — probando de a 10 minutos con el mismo motor de colocación real, así funciona incluso con huecos partidos por reuniones en el medio. Si sacás una tarea de la vista previa, el tiempo se recalcula: las que quedan se reparten lo que le tocaba a la que sacaste.
- **El organizador conserva una bandeja de pendientes**, con un botón para deshacer todo de un clic. Lo que no entra —tanto al reacomodar bloques como al agendar tareas— queda en *Actividad → Pendientes por ubicar*, persiste si recargás y se puede arrastrar directamente a la agenda.
- **Actividad reúne lo que necesita atención.** Además de pendientes por ubicar y omitidas, muestra bloques vencidos que todavía no cerraste, incluso si pertenecen a un día anterior.
- **En celular la agenda abre en vista Día.** Tareas y Actividad funcionan como paneles laterales, la barra de herramientas se desplaza horizontalmente y se respetan las áreas seguras del dispositivo.
- **Todo bloque tiene una tarea detrás.** Los que creás a mano en la grilla aparecen en el panel bajo **Sin clasificar**, así podés renombrarlos, darles color o convertirlos en rutina sin buscarlos en el calendario.
- **Organizar tiene dos modos.** *Bloques del día* reacomoda lo que ya agendaste — pausas incluidas, se corren con el resto —, dejando fijos solo lo completado y lo que clavaste con el candadito; lo que no entra vuelve al panel como pendiente. *Tareas pendientes* sale a buscar trabajo nuevo y solo rellena huecos.
- **Las Rutinas no se gastan**: siguen disponibles al agendarlas y al completarlas.

## Cómo está armado

- **Vite + React + TypeScript**, sin framework de servidor. Sale un sitio estático.
- **Zustand** para el estado, con `persist` a `localStorage`. Cada bloque se suscribe solo a su propia entrada, así mover uno no redibuja los demás.
- **Tailwind v4** sobre variables CSS. Todo el color y la tipografía salen de `src/index.css`.
- **Arrastre propio** con Pointer Events (funciona con mouse, touch y lápiz). Durante el gesto solo se actualiza un estado efímero; el store real se escribe recién al soltar.
- **Web Audio** para los avisos: sin archivos de sonido, se generan con osciladores.
- El temporizador guarda un **timestamp**, no un contador. Si el móvil duerme la pestaña, al volver el tiempo sigue siendo exacto.

```
src/
  App.tsx              layout, atajos, theme
  store.ts             estado, acciones, stores de arrastre y timer
  types.ts             modelo de dominio
  lib/time.ts          conversión px ↔ minutos, snap de 10 min
  lib/audio.ts         campanitas
  lib/themes.ts        catálogo de themes y paleta
  components/
    TopBar.tsx         navegación de fechas y vistas
    Sidebar.tsx        Inbox, Hoy, To-Do, Rutinas y captura natural
    Calendar.tsx       grilla, arrastre, línea de "ahora"
    DayColumn.tsx      una columna + reparto de solapamientos
    BlockView.tsx      un bloque
    MonthView.tsx      vista mensual
    TimerBar.tsx       pomodoro y alertas
    SettingsModal.tsx  themes, densidad, horarios, sonido e integraciones
```

## Themes

Un theme es un bloque de variables en `src/index.css` más una entrada en `src/lib/themes.ts`. Para crear uno:

```css
[data-theme='mi-theme'] {
  --bg: #...;  --surface: #...;  --surface-2: #...;
  --border: #...;  --text: #...;  --muted: #...;
  --accent: #...;  --accent-fg: #...;  --now: #...;
  --grid-line: #...;  --grid-line-strong: #...;
}
```

## Publicar

**GitHub Pages** (gratis): descomentá `base: '/tempo/'` en `vite.config.ts` con el nombre de tu repo, subí el proyecto y en Settings → Pages elegí *GitHub Actions*. El workflow ya está en `.github/workflows/deploy.yml`.

**Vercel o Netlify**: conectá el repo, no hace falta configurar nada.

Railway no hace falta mientras el backend sea Supabase.

## Cuentas y sincronización

Sin configurar nada, Tempo guarda todo en el navegador. Para tener cuenta y sincronizar entre dispositivos:

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pegá y ejecutá `supabase/schema.sql`.
3. En **Project Settings → API**, copiá la *Project URL* y la *anon public key*.
4. Copiá `.env.example` como `.env` y completá las dos variables.
5. Para la versión publicada, cargá las mismas dos en **Settings → Secrets and variables → Actions** del repo, con los nombres `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

La clave *anon* es pública por diseño: lo que protege los datos son las políticas RLS del esquema, que solo dejan a cada usuario ver sus propias filas.

La primera vez que entrás con una cuenta nueva, lo que tengas guardado en el navegador se sube solo.

### Preparar Google Calendar

La integración usa OAuth del lado servidor. El Client Secret y los refresh tokens nunca llegan al
navegador; el refresh token se cifra con AES-GCM antes de guardarse.

1. Volvé a ejecutar `supabase/schema.sql` para crear las tablas de conexiones.
2. En Google Cloud habilitá **Google Calendar API** y creá un OAuth Client de tipo **Web application**.
3. Agregá como redirect URI autorizada:

   ```text
   https://TU_PROJECT_REF.supabase.co/functions/v1/google-calendar-callback
   ```

4. Generá una clave aleatoria de 32 bytes codificada en base64 para `GOOGLE_TOKEN_ENCRYPTION_KEY`.
5. Cargá estos secretos en Supabase Edge Functions:

   ```text
   GOOGLE_CLIENT_ID
   GOOGLE_CLIENT_SECRET
   GOOGLE_TOKEN_ENCRYPTION_KEY
   APP_ORIGINS=http://localhost:5173,https://tu-dominio.com
   APP_DEFAULT_RETURN_URL=http://localhost:5173/tempo/
   ```

   Si la callback publicada difiere de la URL automática, agregá también `GOOGLE_REDIRECT_URI`.

6. Desplegá las funciones:

   ```bash
   supabase functions deploy google-calendar-auth-url
   supabase functions deploy google-calendar-callback --no-verify-jwt
   supabase functions deploy google-calendar-calendars
   supabase functions deploy google-calendar-selection
   ```

La callback es pública porque Google redirige hacia ella sin una sesión de Supabase en los headers.
La operación sigue protegida mediante `state`, PKCE, expiración de diez minutos y consumo único.
Las demás funciones sí exigen la sesión del usuario.

## Qué sigue

- Activar Google Calendar cargando los secretos y desplegando las Edge Functions ya preparadas.
- Conectar un proveedor MCP/IA al contrato de captura local de `src/lib/taskCapture.ts`.
- Estadísticas de tiempo planificado vs. real, PWA instalable y notificaciones del sistema.
