import { topologicalGenerations } from "graphology-dag";
import { useState, type FormEvent } from "react";
import { uuidv7 } from "uuidv7";

import Button from "./components/Button";
import { useDoc } from "./components/DocProvider";
import Fold from "./components/Fold";
import Modal from "./components/Modal";
import SelectedTaskPane from "./components/SelectedTaskPane";
import TaskCard from "./components/TaskCard";
import TaskGraphView from "./components/TaskGraphView";
import TextInput from "./components/TextInput";
import type { Task, UUID } from "./types";
import { buildTaskGraph, sortBy } from "./utils";

export default function App() {
  const [doc, changeDoc] = useDoc();

  const [title, setTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<UUID | null>(null);

  return (
    <div
      className="
      grid
      px-4
      py-8
      md:grid-cols-3
      "
    >
      <div className="col-span-1 px-4">
        <form className="flex flex-row" onSubmit={newTask}>
          <TextInput
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            value={title}
          />

          <div className="mx-2" />

          <Button disabled={!title} type="constructive">
            <span className="px-4 py-2">Add</span>
          </Button>
        </form>

        <div className="my-4" />

        <div className="space-y-1">
          {openTasks().map((task) => (
            <TaskCard
              isSelected={selectedTask == task.id}
              key={task.id}
              onClick={setSelectedTask}
              task={task}
            />
          ))}
          <Fold name="Completed Tasks">
            {completedTasks().map((task) => (
              <TaskCard
                isSelected={selectedTask == task.id}
                key={task.id}
                onClick={setSelectedTask}
                task={task}
              />
            ))}
          </Fold>
        </div>
      </div>

      <div className="col-span-2">
        <TaskGraphView onSelectNode={(id) => setSelectedTask(id)} />
      </div>

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

  function openTasks(): Task[] {
    const graph = buildTaskGraph(doc);
    const order = [];
    for (const generation of topologicalGenerations(graph).toReversed()) {
      sortBy(generation, (id) => doc?.tasks[id].title);
      order.push(...generation);
    }
    return order.map((taskID) => doc?.tasks[taskID]);
  }

  function completedTasks(): Task[] {
    return Object.values(doc?.tasks).filter(
      (task) => task.completedAt && !task.deletedAt,
    );
  }

  function newTask(e: FormEvent) {
    e.preventDefault();
    if (!doc) {
      throw new Error("Cannot add task; DB is unavailable?");
    }

    const id = uuidv7();
    const newTask = {
      id: id,
      title: title,
      description: "",
      completedAt: null,
      deletedAt: null,
      blocks: [],
      blockedBy: [],
    };

    setTitle("");
    changeDoc((doc) => {
      doc.tasks[newTask.id] = newTask;
    });
    setSelectedTask(newTask.id);
  }
}
