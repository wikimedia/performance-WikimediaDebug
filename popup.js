window.addEventListener( 'load', function () {
  var header = document.getElementById( 'header' ),
      toggle = document.getElementById( 'toggle' );

  function onUpdate() {
      chrome.runtime.sendMessage( {
          action  : 'set',
          enabled : toggle.checked,
          value   : header.value
      } );
  }

  chrome.runtime.sendMessage( { action: 'get' }, function ( response ) {
      header.value = response.value;
      toggle.checked = response.enabled;
      toggle.addEventListener( 'change', onUpdate, false );
      header.addEventListener( 'input', onUpdate, false );
      document.body.className = '';
  } );
} );
