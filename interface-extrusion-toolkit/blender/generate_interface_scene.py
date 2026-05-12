#!/usr/bin/env python3
"""Generate a Blender raised-interface-panel scene from interface.png + layout.json.

This version intentionally focuses on a *single-section animatic* camera solver.
It keeps all interface panels present for context, but only one focus panel
(default: first sectionOrder entry, usually wavetable) protrudes. The camera uses
a Track To target and an adaptively reduced set of keyframes, not frame-by-frame
baked camera location/rotation. The generator first samples the smooth reference
flight path, then keeps only the control keyframes required to stay within a
configurable approximation error.

Run from Blender, for example:
  Blender --background --python blender/generate_interface_scene.py -- \
    --manifest cosimo-capture.json \
    --layout captures/cosimo-synth/layout.json \
    --image captures/cosimo-synth/interface.png \
    --output out/cosimo-synth.blend
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

from interface_geometry import (  # noqa: E402
    body_mesh_data,
    css_point_to_world,
    panel_center_world,
    skin_mesh_data,
)

try:
    import bpy  # type: ignore
    from mathutils import Vector  # type: ignore
    from bpy_extras.object_utils import world_to_camera_view  # type: ignore
except ImportError as exc:  # pragma: no cover
    raise SystemExit("This script must be run with Blender's Python interpreter") from exc


# -----------------------------------------------------------------------------
# CLI / basic scene setup
# -----------------------------------------------------------------------------

def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--layout", required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--frames", default=None, help="Optional render output path for frame sequence")
    return parser.parse_args(argv)


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def set_render_engine(scene):
    valid = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    if "BLENDER_EEVEE" in valid:
        scene.render.engine = "BLENDER_EEVEE"
    elif "BLENDER_EEVEE_NEXT" in valid:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    else:
        scene.render.engine = "CYCLES"


def configure_timeline(manifest):
    scene = bpy.context.scene
    anim = manifest.get("animation", {})
    fps = int(anim.get("fps", 30))
    duration = int(anim.get("animaticDurationFrames", anim.get("durationFrames", 340)))
    scene.frame_start = 0
    scene.frame_end = duration
    scene.render.fps = fps
    scene.render.resolution_x = int(anim.get("resolutionX", 1080))
    scene.render.resolution_y = int(anim.get("resolutionY", 1920))


# -----------------------------------------------------------------------------
# Mesh + material helpers
# -----------------------------------------------------------------------------

def make_mesh_object(name, vertices, faces, material=None, face_uvs=None, uv_name="UVMap"):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if material is not None:
        obj.data.materials.append(material)
    if face_uvs is not None:
        uv_layer = mesh.uv_layers.new(name=uv_name)
        for poly_index, poly in enumerate(mesh.polygons):
            poly_uvs = face_uvs[poly_index]
            if len(poly_uvs) != poly.loop_total:
                raise ValueError(f"UV count mismatch for {name} polygon {poly_index}")
            for loop_offset, loop_index in enumerate(poly.loop_indices):
                uv_layer.data[loop_index].uv = poly_uvs[loop_offset]
        mesh.uv_layers.active = uv_layer
    return obj


def create_interface_material(image_path):
    image = bpy.data.images.load(str(image_path))
    mat = bpy.data.materials.new("Material_InterfaceSkin")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    image_node = nodes.new(type="ShaderNodeTexImage")
    image_node.name = "Interface PNG"
    image_node.image = image
    texcoord = nodes.new(type="ShaderNodeTexCoord")
    links.new(texcoord.outputs["UV"], image_node.inputs["Vector"])
    if bsdf is not None:
        if "Base Color" in bsdf.inputs:
            links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
        if "Alpha" in bsdf.inputs:
            links.new(image_node.outputs["Alpha"], bsdf.inputs["Alpha"])
        if "Emission Color" in bsdf.inputs:
            # Subtle self-lighting keeps UI readable even with dramatic camera moves.
            links.new(image_node.outputs["Color"], bsdf.inputs["Emission Color"])
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 0.18
    mat.blend_method = "BLEND"
    return mat


def create_body_material():
    mat = bpy.data.materials.new("Material_PanelBody_Dark")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is not None:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = (0.012, 0.014, 0.018, 1.0)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.38
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.18
    return mat


def create_debug_material(name, rgba):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba
    return mat


def add_weighted_normal(obj):
    try:
        mod = obj.modifiers.new("Weighted_Normal", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
        return mod
    except Exception:
        return None


def create_base_interface(layout, units, interface_mat):
    css_w = float(layout["cssWidth"])
    css_h = float(layout["cssHeight"])
    left, top = css_point_to_world(0, 0, css_w, css_h, units)
    right, bottom = css_point_to_world(css_w, css_h, css_w, css_h, units)
    vertices = [
        (left, top, -0.002),
        (right, top, -0.002),
        (right, bottom, -0.002),
        (left, bottom, -0.002),
    ]
    faces = [[0, 1, 2, 3]]
    face_uvs = [[(0, 1), (1, 1), (1, 0), (0, 0)]]
    return make_mesh_object("BaseInterface", vertices, faces, interface_mat, face_uvs)


# -----------------------------------------------------------------------------
# Panel creation and focus-panel animation
# -----------------------------------------------------------------------------

def _panel_world_size(panel, units):
    return (float(panel["width"]) * units, float(panel["height"]) * units)


def _panel_depth_for(panel, manifest, units):
    anim = manifest.get("animation", {})
    width, height = _panel_world_size(panel, units)
    # This is a monolith/building metaphor, so height is intentionally huge.
    # Use panel height as the canonical scale, not an arbitrary scene depth.
    ratio = float(anim.get("blockHeightPanelRatio", anim.get("blockHeightRatio", 4.0)))
    floor_depth = float(anim.get("maxDepth", 0.35))
    return max(floor_depth, height * ratio)


def _animatic_frames(manifest):
    anim = manifest.get("animation", {})
    cruise = int(anim.get("surfaceCruiseFrames", 70))
    approach = int(anim.get("approachFrames", 115))
    climb = int(anim.get("wallClimbFrames", 58))
    hold = int(anim.get("revealHoldFrames", 24))
    retract = int(anim.get("retractDurationFrames", anim.get("retractFrames", 14)))
    dive = int(anim.get("diveFrames", 82))
    lift_start = cruise + approach
    apex = lift_start + climb
    hold_end = apex + hold
    retract_end = hold_end + retract
    dive_end = retract_end + dive
    return {
        "start": 0,
        "cruiseEnd": cruise,
        "liftStart": lift_start,
        "apex": apex,
        "holdEnd": hold_end,
        "retractEnd": retract_end,
        "diveEnd": dive_end,
        "duration": dive_end,
        "riseStart": int(anim.get("extrudeOffsetFrames", 10)),
        # Nearly full at liftStart, fully raised shortly into wall climb.
        "riseEnd": lift_start + int(anim.get("riseIntoClimbFrames", max(6, climb * 0.18))),
    }


def _smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def _ease_in_out_cubic(t):
    t = max(0.0, min(1.0, t))
    if t < 0.5:
        return 4.0 * t * t * t
    return 1.0 - pow(-2.0 * t + 2.0, 3) / 2.0


def _panel_depth_at(frame, frames, depth):
    if frame < frames["riseStart"]:
        return 0.0001
    if frame <= frames["riseEnd"]:
        return max(0.0001, depth * _smoothstep((frame - frames["riseStart"]) / max(1, frames["riseEnd"] - frames["riseStart"])))
    if frame <= frames["holdEnd"]:
        return depth
    if frame <= frames["retractEnd"]:
        return max(0.0001, depth * (1.0 - _smoothstep((frame - frames["holdEnd"]) / max(1, frames["retractEnd"] - frames["holdEnd"]))))
    return 0.0001


def _insert_focus_panel_keyframes(body, skin, frames, depth, epsilon):
    """Key the extrusion as a small set of control beats.

    The previous versions baked panel depth every frame. For this animatic we keep
    the same timing intent, but the actual extrusion is a normal keyed animation:
    flat -> full height -> short hold -> fast retract. Blender's default Bezier
    interpolation supplies the ease.
    """
    key_depths = [
        (frames["start"], 0.0001),
        (frames["riseStart"], 0.0001),
        (frames["riseEnd"], depth),
        (frames["holdEnd"], depth),
        (frames["retractEnd"], 0.0001),
        (frames["diveEnd"], 0.0001),
    ]
    for frame, current_depth in key_depths:
        body.scale.z = current_depth
        body.keyframe_insert(data_path="scale", frame=frame)
        skin.location.z = current_depth + epsilon
        skin.keyframe_insert(data_path="location", frame=frame)


def create_panels(layout, manifest, interface_mat, body_mat):
    units = float(manifest.get("world", {}).get("unitsPerCssPixel", 0.01))
    segments = int(manifest.get("geometry", {}).get("segmentsPerCorner", 8))
    epsilon = float(manifest.get("geometry", {}).get("skinEpsilon", 0.003))
    anim = manifest.get("animation", {})
    order = anim.get("sectionOrder") or [s["id"] for s in layout["sections"]]
    focus = anim.get("focusSection") or anim.get("singleSection") or order[0]
    frames = _animatic_frames(manifest)
    section_by_id = {s["id"]: s for s in layout["sections"]}
    if focus not in section_by_id:
        raise ValueError(f"focusSection {focus!r} is not present in layout.json sections")

    created = {}
    for section_id in order:
        panel = section_by_id[section_id]
        panel_depth = _panel_depth_for(panel, manifest, units)
        body_data = body_mesh_data(panel, layout, units, segments)
        body = make_mesh_object(f"Body_{section_id}", body_data["vertices"], body_data["faces"], body_mat)
        add_weighted_normal(body)
        body.scale.z = 0.0001

        skin_data = skin_mesh_data(panel, layout, units, segments)
        skin = make_mesh_object(
            f"Skin_{section_id}",
            skin_data["vertices"],
            skin_data["faces"],
            interface_mat,
            skin_data["face_uvs"],
        )
        skin.location.z = epsilon

        if section_id == focus:
            _insert_focus_panel_keyframes(body, skin, frames, panel_depth, epsilon)
        else:
            # Keep non-focus panels as flat context, with one key so they stay stable.
            body.scale.z = 0.0001
            skin.location.z = epsilon
            body.keyframe_insert(data_path="scale", frame=0)
            skin.keyframe_insert(data_path="location", frame=0)

        created[section_id] = {
            "body": body,
            "skin": skin,
            "panel": panel,
            "depth": panel_depth,
            "is_focus": section_id == focus,
        }
    return created


# -----------------------------------------------------------------------------
# Camera solver utilities
# -----------------------------------------------------------------------------

def _norm2(dx, dy):
    length = math.sqrt(dx * dx + dy * dy)
    if length < 1e-9:
        return (1.0, 0.0)
    return (dx / length, dy / length)


def _perp(dx, dy):
    return (-dy, dx)


def _mix(a, b, t):
    return a + (b - a) * t


def _mix3(a, b, t):
    return (_mix(a[0], b[0], t), _mix(a[1], b[1], t), _mix(a[2], b[2], t))


def _bezier3(p0, p1, p2, p3, t):
    t = max(0.0, min(1.0, t))
    u = 1.0 - t
    return (
        u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
        u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1],
        u*u*u*p0[2] + 3*u*u*t*p1[2] + 3*u*t*t*p2[2] + t*t*t*p3[2],
    )




def _catmull_rom(p0, p1, p2, p3, t):
    """Uniform Catmull-Rom point. Used only as a smooth path shaper; arc-length
    sampling below keeps speed from changing abruptly between cruise and climb.
    """
    t = max(0.0, min(1.0, t))
    t2 = t * t
    t3 = t2 * t
    return (
        0.5 * ((2*p1[0]) + (-p0[0] + p2[0]) * t + (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0]) * t2 + (-p0[0] + 3*p1[0] - 3*p2[0] + p3[0]) * t3),
        0.5 * ((2*p1[1]) + (-p0[1] + p2[1]) * t + (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1]) * t2 + (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1]) * t3),
        0.5 * ((2*p1[2]) + (-p0[2] + p2[2]) * t + (2*p0[2] - 5*p1[2] + 4*p2[2] - p3[2]) * t2 + (-p0[2] + 3*p1[2] - 3*p2[2] + p3[2]) * t3),
    )


def _path_distance(a, b):
    return math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)


def _build_arc_length_path(waypoints, samples_per_segment=32):
    """Return a dense, arc-length-indexed path. This avoids the previous
    discontinuity where the low cruise and ascent were two separate Beziers
    with incompatible tangents/speeds.
    """
    pts = [tuple(map(float, p)) for p in waypoints]
    if len(pts) < 2:
        raise ValueError("Need at least two waypoints")
    padded = [pts[0]] + pts + [pts[-1]]
    dense = []
    for i in range(1, len(padded) - 2):
        p0, p1, p2, p3 = padded[i-1], padded[i], padded[i+1], padded[i+2]
        for j in range(samples_per_segment):
            t = j / float(samples_per_segment)
            if dense and j == 0:
                continue
            dense.append(_catmull_rom(p0, p1, p2, p3, t))
    dense.append(pts[-1])
    cumulative = [0.0]
    for i in range(1, len(dense)):
        cumulative.append(cumulative[-1] + _path_distance(dense[i-1], dense[i]))
    return {"points": dense, "cumulative": cumulative, "length": cumulative[-1]}


def _sample_arc_length_path(table, t):
    t = max(0.0, min(1.0, t))
    points = table["points"]
    cumulative = table["cumulative"]
    total = table["length"]
    if total <= 1e-9:
        return points[0]
    target = t * total
    lo, hi = 0, len(cumulative) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if cumulative[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    i = max(1, lo)
    prev_d = cumulative[i-1]
    next_d = cumulative[i]
    local = 0.0 if next_d <= prev_d else (target - prev_d) / (next_d - prev_d)
    return _mix3(points[i-1], points[i], local)


def _path_tangent(table, t, eps=0.004):
    a = _sample_arc_length_path(table, max(0.0, t - eps))
    b = _sample_arc_length_path(table, min(1.0, t + eps))
    v = Vector((b[0]-a[0], b[1]-a[1], b[2]-a[2]))
    if v.length < 1e-9:
        return Vector((1.0, 0.0, 0.0))
    v.normalize()
    return v

def _interface_bounds(layout, units):
    css_w = float(layout["cssWidth"])
    css_h = float(layout["cssHeight"])
    left, top = css_point_to_world(0, 0, css_w, css_h, units)
    right, bottom = css_point_to_world(css_w, css_h, css_w, css_h, units)
    return {
        "left": min(left, right),
        "right": max(left, right),
        "bottom": min(bottom, top),
        "top": max(bottom, top),
        "width": abs(right - left),
        "height": abs(top - bottom),
    }


def _point_inside_bounds(x, y, bounds, margin=0.0):
    return (
        min(max(x, bounds["left"] + margin), bounds["right"] - margin),
        min(max(y, bounds["bottom"] + margin), bounds["top"] - margin),
    )


def _ray_to_bounds(cx, cy, dx, dy, bounds, margin=0.0):
    candidates = []
    if abs(dx) > 1e-6:
        candidates.append((bounds["right"] - margin - cx) / dx)
        candidates.append((bounds["left"] + margin - cx) / dx)
    if abs(dy) > 1e-6:
        candidates.append((bounds["top"] - margin - cy) / dy)
        candidates.append((bounds["bottom"] + margin - cy) / dy)
    positive = [t for t in candidates if t > 0]
    if not positive:
        return _point_inside_bounds(cx + dx, cy + dy, bounds, margin)
    t = min(positive) * 0.96
    return _point_inside_bounds(cx + dx * t, cy + dy * t, bounds, margin)


def _direction_from_name(name):
    mapping = {
        "right": (1, 0),
        "left": (-1, 0),
        "top": (0, 1),
        "bottom": (0, -1),
        "top-right": (1, 1),
        "top-left": (-1, 1),
        "bottom-right": (1, -1),
        "bottom-left": (-1, -1),
        "upper-right": (1, 1),
        "upper-left": (-1, 1),
        "lower-right": (1, -1),
        "lower-left": (-1, -1),
    }
    return _norm2(*mapping.get(str(name).lower(), (1, -1)))


def _focus_approach_direction(focus, manifest):
    anim = manifest.get("animation", {})
    if "focusApproachFrom" in anim:
        return _direction_from_name(anim["focusApproachFrom"])
    route = anim.get("route") or []
    for entry in route:
        if isinstance(entry, dict) and entry.get("id") == focus and entry.get("approachFrom"):
            return _direction_from_name(entry["approachFrom"])
    # Caddy-corner default for wavetable/top-left card.
    return _direction_from_name("bottom-right")


def _set_camera_look_at(camera, location, target):
    loc = Vector(location)
    direction = Vector(target) - loc
    if direction.length < 1e-9:
        direction = Vector((0.0, 0.0, -1.0))
    camera.location = loc
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def _key_camera_frame(camera, frame, location, target):
    # Compatibility helper retained for direct-look debug use. The production
    # animatic below uses a Track To target and does not key camera rotation.
    _set_camera_look_at(camera, location, target)
    camera.keyframe_insert(data_path="location", frame=frame)
    camera.keyframe_insert(data_path="rotation_euler", frame=frame)


def _make_camera_target(name="CameraTarget"):
    target = bpy.data.objects.new(name, None)
    target.empty_display_type = "PLAIN_AXES"
    target.empty_display_size = 0.28
    bpy.context.collection.objects.link(target)
    return target


def _attach_track_to(camera, target):
    # Cameras look down local -Z. Explicit axes avoid sideways/upside-down Track To
    # behavior across Blender versions.
    constraint = camera.constraints.new(type="TRACK_TO")
    constraint.name = "Track_To_Animatic_Target"
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    return constraint


def _key_location(obj, frame, location):
    obj.location = Vector(location)
    obj.keyframe_insert(data_path="location", frame=frame)


def _interp3(a, b, t):
    return (
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    )


def _dist3(a, b):
    return math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)


def _simplify_sample_frames(samples, required_frames, camera_error=0.045, target_error=0.065, max_segment_frames=18):
    """Adaptive camera/target key reduction.

    `samples` is a dict frame -> (camera_location, look_target). We keep the
    fewest keyframes that approximate both camera position and target position
    under the given world-space error limits, while also enforcing a maximum
    segment length to preserve speed/pacing. This gives editable Blender
    keyframes rather than frame-by-frame baked motion.
    """
    ordered = sorted(samples)
    if len(ordered) <= 2:
        return ordered
    required = set(int(f) for f in required_frames if f in samples)
    required.add(ordered[0])
    required.add(ordered[-1])
    keep = set(required)

    def split_segment(a, b):
        if b - a <= max(1, max_segment_frames):
            return
        if a not in samples or b not in samples:
            return
        cam_a, look_a = samples[a]
        cam_b, look_b = samples[b]
        worst_frame = None
        worst_score = -1.0
        for f in ordered:
            if f <= a or f >= b:
                continue
            t = (f - a) / max(1, b - a)
            cam_ref, look_ref = samples[f]
            cam_lin = _interp3(cam_a, cam_b, t)
            look_lin = _interp3(look_a, look_b, t)
            cam_score = _dist3(cam_ref, cam_lin) / max(camera_error, 1e-6)
            look_score = _dist3(look_ref, look_lin) / max(target_error, 1e-6)
            score = max(cam_score, look_score)
            if score > worst_score:
                worst_score = score
                worst_frame = f
        if worst_frame is not None and worst_score > 1.0:
            keep.add(worst_frame)
            split_segment(a, worst_frame)
            split_segment(worst_frame, b)

    anchors = sorted(required)
    for a, b in zip(anchors, anchors[1:]):
        split_segment(a, b)

    # One more pass: enforce maximum segment length even if the path is straight.
    changed = True
    while changed:
        changed = False
        current = sorted(keep)
        for a, b in zip(current, current[1:]):
            if b - a > max_segment_frames:
                mid = (a + b) // 2
                # snap to an existing sampled frame
                mid = min(ordered, key=lambda f: abs(f - mid))
                if mid not in keep and a < mid < b:
                    keep.add(mid)
                    changed = True
    return sorted(keep)


def _set_action_interpolation_best_effort(obj, interpolation="BEZIER"):
    action = getattr(getattr(obj, "animation_data", None), "action", None)
    if action is None:
        return
    fcurves = getattr(action, "fcurves", None)
    if fcurves is None:
        # Blender 5.x moved F-curve access into slots/channelbags. Leaving the
        # default interpolation is safer than crashing.
        return
    for fcurve in fcurves:
        for key in fcurve.keyframe_points:
            key.interpolation = interpolation


def _panel_top_points(panel, layout, units, z, segments):
    data = skin_mesh_data(panel, layout, units, segments)
    return [(x, y, z) for (x, y, _z) in data["vertices"]]


def _projected_fill_y(scene, camera, points):
    bpy.context.view_layer.update()
    coords = [world_to_camera_view(scene, camera, Vector(p)) for p in points]
    in_front = [c for c in coords if c.z >= 0]
    if not in_front:
        return 0.0, True
    ys = [c.y for c in in_front]
    return (max(ys) - min(ys)), False


def _solve_reveal_pose(scene, camera, panel, layout, manifest, units, center, approach_dir, depth):
    anim = manifest.get("animation", {})
    segments = int(manifest.get("geometry", {}).get("segmentsPerCorner", 8))
    target_fill = float(anim.get("targetRevealFrameFill", 0.60))
    panel_w, panel_h = _panel_world_size(panel, units)
    panel_ref = max(panel_w, panel_h, 0.001)
    cx, cy = center
    dx, dy = approach_dir
    px, py = _perp(dx, dy)
    side_bias = float(anim.get("revealSideBiasPanelRatio", 0.18))
    altitude_ratio = float(anim.get("revealAltitudeBlockRatio", 1.24))
    # For a giant monolith, being slightly above the roof preserves the "looking down at top" beat.
    z = max(depth * altitude_ratio, depth + panel_ref * 0.25)
    look_target = (cx, cy, depth * 0.96)
    points = _panel_top_points(panel, layout, units, depth + 0.003, segments)

    def candidate(distance_mult):
        loc = (
            cx - dx * panel_ref * distance_mult + px * panel_ref * side_bias,
            cy - dy * panel_ref * distance_mult + py * panel_ref * side_bias,
            z,
        )
        _set_camera_look_at(camera, loc, look_target)
        fill, behind = _projected_fill_y(scene, camera, points)
        return loc, fill, behind

    low = 0.08
    high = float(anim.get("revealMaxDistancePanelRatio", 16.0))
    loc_low, fill_low, _ = candidate(low)
    loc_high, fill_high, _ = candidate(high)
    # Expand high if somehow still too close.
    while fill_high > target_fill and high < 80.0:
        high *= 1.6
        loc_high, fill_high, _ = candidate(high)
    # If even the close candidate is too small, use the closest candidate.
    if fill_low < target_fill:
        return loc_low, look_target, fill_low

    best_loc, best_fill = loc_high, fill_high
    for _ in range(28):
        mid = (low + high) / 2.0
        loc, fill, _behind = candidate(mid)
        best_loc, best_fill = loc, fill
        if fill > target_fill:
            low = mid
        else:
            high = mid
    return best_loc, look_target, best_fill


# -----------------------------------------------------------------------------
# Debug path and validation helpers
# -----------------------------------------------------------------------------

def _create_curve_path(name, points, material):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = 0.018
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (co[0], co[1], co[2], 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def _make_empty(name, location, size=0.22):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = size
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


def _add_debug_markers(markers):
    for name, loc in markers:
        _make_empty(f"DEBUG_BEAT_{name}", loc, size=0.18)


def _validate_focus_shot(scene, camera, panel, layout, manifest, units, frames, samples, depth):
    """Validate framing using the actual Blender keyframed camera/target state.

    The reference `samples` are only used for labels/lookup; before measuring we
    set the scene frame so Blender evaluates the Track To constraint and keyframe
    interpolation.
    """
    anim = manifest.get("animation", {})
    segments = int(manifest.get("geometry", {}).get("segmentsPerCorner", 8))
    start_points = _panel_top_points(panel, layout, units, 0.003, segments)
    reveal_points = _panel_top_points(panel, layout, units, depth + 0.003, segments)
    checks = [
        ("start", frames["start"], start_points, float(anim.get("targetStartFrameFill", 0.10))),
        ("lift_start", frames["liftStart"], reveal_points, None),
        ("apex_reveal", frames["apex"], reveal_points, float(anim.get("targetRevealFrameFill", 0.60))),
        ("hold_end", frames["holdEnd"], reveal_points, float(anim.get("targetRevealFrameFill", 0.60))),
        ("dive_end", frames["diveEnd"], start_points, None),
    ]
    print("\n=== Keyframed single-section animatic validation ===")
    for label, frame, points, target in checks:
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        fill, behind = _projected_fill_y(scene, camera, points)
        target_text = f" target≈{target:.3f}" if target is not None else ""
        behind_text = " BEHIND_CAMERA" if behind else ""
        print(f"{label:>12s} frame={frame:4d} projected_height={fill:.3f}{target_text}{behind_text}")
    print(f"focus depth={depth:.3f} world units")
    print("===============================================\n")


# -----------------------------------------------------------------------------
# Single-section animatic camera solver
# -----------------------------------------------------------------------------

def _downward_surface_look(location, forward, panel_ref, surface_z=0.0, ahead_ratio=1.05):
    """Look forward and down during pod-racer cruise. A shorter look-ahead
    makes the camera pitch downward more, revealing more of the interface while
    still travelling forward.
    """
    return (
        location[0] + forward[0] * panel_ref * ahead_ratio,
        location[1] + forward[1] * panel_ref * ahead_ratio,
        surface_z,
    )


def _clamp_not_above_camera(target, loc, max_above=0.08):
    """Avoid the camera staring upward during low cruise unless the climb has begun."""
    if target[2] > loc[2] + max_above:
        return (target[0], target[1], loc[2] + max_above)
    return target


def _camera_sample_for_frame(frame, frames, path):
    """Return a baked camera sample.

    The cruise, pre-climb, wall-climb, and apex reveal are now one continuous
    arc-length-sampled spline. This removes the hard seam where the previous
    version suddenly changed from flat cruise to vertical ascent.
    """
    # Continuous cruise -> ascent -> apex. The path itself is a single curve,
    # sampled by arc length so the surface cruise and climb do not have wildly
    # different apparent speeds.
    if frame <= frames["apex"]:
        p = frame / max(1, frames["apex"])
        loc = _sample_arc_length_path(path["ascentPath"], p)

        depth_now = _panel_depth_at(frame, frames, path["depth"])
        surface_look = _downward_surface_look(
            loc,
            path["forward"],
            path["panelRef"],
            0.0,
            path.get("surfaceLookAhead", 1.05),
        )
        lower_wall = (path["frontWall"].x, path["frontWall"].y, max(path["skim"] * 0.25, depth_now * 0.22))
        upper_wall = (path["frontWall"].x, path["frontWall"].y, max(path["skim"] * 0.35, depth_now * 0.82))
        roof = path["topFaceLook"]

        # Continuous target blend: surface-ahead -> lower/upper wall -> roof.
        # No hard target swap at the top.
        wall_target = _mix3(lower_wall, upper_wall, _smoothstep((p - 0.50) / 0.28))
        look = _mix3(surface_look, wall_target, _smoothstep((p - 0.28) / 0.48))
        look = _mix3(look, roof, _smoothstep((p - 0.76) / 0.24))

        # Cruise should point downward. Do not allow meaningful upward staring
        # before the ascent has naturally begun.
        if p < 0.58:
            look = _clamp_not_above_camera(look, loc, max_above=path["skim"] * 0.12)
        return loc, look

    # Gentle reveal drift instead of a frozen apex. This prevents a sudden stop
    # and gives the orientation time to settle into the downward top-face view.
    if frame <= frames["holdEnd"]:
        t = (frame - frames["apex"]) / max(1, frames["holdEnd"] - frames["apex"])
        te = _smoothstep(t)
        loc = _mix3(path["apex"], path["apexDrift"], te)
        look = _mix3(path["apexLook"], path["topFaceLook"], te)
        return loc, look

    if frame <= frames["retractEnd"]:
        t = (frame - frames["holdEnd"]) / max(1, frames["retractEnd"] - frames["holdEnd"])
        te = _smoothstep(t)
        loc = path["apexDrift"]
        # Rotate toward the dive target gradually while the monolith retracts.
        look_z = _mix(path["depth"] * 0.92, path["skim"] * 0.15, te)
        look_xy = _mix3(path["topFaceLook"], path["diveGroundLook"], te)
        return loc, (look_xy[0], look_xy[1], look_z)

    # Dive recovery: continue from the reveal drift tangent, then round out to a
    # low surface cruise. This avoids the top-of-ascent jerk.
    t = (frame - frames["retractEnd"]) / max(1, frames["diveEnd"] - frames["retractEnd"])
    te = _ease_in_out_cubic(t)
    loc = _bezier3(path["apexDrift"], path["diveP1"], path["diveP2"], path["exit"], te)
    if t < 0.55:
        look = _mix3(path["diveGroundLook"], path["diveMidLook"], _smoothstep(t / 0.55))
    else:
        look = _mix3(path["diveMidLook"], path["exitLook"], _smoothstep((t - 0.55) / 0.45))
    return loc, look

def add_camera_rig(layout, manifest, panels):
    scene = bpy.context.scene
    units = float(manifest.get("world", {}).get("unitsPerCssPixel", 0.01))
    anim = manifest.get("animation", {})
    order = anim.get("sectionOrder") or list(panels.keys())
    focus = anim.get("focusSection") or anim.get("singleSection") or order[0]
    if focus not in panels:
        raise ValueError(f"focusSection {focus!r} is not present in panels")

    frames = _animatic_frames(manifest)
    scene.frame_start = 0
    scene.frame_end = int(anim.get("animaticDurationFrames", frames["diveEnd"]))

    section_by_id = {s["id"]: s for s in layout["sections"]}
    panel = section_by_id[focus]
    depth = float(panels[focus]["depth"])
    panel_w, panel_h = _panel_world_size(panel, units)
    panel_ref = max(panel_w, panel_h, 0.001)
    panel_min = max(min(panel_w, panel_h), 0.001)
    half_w = panel_w * 0.5
    half_h = panel_h * 0.5
    cx, cy = panel_center_world(panel, layout, units)
    bounds = _interface_bounds(layout, units)
    margin = min(bounds["width"], bounds["height"]) * float(anim.get("interfaceEdgeMarginRatio", 0.035))

    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera_data.lens = float(anim.get("lensMm", 20.0))
    scene.camera = camera

    # A = vector from target center to the approach/staging side.
    ax, ay = _focus_approach_direction(focus, manifest)
    # F = forward travel direction from the staging side toward/over the panel.
    fx, fy = (-ax, -ay)
    # Side vector creates a flyby lane so the camera path never enters the wall.
    sx_vec, sy_vec = _perp(fx, fy)
    side_sign = float(anim.get("laneSideSign", 1.0))
    sx_vec *= side_sign
    sy_vec *= side_sign

    # Raise cruising altitude relative to the prior attempt. This is still a
    # macro skim, but more motorcycle-height than scraping-the-floor height.
    base_skim = max(float(anim.get("minSkimAltitude", 0.025)), panel_min * float(anim.get("skimHeightPanelRatio", 0.026)))
    skim = base_skim * float(anim.get("cruiseAltitudeBoost", 2.25))

    # Exact obstacle footprint math for an axis-aligned rectangle. The lane sits
    # outside the panel footprint on the approach side and offset sideways.
    approach_extent = abs(ax) * half_w + abs(ay) * half_h
    side_extent = abs(sx_vec) * half_w + abs(sy_vec) * half_h
    wall_clearance = panel_ref * float(anim.get("wallClearancePanelRatio", 0.22))
    side_clearance = panel_ref * float(anim.get("laneSideClearancePanelRatio", 0.18))
    front_distance = approach_extent + wall_clearance
    side_offset = side_extent + side_clearance

    center_v = Vector((cx, cy, 0.0))
    A = Vector((ax, ay, 0.0))
    F = Vector((fx, fy, 0.0))
    S = Vector((sx_vec, sy_vec, 0.0))

    # Start far on the real interface, but on the same side-lane used for the
    # flyby. No apron is created.
    staging_seed = center_v + A * (front_distance + panel_ref * 1.0) + S * side_offset
    # Project the staging seed outward to the interface bounds along A, then add
    # side offset again and clamp to real surface bounds.
    start_main = _ray_to_bounds(staging_seed.x, staging_seed.y, ax, ay, bounds, margin)
    start_xy = _point_inside_bounds(start_main[0] + sx_vec * side_offset * 0.35, start_main[1] + sy_vec * side_offset * 0.35, bounds, margin)

    # Climb starts outside the wall footprint. This is the collision-awareness the
    # previous generator was missing.
    climb_base = center_v + A * front_distance + S * side_offset
    climb_base_xy = _point_inside_bounds(climb_base.x, climb_base.y, bounds, margin * 0.35)
    climb_base = Vector((climb_base_xy[0], climb_base_xy[1], 0.0))

    # Front wall point the camera looks at while climbing. It is on the wall face,
    # but camera position remains outside by wall_clearance.
    front_wall = center_v + A * (approach_extent * 0.96) + S * (side_offset * 0.35)

    # Low approach bezier: long surface cruise that starts low and only begins to
    # rise near the end. Control points are side-lane points, not center points.
    start = (start_xy[0], start_xy[1], skim)
    lift_z = max(skim * 1.75, depth * float(anim.get("preClimbHeightRatio", 0.18)))
    lift = (climb_base.x, climb_base.y, lift_z)
    approach_p1_v = Vector((start[0], start[1], 0.0)) + F * (panel_ref * float(anim.get("approachP1ForwardPanelRatio", 0.9))) + S * (panel_ref * 0.18)
    approach_p2_v = climb_base - F * (panel_ref * float(anim.get("approachP2BackPanelRatio", 0.95))) + S * (panel_ref * 0.10)
    ap1 = _point_inside_bounds(approach_p1_v.x, approach_p1_v.y, bounds, margin)
    ap2 = _point_inside_bounds(approach_p2_v.x, approach_p2_v.y, bounds, margin)
    approach_p1 = (ap1[0], ap1[1], skim * 1.04)
    approach_p2 = (ap2[0], ap2[1], skim * 1.10)

    # Apex solve: above and beyond the tower, looking down at the top face. The
    # solver uses frame-fill, but path controls ensure we approach via the lane.
    apex_loc, apex_look, solved_reveal_fill = _solve_reveal_pose(
        scene, camera, panel, layout, manifest, units, (cx, cy), (ax, ay), depth
    )
    # Nudge apex toward the side lane to preserve flyby/overshoot feel.
    apex_side = float(anim.get("apexSideLaneBlend", 0.28))
    apex_loc = (
        apex_loc[0] + sx_vec * side_offset * apex_side,
        apex_loc[1] + sy_vec * side_offset * apex_side,
        apex_loc[2],
    )

    # Wall climb controls: first mostly vertical outside the footprint, then crest
    # over the top only once z is already above monolith height.
    wall_p1 = (climb_base.x, climb_base.y, max(lift_z, depth * 0.42))
    wall_p2_v = center_v + A * (approach_extent + wall_clearance * 0.25) + S * (side_offset * 0.72) + Vector((0, 0, max(depth * 1.03, lift_z)))
    wall_p2 = (wall_p2_v.x, wall_p2_v.y, wall_p2_v.z)

    # Build one continuous cruise->ascent spline. The old generator had a seam
    # here; this path uses Catmull-Rom shaping plus arc-length sampling so the
    # camera naturally arcs upward instead of taking a sharp turn.
    smooth_samples = int(anim.get("ascentPathSamplesPerSegment", 48))
    ascent_waypoints = [
        start,
        approach_p1,
        approach_p2,
        (lift[0], lift[1], max(skim * 1.18, depth * 0.10)),
        (wall_p1[0], wall_p1[1], max(skim * 2.0, depth * 0.38)),
        (wall_p2[0], wall_p2[1], max(depth * 0.82, skim * 2.5)),
        apex_loc,
    ]
    ascent_path = _build_arc_length_path(ascent_waypoints, smooth_samples)
    apex_tangent = _path_tangent(ascent_path, 1.0)

    drift_amount = panel_ref * float(anim.get("apexDriftPanelRatio", 0.22))
    apex_drift_v = Vector(apex_loc) + apex_tangent * drift_amount
    # Keep the reveal drift high; it is a gentle continuation, not a dive yet.
    apex_drift_v.z = max(apex_drift_v.z, apex_loc[2] * 0.96)
    apex_drift = (apex_drift_v.x, apex_drift_v.y, apex_drift_v.z)

    # Exit/dive stays on actual interface bounds. This is just a recovery point
    # for the single-section animatic, not the next-section route yet.
    exit_xy = _ray_to_bounds(cx, cy, fx, fy, bounds, margin)
    ex, ey = exit_xy
    dive_ground_v = center_v + F * (panel_ref * 0.82) + S * (side_offset * 0.10)
    dive_ground = _point_inside_bounds(dive_ground_v.x, dive_ground_v.y, bounds, margin)

    dive_p1_v = Vector(apex_drift) + apex_tangent * (panel_ref * float(anim.get("diveCarryForwardPanelRatio", 0.45)))
    dive_p1 = (
        dive_p1_v.x,
        dive_p1_v.y,
        max(dive_p1_v.z, apex_drift[2] * 0.84),
    )
    dive_p2 = (
        ex - fx * panel_ref * 0.85,
        ey - fy * panel_ref * 0.85,
        max(skim * 4.5, depth * 0.15),
    )
    exit_loc = (ex, ey, skim)
    exit_look = (ex + fx * panel_ref * 1.4, ey + fy * panel_ref * 1.4, 0.0)

    path = {
        "center": (cx, cy),
        "depth": depth,
        "panelRef": panel_ref,
        "skim": skim,
        "forward": (fx, fy),
        "start": start,
        "approachP1": approach_p1,
        "approachP2": approach_p2,
        "lift": lift,
        "liftZ": lift_z,
        "preLiftStartT": float(anim.get("preLiftStartT", 0.72)),
        "ascentPath": ascent_path,
        "surfaceLookAhead": float(anim.get("surfaceLookAheadPanelRatio", 1.05)),
        "wallP1": wall_p1,
        "wallP2": wall_p2,
        "frontWall": front_wall,
        "apex": apex_loc,
        "apexDrift": apex_drift,
        "apexLook": apex_look,
        "topFaceLook": (cx, cy, depth + float(manifest.get("geometry", {}).get("skinEpsilon", 0.003))),
        "diveP1": dive_p1,
        "diveP2": dive_p2,
        "diveGroundLook": (dive_ground[0], dive_ground[1], 0.0),
        "diveMidLook": (dive_ground[0] + fx * panel_ref * 0.7, dive_ground[1] + fy * panel_ref * 0.7, 0.0),
        "exit": exit_loc,
        "exitLook": exit_look,
        "clearanceXY": wall_clearance,
    }

    # Build a dense internal reference path, then reduce it to editable control
    # keyframes. This is not frame-by-frame baked camera motion: the final scene
    # has a Track To target with an adaptively simplified set of keyframes.
    samples = {}
    reference_path_points = []
    for frame in range(frames["start"], frames["diveEnd"] + 1):
        loc, look = _camera_sample_for_frame(frame, frames, path)
        samples[frame] = (loc, look)
        reference_path_points.append(loc)

    required_frames = {
        frames["start"],
        frames["riseStart"],
        frames["cruiseEnd"],
        frames["liftStart"],
        frames["apex"],
        frames["holdEnd"],
        frames["retractEnd"],
        frames["diveEnd"],
    }
    selected_frames = _simplify_sample_frames(
        samples,
        required_frames,
        camera_error=float(anim.get("cameraKeyframePositionError", 0.040)),
        target_error=float(anim.get("cameraKeyframeTargetError", 0.060)),
        max_segment_frames=int(anim.get("cameraKeyframeMaxSegmentFrames", 14)),
    )

    target_empty = _make_camera_target("CameraTarget_Keyframed")
    _attach_track_to(camera, target_empty)
    for frame in selected_frames:
        loc, look = samples[frame]
        _key_location(camera, frame, loc)
        _key_location(target_empty, frame, look)

    interpolation = str(anim.get("keyframeInterpolation", "BEZIER")).upper()
    _set_action_interpolation_best_effort(camera, interpolation)
    _set_action_interpolation_best_effort(target_empty, interpolation)

    debug_mat = create_debug_material("DEBUG_CameraPath_Material", (0.1, 0.85, 1.0, 1.0))
    _create_curve_path("DEBUG_CameraPath_Reference", reference_path_points, debug_mat)
    key_path_points = [samples[f][0] for f in selected_frames]
    _create_curve_path("DEBUG_CameraPath_Keyframes", key_path_points, debug_mat)
    _add_debug_markers([
        ("start", path["start"]),
        ("climb_start", path["lift"]),
        ("wall_mid", path["wallP1"]),
        ("apex_reveal", path["apex"]),
        ("apex_drift", path["apexDrift"]),
        ("dive_exit", path["exit"]),
    ])

    scene.frame_set(0)
    _validate_focus_shot(scene, camera, panel, layout, manifest, units, frames, samples, depth)
    print(f"Generated keyframed single-section animatic for focusSection={focus!r}; solved_reveal_fill={solved_reveal_fill:.3f}")
    print(f"Camera keyframes={len(selected_frames)} over {frames['diveEnd'] + 1} sampled frames; first/last={selected_frames[0]}/{selected_frames[-1]}")
    print(f"Cruise altitude={skim:.3f}; wall_clearance={wall_clearance:.3f}; side_offset={side_offset:.3f}")
    return camera


# -----------------------------------------------------------------------------
# Lighting
# -----------------------------------------------------------------------------

def add_lights(layout, manifest):
    css_w = float(layout["cssWidth"])
    css_h = float(layout["cssHeight"])
    units = float(manifest.get("world", {}).get("unitsPerCssPixel", 0.01))
    w = css_w * units
    h = css_h * units

    ambient = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = ambient
    ambient.color = (0.004, 0.005, 0.007)

    area_data = bpy.data.lights.new("Key_Area", "AREA")
    area_data.energy = 650
    area_data.size = max(w, h) * 0.45
    area = bpy.data.objects.new("Key_Area", area_data)
    area.location = (-w * 0.18, -h * 0.28, 8.0)
    bpy.context.collection.objects.link(area)

    rim_data = bpy.data.lights.new("Low_Rim_Point", "POINT")
    rim_data.energy = 220
    rim = bpy.data.objects.new("Low_Rim_Point", rim_data)
    rim.location = (w * 0.38, h * 0.30, 1.4)
    bpy.context.collection.objects.link(rim)

    fill_data = bpy.data.lights.new("Surface_Fill", "AREA")
    fill_data.energy = 95
    fill_data.size = max(w, h) * 0.9
    fill = bpy.data.objects.new("Surface_Fill", fill_data)
    fill.location = (0, 0, 2.3)
    bpy.context.collection.objects.link(fill)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main(argv):
    args = parse_args(argv)
    manifest = load_json(args.manifest)
    layout = load_json(args.layout)
    image_path = Path(args.image).resolve()
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    clear_scene()
    scene = bpy.context.scene
    set_render_engine(scene)
    configure_timeline(manifest)

    interface_mat = create_interface_material(image_path)
    body_mat = create_body_material()
    units = float(manifest.get("world", {}).get("unitsPerCssPixel", 0.01))

    create_base_interface(layout, units, interface_mat)
    panels = create_panels(layout, manifest, interface_mat, body_mat)
    add_camera_rig(layout, manifest, panels)
    add_lights(layout, manifest)

    bpy.ops.wm.save_as_mainfile(filepath=str(output_path))
    print(f"Saved {output_path}")

    if args.render:
        if args.frames:
            bpy.context.scene.render.filepath = str(Path(args.frames).resolve())
        bpy.ops.render.render(animation=True)


if __name__ == "__main__":
    main(sys.argv)
