import { DirectedGraph } from "graphology";

import type { Repo } from "@ekad/components/DocProvider";

// taskGraph takes the list representation of tasks inside of an Automerge document
// and converts them into a graphology DirectedGraph.
export function buildTaskGraph(
  repo: Repo,
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
  for (const taskID of repo.tasks()) {
    const task = repo.getTask(taskID);
    if (task.deletedAt) {
      continue;
    }
    graph.mergeNode(task.id);
    for (const blockedBy of Object.keys(task.blockedBy)) {
      if (repo.getTask(blockedBy).deletedAt) {
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
      if (!repo.getTask(node).completedAt) {
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

// sortBy sorts the contents of `arr` in place
// by the value `sortKey` returns on the type.
export function sortBy<T, U>(
  arr: T[],
  sortKey: (t: T) => U,
  options?: { ascending?: boolean },
): void {
  if (!options) {
    options = {};
  }
  options = {
    ascending: true,
    ...options,
  };

  let bigger;
  let smaller;
  if (options.ascending) {
    bigger = 1;
    smaller = -1;
  } else {
    bigger = -1;
    smaller = 1;
  }

  arr.sort((a, b) => {
    const aSortKey = sortKey(a);
    const bSortKey = sortKey(b);
    if (aSortKey === bSortKey) {
      return 0;
    }
    if (aSortKey > bSortKey) {
      return bigger;
    }
    return smaller;
  });
}

export function updateTextAreaHeight(element: HTMLTextAreaElement): void {
  element.style.height = "1px";
  element.style.height = `${element.scrollHeight}px`;
}
