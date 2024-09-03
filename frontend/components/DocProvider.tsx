import {
  type AutomergeUrl,
  type ChangeFn,
  type Doc,
  updateText,
} from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import type { ChangeOptions } from "@automerge/automerge/slim/next";
import { type PropsWithChildren, createContext, useContext } from "react";

import type { Ekad, Task, UUID } from "@ekad/types";

type changeDocFn = (
  changeFn: ChangeFn<Ekad>,
  options?: ChangeOptions<Doc<Ekad>>,
) => void;
const docContext = createContext<[Doc<Ekad>, changeDocFn] | null>(null);

export function DocProvider({
  docUrl,
  children,
}: PropsWithChildren<{ docUrl: AutomergeUrl }>) {
  const [doc, changeDoc] = useDocument<Doc<Ekad>>(docUrl);

  return doc ? (
    <docContext.Provider value={[doc, changeDoc]}>
      {children}
    </docContext.Provider>
  ) : (
    <div />
  );
}

export function useDoc(): [Doc<Ekad>, changeDocFn] {
  const doc = useContext(docContext);
  if (!doc) {
    throw new Error(
      "Cannot find Automerge document from context. Are you missing a DocProvider?",
    );
  }
  return doc;
}

export class Repo {
  doc: Doc<Ekad>;
  changeDoc: changeDocFn;

  constructor(doc: Doc<Ekad>, changeDoc: changeDocFn) {
    this.doc = doc;
    this.changeDoc = changeDoc;
  }

  //////////
  // READ //
  tasks(): UUID[] {
    return Object.keys(this.doc.tasks);
  }

  getTask(id: UUID): Task {
    return this.doc.tasks[id];
  }

  ///////////
  // WRITE //
  createTask(task: Task): void {
    this.changeDoc((doc) => {
      doc.tasks[task.id] = task;
    });
  }

  setTitle(id: UUID, title: string): void {
    this.changeDoc((doc) => {
      updateText(doc, ["tasks", id, "title"], title.replaceAll("\n", ""));
    });
  }

  setDescription(id: UUID, description: string): void {
    this.changeDoc((doc) => {
      updateText(doc, ["tasks", id, "description"], description);
    });
  }

  complete(id: UUID, isComplete: boolean): void {
    this.changeDoc((doc) => {
      doc.tasks[id].completedAt = isComplete ? new Date() : null;
    });
  }

  delete(id: UUID): void {
    this.changeDoc((doc) => {
      doc.tasks[id].deletedAt = new Date();

      // TODO: test that this works? and maybe pull it out into a generic "remove edge" function?
      for (const blocks of Object.keys(doc.tasks[id].blocks)) {
        delete doc.tasks[blocks].blockedBy[id];
      }
      for (const blockedBy of Object.keys(doc.tasks[id].blockedBy)) {
        delete doc.tasks[blockedBy].blocks[id];
      }
    });
  }

  hardDelete(id: UUID): void {
    this.changeDoc((doc) => {
      for (const blocks of Object.keys(doc.tasks[id].blocks)) {
        delete doc.tasks[blocks].blockedBy[id];
      }
      for (const blockedBy of Object.keys(doc.tasks[id].blockedBy)) {
        delete doc.tasks[blockedBy].blocks[id];
      }
      delete doc.tasks[id];
    });
  }

  addEdge(from: UUID, to: UUID): void {
    // TODO: check that this does not create a cycle.
    this.changeDoc((doc) => {
      doc.tasks[from].blockedBy[to] = {};
      doc.tasks[to].blocks[from] = {};
    });
  }

  removeEdge(from: UUID, to: UUID): void {
    this.changeDoc((doc) => {
      delete doc.tasks[from].blockedBy[to];
      delete doc.tasks[to].blocks[from];
    });
  }
}

export function useRepo(): Repo {
  const [doc, changeDoc] = useDoc();
  return new Repo(doc, changeDoc);
}
