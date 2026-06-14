/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// CSS Modules — each import returns a Record of class-name strings
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
