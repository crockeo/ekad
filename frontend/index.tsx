import * as ReactDOM from "react-dom/client";
import App from "./App";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import {
  DocHandle,
  isValidAutomergeUrl,
  Repo,
} from "@automerge/automerge-repo";
import { RepoContext } from "@automerge/automerge-repo-react-hooks";

interface Ekad {}

const indexedDB = new IndexedDBStorageAdapter();
const broadcast = new BroadcastChannelNetworkAdapter();
const repo = new Repo({
  storage: indexedDB,
  network: [broadcast],
});

const rootDocURL = document.location.hash.substring(1);
let handle: DocHandle<Ekad>;
if (isValidAutomergeUrl(rootDocURL)) {
  handle = repo.find(rootDocURL);
} else {
  handle = repo.create<Ekad>({
    tasks: {},
  });
}
document.location.hash = handle.url;

function AppWrapper() {
  return (
    <RepoContext.Provider value={openRepo()}>
      <App docUrl={handle.url} />
    </RepoContext.Provider>
  );

  function openRepo(): Repo {
    return repo;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<AppWrapper />);
