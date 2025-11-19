import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss' // Added Tailwind CSS plugin

export default defineConfig({
  plugins: [react()],
  base: '/hub',
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  }
})