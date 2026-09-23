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
/* eslint-env browser, serviceworker, node */
'use strict';

// Pure helpers for the Test Kitchen experiment override feature, shared by the
// service worker and the Node test suite. No browser or extension APIs here.
( function ( global ) {

	// Grammar enforced by the receiving TestKitchen extension; kept in sync so
	// we never emit a pair the server will reject.
	const EXPERIMENT_NAME_RE = /^[A-Za-z0-9][-_.A-Za-z0-9]{7,62}$/;
	const GROUP_NAME_RE = /^[A-Za-z0-9][-_.A-Za-z0-9]{0,62}$/;

	/**
	 * Reduce the raw Test Kitchen payload to the selectable experiments, i.e.
	 * those not yet ended. The API already excludes fully-past experiments and
	 * includes activated-but-not-yet-started ones (which are worth previewing);
	 * the only client-side guard is dropping experiments that ended while the
	 * payload sat in the cache.
	 *
	 * @param {Array} experiments Raw array from the Test Kitchen API.
	 * @param {number} now Milliseconds since the epoch.
	 * @return {Array<{name: string, groups: string[]}>}
	 */
	function getActiveExperiments( experiments, now ) {
		if ( !Array.isArray( experiments ) ) {
			return [];
		}
		return experiments
			.filter( ( exp ) => {
				if ( !exp || !EXPERIMENT_NAME_RE.test( exp.name ) ) {
					return false;
				}
				if ( !Array.isArray( exp.groups )
					|| !exp.groups.some( ( group ) => GROUP_NAME_RE.test( group ) )
				) {
					return false;
				}
				const end = Date.parse( exp.end );
				if ( Number.isNaN( end ) ) {
					return false;
				}
				return now <= end;
			} )
			.map( ( exp ) => ( {
				name: exp.name,
				groups: exp.groups.filter( ( group ) => GROUP_NAME_RE.test( group ) )
			} ) );
	}

	/**
	 * Encode assignments as the header's `experiments` directive value. Pairs
	 * are comma-separated to match the receiver, which splits the value by ",".
	 * Invalid names/groups are skipped rather than poisoning the whole directive.
	 *
	 * @param {Object<string,string>} assignments Experiment name to group name.
	 * @return {string} e.g. "exp-one:treatment,exp-two:control" (empty if none).
	 */
	function buildExperimentsDirective( assignments ) {
		if ( !assignments || typeof assignments !== 'object' ) {
			return '';
		}
		const pairs = [];
		for ( const name of Object.keys( assignments ) ) {
			const group = assignments[ name ];
			if ( isValidExperimentName( name ) && isValidGroupName( group ) ) {
				pairs.push( name + ':' + group );
			}
		}
		return pairs.join( ',' );
	}

	/**
	 * @param {string} name
	 * @return {boolean}
	 */
	function isValidExperimentName( name ) {
		return typeof name === 'string' && EXPERIMENT_NAME_RE.test( name );
	}

	/**
	 * @param {string} group
	 * @return {boolean}
	 */
	function isValidGroupName( group ) {
		return typeof group === 'string' && GROUP_NAME_RE.test( group );
	}

	/**
	 * @param {Object<string,string>} assignments Experiment name to group name.
	 * @return {string} Pretty JSON of the valid pairs.
	 */
	function serializeExperiments( assignments ) {
		const clean = {};
		if ( assignments && typeof assignments === 'object' ) {
			for ( const name of Object.keys( assignments ) ) {
				const group = assignments[ name ];
				if ( isValidExperimentName( name ) && isValidGroupName( group ) ) {
					clean[ name ] = group;
				}
			}
		}
		return JSON.stringify( clean, null, 2 );
	}

	/**
	 * Parse a JSON object of experiment:group pairs, keeping only valid ones.
	 *
	 * @param {string} json
	 * @return {{ok: boolean, valid: Object<string,string>, skipped: string[], error: string}}
	 */
	function parseExperiments( json ) {
		let data;
		try {
			data = JSON.parse( json );
		} catch ( e ) {
			return { ok: false, valid: {}, skipped: [], error: 'Invalid JSON' };
		}
		if ( !data || typeof data !== 'object' || Array.isArray( data ) ) {
			return { ok: false, valid: {}, skipped: [], error: 'Expected a JSON object of experiment:group pairs' };
		}
		const valid = {};
		const skipped = [];
		for ( const name of Object.keys( data ) ) {
			const group = data[ name ];
			if ( isValidExperimentName( name ) && isValidGroupName( group ) ) {
				valid[ name ] = group;
			} else {
				skipped.push( name );
			}
		}
		return { ok: true, valid, skipped, error: '' };
	}

	const api = {
		getActiveExperiments,
		buildExperimentsDirective,
		isValidExperimentName,
		isValidGroupName,
		serializeExperiments,
		parseExperiments
	};

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = api;
	} else {
		global.WikimediaDebugExperiments = api;
	}

}( typeof self !== 'undefined' ? self : this ) );
