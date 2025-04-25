try {
    importScripts(
        "func/cmm-cookie.js", 
        "func/pt-pa-info.js",
        "func/pa-downloader.js"
    );
}
catch (e) {
    console.log(`Error importing scripts: ${e}`)
}