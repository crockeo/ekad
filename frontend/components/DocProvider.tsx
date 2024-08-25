import {
  type AutomergeUrl,
  type Doc,
  type ChangeFn,
} from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { createContext, type PropsWithChildren, useContext } from "react";

import type { Ekad } from "../types";

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
