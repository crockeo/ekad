import { useEffect, useState } from "react";
import { useDoc } from "./DocProvider";
import GraphView, { type GraphData } from "./GraphView";

export default function TaskGraphView() {
  const [doc, _] = useDoc();
  const [graphData, setGraphData] = useState(buildGraphData());
  useEffect(() => {
    setGraphData(buildGraphData());
  }, [doc.tasks]);
  return <GraphView data={graphData} />;

  function buildGraphData(): GraphData {
    const nodes = [];
    const links = [];
    for (const task of Object.values(doc.tasks)) {
      if (task.deletedAt) {
        continue;
      }
      nodes.push({
        id: task.id,
        name: task.title,
        nodeColor: task.completedAt ? "rgb(16 185 129)" : "#000000",
      });
      for (const blocks of task.blocks || []) {
        if (doc.tasks[blocks].deletedAt) {
          continue;
        }
        links.push({
          source: blocks,
          target: task.id,
        });
      }
      for (const blockedBy of task.blockedBy || []) {
        if (doc.tasks[blockedBy].deletedAt) {
          continue;
        }
        links.push({
          source: task.id,
          target: blockedBy,
        });
      }
    }
    return {
      nodes: nodes,
      links: links,
    };
  }
}
