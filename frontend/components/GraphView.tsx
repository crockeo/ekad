import { useState } from "react";

import Modal from "@ekad/components/Modal";
import SelectedTaskPane from "@ekad/components/SelectedTaskPane";
import TaskGraphView from "@ekad/components/TaskGraphView";
import type { UUID } from "@ekad/types";

export default function GraphView() {
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
