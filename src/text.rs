use std::sync::Arc;

use masonry::text::Selectable;
use masonry::vello::kurbo::Affine;
use masonry::vello::peniko::{Blob, Brush, Color, Font};
use masonry::vello::{glyph::Glyph, Scene};
use vello::skrifa::{metrics::GlyphMetrics, raw::FontRef, MetadataProvider};

const LAILA_FONT: &[u8] = include_bytes!("../res/Laila-Regular.ttf");

pub struct TextConfigBuilder {
    text_config: TextConfig,
}

impl Default for TextConfigBuilder {
    fn default() -> Self {
        Self {
            text_config: TextConfig {
                brush: Brush::Solid(Color::WHITE),
                font_size: 12.0,
                horizontal_alignment: HorizontalAlignment::Left,
            },
        }
    }
}

impl TextConfigBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_brush(mut self, brush: Brush) -> Self {
        self.text_config.brush = brush;
        self
    }

    pub fn set_font_size(mut self, font_size: f32) -> Self {
        self.text_config.font_size = font_size;
        self
    }

    pub fn set_horizontal_alignment(mut self, horizontal_alignment: HorizontalAlignment) -> Self {
        self.text_config.horizontal_alignment = horizontal_alignment;
        self
    }

    pub fn build(self) -> TextConfig {
        self.text_config
    }
}

pub struct TextConfig {
    brush: Brush,
    font_size: f32,
    horizontal_alignment: HorizontalAlignment,
}

#[derive(Copy, Clone)]
pub enum HorizontalAlignment {
    Left,
    Middle,
}

pub struct TextRenderer {
    font: Font,
}

impl Default for TextRenderer {
    fn default() -> Self {
        Self {
            font: Font::new(Blob::new(Arc::new(LAILA_FONT)), 0),
        }
    }
}

impl TextRenderer {
    pub fn render(&self, scene: &mut Scene, text_config: &TextConfig, text: &str) {
        self.render_with_transform(scene, text_config, Affine::IDENTITY, text)
    }

    pub fn render_with_transform(
        &self,
        scene: &mut Scene,
        text_config: &TextConfig,
        transform: Affine,
        text: &str,
    ) {
        let font_ref = to_font_ref(&self.font).unwrap();
        let font_size = vello::skrifa::instance::Size::new(text_config.font_size);
        let axes = font_ref.axes();
        let variations: &[(&str, f32)] = &[];
        let var_loc = axes.location(variations);
        let metrics = font_ref.metrics(font_size, &var_loc);
        let line_height = metrics.ascent - metrics.descent + metrics.leading;
        let glyph_metrics = font_ref.glyph_metrics(font_size, &var_loc);

        let chars: Vec<char> = text.chars().collect();
        let mut pen_x = initial_pen_x(
            &font_ref,
            &glyph_metrics,
            &chars,
            0,
            text_config.horizontal_alignment,
        );
        let mut pen_y = line_height / 4.0f32;
        scene
            .draw_glyphs(&self.font)
            .font_size(text_config.font_size)
            .transform(transform)
            .brush(&text_config.brush)
            .draw(
                vello::peniko::Fill::NonZero,
                text.chars().enumerate().filter_map(|(i, ch)| {
                    if ch == '\n' {
                        pen_y += line_height;
                        pen_x = initial_pen_x(
                            &font_ref,
                            &glyph_metrics,
                            &chars,
                            i + 1,
                            text_config.horizontal_alignment,
                        );
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
}

fn initial_pen_x(
    font_ref: &FontRef,
    glyph_metrics: &GlyphMetrics,
    chars: &[char],
    pos: usize,
    horizontal_alignment: HorizontalAlignment,
) -> f32 {
    match horizontal_alignment {
        HorizontalAlignment::Left => 0.0f32,
        HorizontalAlignment::Middle => {
            let line = next_line(chars, pos);
            let width = line_width(font_ref, glyph_metrics, line);
            -width / 2.0f32
        }
    }
}

fn next_line(chars: &[char], start: usize) -> &[char] {
    for (i, char) in chars.into_iter().skip(start).enumerate() {
        if *char == '\n' {
            return &chars[start..i];
        }
    }
    &chars[start..]
}

fn line_width(font_ref: &FontRef, glyph_metrics: &GlyphMetrics, chars: &[char]) -> f32 {
    let mut width = 0.0f32;
    let charmap = font_ref.charmap();
    for char in chars {
        let gid = charmap.map(*char).unwrap_or_default();
        let advance = glyph_metrics.advance_width(gid).unwrap_or_default();
        width += advance;
    }
    width
}

fn to_font_ref(font: &Font) -> Option<FontRef<'_>> {
    use vello::skrifa::raw::FileRef;
    let file_ref = FileRef::new(font.data.as_ref()).ok()?;
    match file_ref {
        FileRef::Font(font) => Some(font),
        FileRef::Collection(collection) => collection.get(font.index).ok(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_next_line__empty() {
        let chars = &[];
        let line = next_line(chars, 0);
        assert_eq!(line, chars);
    }

    #[test]
    fn test_next_line__single() {
        let chars = &['h', 'e', 'l', 'l', 'o'];
        let line = next_line(chars, 0);
        assert_eq!(line, chars);
    }

    #[test]
    fn test_next_line__double() {
        let chars = &['h', 'e', 'l', 'l', 'o', '\n', 'w', 'o', 'r', 'l', 'd'];
        let line1 = next_line(chars, 0);
        let line2 = next_line(chars, line1.len() + 1);

        assert_eq!(line1, &['h', 'e', 'l', 'l', 'o']);
        assert_eq!(line2, &['w', 'o', 'r', 'l', 'd']);
    }
}
