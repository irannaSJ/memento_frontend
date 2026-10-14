import { defineConfig } from 'vite'
import react from "@vitejs/plugin-react-swc"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base : "/assets/memento/memento-ui/",

  server : {

    host : true,
    allowedHosts : ["test.site"],
    proxy : {
      "/api":{
        target : "http://test.site:8000",
        changeOrigin : true,
        secure : false
      }
    }
  },

  build : {
    outDir : "../memento/public/memento-ui/",
    emptyOutDir : true,
    rollupOptions : {
      output : {
        entryFileNames : "assets/app.js",
        chunkFileNames : "assets/[name].js",

        assetFileNames : (assetInfo) => {
          if(assetInfo.name?.endsWith(".css")){
            return "assets/app.css";
          }
          return "assets/[name][extname]";
        }
      }
    }
  }
})
