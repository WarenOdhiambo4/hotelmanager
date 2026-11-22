import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Two surfaces from one codebase, deployed as two Vercel projects on the same Supabase backend:
//   default mode -> the public site, students, hotels and riders (yourdomain.com)
//   --mode admin -> the platform administrator portal only (admin.yourdomain.com, behind Cloudflare Access)
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  define: { __SURFACE__: JSON.stringify(mode === 'admin' ? 'admin' : 'site') },
  server: { port: mode === 'admin' ? 5181 : 5180, strictPort: true },
  build: { sourcemap: false, outDir: mode === 'admin' ? 'dist-admin' : 'dist' },
}))
