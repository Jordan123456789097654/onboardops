/** Share links from the cloud drives employers already use. We store the link, not a copy of the file. */
const HOSTS = [/(^|\.)drive\.google\.com$/, /(^|\.)docs\.google\.com$/, /(^|\.)sharepoint\.com$/, /(^|\.)onedrive\.live\.com$/, /^1drv\.ms$/, /(^|\.)dropbox\.com$/, /(^|\.)box\.com$/];

export function validDocLink(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password && HOSTS.some((h) => h.test(u.hostname.toLowerCase()));
  } catch {
    return false;
  }
}

export const DOC_LINK_ERROR = "Use a share link from Google Drive, SharePoint or OneDrive, Dropbox or Box (it must start with https://).";
