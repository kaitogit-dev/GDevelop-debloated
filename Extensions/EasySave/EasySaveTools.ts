namespace gdjs {
  export namespace easySave {
    const logger = new gdjs.Logger('Easy Save');
    const format = 'gdevelop-easy-save';
    let lastSucceeded = false;
    let lastError = '';

    type SaveFile = {
      format: string;
      version: number;
      projectId: string;
      slot: string;
      savedAt: number;
      data: any;
    };

    const projectId = (): string => {
      const id = gdjs.projectData?.properties?.projectUuid;
      if (!id) throw new Error('The game has no project ID.');
      return id;
    };

    const storageKey = (slot: string): string => {
      if (!slot || !slot.trim()) throw new Error('Enter a save slot name.');
      return `gdevelop-easy-save:${projectId()}:${slot}`;
    };

    const storage = (): Storage => {
      if (typeof window === 'undefined' || !window.localStorage)
        throw new Error('Local saves are not available in this environment.');
      return window.localStorage;
    };

    const succeed = (): void => {
      lastSucceeded = true;
      lastError = '';
    };

    const fail = (error: unknown): void => {
      lastSucceeded = false;
      lastError = error instanceof Error ? error.message : String(error);
      logger.error(lastError);
    };

    const parseFile = (text: string): SaveFile => {
      const data = JSON.parse(text);
      if (
        !data ||
        data.format !== format ||
        data.version !== 1 ||
        data.projectId !== projectId() ||
        !Object.prototype.hasOwnProperty.call(data, 'data')
      ) {
        throw new Error('This save file is invalid or belongs to a different game.');
      }
      return data;
    };

    const read = (slot: string): SaveFile | null => {
      const stored = storage().getItem(storageKey(slot));
      if (stored === null) return null;
      return parseFile(stored);
    };

    export const saveVariable = (
      _: gdjs.RuntimeScene,
      slot: string,
      variable: gdjs.Variable
    ): void => {
      try {
        const record: SaveFile = {
          format,
          version: 1,
          projectId: projectId(),
          slot,
          savedAt: Date.now(),
          data: variable.toJSObject(),
        };
        storage().setItem(storageKey(slot), JSON.stringify(record));
        succeed();
      } catch (error) {
        fail(error);
      }
    };

    export const loadVariable = (
      _: gdjs.RuntimeScene,
      slot: string,
      variable: gdjs.Variable
    ): void => {
      try {
        const record = read(slot);
        if (!record) throw new Error(`No save found in slot "${slot}".`);
        variable.fromJSObject(record.data);
        succeed();
      } catch (error) {
        fail(error);
      }
    };

    export const deleteSlot = (_: gdjs.RuntimeScene, slot: string): void => {
      try {
        storage().removeItem(storageKey(slot));
        succeed();
      } catch (error) {
        fail(error);
      }
    };

    export const slotExists = (_: gdjs.RuntimeScene, slot: string): boolean => {
      try {
        return read(slot) !== null;
      } catch (error) {
        return false;
      }
    };

    export const lastOperationSucceeded = (_: gdjs.RuntimeScene): boolean =>
      lastSucceeded;

    export const getLastError = (_: gdjs.RuntimeScene): string => lastError;

    export const downloadSlot = (_: gdjs.RuntimeScene, slot: string): void => {
      try {
        const record = read(slot);
        if (!record) throw new Error(`No save found in slot "${slot}".`);
        if (typeof document === 'undefined')
          throw new Error('File downloads are not available here.');
        const name = slot.replace(/[^a-z0-9_.-]/gi, '_') || 'save';
        const blob = new Blob([JSON.stringify(record, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name}.save.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        succeed();
      } catch (error) {
        fail(error);
      }
    };

    export const importSlotFromFile = (
      _: gdjs.RuntimeScene,
      slot: string
    ): gdjs.PromiseTask => {
      const promise = new Promise<void>((resolve) => {
        try {
          storageKey(slot);
          if (typeof document === 'undefined')
            throw new Error('File selection is not available here.');
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.style.display = 'none';
          const finish = () => {
            input.remove();
            resolve();
          };
          input.addEventListener('change', async () => {
            try {
              const file = input.files && input.files[0];
              if (!file) throw new Error('No save file selected.');
              if (file.size > 5 * 1024 * 1024)
                throw new Error('Save files must be smaller than 5 MB.');
              const record = parseFile(await file.text());
              record.slot = slot;
              storage().setItem(storageKey(slot), JSON.stringify(record));
              succeed();
            } catch (error) {
              fail(error);
            } finally {
              finish();
            }
          }, { once: true });
          input.addEventListener('cancel', () => {
            fail(new Error('Save file selection cancelled.'));
            finish();
          }, { once: true });
          document.body.appendChild(input);
          input.click();
        } catch (error) {
          fail(error);
          resolve();
        }
      });
      return new gdjs.PromiseTask(promise);
    };
  }
}
