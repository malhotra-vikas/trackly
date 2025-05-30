import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                popup: 'popup.html',
                signin: 'signin.html',
                app: 'app.html'
            }
        }
    }
})
