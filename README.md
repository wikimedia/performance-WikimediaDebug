# WikimediaDebug

Wikimedia developers can use a special HTTP header, X-Wikimedia-Debug, to
enable certain debugging features. This Web extension allows you to easily
inject the header into Wikimedia HTTP/S requests. Header injection can be
toggled via toolbar icon.

You can install it for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/wikimedia-debug-header/), or
[Chromium](https://chrome.google.com/webstore/detail/wikimediadebug/binmakecefompkjggiklgjenddjoifbb).

## Release process

### Test the release

* Clone the repository (if not already).
* Checkout latest `origin/master` and ensure a clean working copy.

  ```
  git remote update
  git checkout origin/master
  # Warning: Deletes any untracked files!
  git clean -dffx
  ```
* For Chrome:
  - Open the extension manager at `chrome://extensions/`.
  - Ensure any official installation of WikimediaDebug is disabled. (Temporarily)
  - Ensure "Developer mode" is enabled.
  - Use "Load unpacked" to load this directory as an extension.
  - Test the extension and confirm any change in functionality from a recent commit.
* For Firefox:
  - Open the add-on manage at `about:addons` (Tools > Add-ons).
  - From the gear menu, click "Debug Add-ons".
  - Use "Load Temporary Add-on..." and navigate to this directory and select the manifest.json file.
  - Test the extension and confirm any change in functionality from a recent commit.

### Create the release

* After having tested the extension and having a clean working copy
  of `origin/master` (per the above), update the version in `manifest.json` ([example](https://github.com/wikimedia/WikimediaDebug/commit/a2c6cb5b3c89258224bfa906291104e7c5bf77a8))
  and create a commit for this release.
* Create a signed tag, then push the commit and tag to GitHub.

  ```
  git add -p
  git commit -m "Tag vX.Y.Z"
  git tag -s vX.Y.Z
  git push --follow-tags
  ```
* Create the release on GitHub with a bullet list of changes. (View  [Tags](https://github.com/wikimedia/WikimediaDebug/tags), then "Create release" for this tag.) 
* Create a ZIP archive of the extension directory.

  ```
  git archive -v --format zip -9 -o /tmp/WikimediaDebug.zip HEAD
  ```

### Upload to the Chrome Web Store

See <https://developer.chrome.com/webstore/publish>.

* On the [Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard), click "Edit" for WikimediaDebug. (Avoid "Add new item", which creates a new extension instead.)
* Select "Upload Updated Package", then browse to the ZIP archive, upload it.
* Then, back on the same Edit page, "Publish changes" at the bottom of the page.
* Done!

### Upload to Firefox Add-ons

* Log in at <https://addons.mozilla.org/>.
* Open "[Manage My Submissions](https://addons.mozilla.org/en-US/developers/addons)" from the Tool menu.
* Select "Wikimedia Debug Header".
* Click "Upload New Version".
* Click "Select a file..." and select the ZIP archive, then continue.
* When asked for release notes, use the same bullet list as used for the release log on GitHub.
* Done!
