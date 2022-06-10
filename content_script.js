/**
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
/* global chrome */
( function () {
    'use strict';

    // Insert an item to the footer menu at the bottom of the page.
    function addFooterPlace( caption, url ) {
        const a = document.createElement( 'a' );
        a.className = 'noprint';
        a.href = url;
        a.textContent = caption;
        a.style.fontWeight = 'bold';

        const li = document.createElement( 'li' );
        li.id = 'footer-places-' + caption.toLowerCase().replace( /\W/g, '-' );
        li.appendChild( a );

        const ul = document.querySelector( '#footer-places, .footer-places' );
        if ( ul ) {
            ul.appendChild( li );
        }
    }

    chrome.runtime.sendMessage( { action: 'content-script' }, function ( response ) {
        if ( !response
                || !response.state.enabled
                || !( response.state.log || response.state.profile )
                || !response.tabData
                || !response.tabData.reqId
        ) {
            return;
        }

        const reqId = response.tabData.reqId;
        const isBeta = /beta\.wmflabs\.org$/.test( location.hostname );

        if ( response.state.profile ) {
            addFooterPlace(
                'Find in XHGui',
                isBeta
                    ? 'https://performance.wikimedia.beta.wmflabs.org/xhgui/?url=' + reqId
                    : 'https://performance.wikimedia.org/xhgui/?url=' + reqId
            );
        }
        if ( response.state.log ) {
            const logstashDash = isBeta
                ? 'https://logstash-beta.wmflabs.org/app/dashboards#/view/x-debug'
                : 'https://logstash.wikimedia.org/app/dashboards#/view/x-debug';
            addFooterPlace(
                'Find in Logstash',
                logstashDash
                    + '?_g=(time:(from:now-1h,mode:quick,to:now))&'
                    + '_a=(query:(query_string:(query:%27reqId:%22' + encodeURI( reqId ) + '%22%27)))'
            );
        }
    } );

}() );
