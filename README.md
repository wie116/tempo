# Tempo

Planificador de bloques de tiempo. Agenda de día, semana y mes, con panel de tareas arrastrables, pausas y temporizador pomodoro con alerta sonora.

Esta es la **Fase 1**: funciona entera en el navegador y guarda todo en `localStorage`. Todavía no hay cuentas ni sincronización — eso llega en la Fase 4 con Supabase.

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
| Frenar una repetición | En cualquier bloque de la serie: "Dejar de repetir" (no borra lo ya agendado) |
| Borrar una serie entera | En cualquier bloque de la serie: "Eliminar toda la serie" |
| Mover un bloque | Arrastralo — se puede llevar a otro día |
| Mover el día entero | Activá el candado de la barra y arrastrá: los siguientes lo acompañan |
| Clavar un bloque | El candadito dentro del bloque: queda fijo y corta la cadena |
| Cambiar la duración | Estirá desde el borde de abajo o el de arriba (snap de 10 min) |
| Repetir una tarea | Panel de tarea → pestaña *Repetición*: diaria, o semanal eligiendo qué días |
| Insertar una pausa | Marcá una franja vacía y elegí *Pausa* |
| Marcar como hecho | Click en el círculo del bloque |
| Administrar tareas | Botón *Tareas* o `L` |
| Duración al escribir | `Reunión 45m` · `Leer 1h` · `* ` al final = recurrente |

Atajos: `Ctrl+Z` deshace, `Ctrl+Shift+Z` rehace, `Supr` (o `Retroceso`), que borra lo seleccionado. Los atajos de una sola letra se sacaron porque se disparaban mientras escribías.

## Reglas de la agenda

- **Nada se superpone.** Si soltás un bloque encima de otro, el nuevo se queda con el lugar y el que estaba baja, en cadena. Sirve para reordenar el día empujando.
- **Horario de 24 h** en toda la app, con dos dígitos.
- **La jornada no se puede recortar** por encima de lo que ya agendaste: si tenés un bloque hasta las 23:00, Tempo no te deja terminar el día a las 22:00 y te dice por qué. Un bloque fuera de la grilla seguiría existiendo pero invisible, que es peor.
- **Todo es múltiplo de 10 minutos**, siempre: el store redondea toda escritura, venga del arrastre, del modal o de una importación.
- **El reloj corre siempre.** No hay botón de play: la agenda ya define los límites del día, así que Tempo solo mira el reloj de pared. El bloque en curso se va rellenando solo y la barra de abajo muestra cuánto le queda. Al empezar y al terminar cada bloque suena el aviso y aparece una tarjeta dentro de la app — nunca notificaciones del navegador.
- **Tres estados por bloque:** pendiente, completado y **omitido**. Omitido significa "no lo hice": el bloque queda en su lugar, rayado y en gris, como registro de lo que habías planificado, y la tarea vuelve a estar disponible en su grupo. Se revierte con un clic.
- **Los bloques se cierran a mano.** Cuando uno termina, Tempo pregunta: *Completado* o *Más tiempo*. La segunda opción cierra el original y agenda la continuación con la duración que le digas. Un bloque que pasó y sigue abierto se marca en el color de "ahora".
- **Autoplan** acomoda tus pendientes en los huecos libres sin mover nada de lo que ya agendaste. La **varita** respeta el orden de tus listas; el **dado** lo mezcla. Es el mismo motor: misma configuración, mismo aviso de qué quedó afuera y por qué.
- **Un clic en el panel de tareas no agenda nada.** Solo selecciona; para llevarla al día hay que arrastrarla hasta la grilla.
- **Estirar hacia arriba empuja lo de encima**, en cascada, sin superponer ni borrar. Si topa contra un bloque fijo o contra el inicio de la jornada, cede el que estás estirando.
- **La repetición elige días específicos.** Semanal ya no es "un día repetido": marcás lunes, miércoles y viernes y listo. Al arrastrar una tarea que repite, antes de crear la serie se abre una revisión que muestra cada fecha y **bloquea la confirmación si algo se pisa** con lo que ya está agendado — no empuja ni reemplaza nada, hay que resolver el choque a mano.
- **Reasignar tiempo**, en Dado y Varita por igual: podés pisar la duración de toda la tanda seleccionada, solo para esta vez, sin tocar lo guardado en cada tarea. *Manual* le da a todas la misma duración que elijas y avisa si no entran todas. *Automático* calcula la duración más grande posible para que entren todas — probando de a 10 minutos con el mismo motor de colocación real, así funciona incluso con huecos partidos por reuniones en el medio. Si sacás una tarea de la vista previa, el tiempo se recalcula: las que quedan se reparten lo que le tocaba a la que sacaste.
- **La varita avisa qué quedó afuera**, con un botón para deshacer todo de un clic. Si estabas reacomodando *Bloques del día*, lo que se cayó se lista también en el panel derecho bajo "Sin agendar hoy", junto con lo que marcaste como omitido. Si estabas agendando *Tareas pendientes*, lo que no entró no aparece ahí — nunca estuvo en la agenda, sigue en su lugar de siempre: el panel de Tareas.
- **Todo bloque tiene una tarea detrás.** Los que creás a mano en la grilla aparecen en el panel bajo **Sin clasificar**, así podés renombrarlos, darles color o volverlos recurrentes sin buscarlos en el calendario.
- **La varita tiene dos modos.** *Bloques del día* reacomoda lo que ya agendaste — pausas incluidas, se corren con el resto —, dejando fijos solo lo completado y lo que clavaste con el candadito; lo que no entra vuelve al panel como pendiente. *Tareas pendientes* sale a buscar trabajo nuevo y solo rellena huecos.
- **Las tareas recurrentes (↻) no se gastan**: siguen disponibles al agendarlas y al completarlas.

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
    Sidebar.tsx        listas, tareas, pausas
    Calendar.tsx       grilla, arrastre, línea de "ahora"
    DayColumn.tsx      una columna + reparto de solapamientos
    BlockView.tsx      un bloque
    MonthView.tsx      vista mensual
    TimerBar.tsx       pomodoro y alertas
    SettingsPanel.tsx  themes, densidad, horarios, sonido
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

## Qué sigue

- **Fase 2** — pulir el arrastre: long-press en móvil, arrastrar entre bloques, deshacer.
- **Fase 3** — registro de sesiones y estadísticas de tiempo planificado vs. real.
- **Fase 5** — tareas recurrentes con series, plantillas de semana.
- **Fase 6** — PWA instalable, notificaciones, modo equipo.
