use masonry::Affine;
use std::f64::consts::PI;
use vello::kurbo::{Circle, Line, Point};

const ARROW_ARM_LENGTH: f64 = 20.0;
const ARROW_ARM_ANGLE: f64 = 0.2 * PI;

pub fn arrow(from: Point, to: Point) -> [Line; 3] {
    let backwards_direction = (from.to_vec2() - to.to_vec2()).normalize();

    let clockwise_transform = Affine::default()
        .then_translate(-to.to_vec2())
        .then_rotate(ARROW_ARM_ANGLE)
        .then_translate(to.to_vec2());
    let clockwise_arm = clockwise_transform * (to + backwards_direction * ARROW_ARM_LENGTH);

    let anticlockwise_transform = Affine::default()
        .then_translate(-to.to_vec2())
        .then_rotate(-ARROW_ARM_ANGLE)
        .then_translate(to.to_vec2());
    let anticlockwise_arm = anticlockwise_transform * (to + backwards_direction * ARROW_ARM_LENGTH);

    [
        Line::new(from, to),
        Line::new(to, clockwise_arm),
        Line::new(to, anticlockwise_arm),
    ]
}

pub fn in_circle(point: &Point, circle: &Circle) -> bool {
    point.distance_squared(circle.center) < circle.radius * circle.radius
}
