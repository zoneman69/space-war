import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // <- IMPORTANT: listen on 0.0.0.0
    port: 3000,
    proxy: {
      "/api": "http://localhost:4000"
    }
  }
});
