import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({ plugins: [react(), { name: 'fixture-only-routes', configureServer(server) { server.middlewares.use((request, _response, next) => { if (['/', '/dashboard', '/running', '/profile'].includes(request.url?.split('?')[0] ?? '')) request.url = '/fixture.html'; next(); }); } }], cacheDir: '.running-cache/fixture-vite', resolve: { alias: { '@clerk/clerk-react': fileURLToPath(new URL('./tests/ui/clerk.tsx', import.meta.url)) } }, define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://fixture.invalid') }, server: { host: '127.0.0.1', port: 5189, strictPort: true }, build: { target: 'esnext', outDir: '.running-cache/fixture-build', rollupOptions: { input: 'fixture.html' } } });

