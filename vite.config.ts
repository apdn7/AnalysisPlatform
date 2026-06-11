import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    plugins: [],
    base: './',
    root: resolve(__dirname, './ap'),
    resolve: {
        alias: {
            '@': resolve(__dirname, './ap/src'),
        },
    },
    build: {
        outDir: '../ap/static/dist',
        emptyOutDir: true,
        sourcemap: true,
        rolldownOptions: {
            input: {
                main: resolve(__dirname, 'ap/src/main.tsx'),
            },
            output: {
                entryFileNames: '[name].bundle.js',
                chunkFileNames: '[name].js',
            },
        },
    },
    server: {
        origin: 'http://localhost:5173',
        port: 5173,
    },
});
