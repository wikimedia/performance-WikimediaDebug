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

// The last ten entries to display in the "output" list
const outputList = [];
let outputOffset = 0;
const OUTPUT_MAXLENGTH = 100;

const TTL_HOUR = 3600 * 1000;
const memory = new Map();
async function memGetWithSet( key, ttl, callback ) {
    const now = Date.now();
    let entry = memory.get( key );
    if ( !entry || entry.time > now || entry.time + ttl < now ) {
        // Not stored, stored in the future, or stored in the past and expired.
        // Discard far-future values to recover from accidental system clock change.
        entry = {
            time: now,
            val: await callback()
        };
        memory.set( key, entry );
    }
    return entry.val;
}

/**
 * List of backend options to use for the given origin.
 *
 * @param {string} realm
 * @return {Promise<Array>}
 */
async function fetchBackends( realm ) {
    if ( realm !== 'production' ) {
        // Avoid showing prod hostnames in beta and on other sites.
        return Promise.resolve( [ '1' ] );
    }

    return memGetWithSet( `backends-${realm}`, TTL_HOUR, async () => {
        const resp = await fetch( 'https://noc.wikimedia.org/conf/debug.json' );
        const data = await resp.json();
        return data.backends;
    } );

}

function getCurrentTab() {
    return new Promise( ( resolve ) => {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            ( tabs ) => {
                resolve( tabs[ 0 ] );
            }
        );
    } );
}

const debug = {

    // The HTTP header we inject.
    getHeader: function () {
        const attributes = [ 'backend=' + debug.state.backend ];

        if ( debug.state.excimer ) {
            attributes.push( 'excimer' );
        }
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

    /**
     * @param {string|undefined} url
     * @return {string}
     */
    getRealm: function ( url ) {
        const currentHostname = url && new URL( url ).hostname || '';

        if ( /wikitech/.test( currentHostname ) ) {
            return 'other';
        }

        for ( const urlPattern of debug.urlPatterns ) {
            const allowedHostname = urlPattern.slice( 6, -2 );
            if ( currentHostname.endsWith( allowedHostname ) ) {
                return /beta\.wmflabs\.org$/.test( currentHostname ) ? 'beta' : 'production';
            }
        }
        return 'other';
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
        // https://wikitech.wikimedia.org/wiki/WikimediaDebug#Request_profiling
        excimer: false,

        // Send call graph to XHGui
        // https://wikitech.wikimedia.org/wiki/WikimediaDebug#XHGui_profiling
        profile: false,

        // Output inline debug profile in the HTML/JS web response
        // https://wikitech.wikimedia.org/wiki/WikimediaDebug#Plaintext_request_profile
        forceprofile: false,

        // Set MediaWiki web request in $wgReadOnly mode.
        readonly: false,

        // Enable verbose debug logging
        // https://wikitech.wikimedia.org/wiki/WikimediaDebug#Debug_logging
        log: false,
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
        const path = debug.theme === 'dark' ? 'images/icon-darkmode-128.png' : 'images/icon-lightmode-128.png';
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

    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onHeadersReceived
    onHeadersReceived: function ( resp ) {
        if ( debug.state.enabled ) {
            const isMain = resp.type === 'main_frame';
            const reqId = resp.responseHeaders
                .find( ( responseHeader ) => responseHeader.name === 'x-request-id' )
                ?.value;
            const excimerLink = resp.responseHeaders
                .find( ( responseHeader ) => responseHeader.name === 'excimer-ui-link' )
                ?.value;
            const isBeta = debug.getRealm( resp.url ) === 'beta';
            const links = [];
            if ( debug.state.excimer && excimerLink ) {
                links.push( {
                    label: 'Open profile in Excimer UI',
                    href: excimerLink
                } );
            }
            if ( debug.state.profile && reqId ) {
                links.push( {
                    label: 'Find in XHGui',
                    href: isBeta
                        ? 'https://performance.wikimedia.beta.wmflabs.org/xhgui/?url=' + reqId
                        : 'https://performance.wikimedia.org/xhgui/?url=' + reqId
                } );
            }
            if ( debug.state.log && reqId ) {
                const logstashDash = isBeta
                    ? 'https://logstash-beta.wmflabs.org/app/dashboards#/view/x-debug'
                    : 'https://logstash.wikimedia.org/app/dashboards#/view/x-debug';
                links.push( {
                    label: 'Find in Logstash',
                    href: logstashDash
                        + '?_g=(time:(from:now-1h,mode:quick,to:now))&'
                        + '_a=(query:(query_string:(query:%27reqId:%22' + encodeURI( reqId ) + '%22%27)))'
                } );
            }
            if ( links.length ) {
                outputList.push( {
                    offset: ++outputOffset,
                    isMain,
                    method: resp.method,
                    href: resp.url,
                    timestamp: new Date(),
                    links
                } );
                // Remove any old entries, keep the last 100
                outputList.splice( 0, outputList.length - OUTPUT_MAXLENGTH );
                chrome.runtime.sendMessage( { action: 'set-output', outputList } );
            }
        }
    },

    // Automatic shutoff.
    onAlarm: function ( alarm ) {
        if ( alarm.name === 'autoOff' ) {
            // Disable and reset logging/profiling
            debug.state.excimer = false;
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
            debug.state.excimer = state.excimer;
            debug.state.profile = state.profile;
            debug.state.forceprofile = state.forceprofile;
            debug.state.readonly = state.readonly;
            debug.state.log = state.log;
            return;
        }

        if ( request.action === 'get-state' ) {
            ( async () => {
                const currentTab = await getCurrentTab();
                const realm = debug.getRealm( currentTab && currentTab.url );
                const backends = await fetchBackends( realm );
                sendResponse( {
                    realm,
                    backends,
                    outputList,
                    state: debug.state
                } );
            } )();
            return true;
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

debug.updateIcon();
