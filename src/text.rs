use std::sync::Arc;

use masonry::vello::kurbo::Affine;
use masonry::vello::peniko::{Blob, Brush, BrushRef, Color, Font};
use masonry::vello::{glyph::Glyph, Scene};
use vello::skrifa::{raw::FontRef, MetadataProvider};

const LAILA_FONT: &[u8] = include_bytes!("../res/Laila-Regular.ttf");

pub struct Text {
    font: Font,
}

impl Default for Text {
    fn default() -> Self {
        Self {
            font: Font::new(Blob::new(Arc::new(LAILA_FONT)), 0),
        }
    }
}

impl Text {
    pub fn add_run<'a>(
        &self,
        scene: &mut Scene,
        size: f32,
        brush: impl Into<BrushRef<'a>>,
        transform: Affine,
        text: &str,
    ) {
        let font_ref = to_font_ref(&self.font).unwrap();
        let brush = brush.into();
        let font_size = vello::skrifa::instance::Size::new(size);
        let axes = font_ref.axes();
        let variations: &[(&str, f32)] = &[];
        let var_loc = axes.location(variations);
        let metrics = font_ref.metrics(font_size, &var_loc);
        let line_height = metrics.ascent - metrics.descent + metrics.leading;
        let glyph_metrics = font_ref.glyph_metrics(font_size, &var_loc);
        let mut pen_x = 0f32;
        let mut pen_y = 0f32;
        scene
            .draw_glyphs(&self.font)
            .font_size(size)
            .transform(transform)
            .brush(brush)
            .draw(
                vello::peniko::Fill::NonZero,
                text.chars().filter_map(|ch| {
                    if ch == '\n' {
                        pen_y += line_height;
                        pen_x = 0.0;
                        return None;
                    }
                    let gid = font_ref.charmap().map(ch).unwrap_or_default();
                    let advance = glyph_metrics.advance_width(gid).unwrap_or_default();
                    let x = pen_x;
                    pen_x += advance;
                    Some(Glyph {
                        id: gid.to_u32(),
                        x,
                        y: pen_y,
                    })
                }),
            );
    }

    pub fn add(
        &self,
        scene: &mut Scene,
        size: f32,
        brush: Option<&Brush>,
        transform: Affine,
        text: &str,
    ) {
        let brush = brush.unwrap_or(&Brush::Solid(Color::WHITE));
        self.add_run(scene, size, brush, transform, text);
    }
}

fn to_font_ref(font: &Font) -> Option<FontRef<'_>> {
    use vello::skrifa::raw::FileRef;
    let file_ref = FileRef::new(font.data.as_ref()).ok()?;
    match file_ref {
        FileRef::Font(font) => Some(font),
        FileRef::Collection(collection) => collection.get(font.index).ok(),
    }
}
