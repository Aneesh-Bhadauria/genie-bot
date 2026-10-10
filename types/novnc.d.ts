// @types/novnc__novnc still describes the old `lib/rfb` entry point; since
// 1.7 the package exports the client from its root.
declare module "@novnc/novnc" {
  export { default } from "@novnc/novnc/lib/rfb"
}
