import {
  DocHandle,
  isValidAutomergeUrl,
  Repo,
} from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import * as ReactDOM from "react-dom/client";

import App from "./App";
import { DocProvider } from "./components/DocProvider";
import { getCookie, setCookie } from "./cookies";

interface Ekad {}

const indexedDB = new IndexedDBStorageAdapter();
const broadcast = new BroadcastChannelNetworkAdapter();
const websocket = new BrowserWebSocketClientAdapter("wss://sync.automerge.org");
const repo = new Repo({
  storage: indexedDB,
  network: [broadcast, websocket],
});

function getRootDocHandle(): DocHandle<Ekad> {
  const locationHashURL = document.location.hash.substring(1);
  if (isValidAutomergeUrl(locationHashURL)) {
    setCookie("automergeDocumentURL", locationHashURL);
    return repo.find(locationHashURL);
  }

  const cookieURL = getCookie("automergeDocumentURL");
  if (isValidAutomergeUrl(cookieURL)) {
    document.location.hash = cookieURL;
    return repo.find(cookieURL);
  }

  const handle = repo.create<Ekad>({
    tasks: {},
  });
  document.location.hash = handle.url;
  setCookie("automergeDocumentURL", handle.url);
  return handle;
}

const handle = getRootDocHandle();

function AppWrapper() {
  return (
    <RepoContext.Provider value={openRepo()}>
      <DocProvider docUrl={handle.url}>
        <App />
      </DocProvider>
    </RepoContext.Provider>
  );

  function openRepo(): Repo {
    return repo;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<AppWrapper />);
