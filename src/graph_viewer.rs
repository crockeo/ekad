use accesskit::Role;
use enum_map::{Enum, EnumMap};
use lazy_static::lazy_static;
use masonry::{
    vello::Scene, AccessCtx, AccessEvent, BoxConstraints, CursorIcon, EventCtx, LayoutCtx,
    LifeCycle, LifeCycleCtx, PaintCtx, PointerEvent, Size, StatusChange, TextEvent, Vec2, Widget,
    WidgetId,
};
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
use crate::text::{TextConfig, TextConfigBuilder, TextRenderer};
use crate::{
    graph::{Graph, Node, NodeIndex},
    text::HorizontalAlignment,
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

// TODO: do a pass to see if i can clean up more of the code in here
// before i add more complexity around the rest of the program

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

// TODO: set it up so that you can delete edges, not just nodes
// this is for sure going to need some underlying changes
// because i'm going to need to determine what """selecting""" and edge means

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

pub struct GraphViewer<G> {
    gesture: Gesture,
    graph: G,
    hotkey_state: EnumMap<Hotkey, bool>,
    raw_mouse_position: Option<Point>,
    text_config: TextConfig,
    text_renderer: TextRenderer,
    transform: Affine,
}

impl<G: Default + Graph> Default for GraphViewer<G> {
    fn default() -> Self {
        Self {
            gesture: Default::default(),
            graph: Default::default(),
            hotkey_state: Default::default(),
            raw_mouse_position: Default::default(),
            text_config: TextConfigBuilder::default()
                .set_horizontal_alignment(HorizontalAlignment::Middle)
                .build(),
            text_renderer: Default::default(),
            transform: Default::default(),
        }
    }
}

impl<G: Graph> GraphViewer<G> {
    fn hovered_circle(&self) -> Option<NodeIndex> {
        // TODO: replace with something like kdtree: https://crates.io/crates/kdtree
        let Some(mouse_position) = self.mouse_position() else {
            return None;
        };

        for node_id in self.graph.node_indices().unwrap() {
            let node = self.graph.get_node(node_id).unwrap();
            if shapes::in_circle(&mouse_position, &node.circle) {
                return Some(node_id);
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

    fn cursor_icon(&self) -> &CursorIcon {
        match self.gesture {
            Gesture::Inactive if self.hotkey_state[Hotkey::Space] => &CursorIcon::Grab,
            Gesture::MovingNode { .. } => &CursorIcon::Grabbing,
            Gesture::Panning => &CursorIcon::Grabbing,
            _ => &CursorIcon::Default,
        }
    }
}

impl<G: Graph + 'static> Widget for GraphViewer<G> {
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

            if let Gesture::MovingNode {
                node_id,
                initial_distance,
            } = self.gesture
            {
                let mut node = self.graph.get_node(node_id).unwrap();
                node.circle.center = (self.transform.inverse() * new_position) + initial_distance;
                self.graph.set_node(node_id, node).unwrap();
            }

            self.raw_mouse_position = Some(new_position);

            // TODO: limit this to only ceratin scenarios, like
            // - when you start/stop hovering over a circle
            // - when you're in the middle of a gesture
            // - ???
            ctx.request_paint();
        }

        if let PointerEvent::PointerDown(_, _) = event {
            // TODO(editing): make this go back to Gesture::Inactive when clicking and currently in Gesture::Editing
            let Gesture::Inactive = self.gesture else {
                return;
            };

            self.gesture = match self.hovered_circle() {
                None if self.hotkey_state[Hotkey::Space] => Gesture::Panning,
                None if self.hotkey_state[Hotkey::Control] => self.gesture,
                None => Gesture::AddingNode,

                Some(circle) if self.hotkey_state[Hotkey::Space] => {
                    let mouse_position = self
                        .mouse_position()
                        .expect("Must have mouse_position() if you also have hovered_circle()");
                    Gesture::MovingNode {
                        node_id: circle,
                        initial_distance: self.graph.get_node(circle).unwrap().circle.center
                            - mouse_position,
                    }
                }
                Some(circle) if self.hotkey_state[Hotkey::Control] => Gesture::Deleting,
                Some(circle) => Gesture::AddingEdge { from: circle },
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
                            .add_node(Node {
                                title: "".to_owned(),
                                circle: Circle::new(mouse_position, CIRCLE_RADIUS),
                            })
                            .unwrap();
                    }
                }
                (Gesture::AddingEdge { from }, None) => {
                    if let Some(mouse_position) = mouse_position {
                        let to = self
                            .graph
                            .add_node(Node {
                                title: "".to_owned(),
                                circle: Circle::new(mouse_position, CIRCLE_RADIUS),
                            })
                            .unwrap();
                        self.graph.add_edge(from, to).unwrap();
                    }
                }
                // TODO(editing): set this up so that if you're "adding an edge" from a node back to itself
                // you actually end up going into the editing mode for that node
                (Gesture::AddingEdge { from }, Some(to)) => {
                    self.graph.add_edge(from, to).unwrap();
                }
                (Gesture::Deleting, Some(node_id)) => {
                    self.graph.remove_node(node_id).unwrap();
                }
                _ => {}
            }
            self.gesture = Gesture::Inactive;
            ctx.request_paint();
        }

        if let PointerEvent::MouseWheel(delta, _) = event {
            self.transform = self.transform.then_translate(Vec2::new(delta.x, delta.y));
            ctx.request_paint();
        }

        if let PointerEvent::Pinch(delta, _) = event {
            let Some(mouse_position) = self.mouse_position() else {
                return;
            };
            let translate = Affine::translate(mouse_position.to_vec2());
            self.transform =
                self.transform * translate * Affine::scale(1.0 + delta) * translate.inverse();
            ctx.request_paint();
        }

        ctx.set_cursor(self.cursor_icon());
    }

    fn on_text_event(&mut self, ctx: &mut EventCtx<'_>, event: &TextEvent) {
        let TextEvent::KeyboardKey(key, _) = event else {
            return;
        };
        if key.repeat {
            return;
        }

        // TODO(editing): add something here when gesture is Editing
        // to modify the text of the current node

        if key.physical_key == PhysicalKey::Code(KeyCode::Escape) {
            self.gesture = Gesture::Inactive;
            ctx.request_paint();
            return;
        }

        let Some(hotkey) = Hotkey::from_physical_key(key.physical_key) else {
            return;
        };
        // TODO: the cursor change doesn't take effect when you press space,
        // but instead afterwards, the first moment you move your mouse :/
        match key.state {
            ElementState::Pressed => {
                self.hotkey_state[hotkey] = true;
            }
            ElementState::Released => {
                ctx.clear_cursor();
                self.hotkey_state[hotkey] = false;
            }
        }
        ctx.set_cursor(self.cursor_icon());
    }

    fn on_access_event(&mut self, ctx: &mut EventCtx<'_>, event: &AccessEvent) {}

    fn on_status_change(&mut self, ctx: &mut LifeCycleCtx<'_>, event: &StatusChange) {}

    fn lifecycle(&mut self, ctx: &mut LifeCycleCtx<'_>, event: &LifeCycle) {}

    fn layout(&mut self, ctx: &mut LayoutCtx<'_>, bc: &BoxConstraints) -> Size {
        bc.max()
    }

    fn paint(&mut self, ctx: &mut PaintCtx<'_>, parent_scene: &mut Scene) {
        let mut scene = Scene::new();

        for circle_id in self.graph.node_indices().unwrap() {
            let node = self.graph.get_node(circle_id).unwrap();

            let is_in_circle = match self.mouse_position() {
                None => false,
                Some(mouse_position) => shapes::in_circle(&mouse_position, &node.circle),
            };

            let circle_fill_color = if is_in_circle && self.gesture == Gesture::Deleting {
                BASE_COLOR.with_alpha_factor(0.25)
            } else if is_in_circle & self.hotkey_state[Hotkey::Control] {
                BASE_COLOR.with_alpha_factor(0.5)
            } else if is_in_circle {
                LIGHT_COLOR
            } else {
                BASE_COLOR
            };

            scene.fill(
                vello::peniko::Fill::NonZero,
                Affine::IDENTITY,
                circle_fill_color,
                None,
                &node.circle,
            );
            for neighbor_circle_id in self.graph.neighbors(circle_id).unwrap() {
                let neighbor_node = &self.graph.get_node(neighbor_circle_id).unwrap();
                draw_arrow_between(&mut scene, &BASE_COLOR, &node.circle, &neighbor_node.circle);
            }

            // TODO(editing): add something here to paint the current text of the node
            // in such a way that it always fits inside of the node
            self.text_renderer.render_with_transform(
                &mut scene,
                &self.text_config,
                Affine::translate(node.circle.center.to_vec2()),
                &node.title,
            );
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
                    &self.graph.get_node(from).unwrap().circle,
                    &preview_circle,
                );
            }
            (_, Gesture::AddingEdge { from }, Some(to)) => {
                draw_arrow_between(
                    &mut scene,
                    &PREVIEW_COLOR,
                    &self.graph.get_node(from).unwrap().circle,
                    &self.graph.get_node(to).unwrap().circle,
                );
            }
            _ => {}
        }

        parent_scene.append(&scene, Some(self.transform));
    }

    fn accessibility_role(&self) -> Role {
        Role::Unknown
    }

    fn accessibility(&mut self, ctx: &mut AccessCtx<'_>) {}

    fn children_ids(&self) -> SmallVec<[WidgetId; 16]> {
        SmallVec::default()
    }
}

pub fn draw_arrow_between(
    scene: &mut Scene,
    color: &Color,
    from_circle: &Circle,
    to_circle: &Circle,
) {
    let direction = (to_circle.center - from_circle.center).normalize();
    let from = from_circle.center + direction * from_circle.radius + direction * LINE_STROKE.width;
    let to = to_circle.center - direction * to_circle.radius - direction * LINE_STROKE.width;
    for line in shapes::arrow(from, to) {
        scene.stroke(&LINE_STROKE, Affine::IDENTITY, color, None, &line);
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Gesture {
    Inactive,
    AddingNode,
    AddingEdge {
        from: NodeIndex,
    },
    Panning,
    MovingNode {
        node_id: NodeIndex,
        initial_distance: Vec2,
    },
    Deleting,
    Editing {
        node_id: NodeIndex,
    },
}

impl Default for Gesture {
    fn default() -> Self {
        Gesture::Inactive
    }
}

#[derive(Clone, Copy, Debug, Enum, Eq, PartialEq)]
enum Hotkey {
    Control,
    Space,
}

impl Hotkey {
    fn from_physical_key(physical_key: PhysicalKey) -> Option<Self> {
        match physical_key {
            PhysicalKey::Code(KeyCode::ControlLeft) => Some(Self::Control),
            PhysicalKey::Code(KeyCode::ControlRight) => Some(Self::Control),
            PhysicalKey::Code(KeyCode::Space) => Some(Self::Space),
            _ => None,
        }
    }
}
