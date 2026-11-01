// ===================
// CryptLink Engineering | 2026
// config.ts
// ===================
const envApiUrl: string | undefined = import.meta.env.VITE_API_URL as string | undefined;
const envWsUrl: string | undefined = import.meta.env.VITE_WS_URL as string | undefined;
const envRpId: string | undefined = import.meta.env.VITE_RP_ID as string | undefined;

const isBrowser = typeof window !== "undefined";
const defaultHost = isBrowser ? window.location.host : "localhost:8000";
const defaultHostname = isBrowser ? window.location.hostname : "localhost";
const defaultWsProtocol = isBrowser && window.location.protocol === "https:" ? "wss:" : "ws:";
const defaultApiUrl = isBrowser ? window.location.origin : "http://localhost:8000";
const defaultWsUrl = isBrowser ? `${defaultWsProtocol}//${defaultHost}` : "ws://localhost:8000";

export const API_URL =
  envApiUrl !== undefined && envApiUrl !== "" ? envApiUrl : defaultApiUrl;
export const WS_URL =
  envWsUrl !== undefined && envWsUrl !== "" ? envWsUrl : defaultWsUrl;
export const RP_ID =
  envRpId !== undefined && envRpId !== "" ? envRpId : defaultHostname;

export const WS_HEARTBEAT_INTERVAL = 30000;
export const WS_RECONNECT_DELAY = 5000;
export const MESSAGE_MAX_LENGTH = 50000;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const DISPLAY_NAME_MIN_LENGTH = 1;
export const DISPLAY_NAME_MAX_LENGTH = 100;

export const USER_SEARCH_MIN_LENGTH = 1;
export const USER_SEARCH_DEFAULT_LIMIT = 10;
