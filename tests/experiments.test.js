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

const test = require( 'node:test' );
const assert = require( 'node:assert' );
const {
	getActiveExperiments,
	buildExperimentsDirective,
	isValidExperimentName,
	isValidGroupName,
	serializeExperiments,
	parseExperiments
} = require( '../experiments.js' );

// A representative row from the Test Kitchen /api/v1/experiments payload.
function experiment( overrides ) {
	return Object.assign( {
		name: 'minimal-minerva-toolbar',
		groups: [ 'control', 'treatment' ],
		start: '2026-08-01T00:00:00Z',
		end: '2026-12-01T00:00:00Z'
	}, overrides );
}

const NOW = Date.parse( '2026-09-22T00:00:00Z' );

test( 'getActiveExperiments keeps experiments whose window includes now', () => {
	const result = getActiveExperiments( [ experiment() ], NOW );
	assert.deepStrictEqual( result, [
		{ name: 'minimal-minerva-toolbar', groups: [ 'control', 'treatment' ] }
	] );
} );

test( 'getActiveExperiments includes activated experiments that have not started yet', () => {
	const upcoming = experiment( { start: '2026-10-01T00:00:00Z', end: '2026-12-01T00:00:00Z' } );
	assert.deepStrictEqual( getActiveExperiments( [ upcoming ], NOW ), [
		{ name: 'minimal-minerva-toolbar', groups: [ 'control', 'treatment' ] }
	] );
} );

test( 'getActiveExperiments drops experiments that have ended', () => {
	const past = experiment( { start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z' } );
	assert.deepStrictEqual( getActiveExperiments( [ past ], NOW ), [] );
} );

test( 'getActiveExperiments includes an experiment ending exactly at now', () => {
	const atEnd = experiment( { end: '2026-09-22T00:00:00Z' } );
	assert.strictEqual( getActiveExperiments( [ atEnd ], NOW ).length, 1 );
} );

test( 'getActiveExperiments drops rows without groups', () => {
	assert.deepStrictEqual( getActiveExperiments( [ experiment( { groups: [] } ) ], NOW ), [] );
	assert.deepStrictEqual( getActiveExperiments( [ experiment( { groups: undefined } ) ], NOW ), [] );
} );

test( 'getActiveExperiments drops rows with a malformed end date', () => {
	assert.deepStrictEqual( getActiveExperiments( [ experiment( { end: 'not-a-date' } ) ], NOW ), [] );
} );

test( 'getActiveExperiments drops rows with an invalid experiment name', () => {
	// Too short for the receiver's grammar (min 8 chars).
	assert.deepStrictEqual( getActiveExperiments( [ experiment( { name: 'short' } ) ], NOW ), [] );
} );

test( 'getActiveExperiments filters out individually invalid group names', () => {
	const result = getActiveExperiments(
		[ experiment( { groups: [ 'control', 'bad group!' ] } ) ],
		NOW
	);
	assert.deepStrictEqual( result, [
		{ name: 'minimal-minerva-toolbar', groups: [ 'control' ] }
	] );
} );

test( 'getActiveExperiments tolerates non-array input', () => {
	assert.deepStrictEqual( getActiveExperiments( null, NOW ), [] );
	assert.deepStrictEqual( getActiveExperiments( undefined, NOW ), [] );
} );

test( 'buildExperimentsDirective joins pairs with commas', () => {
	const directive = buildExperimentsDirective( {
		'experiment-one': 'treatment',
		'experiment-two': 'control'
	} );
	assert.strictEqual( directive, 'experiment-one:treatment,experiment-two:control' );
} );

test( 'buildExperimentsDirective omits experiments with no selected group', () => {
	const directive = buildExperimentsDirective( {
		'experiment-one': 'treatment',
		'experiment-two': ''
	} );
	assert.strictEqual( directive, 'experiment-one:treatment' );
} );

test( 'buildExperimentsDirective returns empty string for no assignments', () => {
	assert.strictEqual( buildExperimentsDirective( {} ), '' );
	assert.strictEqual( buildExperimentsDirective( null ), '' );
	assert.strictEqual( buildExperimentsDirective( undefined ), '' );
} );

test( 'buildExperimentsDirective skips invalid experiment or group names', () => {
	const directive = buildExperimentsDirective( {
		'valid-experiment': 'treatment',
		bad: 'control',
		'another-experiment': 'bad group!'
	} );
	assert.strictEqual( directive, 'valid-experiment:treatment' );
} );

test( 'isValidExperimentName accepts the receiver grammar and rejects otherwise', () => {
	assert.strictEqual( isValidExperimentName( 'minimal-minerva-toolbar' ), true );
	assert.strictEqual( isValidExperimentName( 'short' ), false );
	assert.strictEqual( isValidExperimentName( 'has space' ), false );
	assert.strictEqual( isValidExperimentName( '' ), false );
	assert.strictEqual( isValidExperimentName( undefined ), false );
} );

test( 'isValidGroupName accepts the receiver grammar and rejects otherwise', () => {
	assert.strictEqual( isValidGroupName( 'control' ), true );
	assert.strictEqual( isValidGroupName( 'a' ), true );
	assert.strictEqual( isValidGroupName( 'bad group!' ), false );
	assert.strictEqual( isValidGroupName( '' ), false );
	assert.strictEqual( isValidGroupName( undefined ), false );
} );

test( 'serializeExperiments emits pretty JSON of valid pairs only', () => {
	const json = serializeExperiments( {
		'valid-experiment': 'treatment',
		short: 'control',
		'another-experiment': 'bad group!'
	} );
	assert.strictEqual( json, '{\n  "valid-experiment": "treatment"\n}' );
} );

test( 'serializeExperiments and parseExperiments round-trip', () => {
	const map = { 'experiment-one': 'treatment', 'experiment-two': 'control' };
	const result = parseExperiments( serializeExperiments( map ) );
	assert.strictEqual( result.ok, true );
	assert.deepStrictEqual( result.valid, map );
	assert.deepStrictEqual( result.skipped, [] );
} );

test( 'parseExperiments reports invalid JSON', () => {
	const result = parseExperiments( 'not json' );
	assert.strictEqual( result.ok, false );
	assert.strictEqual( result.error, 'Invalid JSON' );
} );

test( 'parseExperiments rejects non-object JSON', () => {
	assert.strictEqual( parseExperiments( '[1,2,3]' ).ok, false );
	assert.strictEqual( parseExperiments( '"a string"' ).ok, false );
	assert.strictEqual( parseExperiments( 'null' ).ok, false );
} );

test( 'parseExperiments keeps valid pairs and lists skipped ones', () => {
	const result = parseExperiments( JSON.stringify( {
		'valid-experiment': 'treatment',
		short: 'control',
		'another-experiment': 'bad group!'
	} ) );
	assert.strictEqual( result.ok, true );
	assert.deepStrictEqual( result.valid, { 'valid-experiment': 'treatment' } );
	assert.deepStrictEqual( result.skipped.sort(), [ 'another-experiment', 'short' ] );
} );
