import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || env.SUPABASE_URL || '',
      ),
    },
    server: {
      proxy: {
        '/api': 'http://localhost:3001',
        '/socket.io': {
          target: 'http://localhost:3001',
          ws: true,
        },
      },
    },
  }
})
