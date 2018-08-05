#!/usr/bin/env osascript -l JavaScript

ObjC.import('stdlib')

/*
 * OSA entry function ¯\_(ツ)_/¯
 *
 * @param {Object} args The CLI arguments
 */
function run(args) {
    var url = args[0];
    var appName = args[1];
    var version = args[2];
    var iTunesApp = openiTunesWithURL(fixUrl(url));
    downloadApplication(appName, version);
    var path = monitorDownload(appName, version);
    iTunesApp.quit();
    return path;
}

/*
 * Convert url from https to itms
 *
 * @param {String} iTunesURL
 */
var fixUrl = function(url) {
    return url.replace('https:', 'itms:');
};

/*
 * Fires up iTunes application and directs it to open our app URL in App Store
 *
 * @param {String} iTunesURL The iTunes URL to open in iTunes. MUST start with "itms://"
 */
var openiTunesWithURL = function(iTunesURL) {
    console.log("[+] Firing up iTunes with location: " + iTunesURL);
    iTunesApp = Application('iTunes');
    iTunesApp.activate();
    iTunesApp.openLocation(iTunesURL);

    return iTunesApp;
};

/*
 * Juicy part. This method keeps trying to find the "Download" button on the app's
 * page on iTunes. Every time it bumps the polling interval by one second cause we
 * don't want to be very aggressive.
 */
var downloadApplication = function(appName, version) {
   console.log("downloading " + appName + ",version:" + version);

   var retries = 0;
   var maxRetries = 5;

   while(true) {
       try {

         // Get an array of all UI elements in iTunes window.
         uiElems = Application("System Events").applicationProcesses['iTunes'].windows[0].entireContents()

         // Find all buttons whose description contains 'Get'.
         btns = uiElems.filter(function(el) {
           return el.role() == 'AXButton' && (el.description().match(/\bGet\b/) || el.description().match(/\bDownload\b/))
         })

         // Click on the 1st button found.
         btns[0].click()

         break;

       } catch(e) {
           /*
               iTunes needs to load the App Store in its embeded littled browser thingie which might take a while.
               Unfortunately, fucking JXA methods won't return a proper error but rather throw a runtime exception.
               Essentially, we keep retrying by incrementing our delay until we reach the desireable state where the
               "download" control can be paresed and the download can be initiated.
           */
           var delayThreshold = retries + 1;

           console.log('[!] State not ready yet, retrying in (' + delayThreshold +'s)...');
           delay(delayThreshold);

           if(++retries === maxRetries) {
               console.log('[!] Cannot reach desirable state. Bailing out...');
               $.exit(-1);
           }
       }

   }
};

/*
 * Steps into ObjC lalaland and checks whether our app was downloaded. The app
 * download starts as a *.tmp file in "_/iTunes Media/Downloads". When the download
 * is finished, it's copied over to "_/iTunes Media/Mobile Applications". We Poll
 * that directory and when our file appears, we're done.
 *
 */
var monitorDownload = function(appName, version) {
    console.log("monitoring " + appName + ",version:" + version);
    var isFileNotFound = true;
    var result;
    var app = Application.currentApplication();
    app.includeStandardAdditions = true;
    var username =  app.systemInfo().shortUserName;
    var downloadsPath = '/Users/' + username + '/Music/iTunes/iTunes Media/Mobile Applications';
    var appNameWithVersion = appName.concat(" ", version);
    console.log("full app name:" + appNameWithVersion);
    var fullAppName = appNameWithVersion.split(" ")[0].slice(0, -1);
    console.log("test app:" + fullAppName);
    /* Stepping in Objective-C territory. There might be a saner way to do this by manipulating
        Finder via `System Events` the way we do with iTunes, but will probably be very very slow.

        For now, we just use the bridge to NSFileManager methods.
    */
    var fileMgr = $.NSFileManager.defaultManager;

    while(isFileNotFound) {
        var lstFiles = ObjC.unwrap(
            // Need to bring this from ObjC runtime to Javascript runtime.
            // Parallel universes! Fringe science!
            fileMgr.contentsOfDirectoryAtPathError(downloadsPath, null)
        );

        if (lstFiles) {
            for(var i=0; i < lstFiles.length; i++) {
                var filename = ObjC.unwrap(lstFiles[i]);
                if (filename !== 'download.app' && filename.indexOf(fullAppName) > -1){
                    isFileNotFound = false;
                    result = downloadsPath + '/' + filename;
                    console.log('✔ Download complete. ' + result);
                    break;
                }
            }
        }
    }

    return result;
};
