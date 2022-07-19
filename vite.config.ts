import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        port: 3500,
        proxy: {
            '/api/': {
                target: 'http://localhost:3600/',
                changeOrigin: true,
            }
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        },
    },
    plugins: [react()],
    build: {
        outDir: 'dist/client',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                register: resolve(__dirname, 'register.html')
            }
        }
    }
})
