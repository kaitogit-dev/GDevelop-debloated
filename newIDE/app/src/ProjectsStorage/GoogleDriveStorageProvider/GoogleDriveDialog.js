// @flow
import * as React from 'react';
import Dialog from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import RaisedButton from '../../UI/RaisedButton';
import TextField from '../../UI/TextField';
import Text from '../../UI/Text';
import { ColumnStackLayout } from '../../UI/Layout';
import {
  connectGoogleDrive,
  getConnectedDriveAccount,
  getGoogleDriveClientId,
  listGoogleDriveProjects,
  preloadGoogleIdentity,
  restoreGoogleDriveSession,
  type DriveProjectFile,
} from './GoogleDriveApi';

type Props = {|
  mode: 'open' | 'save',
  suggestedName?: string,
  onCancel: () => void,
  onOpen?: (DriveProjectFile) => void,
  onSave?: (string) => void,
|};

export default function GoogleDriveDialog({
  mode,
  suggestedName,
  onCancel,
  onOpen,
  onSave,
}: Props): React.Node {
  const [clientId, setClientId] = React.useState<string>(
    getGoogleDriveClientId()
  );
  const [account, setAccount] = React.useState<?string>(
    getConnectedDriveAccount()
  );
  const [name, setName] = React.useState<string>(suggestedName || '');
  const [projects, setProjects] = React.useState<Array<DriveProjectFile>>([]);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');

  React.useEffect(() => {
    let active = true;
    preloadGoogleIdentity().catch(loadError => {
      if (active) setError(loadError.message || String(loadError));
    });
    if (!getConnectedDriveAccount()) {
      setBusy(true);
      restoreGoogleDriveSession()
        .then(restoredAccount => {
          if (active) setAccount(restoredAccount);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!account || mode !== 'open') return;
    let cancelled = false;
    setBusy(true);
    listGoogleDriveProjects()
      .then(files => {
        if (!cancelled) setProjects(files);
      })
      .catch(listError => {
        if (!cancelled) setError(listError.message || String(listError));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account, mode]);

  const connectAccount = async () => {
    setError('');
    setBusy(true);
    try {
      const chosenAccount = await connectGoogleDrive(clientId);
      setAccount(chosenAccount);
      setProjects([]);
    } catch (connectionError) {
      setError(connectionError.message || String(connectionError));
    } finally {
      setBusy(false);
    }
  };

  const configuredId = process.env.REACT_APP_GOOGLE_DRIVE_CLIENT_ID;
  const canProceed = !!account && !busy;
  const requestedName = name.trim();

  return (
    <Dialog
      title={mode === 'open' ? 'Open from Google Drive' : 'Save to Google Drive'}
      open
      onRequestClose={onCancel}
      maxWidth="sm"
      actions={[
        <FlatButton key="cancel" label="Cancel" onClick={onCancel} />,
        mode === 'save' ? (
          <RaisedButton
            key="save"
            primary
            label="Save to Google Drive"
            disabled={!canProceed || !requestedName}
            onClick={() => onSave && onSave(requestedName)}
          />
        ) : null,
      ]}
    >
      <ColumnStackLayout noMargin>
        {!configuredId && (
          <React.Fragment>
            <Text>
              Enter a Google OAuth web client ID with the Drive API enabled and
              this website's origin authorized. This ID is stored only in your
              browser.
            </Text>
            <TextField
              type="text"
              value={clientId}
              onChange={(_, value) => setClientId(value)}
              floatingLabelText="Google OAuth client ID"
              fullWidth
            />
          </React.Fragment>
        )}
        <Text>{account ? `Connected: ${account}` : 'No Google Drive account connected'}</Text>
        <FlatButton
          label={account ? 'Switch Google account' : 'Choose Google account'}
          onClick={connectAccount}
          disabled={busy || !clientId.trim()}
        />
        {error ? <Text>{error}</Text> : null}
        {mode === 'save' && (
          <TextField
            type="text"
            value={name}
            onChange={(_, value) => setName(value)}
            floatingLabelText="Project name"
            fullWidth
          />
        )}
        {mode === 'open' && account && (
          <React.Fragment>
            <Text>{busy ? 'Loading projects...' : `${projects.length} projects`}</Text>
            {projects.map(project => (
              <FlatButton
                key={project.id}
                fullWidth
                disabled={busy}
                label={`${project.name.replace(/\.gdevelop\.zip$/, '')}  ${project.modifiedTime ? new Date(project.modifiedTime).toLocaleString() : ''}`}
                onClick={() => onOpen && onOpen(project)}
              />
            ))}
          </React.Fragment>
        )}
      </ColumnStackLayout>
    </Dialog>
  );
}
