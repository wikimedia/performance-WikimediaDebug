/* global chrome */

function getCurrentTab() {
    return new Promise( function ( resolve ) {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            function ( tabs ) {
                resolve( tabs[ 0 ] );
            }
        );
    } );
}

const pendingSanitizedHostnames = new Promise(
    ( resolve ) => {
        chrome.runtime.sendMessage(
            { action: 'get-url-pattern' },
            function ( response ) {
                const sanitizedHostNames = response.urlPatterns.map(
                    ( pattern ) => pattern.slice( 6, -2 )
                );
                resolve( sanitizedHostNames );
            }
        );
    }
);

window.addEventListener( 'load', async function () {
    'use strict';

    const optionElements = [].slice.call( document.querySelectorAll( '.option' ) );

    function onUpdate() {
        const message = { action: 'set-state', state: {} };

        optionElements.forEach( function ( el ) {
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

        chrome.runtime.sendMessage( message );
    }

    function onSwitcherClick() {
        const newValue = !( this.getAttribute( 'aria-checked' ) === 'true' );
        this.setAttribute( 'aria-checked', String( newValue ) );
        const e = new Event( 'change' );
        this.dispatchEvent( e );
    }

    function getRealm( currentTab, allowedHostnames ) {
        const currentHostname = currentTab && currentTab.url && new URL( currentTab.url ).hostname || '';

        if ( /wikitech/.test( currentHostname ) ) {
            return 'other';
        }

        for ( const allowedHostname of allowedHostnames ) {
            if ( currentHostname.endsWith( allowedHostname ) ) {
                return /beta\.wmflabs\.org$/.test( currentHostname ) ? 'beta' : 'production';
            }
        }
        return 'other';
    }

    function onSwitcherKeypress( e ) {
        if ( e.key === ' ' || e.key === 'Enter' ) {
            onSwitcherClick.call( this );
        }
    }

    const currentTab = await getCurrentTab();
    const resolvedSanitizedHostNames = await pendingSanitizedHostnames;
    const currentRealm = getRealm( currentTab, resolvedSanitizedHostNames );

    if ( currentRealm === 'other' ) {
        document.querySelector( '.warning' ).hidden = false;
        document.querySelector( '.main-popup' ).hidden = true;
    }

    chrome.runtime.sendMessage(
        { action: 'get-state', realm: currentRealm },
        function ( response ) {
            if ( response.backends ) {
                const backendElement = document.querySelector( '#backend' );
                backendElement.innerHTML = '';
                response.backends.forEach( function ( backend ) {
                    const item = document.createElement( 'option' );
                    item.value = item.textContent = backend;
                    backendElement.appendChild( item );
                } );
            }

            optionElements.forEach( function ( el ) {
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

                    el.addEventListener( 'change', onUpdate );
                }

            } );

            // Remove class="hidden"
            document.body.className = '';
        } );

    // When opening the popup, also update the theme if needed.
    // E.g. if the color scheme of the OS has changed meanwhile.
    chrome.runtime.sendMessage( {
        action: 'set-theme',
        theme: ( window.matchMedia( '(prefers-color-scheme: dark)' ).matches )
            ? 'dark'
            : 'light'
    } );
} );
