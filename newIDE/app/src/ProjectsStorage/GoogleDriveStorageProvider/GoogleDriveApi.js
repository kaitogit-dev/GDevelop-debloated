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
  options?: RequestOptions
): Promise<Response> => {
  const headers = {
    ...(options && options.headers ? options.headers : {}),
    Authorization: `Bearer ${requireAccessToken()}`,
  };
  const response = await fetch(url, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const errorResponse = JSON.parse(body);
      message = errorResponse.error?.message || body;
    } catch (error) {
      message = body;
    }
    throw new Error(`Google Drive request failed (${response.status}): ${message.slice(0, 350)}`);
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
    const client = google.accounts.oauth2.initTokenClient({
      client_id: trimmedClientId,
      scope: DRIVE_SCOPE,
      callback: response => {
        if (!response || response.error || !response.access_token) {
          reject(new Error(response?.error_description || response?.error || 'Google authorization failed.'));
          return;
        }
        resolve(response);
      },
      error_callback: response => {
        reject(new Error(response?.message || response?.type || 'Google authorization popup was closed.'));
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

export const saveGoogleDriveProject = async ({
  id,
  name,
  archive,
}: {|
  id?: string,
  name: string,
  archive: Blob,
|}): Promise<DriveProjectFile> => {
  const params = new URLSearchParams({
    uploadType: 'resumable',
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
  const initialResponse = await driveFetch(url, {
    method: id ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/zip',
      'X-Upload-Content-Length': String(archive.size),
    },
    body: JSON.stringify(metadata),
  });
  const sessionUrl = initialResponse.headers.get('Location');
  if (!sessionUrl) {
    throw new Error('Google Drive did not return an upload session URL.');
  }
  const uploadResponse = await driveFetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/zip',
      'Content-Range': `bytes 0-${archive.size - 1}/${archive.size}`,
    },
    body: archive,
  });
  return uploadResponse.json();
};
