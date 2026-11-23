import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas que quase nunca mudam ficam em arquivos próprios: a cada publicação
        // o navegador só baixa de novo o código do app, não o React nem o Supabase.
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client'],
          supabase: ['@supabase/supabase-js'],
          pdfjs: ['pdfjs-dist'],
        },
      },
    },
    // O maior pedaço é o leitor de PDF (pdfjs, ~500 kB), carregado só na tela do Bom Dia.
    chunkSizeWarningLimit: 600,
  },
});
