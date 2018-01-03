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

import ClientRequest from '../../../src/api/ClientRequest';
import {MultiMap} from 'metal-structs';
import NodeTransport from '../../../src/api/node/NodeTransport';

describe('NodeTransport', function() {
  beforeEach(function() {
    RequestMock.setup('GET', 'http://localhost/url');
  });
  afterEach(RequestMock.teardown);

  it('should cancel send request to an url', function(done) {
    RequestMock.intercept().reply(200);
    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('http://localhost/url');
    transport
      .send(clientRequest)
      .then(function() {
        assert.fail();
      })
      .catch(function() {
        // assert that connection.abort was called as well
        done();
      })
      .cancel();
  });

  it('should send request with body', function(done) {
    RequestMock.intercept().reply(200, 'responseBody');
    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('http://localhost/url');
    clientRequest.body('requestBody');
    transport.send(clientRequest).then(function(response) {
      assert.strictEqual('requestBody', response.request().body());
      assert.strictEqual('responseBody', response.body());
      done();
    });
  });

  it('should send request with header', function(done) {
    RequestMock.intercept().reply(200);
    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('http://localhost/url');
    clientRequest.header('content-type', 'application/json');
    transport.send(clientRequest).then(function(response) {
      assert.strictEqual(
        '{"content-type":["application/json"]}',
        response
          .request()
          .headers()
          .toString()
      );
      done();
    });
  });

  it('should send request with multiple headers with same name', function(
    done
  ) {
    RequestMock.intercept().reply(200, undefined, {
      'content-type': 'application/json',
    });

    const headers = new MultiMap();
    headers.add('content-type', 'application/json');
    headers.add('content-type', 'text/html');

    const transport = new NodeTransport();
    transport
      .request('http://localhost/url', 'get', null, headers)
      .then(function() {
        done();
      });
  });

  it('should response with headers', function(done) {
    RequestMock.intercept().reply(200, undefined, {
      'content-type': 'application/json',
    });
    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('http://localhost/url');
    transport.send(clientRequest).then(function(response) {
      assert.strictEqual(
        '{"content-type":["application/json"]}',
        response.headers().toString()
      );
      done();
    });
  });

  it('should change the protocol to https in client uri when protocol was not set explicitly', function(
    done
  ) {
    RequestMock.intercept('GET', 'https://localhost/url').reply(200);
    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('localhost/url');
    transport.send(clientRequest).then(function(response) {
      assert.strictEqual('https://localhost:443/url', RequestMock.getUrl());
      done();
    });
  });

  it('should parse request query string', function(done) {
    RequestMock.intercept(
      'GET',
      'http://xyz/url?foo=1&query=1&query=%20'
    ).reply(200);
    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('http://xyz/url?foo=1');
    clientRequest.params().add('query', 1);
    clientRequest.params().add('query', ' ');
    transport
      .request(
        clientRequest.url(),
        clientRequest.method(),
        null,
        null,
        clientRequest.params(),
        null,
        false
      )
      .then(function(xhrResponse) {
        assert.strictEqual(
          xhrResponse.request.uri.href,
          'http://xyz/url?foo=1&query=1&query=%20'
        );
        done();
      });
  });

  it('should parse request query string without params', function(done) {
    RequestMock.intercept('GET', 'http://localhost/url?foo=1').reply(200);
    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('http://localhost/url?foo=1');
    transport
      .request(clientRequest.url(), clientRequest.method())
      .then(function(xhrResponse) {
        assert.strictEqual(
          'http://localhost/url?foo=1',
          xhrResponse.request.uri.href
        );
        done();
      });
  });

  it('it should be redirected if followRedirect is true', function(done) {
    RequestMock.intercept('GET', 'http://localhost/final').reply(
      200,
      'The End'
    );
    RequestMock.intercept('GET', 'http://localhost/redirected').reply(
      302,
      undefined,
      {
        Location: 'http://localhost/final',
      }
    );

    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('http://localhost/redirected');
    transport
      .request(
        clientRequest.url(),
        clientRequest.method(),
        null,
        null,
        null,
        null,
        true
      )
      .then(function(xhrResponse) {
        assert.strictEqual(xhrResponse.statusCode, 200);
        assert.strictEqual(xhrResponse.body, 'The End');
        done();
      });
  });

  it('it should return redirect url but not follow redirect if followRedirect is false', function(
    done
  ) {
    RequestMock.intercept('GET', 'http://localhost/redirected')
      .reply(302, undefined, {
        Location: 'http://localhost/final',
      })
      .intercept('GET', 'http://localhost/final')
      .reply(200, 'The End');

    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('http://localhost/redirected');
    transport
      .request(
        clientRequest.url(),
        clientRequest.method(),
        null,
        null,
        null,
        null,
        false
      )
      .then(function(xhrResponse) {
        assert.strictEqual(
          'http://localhost/final',
          xhrResponse.headers.location
        );
        assert.strictEqual(xhrResponse.body, '');
        done();
      });
  });

  it('should cancel request if given timeout is reached', function(done) {
    RequestMock.intercept('GET', 'http://localhost/url?foo=1')
      .socketDelay(5)
      .reply(200);

    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('http://localhost/url?foo=1');
    transport
      .request(clientRequest.url(), clientRequest.method(), null, null, null, 1)
      .then(function() {
        assert.fail();
      })
      .catch(function(e) {
        assert.strictEqual('ESOCKETTIMEDOUT', e.code);
        done();
      });
  });

  it('should change the protocol to https in client uri when protocol was not set explicitly', function(
    done
  ) {
    RequestMock.intercept('GET', 'https://localhost/url?foo=1').reply(200);
    const transport = new NodeTransport();
    const clientRequest = new ClientRequest();
    clientRequest.url('localhost/url?foo=1');
    transport
      .request(clientRequest.url(), clientRequest.method())
      .then(function(xhrResponse) {
        assert.strictEqual(
          'https://localhost/url?foo=1',
          xhrResponse.request.uri.href
        );
        done();
      });
  });
});
