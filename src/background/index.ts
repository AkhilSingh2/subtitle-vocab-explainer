import { getSettings, setSettings } from '../shared/storage';
import type { BgRequest } from '../shared/types';
import { handleMessage } from './router';

function isRequest(message: unknown): message is BgRequest {
  return typeof message === 'object' && message !== null && typeof (message as { type?: unknown }).type === 'string';
}

// The listener must return true to keep the channel open for the async response.
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isRequest(message)) return false;
  void handleMessage(message).then(sendResponse);
  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    // Persist defaults so every part of the extension sees the same values.
    await setSettings({});
    if (details.reason === 'install') {
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
    }
  })();
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-extension') return;
  void (async () => {
    const settings = await getSettings();
    await setSettings({ enabled: !settings.enabled });
  })();
});
