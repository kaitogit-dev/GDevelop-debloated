// @flow
import * as React from 'react';
import TextField from '../../UI/TextField';
import FlatButton from '../../UI/FlatButton';
import Text from '../../UI/Text';
import { ColumnStackLayout } from '../../UI/Layout';
import { type SaveAsLocation } from '..';
import {
  connectGoogleDrive,
  getConnectedDriveAccount,
  getGoogleDriveClientId,
} from './GoogleDriveApi';

type Props = {|
  projectName: string,
  saveAsLocation: ?SaveAsLocation,
  setSaveAsLocation: (?SaveAsLocation) => void,
|};

const GoogleDriveCreationLocationChooser = ({
  projectName,
  setSaveAsLocation,
}: Props): React.Node => {
  const [clientId, setClientId] = React.useState<string>(
    getGoogleDriveClientId()
  );
  const [account, setAccount] = React.useState<?string>(
    getConnectedDriveAccount()
  );
  const [isConnecting, setIsConnecting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');

  const onChooseAccount = async () => {
    setIsConnecting(true);
    setError('');
    try {
      const selectedAccount = await connectGoogleDrive(clientId);
      setAccount(selectedAccount);
      setSaveAsLocation({ name: projectName });
    } catch (error) {
      setError(error.message || String(error));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <ColumnStackLayout noMargin>
      {!process.env.REACT_APP_GOOGLE_DRIVE_CLIENT_ID && (
        <TextField
          floatingLabelText="Google OAuth web client ID"
          fullWidth
          value={clientId}
          type="text"
          onChange={(_, value) => setClientId(value)}
        />
      )}
      <Text>
        {account
          ? `Google Drive account: ${account}`
          : 'Choose a Google account before creating the project.'}
      </Text>
      <FlatButton
        label={account ? 'Switch Google account' : 'Choose Google account'}
        disabled={isConnecting || !clientId.trim()}
        onClick={onChooseAccount}
      />
      {error ? <Text>{error}</Text> : null}
    </ColumnStackLayout>
  );
};

export default GoogleDriveCreationLocationChooser;
