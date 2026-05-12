import math
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'blender'))

from interface_geometry import (  # noqa: E402
    body_mesh_data,
    css_point_to_uv,
    css_point_to_world,
    panel_center_world,
    panel_depth_at_frame,
    rounded_rect_css_boundary,
    schedule_for_order,
    skin_mesh_data,
)


LAYOUT = {
    'cssWidth': 1600,
    'cssHeight': 1000,
    'sections': [],
}

PANEL = {
    'id': 'wavetable',
    'x': 100,
    'y': 50,
    'width': 200,
    'height': 100,
    'radii': {
        'topLeft': {'x': 20, 'y': 20},
        'topRight': {'x': 20, 'y': 20},
        'bottomRight': {'x': 20, 'y': 20},
        'bottomLeft': {'x': 20, 'y': 20},
    },
}


class GeometryTests(unittest.TestCase):
    def test_css_point_to_world_centers_origin(self):
        self.assertEqual(css_point_to_world(800, 500, 1600, 1000, 0.01), (0.0, 0.0))

    def test_css_point_to_world_flips_y_axis(self):
        top = css_point_to_world(800, 0, 1600, 1000, 0.01)
        bottom = css_point_to_world(800, 1000, 1600, 1000, 0.01)
        self.assertGreater(top[1], bottom[1])

    def test_css_point_to_uv(self):
        self.assertEqual(css_point_to_uv(0, 0, 1600, 1000), (0.0, 1.0))
        self.assertEqual(css_point_to_uv(1600, 1000, 1600, 1000), (1.0, 0.0))

    def test_panel_center_world(self):
        cx, cy = panel_center_world(PANEL, LAYOUT, 0.01)
        self.assertAlmostEqual(cx, (100 + 100 - 800) * 0.01)
        self.assertAlmostEqual(cy, (500 - (50 + 50)) * 0.01)

    def test_rounded_boundary_stays_inside_panel_bounds(self):
        points = rounded_rect_css_boundary(PANEL, segments_per_corner=4)
        self.assertGreaterEqual(len(points), 16)
        for x, y in points:
            self.assertGreaterEqual(x, PANEL['x'] - 1e-6)
            self.assertLessEqual(x, PANEL['x'] + PANEL['width'] + 1e-6)
            self.assertGreaterEqual(y, PANEL['y'] - 1e-6)
            self.assertLessEqual(y, PANEL['y'] + PANEL['height'] + 1e-6)

    def test_skin_mesh_has_one_face_and_matching_uvs(self):
        mesh = skin_mesh_data(PANEL, LAYOUT, 0.01, segments_per_corner=4)
        self.assertEqual(len(mesh['faces']), 1)
        self.assertEqual(len(mesh['vertices']), len(mesh['face_uvs'][0]))
        for u, v in mesh['face_uvs'][0]:
            self.assertGreaterEqual(u, 0)
            self.assertLessEqual(u, 1)
            self.assertGreaterEqual(v, 0)
            self.assertLessEqual(v, 1)

    def test_body_mesh_z_invariant_is_zero_to_one(self):
        mesh = body_mesh_data(PANEL, LAYOUT, 0.01, segments_per_corner=4)
        zs = [v[2] for v in mesh['vertices']]
        self.assertEqual(min(zs), 0.0)
        self.assertEqual(max(zs), 1.0)

    def test_body_mesh_has_side_faces(self):
        mesh = body_mesh_data(PANEL, LAYOUT, 0.01, segments_per_corner=4)
        n = len(rounded_rect_css_boundary(PANEL, 4))
        self.assertEqual(len(mesh['faces']), n + 2)

    def test_depth_envelope(self):
        self.assertEqual(panel_depth_at_frame(0, 10, 20, 30, 40, 0.5), 0.0)
        self.assertAlmostEqual(panel_depth_at_frame(20, 10, 20, 30, 40, 0.5), 0.5)
        self.assertAlmostEqual(panel_depth_at_frame(30, 10, 20, 30, 40, 0.5), 0.5)
        self.assertEqual(panel_depth_at_frame(40, 10, 20, 30, 40, 0.5), 0.0)

    def test_schedule_for_order(self):
        sched = schedule_for_order(['a', 'b'], frames_per_section=72, extrude_offset=12)
        self.assertEqual(sched['a']['approachStart'], 0)
        self.assertEqual(sched['a']['extrudeStart'], 12)
        self.assertEqual(sched['b']['approachStart'], 72)


if __name__ == '__main__':
    unittest.main()
