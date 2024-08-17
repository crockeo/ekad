import ForceGraph, {
  type LinkObject as ForceGraphLinkObject,
  type NodeObject as ForceGraphNodeObject,
} from "force-graph";
import { useEffect, useRef } from "react";

export interface NodeObject extends ForceGraphNodeObject {
  nodeColor?: string;
}

export interface LinkObject extends ForceGraphLinkObject {}

export interface GraphData {
  nodes: NodeObject[];
  links: LinkObject[];
}

interface GraphViewProps {
  data: GraphData;
  onBackgroundClick?: (event: MouseEvent) => void;
}

export default function GraphView({
	data,
	onBackgroundClick
}: GraphViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) { return; }

    const graph = ForceGraph()
      .enableZoomInteraction(false)
      .graphData(data)
      .nodeCanvasObjectMode(() => "after")
      .nodeCanvasObject((node, ctx, globalScale) => {
        // TODO: this is a strange type assertion to have to do.
        // how can I pass down the fact that the node here
        // must in fact be *our* NodeObject,
        // and not the one from force-graph?
        if (!node.id || typeof node.id != "string" || !node.x || !node.y) {
          return;
        }

        const fontSize = 12 / globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.id.replace(/^suma\.apps\./, ""), node.x, node.y + 8);
      })
      .onBackgroundClick((evt) => onBackgroundClick && onBackgroundClick(evt))
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
