// Central config, env-overridable.
const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
const dataHome = Deno.env.get("XDG_DATA_HOME") ?? `${home}/.local/share`;

export const HOME_DIR = home;
// Headless serve binds loopback by default — the API exposes secret values.
export const PORT = Number(Deno.env.get("SCW_SECRETS_PORT") ?? "8790");
export const HOST = Deno.env.get("SCW_SECRETS_HOST") ?? "127.0.0.1";
export const DATA_DIR = `${dataHome}/scw-secrets`;
// Persisted window geometry (desktop mode).
export const WINDOW_FILE = `${DATA_DIR}/window.json`;
