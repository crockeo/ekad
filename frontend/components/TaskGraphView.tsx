import { useState } from "react";

import GraphView, { type GraphData } from "@ekad/components/ArchiveGraphView";
import { useRepo } from "@ekad/components/DocProvider";
import type { UUID } from "@ekad/types";
import { buildTaskGraph } from "@ekad/utils";

export default function TaskGraphView({
  onSelectNode,
}: {
  onSelectNode?: (id: UUID) => void;
}) {
  const repo = useRepo();
  const [showCompleted, setShowCompleted] = useState(false);

  return (
    <div className="flex flex-col h-full rounded w-full">
      <div className="border-b p-2">
        <input
          checked={showCompleted}
          onChange={(e) => setShowCompleted(e.target.checked)}
          type="checkbox"
        />
        <span className="mx-1" />
        <label>Show completed?</label>
      </div>
      <GraphView
        data={buildGraphData()}
        onNodeClick={(node) => onSelectNode?.(node.id)}
        onNodeDrag={(node) => repo.setPosition(node.id, node.x, node.y)}
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
        x: task.x,
        y: task.y,
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
