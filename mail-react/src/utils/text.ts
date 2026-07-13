let canvas: HTMLCanvasElement | null = null;

export function getTextWidth(text: string, font = '14px sans-serif'): number {
  if (!canvas) canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 0;
  context.font = font;
  return context.measureText(text).width;
}