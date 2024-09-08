import { useEffect, useRef } from "react";
import Two from "two.js";
import type { Circle } from "two.js/src/shapes/circle";
import type { Line } from "two.js/src/shapes/line";

import { useRepo } from "@ekad/components/DocProvider";
import type { Task, UUID } from "@ekad/types";

export default function GraphView() {
  const repo = useRepo();
  const ref = useRef<HTMLDivElement>(null);
  const scene = useRef<GraphScene>(new GraphScene());

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const two = scene.current.two;

    ref.current.addEventListener("wheel", onWheel);
    two.appendTo(ref.current);
    two.play();
    render();

    return () => {
      ref.current?.removeEventListener("wheel", onWheel);
      ref.current?.removeChild(two.renderer.domElement);
      two.pause();
    };
  }, [ref]);

  return <div className="h-full w-full" ref={ref} />;

  function render() {
    if (!ref.current) {
      return;
    }

    // TODO: remove elements from the scene which no longer exist
    for (const taskID of repo.tasks()) {
      const task = repo.getTask(taskID);
      scene.current.setTask(task);
      for (const blockedByID of Object.keys(task.blockedBy)) {
        const blockedBy = repo.getTask(blockedByID);
        scene.current.setEdge(task, blockedBy);
      }
    }
  }

  function onWheel(event: WheelEvent) {
    if (!ref.current) {
      return;
    }
    event.preventDefault();

    if (event.ctrlKey) {
      // Magic: macOS and Windows laptops with zoom
      // set `WheelEvent.ctrlKey = true`
      // when it's a pinch event, and false otherwise.
      scene.current.zoom(-event.deltaY / 100);
      render();
    } else {
      scene.current.pan(-event.deltaX, -event.deltaY);
      render();
    }
  }
}

// GraphScene providers a wrapper around Two
// which lets us capture the state of our scene graph
// inside of a class, rather than inside of the React component.
class GraphScene {
  two: Two;
  tasks: Map<UUID, Circle>;
  edges: Map<string, Line>;
  affine: AffineTransform;

  constructor() {
    this.two = new Two(new Two({ fitted: true }));
    this.tasks = new Map();
    this.edges = new Map();
    this.affine = new AffineTransform().translate(
      this.two.width / 2,
      this.two.height / 2,
    );
  }

  pan(dx: number, dy: number): void {
    this.affine.thenTranslate(dx, dy);
  }

  zoom(dz: number): void {
    this.affine.thenScale(1.0 + dz, 1.0 + dz);
  }

  taskIDs(): IterableIterator<UUID> {
    return this.tasks.keys();
  }

  edgeIDs(): IterableIterator<string> {
    return this.edges.keys();
  }

  removeTask(taskID: UUID): void {
    const task = this.tasks.get(taskID);
    if (task) {
      this.two.remove(task);
      this.tasks.delete(taskID);
    }
  }

  setTask(task: Task): void {
    const [x, y, radius] = this.transformCircle(task.x, task.y, 20);
    const circle = this.tasks.get(task.id);
    if (circle) {
      circle.position.x = x;
      circle.position.y = y;
      circle.radius = radius;
      circle.linewidth = Math.min(this.affine.determinant(), 5.0);
    } else {
      const circle = this.two.makeCircle(x, y, radius);
      this.tasks.set(task.id, circle);
    }
  }

  removeEdge(fromTaskID: UUID, toTaskID: UUID): void {
    const key = `${fromTaskID}-${toTaskID}`;
    const line = this.edges.get(key);
    if (line) {
      this.two.remove(line);
      this.edges.delete(key);
    }
  }

  setEdge(fromTask: Task, toTask: Task): void {
    const [fromX, fromY] = this.transform(fromTask.x, fromTask.y);
    const [toX, toY] = this.transform(toTask.x, toTask.y);

    const key = `${fromTask.id}-${toTask.id}`;
    const line = this.edges.get(key);
    if (line) {
      line.left.x = fromX;
      line.left.y = fromY;
      line.right.x = toX;
      line.right.y = toY;
      line.linewidth = Math.min(this.affine.determinant(), 5.0);
    } else {
      this.edges.set(key, this.two.makeLine(fromX, fromY, toX, toY));
    }
  }

  private transformCircle(
    x: number,
    y: number,
    radius: number,
  ): [number, number, number] {
    const [newX, newY] = this.affine.transform(x, y);
    const [leftX] = this.affine.transform(x - radius, y);
    return [newX, newY, Math.abs(newX - leftX)];
  }

  private transform(x: number, y: number): [number, number] {
    return this.affine.transform(x, y);
  }
}

class AffineTransform {
  matrix: number[][];

  constructor() {
    this.matrix = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  translate(tx: number, ty: number): this {
    const translationMatrix = [
      [1, 0, tx],
      [0, 1, ty],
      [0, 0, 1],
    ];
    this.multiply(translationMatrix);
    return this;
  }

  thenTranslate(tx: number, ty: number): this {
    this.matrix = mulMat3x3(
      [
        [1, 0, tx],
        [0, 1, ty],
        [0, 0, 1],
      ],
      this.matrix,
    );
    return this;
  }

  scale(sx: number, sy: number): this {
    const scaleMatrix = [
      [sx, 0, 0],
      [0, sy, 0],
      [0, 0, 1],
    ];
    this.multiply(scaleMatrix);
    return this;
  }

  thenScale(sx: number, sy: number): this {
    this.matrix = mulMat3x3(
      [
        [sx, 0, 0],
        [0, sy, 0],
        [0, 0, 1],
      ],
      this.matrix,
    );
    return this;
  }

  rotate(angle: number): this {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotationMatrix = [
      [cos, -sin, 0],
      [sin, cos, 0],
      [0, 0, 1],
    ];
    this.multiply(rotationMatrix);
    return this;
  }

  private multiply(m: number[][]): void {
    this.matrix = mulMat3x3(this.matrix, m);
  }

  transform(x: number, y: number): [number, number] {
    const px =
      x * this.matrix[0][0] + y * this.matrix[0][1] + this.matrix[0][2];
    const py =
      x * this.matrix[1][0] + y * this.matrix[1][1] + this.matrix[1][2];
    return [px, py];
  }

  determinant(): number {
    const [[a, b, c], [d, e, f], [g, h, i]] = this.matrix;
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  }
}

function translationMat3x3(dx: number, dy: number): number[][] {
  return [
    [1, 0, dx],
    [0, 1, dy],
    [0, 0, 1],
  ];
}

function scaleMat3x3(dz: number): number[][] {
  return [
    [dz, 0, 0],
    [0, dz, 0],
    [0, 0, 1],
  ];
}

function mulMat3x3(m1: number[][], m2: number[][]): number[][] {
  const result: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        result[i][j] += m1[i][k] * m2[k][j];
      }
    }
  }

  return result;
}

function inverseMat3x3(m: number[][]): number[][] {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;

  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  if (Math.abs(det) < 1e-6) {
    throw new Error("Matrix is not invertible");
  }

  const invDet = 1 / det;

  return [
    [
      (e * i - f * h) * invDet,
      (c * h - b * i) * invDet,
      (b * f - c * e) * invDet,
    ],
    [
      (f * g - d * i) * invDet,
      (a * i - c * g) * invDet,
      (c * d - a * f) * invDet,
    ],
    [
      (d * h - e * g) * invDet,
      (g * b - a * h) * invDet,
      (a * e - b * d) * invDet,
    ],
  ];
}
