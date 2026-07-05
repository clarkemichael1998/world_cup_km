// "admin" is the system user used for automated chat messages — exclude it
// from leaderboards/rankings too (it can't log in: random password hash).
const extraAdminUsernames = ["admin", "admin1998", "admin 1999", "admin1999", "michael98"];

export function isAdminUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  return getAdminUsernames().has(normalized);
}

export function getAdminUsernames() {
  return new Set([...envAdminUsernames(), ...extraAdminUsernames]);
}

function envAdminUsernames() {
  const multiAdminUsernames = process.env.ADMIN_USERNAMES
    ?.split(",")
    .map((username) => username.trim().toLowerCase())
    .filter(Boolean) ?? [];
  const legacyAdminUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  return [...multiAdminUsernames, ...(legacyAdminUsername ? [legacyAdminUsername] : [])];
}
