export function setCookie(key: string, value: string): void {
  const cookie = `${key}=${value};path=/`;
  document.cookie = cookie;
}

export function getCookie(key: string): string | null {
  const prefix = `${key}=`;
  for (let part of document.cookie.split(";")) {
    part = part.trimStart();
    if (part.indexOf(prefix) == 0) {
      return part.substring(prefix.length);
    }
  }
  return null;
}
