mod graph;
mod graph_viewer;
mod shapes;
mod text;

use crate::graph_viewer::graph_viewer;
use winit::error::EventLoopError;
use xilem::{
    style::Style,
    view::{flex, label, Axis, FlexExt},
    Color, EventLoop, WidgetView, WindowOptions, Xilem,
};

#[derive(Default)]
struct AppState {}

impl AppState {
    fn main(&mut self) -> impl WidgetView<AppState> {
        flex(
            Axis::Horizontal,
            (
                flex(Axis::Vertical, label("This is where the menu will go"))
                    .border(Color::from_rgb8(255, 255, 255), 1.0)
                    .flex(1.0),
                (flex(
                    Axis::Vertical,
                    (
                        label("This is where the breadcrumbs will go"),
                        graph_viewer().flex(1.0),
                    ),
                )
                .border(Color::from_rgb8(255, 255, 255), 1.0)
                .flex(1.0)),
                flex(
                    Axis::Vertical,
                    label("This is where the node editor will go"),
                )
                .border(Color::from_rgb8(255, 255, 255), 1.0)
                .flex(1.0),
            ),
        )
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
