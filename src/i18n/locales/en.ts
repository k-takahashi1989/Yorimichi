import { Translation } from './ja';

const en: Translation = {
  common: {
    cancel: 'Cancel',
    delete: 'Delete',
    confirm: 'Confirm',
    error: 'Error',
    radiusM: '{{radius}}m',
    undo: 'Undo',
  },

  memoList: {
    headerTitle: 'My Nearist',
    deleteTitle: 'Delete Memo',
    deleteMessage: 'Delete "{{title}}"?',
    itemsLeft: '{{unchecked}} / {{total}} left',
    noItems: 'No items',
    emptyText: 'No memos yet',
    emptySubText: 'Tap + to add a memo',
  },

  memoEdit: {
    screenTitleNew: 'New Memo',
    screenTitleEdit: 'Edit Memo',
    titleLabel: 'Title',
    titlePlaceholder: 'e.g. Things to buy at supermarket',
    itemsLabel: 'Checklist',
    addItemPlaceholder: '+ Add item',
    doneButton: 'Confirm',
    unsavedTitle: 'Unsaved changes',
    unsavedMessage: 'You have unsaved changes. Discard them?',
    unsavedDiscard: 'Discard',
    errorTitle: 'Error',
    errorEmptyTitle: 'Please enter a title',
    errorNeedTitleFirst: 'Enter a memo title first',
    errorNeedTitleFirstMsg: 'Please enter a title before adding items',
  },

  memoDetail: {
    screenTitle: 'Memo Detail',
    notFound: 'Memo not found',
    locationSection: '📍 Locations ({{count}} / 3)',
    addLocation: 'Add',
    locationEmpty: 'Add a location to get notified when you arrive nearby',
    itemSection: '🛒 Checklist',
    itemEmpty: 'Add items in the edit screen',
    radiusLabel: 'Radius {{radius}}m',
    notificationOn: 'Notification on',
    notificationOff: 'Notification off',
    deleteLocTitle: 'Delete Location',
    deleteLocMessage: 'Delete "{{label}}"?',
    uncheckTitle: 'Uncheck item?',
    uncheckMessage: 'The recorded purchase date will also be cleared.',
    uncheckDone: 'Item unchecked',
  },

  locationPicker: {
    screenTitle: 'Pick Location',
    alertNoLocation: 'Select a location',
    alertNoLocationMsg: 'Long press on the map to drop a pin',
    alertNoLabel: 'Enter a name',
    alertNoLabelMsg: 'Enter a name for this location (e.g. Supermarket)',
    alertMaxTitle: 'Cannot add',
    alertMaxMsg: 'You can register up to 3 locations',
    markerSelected: 'Selected',
    markerRegistered: 'Registered',
    searchPlaceholder: 'Search for a place…',
    hintLongPress: 'Long press to drop pin',
    legendSelected: 'Selected',
    legendRegistered: 'Registered',
    labelInput: 'Location name',
    labelPlaceholder: 'e.g. Supermarket',
    radiusLabel: 'Notify radius: {{radius}}m',
    saveButton: 'Save this location',
  },

  settings: {
    screenTitle: '⚙️ Settings',
    permCard: {
      title: 'Permissions',
      foreground: 'Location access',
      background: 'Location (always on)',
      notification: 'Push notifications',
      enableButton: 'Enable location & notifications',
      grantedButton: '✅ Permissions granted',
    },
    status: {
      on: 'On',
      off: 'Off',
      blocked: 'Blocked',
      unavailable: 'Unavailable',
      checking: 'Checking...',
    },
    monitorCard: {
      title: 'Location Reminders',
      description:
        'When enabled, you will be notified when you approach a registered location.',
      startButton: 'Start reminders',
      stopButton: 'Stop reminders',
    },
    defaultRadius: {
      title: 'Default notify radius',
    },
    maxRadius: {
      title: 'Max radius',
      description: 'Choose the slider maximum value',
    },
    appInfo: {
      title: 'App Info',
      version: 'Version: {{version}}',
      name: 'Nearist',
      privacyPolicy: 'Privacy Policy',
    },
    alertFineLocation: {
      title: 'Location permission required',
      message: 'Go to Settings > Apps > Yorimichi > Location to grant permission',
      openSettings: 'Open Settings',
    },
    alertBackground: {
      title: 'Allow background location access',
      message:
        'Yorimichi collects location data to enable geofence reminders, even when the app is closed or not in use.\n\nPlease select "Always allow" in the settings screen.',
      openSettings: 'Open Settings',
    },
    alertMonitor: {
      title: 'Location permission required',
      message: 'Please enable location permission first',
    },
    alertPermsAlreadyGranted: {
      title: '✅ Already enabled',
      message: 'Location and notification permissions are already granted.',
    },
    alertPermsSuccess: {
      title: '✅ Setup complete',
      message: 'Location and notifications are now enabled. You can start reminders.',
    },
    langCard: {
      title: 'Language',
    },
  },

  nav: {
    tabList: 'Yorimichi',
    tabSettings: 'Settings',
    backButton: 'Back',
    memoDetail: 'Memo Detail',
    memoEditNew: 'New Memo',
    memoEditExisting: 'Edit Memo',
    locationPicker: 'Pick Location',
  },

  tutorial: {
    skip: 'Skip',
    next: 'Next',
    ok: 'OK',
    memoEdit: {
      step1: '📝 Enter the memo title here',
      step2: `✏️ Type an item and tap + to add it to the list`,
      step3: `✅ Tap "Confirm" to save. Then add a location to get notified when you're nearby!`,
    },
    memoDetail: {
      step1: '🔔 Tap the bell to toggle location notifications on / off',
    },
  },
  geofence: {
    taskDesc: 'Notifies you when approaching registered locations',
  },

  memoDetailExtra: {
    monitoringStopped: '⚠️ Reminders are stopped. Start them in Settings.',
  },

  notification: {
    arrivalTitle: '📍 Approaching {{label}}',
    arrivalBody: '"{{title}}" checklist ({{count}} items) — tap to review',
    arrivalBodyBig: '"{{title}}" checklist ({{count}} items)\n\nTap to open the memo',
  },

  share: {
    button: 'Share',
    shareTitle: 'Share Memo',
    shareMessage: 'Share this memo on Yorimichi!',
    limitReached: 'Share limit reached (free plan)',
    limitReachedMsg: 'Free plan allows sharing 1 memo. Delete a shared memo or upgrade to Premium.',
    importing: 'Importing memo...',
    importTitle: 'Import Memo',
    importMessage: 'Add "{{title}}" to your memos?',
    importConfirm: 'Add',
    importSuccess: 'Memo imported successfully',
    importError: 'Failed to import memo',
    notFound: 'Shared memo not found (may have been deleted)',
    presenceBanner: 'Another user is editing...',
    presenceWarning: 'Another user is editing. Your changes may be overwritten.',
    syncError: 'Failed to sync memo',
    uploadError: 'Failed to register share',
    importByCode: 'Import by Share Code',
    importByCodePrompt: 'Enter the share code',
    shareCodeLabel: 'Share Code',
    shareCodeHint: 'Enter this code via "Import by Share Code" in the app',
    importByCodeInvalid: 'Invalid share code',
  },
};

export default en;
