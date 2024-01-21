var tabDB = {
  check: 892504571
}

var activeTabs = [];

var targetWindow = null;
var tabCount = 0;
var excludeUrls = new Set([
  "www.facebook.com",
  "facebook.com",
  "youtube.com",
  "www.youtube.com",
  "web.telegram.org",
  "web.telegram.org/z/",
  "quora.com",
  "www.quora.com",
  "blognone.com",
  "www.blognone.com",
  "history",
  "newtab"
])

const excludePaths = {
  "/": ["youtube.com", "www.youtube.com"],
}

var noParenthesis = new Set([
  "facebook.com",
  "www.facebook.com",
  "youtube.com",
  "www.youtube.com",
  "quora.com",
  "www.quora.com"
])

const createHash = (string) => sha256.create().update(string).hex();

const generateCleanTitle = (title, hostname) => noParenthesis.has(hostname) ? title.replace(/\s*\(.*?\)\s*/g, '') : title;

const makeTextItem = (title, url) => `${title}\n${url}\n\n`

const makeJsonItem = ({ title, url, windowId, tabId, hostname, pathname }) => {
  const hash = createHash(url)
  const json = { title, url, windowId, tabId, hostname, pathname }

  return [hash, json]
}

function parseTab(tab, windowId, exportOptions) {
  const { isWithText, isWithJson } = exportOptions;
  const { 
    origin,
    href,
    protocol,
    host,
    port,
    hostname,
    pathname,
    hash,
    search,
    searchParams
  } = new URL(tab.url);

  const result = { text: null, json: null }

  if (checkTabValid({
    ...tab,
    origin,
    href,
    protocol,
    host,
    port,
    hostname,
    pathname,
    hash,
    search,
    searchParams
  })) {

    const title = generateCleanTitle(tab.title, hostname); 

    if (isWithText) {
      result["text"] = makeTextItem(title, tab.url)
    }
    
    if (isWithJson) {
      result["json"] = makeJsonItem({
        title, url: tab.url, windowId, tabId: tab.id, hostname, pathname
      })
    }

  }

  return result
}

function updateDom(order, text, json, { isWithText, isWithJson }) {
  console.log("updateDom", order, text, json, isWithText, isWithJson)

  if (text !== "" || JSON.stringify(json) !== "{}") {
    document.getElementById('content').value += `### ${order + 1} -- \n`;

    if (isWithText) {
      document.getElementById('content').value += `\`\`\`\n${ text }\n\`\`\`\n`;
    }
    
    if (isWithJson) {
      document.getElementById('content').value += `\`\`\`\n${ JSON.stringify(json, null, 2)}\n\`\`\`\n`;
    }

    // Add Ending Line for each window
    document.getElementById('content').value += `\n---\n\n`
  }
}

function processTabsInWindow (tabs, window, exportOptions) {
  let text = ""
  const json = {};

  for (const tab of tabs) {

    const { text: text_, json: json_ } = parseTab(tab, window.id, exportOptions)
    if (text_) {
      text += text_
    }

    if (json_) {
      const [_hash_, _json_] = json_
      json[_hash_] = _json_
    }
  }

  return [text, json]
}

function getExportOptions() {
  const isAllWindow = document.getElementById('inclAll').checked;
  const isWithText = document.getElementById('checkWithText').checked;
  const isWithJson = document.getElementById('checkWithJson').checked;
  const isJsonOnly = !isWithText && isWithJson;

  return { isWithText, isWithJson, isJsonOnly, isAllWindow }
}

async function start() {
  const exportOptions = getExportOptions();

  console.log("TabMan Started");
  // getTabsLegacy()

  console.log(
    `Export as ${exportOptions.isWithText && exportOptions.isWithJson ? "Text & Json" 
      : exportOptions.isWithText ? "Text"
      : exportOptions.isWithJson ? "Json"
      : ''}`
  )
  document.getElementById('content').value = '';

  chrome.tabGroups.query({
    // windowId: chrome.windows.WINDOW_ID_CURRENT
  }, function(tabGroups) {
    console.log("Total TabGroups", tabGroups.length)
  })

  try {
    await createMetaJson({ exportOptions })
    
  } catch (error) {
    console.error(error);
  }
}

async function createMetaJson(options) {
  const { exportOptions } = options;
  let order_ = 0;
  const metaJson = {
    from: "",
    profile: "",
    device: "",
    timestamp: new Date().getTime(),
    windows: {},
  }

  try {
    
    if (exportOptions.isAllWindow) {

      const { totalWindows, order, text, windows } = await _getAllTabs(exportOptions, order_);
      console.log("Total Windows", totalWindows);

      metaJson.windows = windows

      if (exportOptions.isJsonOnly) {
        document.getElementById('content').value = `\`\`\`\n${ JSON.stringify(metaJson, null, 2)}\n\`\`\`\n`;
      }


    } else {
      chrome.windows.getCurrent({
        populate: true
      }, function (currentWindow) {
        console.log("Current Window ID", currentWindow.id);
    
        tabCount = currentWindow.tabs.length;
        
        console.log("Total Tabs in Current Window", tabCount);

        const [text, json] = processTabsInWindow(currentWindow.tabs, currentWindow, exportOptions)

        updateDom(order_, text, json, exportOptions)

        // document.getElementById('content').value = createTabListFromWindow(currentWindow, isWithJson);
      });
    }

    // chrome.windows.getCurrent(getWindows);
  } catch (error) {
    console.error(error2);
    
  } finally {
    return metaJson
  }
}

function _getAllTabs(exportOptions, _order = 0) {
  return new Promise((resolve, reject) => {
    const result = {}
    let order = _order

    chrome.windows.getAll({
      populate: true
    }, function (windows) {
      result.totalWindows = windows.length;

      result.windows = {}

      // const tabsInWindows = windows.map(({ id, tabs }) => ({ id, tabs }));
      for (let window of windows) {
        result.windows[window.id] = {
          order,
          id: window.id,
          tabs: {}
        }

        order += 1;

        const [text, json] = processTabsInWindow(window.tabs, window, exportOptions)

        updateDom(order, text, json, exportOptions)
        
        result.windows[window.id].tabs = json;
        result.text = text
        result.order = order

      }

      resolve(result)

    });
  })
}

function getTabsLegacy() {
  console.log("TabMan Started");
  const isAllWindow = document.getElementById('inclAll').checked;
  const isWithText = document.getElementById('checkWithText').checked;
  const isWithJson = document.getElementById('checkWithJson').checked;
  
  const exportOptions = { isWithText, isWithJson }

  console.log(
    `Export as ${isWithText && isWithJson ? "Text & Json" 
      : isWithText ? "Text"
      : isWithJson ? "Json"
      : ''}`
  )
  const isMetaJsonOnly = !isWithText && isWithJson;
    const metaJson = {
      from: "",
      profile: "",
      device: "",
      timestamp: new Date().getTime(),
      windows: {},
  }
  let order = 0;
  document.getElementById('content').value = '';

  chrome.tabGroups.query({
    // windowId: chrome.windows.WINDOW_ID_CURRENT
  }, function(tabGroups) {
    console.log("Total TabGroups", tabGroups.length)
  })

  if (isAllWindow) {

    chrome.windows.getAll({
      populate: true
    }, function (windows) {
      console.log("Total Windows", windows.length);
  
      // const tabsInWindows = windows.map(({ id, tabs }) => ({ id, tabs }));
      for (let window of windows) {
        metaJson.windows[window.id] = {
          order,
          id: window.id,
          tabs: {}
        }

        order += 1;

        const [text, json] = processTabsInWindow(window.tabs, window, exportOptions)
        
        metaJson.windows[window.id].tabs = json;

        updateDom(order, text, json, exportOptions)

      }

      if (isMetaJsonOnly) {
        document.getElementById('content').value = `\`\`\`\n${ JSON.stringify(metaJson, null, 2)}\n\`\`\`\n`;
      }

    });

  } else {
    chrome.windows.getCurrent({
      populate: true
    }, function (currentWindow) {
      console.log("Current Window ID", currentWindow.id);
  
      tabCount = currentWindow.tabs.length;
      
      console.log("Total Tabs in Current Window", tabCount);

      const [text, json] = processTabsInWindow(currentWindow.tabs, currentWindow, exportOptions)

      updateDom(order, text, json, exportOptions)

      // document.getElementById('content').value = createTabListFromWindow(currentWindow, isWithJson);
    });
  }

  // chrome.windows.getCurrent(getWindows);
}

function checkTabValid(tab) {
  const { protocol } = tab;

  if (
    protocol !== "chrome:"
    && protocol !== "file:"
    && !checkUrlExclusion(tab)
  ) {
    return true
  }
  return false
}

function checkUrlExclusion(tab) {
  const { hostname, pathname, /* search, searchParams */ } = tab
  // if (searchParams.size > 0) {

  // }

  const isExcludeHost = excludeUrls.has(hostname);
  const isExcludePath = excludePaths[pathname] ? excludePaths[pathname].indexOf[hostname] >= 0 : false;

  if (isExcludeHost && isExcludePath) {
    return true
  }
  return false
}

function createTabListFromWindow(window) {
  if (!window.tabs) {
    console.error("Invalid window object");
    return
  }

  const tabList = window.tabs.map((tab) => ({ id: tab.id, title: tab.title, url: tab.url }));
  return generateTabListContent(tabList);
}

function createJsonFromWindow(window) {
  if (!window.tabs) {
    console.error("Invalid window object");
    return
  }

  const json = {}

  // const [tabList, excludedTabList] = createJson(window.tabs);
  // return generateTabListContent(tabList);
}


// function getWindows(win) {
//   // targetWindow = win;
//   // chrome.tabs.getAllInWindow(targetWindow.id, getTabs);
// }

// function getTabs(tabs) {
//   // chrome.windows.getAll({ "populate": true }, expTabs);
// }

// This is how tab list will be shown on the UI, Default to text.
function generateTabListContent(tabList, mode = "text") {
  return mode == "interactive" ? "Interactive Mode is not available"
    : tabList.map(generateTabItemContent).join("\n\n");
}

function generateTabItemContent(tabListItem) {
  return `${tabListItem.title}\n${tabListItem.url}`
}

function expTabs(windows) {
  var numWindows = windows.length;
  var exportAll = document.getElementById('inclAll').checked == true ? 1 : 0;
  var json = {
    from: "",
    profile: "",
    device: "",
    timestamp: new Date().getTime(),
    windows: {},
  };

  document.getElementById('content').value = '';

  for (var i = 0; i < numWindows; i++) {
    var win = windows[i];
    json.windows[win.id] = {};
    if (targetWindow.id == win.id || exportAll == 1) {
      var numTabs = win.tabs.length;
      for (var j = 0; j < numTabs; j++) {
        var tab = win.tabs[j];
        var { hostname, pathname } = new URL(tab.url);
        
        if (excludeUrls.has(hostname) === false
          || 
          (
            (excludeUrls.has(hostname) === true && pathname !== "")
            && (excludeUrls.has(hostname) === true && pathname !== "/")
            && (excludeUrls.has(hostname) === true && pathname !== "/z/")
            && (excludeUrls.has(hostname) === true && pathname !== "/syncedTabs")
          )
        ) {
          if (document.getElementById('inclTitle').checked == true) {
            document.getElementById('content').value += tab.title + '\n';
            var hash = sha256.create().update(tab.url).hex();
            var title = tab.title; 
            if (noParenthesis.has(hostname)) {
              title = title.replace(/\s*\(.*?\)\s*/g, '');
            }
            json.windows[win.id][hash] = {
              title: title,
              url: tab.url,
              windowId: win.id,
              hostname,
              pathname,
            }
          }
        }
        document.getElementById('content').value += tab.url + '\n\n';
      }
      for (var windowId of Object.keys(json.windows)) {
        if (Object.keys(json.windows[windowId]).length === 0) {
          delete json.windows[windowId];
        }
      }
      document.getElementById('json').value = JSON.stringify(json, null, 2);
    }
  }
}

function openTabs() {
  var content = document.getElementById('content').value;
  var rExp = new RegExp(
    "(^|[ \t\r\n])((ftp|http|https|news|file|view-source|chrome):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-])*)"
    , "g"
  );
  var newTabs = content.match(rExp);
  if (newTabs != null) {
    var newTabsLen = newTabs.length;
    for (var j = 0; j < newTabsLen; j++) {
      var nt = newTabs[j];
      chrome.tabs.create({ url: nt, active: false });
    }
  } else {
    alert('Only fully qualified URLs will be opened.');
  }
}

function sendMail(gm) {
  var action_url = "mailto:?";
  //action_url += "subject=" + encodeURIComponent(subject) + "&";
  action_url += "body=" + encodeURIComponent(document.getElementById('content').value);
  if (gm == 1) {
    var custom_url = "https://mail.google.com/mail/?extsrc=mailto&url=%s";
    action_url = custom_url.replace("%s", encodeURIComponent(action_url));
    chrome.tabs.create({ url: action_url });
  } else {
    chrome.tabs.update(tab_id, { url: action_url });
  }
}

function download() {

  var content = document.getElementById('content').value
  var content_arr = content.split('\n\n');
  var data = '<html><head></head><body>';
  for (var i = 0; i < content_arr.length; i++) {
    var content_url = content_arr[i].split('\n');
    if (document.getElementById('inclTitle').checked == true) {
      data += '<a href="' + content_url[1] + '">' + content_url[0] + '</a><br/>';
    } else {
      data += '<a href="' + content_arr[i] + '">' + content_arr[i] + '</a><br/>';
    }
  }
  data += '</body></html>';

  var blob = new Blob([data], { type: "text/html;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');

  a.download = "tabs.html";
  a.href = url;
  a.click();

}

function btUnknown() {
  console.log(chrome.tabGroups)
}

function btGetAllWindows() {
  chrome.windows.getAll({}, function (windows) {
    console.log(windows)
  })
}

function getCurrentWindowId() {

  console.log(id);
  // setWindowIdToDisplay()
}

function setWindowIdToDisplay(id) {
  document.getElementById('window-id').value = id;
}

function goToTabGroup(tabId, quietOpen = true) {
  console.log("Check #1", tabDB.check);
  if (!tabId) {
    return
  }

  const updateProperties = { 'active': true };
  chrome.tabs.update(tabId, updateProperties, (tab) => {
    console.log("Check #2", tabDB.check);
    console.log("Update Tab", tab);
    if (tab) {
      tabDB.check = tab.id;
    }
    if (tab && quietOpen) {
      chrome.tabs.discard(tabDB.check, (tab) => {
        console.log("Update Tab 2", tab);
        tabDB.check = tab.id;
      })
    }
  });
}

async function handleCreateYoutubeWatchList() {
  const exportOptions = getExportOptions();
  const metaJson = await createMetaJson({ exportOptions });
  const { windows } = metaJson;

  const watchListWindow = {};
  const tabIdList = [];
  const urlList = [];

  for (let windowId in windows) {
    const window = windows[windowId];
    
    for (let tabHashId in window.tabs) {
      const tab = window.tabs[tabHashId];
  
      if (
        (
          tab.hostname === "www.youtube.com" 
          || tab.hostname === "youtube.com"
          || tab.hostname === "m.youtube.com"
        )
        && tab.url !== "https://www.youtube.com/"
      ) {
        console.log("handleCreateYoutubeWatchList:Window", tab);
        watchListWindow[tabHashId] = tab
        tabIdList.push(tab.tabId)
        urlList.push(tab.url)
      }
    }
  }

  console.log("Watch List", watchListWindow)

  const isOpenNewWindow = confirm("Do you want to open Youtube in a new window")
  const isCloseInOthers = confirm("Do you want to close tab in other windows")

  if (isOpenNewWindow) {
    chrome.windows.create({}, (window) => {
      console.log("Open in new window");

      const createProperties = {
        windowId: window.id,
        active: false,
      };

      function callback(tab) {
        // console.log("Openned tabs in a new windows", tab);
        // chrome.tabs.discard(tab.id);
      }

      for (let url of urlList) {
        createProperties.url = url;
        chrome.tabs.create(createProperties, callback);
      }

    });

  }

  if (isCloseInOthers) {
    console.log("Close in other windows");

    function callback(tab) {
      // console.log("Closed tabs in other windows", tab);
    }

    chrome.tabs.remove(tabIdList, callback);
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  document.querySelector('#btOpenTabs').addEventListener('click', openTabs);
  document.querySelector('#inclTitle').addEventListener('click', start);
  document.querySelector('#inclAll').addEventListener('click', start);
  document.querySelector('#checkWithText').addEventListener('click', start);
  document.querySelector('#checkWithJson').addEventListener('click', start);
  document.querySelector('#sendMail0').addEventListener('click', function () { sendMail(0) });
  document.querySelector('#sendMail1').addEventListener('click', function () { sendMail(1) });
  document.querySelector('#download').addEventListener('click', download);
  document.querySelector('#btUnknown').addEventListener('click', btUnknown);
  document.querySelector('#btGetAllWindows').addEventListener('click', btGetAllWindows);
  document.querySelector('#btGoToTabGroup').addEventListener('click', function () { goToTabGroup(tabDB.check) });
  start();
});
