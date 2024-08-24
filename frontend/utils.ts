import { DirectedGraph } from "graphology";
import type { Ekad } from "./types";
import type { Doc } from "@automerge/automerge-repo";

// taskGraph takes the list representation of tasks inside of an Automerge document
// and converts them into a graphology DirectedGraph.
export function buildTaskGraph(
  doc: Doc<Ekad>,
  options?: { showCompleted?: boolean },
): DirectedGraph {
  if (!options) {
    options = {};
  }
  options = {
    showCompleted: false,
    ...(options || {}),
  };

  const graph = new DirectedGraph();
  for (const task of Object.values(doc.tasks)) {
    if (task.deletedAt) {
      continue;
    }
    graph.mergeNode(task.id);
    for (const blockedBy of task.blockedBy || []) {
      if (doc.tasks[blockedBy].deletedAt) {
        continue;
      }
      graph.mergeNode(blockedBy);
      graph.mergeEdge(task.id, blockedBy);
    }
  }

  // When we don't show completed tasks,
  // we want to "merge" them out of the graph,
  // such that all incoming nodes are linked to all outgoing nodes.
  if (!options.showCompleted) {
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

  return graph;
}
