import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({command,mode}) => {
  const env=loadEnv(mode,process.cwd(),'');
  if(command==='build' && process.env.VERCEL==='1') {
    const api=process.env.VITE_API_URL || env.VITE_API_URL;
    const socket=process.env.VITE_SOCKET_URL || env.VITE_SOCKET_URL;
    for(const [name,value] of [['VITE_API_URL',api],['VITE_SOCKET_URL',socket || api]]) {
      let url;try {url=new URL(value);}catch {throw new Error(`${name} must be the actual HTTPS backend URL for Vercel deployment`);}
      if(url.protocol!=='https:' || ['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error(`${name} must be a public HTTPS backend URL without credentials or query parameters`);
    }
  }
  return {
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
  };
});
