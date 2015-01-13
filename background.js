/**
 * Copyright 2015 Ori Livneh <ori@wikimedia.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var enabled = false;

chrome.browserAction.onClicked.addListener( function () {
    enabled = !enabled;  // toggle.
    var icon = 'icon_38_' + ( enabled ? 'on' : 'off' ) + '.png';
    chrome.browserAction.setIcon( { path: icon } );
} );

chrome.webRequest.onBeforeSendHeaders.addListener( function ( details ) {
    if ( enabled ) {
        var header = { name: 'X-Wikimedia-Debug', value: '1' };
        details.requestHeaders.push( header );
    }
    return { requestHeaders: details.requestHeaders };
}, { urls: [ '<all_urls>' ] }, [ 'blocking', 'requestHeaders' ] );
