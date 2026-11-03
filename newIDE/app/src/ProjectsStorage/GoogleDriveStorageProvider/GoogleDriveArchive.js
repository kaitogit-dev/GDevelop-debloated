// @flow
import { archiveFiles, openArchive } from '../../Utils/BrowserArchiver';
import { serializeToJSObject } from '../../Utils/Serializer';
import { isBlobURL, isURL, parseLocalFilePathOrExtensionFromMetadata } from '../../ResourcesList/ResourceUtils';
import { sanitizeFilename } from '../../Utils/Filename';
import { checkIfIsGDevelopCloudBucketUrl } from '../../Utils/CrossOrigin';
import newNameGenerator from '../../Utils/NewNameGenerator';

const resourceEntries = (content: any): Array<any> => {
  if (!content.resources || !Array.isArray(content.resources.resources)) return [];
  return content.resources.resources;
};

const getMimeType = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const types = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ttf: 'font/ttf',
    otf: 'font/otf',
    json: 'application/json',
    glb: 'model/gltf-binary',
    js: 'text/javascript',
    atlas: 'text/plain',
    fnt: 'text/plain',
    xml: 'application/xml',
  };
  return types[extension] || 'application/octet-stream';
};

export const archiveProjectForGoogleDrive = async (
  project: gdProject
): Promise<Blob> => {
  const content = serializeToJSObject(project);
  const resources = resourceEntries(content);
  const resourcesByName = project.getResourcesManager();
  const usedPaths = new Set(['game.json', 'drive-assets.json']);
  const blobFiles = [];
  const manifest = {};

  for (const resource of resources) {
    const resourceUrl = resource.file;
    if (!resourceUrl || typeof resourceUrl !== 'string') continue;
    const mustStoreResource =
      isBlobURL(resourceUrl) ||
      resourceUrl.startsWith('data:') ||
      checkIfIsGDevelopCloudBucketUrl(resourceUrl);
    if (!mustStoreResource) {
      if (!isURL(resourceUrl)) {
        throw new Error(`Cannot save relative resource "${resourceUrl}" to Google Drive.`);
      }
      continue;
    }

    const response = await fetch(resourceUrl);
    if (!response.ok) {
      throw new Error(`Cannot save resource "${resource.name}" (${response.status}).`);
    }
    const blob = await response.blob();
    const originalResource = resourcesByName.getResource(resource.name);
    const { extension } = parseLocalFilePathOrExtensionFromMetadata(originalResource);
    const filename = sanitizeFilename(resource.name || 'resource');
    const suffix = filename.match(/\.[a-z0-9]+$/i)
      ? ''
      : extension || '';
    const proposedName = filename + suffix;
    const basePath = `assets/${sanitizeFilename(resource.kind || 'other')}/`;
    const lastDot = proposedName.lastIndexOf('.');
    const basename = lastDot > 0 ? proposedName.slice(0, lastDot) : proposedName;
    const fileExtension = lastDot > 0 ? proposedName.slice(lastDot) : '';
    const uniqueName = newNameGenerator(basename, name =>
      usedPaths.has(basePath + name + fileExtension)
    );
    const assetPath = basePath + uniqueName + fileExtension;
    usedPaths.add(assetPath);
    resource.file = assetPath;
    manifest[assetPath] = blob.type || getMimeType(assetPath);
    blobFiles.push({ filePath: assetPath, blob });
  }

  return archiveFiles({
    textFiles: [
      { filePath: 'game.json', text: JSON.stringify(content) },
      { filePath: 'drive-assets.json', text: JSON.stringify(manifest) },
    ],
    blobFiles,
    basePath: '/',
    onProgress: () => {},
  });
};

export const openProjectFromGoogleDriveArchive = async (
  archiveBlob: Blob
): Promise<Object> => {
  const archive = await openArchive(archiveBlob);
  try {
    const gameJsonBlob = await archive.getFileBlob('game.json', 'application/json');
    const manifestBlob = await archive.getFileBlob('drive-assets.json', 'application/json');
    const projectContent = JSON.parse(await gameJsonBlob.text());
    const manifest = JSON.parse(await manifestBlob.text());

    for (const resource of resourceEntries(projectContent)) {
      const assetPath = resource.file;
      if (!assetPath || !Object.prototype.hasOwnProperty.call(manifest, assetPath)) {
        continue;
      }
      const contentType = manifest[assetPath] || getMimeType(assetPath);
      const asset = await archive.getFileBlob(assetPath, contentType);
      resource.file = URL.createObjectURL(asset);
    }

    return projectContent;
  } finally {
    await archive.close();
  }
};
