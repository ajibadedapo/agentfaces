import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { AGENT_STATES, CORE_STATES, DEFAULT_PALETTE, EXPRESSION_NAMES, renderFaceSvg, restExpression, SHAPE_NAMES, STATE_LABEL, type ExpressionName, type ShapeName } from "../src/index";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const INK = "#1C1B22";
const MUTED = "#6B6A75";
const SHAPE_COLORS: Record<ShapeName, string> = { circle: "#2B90FF", triangle: "#F97216", square: "#8B5CF6" };

interface Cell {
  shape: ShapeName;
  color: string;
  expression: ExpressionName;
  caption: string;
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function face(cell: Cell, x: number, y: number, size: number, id: string): string {
  const svg = renderFaceSvg({ shape: cell.shape, color: cell.color, expression: cell.expression, decorative: true, idPrefix: id });
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100" style="color:${cell.color}" overflow="visible">${inner}</svg>`;
}

export function gridSvg(title: string, rows: Array<{ heading: string; cells: Cell[] }>, columns: number, size = 96): string {
  const gap = 24;
  const captionHeight = 22;
  const cellW = size + gap;
  const cellH = size + captionHeight + gap;
  const left = 32;
  let y = 72;
  const parts: string[] = [];
  let width = left * 2 + columns * cellW - gap;
  rows.forEach((row, r) => {
    parts.push(`<text x="${left}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="600" fill="${INK}">${escape(row.heading)}</text>`);
    y += 16;
    row.cells.forEach((cell, i) => {
      const cx = left + (i % columns) * cellW;
      const cy = y + Math.floor(i / columns) * cellH;
      parts.push(face(cell, cx, cy, size, `r${r}c${i}`));
      parts.push(`<text x="${cx + size / 2}" y="${cy + size + 17}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="${MUTED}">${escape(cell.caption)}</text>`);
    });
    y += Math.ceil(row.cells.length / columns) * cellH + 20;
  });
  width = Math.max(width, 480);
  const header = `<text x="${left}" y="40" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="${INK}">${escape(title)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}"><rect width="100%" height="100%" fill="#FFFFFF"/>${header}${parts.join("")}</svg>`;
}

export function toPng(svg: string, scale = 2): Buffer {
  return new Resvg(svg, { fitTo: { mode: "zoom", value: scale }, font: { loadSystemFonts: true } }).render().asPng();
}

function write(path: string, svg: string, scale = 2) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, toPng(svg, scale));
  console.log(`wrote ${path}`);
}

export function statesRow(shape: ShapeName, states: readonly (typeof AGENT_STATES)[number][], color = SHAPE_COLORS[shape]) {
  return states.map((state) => ({ shape, color, expression: restExpression(state), caption: STATE_LABEL[state] }));
}

export function contactSheet(): string {
  const rows = [
    ...SHAPE_NAMES.map((shape) => ({ heading: `${shape}: every state (resting expression)`, cells: statesRow(shape, AGENT_STATES) })),
    ...SHAPE_NAMES.map((shape) => ({ heading: `${shape}: every expression`, cells: EXPRESSION_NAMES.map((expression) => ({ shape, color: SHAPE_COLORS[shape], expression, caption: expression })) })),
  ];
  return gridSvg("agentfaces: states and expressions, three shapes", rows, 9, 96);
}

function readmeStates(): string {
  const cells = CORE_STATES.map((state, i) => ({ shape: SHAPE_NAMES[i % 3], color: DEFAULT_PALETTE[[1, 4, 0, 5, 2, 6, 3, 8][i]], expression: restExpression(state), caption: STATE_LABEL[state] }));
  return gridSvg("Core agent states", [{ heading: "", cells }], 8, 88);
}

function readmeExpressions(): string {
  const cells = EXPRESSION_NAMES.map((expression, i) => ({ shape: SHAPE_NAMES[i % 3], color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length], expression, caption: expression }));
  return gridSvg("Expressions", [{ heading: "", cells }], 9, 72);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sheet = process.argv[2];
  write(join(root, "assets", "states.png"), readmeStates());
  write(join(root, "assets", "expressions.png"), readmeExpressions());
  if (sheet) write(sheet, contactSheet(), 1.5);
}
