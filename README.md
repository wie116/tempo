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
| Abrir un bloque | Un click corto encima |
| Mover un bloque | Arrastralo — se puede llevar a otro día |
| Cambiar la duración | Estirá desde el borde de abajo (snap de 10 min) |
| Insertar una pausa | Marcá una franja vacía y elegí *Pausa* |
| Marcar como hecho | Click en el círculo del bloque |
| Administrar tareas | Botón *Tareas* o `L` |
| Duración al escribir | `Reunión 45m` · `Leer 1h` · `* ` al final = recurrente |

**Herramientas:** Seleccionar (`V`), Caja (`C`).
**Vistas:** `D` día · `S` semana · `M` mes · `T` ir a hoy.
**Editar:** `Supr` borra lo seleccionado.
**Paneles:** `H` hoy · `L` tareas · `R` reloj · `,` ajustes.
**Zoom:** `+` / `−`. `Esc` limpia la selección.

Los atajos se desactivan solos mientras escribís en cualquier campo o modal.

## Reglas de la agenda

- **Nada se superpone.** Si soltás un bloque encima de otro, el nuevo se queda con el lugar y el que estaba baja, en cadena. Sirve para reordenar el día empujando.
- **Horario de 24 h** en toda la app, con dos dígitos.
- **La jornada no se puede recortar** por encima de lo que ya agendaste: si tenés un bloque hasta las 23:00, Tempo no te deja terminar el día a las 22:00 y te dice por qué. Un bloque fuera de la grilla seguiría existiendo pero invisible, que es peor.
- **Todo es múltiplo de 10 minutos**, siempre: el store redondea toda escritura, venga del arrastre, del modal o de una importación.
- **El reloj corre siempre.** No hay botón de play: la agenda ya define los límites del día, así que Tempo solo mira el reloj de pared. El bloque en curso se va rellenando solo y la barra de abajo muestra cuánto le queda. Al empezar y al terminar cada bloque suena el aviso y aparece una tarjeta dentro de la app — nunca notificaciones del navegador.
- **Los bloques se cierran a mano.** Cuando uno termina, Tempo pregunta: *Completado* o *Más tiempo*. La segunda opción cierra el original y agenda la continuación con la duración que le digas. Un bloque que pasó y sigue abierto se marca en el color de "ahora".
- **Autoplan** acomoda tus pendientes en los huecos libres sin mover nada de lo que ya agendaste. La **varita** respeta el orden de tus listas; el **dado** lo mezcla. Es el mismo motor: misma configuración, mismo aviso de qué quedó afuera y por qué.
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

## Qué sigue

- **Fase 2** — pulir el arrastre: long-press en móvil, arrastrar entre bloques, deshacer.
- **Fase 3** — registro de sesiones y estadísticas de tiempo planificado vs. real.
- **Fase 4** — Supabase: cuentas, sincronización entre dispositivos, cola de escritura optimista. El esquema está en `supabase/schema.sql`.
- **Fase 5** — tareas recurrentes con series, plantillas de semana.
- **Fase 6** — PWA instalable, notificaciones, modo equipo.
