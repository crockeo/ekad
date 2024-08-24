import { DirectedGraph } from "graphology";
import { useEffect, useState } from "react";
import { useDoc } from "./DocProvider";
import GraphView, { type GraphData } from "./GraphView";

export default function TaskGraphView() {
  const [doc, _] = useDoc();
  const [showCompleted, setShowCompleted] = useState(true);
  const [graphData, setGraphData] = useState(buildGraphData());
  useEffect(() => {
    setGraphData(buildGraphData());
  }, [doc.tasks, showCompleted]);
  return (
    <div className="border m-4 rounded">
      <div className="border-b p-4">
        <input
          checked={showCompleted}
          onChange={(e) => setShowCompleted(e.target.checked)}
          type="checkbox"
        />
        <span className="mx-1" />
        <label>Show completed?</label>
      </div>
      <GraphView data={graphData} />
    </div>
  );

  function buildGraphData(): GraphData {
    const graph = new DirectedGraph();
    for (const task of Object.values(doc.tasks)) {
      if (task.deletedAt) {
        continue;
      }
      graph.mergeNode(task.id);
      for (const blockedBy of task.blockedBy || []) {
        graph.mergeNode(blockedBy);
        graph.mergeEdge(task.id, blockedBy);
      }
    }

    if (!showCompleted) {
      for (const node of graph.nodes()) {
        if (!doc.tasks[node].completedAt) {
          continue;
        }

        for (const inboundNeighbor of graph.inboundNeighbors(node)) {
          for (const outboundNeighbor of graph.outboundNeighbors(node)) {
            graph.mergeEdge(inboundNeighbor, outboundNeighbor);
          }
        }
        graph.dropNode(node);
      }
    }

    const graphData: GraphData = {
      nodes: [],
      links: [],
    };
    for (const node of graph.nodes()) {
      const task = doc.tasks[node];
      graphData.nodes.push({
        id: task.id,
        name: task.title,
        nodeColor: task.completedAt ? "rgb(16 185 129)" : "#000000",
      });
      for (const neighbor of graph.outboundNeighbors(node)) {
        graphData.links.push({
          source: node,
          target: neighbor,
        });
      }
    }
    return graphData;
  }
}
