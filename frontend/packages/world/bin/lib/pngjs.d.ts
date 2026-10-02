/**
 * The PNG reader ships no types. Only synchronous reading is used: whatever an image editor saved, in
 * whatever colour type and bit depth, arrives here as four bytes a pixel.
 */
declare module 'pngjs' {
  export interface DecodedPng {
    width: number;
    height: number;
    data: Uint8Array;
  }
  export const PNG: {
    sync: {
      read(buffer: Uint8Array): DecodedPng;
    };
  };
}
