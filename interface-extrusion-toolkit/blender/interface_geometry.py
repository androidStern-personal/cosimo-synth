from __future__ import annotations

from dataclasses import dataclass
from math import cos, sin, pi
from typing import Dict, Iterable, List, Sequence, Tuple

Point2 = Tuple[float, float]
Point3 = Tuple[float, float, float]
UV = Tuple[float, float]


@dataclass(frozen=True)
class CornerRadius:
    x: float
    y: float


@dataclass(frozen=True)
class PanelRect:
    id: str
    x: float
    y: float
    width: float
    height: float
    radii: Dict[str, CornerRadius]


def _corner_radius(panel: dict, corner: str) -> CornerRadius:
    raw = (panel.get("radii") or {}).get(corner) or {"x": 0.0, "y": 0.0}
    return CornerRadius(float(raw.get("x", 0.0)), float(raw.get("y", 0.0)))


def panel_from_dict(panel: dict) -> PanelRect:
    return PanelRect(
        id=str(panel["id"]),
        x=float(panel["x"]),
        y=float(panel["y"]),
        width=float(panel["width"]),
        height=float(panel["height"]),
        radii={
            "topLeft": _corner_radius(panel, "topLeft"),
            "topRight": _corner_radius(panel, "topRight"),
            "bottomRight": _corner_radius(panel, "bottomRight"),
            "bottomLeft": _corner_radius(panel, "bottomLeft"),
        },
    )


def css_point_to_world(css_x: float, css_y: float, css_width: float, css_height: float, units_per_css_pixel: float) -> Point2:
    """Map browser CSS coordinates to Blender XY coordinates.

    Browser: origin top-left, +Y down.
    Blender scene: origin center, +Y up, interface on XY plane.
    """
    return (
        (css_x - css_width / 2.0) * units_per_css_pixel,
        (css_height / 2.0 - css_y) * units_per_css_pixel,
    )


def css_point_to_uv(css_x: float, css_y: float, css_width: float, css_height: float) -> UV:
    return (css_x / css_width, 1.0 - (css_y / css_height))


def panel_center_world(panel: dict, layout: dict, units_per_css_pixel: float) -> Point2:
    p = panel_from_dict(panel)
    return css_point_to_world(
        p.x + p.width / 2.0,
        p.y + p.height / 2.0,
        float(layout["cssWidth"]),
        float(layout["cssHeight"]),
        units_per_css_pixel,
    )


def _clamped_radius_pair(radius: CornerRadius, width: float, height: float) -> CornerRadius:
    max_r = max(0.0, min(width, height) / 2.0)
    return CornerRadius(min(max(radius.x, 0.0), max_r), min(max(radius.y, 0.0), max_r))


def rounded_rect_css_boundary(panel: dict, segments_per_corner: int = 8) -> List[Point2]:
    """Return CSS-space points around a rounded rectangle.

    The output follows the browser coordinate system. It starts on the top edge near the
    top-right corner and proceeds clockwise in CSS space. Corners use per-corner radii;
    v1 normally supplies circular radii, but this function supports x/y pairs.
    """
    if segments_per_corner < 1:
        raise ValueError("segments_per_corner must be >= 1")

    p = panel_from_dict(panel)
    x0, y0, w, h = p.x, p.y, p.width, p.height
    x1, y1 = x0 + w, y0 + h
    r_tl = _clamped_radius_pair(p.radii["topLeft"], w, h)
    r_tr = _clamped_radius_pair(p.radii["topRight"], w, h)
    r_br = _clamped_radius_pair(p.radii["bottomRight"], w, h)
    r_bl = _clamped_radius_pair(p.radii["bottomLeft"], w, h)

    corners = [
        # center x/y, rx, ry, start angle, end angle in CSS coordinate space
        (x1 - r_tr.x, y0 + r_tr.y, r_tr.x, r_tr.y, -pi / 2.0, 0.0),
        (x1 - r_br.x, y1 - r_br.y, r_br.x, r_br.y, 0.0, pi / 2.0),
        (x0 + r_bl.x, y1 - r_bl.y, r_bl.x, r_bl.y, pi / 2.0, pi),
        (x0 + r_tl.x, y0 + r_tl.y, r_tl.x, r_tl.y, pi, 3.0 * pi / 2.0),
    ]

    pts: List[Point2] = []
    for cx, cy, rx, ry, start, end in corners:
        if rx == 0.0 or ry == 0.0:
            # Degenerate corner: use the actual sharp corner point.
            if start == -pi / 2.0:
                corner = (x1, y0)
            elif start == 0.0:
                corner = (x1, y1)
            elif start == pi / 2.0:
                corner = (x0, y1)
            else:
                corner = (x0, y0)
            if not pts or pts[-1] != corner:
                pts.append(corner)
            continue
        for i in range(segments_per_corner + 1):
            t = i / segments_per_corner
            angle = start + (end - start) * t
            pt = (cx + rx * cos(angle), cy + ry * sin(angle))
            if not pts or abs(pts[-1][0] - pt[0]) > 1e-9 or abs(pts[-1][1] - pt[1]) > 1e-9:
                pts.append(pt)
    # Remove duplicate closing point if present.
    if len(pts) > 1 and abs(pts[0][0] - pts[-1][0]) < 1e-9 and abs(pts[0][1] - pts[-1][1]) < 1e-9:
        pts.pop()
    return pts


def skin_mesh_data(panel: dict, layout: dict, units_per_css_pixel: float, segments_per_corner: int = 8):
    css_w = float(layout["cssWidth"])
    css_h = float(layout["cssHeight"])
    boundary_css = rounded_rect_css_boundary(panel, segments_per_corner)
    vertices: List[Point3] = []
    uvs: List[UV] = []
    for css_x, css_y in boundary_css:
        wx, wy = css_point_to_world(css_x, css_y, css_w, css_h, units_per_css_pixel)
        vertices.append((wx, wy, 0.0))
        uvs.append(css_point_to_uv(css_x, css_y, css_w, css_h))
    return {
        "vertices": vertices,
        "faces": [list(range(len(vertices)))],
        "face_uvs": [uvs],
    }


def body_mesh_data(panel: dict, layout: dict, units_per_css_pixel: float, segments_per_corner: int = 8):
    """Create a normalized body mesh with local z from 0 to 1.

    Scaling object.scale.z to current_depth keeps the back plane glued to z=0.
    """
    skin = skin_mesh_data(panel, layout, units_per_css_pixel, segments_per_corner)
    front = skin["vertices"]
    n = len(front)
    vertices: List[Point3] = [(x, y, 0.0) for (x, y, _z) in front] + [(x, y, 1.0) for (x, y, _z) in front]

    faces: List[List[int]] = []
    # Back face reversed so normals generally face downward/back.
    faces.append(list(reversed(range(n))))
    # Front face.
    faces.append([i + n for i in range(n)])
    # Side quads.
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, j + n, i + n])
    return {"vertices": vertices, "faces": faces}


def panel_depth_at_frame(frame: int, start: int, peak: int, retract_start: int, retract_end: int, max_depth: float) -> float:
    """Smoothstep depth envelope for one panel."""
    def smoothstep(t: float) -> float:
        t = max(0.0, min(1.0, t))
        return t * t * (3.0 - 2.0 * t)

    if frame < start:
        return 0.0
    if frame <= peak:
        return max_depth * smoothstep((frame - start) / max(1, peak - start))
    if frame < retract_start:
        return max_depth
    if frame <= retract_end:
        return max_depth * (1.0 - smoothstep((frame - retract_start) / max(1, retract_end - retract_start)))
    return 0.0


def schedule_for_order(
    order: Sequence[str],
    frames_per_section: int = 132,
    extrude_offset: int = 18,
    rise_duration: int = 58,
    reveal_hold: int = 34,
    retract_duration: int = 14,
):
    """Return per-section timing for a surface-skim/pop-out/reveal beat.

    The intended rhythm is:
      approachStart -> camera begins low/far from target
      extrudeStart  -> panel starts rising while camera is still approaching
      peakFrame     -> panel is fully raised; camera begins/finishes reveal
      retractStart  -> camera holds reveal while panel stays raised
      retractEnd    -> panel snaps back down; camera can dive to surface

    frames_per_section should be long enough to contain all phases. If it is too
    short, the retraction is clamped to finish at the section boundary.
    """
    schedule = {}
    for index, section_id in enumerate(order):
        base = index * frames_per_section
        peak = base + extrude_offset + rise_duration
        retract_start = peak + reveal_hold
        retract_end = retract_start + retract_duration
        section_end = base + frames_per_section
        if retract_end > section_end:
            retract_end = section_end
            retract_start = max(peak, retract_end - retract_duration)
        schedule[section_id] = {
            "approachStart": base,
            "extrudeStart": base + extrude_offset,
            "peakFrame": peak,
            "retractStart": retract_start,
            "retractEnd": retract_end,
            "sectionEnd": section_end,
        }
    return schedule
