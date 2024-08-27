import {
  type AutomergeUrl,
  type Doc,
  type ChangeFn,
  updateText,
} from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { createContext, type PropsWithChildren, useContext } from "react";

import type { Ekad, Task, UUID } from "../types";

type changeDocFn = (changeFn: ChangeFn<Ekad>, options?: any) => void;
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
      updateText(doc, ["tasks", id, "title"], title);
    });
  }

  setDescription(id: UUID, description: string): void {
    this.changeDoc((doc) => {
      updateText(doc, ["tasks", id, "description"], description);
    });
  }

  complete(id: UUID, isComplete: boolean): void {
    this.changeDoc((doc) => {
      doc.tasks[id].completedAt = isComplete ? null : new Date();
    });
  }

  delete(id: UUID): void {
    this.changeDoc((doc) => {
      doc.tasks[id].deletedAt = new Date();

      // TODO: test that this works? and maybe pull it out into a generic "remove edge" function?
      for (const blocks of doc.tasks[id].blocks || []) {
        const pos = doc.tasks[blocks].blockedBy.indexOf(id);
        if (pos != -1) {
          doc.tasks[blocks].blockedBy.splice(pos, 1);
        }
      }
      for (const blockedBy of doc.tasks[id].blockedBy || []) {
        const pos = doc.tasks[blockedBy].blocks.indexOf(id);
        if (pos != -1) {
          doc.tasks[blockedBy].blockedBy.splice(pos, 1);
        }
      }
    });
  }

  addEdge(from: UUID, to: UUID): void {
    this.changeDoc((doc) => {
      if (!doc.tasks[from].blockedBy) {
        doc.tasks[from].blockedBy = [];
      }
      if (!doc.tasks[to].blocks) {
        doc.tasks[to].blocks = [];
      }

      if (doc.tasks[from].blockedBy.findIndex((val) => val == from) == -1) {
        doc.tasks[from].blockedBy.push(to);
      }
      if (doc.tasks[to].blocks.findIndex((val) => val == to) == -1) {
        doc.tasks[to].blocks.push(from);
      }
    });
  }

  removeEdge(from: UUID, to: UUID): void {
    this.changeDoc((doc) => {
      // For some reason `.indexOf` isn't working here,
      // despite these UUIDs existing in the arrays.
      // So we're manually finding the index and splicing :/
      let blockedByIndex = -1;
      for (let i = 0; i < doc.tasks[from].blockedBy.length; i++) {
        if (doc.tasks[from].blockedBy[i] == to) {
          blockedByIndex = i;
          break;
        }
      }
      if (blockedByIndex >= 0) {
        doc.tasks[from].blockedBy.splice(blockedByIndex);
      }

      let blocksIndex = -1;
      for (let i = 0; i < doc.tasks[to].blocks.length; i++) {
        if (doc.tasks[to].blocks[i] == from) {
          blocksIndex = i;
          break;
        }
      }
      if (blocksIndex) {
        doc.tasks[to].blocks.splice(blocksIndex);
      }
    });
  }
}

export function useRepo(): Repo {
  const [doc, changeDoc] = useDoc();
  return new Repo(doc, changeDoc);
}
