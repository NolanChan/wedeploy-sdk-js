'use strict';

import { core } from 'metal';
import globals from '../globals/globals';
import Uri from 'metal-uri';

function assertBrowserEnvironment() {
	if (!globals.window) {
		throw new Error('Sign-in type not supported in this environment');
	}
}

function assertDefAndNotNull(value, errorMessage) {
	if (!core.isDefAndNotNull(value)) {
		throw new Error(errorMessage);
	}
}

function assertNotNull(value, errorMessage) {
	if (core.isNull(value)) {
		throw new Error(errorMessage);
	}
}

function assertFunction(value, errorMessage) {
	if (!core.isFunction(value)) {
		throw new Error(errorMessage);
	}
}

function assertObject(value, errorMessage) {
	if (!core.isObject(value)) {
		throw new Error(errorMessage);
	}
}

function assertResponseSucceeded(response) {
	if (!response.succeeded()) {
		throw response.body();
	}
	return response;
}

function assertUserSignedIn(user) {
	if (!core.isDefAndNotNull(user)) {
		throw new Error('You must be signed-in to perform this operation');
	}
}

function assertUriWithNoPath(url, message) {
	var uri = new Uri(url);
	if (uri.getPathname().length > 1) {
		throw new Error(message);
	}
}

export { assertBrowserEnvironment, assertDefAndNotNull, assertNotNull, assertFunction, assertObject, assertResponseSucceeded, assertUserSignedIn, assertUriWithNoPath };
