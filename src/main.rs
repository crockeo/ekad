#![allow(unused_variables)]
mod graph_viewer;
mod shapes;

use crate::graph_viewer::GraphViewer;
use masonry::app_driver::AppDriver;
use masonry::widget::RootWidget;
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
        // TODO: implement
        println!("{:?}", action);
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
        RootWidget::new(GraphViewer::default()),
        Ekad {},
    )?;
    Ok(())
}
