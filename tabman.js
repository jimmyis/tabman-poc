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

var noParenthesis = new Set([
  "facebook.com",
  "www.facebook.com",
  "youtube.com",
  "www.youtube.com",
  "quora.com",
  "www.quora.com"
])

function start(tab) {
  chrome.windows.getCurrent(getWindows);
}

function getWindows(win) {
  targetWindow = win;
  chrome.tabs.getAllInWindow(targetWindow.id, getTabs);
}

function getTabs(tabs) {
  tabCount = tabs.length;
  chrome.windows.getAll({ "populate": true }, expTabs);
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

document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('#btOpenTabs').addEventListener('click', openTabs);
  document.querySelector('#inclTitle').addEventListener('click', start);
  document.querySelector('#inclAll').addEventListener('click', start);
  document.querySelector('#sendMail0').addEventListener('click', function () { sendMail(0) });
  document.querySelector('#sendMail1').addEventListener('click', function () { sendMail(1) });
  document.querySelector('#download').addEventListener('click', download);
  start();
});
