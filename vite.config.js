// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: 'public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'public/popup.html'),
                signin: resolve(__dirname, 'public/signin.html'),
                app: resolve(__dirname, 'public/app.html'),
                watchlist: resolve(__dirname, 'public/watchlist.html'),
                content: resolve(__dirname, 'src/content.js'), // explicitly resolved
                background: resolve(__dirname, 'src/background.js'),  // ✅ Add this line
                firebaseService: resolve(__dirname, 'src/firebase-service.js'),
                supabaseClient: resolve(__dirname, 'src/supabase-client.js'),
                tracklySupabase: resolve(__dirname, 'src/supabase-client.js'),

                //firebaseService: resolve(__dirname, 'src/firebase-service.js'), // <== make sure this exists
                //'supabase-client': resolve(__dirname, 'src/supabase-client.js') // ✅ Add this
            },
            output: {
                entryFileNames: (chunk) => {
                    if (chunk.name === 'content') return 'content.js';
                    if (chunk.name === 'background') return 'background.js';
                    return 'assets/[name]-[hash].js';
                },
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'content.css') return 'content.css';
                    return 'assets/[name]-[hash][extname]';
                }
            }
        }
    }
});
