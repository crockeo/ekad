use std::f64::consts::PI;

use vello::kurbo::{Line, Point, Vec2};

const ARROW_ARM_LENGTH: f64 = 60.0;

pub fn arrow(from: Point, to: Point) -> [Line; 3] {
    let backwards_direction = (from.to_vec2() - to.to_vec2()).normalize();

    let clockwise_arm = to + (Mat2::rotate(0.2 * PI) * backwards_direction * ARROW_ARM_LENGTH);
    let anticlockwise_arm = to + (Mat2::rotate(-0.2 * PI) * backwards_direction * ARROW_ARM_LENGTH);

    [
        Line::new(from, to),
        Line::new(to, clockwise_arm),
        Line::new(to, anticlockwise_arm),
    ]
}

// TODO: is there something inside of one of the vello libraries
// that would let us do this without having to implement it ourselves?
struct Mat2([f64; 4]);

impl Mat2 {
    fn rotate(radians: f64) -> Self {
        Self([radians.cos(), -radians.sin(), radians.sin(), radians.cos()])
    }
}

impl std::ops::Mul<Vec2> for Mat2 {
    type Output = Vec2;

    fn mul(self, rhs: Vec2) -> Self::Output {
        Vec2::new(
            rhs.x * self.0[0] + rhs.y * self.0[1],
            rhs.x * self.0[2] + rhs.y * self.0[3],
        )
    }
}
