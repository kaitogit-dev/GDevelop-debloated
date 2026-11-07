// @flow
import * as React from 'react';
import { t } from '@lingui/macro';
import Cloud from '../../UI/CustomSvgIcons/Cloud';
import { type StorageProvider, type FileMetadata, type SaveAsLocation } from '..';
import GoogleDriveDialog from './GoogleDriveDialog';
import GoogleDriveCreationLocationChooser from './GoogleDriveCreationLocationChooser';
import {
  getGoogleDriveProject,
  getGoogleDriveProjectMetadata,
  saveGoogleDriveProject,
} from './GoogleDriveApi';
import {
  archiveProjectForGoogleDrive,
  openProjectFromGoogleDriveArchive,
} from './GoogleDriveArchive';

const toFileMetadata = (file: any, gameId?: string): FileMetadata => ({
  fileIdentifier: file.id,
  name: file.name.replace(/\.gdevelop\.zip$/, ''),
  lastModifiedDate: file.modifiedTime
    ? Date.parse(file.modifiedTime)
    : Date.now(),
  gameId,
});

const getDriveFilename = (name: string): string =>
  `${name.replace(/[\\/:*?"<>|]/g, '_').trim()}.gdevelop.zip`;

const onOpen = async (fileMetadata: FileMetadata): Promise<{| content: Object |}> => {
  const archive = await getGoogleDriveProject(fileMetadata.fileIdentifier);
  const content = await openProjectFromGoogleDriveArchive(archive);
  return { content };
};

const onSaveProject = async (
  project: gdProject,
  fileMetadata: FileMetadata
): Promise<{| wasSaved: boolean, fileMetadata: FileMetadata |}> => {
  const [remoteFile, archive] = await Promise.all([
    getGoogleDriveProjectMetadata(fileMetadata.fileIdentifier),
    archiveProjectForGoogleDrive(project),
  ]);
  if (
    fileMetadata.lastModifiedDate &&
    remoteFile.modifiedTime &&
    Math.abs(Date.parse(remoteFile.modifiedTime) - fileMetadata.lastModifiedDate) > 1000
  ) {
    throw new Error(
      'This Google Drive project changed since it was opened. Use Save As to avoid overwriting the newer copy.'
    );
  }
  const file = await saveGoogleDriveProject({
    id: fileMetadata.fileIdentifier,
    name: getDriveFilename(project.getName()),
    archive,
  });
  return {
    wasSaved: true,
    fileMetadata: toFileMetadata(file, project.getProjectUuid()),
  };
};

const chooseSaveLocation = (
  setDialog: (() => React.Node) => void,
  closeDialog: () => void
) => ({
  project,
  fileMetadata,
}: {
  project: gdProject,
  fileMetadata: ?FileMetadata,
}): Promise<{|
  saveAsLocation: ?SaveAsLocation,
  saveAsOptions: ?{ generateNewProjectUuid: boolean },
|}> =>
  new Promise(resolve => {
    const finish = (name: ?string) => {
      closeDialog();
      resolve({
        saveAsLocation: name ? { name } : null,
        saveAsOptions: name ? { generateNewProjectUuid: false } : null,
      });
    };
    setDialog(() => (
      <GoogleDriveDialog
        mode="save"
        suggestedName={fileMetadata ? `${project.getName()} - Copy` : project.getName()}
        onCancel={() => finish(null)}
        onSave={finish}
      />
    ));
  });

const onSaveProjectAs = async (
  project: gdProject,
  saveAsLocation: ?SaveAsLocation,
  options: {|
    onStartSaving: () => void,
    onMoveResources: ({| newFileMetadata: FileMetadata |}) => Promise<void>,
  |}
): Promise<{| wasSaved: boolean, fileMetadata: ?FileMetadata |}> => {
  if (!saveAsLocation || !saveAsLocation.name) {
    throw new Error('Choose a project name before saving to Google Drive.');
  }
  options.onStartSaving();
  await options.onMoveResources({
    newFileMetadata: {
      fileIdentifier: 'new-google-drive-project',
      name: saveAsLocation.name,
      gameId: project.getProjectUuid(),
    },
  });
  const archive = await archiveProjectForGoogleDrive(project);
  const file = await saveGoogleDriveProject({
    name: getDriveFilename(saveAsLocation.name),
    archive,
  });
  return {
    wasSaved: true,
    fileMetadata: toFileMetadata(file, project.getProjectUuid()),
  };
};

export default ({
  internalName: 'GoogleDrive',
  name: t`Google Drive`,
  renderIcon: props => <Cloud fontSize={props.size} />,
  getProjectLocation: ({ projectName }) => ({ name: projectName }),
  renderNewProjectSaveAsLocationChooser: props => (
    <GoogleDriveCreationLocationChooser {...props} />
  ),
  createOperations: ({ setDialog, closeDialog }) => ({
    onOpenWithPicker: () =>
      new Promise(resolve => {
        const finish = (file: ?any) => {
          closeDialog();
          resolve(file ? toFileMetadata(file) : null);
        };
        setDialog(() => (
          <GoogleDriveDialog
            mode="open"
            onCancel={() => finish(null)}
            onOpen={finish}
          />
        ));
      }),
    onOpen,
    onSaveProject,
    onChooseSaveProjectAsLocation: chooseSaveLocation(setDialog, closeDialog),
    onSaveProjectAs,
    getOpenErrorMessage: () =>
      t`Unable to open this Google Drive project. Reconnect the account that owns it and try again.`,
    getWriteErrorMessage: error =>
      error && error.message
        ? error.message
        : t`Unable to save this Google Drive project. Check your connection, permissions and storage space.`,
  }),
}: StorageProvider);
