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
/* global chrome, WikimediaDebugExperiments */

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

	// Active experiment name -> its groups, used for autocomplete suggestions.
	let groupsByExperiment = {};
	let rowIdCounter = 0;

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

		message.state.experiments = collectExperiments();

		debugLog( 'Sending set-state request', message.state );
		chrome.runtime.sendMessage( message );
	}

	/**
	 * Only completed, well-formed pairs are collected. An experiment may appear
	 * once: the first row owns it, later rows with the same name are ignored.
	 *
	 * @return {Object<string,string>} Experiment name to group.
	 */
	function collectExperiments() {
		const assignments = {};
		const seen = new Set();
		document.querySelectorAll( '.experiment-row' ).forEach( ( row ) => {
			const name = row.querySelector( '.experiment-input' ).value;
			const group = row.querySelector( '.experiment-group-input' ).value;
			if ( name === '' || seen.has( name ) ) {
				return;
			}
			seen.add( name );
			if ( WikimediaDebugExperiments.isValidExperimentName( name )
				&& WikimediaDebugExperiments.isValidGroupName( group )
			) {
				assignments[ name ] = group;
			}
		} );
		return assignments;
	}

	// Re-validate every row: duplicate experiment names are relational, so a
	// change in one row can change another's validity.
	function validateAllRows() {
		const seen = new Set();
		document.querySelectorAll( '.experiment-row' ).forEach( ( row ) => {
			validateRow( row, seen );
		} );
	}

	// Flag a field that doesn't match the header grammar, or an experiment name
	// already used by an earlier row. Empty fields are incomplete, not invalid.
	function validateRow( row, seen ) {
		const expInput = row.querySelector( '.experiment-input' );
		const groupInput = row.querySelector( '.experiment-group-input' );
		const name = expInput.value;
		const badName = name !== '' && !WikimediaDebugExperiments.isValidExperimentName( name );
		const duplicate = name !== '' && seen.has( name );
		expInput.classList.toggle( 'invalid', badName || duplicate );
		groupInput.classList.toggle( 'invalid',
			groupInput.value !== '' && !WikimediaDebugExperiments.isValidGroupName( groupInput.value ) );
		row.querySelector( '.experiment-row-error' ).textContent = duplicate
			? 'Already overridden above; this row won\'t be included'
			: '';
		if ( name !== '' ) {
			seen.add( name );
		}
	}

	// Suggest the typed experiment's groups; empty for a custom experiment.
	function updateGroupSuggestions( row ) {
		const expInput = row.querySelector( '.experiment-input' );
		const groupList = row.querySelector( 'datalist' );
		groupList.innerHTML = '';
		( groupsByExperiment[ expInput.value ] || [] ).forEach( ( group ) => {
			groupList.appendChild( dom( 'option', { value: group } ) );
		} );
	}

	function addExperimentRow( name = '', group = '' ) {
		const groupListId = 'experiment-groups-' + ( rowIdCounter++ );

		const expInput = dom( 'input', {
			type: 'text', className: 'experiment-input', placeholder: 'experiment', value: name
		} );
		expInput.setAttribute( 'list', 'experiment-names' );

		const groupInput = dom( 'input', {
			type: 'text', className: 'experiment-group-input', placeholder: 'group', value: group
		} );
		groupInput.setAttribute( 'list', groupListId );

		const groupList = dom( 'datalist', { id: groupListId } );
		const removeButton = dom( 'button', {
			type: 'button', className: 'experiment-remove', title: 'Remove'
		}, '✕' );
		const errorEl = dom( 'span', { className: 'experiment-row-error' } );

		const row = dom( 'div', { className: 'experiment-row' },
			expInput, groupInput, groupList, removeButton, errorEl );

		expInput.addEventListener( 'input', () => {
			validateAllRows();
			updateGroupSuggestions( row );
		} );
		groupInput.addEventListener( 'input', () => validateAllRows() );
		expInput.addEventListener( 'change', onUpdate );
		groupInput.addEventListener( 'change', onUpdate );
		removeButton.addEventListener( 'click', () => {
			row.remove();
			validateAllRows();
			onUpdate();
		} );

		document.querySelector( '.experiments-list' ).append( row );
		updateGroupSuggestions( row );
	}

	// Load active experiments as autocomplete suggestions.
	function populateExperimentSuggestions( experiments ) {
		const nameList = document.querySelector( '#experiment-names' );
		groupsByExperiment = {};
		nameList.innerHTML = '';
		( experiments || [] ).forEach( ( experiment ) => {
			groupsByExperiment[ experiment.name ] = experiment.groups;
			nameList.appendChild( dom( 'option', { value: experiment.name } ) );
		} );
	}

	// Replace the rows with one per saved pair, or a single empty row.
	function renderExperimentRows( selected ) {
		document.querySelector( '.experiments-list' ).innerHTML = '';
		const names = Object.keys( selected || {} );
		if ( names.length ) {
			names.forEach( ( name ) => addExperimentRow( name, selected[ name ] ) );
		} else {
			addExperimentRow();
		}
		validateAllRows();
	}

	function showExperimentStatus( message ) {
		document.querySelector( '.experiments-status' ).textContent = message;
	}

	function exportExperiments() {
		const json = WikimediaDebugExperiments.serializeExperiments( collectExperiments() );
		navigator.clipboard.writeText( json ).then(
			() => showExperimentStatus( 'Copied to clipboard' ),
			() => showExperimentStatus( 'Copy failed' )
		);
	}

	function applyImport() {
		const input = document.querySelector( '.experiments-import-input' );
		const result = WikimediaDebugExperiments.parseExperiments( input.value );
		if ( !result.ok ) {
			showExperimentStatus( result.error );
			return;
		}
		// Import replaces the current rows.
		renderExperimentRows( result.valid );
		onUpdate();
		document.querySelector( '.experiments-import' ).hidden = true;
		input.value = '';
		const imported = Object.keys( result.valid ).length;
		showExperimentStatus( result.skipped.length
			? `Imported ${ imported }, skipped ${ result.skipped.length } invalid`
			: `Imported ${ imported }` );
	}

	function wireExperimentControls() {
		const section = document.querySelector( '.experiments' );
		const importPanel = section.querySelector( '.experiments-import' );
		section.querySelector( '.experiments-add' ).addEventListener( 'click', () => addExperimentRow() );
		section.querySelector( '.experiments-export' ).addEventListener( 'click', exportExperiments );
		section.querySelector( '.experiments-import-toggle' ).addEventListener( 'click', () => {
			importPanel.hidden = !importPanel.hidden;
		} );
		section.querySelector( '.experiments-import-apply' ).addEventListener( 'click', applyImport );
		section.querySelector( '.experiments-import-cancel' ).addEventListener( 'click', () => {
			importPanel.hidden = true;
			section.querySelector( '.experiments-import-input' ).value = '';
			showExperimentStatus( '' );
		} );
		section.hidden = false;
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

	populateExperimentSuggestions( response.experiments );
	renderExperimentRows( response.state.experiments );
	wireExperimentControls();

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
