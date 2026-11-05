// @flow
import * as React from 'react';
import { Trans } from '@lingui/macro';
import {
  allResourceKindsAndMetadata,
  type ChooseResourceOptions,
} from './ResourceSource';
import AlertMessage from '../UI/AlertMessage';
import { ColumnStackLayout } from '../UI/Layout';

type Props = {|
  options: ChooseResourceOptions,
  onChooseResources: (Array<gdResource>) => void,
  createNewResource: () => gdResource,
  automaticallyOpenInput: boolean,
|};

const BrowserFileResourceImporter = ({
  options,
  onChooseResources,
  createNewResource,
  automaticallyOpenInput,
}: Props): React.Node => {
  const inputRef = React.useRef<?HTMLInputElement>(null);
  const hasOpenedInput = React.useRef(false);
  const [invalidFileNames, setInvalidFileNames] = React.useState<Array<string>>(
    []
  );

  const kindMetadata = allResourceKindsAndMetadata.find(
    ({ kind }) => kind === options.resourceKind
  );
  const allowedExtensions = kindMetadata ? kindMetadata.fileExtensions : [];

  React.useLayoutEffect(() => {
    if (automaticallyOpenInput && !hasOpenedInput.current) {
      hasOpenedInput.current = true;
      if (inputRef.current) inputRef.current.click();
    }
  }, [automaticallyOpenInput]);

  const importFiles = (event: SyntheticInputEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    if (!files.length) return;

    const rejected = files
      .filter(file => {
        const extension = file.name.split('.').pop().toLowerCase();
        return !allowedExtensions.includes(extension);
      })
      .map(file => file.name);

    setInvalidFileNames(rejected);
    if (rejected.length) return;

    const resources = files.map(file => {
      const resource = createNewResource();
      resource.setName(file.name);
      resource.setFile(URL.createObjectURL(file));
      return resource;
    });
    onChooseResources(resources);
  };

  return (
    <ColumnStackLayout noMargin>
      <input
        ref={inputRef}
        type="file"
        multiple={options.multiSelection}
        accept={allowedExtensions.map(extension => '.' + extension).join(',')}
        onChange={importFiles}
      />
      {invalidFileNames.length > 0 && (
        <AlertMessage kind="error">
          <Trans>Unsupported file type:</Trans>{' '}
          {invalidFileNames.join(', ')}
        </AlertMessage>
      )}
    </ColumnStackLayout>
  );
};

export default BrowserFileResourceImporter;
