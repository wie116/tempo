import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('date-fns')) return 'dates';
          if (id.includes('zustand')) return 'state';
          if (id.includes('react')) return 'react';
        },
      },
    },
  },
  // Nombre del repo en GitHub Pages. Si publicás en otro lado, poné '/'.
  base: '/tempo/',
})
