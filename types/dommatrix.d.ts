declare module "dommatrix" {
  export default class DOMMatrix {
    constructor(init?: string | number[]);
    multiply(other: DOMMatrix): DOMMatrix;
    translate(tx?: number, ty?: number, tz?: number): DOMMatrix;
    scale(scaleX?: number, scaleY?: number, scaleZ?: number, originX?: number, originY?: number, originZ?: number): DOMMatrix;
    rotate(rotX?: number, rotY?: number, rotZ?: number): DOMMatrix;
    flipX(): DOMMatrix;
    flipY(): DOMMatrix;
    skewX(sx?: number): DOMMatrix;
    skewY(sy?: number): DOMMatrix;
    inverse(): DOMMatrix;
    transformPoint(point: { x?: number; y?: number; z?: number; w?: number }): { x: number; y: number; z: number; w: number };
  }
}
