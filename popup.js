
function getCurrentTab() {
  return new Promise( function ( resolve ) {
    chrome.tabs.query(
      { active: true, currentWindow: true },
      function ( tabs ) {
        resolve( tabs[0] );
    } );
  } );
}

window.addEventListener( 'load', async function () {
  'use strict';

  var optionElements = [].slice.call( document.querySelectorAll( '.option' ) );

  function onUpdate() {
      var message = { action: 'set', state: {} };

      optionElements.forEach( function ( el ) {
          message.state[ el.id ] = el.checked !== undefined
            ? el.checked
            : el.value;
      } );

      chrome.runtime.sendMessage( message );
  }

  var currentTab = await getCurrentTab();
  var currentHostname = currentTab && currentTab.url && new URL( currentTab.url ).hostname || '';
  var currentRealm = /beta\.wmflabs\.org$/.test( currentHostname ) ? 'beta' : 'production';

  chrome.runtime.sendMessage(
    { action: 'get', realm: currentRealm },
    function ( response ) {
      if ( response.state.backends.length ) {
        var backendElement = document.querySelector( '#backend' );
        backendElement.innerHTML = '';
        response.state.backends.forEach( function ( backend ) {
          var item = document.createElement( 'option' );
          item.value = item.textContent = backend;
          backendElement.appendChild( item );
        } );
      }

      optionElements.forEach( function ( el ) {
          var value = response.state[ el.id ];
          if ( value !== null ) {
            if ( typeof value === 'boolean' ) {
                el.checked = value;
            } else {
                el.value = value;
            }
          }

          el.addEventListener( 'change', onUpdate );
      } );

      // Remove class="hidden"
      document.body.className = '';
  } );
} );
