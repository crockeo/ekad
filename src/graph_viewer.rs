use lazy_static::lazy_static;
use petgraph::graph::{DiGraph, NodeIndex};
use vello::{
    kurbo::{Affine, Circle, Point, Stroke},
    peniko::Color,
    Scene,
};

use crate::shapes;

// NOTE: It would be interesting to use some concept of "centrality"
// to be the guide for what to render vs. what not to render.
// Use that in combination with a quad tree / culling to:
//
// - render only things that are highly important when zoomed out
// - draw edges between them and other things in the graph as simulated paths that exist
// - as you zoom in, bring more and more less-important nodes in, and then get more detail
// - but by zooming in keep the total number of nodes you're rendering below some max amount
//   by using a quad tree / culling approach to rendering

// TODO: what kinds of things are missing JUST in graph viewer
// - Move nodes around
// - Delete nodes

// TODO: and what kinds of stuff are an Eventually(tm) (aka: BIG!)
// - Hook it up to storage
//   - Preferably something like automerge.rs so it can be synchronized
//   - Otherwise try to make it compatible with the CLI version of ekad?
// - Define metadata around nodes to capture some basic information
//   - Name, notes, scheduled time, etc.
// - Add a UI around the graph viewer
//   - See if we can use something like Xilem here and still get access to Vello renderer!
//   - Otherwise: I guess we're writing our own UI library in Rust from scratch :)
// - If we run into performance issues:
//   - Make some way to like """cache""" scene elements,
//     so we don't have to re-calculate a bunch of stuff around
//     circles and lines and stuff like that.

const CIRCLE_RADIUS: f64 = 40.0;

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

lazy_static! {
    static ref LINE_STROKE: Stroke = Stroke::new(4.0);
}

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
                draw_arrow_between(&mut scene, &BASE_COLOR, circle, neighbor_circle);
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
                    &Circle::new(mouse_position, CIRCLE_RADIUS),
                );
            }
            (Some(mouse_position), Gesture::AddingEdge { from }, None) => {
                let preview_circle = Circle::new(mouse_position, CIRCLE_RADIUS);
                scene.fill(
                    vello::peniko::Fill::NonZero,
                    Affine::IDENTITY,
                    PREVIEW_COLOR,
                    None,
                    &preview_circle,
                );
                draw_arrow_between(
                    &mut scene,
                    &PREVIEW_COLOR,
                    &self.graph[from],
                    &preview_circle,
                );
            }
            (_, Gesture::AddingEdge { from }, Some(to)) => {
                draw_arrow_between(
                    &mut scene,
                    &PREVIEW_COLOR,
                    &self.graph[from],
                    &self.graph[to],
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
                    self.graph
                        .add_node(Circle::new(mouse_position, CIRCLE_RADIUS));
                }
            }
            (Gesture::AddingEdge { from }, None) => {
                if let Some(mouse_position) = mouse_position {
                    let to = self
                        .graph
                        .add_node(Circle::new(mouse_position, CIRCLE_RADIUS));
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
        // TODO: this still doesn't quite feel right, but i don't know what it is.
        // try to fix it!
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
        // TODO: replace with something like kdtree: https://crates.io/crates/kdtree
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

fn draw_arrow_between(scene: &mut Scene, color: &Color, from_circle: &Circle, to_circle: &Circle) {
    let direction = (to_circle.center - from_circle.center).normalize();
    let from = from_circle.center + direction * from_circle.radius + direction * LINE_STROKE.width;
    let to = to_circle.center - direction * to_circle.radius - direction * LINE_STROKE.width;
    for line in shapes::arrow(from, to) {
        scene.stroke(&LINE_STROKE, Affine::IDENTITY, color, None, &line);
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
