/**
 * Copyright 2018, 2019 Timo Tijhof <krinklemail@gmail.com>
 * Copyright 2015, 2016 Ori Livneh <ori@wikimedia.org>
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
/* global chrome */

// From a chrome.tab.id to some data we maintain
const tabDatas = {};

/**
 * List of backend options to use for the given origin.
 *
 * @param {string} realm
 * @return {Promise<Array>}
 */
function fetchBackends( realm ) {
    if ( realm === 'beta' ) {
        // Avoid showing prod hostnames in beta.
        // Fixes <https://github.com/wikimedia/WikimediaDebug/issues/14>.
        return Promise.resolve( [] );
    }

    return fetch( 'https://noc.wikimedia.org/conf/debug.json' )
        .then( ( r ) => r.json() )
        .then( ( d ) => d.backends );
}

const debug = {

    // The HTTP header we inject.
    getHeader: function () {
        const attributes = [ 'backend=' + debug.state.backend ];

        if ( debug.state.profile ) {
            attributes.push( 'profile' );
        }
        if ( debug.state.forceprofile ) {
            attributes.push( 'forceprofile' );
        }
        if ( debug.state.readonly ) {
            attributes.push( 'readonly' );
        }
        if ( debug.state.log ) {
            attributes.push( 'log' );
        }

        return {
            name: 'X-Wikimedia-Debug',
            value: attributes.join( '; ' )
        };
    },

    // We intercept requests to URLs matching these patterns.
    urlPatterns: [
        '*://*.mediawiki.org/*',
        '*://*.wikidata.org/*',
        '*://*.wikibooks.org/*',
        '*://*.wikimedia.org/*',
        '*://*.wikinews.org/*',
        '*://*.wikipedia.org/*',
        '*://*.wikiquote.org/*',
        '*://*.wikisource.org/*',
        '*://*.wikiversity.org/*',
        '*://*.wikivoyage.org/*',
        '*://*.wiktionary.org/*',
        '*://*.beta.wmflabs.org/*',
        '*://*.tools.wmflabs.org/*',
        '*://*.tools-static.wmflabs.org/*'
    ],

    theme: ( window.matchMedia( '(prefers-color-scheme: dark)' ).matches )
        ? 'dark'
        : 'light',

    state: {
        // Current state: if true, inject header; if not, do nothing.
        enabled: false,

        // To which backend shall the request go to?
        backend: null,

        // Send call graph to XHGui
        // https://wikitech.wikimedia.org/wiki/X-Wikimedia-Debug#Request_profiling
        profile: false,

        // Output inline debug profile in the HTML/JS web response
        // https://wikitech.wikimedia.org/wiki/X-Wikimedia-Debug#Plaintext_request_profile
        forceprofile: false,

        // Set MediaWiki web request in $wgReadOnly-mode.
        readonly: false,

        // Enable verbose debug logging
        // https://wikitech.wikimedia.org/wiki/X-Wikimedia-Debug#Debug_logging
        log: false
    },

    // Toggle enabled state.
    setEnabled: function ( value ) {
        debug.state.enabled = value;
        debug.updateIcon();
        if ( debug.state.enabled ) {
            chrome.alarms.create( 'autoOff', { delayInMinutes: 15 } );
        }
    },

    // Dim the toolbar icon when inactive.
    updateIcon: function () {
        const path = debug.theme === 'dark' ? 'icon-darkmode-128.png' : 'icon-lightmode-128.png';
        chrome.browserAction.setIcon( { path: path } );
        if ( debug.state.enabled ) {
            chrome.browserAction.setBadgeBackgroundColor( { color: '#447ff5' } );
            chrome.browserAction.setBadgeText( { text: 'ON' } );
        } else {
            chrome.browserAction.setBadgeText( { text: '' } );
        }
    },

    // Inject header when active.
    onBeforeSendHeaders: function ( req ) {
        if ( debug.state.enabled ) {
            req.requestHeaders.push( debug.getHeader() );
        }
        return { requestHeaders: req.requestHeaders };
    },

    onHeadersReceived: function ( resp ) {
        if ( resp.type === 'main_frame' && debug.state.enabled ) {
            const header = resp.responseHeaders.find( ( header ) => header.name === 'x-request-id' );
            tabDatas[ resp.tabId ] = {
                reqId: header && header.value
            };
        }
    },

    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onRemoved
    onTabRemoved: function ( tabId ) {
        // The tabId may be unknown, for example:
        // ... when WikimediaDebug is not enabled at all.
        // ... when closing a tab that was already open before WikimediaDebug got enabled.
        delete tabDatas[ tabId ];
    },

    // Automatic shutoff.
    onAlarm: function ( alarm ) {
        if ( alarm.name === 'autoOff' ) {
            // Disable and reset logging/profiling
            debug.state.profile = false;
            debug.state.forceprofile = false;
            debug.state.readonly = false;
            debug.state.log = false;

            debug.setEnabled( false );
        }
    },

    /**
     * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage
     * @param {Object} request
     * @param {Object} sender https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/MessageSender
     * @param {Function} sendResponse
     * @return {boolean|undefined} Return true to make sendResponse available asynchronously,
     *  or undefined if there is only a synchronous response or no response needed.
     */
    onMessage: function ( request, sender, sendResponse ) {
        if ( request.action === 'set-state' ) {
            const state = request.state;
            debug.setEnabled( state.enabled );
            debug.state.backend = state.backend;
            debug.state.profile = state.profile;
            debug.state.forceprofile = state.forceprofile;
            debug.state.readonly = state.readonly;
            debug.state.log = state.log;
            return;
        }

        if ( request.action === 'get-state' ) {
            fetchBackends( request.realm ).then( ( backends ) => {
                sendResponse( {
                    backends: backends,
                    state: debug.state
                } );
            } );
            return true;
        }

        if ( request.action === 'get-url-pattern' ) {
            sendResponse( { urlPatterns: debug.urlPatterns } );
            return;
        }

        // Optimisation: Only fetch backends when someone opens the popup, not on every page
        // load. That's why content-script has its own action, separate from the 'get-state'
        // action for the popup.
        //
        // Optimisation: Ignore content-script.js when we're disabled.
        if ( request.action === 'content-script' && debug.state.enabled ) {
            sendResponse( {
                state: debug.state,
                tabData: ( tabDatas[ sender.tab && sender.tab.id ] || null )
            } );
            return;
        }

        if ( request.action === 'set-theme' ) {
            if ( debug.theme !== request.theme ) {
                debug.theme = request.theme === 'dark' ? 'dark' : 'light';
                debug.updateIcon();
            }
            return;
        }
    }
};

chrome.runtime.onMessage.addListener( debug.onMessage );

chrome.alarms.onAlarm.addListener( debug.onAlarm );

chrome.webRequest.onBeforeSendHeaders.addListener( debug.onBeforeSendHeaders,
    { urls: debug.urlPatterns }, [ 'blocking', 'requestHeaders' ] );

chrome.webRequest.onHeadersReceived.addListener( debug.onHeadersReceived,
    { urls: debug.urlPatterns }, [ 'responseHeaders' ] );

chrome.tabs.onRemoved.addListener( debug.onTabRemoved );

debug.updateIcon();
