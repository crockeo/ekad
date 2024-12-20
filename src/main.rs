#![allow(unused_variables)]
mod graph;
mod graph_viewer;
mod shapes;
mod text;

use crate::graph_viewer::GraphViewer;
use masonry::app_driver::AppDriver;
use winit::dpi::LogicalSize;
use winit::window::Window;

struct Ekad {}

impl AppDriver for Ekad {
    fn on_action(
        &mut self,
        ctx: &mut masonry::app_driver::DriverCtx<'_>,
        widget_id: masonry::WidgetId,
        action: masonry::Action,
    ) {
    }
}

fn main() -> anyhow::Result<()> {
    let window_size = LogicalSize::new(1044, 800);
    let window_attributes = Window::default_attributes()
        .with_title("Ekad")
        .with_resizable(true)
        .with_min_inner_size(window_size);
    masonry::event_loop_runner::run(
        masonry::event_loop_runner::EventLoop::with_user_event(),
        window_attributes,
        GraphViewer::<graph::DatabaseGraph>::default(),
        Ekad {},
    )?;
    Ok(())
}
