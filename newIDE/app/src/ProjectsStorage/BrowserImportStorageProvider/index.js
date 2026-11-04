import React from 'react';
import { t } from '@lingui/macro';
import FileWithLines from '../../UI/CustomSvgIcons/FileWithLines';
import { openArchive } from '../../Utils/BrowserArchiver';

const importedFiles = new Map();
let nextFileId = 0;

const isRemoteResource = value => /^[a-z][a-z0-9+.-]*:|^\/\//i.test(value);

const getContentType = filePath => {
  const extension = filePath.split('.').pop().toLowerCase();
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
    mp4: 'video/mp4',
    webm: 'video/webm',
    ttf: 'font/ttf',
    otf: 'font/otf',
    json: 'application/json',
    glb: 'model/gltf-binary',
    js: 'text/javascript',
    xml: 'application/xml',
  };
  return types[extension] || 'application/octet-stream';
};

const readProject = async file => {
  const isZip = file.name.toLowerCase().endsWith('.zip');
  let archive = null;
  try {
    const projectContent = isZip
      ? await (async () => {
          archive = await openArchive(file);
          const projectFile = await archive.getFileBlob('game.json', 'application/json');
          return JSON.parse(await projectFile.text());
        })()
      : JSON.parse(await file.text());

    if (!projectContent || !projectContent.resources || !Array.isArray(projectContent.resources.resources)) {
      throw new Error('This file is not a valid GDevelop project.');
    }

    for (const resource of projectContent.resources.resources) {
      const filePath = resource.file;
      if (!filePath || typeof filePath !== 'string' || isRemoteResource(filePath)) {
        continue;
      }
      if (!archive) {
        throw new Error('This project references local assets. Import a ZIP containing game.json and its assets instead.');
      }
      const normalizedPath = filePath.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
      if (
        normalizedPath.startsWith('/') ||
        normalizedPath.split('/').includes('..')
      ) {
        throw new Error('The project contains an invalid asset path.');
      }
      const asset = await archive.getFileBlob(
        normalizedPath,
        getContentType(normalizedPath)
      );
      resource.file = URL.createObjectURL(asset);
    }

    return projectContent;
  } finally {
    if (archive) await archive.close();
  }
};

const chooseLocalFile = () =>
  new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip,application/json,application/zip';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) {
        resolve(null);
        return;
      }
      const identifier = `browser-import-${++nextFileId}`;
      importedFiles.set(identifier, file);
      resolve({
        fileIdentifier: identifier,
        name: file.name.replace(/(\.gdevelop)?\.(zip|json)$/i, ''),
        lastModifiedDate: file.lastModified,
      });
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });

const BrowserImportStorageProvider = {
  internalName: 'BrowserImport',
  name: t`Import from computer`,
  renderIcon: props => <FileWithLines fontSize={props.size} />,
  createOperations: () => ({
    onOpenWithPicker: chooseLocalFile,
    onOpen: async fileMetadata => {
      const file = importedFiles.get(fileMetadata.fileIdentifier);
      if (!file) {
        throw new Error('Select this file again using Import project.');
      }
      return { content: await readProject(file) };
    },
    getOpenErrorMessage: () =>
      t`Could not open this project. Import a GDevelop JSON file or a ZIP containing game.json and its assets.`,
  }),
};

export default BrowserImportStorageProvider;
