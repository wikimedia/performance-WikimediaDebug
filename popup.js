window.addEventListener( 'load', function () {
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

  chrome.runtime.sendMessage(
    { action: 'get' },
    function ( response ) {
      optionElements.forEach( function ( el ) {
          var value = response.state[ el.id ];
          if ( typeof value === 'boolean' ) {
              el.checked = value;
          } else {
              el.value = value;
          }

          el.addEventListener( 'change', onUpdate );
      } );

      // Remove class="hidden"
      document.body.className = '';
  } );
} );
