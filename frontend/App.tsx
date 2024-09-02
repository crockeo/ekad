import { type ReactElement, useEffect, useState } from "react";

import Button from "@ekad/components/Button";
import { useHotkeys } from "@ekad/components/HotkeyProvider";
import ListView from "@ekad/components/ListView";
import Modal from "@ekad/components/Modal";
import SelectedTaskPane from "@ekad/components/SelectedTaskPane";
import TaskGraphView from "@ekad/components/TaskGraphView";
import type { UUID } from "@ekad/types";

enum View {
  LIST = 0,
  GRAPH = 1,
}

export default function App() {
  const [view, setView] = useState(View.LIST);

  const hotkeys = useHotkeys();
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.code === "Tab") {
        e.preventDefault();
        setView((view) => {
          switch (view) {
            case View.LIST:
              return View.GRAPH;
            case View.GRAPH:
              return View.LIST;
          }
        });
        return true;
      }
      return false;
    };
    return hotkeys.addKeydownHandler(listener);
  }, []);

  return (
    <div
      className="
      flex
      flex-col
      h-screen
      select-none
      text-sm
      w-screen
      "
    >
      <div className="h-[calc(100%-3rem)] w-full">{viewFor(view)}</div>
      <div className="h-[3rem]">
        <BottomBar view={view} setView={setView} />
      </div>
    </div>
  );
}

function viewFor(view: View): ReactElement {
  switch (view) {
    case View.LIST:
      return <ListView />;
    case View.GRAPH:
      return <GraphView />;
  }
}

function GraphView() {
  const [selectedTask, setSelectedTask] = useState<UUID | null>(null);
  return (
    <div className="h-full w-full">
      <TaskGraphView onSelectNode={(id) => setSelectedTask(id)} />

      <Modal onRequestClose={() => setSelectedTask(null)} open={!!selectedTask}>
        {selectedTask && (
          <SelectedTaskPane
            onSelectTask={setSelectedTask}
            task={selectedTask}
          />
        )}
      </Modal>
    </div>
  );
}

function BottomBar({
  view,
  setView,
}: {
  view: View;
  setView: (view: View) => void;
}) {
  const buttons = [
    {
      buttonView: View.LIST,
      name: "List",
    },
    {
      buttonView: View.GRAPH,
      name: "Graph",
    },
  ];

  return (
    <div
      className="
      border-gray-200
      border-t
      flex
      flex-row
      justify-center
      py-1
      space-x-2
      w-screen
      "
    >
      {buttons.map(({ buttonView, name }) => (
        <Button
          idleBorder={false}
          onClick={() => setView(buttonView)}
          type={buttonView === view ? "primary" : "secondary"}
          key={buttonView}
        >
          <div className="px-2 py-1">{name}</div>
        </Button>
      ))}
    </div>
  );
}
