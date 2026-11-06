// @flow
import { loadScript } from '../../Utils/LoadScript';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const CLIENT_ID_STORAGE_KEY = 'gdevelop-debloated-google-drive-client-id';

let identityScriptPromise = null;
let accessToken = '';
let accessTokenExpiresAt = 0;
let connectedAccount = null;
const accountListeners: Set<() => void> = new Set();

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

export const getConnectedDriveAccount = (): ?string => {
  if (Date.now() >= accessTokenExpiresAt) return null;
  return connectedAccount;
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

const requireAccessToken = (): string => {
  if (!accessToken || Date.now() >= accessTokenExpiresAt) {
    throw new Error('Google Drive session expired. Reconnect your Google account and try again.');
  }
  return accessToken;
};

const driveFetch = async (
  url: string,
  options?: RequestOptions,
  operation: string = 'request'
): Promise<Response> => {
  const headers = {
    ...(options && options.headers ? options.headers : {}),
    Authorization: `Bearer ${requireAccessToken()}`,
  };
  let response;
  try {
    response = await fetch(url, { ...options, headers });
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
  await preloadGoogleIdentity();
  const google = (window: any).google;
  if (!google || !google.accounts || !google.accounts.oauth2) {
    throw new Error('Google account sign-in could not be loaded.');
  }

  const tokenResponse = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          'Google sign-in did not respond. Check that popups are allowed and try again.'
        )
      );
    }, 90000);
    const fail = error => {
      clearTimeout(timeout);
      reject(error);
    };
    const client = google.accounts.oauth2.initTokenClient({
      client_id: trimmedClientId,
      scope: DRIVE_SCOPE,
      callback: response => {
        if (!response || response.error || !response.access_token) {
          fail(new Error(response?.error_description || response?.error || 'Google authorization failed.'));
          return;
        }
        clearTimeout(timeout);
        resolve(response);
      },
      error_callback: response => {
        fail(new Error(response?.message || response?.type || 'Google authorization popup was closed.'));
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });

  accessToken = tokenResponse.access_token;
  accessTokenExpiresAt = Date.now() + Number(tokenResponse.expires_in || 3600) * 1000 - 60000;
  setGoogleDriveClientId(trimmedClientId);
  const response = await driveFetch(`${DRIVE_API}/about?fields=user(emailAddress,displayName)`);
  const account = await response.json();
  connectedAccount = account.user?.emailAddress || account.user?.displayName || 'Google Drive';
  accountListeners.forEach(listener => listener());
  return connectedAccount;
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
