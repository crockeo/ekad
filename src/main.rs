mod graph;
mod graph_viewer;
mod shapes;
mod text;

use std::sync::{Arc, Mutex};

use crate::graph::DatabaseGraph;
use crate::graph_viewer::graph_viewer;
use winit::error::EventLoopError;
use xilem::{
    style::Style,
    view::{flex, grid, label, Axis, GridExt, GridParams},
    Color, EventLoop, WidgetView, WindowOptions, Xilem,
};

struct AppState {
    graph: Arc<Mutex<DatabaseGraph>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            graph: Arc::new(Mutex::new(DatabaseGraph::default())),
        }
    }
}

impl AppState {
    fn main(&mut self) -> impl WidgetView<AppState> {
        grid(
            (
                self.menu_pane().grid_item(GridParams::new(0, 0, 1, 1)),
                self.content_pane().grid_item(GridParams::new(1, 0, 4, 1)),
            ),
            5,
            1,
        )
    }

    fn menu_pane(&mut self) -> impl WidgetView<AppState> {
        flex(Axis::Vertical, label("Menu pane")).background_color(Color::from_rgb8(32, 32, 32))
    }

    fn content_pane(&mut self) -> impl WidgetView<AppState> {
        graph_viewer(self.graph.clone())
    }
}

fn main() -> Result<(), EventLoopError> {
    let app = Xilem::new_simple(
        AppState::default(),
        AppState::main,
        WindowOptions::new("ekad"),
    );
    app.run_in(EventLoop::with_user_event())?;
    Ok(())
}
