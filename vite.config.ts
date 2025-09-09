import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Deployed under https://yigitkg.github.io/Harvester-Tracker-Sim/
  base: '/Harvester-Tracker-Sim/',
})
