use std::sync::{Arc, Mutex};

use enum_map::{Enum, EnumMap};
use lazy_static::lazy_static;
use masonry::accesskit::Role;
use masonry::core::{
    keyboard::{Code, Key, KeyState, NamedKey},
    AccessCtx, AccessEvent, BoxConstraints, CursorIcon, EventCtx, KeyboardEvent, LayoutCtx,
    NoAction, PaintCtx, PointerEvent, PropertiesMut, PropertiesRef, QueryCtx, RegisterCtx,
    ScrollDelta, TextEvent, Widget, WidgetId,
};
use masonry::kurbo::{Affine, Circle, Point, Rect, Size, Stroke, Vec2};
use masonry::peniko::Color;
use masonry::vello::Scene;
use smallvec::SmallVec;
use xilem::core::{MessageResult, Mut, View, ViewMarker};
use xilem::{Pod, ViewCtx};

use crate::shapes;
use crate::text::{TextConfig, TextConfigBuilder, TextRenderer};
use crate::{
    graph::{DatabaseGraph, Graph, Node, NodeIndex},
    text::HorizontalAlignment,
};

const CIRCLE_RADIUS: f64 = 40.0;

const BASE_COLOR: Color = Color::from_rgba8(113, 64, 237, 255);
const LIGHT_COLOR: Color = Color::from_rgba8(158, 133, 222, 255);
const PREVIEW_COLOR: Color = Color::from_rgba8(113, 64, 237, 127);

lazy_static! {
    static ref LINE_STROKE: Stroke = Stroke::new(4.0);
}

pub struct GraphViewerWidget<G> {
    gesture: Gesture,
    graph: Arc<Mutex<G>>,
    hotkey_state: EnumMap<Hotkey, bool>,
    raw_mouse_position: Option<Point>,
    text_config: TextConfig,
    text_renderer: TextRenderer,
    transform: Affine,
}

impl<G: Graph> GraphViewerWidget<G> {
    fn new(graph: Arc<Mutex<G>>) -> Self {
        Self {
            gesture: Default::default(),
            graph,
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

impl<G: Graph> GraphViewerWidget<G> {
    fn hovered_circle(&self, graph: &G) -> Option<NodeIndex> {
        // TODO: replace with something like kdtree: https://crates.io/crates/kdtree
        let Some(mouse_position) = self.mouse_position() else {
            return None;
        };

        for node_id in graph.node_indices().unwrap() {
            let node = graph.get_node(node_id).unwrap();
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
}

impl<G: Graph + 'static> Widget for GraphViewerWidget<G> {
    type Action = NoAction;

    fn on_pointer_event(
        &mut self,
        ctx: &mut EventCtx<'_>,
        _props: &mut PropertiesMut<'_>,
        event: &PointerEvent,
    ) {
        if !ctx.has_focus_target() {
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

        if let PointerEvent::Move(pointer_update) = event {
            let bounding_rect = ctx.bounding_rect();
            let new_position = Point::new(
                pointer_update.current.position.x - bounding_rect.x0,
                pointer_update.current.position.y - bounding_rect.y0,
            );

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
                let mut graph = self.graph.lock().unwrap();
                let mut node = graph.get_node(node_id).unwrap();
                node.circle.center = (self.transform.inverse() * new_position) + initial_distance;
                graph.set_node(node_id, node).unwrap();
            }

            self.raw_mouse_position = Some(new_position);

            // TODO: limit this to only ceratin scenarios, like
            // - when you start/stop hovering over a circle
            // - when you're in the middle of a gesture
            // - ???
            ctx.request_paint_only();
        }

        if let PointerEvent::Down(_) = event {
            match self.gesture {
                Gesture::Inactive | Gesture::Editing { .. } => {}
                _ => return,
            }

            let graph = self.graph.lock().unwrap();
            self.gesture = match self.hovered_circle(&graph) {
                None if self.hotkey_state[Hotkey::Space] => Gesture::Panning,
                None if self.hotkey_state[Hotkey::Control] => self.gesture,
                None => Gesture::AddingNode,

                Some(circle) if self.hotkey_state[Hotkey::Space] => {
                    let mouse_position = self
                        .mouse_position()
                        .expect("Must have mouse_position() if you also have hovered_circle()");
                    Gesture::MovingNode {
                        node_id: circle,
                        initial_distance: graph.get_node(circle).unwrap().circle.center
                            - mouse_position,
                    }
                }
                Some(circle) if self.hotkey_state[Hotkey::Control] => Gesture::Deleting,
                Some(circle) => Gesture::AddingEdge { from: circle },
            };
            ctx.request_paint_only();
        }

        if let PointerEvent::Up(_) = event {
            let mut graph = self.graph.lock().unwrap();
            let hovered_circle = self.hovered_circle(&graph);
            let mouse_position = self.mouse_position();

            self.gesture = match (self.gesture, hovered_circle) {
                (Gesture::AddingNode, None) => {
                    if let Some(mouse_position) = mouse_position {
                        graph
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
                        let to = graph
                            .add_node(Node {
                                title: "".to_owned(),
                                circle: Circle::new(mouse_position, CIRCLE_RADIUS),
                            })
                            .unwrap();
                        graph.add_edge(from, to).unwrap();
                    }
                    Gesture::Inactive
                }
                (Gesture::AddingEdge { from }, Some(to)) if from == to => {
                    Gesture::Editing { node_id: to }
                }
                (Gesture::AddingEdge { from }, Some(to)) => {
                    if !graph.would_create_cycle(from, to).unwrap_or(true) {
                        graph.add_edge(from, to).unwrap();
                    }
                    Gesture::Inactive
                }
                (Gesture::Deleting, Some(node_id)) => {
                    graph.remove_node(node_id).unwrap();
                    Gesture::Inactive
                }
                _ => Gesture::Inactive,
            };
            ctx.request_paint_only();
        }

        if let PointerEvent::Scroll(scroll_event) = event {
            let delta = match scroll_event.delta {
                ScrollDelta::LineDelta(x, y) => Vec2::new(x as f64 * 20.0, y as f64 * 20.0),
                ScrollDelta::PixelDelta(pos) => Vec2::new(pos.x, pos.y),
                ScrollDelta::PageDelta(x, y) => Vec2::new(x as f64 * 100.0, y as f64 * 100.0),
            };
            self.transform = self.transform.then_translate(delta);
            ctx.request_paint_only();
        }

        if let PointerEvent::Gesture(gesture_event) = event {
            let masonry::core::PointerGesture::Pinch(delta) = &gesture_event.gesture else {
                return;
            };
            let delta = *delta as f64;

            let Some(mouse_position) = self.mouse_position() else {
                return;
            };

            let translate = Affine::translate(mouse_position.to_vec2());
            self.transform =
                self.transform * translate * Affine::scale(1.0 + delta) * translate.inverse();

            ctx.request_paint_only();
        }

        ctx.request_cursor_icon_change();
    }

    fn on_text_event(
        &mut self,
        ctx: &mut EventCtx<'_>,
        _props: &mut PropertiesMut<'_>,
        event: &TextEvent,
    ) {
        let TextEvent::Keyboard(key) = event else {
            return;
        };

        if let Gesture::Editing { node_id } = self.gesture {
            let mut graph = self.graph.lock().unwrap();
            let mut node = graph.get_node(node_id).unwrap();
            if let Some(new_title) = update_title(&node.title, key) {
                node.title = new_title;
                graph.set_node(node_id, node).unwrap();
                ctx.request_paint_only();
            }
            ctx.request_paint_only();
        }

        if key.repeat {
            return;
        }

        if key.code == Code::Escape {
            self.gesture = Gesture::Inactive;
            ctx.request_paint_only();
            return;
        }

        let Some(hotkey) = Hotkey::from_code(key.code) else {
            return;
        };
        match key.state {
            KeyState::Down => {
                self.hotkey_state[hotkey] = true;
            }
            KeyState::Up => {
                ctx.request_cursor_icon_change();
                self.hotkey_state[hotkey] = false;
            }
        }
        ctx.request_cursor_icon_change();
    }

    fn on_access_event(
        &mut self,
        _ctx: &mut EventCtx<'_>,
        _props: &mut PropertiesMut<'_>,
        _event: &AccessEvent,
    ) {
    }

    fn register_children(&mut self, _ctx: &mut RegisterCtx<'_>) {}

    fn layout(
        &mut self,
        _ctx: &mut LayoutCtx<'_>,
        _props: &mut PropertiesMut<'_>,
        bc: &BoxConstraints,
    ) -> Size {
        bc.max()
    }

    fn paint(
        &mut self,
        ctx: &mut PaintCtx<'_>,
        _props: &PropertiesRef<'_>,
        parent_scene: &mut Scene,
    ) {
        let mut scene = Scene::new();
        let size = ctx.size();
        let clip_rect = Rect::from_origin_size(Point::ORIGIN, size);

        scene.push_layer(
            vello::peniko::BlendMode::default(),
            1.0,
            self.transform.inverse(),
            &clip_rect,
        );

        let graph = self.graph.lock().unwrap();
        for circle_id in graph.node_indices().unwrap() {
            let node = graph.get_node(circle_id).unwrap();

            let is_in_circle = match self.mouse_position() {
                None => false,
                Some(mouse_position) => shapes::in_circle(&mouse_position, &node.circle),
            };

            let would_create_cycle = match self.gesture {
                Gesture::AddingEdge { from } => {
                    graph.would_create_cycle(from, circle_id).unwrap_or(true)
                }
                _ => false,
            };

            let circle_fill_color = if is_in_circle && self.gesture == Gesture::Deleting {
                BASE_COLOR.with_alpha(0.25)
            } else if is_in_circle & self.hotkey_state[Hotkey::Control] {
                BASE_COLOR.with_alpha(0.5)
            } else if is_in_circle && !would_create_cycle {
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

            for neighbor_circle_id in graph.neighbors(circle_id).unwrap() {
                let neighbor_node = &graph.get_node(neighbor_circle_id).unwrap();
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

        match (
            self.mouse_position(),
            self.gesture,
            self.hovered_circle(&graph),
        ) {
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
                    &graph.get_node(from).unwrap().circle,
                    &preview_circle,
                );
            }
            (_, Gesture::AddingEdge { from }, Some(to)) => {
                if !graph.would_create_cycle(from, to).unwrap_or(true) {
                    draw_arrow_between(
                        &mut scene,
                        &PREVIEW_COLOR,
                        &graph.get_node(from).unwrap().circle,
                        &graph.get_node(to).unwrap().circle,
                    );
                }
            }
            _ => {}
        }

        scene.pop_layer();
        parent_scene.append(&scene, Some(self.transform));
    }

    fn accessibility_role(&self) -> Role {
        Role::Unknown
    }

    fn accessibility(
        &mut self,
        _: &mut AccessCtx<'_>,
        _: &PropertiesRef<'_>,
        _: &mut masonry::accesskit::Node,
    ) {
    }

    fn children_ids(&self) -> SmallVec<[WidgetId; 16]> {
        SmallVec::default()
    }

    fn get_cursor(&self, _ctx: &QueryCtx<'_>, _pos: Point) -> CursorIcon {
        match self.gesture {
            Gesture::Inactive if self.hotkey_state[Hotkey::Space] => CursorIcon::Grab,
            Gesture::MovingNode { .. } => CursorIcon::Grabbing,
            Gesture::Panning => CursorIcon::Grabbing,
            _ => CursorIcon::Default,
        }
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
    fn from_code(code: Code) -> Option<Self> {
        match code {
            Code::ControlLeft => Some(Self::Control),
            Code::ControlRight => Some(Self::Control),
            Code::Space => Some(Self::Space),
            _ => None,
        }
    }
}

fn update_title(title: &str, key: &KeyboardEvent) -> Option<String> {
    // Only process key down events
    if key.state != KeyState::Down {
        return None;
    }

    match &key.key {
        Key::Character(text) => Some(title.to_string() + text.as_str()),
        Key::Named(NamedKey::Enter) => Some(title.to_string() + "\n"),
        Key::Named(NamedKey::Backspace) if !title.is_empty() => {
            Some(title[0..title.len() - 1].to_string())
        }
        _ => None,
    }
}

pub struct GraphViewer {
    graph: Arc<Mutex<DatabaseGraph>>,
}

impl ViewMarker for GraphViewer {}

impl<AppState: 'static, Action: 'static> View<AppState, Action, ViewCtx> for GraphViewer {
    type Element = Pod<GraphViewerWidget<DatabaseGraph>>;
    type ViewState = ();

    fn build(&self, ctx: &mut ViewCtx, _: &mut AppState) -> (Self::Element, Self::ViewState) {
        (
            ctx.create_pod(GraphViewerWidget::new(self.graph.clone())),
            (),
        )
    }

    fn rebuild(
        &self,
        _prev: &Self,
        _: &mut Self::ViewState,
        _: &mut ViewCtx,
        _: Mut<'_, Self::Element>,
        _: &mut AppState,
    ) {
        // Nothing to rebuild
    }

    fn teardown(&self, _: &mut Self::ViewState, _: &mut ViewCtx, _: Mut<'_, Self::Element>) {}

    fn message(
        &self,
        _: &mut Self::ViewState,
        _: &mut xilem::core::MessageContext,
        _: Mut<'_, Self::Element>,
        _: &mut AppState,
    ) -> MessageResult<Action> {
        MessageResult::Stale
    }
}

pub fn graph_viewer(graph: Arc<Mutex<DatabaseGraph>>) -> GraphViewer {
    GraphViewer { graph }
}
