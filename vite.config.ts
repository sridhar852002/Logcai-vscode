import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'skip-non-css-in-css-pipeline',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('.ts') || id.endsWith('.tsx')) {
          return { code, map: null };
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: './src/webview/webview.tsx',
      output: {
        entryFileNames: 'assets/webview-[hash].js',
        chunkFileNames: 'assets/webview-chunk-[hash].js',
        assetFileNames: 'assets/webview-asset-[hash].[ext]',
        manualChunks: {
          react: ['react', 'react-dom'],
          ui: ['lucide-react', 'highlight.js'],
        }
      },
      external: ['vscode', 'fs', 'path', 'os', 'crypto', 'util'],
    }
  },
  optimizeDeps: {
    exclude: ['vscode', 'fs', 'path', 'os', 'crypto', 'util']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
});
