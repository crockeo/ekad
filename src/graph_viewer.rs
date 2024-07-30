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
const PREVIEW_COLOR: Color = Color {
    r: 113,
    g: 64,
    b: 237,
    a: 127,
};

// TODO: instead of backing this with a plain petgraph graph,
// try to represent a graph inside of something like automerge
// so that we can synchronize it across a network

#[derive(Default)]
pub struct GraphViewer {
    gesture: Gesture,
    graph: DiGraph<Circle, ()>,
    raw_mouse_position: Option<Point>,
    transform: Affine,
}

impl GraphViewer {
    pub fn add_to_scene(&self, parent_scene: &mut Scene) {
        let mut scene = Scene::new();

        let line_stroke = Stroke::new(2.0);
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
            for neighbor_circle_id in self.graph.neighbors(circle_id) {
                let neighbor_circle = &self.graph[neighbor_circle_id];
                let line = Line::new(circle.center, neighbor_circle.center);
                scene.stroke(&line_stroke, Affine::IDENTITY, BASE_COLOR, None, &line);
            }
        }

        match (self.mouse_position(), self.gesture, self.hovered_circle()) {
            (None, _, _) => {}
            (_, Gesture::Inactive, _) => {}
            (_, Gesture::AddingNode, Some(_)) => {}
            (Some(mouse_position), Gesture::AddingNode, None) => {
                scene.fill(
                    vello::peniko::Fill::NonZero,
                    Affine::IDENTITY,
                    PREVIEW_COLOR,
                    None,
                    &Circle::new(mouse_position, 40.0),
                );
            }
            (Some(mouse_position), Gesture::AddingEdge { from }, None) => {
                scene.fill(
                    vello::peniko::Fill::NonZero,
                    Affine::IDENTITY,
                    PREVIEW_COLOR,
                    None,
                    &Circle::new(mouse_position, 40.0),
                );
                scene.stroke(
                    &line_stroke,
                    Affine::IDENTITY,
                    PREVIEW_COLOR,
                    None,
                    &Line::new(self.graph[from].center, mouse_position),
                );
            }
            (_, Gesture::AddingEdge { from }, Some(to)) => {
                scene.stroke(
                    &line_stroke,
                    Affine::IDENTITY,
                    PREVIEW_COLOR,
                    None,
                    &Line::new(self.graph[from].center, self.graph[to].center),
                );
            }
        }

        parent_scene.append(&scene, Some(self.transform));
    }

    pub fn mouse_moved(&mut self, new_position: Option<Point>) -> bool {
        self.raw_mouse_position = new_position;

        // TODO: don't redraw the screen every time one moves the mouse,
        // only when it would result in something needing a redraw
        true
    }

    pub fn mouse_pressed(&mut self) {
        let Gesture::Inactive = self.gesture else {
            return;
        };

        if let Some(circle) = self.hovered_circle() {
            self.gesture = Gesture::AddingEdge { from: circle };
        } else {
            self.gesture = Gesture::AddingNode;
        }
    }

    pub fn mouse_released(&mut self) {
        let hovered_circle = self.hovered_circle();
        let mouse_position = self.mouse_position();

        match (self.gesture, hovered_circle) {
            (Gesture::Inactive, _) => {}
            (Gesture::AddingNode, Some(_)) => {}
            (Gesture::AddingNode, None) => {
                if let Some(mouse_position) = mouse_position {
                    self.graph.add_node(Circle::new(mouse_position, 40.0));
                }
            }
            (Gesture::AddingEdge { from }, None) => {
                if let Some(mouse_position) = mouse_position {
                    let to = self.graph.add_node(Circle::new(mouse_position, 40.0));
                    self.graph.add_edge(from, to, ());
                }
            }
            (Gesture::AddingEdge { from }, Some(to)) => {
                self.graph.add_edge(from, to, ());
            }
        }
        self.gesture = Gesture::Inactive;
    }

    pub fn scroll(&mut self, delta_x: f64, delta_y: f64) {
        let inverse_det = self.transform.inverse().determinant();
        self.transform =
            self.transform * Affine::translate((delta_x * inverse_det, delta_y * inverse_det));
    }

    pub fn zoom(&mut self, delta: f64) {
        let Some(mouse_position) = self.mouse_position() else {
            return;
        };
        let translate = Affine::translate(mouse_position.to_vec2());
        self.transform =
            self.transform * translate * Affine::scale(1.0 + delta) * translate.inverse();
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

fn in_circle(point: &Point, circle: &Circle) -> bool {
    point.distance_squared(circle.center) < circle.radius * circle.radius
}

#[derive(Clone, Copy, Eq, PartialEq)]
enum Gesture {
    Inactive,
    AddingNode,
    AddingEdge { from: NodeIndex<u32> },
}

impl Default for Gesture {
    fn default() -> Self {
        Gesture::Inactive
    }
}
