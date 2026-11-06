module.exports = {
  createExtension: function (_, gd) {
    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'EasySave',
        _('Easy Save'),
        _('Save and load game variables in named local save slots. Export or import a save as a JSON file when needed.'),
        'GDevelop Debloated',
        'MIT'
      )
      .setShortDescription(
        'Save and load progress, settings and other variables without a server.'
      )
      .setCategory('Game mechanic')
      .addInstructionOrExpressionGroupMetadata(_('Easy Save'))
      .setIcon('res/actions/saveDown.svg');

    extension
      .addAction(
        'SaveVariable',
        _('Save variable to slot'),
        _('Immediately save a variable, including structures and arrays, in a named slot on this device.'),
        _('Save variable _PARAM1_ in slot _PARAM0_'),
        _('Easy Save'),
        'res/actions/saveDown.svg',
        'res/actions/saveDown.svg'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('Save slot'), '', false)
      .addParameter('variable', _('Variable to save'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile('Extensions/EasySave/EasySaveTools.js')
      .setFunctionName('gdjs.easySave.saveVariable');

    extension
      .addAction(
        'LoadVariable',
        _('Load slot into variable'),
        _('Restore a saved number, text, boolean, structure or array into a variable. If the slot is missing, the variable is left unchanged.'),
        _('Load slot _PARAM0_ into variable _PARAM1_'),
        _('Easy Save'),
        'res/actions/saveUp.svg',
        'res/actions/saveUp.svg'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('Save slot'), '', false)
      .addParameter('variable', _('Variable to load into'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile('Extensions/EasySave/EasySaveTools.js')
      .setFunctionName('gdjs.easySave.loadVariable');

    extension
      .addAction(
        'DeleteSlot',
        _('Delete save slot'),
        _('Remove the stored data in a named slot.'),
        _('Delete save slot _PARAM0_'),
        _('Easy Save'),
        'res/actions/saveDown.svg',
        'res/actions/saveDown.svg'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('Save slot'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile('Extensions/EasySave/EasySaveTools.js')
      .setFunctionName('gdjs.easySave.deleteSlot');

    extension
      .addAction(
        'DownloadSlot',
        _('Download save slot as file'),
        _('Download a named slot as a JSON save file. Trigger this action from a button or another user input.'),
        _('Download save slot _PARAM0_ as JSON file'),
        _('Easy Save'),
        'res/actions/saveDown.svg',
        'res/actions/saveDown.svg'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('Save slot'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile('Extensions/EasySave/EasySaveTools.js')
      .setFunctionName('gdjs.easySave.downloadSlot');

    extension
      .addAction(
        'ImportSlot',
        _('Import save file into slot'),
        _('Open a file picker to import a JSON save file into a named slot. Trigger this action from a button or another user input.'),
        _('Import JSON save file into slot _PARAM0_'),
        _('Easy Save'),
        'res/actions/saveUp.svg',
        'res/actions/saveUp.svg'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('Save slot'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile('Extensions/EasySave/EasySaveTools.js')
      .setFunctionName('gdjs.easySave.importSlotFromFile')
      .setAsyncFunctionName('gdjs.easySave.importSlotFromFile');

    extension
      .addCondition(
        'SlotExists',
        _('Save slot exists'),
        _('Check if the slot contains valid save data for this game.'),
        _('Save slot _PARAM0_ exists'),
        _('Easy Save'),
        'res/actions/saveUp.svg',
        'res/actions/saveUp.svg'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('Save slot'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile('Extensions/EasySave/EasySaveTools.js')
      .setFunctionName('gdjs.easySave.slotExists');

    extension
      .addCondition(
        'LastOperationSucceeded',
        _('Last save operation succeeded'),
        _('Check if the most recent Easy Save action succeeded.'),
        _('Last Easy Save action succeeded'),
        _('Easy Save'),
        'res/actions/saveUp.svg',
        'res/actions/saveUp.svg'
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile('Extensions/EasySave/EasySaveTools.js')
      .setFunctionName('gdjs.easySave.lastOperationSucceeded');

    extension
      .addStrExpression(
        'LastError',
        _('Last save error'),
        _('Get the last Easy Save error message, or an empty string after a successful action.'),
        _('Easy Save'),
        'res/actions/saveUp.svg'
      )
      .addCodeOnlyParameter('currentScene', '')
      .setIncludeFile('Extensions/EasySave/EasySaveTools.js')
      .setFunctionName('gdjs.easySave.getLastError');

    return extension;
  },
  runExtensionSanityTests: function (gd, extension) {
    return [];
  },
};
