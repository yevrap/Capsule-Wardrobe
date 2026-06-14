/// <reference types="vite/client" />

// CSS Modules — each import returns a Record of class-name strings
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
