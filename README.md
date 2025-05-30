# WikimediaDebug

Wikimedia developers can use a special HTTP header, X-Wikimedia-Debug, to
enable certain debugging features. This Web extension allows you to easily
inject the header into Wikimedia HTTP/S requests. Header injection can be
toggled via toolbar icon.

You can install [WikimediaDebug for Firefox](https://addons.mozilla.org/en-US/firefox/addon/wikimedia-debug-header/), or
[WikimediaDebug for Chromium](https://chrome.google.com/webstore/detail/wikimediadebug/binmakecefompkjggiklgjenddjoifbb).

## Release process

### Test the release

* Clone the repository (if not already).
* Checkout latest `origin/master` and ensure a clean working copy.

  ```
  git remote update && git checkout -B release -t origin/master
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
  of `origin/master` (per the above), update the version in `manifest.json` ([example](https://gerrit.wikimedia.org/g/performance/WikimediaDebug/+/a2c6cb5b3c89258224bfa906291104e7c5bf77a8))
  and create a commit for this release.
* Add a bullet list of noteworthy changes to `CHANGELOG.md`.
* Push the commit for review and merge it, then pull it down, then create a signed tag and push it.

  ```
  git remote update && git reset origin/master
  # edit manifest.json
  # edit CHANGELOG.md
  git add -p
  git commit -m "Tag X.Y.Z"
  git review
  # merge the commit
  git pull
  git tag -s X.Y.Z
  git push --tags
  ```
* Create a ZIP archive of the extension directory.

  ```
  git archive -v --format zip -9 -o /tmp/WikimediaDebug.zip HEAD
  ```
### Publishing

See <https://wikitech.wikimedia.org/wiki/Release_Engineering/Runbook/WikimediaDebug>.

#### Upload to the Chrome Web Store

See <https://developer.chrome.com/webstore/publish>.

* On the [Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard), click "Edit" for WikimediaDebug. (Avoid "Add new item", which creates a new extension instead.)
* Click "Package / Upload new package", then select your local ZIP archive.
* Once back on the Edit page, click "Submit for review" at the top.
* Done!

#### Upload to Firefox Add-ons

* Log in at <https://addons.mozilla.org/>.
* Open "[Manage My Submissions](https://addons.mozilla.org/en-US/developers/addons)" from the Tool menu.
* Select "Wikimedia Debug".
* Click "Upload New Version".
* Click "Select a file..." and select the ZIP archive, then continue.
* When asked for release notes, use the same bullet list as used for [CHANGELOG.md](./CHANGELOG.md).
* Done!
