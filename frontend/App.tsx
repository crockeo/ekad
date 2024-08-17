import ForceGraph, {
  LinkObject as ForceGraphLinkObject,
  NodeObject as ForceGraphNodeObject,
} from "force-graph";
import React, { useEffect, useRef } from "react";

interface NodeObject extends ForceGraphNodeObject {
  nodeColor?: string;
}

interface LinkObject extends ForceGraphLinkObject {}

interface GraphData {
  nodes: NodeObject[];
  links: LinkObject[];
}

interface GraphViewProps {
	data: GraphData;
}

function GraphView({ data }: GraphViewProps) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!ref.current) { return; }

		const graph = ForceGraph()
		  .enableZoomInteraction(false)
		  .graphData(data)
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

				// TODO: Fix this to zoom in on the mouse position.
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
	}, []);

	return (
		<div ref={ref} />
	);
}

export default function App() {
	return (
		<div>
			Hello world!
			<GraphView
				data={{
					nodes: [
						{
							id: "node1",
							nodeColor: "red",
						},
						{
							id: "node2",
							nodeColor: "blue",
						},
					],
					links: [
						{
							source: "node1",
							target: "node2",
						},
					],
				}}
			/>
		</div>
	);
}
