import {
  createContext,
  useContext,
  useRef,
  type PropsWithChildren,
} from "react";

const hotkeysContext = createContext<Hotkeys | null>(null);

export function HotkeysProvider({ children }: PropsWithChildren) {
  const hotkeys = useRef<Hotkeys>(new Hotkeys());
  return hotkeys ? (
    <hotkeysContext.Provider value={hotkeys.current}>
      {children}
    </hotkeysContext.Provider>
  ) : (
    <div />
  );
}

type Handler<E> = (e: E) => boolean;
type KeyboardEventHandler = Handler<KeyboardEvent>;

export class Hotkeys {
  keydownHandlers: ((e: KeyboardEvent) => boolean)[];

  constructor() {
    this.keydownHandlers = [];
    window.addEventListener("keydown", this.#handleKeydown);
  }

  addKeydownHandler(handler: KeyboardEventHandler): () => void {
    this.keydownHandlers.push(handler);
    return () => {
      const index = this.keydownHandlers.findIndex((h) => h == handler);
      if (index !== -1) {
        this.keydownHandlers.splice(index, 1);
      }
    };
  }

  #handleKeydown = (e: KeyboardEvent) => {
    for (let i = this.keydownHandlers.length - 1; i >= 0; i--) {
      const handler = this.keydownHandlers[i];
      if (handler(e)) {
        return;
      }
    }
  };
}

export function useHotkeys(): Hotkeys {
  const hotkeys = useContext(hotkeysContext);
  if (!hotkeys) {
    throw new Error(
      "Cannot find Hotkeys object from context. Are you missing a HotkeysProvider?",
    );
  }
  return hotkeys;
}
