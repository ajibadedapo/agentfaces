import { AGENT_STATES, EXPRESSION_NAMES, FACE_ANCHORS, renderFaceSvg, restExpression, STATE_EXPRESSIONS, STATE_LABEL, type ExpressionName, type FaceSvgOptions, type ShapeName } from "agentfaces";

export { renderFaceSvg, faceMarkup, bodyMarkup, escapeAttribute, faceFor, type FaceSvgOptions } from "agentfaces";

export interface FaceSetFrame {
  id: string;
  kind: "state" | "expression";
  name: string;
  expression: ExpressionName;
  label: string;
  file: string;
}

export interface FaceSetManifest {
  shape: ShapeName;
  version: string;
  color: string;
  anchor: (typeof FACE_ANCHORS)[ShapeName];
  sprite: string;
  frames: FaceSetFrame[];
}

export interface FaceSet {
  manifest: FaceSetManifest;
  files: Record<string, string>;
}

export const FACE_SET_VERSION = "1";

export function faceSymbol(id: string, options: FaceSvgOptions): string {
  const inner = renderFaceSvg({ ...options, idPrefix: options.idPrefix ?? `${id}-` }).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<symbol id="${id}" viewBox="0 0 100 100">${inner}</symbol>`;
}

export function buildFaceSet(shape: ShapeName, color = "currentColor"): FaceSet {
  const files: Record<string, string> = {};
  const frames: FaceSetFrame[] = [];
  const symbols: string[] = [];
  const add = (kind: "state" | "expression", name: string, expression: ExpressionName, label: string) => {
    const id = `${shape}-${kind}-${name}`;
    const file = `${kind}s/${name}.svg`;
    files[file] = `${renderFaceSvg({ shape, color, expression, label, idPrefix: `${id}-` })}\n`;
    symbols.push(faceSymbol(id, { shape, color, expression, label }));
    frames.push({ id, kind, name, expression, label, file });
  };
  for (const state of AGENT_STATES) add("state", state, restExpression(state), STATE_LABEL[state]);
  for (const expression of EXPRESSION_NAMES) add("expression", expression, expression, expression);
  files["sprite.svg"] = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols.join("")}</svg>\n`;
  const manifest: FaceSetManifest = { shape, version: FACE_SET_VERSION, color, anchor: FACE_ANCHORS[shape], sprite: "sprite.svg", frames };
  files["manifest.json"] = `${JSON.stringify({ ...manifest, pools: STATE_EXPRESSIONS }, null, 2)}\n`;
  return { manifest, files };
}
