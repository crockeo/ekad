use std::num::NonZeroUsize;
use std::sync::Arc;
use std::time::Instant;

fn main() -> anyhow::Result<()> {
    pretty_env_logger::init();
    log::info!("Hello world!");

    let event_loop = winit::event_loop::EventLoop::new()?;
    let render_cx = vello::util::RenderContext::new();

    let mut app = App {
        render_cx,
        render_state: None,
        renderers: Vec::new(),
        window: None,
    };
    event_loop.run_app(&mut app)?;

    Ok(())
}

const AA_CONFIGS: [vello::AaConfig; 3] = [
    vello::AaConfig::Area,
    vello::AaConfig::Msaa8,
    vello::AaConfig::Msaa16,
];

struct RenderState<'a> {
    // SAFETY: We MUST drop the surface before the `window`, so the fields
    // must be in this order
    surface: vello::util::RenderSurface<'a>,
    window: Arc<winit::window::Window>,
}

struct App<'a> {
    render_cx: vello::util::RenderContext,
    render_state: Option<RenderState<'a>>,
    renderers: Vec<Option<vello::Renderer>>,

    window: Option<Arc<winit::window::Window>>,
}

impl<'a> winit::application::ApplicationHandler for App<'a> {
    fn resumed(&mut self, event_loop: &winit::event_loop::ActiveEventLoop) {
        // The majority of this is copied and modified from Vello's `with_winit` example:
        // https://github.com/linebender/vello/blob/main/examples/with_winit/src/lib.rs

        if !self.render_state.is_none() {
            return;
        }

        let window = self.window.take().unwrap_or_else(|| {
            Arc::new(
                event_loop
                    .create_window(winit::window::Window::default_attributes())
                    .unwrap(),
            )
        });

        let size = window.inner_size();
        let surface_future = self.render_cx.create_surface(
            window.clone(),
            size.width,
            size.height,
            vello::wgpu::PresentMode::AutoVsync,
        );
        // We need to block here, in case a Suspended event appeared
        let surface = pollster::block_on(surface_future).expect("Error creating surface");
        self.render_state = {
            let render_state = RenderState { window, surface };
            self.renderers
                .resize_with(self.render_cx.devices.len(), || None);
            let id = render_state.surface.dev_id;
            self.renderers[id].get_or_insert_with(|| {
                let start = Instant::now();
                #[allow(unused_mut)]
                let mut renderer = vello::Renderer::new(
                    &self.render_cx.devices[id].device,
                    vello::RendererOptions {
                        surface_format: Some(render_state.surface.format),
                        use_cpu: false,
                        antialiasing_support: AA_CONFIGS.iter().copied().collect(),
                        num_init_threads: NonZeroUsize::new(2), // TODO: what should this number be?
                    },
                )
                .map_err(|e| {
                    // Pretty-print any renderer creation error using Display formatting before unwrapping.
                    anyhow::format_err!("{e}")
                })
                .expect("Failed to create renderer");
                log::info!("Creating renderer {id} took {:?}", start.elapsed());
                renderer
            });
            Some(render_state)
        };
        event_loop.set_control_flow(winit::event_loop::ControlFlow::Poll);
    }

    fn suspended(&mut self, event_loop: &winit::event_loop::ActiveEventLoop) {
        log::info!("Suspending");
        // When we suspend, we need to remove the `wgpu` Surface
        if let Some(render_state) = self.render_state.take() {
            self.window = Some(render_state.window);
        }
        event_loop.set_control_flow(winit::event_loop::ControlFlow::Wait);
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
