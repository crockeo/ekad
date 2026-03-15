#![allow(unused_variables)]
mod graph;
mod graph_viewer;
mod shapes;
mod text;

use crate::graph_viewer::GraphViewer;
use masonry::core::{ErasedAction, NewWidget, WidgetId};
use masonry::dpi::LogicalSize;
use masonry::theme::default_property_set;
use masonry_winit::app::{AppDriver, DriverCtx, NewWindow, WindowId};
use masonry_winit::winit::window::Window;

struct Ekad {
    window_id: WindowId,
}

impl AppDriver for Ekad {
    fn on_action(
        &mut self,
        window_id: WindowId,
        ctx: &mut DriverCtx<'_, '_>,
        widget_id: WidgetId,
        action: ErasedAction,
    ) {
    }
}

fn main() -> anyhow::Result<()> {
    let window_size = LogicalSize::new(1044.0, 800.0);
    let window_attributes = Window::default_attributes()
        .with_title("Ekad")
        .with_resizable(true)
        .with_min_inner_size(window_size);

    let driver = Ekad {
        window_id: WindowId::next(),
    };

    let event_loop = masonry_winit::app::EventLoop::with_user_event()
        .build()
        .unwrap();

    masonry_winit::app::run_with(
        event_loop,
        vec![NewWindow::new_with_id(
            driver.window_id,
            window_attributes,
            NewWidget::new(GraphViewer::<graph::DatabaseGraph>::default()).erased(),
        )],
        driver,
        default_property_set(),
    )?;

    Ok(())
}
