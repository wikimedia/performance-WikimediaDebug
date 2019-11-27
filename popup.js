window.addEventListener( 'load', function () {
  'use strict';

  var optionElements = [].slice.call( document.querySelectorAll( '.option' ) );

  function onUpdate() {
      var state = { action: 'set' };

      optionElements.forEach( function ( el ) {
          state[ el.id ] = el.checked !== undefined
            ? el.checked
            : el.value;
      } );

      chrome.runtime.sendMessage( state );
  }

  chrome.runtime.sendMessage(
    { action: 'get' },
    function ( response ) {
      optionElements.forEach( function ( el ) {
          var value = response[ el.id ];
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
