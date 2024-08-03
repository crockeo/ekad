use accesskit::Role;
use enum_map::{Enum, EnumMap};
use lazy_static::lazy_static;
use masonry::{
    vello::Scene, AccessCtx, AccessEvent, BoxConstraints, EventCtx, LayoutCtx, LifeCycle,
    LifeCycleCtx, PaintCtx, PointerEvent, Size, StatusChange, TextEvent, Widget, WidgetId,
};
use petgraph::graph::{DiGraph, NodeIndex};
use smallvec::SmallVec;
use vello::{
    kurbo::{Affine, Circle, Point, Stroke},
    peniko::Color,
};
use winit::{
    event::ElementState,
    keyboard::{KeyCode, PhysicalKey},
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

// TODO: and what kinds of stuff are an Eventually(tm) (aka: BIG!)
// - Hook it up to storage
//   - Preferably something like automerge.rs so it can be synchronized
//   - Otherwise try to make it compatible with the CLI version of ekad?
// - Define metadata around nodes to capture some basic information
//   - Name, notes, scheduled time, etc.
// - Add a UI around the graph viewer
//   - Turn this into a Masonry widget
//   - See if we can build an application around it in Masonry
//   - Eventually: see if it can be integrated into Xilem?
// - If we run into performance issues:
//   - Make some way to like """cache""" scene elements,
//     so we don't have to re-calculate a bunch of stuff around
//     circles and lines and stuff like that.

// TODO: misc thing, how do i make the pointer look like a hand when it's in "grab" mode (space is down)

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

pub struct GraphViewer {
    gesture: Gesture,
    graph: DiGraph<Circle, ()>,
    hotkey_state: EnumMap<Hotkey, bool>,
    raw_mouse_position: Option<Point>,
    transform: Affine,
    // TODO: i have this separate from transform so that i can use it to scale certain movements,
    // but i feel like i should be able to get this out of the Affine matrix :/
    zoom: f64,
}

impl Default for GraphViewer {
    fn default() -> Self {
        Self {
            gesture: Default::default(),
            graph: Default::default(),
            hotkey_state: Default::default(),
            raw_mouse_position: Default::default(),
            transform: Default::default(),
            zoom: 1.0,
        }
    }
}

impl GraphViewer {
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

impl Widget for GraphViewer {
    fn on_pointer_event(&mut self, ctx: &mut EventCtx<'_>, event: &PointerEvent) {
        if !ctx.has_focus() {
            // TODO: how should this actually work?
            // i want to be able to receive hotkeys anytime i'm interacting with the graph
            // how should i be able to receive text events?
            //
            // and what would happen if i hold down a hotkey *before* i'm focusing
            // but then i focus after??? i would just miss the hotkey and that's confusing :(
            // it should be about the stateless "is the Space bar pressed"
            // not "was there a text event"
            ctx.request_focus()
        }

        if let PointerEvent::PointerMove(pointer_state) = event {
            let new_position = Point::new(pointer_state.position.x, pointer_state.position.y);

            if let (Gesture::Panning, Some(raw_mouse_position)) =
                (self.gesture, self.raw_mouse_position)
            {
                let mut movement =
                    self.transform * new_position - self.transform * raw_mouse_position;
                movement *= self.transform.inverse().determinant();
                self.transform *= Affine::translate(movement);
            }

            // TODO: this moves the circle in a jerky way,
            // because the user doesn't necessarily grab the circle by the center.
            // i need to record the difference between the in-world mouse position
            // and the center of the circle
            // at the time that it's grabbed,
            // and then move the circle to:
            //   `(self.transform.inverse() * new_position) + difference`
            if let Gesture::MovingNode { node } = self.gesture {
                self.graph[node].center = self.transform.inverse() * new_position;
            }

            self.raw_mouse_position = Some(new_position);

            // TODO: limit this to only ceratin scenarios, like
            // - when you start/stop hovering over a circle
            // - when you're in the middle of a gesture
            // - ???
            ctx.request_paint();
        }

        if let PointerEvent::PointerDown(_, _) = event {
            let Gesture::Inactive = self.gesture else {
                return;
            };

            // TODO: I fear that this will explode in complexity
            // if I want to support more combinations of hotkeys and clicks.
            // how to do this better?
            let space_pressed = self.hotkey_state[Hotkey::Space];
            self.gesture = match (space_pressed, self.hovered_circle()) {
                (false, None) => Gesture::AddingNode,
                (false, Some(circle)) => Gesture::AddingEdge { from: circle },
                (true, None) => Gesture::Panning,
                (true, Some(circle)) => Gesture::MovingNode { node: circle },
            };

            ctx.request_paint();
        }

        if let PointerEvent::PointerUp(_, _) = event {
            let hovered_circle = self.hovered_circle();
            let mouse_position = self.mouse_position();

            match (self.gesture, hovered_circle) {
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
                _ => {}
            }
            self.gesture = Gesture::Inactive;
            ctx.request_paint();
        }

        if let PointerEvent::MouseWheel(delta, _) = event {
            // TODO: this still doesn't quite feel right, but i don't know what it is.
            // try to fix it!
            let inverse_det = self.transform.inverse().determinant();
            self.transform =
                self.transform * Affine::translate((delta.x * inverse_det, delta.y * inverse_det));
            ctx.request_paint();
        }

        if let PointerEvent::Pinch(delta, _) = event {
            let Some(mouse_position) = self.mouse_position() else {
                return;
            };
            let translate = Affine::translate(mouse_position.to_vec2());
            self.zoom += delta;
            self.transform =
                self.transform * translate * Affine::scale(1.0 + delta) * translate.inverse();
            ctx.request_paint();
        }
    }

    fn on_text_event(&mut self, ctx: &mut EventCtx<'_>, event: &TextEvent) {
        if let TextEvent::KeyboardKey(key, _) = event {
            if key.repeat {
                return;
            }
            let Some(hotkey) = Hotkey::from_physical_key(key.physical_key) else {
                return;
            };
            match key.state {
                ElementState::Pressed => self.hotkey_state[hotkey] = true,
                ElementState::Released => self.hotkey_state[hotkey] = false,
            }
        }
    }

    fn on_access_event(&mut self, ctx: &mut EventCtx<'_>, event: &AccessEvent) {
        // TODO
    }

    fn on_status_change(&mut self, ctx: &mut LifeCycleCtx<'_>, event: &StatusChange) {
        // TODO
    }

    fn lifecycle(&mut self, ctx: &mut LifeCycleCtx<'_>, event: &LifeCycle) {
        // TODO
    }

    fn layout(&mut self, ctx: &mut LayoutCtx<'_>, bc: &BoxConstraints) -> Size {
        bc.max()
    }

    fn paint(&mut self, ctx: &mut PaintCtx<'_>, parent_scene: &mut Scene) {
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
            _ => {}
        }

        parent_scene.append(&scene, Some(self.transform));
    }

    fn accessibility_role(&self) -> Role {
        // TODO: what is this element's role?
        Role::Unknown
    }

    fn accessibility(&mut self, ctx: &mut AccessCtx<'_>) {
        // TODO
    }

    fn children_ids(&self) -> SmallVec<[WidgetId; 16]> {
        SmallVec::default()
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Gesture {
    Inactive,
    AddingNode,
    AddingEdge { from: NodeIndex<u32> },
    Panning,
    MovingNode { node: NodeIndex<u32> },
}

impl Default for Gesture {
    fn default() -> Self {
        Gesture::Inactive
    }
}

#[derive(Clone, Copy, Debug, Enum, Eq, PartialEq)]
enum Hotkey {
    Space,
}

impl Hotkey {
    fn from_physical_key(physical_key: PhysicalKey) -> Option<Self> {
        match physical_key {
            PhysicalKey::Code(KeyCode::Space) => Some(Self::Space),
            _ => None,
        }
    }
}
