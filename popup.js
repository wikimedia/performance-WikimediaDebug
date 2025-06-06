/**
 * Copyright 2025 Wikimedia Foundation and contributors.
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

function debugLog( msg, ...args ) {
    console.info( '[WikimediaDebug/popup.js] ' + msg, ...args );
}

const pendingState = new Promise(
    ( resolve ) => {
        chrome.runtime.sendMessage(
            { action: 'get-state' },
            ( response ) => {
                debugLog( 'Received get-state response', response.state );
                resolve( response );
            }
        );
    }
);

/**
 * @param {string} tagName
 * @param {Object<string,string>} props
 * @param {string|HTMLElement} children String to become a text node or HTMLElement
 * @return {HTMLElement}
 */
function dom( tagName, props = {}, ...children ) {
    const element = document.createElement( tagName );
    Object.assign( element, props );
    element.append( ...children );
    return element;
}

function renderOutputList( outputList ) {
    const listElement = document.querySelector( '.output' );
    listElement.innerHTML = '';
    const d12hAgo = new Date();
    d12hAgo.setHours( d12hAgo.getHours() - 12 );
    let lastMainItem = null;
    for ( const entry of outputList ) {
        const itemElement = document.createElement( 'li' );
        itemElement.value = entry.offset;
        if ( entry.isMain ) {
            itemElement.dataset.main = 'true';
            lastMainItem = itemElement;
        }
        // Support Chrome: Chrome encodes Date objects as ISO string,
        // whereas Firefox performs a structuredClone()
        const d = new Date( entry.timestamp );
        // Use undefined to let user agent decide
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
        const fullDateFmt = d.toLocaleString( undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false } );
        const timeFmt = d < d12hAgo
            ? d.toLocaleDateString( undefined, { weekday: 'short' } )
            : d.toLocaleTimeString( undefined, { timeStyle: 'short', hour12: false } );
        entry.links.forEach( ( link, i ) => {
            itemElement.append(
                i !== 0 ? ', ' : '',
                dom( 'a', {
                    href: link.href,
                    // Support Chrome: External links fail to open by default,
                    // whereas Firefox defaults to opening in a new tab.
                    target: '_blank'
                }, link.label )
            );
        } );
        itemElement.append(
            dom( 'span', { className: 'output-entry', title: `Captured from ${ entry.href } at ${ fullDateFmt }`, tabIndex: '0' },
                dom( 'time', { className: 'output-entry-time' }, timeFmt ),
                ' ',
                dom( 'span', { className: 'output-entry-url' }, entry.href ),
            )
        );
        listElement.append( itemElement );
    }
    if ( lastMainItem ) {
        lastMainItem.scrollIntoView( { behavior: 'instant', block: 'start', inline: 'start' } );
        lastMainItem.focus();
    }
}

function onMessage( response ) {
    if ( response.action === 'set-output' ) {
        renderOutputList( response.outputList );
    }
}

( async function popup() {
    'use strict';
    const response = await pendingState;

    const optionElements = [].slice.call( document.querySelectorAll( '.option' ) );

    function onUpdate() {
        const message = { action: 'set-state', state: {} };

        optionElements.forEach( ( el ) => {
            let newValue;
            if ( el.checked !== undefined ) {
                newValue = el.checked;
            } else if ( el.value !== undefined ) {
                newValue = el.value;
            } else {
                newValue = el.getAttribute( 'aria-checked' ) === 'true';
            }
            message.state[ el.id ] = newValue;
        } );

        debugLog( 'Sending set-state request', message.state );
        chrome.runtime.sendMessage( message );
    }

    function onSwitcherClick() {
        const newValue = !( this.getAttribute( 'aria-checked' ) === 'true' );
        this.setAttribute( 'aria-checked', String( newValue ) );
        const e = new Event( 'change' );
        this.dispatchEvent( e );
    }

    function onSwitcherKeypress( e ) {
        if ( e.key === ' ' || e.key === 'Enter' ) {
            onSwitcherClick.call( this );
        }
    }

    if ( response.realm === 'other' ) {
        document.querySelector( '.warning' ).hidden = false;
    }

    if ( response.backends ) {
        const backendElement = document.querySelector( '#backend' );
        backendElement.innerHTML = '';
        response.backends.forEach( ( backend ) => {
            const item = document.createElement( 'option' );
            item.value = backend;
            item.textContent = backend === '1' ? '(Unspecified backend)' : backend;
            backendElement.appendChild( item );
        } );
    }

    optionElements.forEach( ( el ) => {
        const value = response.state[ el.id ];
        if ( value !== null ) {
            if ( el.checked !== undefined ) {
                // Assume boolean for <input type="checkbox">
                el.checked = value;
            } else if ( el.value !== undefined ) {
                // Assume string option for <select>
                el.value = value;
            } else {
                // Assume boolean for ui-switcher
                el.setAttribute( 'aria-checked', String( value ) );
                el.addEventListener( 'click', onSwitcherClick );
                el.addEventListener( 'keypress', onSwitcherKeypress );
            }

        }

        el.addEventListener( 'change', onUpdate );
    } );

    renderOutputList( response.outputList );

    // Remove class="body-hidden"
    requestAnimationFrame( () => {
        requestAnimationFrame( () => {
            document.body.className = '';
        } );
    } );
    // TODO: restore Chrome theme based light/dark icon support
}() );

chrome.runtime.onMessage.addListener( onMessage );
