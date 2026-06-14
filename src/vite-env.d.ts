/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

// CSS Modules — each import returns a Record of class-name strings
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
