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

    two.appendTo(ref.current);
    two.play();
    render();

    return () => {
      ref.current?.removeChild(two.renderer.domElement);
      two.pause();
    };
  }, [ref]);

  return <div className="h-full w-full" ref={ref} />;

  function render() {
    if (!ref.current) {
      return;
    }
    for (const taskID of repo.tasks()) {
      const task = repo.getTask(taskID);
      scene.current.setTask(task);
      for (const blockedByID of Object.keys(task.blockedBy)) {
        const blockedBy = repo.getTask(blockedByID);
        scene.current.setEdge(task, blockedBy);
      }
    }
  }
}

// GraphScene providers a wrapper around Two
// which lets us capture the state of our scene graph
// inside of a class, rather than inside of the React component.
class GraphScene {
  two: Two;
  tasks: Map<UUID, Circle>;
  edges: Map<[UUID, UUID], Line>;
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

  pan(dx: number, dy: number): void {}

  zoom(dz: number): void {}

  taskIDs(): IterableIterator<UUID> {
    return this.tasks.keys();
  }

  edgeIDs(): IterableIterator<[UUID, UUID]> {
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
    const [x, y] = this.transform(task.x, task.y);
    const circle = this.tasks.get(task.id);
    if (circle) {
      circle.position.x = x;
      circle.position.y = y;
    } else {
      this.tasks.set(task.id, this.two.makeCircle(x, y, 20));
    }
  }

  removeEdge(fromTaskID: UUID, toTaskID: UUID): void {
    const line = this.edges.get([fromTaskID, toTaskID]);
    if (line) {
      this.two.remove(line);
      this.edges.delete([fromTaskID, toTaskID]);
    }
  }

  setEdge(fromTask: Task, toTask: Task): void {
    const [fromX, fromY] = this.transform(fromTask.x, fromTask.y);
    const [toX, toY] = this.transform(toTask.x, toTask.y);

    const line = this.edges.get([fromTask.id, toTask.id]);
    if (line) {
      line.left.x = fromX;
      line.left.y = fromY;
      line.right.x = toX;
      line.right.x = toY;
    } else {
      this.edges.set(
        [fromTask.id, toTask.id],
        this.two.makeLine(fromX, fromY, toX, toY),
      );
    }
  }

  private transform(x: number, y: number): [number, number] {
    return this.affine.transform(x, y);
  }
}

class AffineTransform {
  private matrix: number[][];

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

  scale(sx: number, sy: number): this {
    const scaleMatrix = [
      [sx, 0, 0],
      [0, sy, 0],
      [0, 0, 1],
    ];
    this.multiply(scaleMatrix);
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
    const result: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          result[i][j] += this.matrix[i][k] * m[k][j];
        }
      }
    }

    this.matrix = result;
  }

  transform(x: number, y: number): [number, number] {
    const px =
      x * this.matrix[0][0] + y * this.matrix[0][1] + this.matrix[0][2];
    const py =
      x * this.matrix[1][0] + y * this.matrix[1][1] + this.matrix[1][2];
    return [px, py];
  }
}
