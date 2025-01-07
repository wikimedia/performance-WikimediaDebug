/**
 * Copyright 2025 Wikimedia Foundation and contributors.
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
async function memGetWithSet( key, ttl, callback ) {
    const now = Date.now();
    let entry = ( await chrome.storage.local.get( [ key ] ) )[ key ];
    if ( !entry || entry.time > now || entry.time + ttl < now ) {
        // Not stored, stored in the future, or stored in the past and expired.
        // Discard far-future values to recover from accidental system clock change.
        entry = {
            time: now,
            val: await callback()
        };
        await chrome.storage.local.set( { [ key ]: entry } );
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

    return memGetWithSet( `backends-${ realm }`, TTL_HOUR, async () => {
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

    /**
     * The X-Wikimedia-Debug header directives we will inject into requests.
     *
     * @return {string}
     */
    getHeaderDirectives: function () {
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
        return attributes.join( '; ' );
    },

    /**
     * @param {string|undefined} url
     * @return {string}
     */
    getRealm: function ( url ) {
        const currentHostname = url && new URL( url ).hostname || '';

        for ( const urlPattern of debug.urlPatterns ) {
            const allowedHostname = urlPattern.slice( 6, -2 );
            if ( currentHostname.endsWith( allowedHostname ) ) {
                return /beta\.wmflabs\.org$/.test( currentHostname ) ? 'beta' : 'production';
            }
        }
        return 'other';
    },

    // We intercept requests to URLs matching these patterns.
    urlPatterns: chrome.runtime.getManifest().host_permissions,

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

    /**
     * Toggle enabled state.
     *
     * @param {bool} value
     */
    setEnabled: function ( value ) {
        debug.state.enabled = value;
        debug.updateIcon();
        debug.updateDNRRules();
        if ( debug.state.enabled ) {
            chrome.alarms.create( 'autoOff', { delayInMinutes: 15 } );
        }
    },

    /**
     * Add an "on" badge to the icon when enabled.
     */
    updateIcon: function () {
        // TODO: restore Chrome theme based light/dark icon support
        // Firefox is handled by manifest.json's `action.theme_icons`
        // settings. Be aware that the Firefox support uses naming that is
        // inverted from common usage. The "light" and "dark" variants refer
        // to the text/colors of the icon, not the system theme's colors.
        if ( debug.state.enabled ) {
            chrome.action.setBadgeBackgroundColor( { color: '#447ff5' } );
            chrome.action.setBadgeText( { text: 'ON' } );
        } else {
            chrome.action.setBadgeText( { text: '' } );
        }
    },

    /**
     * Build an array of declarativeNetRequest rules that will apply the
     * currently configured X-Wikimedia-Debug header to requests for URLs from
     * our configured domains.
     *
     * @return {Array}
     */
    buildDNRRules: function () {
        const ourDomains = debug.urlPatterns.map(
            ( urlPattern ) => urlPattern.slice( 6, -2 )
        );
        // The spec makes it sound like the `condition.resourceTypes` value is
        // optional. In practice however Chrome seems to not apply a rule to
        // top-level navigation actions (clicking links, URL bar changes)
        // unless the 'main_frame' type is specified.
        // We want the header injected in all requests, not just top-level
        // actions, so we will enable the full set of resource types the
        // browser runtime knows about. Chrome and Firefox have different
        // resource types available for use in a rule's
        // `condition.resourceTypes` collection.
        const allTypes = Object.values(
            chrome.declarativeNetRequest.ResourceType
        );
        return [
            {
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        {
                            operation: 'set',
                            header: 'X-Wikimedia-Debug',
                            value: debug.getHeaderDirectives()
                        }
                    ]
                },
                condition: {
                    requestDomains: ourDomains,
                    resourceTypes: allTypes,
                }
            }
        ];
    },

    /**
     * Add/remove declarativeNetRequest rules based on the current enabled
     * state.
     */
    updateDNRRules: function () {
        ( async () => {
            const DNR = chrome.declarativeNetRequest;
            try {
                const oldRules = await DNR.getSessionRules();
                const newRules = debug.state.enabled
                    ? debug.buildDNRRules()
                    : [];
                await DNR.updateSessionRules( {
                    removeRuleIds: oldRules.map( ( rule ) => rule.id ),
                    addRules: newRules,
                } );
                const activeRules = await DNR.getSessionRules();
                console.log( 'Installed rules', activeRules );
            } catch ( e ) {
                console.log( 'Failed to update rules', e );
            }
        } )();
    },

    /**
     * Propagate interesting response meta information as the payload of
     * a 'set-output' message when enabled. Our popup.js listens for this
     * message and modifies the active tab's DOM.
     *
     * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onHeadersReceived
     *
     * @param {object} resp
     */
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

    /**
     * Disable automatically when an 'autoOff' alarm is received.
     *
     * @param {object} alarm
     */
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
     * Process messages sent by popup.js.
     *
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
        // TODO: restore Chrome theme based light/dark icon support
    }
};

// Install handler for inter-script messages from popup.js
chrome.runtime.onMessage.addListener( debug.onMessage );
// Install handler for alarm events.
chrome.alarms.onAlarm.addListener( debug.onAlarm );
// Install handler for response headers from our configured domains.
chrome.webRequest.onHeadersReceived.addListener( debug.onHeadersReceived,
    { urls: debug.urlPatterns }, [ 'responseHeaders' ] );
// Update extension icon state.
debug.updateIcon();
