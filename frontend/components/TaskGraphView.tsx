import { useEffect, useState } from "react";

import { useRepo } from "@ekad/components/DocProvider";
import GraphView, { type GraphData } from "@ekad/components/GraphView";
import type { UUID } from "@ekad/types";
import { buildTaskGraph } from "@ekad/utils";

export default function TaskGraphView({
  onSelectNode,
}: {
  onSelectNode?: (id: UUID) => void;
}) {
  const repo = useRepo();
  const [showCompleted, setShowCompleted] = useState(false);
  const [graphData, setGraphData] = useState(buildGraphData());

  // TODO: how do i set the deps of this such that it doesn't
  // have to peek inside of the Repo?
  useEffect(() => {
    setGraphData(buildGraphData());
  }, [repo.doc.tasks, showCompleted]);

  return (
    <div className="border flex flex-col h-full rounded w-full">
      <div className="border-b p-4">
        <input
          checked={showCompleted}
          onChange={(e) => setShowCompleted(e.target.checked)}
          type="checkbox"
        />
        <span className="mx-1" />
        <label>Show completed?</label>
      </div>
      <GraphView
        data={graphData}
        onNodeClick={(node) => onSelectNode && onSelectNode(node.id)}
      />
    </div>
  );

  function buildGraphData(): GraphData {
    const graph = buildTaskGraph(repo, { showCompleted: showCompleted });
    const graphData: GraphData = {
      nodes: [],
      links: [],
    };
    for (const node of graph.nodes()) {
      const task = repo.getTask(node);
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
