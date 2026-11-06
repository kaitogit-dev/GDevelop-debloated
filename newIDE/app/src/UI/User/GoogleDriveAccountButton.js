// @flow
import * as React from 'react';
import FlatButton from '../FlatButton';
import Text from '../Text';
import { ColumnStackLayout } from '../Layout';
import Cloud from '../CustomSvgIcons/Cloud';
import {
  connectGoogleDrive,
  getConnectedDriveAccount,
  getGoogleDriveClientId,
  getRememberedDriveAccount,
  preloadGoogleIdentity,
  restoreGoogleDriveSession,
  subscribeToGoogleDriveAccount,
} from '../../ProjectsStorage/GoogleDriveStorageProvider/GoogleDriveApi';

const GoogleDriveAccountButton = (): React.Node => {
  const [account, setAccount] = React.useState<?string>(
    getConnectedDriveAccount()
  );
  const [isConnecting, setIsConnecting] = React.useState<boolean>(false);
  const [isRestoring, setIsRestoring] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');

  React.useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeToGoogleDriveAccount(() => {
      if (!mounted) return;
      setAccount(getConnectedDriveAccount());
      setError('');
    });
    preloadGoogleIdentity().catch(loadError => {
      if (mounted) setError(loadError.message || String(loadError));
    });
    if (getRememberedDriveAccount() && !getConnectedDriveAccount()) {
      setIsRestoring(true);
      restoreGoogleDriveSession()
        .then(restoredAccount => {
          if (mounted) setAccount(restoredAccount);
        })
        .finally(() => {
          if (mounted) setIsRestoring(false);
        });
    }
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const onChooseAccount = async () => {
    setError('');
    setIsConnecting(true);
    try {
      const clientId = getGoogleDriveClientId();
      if (!clientId) {
        throw new Error('Google Drive sign-in is not configured.');
      }
      const chosenAccount = await connectGoogleDrive(clientId);
      setAccount(chosenAccount);
    } catch (connectionError) {
      setError(connectionError.message || String(connectionError));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <ColumnStackLayout noMargin>
      <FlatButton
        id="google-drive-account-button"
        primary={!account}
        disabled={isConnecting || isRestoring}
        label={
          isConnecting
            ? 'Connecting to Google Drive...'
            : isRestoring
            ? 'Restoring Google Drive...'
            : account
            ? `Drive: ${account}`
            : getRememberedDriveAccount()
            ? 'Reconnect Google Drive'
            : 'Connect Google Drive'
        }
        leftIcon={<Cloud fontSize="small" />}
        onClick={onChooseAccount}
      />
      {error ? (
        <Text size="body-small" color="error" noMargin>
          {error}
        </Text>
      ) : null}
    </ColumnStackLayout>
  );
};

export default GoogleDriveAccountButton;
