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

/**
 * List of backend options to use for the given origin.
 *
 * This is asynchronous/Promise-returning in preparation
 * for <https://github.com/wikimedia/WikimediaDebug/issues/7>.
 * Once used, this should use chrome.storage.local to cache
 * the values for e.g. 1 hour.
 *
 * @return Promise<Array>
 */
function getBackends( realm ) {
    var list = [
        'mwdebug1001.eqiad.wmnet',
        'mwdebug1002.eqiad.wmnet',
        'mwdebug2001.codfw.wmnet',
        'mwdebug2002.codfw.wmnet'
    ];
    if ( realm === 'beta' ) {
        // Avoid showing prod hostnames in beta.
        // Fixes <https://github.com/wikimedia/WikimediaDebug/issues/14>.
        list = [];
    }

    return Promise.resolve( list );
}

var debug = {

    // The HTTP header we inject.
    getHeader: function () {
        var attributes = [ 'backend=' + debug.state.backend ];

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
            name  : 'X-Wikimedia-Debug',
            value : attributes.join( '; ' )
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
        '*://*.tools-static.wmflabs.org/*',
    ],

    theme: ( window.matchMedia( '(prefers-color-scheme: dark)' ).matches )
        ? 'dark'
        : 'light',

    state: {
        // Current state: if true, inject header; if not, do nothing.
        enabled: false,

        // To which backend shall the request go to?
        backend: null,
        backends: [],

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
        var path = debug.theme === 'dark' ? 'icon-darkmode-128.png' : 'icon-lightmode-128.png';
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

    onMessage: function ( request, sender, sendResponse ) {
        if ( request.action === 'set-state' ) {
            var state = request.state;
            debug.setEnabled( state.enabled );
            debug.state.backend = state.backend;
            debug.state.profile = state.profile;
            debug.state.forceprofile = state.forceprofile;
            debug.state.readonly = state.readonly;
            debug.state.log = state.log;
        } else if ( request.action === 'get-state' ) {
            getBackends( request.realm ).then( function ( backends ) {
                debug.state.backends = backends;
                sendResponse( {
                    state: debug.state
                } );
            } );
        } else if ( request.action === 'set-theme' ) {
            if ( debug.theme !== request.theme ) {
                debug.theme = request.theme === 'dark' ? 'dark' : 'light';
                debug.updateIcon();
            }
        }

        return true;
    }
};

chrome.runtime.onMessage.addListener( debug.onMessage );

chrome.alarms.onAlarm.addListener( debug.onAlarm );

chrome.webRequest.onBeforeSendHeaders.addListener( debug.onBeforeSendHeaders,
    { urls: debug.urlPatterns }, [ 'blocking', 'requestHeaders' ] );

debug.updateIcon();
