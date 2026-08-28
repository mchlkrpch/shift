import { DarkMode, LightMode, useColorMode } from "../../main";

export function rgba2hex(orig: any): string {
  if (!orig) return '#555555ff';
  if (typeof orig === 'string' && orig.startsWith('#')) {
    if (orig.length === 4) {
      const [, r, g, b] = orig;
      return `#${r}${r}${g}${g}${b}${b}ff`;
    }
    if (orig.length === 5) {
      const [, r, g, b, a] = orig;
      return `#${r}${r}${g}${g}${b}${b}${a}${a}`;
    }
    if (orig.length === 7) return orig + 'ff'; 
    if (orig.length === 9) return orig.toLowerCase();
    return orig.toLowerCase();
  }

  const rgb = orig.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i);
  if (!rgb) return '#555555ff';
  
  const r = parseInt(rgb[1], 10);
  const g = parseInt(rgb[2], 10);
  const b = parseInt(rgb[3], 10);
  let a = 1.0;
  const alpha = Math.round(a * 255);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${alpha.toString(16).padStart(2, '0')}`;
}

export const generateRandomHexColor = (alpha: number = 0.15): string => {
  const r = Math.floor(Math.random() * 150 + 50);
  const g = Math.floor(Math.random() * 150 + 50);
  const b = Math.floor(Math.random() * 150 + 50);
  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${alphaHex}`;
};

export const normalizeColorToHex = (color: any): string => {
  if (!color) return '#555555ff';
  return rgba2hex(color);
};

export const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export const Colored=({content}:any)=>{
  const {colorMode} = useColorMode();
  return colorMode === 'light' ? <LightMode>{content}</LightMode> : <DarkMode>{content}</DarkMode>;
}