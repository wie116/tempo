export interface ThemeMeta {
  id: string;
  name: string;
  hint: string;
  nameEn: string;
  hintEn: string;
  swatch: [string, string, string];
}

/** Cada id acá tiene que existir como [data-theme="id"] en index.css */
export const THEMES: ThemeMeta[] = [
  { id: 'daylight', name: 'Claro',   hint: 'Porcelana y pino',     nameEn: 'Light',  hintEn: 'Porcelain and pine', swatch: ['#EEF2F1', '#FFFFFF', '#2F6F5E'] },
  { id: 'ink',      name: 'Papel',   hint: 'Papel y tinta azul',   nameEn: 'Paper',  hintEn: 'Paper and blue ink', swatch: ['#F3F0E9', '#FFFDF8', '#3A4A8C'] },
  { id: 'arena',    name: 'Arena',   hint: 'Hueso y tierra',       nameEn: 'Sand',   hintEn: 'Bone and earth', swatch: ['#E9DFCE', '#F8F2E7', '#A4643A'] },
  { id: 'brasa',    name: 'Brasa',   hint: 'Arcilla y rojo',       nameEn: 'Ember',  hintEn: 'Clay and red', swatch: ['#F2E6E2', '#FDF6F4', '#B23A2E'] },
  { id: 'studio',   name: 'Estudio', hint: 'Pizarra y menta',      nameEn: 'Studio', hintEn: 'Slate and mint', swatch: ['#10161A', '#1A2125', '#4FD1A5'] },
  { id: 'marina',   name: 'Marino',  hint: 'Azul profundo y cian', nameEn: 'Navy',   hintEn: 'Deep blue and cyan', swatch: ['#0D1626', '#152135', '#58C6E8'] },
];

/** Colores para grupos y etiquetas de tarea. */
export const PALETTE = [
  '#2F6F5E', '#3A4A8C', '#8A4A78', '#B23A2E',
  '#A4643A', '#2C7A8C', '#5F7A2E', '#55636B',
  '#C0762A', '#6D4C9F', '#1F7A55', '#9A3B4E',
];
