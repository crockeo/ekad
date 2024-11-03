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
    event::{ElementState, KeyEvent},
    keyboard::{KeyCode, PhysicalKey},
};

use crate::shapes;
use crate::text::{TextConfig, TextConfigBuilder, TextRenderer};
use crate::{
    graph::{Graph, Node, NodeIndex},
    text::HorizontalAlignment,
};

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
            match self.gesture {
                Gesture::Inactive | Gesture::Editing { .. } => {}
                _ => return,
            }

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

            self.gesture = match (self.gesture, hovered_circle) {
                (Gesture::AddingNode, None) => {
                    if let Some(mouse_position) = mouse_position {
                        self.graph
                            .add_node(Node {
                                title: "".to_owned(),
                                circle: Circle::new(mouse_position, CIRCLE_RADIUS),
                            })
                            .unwrap();
                    }
                    Gesture::Inactive
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
                    Gesture::Inactive
                }
                (Gesture::AddingEdge { from }, Some(to)) if from == to => {
                    Gesture::Editing { node_id: to }
                }
                (Gesture::AddingEdge { from }, Some(to)) => {
                    self.graph.add_edge(from, to).unwrap();
                    Gesture::Inactive
                }
                (Gesture::Deleting, Some(node_id)) => {
                    self.graph.remove_node(node_id).unwrap();
                    Gesture::Inactive
                }
                _ => Gesture::Inactive,
            };
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

        if let Gesture::Editing { node_id } = self.gesture {
            let mut node = self.graph.get_node(node_id).unwrap();
            if let Some(new_title) = update_title(&node.title, key) {
                node.title = new_title;
                self.graph.set_node(node_id, node).unwrap();
                ctx.request_paint();
            }
            ctx.request_paint();
        }

        if key.repeat {
            return;
        }

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

            let mut is_editing = false;
            match self.gesture {
                Gesture::Editing { node_id } if node_id == circle_id => {
                    is_editing = true;
                    scene.fill(
                        vello::peniko::Fill::NonZero,
                        Affine::IDENTITY,
                        LIGHT_COLOR,
                        None,
                        &Circle::new(node.circle.center, node.circle.radius),
                    );
                    scene.fill(
                        vello::peniko::Fill::NonZero,
                        Affine::IDENTITY,
                        circle_fill_color,
                        None,
                        &Circle::new(node.circle.center, node.circle.radius - 2.0),
                    );
                }
                _ => {
                    scene.fill(
                        vello::peniko::Fill::NonZero,
                        Affine::IDENTITY,
                        circle_fill_color,
                        None,
                        &node.circle,
                    );
                }
            }

            for neighbor_circle_id in self.graph.neighbors(circle_id).unwrap() {
                let neighbor_node = &self.graph.get_node(neighbor_circle_id).unwrap();
                draw_arrow_between(&mut scene, &BASE_COLOR, &node.circle, &neighbor_node.circle);
            }

            let (text_width, text_height) = self
                .text_renderer
                .render_box(&self.text_config, &node.title);
            let text_max_size = text_width.max(text_height) as f64;

            let bounding_square_size = shapes::circle_bounding_square_size(node.circle.radius);

            let mut transform = Affine::IDENTITY;
            if text_max_size > bounding_square_size {
                transform = transform.then_scale(bounding_square_size / text_max_size);
            }
            transform = transform.then_translate(node.circle.center.to_vec2());

            self.text_renderer.render_with_transform(
                &mut scene,
                &self.text_config,
                transform,
                &node.title,
                is_editing,
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

fn update_title(title: &str, key: &KeyEvent) -> Option<String> {
    let Some(key_text) = &key.text else {
        return None;
    };

    if key_text == "\r" {
        Some(title.to_string() + "\n")
    } else if key_text == "\u{8}" && title.len() > 0 {
        Some(title[0..title.len() - 1].to_string())
    } else if key_text == "\u{8}" {
        None
    } else {
        Some(title.to_string() + key_text)
    }
}
