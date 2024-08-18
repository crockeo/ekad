import ForceGraph, {
  type LinkObject as ForceGraphLinkObject,
  type NodeObject as ForceGraphNodeObject,
} from "force-graph";
import { useEffect, useRef } from "react";

export interface NodeObject extends ForceGraphNodeObject {
  id: string;
  name: string;
  nodeColor?: string;
}

function isNodeObject(obj: object): obj is NodeObject {
  return (
    "id" in obj
    && typeof obj.id == "string"
    && "name" in obj
  );
}

export interface LinkObject extends ForceGraphLinkObject {}

export interface GraphData {
  nodes: NodeObject[];
  links: LinkObject[];
}

interface GraphViewProps {
  data: GraphData;
  onNodeClick?: (node: NodeObject, event: MouseEvent) => void;
}

export default function GraphView({
  data,
  onNodeClick,
}: GraphViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) { return; }

    const graph = ForceGraph()
      .enableZoomInteraction(false)
      .graphData(data)
      .onNodeClick((node, event) => {
        if (isNodeObject(node) && onNodeClick) {
          onNodeClick(node, event);
        }
      })
      .onNodeDrag((node, translate) => {
        console.log(node, translate);
      })
      .nodeCanvasObjectMode(() => "after")
      .nodeCanvasObject((node, ctx, globalScale) => {
        if (!isNodeObject(node) || !node.x || !node.y) {
          return;
        }

        const fontSize = 6;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.name, node.x, node.y + 8);
      })
      .linkDirectionalArrowLength(5)
      .linkDirectionalArrowRelPos(1)
      .nodeColor((node: NodeObject) => node.nodeColor || "black");
    graph(ref.current);

    function onWheel(event: WheelEvent) {
      if (!ref.current) { return; }

      event.preventDefault();

      let zoom = graph.zoom();
      let { x, y } = graph.centerAt();
      if (event.ctrlKey) {
        // Magic: macOS and Windows laptops with zoom
        // set `WheelEvent.ctrlKey = true`
        // when it's a pinch event, and false otherwise.
        zoom -= (event.deltaY / 100) * zoom;
        if (zoom < 0.0) {
          zoom = 0.0;
        }

        // When you zoom in in-world mouse position gets translated.
        // This code adjusts the center of the graph
        // such that the mouse position in the world remains the same.
        const rect = ref.current.getBoundingClientRect();
        const rectCenterX = rect.x + rect.width / 2;
        const rectCenterY = rect.y + rect.height / 2;

        const mouseDeltaX = event.clientX - rectCenterX;
        const mouseDeltaY = event.clientY - rectCenterY;

        x -= mouseDeltaX * event.deltaY / 100 / zoom;
        y -= mouseDeltaY * event.deltaY / 100 / zoom;
      } else {
        x += event.deltaX / zoom;
        y += event.deltaY / zoom;
      }
      graph.zoom(zoom);
      graph.centerAt(x, y);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!ref.current) {
        return;
      }
      graph.width(ref.current.clientWidth);
      graph.height(ref.current.clientHeight);
    });

    ref.current.addEventListener("wheel", onWheel);
    resizeObserver.observe(ref.current);

    return () => {
        if (!ref.current) {
            return;
        }
      ref.current.removeEventListener("wheel", onWheel);
      resizeObserver.disconnect();
    };
  }, [data]);

  return (
    <div ref={ref} />
  );
}