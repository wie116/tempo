import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Si publicás en GitHub Pages en https://usuario.github.io/tempo/
  // descomentá la línea de abajo y poné el nombre exacto del repo:
  // base: '/tempo/',
})
