// @flow
import { loadScript } from '../../Utils/LoadScript';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const CLIENT_ID_STORAGE_KEY = 'gdevelop-debloated-google-drive-client-id';
const DRIVE_SESSION_STORAGE_KEY = 'gdevelop-debloated-google-drive-session';

let identityScriptPromise = null;
let accessToken = '';
let accessTokenExpiresAt = 0;
let connectedAccount = null;
let sessionLoaded = false;
let silentAuthFailed = false;
let restorePromise: ?Promise<?string> = null;
let connectionGeneration = 0;
const accountListeners: Set<() => void> = new Set();

const notifyAccountListeners = () => {
  accountListeners.forEach(listener => listener());
};

export const subscribeToGoogleDriveAccount = (
  listener: () => void
): (() => void) => {
  accountListeners.add(listener);
  return () => {
    accountListeners.delete(listener);
  };
};

export const getGoogleDriveClientId = (): string =>
  (process.env.REACT_APP_GOOGLE_DRIVE_CLIENT_ID ||
    window.localStorage.getItem(CLIENT_ID_STORAGE_KEY) ||
    '').trim();

export const setGoogleDriveClientId = (clientId: string): void => {
  if (process.env.REACT_APP_GOOGLE_DRIVE_CLIENT_ID) return;
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId.trim());
};

type SavedDriveSession = {|
  clientId: string,
  account: string,
  token: string,
  expiresAt: number,
|};

const readSavedSession = (): ?SavedDriveSession => {
  try {
    const stored = window.localStorage.getItem(DRIVE_SESSION_STORAGE_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored);
    if (
      !session ||
      session.clientId !== getGoogleDriveClientId() ||
      typeof session.account !== 'string' ||
      typeof session.token !== 'string' ||
      !Number.isFinite(session.expiresAt)
    ) {
      return null;
    }
    return session;
  } catch (error) {
    return null;
  }
};

const writeSavedSession = (account: string): void => {
  try {
    window.localStorage.setItem(
      DRIVE_SESSION_STORAGE_KEY,
      JSON.stringify({
        clientId: getGoogleDriveClientId(),
        account,
        token: accessToken,
        expiresAt: accessTokenExpiresAt,
      })
    );
  } catch (error) {
    return;
  }
};

const hydrateSession = () => {
  if (sessionLoaded) return;
  sessionLoaded = true;
  const saved = readSavedSession();
  if (saved && saved.expiresAt > Date.now() + 5000) {
    accessToken = saved.token;
    accessTokenExpiresAt = saved.expiresAt;
    connectedAccount = saved.account;
  }
};

export const getRememberedDriveAccount = (): ?string =>
  readSavedSession()?.account || null;

export const getConnectedDriveAccount = (): ?string => {
  hydrateSession();
  return accessToken && Date.now() < accessTokenExpiresAt
    ? connectedAccount
    : null;
};

export const preloadGoogleIdentity = (): Promise<void> => {
  if (!identityScriptPromise) {
    identityScriptPromise = loadScript(
      'https://accounts.google.com/gsi/client'
    ).catch(error => {
      identityScriptPromise = null;
      throw error;
    });
  }
  return identityScriptPromise;
};

const requestDriveAccessToken = async ({
  clientId,
  prompt,
  loginHint,
  timeoutMs,
}: {|
  clientId: string,
  prompt: string,
  loginHint?: string,
  timeoutMs: number,
|}): Promise<any> => {
  await preloadGoogleIdentity();
  const google = (window: any).google;
  if (!google || !google.accounts || !google.accounts.oauth2) {
    throw new Error('Google account sign-in could not be loaded.');
  }

  return new Promise((resolve, reject) => {
    let completed = false;
    const finish = (error, token) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(token);
    };
    const timeout = setTimeout(
      () => finish(new Error('Google sign-in did not respond.')),
      timeoutMs
    );
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        ...(loginHint ? { login_hint: loginHint } : {}),
        callback: response => {
          if (!response || response.error || !response.access_token) {
            finish(
              new Error(
                response?.error_description ||
                  response?.error ||
                  'Google authorization failed.'
              )
            );
            return;
          }
          finish(null, response);
        },
        error_callback: response => {
          finish(
            new Error(
              response?.message ||
                response?.type ||
                'Google authorization popup was closed.'
            )
          );
        },
      });
      client.requestAccessToken({ prompt });
    } catch (error) {
      finish(error);
    }
  });
};

const getAccountForToken = async (token: string): Promise<string> => {
  const response = await fetch(
    `${DRIVE_API}/about?fields=user(emailAddress,displayName)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    throw new Error(`Google Drive authorization failed (HTTP ${response.status}).`);
  }
  const account = await response.json();
  return account.user?.emailAddress ||
    account.user?.displayName ||
    'Google Drive';
};

const applyToken = (
  tokenResponse: any,
  account: string
): void => {
  accessToken = tokenResponse.access_token;
  accessTokenExpiresAt =
    Date.now() + Number(tokenResponse.expires_in || 3600) * 1000 - 60000;
  connectedAccount = account;
  sessionLoaded = true;
  silentAuthFailed = false;
  writeSavedSession(account);
  notifyAccountListeners();
};

const expireToken = (): void => {
  accessToken = '';
  accessTokenExpiresAt = 0;
  connectedAccount = null;
  const saved = readSavedSession();
  if (saved) writeSavedSession(saved.account);
  notifyAccountListeners();
};

export const restoreGoogleDriveSession = (): Promise<?string> => {
  hydrateSession();
  const account = getConnectedDriveAccount();
  if (account) return Promise.resolve(account);
  if (restorePromise) return restorePromise;

  const saved = readSavedSession();
  if (!saved || silentAuthFailed) return Promise.resolve(null);

  const generation = connectionGeneration;
  restorePromise = (async () => {
    try {
      const response = await requestDriveAccessToken({
        clientId: saved.clientId,
        prompt: 'none',
        loginHint: saved.account,
        timeoutMs: 12000,
      });
      const restoredAccount = await getAccountForToken(response.access_token);
      if (generation !== connectionGeneration) return getConnectedDriveAccount();
      if (
        saved.account.toLowerCase() !== restoredAccount.toLowerCase()
      ) {
        throw new Error('Google returned a different account.');
      }
      applyToken(response, restoredAccount);
      return restoredAccount;
    } catch (error) {
      silentAuthFailed = true;
      return null;
    } finally {
      restorePromise = null;
    }
  })();
  return restorePromise;
};

const requireAccessToken = async (): Promise<string> => {
  hydrateSession();
  if (getConnectedDriveAccount()) return accessToken;
  const account = await restoreGoogleDriveSession();
  if (!account) {
    throw new Error(
      'Google Drive session expired. Reconnect your Google account and try again.'
    );
  }
  return accessToken;
};

const driveFetch = async (
  url: string,
  options?: RequestOptions,
  operation: string = 'request'
): Promise<Response> => {
  const token = await requireAccessToken();
  const makeRequest = (authToken: string) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options && options.headers ? options.headers : {}),
        Authorization: `Bearer ${authToken}`,
      },
    });
  let response;
  try {
    response = await makeRequest(token);
    if (response.status === 401) {
      expireToken();
      const account = await restoreGoogleDriveSession();
      if (account) response = await makeRequest(accessToken);
    }
  } catch (error) {
    throw new Error(
      `Google Drive ${operation} failed: ${error.message || String(error)}. Check your network connection and browser permissions.`
    );
  }
  if (!response.ok) {
    const body = await response.text();
    let message = response.statusText || 'Unknown error';
    try {
      const parsed = JSON.parse(body);
      message = parsed.error?.message || message;
    } catch (error) {
      if (body) message = body;
    }
    const signInAdvice =
      response.status === 401
        ? ' Reconnect your Google account, then try again.'
        : '';
    throw new Error(
      `Google Drive ${operation} failed (HTTP ${response.status}): ${message.slice(0, 300)}.${signInAdvice}`
    );
  }
  return response;
};

export const connectGoogleDrive = async (
  clientId: string
): Promise<string> => {
  const trimmedClientId = clientId.trim();
  if (!trimmedClientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error('Enter a valid Google OAuth web client ID.');
  }
  connectionGeneration++;
  const tokenResponse = await requestDriveAccessToken({
    clientId: trimmedClientId,
    prompt: 'select_account',
    timeoutMs: 90000,
  });
  const account = await getAccountForToken(tokenResponse.access_token);
  setGoogleDriveClientId(trimmedClientId);
  applyToken(tokenResponse, account);
  return account;
};

export type DriveProjectFile = {|
  id: string,
  name: string,
  modifiedTime?: string,
|};

export const listGoogleDriveProjects = async (): Promise<Array<DriveProjectFile>> => {
  const projects = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: "trashed = false and appProperties has { key='gdevelopDebloated' and value='project' }",
      fields: 'nextPageToken,files(id,name,modifiedTime)',
      pageSize: '1000',
      orderBy: 'modifiedTime desc',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await driveFetch(`${DRIVE_API}/files?${params.toString()}`);
    const data = await response.json();
    projects.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return projects;
};

export const getGoogleDriveProject = async (id: string): Promise<Blob> => {
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`
  );
  return response.blob();
};

export const getGoogleDriveProjectMetadata = async (
  id: string
): Promise<DriveProjectFile> => {
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(id)}?fields=id,name,modifiedTime`
  );
  return response.json();
};

const multipartUpload = async ({
  url,
  method,
  metadata,
  archive,
}: {|
  url: string,
  method: 'POST' | 'PATCH',
  metadata: Object,
  archive: Blob,
|}): Promise<DriveProjectFile> => {
  const boundary = `gdevelop_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const contentType = `multipart/related; boundary=${boundary}`;
  const requestBody = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,
    archive,
    `\r\n--${boundary}--\r\n`,
  ]);
  const response = await driveFetch(
    url,
    {
      method,
      headers: { 'Content-Type': contentType },
      body: requestBody,
    },
    'upload'
  );
  return response.json();
};

const resumableUpload = async ({
  url,
  method,
  metadata,
  archive,
}: {|
  url: string,
  method: 'POST' | 'PATCH',
  metadata: Object,
  archive: Blob,
|}): Promise<DriveProjectFile> => {
  const response = await driveFetch(
    url,
    {
      method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/zip',
        'X-Upload-Content-Length': String(archive.size),
      },
      body: JSON.stringify(metadata),
    },
    'upload initialization'
  );
  const sessionUrl = response.headers.get('Location');
  if (!sessionUrl) {
    throw new Error('Google Drive did not provide the upload session address. Try saving again.');
  }
  const parsedUrl = new URL(sessionUrl);
  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== 'www.googleapis.com' ||
    !parsedUrl.pathname.startsWith('/upload/drive/')
  ) {
    throw new Error('Google Drive returned an invalid upload session address.');
  }
  const uploadResponse = await driveFetch(
    parsedUrl.href,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/zip' },
      body: archive,
    },
    'file upload'
  );
  return uploadResponse.json();
};

export const saveGoogleDriveProject = async ({
  id,
  name,
  archive,
}: {|
  id?: string,
  name: string,
  archive: Blob,
|}): Promise<DriveProjectFile> => {
  const method = id ? 'PATCH' : 'POST';
  const params = new URLSearchParams({
    uploadType: archive.size < 8 * 1024 * 1024 ? 'multipart' : 'resumable',
    fields: 'id,name,modifiedTime',
  });
  const url = id
    ? `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(id)}?${params.toString()}`
    : `${DRIVE_UPLOAD_API}/files?${params.toString()}`;
  const metadata = id
    ? { name }
    : {
        name,
        mimeType: 'application/zip',
        appProperties: { gdevelopDebloated: 'project' },
      };
  const uploader = archive.size < 8 * 1024 * 1024
    ? multipartUpload
    : resumableUpload;
  const file = await uploader({ url, method, metadata, archive });
  if (!file || !file.id || !file.modifiedTime) {
    throw new Error('Google Drive did not confirm the uploaded project. Check your Drive before retrying.');
  }
  return file;
};
