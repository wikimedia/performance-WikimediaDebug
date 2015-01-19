/**
 * Copyright 2015 Ori Livneh <ori@wikimedia.org>
 *
 * Licensed under the Apache License, Version 2.0 ( the "License" );
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
'use strict';

var debug = {

    // The HTTP header we inject.
    header: { name: 'X-Wikimedia-Debug', value: '1' },

    // We intercept requests to URLs matching these patterns.
    urlPatterns: [
        '*://*.mediawiki.org/*',
        '*://*.wikibooks.org/*',
        '*://*.wikimedia.org/*',
        '*://*.wikinews.org/*',
        '*://*.wikipedia.org/*',
        '*://*.wikiquote.org/*',
        '*://*.wikisource.org/*',
        '*://*.wikiversity.org/*',
        '*://*.wikivoyage.org/*',
        '*://*.wiktionary.org/*',
    ],

    // Current state: if true, inject header; if not, do nothing.
    enabled: false,

    // Toggle state.
    toggle: function ( state ) {
        debug.enabled = ( state !== undefined ) ? state : !debug.enabled;
        debug.updateIcon();
        if ( debug.enabled ) {
            chrome.alarms.create( 'autoOff', { delayInMinutes: 5 } );
        }
    },

    // Dim the toolbar icon when inactive.
    updateIcon: function () {
        var path = debug.enabled ? 'icon_38_on.png' : 'icon_38_off.png';
        chrome.browserAction.setIcon( { path: path } );
    },

    // Inject header when active.
    onBeforeSendHeaders: function ( req ) {
        if ( debug.enabled ) {
            req.requestHeaders.push( debug.header );
        }
        return { requestHeaders: req.requestHeaders };
    },

    // Automatic shutoff.
    onAlarm: function ( alarm ) {
        if ( alarm.name === 'autoOff' ) {
            debug.toggle( false );
        }
    }
};

chrome.alarms.onAlarm.addListener( debug.onAlarm );
chrome.browserAction.onClicked.addListener( debug.toggle );
chrome.webRequest.onBeforeSendHeaders.addListener( debug.onBeforeSendHeaders,
    { urls: debug.urlPatterns }, [ 'blocking', 'requestHeaders' ] );
