use petgraph::graph::{DiGraph, NodeIndex};
use vello::{
    kurbo::{Affine, Circle, Line, Point, Stroke},
    peniko::Color,
    Scene,
};

// NOTE: It would be interesting to use some concept of "centrality"
// to be the guide for what to render vs. what not to render.
// Use that in combination with a quad tree / culling to:
//
// - render only things that are highly important when zoomed out
// - draw edges between them and other things in the graph as simulated paths that exist
// - as you zoom in, bring more and more less-important nodes in, and then get more detail
// - but by zooming in keep the total number of nodes you're rendering below some max amount
//   by using a quad tree / culling approach to rendering

const BASE_COLOR: Color = Color {
    r: 113,
    g: 64,
    b: 237,
    a: 255,
};
const LIGHT_COLOR: Color = Color {
    r: 158,
    g: 133,
    b: 222,
    a: 255,
};

#[derive(Default)]
pub struct GraphViewer {
    graph: DiGraph<Circle, ()>,
    raw_mouse_position: Option<Point>,
    // TODO: generalize this into some kind of gesture system
    start_circle: Option<NodeIndex<u32>>,
    transform: Affine,
}

impl GraphViewer {
    pub fn add_to_scene(&self, parent_scene: &mut Scene) {
        let mut scene = Scene::new();
        for circle_id in self.graph.node_indices() {
            let circle = &self.graph[circle_id];

            let is_in_circle = match self.mouse_position() {
                None => false,
                Some(mouse_position) => in_circle(&mouse_position, circle),
            };

            let circle_fill_color = if is_in_circle {
                LIGHT_COLOR
            } else {
                BASE_COLOR
            };

            scene.fill(
                vello::peniko::Fill::NonZero,
                Affine::IDENTITY,
                circle_fill_color,
                None,
                circle,
            );

            let stroke = Stroke::new(2.0);
            for neighbor_circle_id in self.graph.neighbors(circle_id) {
                let neighbor_circle = &self.graph[neighbor_circle_id];
                let line = Line::new(circle.center, neighbor_circle.center);
                scene.stroke(&stroke, Affine::IDENTITY, BASE_COLOR, None, &line);
            }
        }

        // TODO: add a debug mode which will let us turn this off and on?
        // if let Some(mouse_position) = self.mouse_position() {
        //     let mouse_pos_circle = Circle::new(mouse_position, 10.0);
        //     scene.fill(
        //         vello::peniko::Fill::NonZero,
        //         Affine::IDENTITY,
        //         BASE_COLOR,
        //         None,
        //         &mouse_pos_circle,
        //     );
        // };

        parent_scene.append(&scene, Some(self.transform));
    }

    pub fn mouse_moved(&mut self, new_position: Option<Point>) -> bool {
        // let circle = Circle::new((420.0, 200.0), 120.0);
        // let new_position = Point::new(position.x, position.y);
        // let changed_hover =
        //     in_circle(&self.mouse_position, &circle) != in_circle(&new_position, &circle);
        // self.mouse_position = new_position;
        // if changed_hover {
        //     render_state.window.request_redraw();
        // }
        self.raw_mouse_position = new_position;
        true
    }

    // TODO: draw preview when
    // - making a new circle
    // - making a new connection
    // - making a new circle with a new connection at the same time
    pub fn mouse_pressed(&mut self) {
        if let Some(circle) = self.hovered_circle() {
            self.start_circle = Some(circle);
        }
    }

    pub fn mouse_released(&mut self) {
        let target_circle = if let Some(circle_id) = self.hovered_circle() {
            circle_id
        } else {
            let Some(mouse_position) = self.mouse_position() else {
                return;
            };
            self.graph
                .add_node(Circle::new(mouse_position.clone(), 40.0))
        };

        if let Some(start_circle) = self.start_circle {
            // TODO: make a connection from start_circle -> target_circle
            self.graph.add_edge(start_circle, target_circle, ());
        }
        self.start_circle = None;
    }

    pub fn scroll(&mut self, delta_x: f64, delta_y: f64) {
        let inverse_det = self.transform.inverse().determinant();
        self.transform =
            self.transform * Affine::translate((delta_x * inverse_det, delta_y * inverse_det));
    }

    pub fn zoom(&mut self, delta: f64) {
        self.transform = self.transform * Affine::scale(1.0 + delta);
    }

    fn hovered_circle(&self) -> Option<NodeIndex<u32>> {
        // TODO: this should be something like a quadtree
        // to scale out better when we have more elements on the screen
        let Some(mouse_position) = self.mouse_position() else {
            return None;
        };

        for circle_id in self.graph.node_indices() {
            let circle = &self.graph[circle_id];
            if in_circle(&mouse_position, circle) {
                return Some(circle_id);
            }
        }
        None
    }

    /// Returns the in-GraphViewer position of the mouse.
    /// This should return a Point such that,
    /// if it were rendered into the scene,
    /// it would appear directly below the mouse at all times.
    fn mouse_position(&self) -> Option<Point> {
        let Some(raw_mouse_position) = self.raw_mouse_position else {
            return None;
        };
        Some(self.transform.inverse() * raw_mouse_position)
    }
}

// TODO: example
// /// Add shapes to a vello scene. This does not actually render the shapes, but adds them
// /// to the Scene data structure which represents a set of objects to draw.
// fn add_shapes_to_scene(mouse_position: &Point, scene: &mut Scene) {
//     // Draw an outlined rectangle
//     let stroke = Stroke::new(6.0);
//     let rect = RoundedRect::new(10.0, 10.0, 240.0, 240.0, 20.0);
//     let rect_stroke_color = Color::rgb(0.9804, 0.702, 0.5294);
//     scene.stroke(&stroke, Affine::IDENTITY, rect_stroke_color, None, &rect);

//     // Draw a filled circle
//     let circle = Circle::new((420.0, 200.0), 120.0);
//     let circle_fill_color = if in_circle(mouse_position, &circle) {
//         Color::rgb(0.9529, 0.5451, 0.6588)
//     } else {
//         Color::rgb8(210, 123, 53)
//     };
//     scene.fill(
//         vello::peniko::Fill::NonZero,
//         Affine::IDENTITY,
//         circle_fill_color,
//         None,
//         &circle,
//     );

//     // Draw a filled ellipse
//     let ellipse = Ellipse::new((250.0, 420.0), (100.0, 160.0), -90.0);
//     let ellipse_fill_color = Color::rgb(0.7961, 0.651, 0.9686);
//     scene.fill(
//         vello::peniko::Fill::NonZero,
//         Affine::IDENTITY,
//         ellipse_fill_color,
//         None,
//         &ellipse,
//     );

//     // Draw a straight line
//     let line = Line::new((260.0, 20.0), (620.0, 100.0));
//     let line_stroke_color = Color::rgb(0.5373, 0.7059, 0.9804);
//     scene.stroke(&stroke, Affine::IDENTITY, line_stroke_color, None, &line);
// }

fn in_circle(point: &Point, circle: &Circle) -> bool {
    point.distance_squared(circle.center) < circle.radius * circle.radius
}
