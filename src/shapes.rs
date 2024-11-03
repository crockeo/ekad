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

pub fn circle_bounding_square_size(radius: f64) -> f64 {
    // This is the width and height of a square whose corners sit on the circumference of a circle.
    //
    // - Circle has radius `radius`
    // - The distance from the center of the square to the corner is therefore `radius`.
    // - The distance from 1 corner of the square to the other is `2 * radius`.
    // - 1/2 of the square constitutes a right triangle, so you can use the pythagorean theorem
    //   to say that `a^2 + b^2 = (2r)^2`
    // - Because it's a square we know a = b, so it's `2a^2 = (2r)^2`
    // - And then it's just algebra:
    //   - `sqrt(2a^2) = sqrt(2r)^2`
    //   - `sqrt(2) * a = 2r`
    //   - `a = 2/sqrt(2) * r`
    2f64 / 2f64.sqrt() * radius
}
