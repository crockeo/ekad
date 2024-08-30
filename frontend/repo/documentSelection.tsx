// When someone has previous visited the site / opened the app
// we want to make sure that they see the document
// that they have visited previously.
const AUTOMERGE_DOCUMENT_URL_KEY = "automerge-document-url";

export function getAutomergeDocumentURL(): string | null {
  return window.localStorage.getItem(AUTOMERGE_DOCUMENT_URL_KEY);
}

export function setAutomergeDocumentURL(automergeDocumentID: string): void {
  window.localStorage.setItem(AUTOMERGE_DOCUMENT_URL_KEY, automergeDocumentID);
}
