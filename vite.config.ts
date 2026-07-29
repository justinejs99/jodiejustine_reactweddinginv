import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/JodieJustine/', // Set the base path to match the folder name in public_html
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        homereception: 'homereception.html',
        reception: 'reception.html',
      },
    },
  },
})