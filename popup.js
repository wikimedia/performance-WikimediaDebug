window.addEventListener( 'load', function () {
  'use strict';

  var $options = [].slice.call( document.querySelectorAll( '.option' ) );

  function onUpdate() {
      var state = { action: 'set' };

      $options.forEach( function ( $el ) {
          state[ $el.id ] = $el.checked !== undefined
            ? $el.checked
            : $el.value;
      } );

      chrome.runtime.sendMessage( state );
  }

  chrome.runtime.sendMessage( { action: 'get' }, function ( response ) {
      $options.forEach( function ( $el ) {
          var value = response[ $el.id ];

          if ( typeof value === 'boolean' ) {
              $el.checked = value;
          } else {
              $el.value = value;
          }

          $el.addEventListener( 'change', onUpdate, false );
      } );

      document.body.className = '';
  } );
} );
