import type { ShapeName } from "./shapes";
import { anchorForSize } from "./anchors";
import { EXPRESSIONS, type ExpressionName } from "./expressions";
import { FACE_COLORS, faceGeometry, REST_POSE, type EyeGeometry, type FaceGeometry, type FacePose } from "./face";
import { SHAPE_PATHS } from "./shapes";
import { checkExpression, checkShape, checkState } from "./names";
import { restExpression, STATE_LABEL, type AgentState } from "./states";

export interface FaceSvgOptions {
  shape: ShapeName;
  color: string;
  state?: AgentState;
  expression?: ExpressionName;
  mouth?: boolean;
  pose?: FacePose;
  size?: number;
  label?: string;
  decorative?: boolean;
  idPrefix?: string;
}

const n = (v: number) => {
  const s = v.toFixed(2);
  return s === "-0.00" ? "0.00" : s;
};

function eyeMarkup(eye: EyeGeometry, clipId: string): string {
  return [
    `<g transform="translate(${n(eye.cx)} ${n(eye.cy)}) rotate(${n(eye.rotate)}) scale(1 ${n(eye.scaleY)})">`,
    `<clipPath id="${clipId}"><path d="${eye.aperture}"/></clipPath>`,
    `<g clip-path="url(#${clipId})">`,
    `<path d="${eye.sclera}" fill="${eye.scleraFill}"/>`,
    `<circle cx="${n(eye.pupil.cx)}" cy="${n(eye.pupil.cy)}" r="${n(eye.pupil.r)}" fill="${FACE_COLORS.pupil}" opacity="${n(eye.pupil.opacity)}"/>`,
    `<circle cx="${n(eye.glint.cx)}" cy="${n(eye.glint.cy)}" r="${n(eye.glint.r)}" fill="${FACE_COLORS.glint}" opacity="${n(eye.glint.opacity)}"/>`,
    `</g>`,
    `</g>`,
  ].join("");
}

export function faceMarkup(geometry: FaceGeometry, idPrefix: string, mouth = true): string {
  const parts: string[] = [];
  if (geometry.blush.opacity > 0) {
    for (const b of [geometry.blush.left, geometry.blush.right]) {
      parts.push(`<ellipse cx="${n(b.cx)}" cy="${n(b.cy)}" rx="${n(b.rx)}" ry="${n(b.ry)}" fill="${FACE_COLORS.blush}" opacity="${n(geometry.blush.opacity)}"/>`);
    }
  }
  parts.push(eyeMarkup(geometry.left, `${idPrefix}el`), eyeMarkup(geometry.right, `${idPrefix}er`));
  if (mouth && geometry.mouth.opacity > 0) {
    parts.push(
      `<path d="${geometry.mouth.d}" fill="${FACE_COLORS.mouth}" stroke="${FACE_COLORS.mouth}" stroke-width="${n(geometry.mouth.stroke)}" stroke-linejoin="round" stroke-linecap="round" opacity="${n(geometry.mouth.opacity)}"/>`,
    );
  }
  return parts.join("");
}

export function bodyMarkup(shape: ShapeName): string {
  return `<path d="${SHAPE_PATHS[shape]}" fill="currentColor"/>`;
}

export function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderFaceSvg({ shape: shapeName, color, state: stateName, expression: expressionName, mouth = true, pose = REST_POSE, size, label, decorative = false, idPrefix = "af" }: FaceSvgOptions): string {
  const shape = checkShape(shapeName, "circle")!;
  const state = checkState(stateName);
  const expression = checkExpression(expressionName);
  const geometry = faceGeometry(EXPRESSIONS[expression ?? restExpression(state)], anchorForSize(shape, size), pose);
  const dims = size ? ` width="${size}" height="${size}"` : "";
  const name = label ?? STATE_LABEL[state];
  const a11y = decorative ? ` aria-hidden="true"` : ` role="img" aria-label="${escapeAttribute(name)}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dims}${a11y} style="color:${escapeAttribute(color)}">${bodyMarkup(shape)}${faceMarkup(geometry, idPrefix, mouth)}</svg>`;
}
