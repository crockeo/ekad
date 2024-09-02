import { HotkeysProvider } from "./components/HotkeyProvider";
import {
  type DocHandle,
  Repo,
  isValidAutomergeUrl,
} from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import * as ReactDOM from "react-dom/client";

import App from "@ekad/App";
import { DocProvider } from "@ekad/components/DocProvider";
import {
  getAutomergeDocumentURL,
  setAutomergeDocumentURL,
} from "@ekad/repo/documentSelection";
import type { Ekad } from "@ekad/types";

const indexedDB = new IndexedDBStorageAdapter();
const broadcast = new BroadcastChannelNetworkAdapter();
const websocket = new BrowserWebSocketClientAdapter("wss://sync.automerge.org");
const repo = new Repo({
  storage: indexedDB,
  network: [broadcast], // , websocket], can reenable later if we care to :)
});

function getRootDocHandle(): DocHandle<Ekad> {
  const locationHashURL = document.location.hash.substring(1);
  if (isValidAutomergeUrl(locationHashURL)) {
    setAutomergeDocumentURL(locationHashURL);
    return repo.find(locationHashURL);
  }

  const storedDocumentID = getAutomergeDocumentURL();
  if (isValidAutomergeUrl(storedDocumentID)) {
    document.location.hash = storedDocumentID;
    return repo.find(storedDocumentID);
  }

  const handle = repo.create<Ekad>({
    tasks: {},
  });
  document.location.hash = handle.url;
  setAutomergeDocumentURL(handle.url);
  return handle;
}

const handle = getRootDocHandle();

function AppWrapper() {
  let app = <App />;
  app = <DocProvider docUrl={handle.url}>{app}</DocProvider>;
  app = <HotkeysProvider>{app}</HotkeysProvider>;
  app = <RepoContext.Provider value={openRepo()}>{app}</RepoContext.Provider>;
  return app;

  function openRepo(): Repo {
    return repo;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find element with id `root` to render React app.");
}
const root = ReactDOM.createRoot(rootElement);
root.render(<AppWrapper />);
