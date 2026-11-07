// @flow
import { archiveFiles, openArchive } from '../../Utils/BrowserArchiver';
import { downloadUrlsToBlobs } from '../../Utils/BlobDownloader';
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

const resourceBlobCache: Map<string, Blob> = new Map();
const maxResourceBlobCacheBytes = 64 * 1024 * 1024;

const shouldEmbedResource = (url: string): boolean =>
  isBlobURL(url) ||
  url.startsWith('data:') ||
  checkIfIsGDevelopCloudBucketUrl(url);

export const archiveProjectForGoogleDrive = async (
  project: gdProject
): Promise<Blob> => {
  const content = serializeToJSObject(project);
  const resources = resourceEntries(content);
  const resourcesByName = project.getResourcesManager();
  const usedPaths = new Set(['game.json', 'drive-assets.json']);
  const blobFiles = [];
  const manifest = {};

  const activeUrls: Set<string> = new Set();
  for (const resource of resources) {
    const url = resource.file;
    if (!url || typeof url !== 'string') continue;
    if (shouldEmbedResource(url)) {
      activeUrls.add(url);
    } else if (!isURL(url)) {
      throw new Error(`Cannot save relative resource "${url}" to Google Drive.`);
    }
  }

  for (const url of resourceBlobCache.keys()) {
    if (!activeUrls.has(url)) resourceBlobCache.delete(url);
  }

  const blobsByUrl: Map<string, Blob> = new Map(resourceBlobCache);
  const missingUrls = Array.from(activeUrls).filter(
    url => !blobsByUrl.has(url)
  );
  if (missingUrls.length) {
    const downloads = await downloadUrlsToBlobs({
      urlContainers: missingUrls.map(url => ({ url })),
      onProgress: () => {},
    });

    for (const { item, blob, error } of downloads) {
      if (error || !blob) {
        throw new Error(
          `Cannot save resource "${item.url}": ${error
            ? error.message
            : 'Unknown download error'}`
        );
      }
      blobsByUrl.set(item.url, blob);
      if (
        (isBlobURL(item.url) || item.url.startsWith('data:')) &&
        blob.size <= maxResourceBlobCacheBytes
      ) {
        resourceBlobCache.set(item.url, blob);
      }
    }
  }

  let cachedBytes = 0;
  for (const blob of resourceBlobCache.values()) cachedBytes += blob.size;
  while (cachedBytes > maxResourceBlobCacheBytes) {
    const oldestUrl = resourceBlobCache.keys().next().value;
    if (!oldestUrl) break;
    const oldestBlob = resourceBlobCache.get(oldestUrl);
    if (!oldestBlob) break;
    cachedBytes -= oldestBlob.size;
    resourceBlobCache.delete(oldestUrl);
  }

  for (const resource of resources) {
    const resourceUrl = resource.file;
    if (
      !resourceUrl ||
      typeof resourceUrl !== 'string' ||
      !shouldEmbedResource(resourceUrl)
    )
      continue;

    const blob = blobsByUrl.get(resourceUrl);
    if (!blob) {
      throw new Error(`Cannot save resource "${resource.name}": file not found.`);
    }
    const originalResource = resourcesByName.getResource(resource.name);
    const { extension } = parseLocalFilePathOrExtensionFromMetadata(
      originalResource
    );
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
    blobCompressionLevel: 0,
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
