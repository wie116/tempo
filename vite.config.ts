import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Nombre del repo en GitHub Pages. Si publicás en otro lado, poné '/'.
  base: '/tempo/',
})
