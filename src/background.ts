chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg.type === "WARM_FILTER") {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, msg).catch(() => {})
        }
      }
    })
  }
})
