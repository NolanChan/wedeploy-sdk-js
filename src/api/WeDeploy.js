/**
* Copyright (c) 2000-present Liferay, Inc. All rights reserved.
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice,
* this list of conditions and the following disclaimer.
*
* 2. Redistributions in binary form must reproduce the above copyright notice,
* this list of conditions and the following disclaimer in the documentation
* and/or other materials provided with the distribution.
*
* 3. Neither the name of Liferay, Inc. nor the names of its contributors may
* be used to endorse or promote products derived from this software without
* specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
* AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
* IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
* ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
* LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
* CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
* SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
* INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
* CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
* ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
* POSSIBILITY OF SUCH DAMAGE.
*/

'use strict';

import SocketIo from 'socket.io-client';
import globals from '../globals/globals';
import {core} from 'metal';
import Auth from './auth/Auth';
import AuthApiHelper from './auth/AuthApiHelper';
import DataApiHelper from './data/DataApiHelper';
import EmailApiHelper from './email/EmailApiHelper';
import Base64 from '../crypt/Base64';
import Embodied from '../api-query/Embodied';
import Query from '../api-query/Query';
import Filter from '../api-query/Filter';
import TransportFactory from './TransportFactory';
import ClientRequest from './ClientRequest';
import {MultiMap} from 'metal-structs';
import Uri from 'metal-uri';
import {assertDefAndNotNull, assertUriWithNoPath} from './assertions';

let io = SocketIo;
let FormDataImpl;

// Optimistic initialization of `FormData` reference from global
// `globals.window.FormData`.
if (typeof globals.window !== 'undefined') {
  FormDataImpl = globals.window.FormData;
}

/**
 * The main class for making api requests. Sending requests returns a promise
 * that is resolved when the response arrives. Usage example:
 * ```javascript
 * WeDeploy
 *   .url('/data/tasks')
 *   .post({desc: 'Buy milk'})
 *   .then(function(response) {
 *     // Handle response here.
 *     console.log(response.body())
 *   });
 * ```
 */
class WeDeploy {
  /**
	 * WeDeploy constructor function.
	 * @param {string} url The base url.
	 * @param {...string} paths Any amount of paths to be appended to the base
	 * url.
	 * @constructor
	 */
  constructor(url, ...paths) {
    if (arguments.length === 0) {
      throw new Error('Invalid arguments, try `new WeDeploy(baseUrl, url)`');
    }

    this.auth_ = null;
    this.body_ = null;
    this.url_ = Uri.joinPaths(url || '', ...paths);
    this.headers_ = new MultiMap();
    this.params_ = new MultiMap();
    this.withCredentials_ = false;
    this.followRedirect_ = true;

    this.header('Content-Type', 'application/json');
    this.header('X-Requested-With', 'XMLHttpRequest');
  }

  /**
	 * Static factory for creating WeDeploy data for the given url.
	 * @param {string=} dataUrl The url that points to the data services.
	 * @return {!DataApiHelper} Returns an {@link DataApiHelper} instance.
	 */
  static data(dataUrl) {
    assertDefAndNotNull(dataUrl, 'The data url should be provided');
    assertUriWithNoPath(dataUrl, 'The data url should not have a path');

    return new DataApiHelper(WeDeploy, dataUrl);
  }

  /**
	 * Static factory for creating WeDeploy email for the given url.
	 * @param {string=} emailUrl The url that points to the email services.
	 * @return {!EmailApiHelper} Returns an {@link EmailApiHelper} instance.
	 */
  static email(emailUrl) {
    assertDefAndNotNull(emailUrl, 'The email url should be provided');
    assertUriWithNoPath(emailUrl, 'The email url should not have a path');

    return new EmailApiHelper(WeDeploy, emailUrl);
  }

  /**
	 * Static factory for creating WeDeploy auth for the given url.
	 * @param {string=} authUrl The url that points to the auth service.
	 * @return {!AuthApiHelper} Returns an {@link AuthApiHelper} instance.
	 */
  static auth(authUrl) {
    assertDefAndNotNull(authUrl, 'The auth url should be provided');
    assertUriWithNoPath(authUrl, 'The auth url should not have a path');

    return new AuthApiHelper(WeDeploy, authUrl);
  }

  /**
	 * Adds authorization information to this request.
	 * @param {!Auth|string} authOrTokenOrEmail Either an {@link Auth} instance,
	 * an authorization token, or the email.
	 * @param {string=} opt_password If a email is given as the first param,
	 * this should be the password.
	 * @return {WeDeploy} Returns the {@link WeDeploy} object itself, so calls can
	 *   be chained.
	 * @chainable
	 */
  auth(authOrTokenOrEmail, opt_password) {
    this.auth_ = Auth.create(authOrTokenOrEmail, opt_password);
    this.auth_.setWedeployClient(WeDeploy);
    return this;
  }

  /**
	 * Sets the body that will be sent with this request.
	 * @param {*} body
	 * @return {WeDeploy} Returns the {@link WeDeploy} object itself, so calls can
	 *   be chained.
	 * @chainable
	 */
  body(body) {
    this.body_ = body;
    return this;
  }

  /**
	 * Converts the given body object to query params.
	 * @param {!ClientRequest} clientRequest Client request.
	 * @param {*} body
	 * @protected
	 */
  convertBodyToParams_(clientRequest, body) {
    if (core.isString(body)) {
      body = {
        body: body,
      };
    } else if (body instanceof Embodied) {
      body = body.body();
    }
    Object.keys(body || {}).forEach(name =>
      clientRequest.param(name, body[name])
    );
  }

  /**
	 * Creates client request and encode.
	 * @param {string} method
	 * @param {*} body
	 * @return {!ClientRequest} Client request.
	 * @protected
	 */
  createClientRequest_(method, body) {
    const clientRequest = new ClientRequest();

    clientRequest.body(body || this.body_);

    if (!core.isDefAndNotNull(clientRequest.body())) {
      if (this.formData_) {
        clientRequest.body(this.formData_);
      }
    }

    clientRequest.method(method);
    clientRequest.headers(this.headers());
    clientRequest.params(this.params());
    clientRequest.url(this.url());
    clientRequest.withCredentials(this.withCredentials_);
    clientRequest.followRedirect(this.followRedirect_);

    this.encode(clientRequest);

    return clientRequest;
  }

  /**
	 * Decodes clientResponse body, parsing the body for example.
	 * @param {!ClientResponse} clientResponse The response object to be
	 * decoded.
	 * @return {!ClientResponse} The decoded response.
	 */
  decode(clientResponse) {
    if (WeDeploy.isContentTypeJson(clientResponse)) {
      try {
        clientResponse.body(JSON.parse(clientResponse.body()));
      } catch (err) {}
    }
    return clientResponse;
  }

  /**
	 * Sends message with the DELETE http verb.
	 * @param {string=} opt_body Content to be sent as the request's body.
	 * @return {!CancellablePromise}
	 */
  delete(opt_body) {
    return this.sendAsync('DELETE', opt_body);
  }

  /**
	 * Encodes the given {@link ClientRequest}, converting its body to an
	 * appropriate format for example.
	 * @param {!ClientRequest} clientRequest The request object to encode.
	 * @return {!ClientRequest} The encoded request.
	 */
  encode(clientRequest) {
    let body = clientRequest.body();

    if (core.isElement(body)) {
      body = new FormDataImpl(body);
      clientRequest.body(body);
    }

    body = this.maybeWrapWithQuery_(body);
    if (clientRequest.method() === 'GET') {
      this.convertBodyToParams_(clientRequest, body);
      clientRequest.removeBody();
      body = null;
    }

    if (typeof FormDataImpl !== 'undefined' && body instanceof FormDataImpl) {
      clientRequest.headers().remove('content-type');
    } else if (body instanceof Embodied) {
      clientRequest.body(body.toString());
    } else if (WeDeploy.isContentTypeJson(clientRequest)) {
      let body = clientRequest.body();
      if (core.isDefAndNotNull(body)) {
        body = JSON.stringify(body);
        clientRequest.body(body);
      }
    }

    this.encodeParams_(clientRequest);
    this.resolveAuthentication_(clientRequest);

    return clientRequest;
  }

  /**
	 * Encodes the params for the given request, according to their types.
	 * @param {!ClientRequest} clientRequest
	 * @protected
	 */
  encodeParams_(clientRequest) {
    let params = clientRequest.params();
    params.names().forEach(function(name) {
      let values = params.getAll(name);
      values.forEach(function(value, index) {
        if (value instanceof Embodied) {
          value = value.toString();
        } else if (core.isObject(value) || value instanceof Array) {
          value = JSON.stringify(value);
        }
        values[index] = value;
      });
    });
  }

  /**
	 * Adds a key/value pair to be sent via the body in a `multipart/form-data`
	 * format.
	 * If the body is set by other means (for example, through the `body` method),
	 * this will be ignored.
	 * @param {string} name
	 * @param {*} value
	 * @return {WeDeploy} Returns the {@link WeDeploy} object itself, so calls can
	 *   be chained.
	 * @chainable
	 */
  form(name, value) {
    if (typeof FormDataImpl === 'undefined') {
      throw new Error(
        'form() is only available when FormData API is available.'
      );
    }

    if (!this.formData_) {
      this.formData_ = new FormDataImpl();
    }
    this.formData_.append(name, value);
    return this;
  }

  /**
	 * Sends message with the GET http verb.
	 * @param {*=} opt_params Params to be added to the request url.
	 * @return {!CancellablePromise}
	 */
  get(opt_params) {
    return this.sendAsync('GET', opt_params);
  }

  /**
	 * Adds a header. If the header with the same name already exists, it will
	 * not be overwritten, but new value will be stored. The order is preserved.
	 * @param {string} name Header key.
	 * @param {*} value Header value.
	 * @return {WeDeploy} Returns the {@link WeDeploy} object itself, so calls can
	 *   be chained.
	 * @chainable
	 */
  header(name, value) {
    if (arguments.length !== 2) {
      throw new Error('Invalid arguments');
    }
    this.headers_.set(name, value);
    return this;
  }

  /**
	 * Gets or sets the headers. If headers are passed to the function as
	 * parameter, they will be set as internal headers, overwriting the existing
	 * ones. Otherwise, the currently set headers will be returned.
	 * @param {MultiMap|Object=} opt_headers Headers to be set
	 * @return {WeDeploy|MultiMap} If headers were passed to te function,
	 *   the returned result will be the {@link WeDeploy} object itself, so calls
	 *   can be chained. If headers were not passed to the function, the returned
	 *   result will be the current headers.
	 * @chainable Chainable when used as setter.
	 */
  headers(opt_headers) {
    if (core.isDefAndNotNull(opt_headers)) {
      if (!(opt_headers instanceof MultiMap)) {
        opt_headers = MultiMap.fromObject(opt_headers);
      }

      opt_headers.names().forEach(name => {
        const values = opt_headers.getAll(name);

        values.forEach(value => {
          this.headers_.set(name, value);
        });
      });

      return this;
    } else {
      return this.headers_;
    }
  }

  /**
	 * Check if clientMessage content type is application/json.
	 * @param {ClientMessage} clientMessage Client message.
	 * @return {boolean}
	 */
  static isContentTypeJson(clientMessage) {
    const contentType = clientMessage.headers().get('content-type') || '';
    return contentType.indexOf('application/json') === 0;
  }

  /**
	 * Wraps the given `Embodied` instance with a {@link Query} instance if
	 * needed.
	 * @param {Embodied} embodied
	 * @return {Embodied}
	 * @protected
	 */
  maybeWrapWithQuery_(embodied) {
    if (embodied instanceof Filter) {
      embodied = Query.filter(embodied);
    }
    return embodied;
  }

  /**
	 * Adds a query. If the query with the same name already exists, it will not
	 * be overwritten, but new value will be stored. The order is preserved.
	 * @param {string} name Param key.
	 * @param {*} value Param value.
	 * @return {WeDeploy} Returns the {@link WeDeploy} object itself, so calls can
	 *   be chained.
	 * @chainable
	 */
  param(name, value) {
    if (arguments.length !== 2) {
      throw new Error('Invalid arguments');
    }
    this.params_.set(name, value);
    return this;
  }

  /**
	 * Gets the query strings map.
	 * @return {!MultiMap}
	 */
  params() {
    return this.params_;
  }

  /**
	 * Sends message with the PATCH http verb.
	 * @param {string=} opt_body Content to be sent as the request's body.
	 * @return {!CancellablePromise}
	 */
  patch(opt_body) {
    return this.sendAsync('PATCH', opt_body);
  }

  /**
	 * Creates a new {@link WeDeploy} instance for handling the url resulting in
	 * the union of the current url with the given paths.
	 * @param {...string} paths Any number of paths.
	 * @return {!WeDeploy} A new {@link WeDeploy} instance for handling the given
	 *   paths.
	 */
  path(...paths) {
    let wedeployClient = new WeDeploy(this.url(), ...paths);

    if (core.isDefAndNotNull(this.auth_)) {
      wedeployClient.auth(this.auth_);
    }

    wedeployClient.headers(this.headers_);
    wedeployClient.withCredentials(this.withCredentials_);

    return wedeployClient.use(this.customTransport_);
  }

  /**
	 * Sends message with the POST http verb.
	 * @param {string=} opt_body Content to be sent as the request's body.
	 * @return {!CancellablePromise}
	 */
  post(opt_body) {
    return this.sendAsync('POST', opt_body);
  }

  /**
	 * Sends message with the PUT http verb.
	 * @param {string=} opt_body Content to be sent as the request's body.
	 * @return {!CancellablePromise}
	 */
  put(opt_body) {
    return this.sendAsync('PUT', opt_body);
  }

  /**
	 * Adds the authentication information to the request.
	 * @param {!ClientRequest} clientRequest
	 * @protected
	 */
  resolveAuthentication_(clientRequest) {
    if (!this.auth_) {
      return;
    }
    if (this.auth_.hasToken()) {
      clientRequest.header('Authorization', 'Bearer ' + this.auth_.token);
    } else if (this.auth_.hasEmail() && this.auth_.hasPassword()) {
      const credentials = this.auth_.email + ':' + this.auth_.password;
      clientRequest.header(
        'Authorization',
        'Basic ' + Base64.encodeString(credentials)
      );
    }
  }

  /**
	 * Uses transport to send request with given method name and body
	 * asynchronously.
	 * @param {string} method The HTTP method to be used when sending data.
	 * @param {string} body Content to be sent as the request's body.
	 * @return {!CancellablePromise} Deferred request.
	 */
  sendAsync(method, body) {
    const transport =
      this.customTransport_ || TransportFactory.instance().getDefault();

    const clientRequest = this.createClientRequest_(method, body);

    return transport.send(clientRequest).then(this.decode);
  }

  /**
	 * Sets the socket transport
	 * @param {Object} socket implementation object.
	 */
  static socket(socket) {
    io = socket;
  }

  /**
	 * Sets the FormData
	 * @param {Object} formData implementation object.
	 */
  static formData(formData) {
    FormDataImpl = formData;
  }

  /**
	 * Static factory for creating WeDeploy client for the given url.
	 * @param {string} url The url that the client should use for sending
	 *   requests.
	 * @return {WeDeploy} Returns the {@link WeDeploy} object itself, so calls can
	 *   be chained.
	 */
  static url(url) {
    return new WeDeploy(url).use(this.customTransport_);
  }

  /**
	 * Returns the URL used by this client.
	 * @return {!string}
	 */
  url() {
    return this.url_;
  }

  /**
   * Indicate whether or not to follow redirects.
   * @param {!boolean} followRedirect
   * @return {WeDeploy} Returns the {@link WeDeploy} object itself, so calls can
	 *   be chained.
   */
  followRedirect(followRedirect) {
    this.followRedirect_ = followRedirect;
    return this;
  }

  /**
	 * Specifies {@link Transport} implementation.
	 * @param {!Transport} transport The transport implementation that should be
	 * used.
	 * @return {WeDeploy} Returns the {@link WeDeploy} object itself, so calls can
	 *   be chained.
	 */
  use(transport) {
    this.customTransport_ = transport;
    return this;
  }

  /**
	 * Creates new socket.io instance. The parameters passed to socket.io
	 * constructor will be provided:
	 *
	 * ```javascript
	 * WeDeploy.url('http://domain:8080/path/a').watch({id: 'myId'}, {foo: true});
	 * // Equals:
	 * io('domain:8080/?url=path%2Fa%3Fid%3DmyId', {foo: true});
	 * ```
	 *
	 * @param {Object=} opt_params Params to be sent with the Socket IO request.
	 * @param {Object=} opt_options Object with Socket IO options.
	 * @return {!io} Socket IO reference. Server events can be listened on it.
	 */
  watch(opt_params, opt_options) {
    if (typeof io === 'undefined') {
      throw new Error('Socket.io client not loaded');
    }

    const clientRequest = this.createClientRequest_('GET', opt_params);
    const uri = new Uri(clientRequest.url());
    uri.addParametersFromMultiMap(clientRequest.params());

    const jsonp =
      typeof navigator === 'undefined' || navigator.product !== 'ReactNative';

    opt_options = opt_options || {
      forceNew: true,
      jsonp: jsonp,
    };
    opt_options.query =
      'url=' + encodeURIComponent(uri.getPathname() + uri.getSearch());
    opt_options.path = opt_options.path || uri.getPathname();
    opt_options = this.resolveTransportOptions_(opt_options);

    if (uri.isUsingDefaultProtocol()) {
      uri.setProtocol('https:');
    }

    return io(uri.getProtocol() + '//' + uri.getHost(), opt_options);
  }

  /**
   * Resolves the polling options object by adding Authorization header if the
   *   current auth object has token, or it has both email and password.
   * @param {!Object} options The object where transport options should be added
   * @return {Object} Returns the modified options object
   */
  resolveTransportOptions_(options) {
    if (!this.auth_) {
      return options;
    }

    if (this.auth_.hasToken()) {
      options.transportOptions = {
        polling: {
          extraHeaders: {
            Authorization: `Bearer ${this.auth_.getToken()}`,
          },
        },
      };
    } else if (this.auth_.hasEmail() && this.auth_.hasPassword()) {
      const credentials =
        this.auth_.getEmail() + ':' + this.auth_.getPassword();
      options.transportOptions = {
        polling: {
          extraHeaders: {
            Authorization: `Basic ${Base64.encodeString(credentials)}`,
          },
        },
      };
    }

    return options;
  }

  /**
	 * Assigns the passed value to the internal with credentials option.
	 * @param {boolean} withCredentials
	 * @return {WeDeploy} Returns the {@link WeDeploy} object itself, so calls can
	 *   be chained.
	 */
  withCredentials(withCredentials) {
    this.withCredentials_ = !!withCredentials;
    return this;
  }
}

export default WeDeploy;
