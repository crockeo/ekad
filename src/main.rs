fn main() -> anyhow::Result<()> {
    pretty_env_logger::init();
    log::info!("Hello world!");

    let event_loop = winit::event_loop::EventLoop::new()?;
    let render_cx = vello::util::RenderContext::new();

    let mut app = App { window: None };
    event_loop.run_app(&mut app)?;

    Ok(())
}

struct App {
    window: Option<winit::window::Window>,
}

impl winit::application::ApplicationHandler for App {
    fn resumed(&mut self, event_loop: &winit::event_loop::ActiveEventLoop) {
        self.window = Some(
            event_loop
                .create_window(winit::window::Window::default_attributes())
                .expect("Failed to create window"),
        )
    }

    fn window_event(
        &mut self,
        event_loop: &winit::event_loop::ActiveEventLoop,
        window_id: winit::window::WindowId,
        event: winit::event::WindowEvent,
    ) {
        use winit::event::WindowEvent::*;
        match event {
            CloseRequested => event_loop.exit(),
            RedrawRequested => self.window.as_ref().unwrap().request_redraw(),
            _ => {}
        }
    }
}
