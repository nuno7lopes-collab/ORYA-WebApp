declare module "upng-js" {
  type DecodedPng = {
    width: number;
    height: number;
  };

  const UPNG: {
    decode(buffer: ArrayBuffer): DecodedPng;
    toRGBA8(png: DecodedPng): Uint8Array[];
  };

  export default UPNG;
}
