export default {
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    proxy: {
      // 🔥 precisa vir ANTES de "/orders"
      "/orders-health": {
        target: "http://orders-api:8081",
        changeOrigin: true,
        rewrite: () => "/health"
      },
      "/orders": {
        target: "http://orders-api:8081",
        changeOrigin: true
      },

      // idem: health antes de /api não é obrigatório aqui,
      // mas deixo consistente
      "/status-health": {
        target: "http://status-api:8082",
        changeOrigin: true,
        rewrite: () => "/health"
      },
      "/api": {
        target: "http://status-api:8082",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
};
