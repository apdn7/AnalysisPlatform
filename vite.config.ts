import { resolve } from 'path';
import { defineConfig } from 'vite';

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
                assetFileNames: '[name][extname]',
                manualChunks(id) {
                    if (
                        id.includes('node_modules/plotly.js') ||
                        id.includes('node_modules\\plotly.js') ||
                        id.includes('node_modules/react-plotly.js') ||
                        id.includes('node_modules\\react-plotly.js') ||
                        id.includes('node_modules/@plotly') ||
                        id.includes('node_modules\\@plotly')
                    ) {
                        return 'plotly';
                    }
                },
            },
        },
        cssCodeSplit: false,
    },
    server: {
        origin: 'http://localhost:5173',
        port: 5173,
    },
});
