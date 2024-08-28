import { topologicalGenerations } from "graphology-dag";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { uuidv7 } from "uuidv7";

import Button from "@ekad/components/Button";
import { useRepo } from "@ekad/components/DocProvider";
import Fold from "@ekad/components/Fold";
import Modal from "@ekad/components/Modal";
import SelectedTaskPane from "@ekad/components/SelectedTaskPane";
import TaskCard from "@ekad/components/TaskCard";
import TaskGraphView from "@ekad/components/TaskGraphView";
import TextInput from "@ekad/components/TextInput";
import type { Task, UUID } from "@ekad/types";
import { buildTaskGraph, sortBy } from "@ekad/utils";

export default function App() {
  const repo = useRepo();

  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<UUID | null>(null);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        document.activeElement != input.current &&
        e.key.toLowerCase() == "c"
      ) {
        input.current?.focus();
        e.preventDefault();
      }
      if (document.activeElement == input.current && e.key == "Escape") {
        input.current?.blur();
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
    };
  }, []);

  return (
    <div
      className="
      px-4
      py-8
      flex
      flex-row
      h-screen
      overflow-hidden
      md:grid-cols-3
      "
    >
      <div className="flex flex-col flex-[1_1] h-full px-4">
        <form className="flex flex-row flex-shrink-0" onSubmit={newTask}>
          <TextInput
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            $ref={input}
            value={title}
          />

          <div className="mx-2" />

          <Button disabled={!title} type="constructive">
            <span className="px-4 py-2">Add</span>
          </Button>
        </form>

        <div className="my-4 flex-shrink-0" />

        <div className="flex-grow space-y-1 overflow-y-auto">
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

      <div className="flex-[2_2]">
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
    const graph = buildTaskGraph(repo);
    const order = [];
    for (const generation of topologicalGenerations(graph).toReversed()) {
      sortBy(generation, (id) => repo.getTask(id).title);
      order.push(...generation);
    }
    return order.map((taskID) => repo.getTask(taskID));
  }

  function completedTasks(): Task[] {
    return repo
      .tasks()
      .map((task) => repo.getTask(task))
      .filter((task) => task.completedAt && !task.deletedAt);
  }

  function newTask(e: FormEvent) {
    e.preventDefault();

    const id = uuidv7();
    const newTask = {
      id: id,
      title: title,
      description: "",
      completedAt: null,
      deletedAt: null,
      blocks: {},
      blockedBy: {},
    };

    setTitle("");
    repo.createTask(newTask);
    setSelectedTask(newTask.id);
  }
}
