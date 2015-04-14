'use strict';

import createFakeSocketIO from '../fixture/FakeSocketIO';
import WebSocketTransport from '../../src/net/WebSocketTransport';

var FakeSocketIO = createFakeSocketIO();

describe('WebSocketTransport', function() {
  beforeEach(function() {
    window.io = function() {
      return new FakeSocketIO();
    };
  });

  it('should set uri from constructor', function() {
    var transport = new WebSocketTransport('http://liferay.com');
    assert.strictEqual('http://liferay.com', transport.getUri(), 'Should set uri from constructor');
  });

  it('should throw error when Socket.IO not found', function() {
    var transport = new WebSocketTransport('http://liferay.com');
    window.io = null;
    assert.throws(function() {
      transport.open();
    }, Error);
  });

  it('should connection open', function(done) {
    var transport = new WebSocketTransport('http://liferay.com');
    var stubOpen = sinon.stub();
    transport.on('open', stubOpen);
    transport.open();
    assert.strictEqual(0, stubOpen.callCount, 'Should open be asynchronous');
    transport.on('open', function() {
      assert.strictEqual(1, stubOpen.callCount);
      done();
    });
  });

  it('should connection warn when open multiple times', function(done) {
    var originalWarningFn = console.warn;
    console.warn = sinon.stub();

    var transport = new WebSocketTransport('http://liferay.com');
    var stubOpen = sinon.stub();
    transport.on('open', stubOpen);
    transport.open();
    transport.open();
    transport.open();
    assert.strictEqual(0, stubOpen.callCount, 'Should open be asynchronous');
    transport.on('open', function() {
      assert.strictEqual(2, console.warn.callCount, 'Should warn when open');
      assert.strictEqual(1, stubOpen.callCount, 'Should not emit open twice');

      console.warn = originalWarningFn;
      done();
    });
  });

  it('should connection reopen without warn', function(done) {
    var originalWarningFn = console.warn;
    console.warn = sinon.stub();

    var transport = new WebSocketTransport('http://liferay.com');
    transport.close();

    var stubClose = sinon.stub();
    var stubOpen = sinon.stub();
    transport.on('close', stubClose);
    transport.on('open', stubOpen);

    transport.open();
    assert.strictEqual(0, stubOpen.callCount, 'Should open be asynchronous');
    transport.once('open', function() {
      assert.strictEqual(1, stubOpen.callCount);
      transport.close();
      assert.strictEqual(0, stubClose.callCount, 'Should close be asynchronous');
      transport.once('close', function() {
        assert.strictEqual(1, stubClose.callCount);
        transport.open();
        assert.strictEqual(1, stubOpen.callCount, 'Should open be asynchronous');
        transport.once('open', function() {
          assert.strictEqual(2, stubOpen.callCount, 'Should emit open twice');
          assert.strictEqual(1, stubClose.callCount, 'Should not emit close twice');
          assert.strictEqual(0, console.warn.callCount, 'Should warn when open');

          console.warn = originalWarningFn;
          done();
        });
      });
    });
  });

  it('should handle successful send message', function(done) {
    var transport = new WebSocketTransport('http://liferay.com');
    transport.open();
    transport.on('open', function() {
      transport.on('message', function(data) {
        assert.strictEqual('message', data, 'Should set request message');
        done();
      });
      transport.send('message');
    });
  });

  it('should handle successful restful send message', function(done) {
    var transport = new WebSocketTransport('http://liferay.com');
    transport.setRestful(true);
    transport.open();
    transport.on('open', function() {
      transport.on('message', function(data) {
        assert.strictEqual('POST', data.method);
        assert.strictEqual('message', data.data);
        done();
      });
      transport.send('message');
    });
  });

  it('should handle successful restful send message with method', function(done) {
    var transport = new WebSocketTransport('http://liferay.com');
    transport.setRestful(true);
    transport.open();
    transport.on('open', function() {
      transport.on('message', function(data) {
        assert.strictEqual('GET', data.method);
        assert.strictEqual('message', data.data);
        done();
      });
      transport.send('message', {
        method: 'GET'
      });
    });
  });

  it('should handle successful receive data', function(done) {
    var transport = new WebSocketTransport('http://liferay.com');
    var stubData = sinon.stub();
    transport.on('data', stubData);
    transport.open();
    transport.on('open', function() {
      transport.socket.on('data', function() {
        assert.strictEqual('data', stubData.getCall(0).args[0], 'Should receive emitted data');
        done();
      });
      transport.socket.emit('data', 'data');
    });
  });

  it('should handle successful response data', function(done) {
    var transport = new WebSocketTransport('http://liferay.com');
    transport.open();
    transport.on('open', function() {
      transport.send('message', {}, function(data) {
        assert.strictEqual('message', data);
        done();
      });
    });
  });

  it('should handle failing send data', function(done) {
    var transport = new WebSocketTransport('http://liferay.com');
    var stubError = sinon.stub();
    transport.on('error', stubError);
    transport.open();
    transport.on('open', function() {
      transport.socket.on('error', function() {
        var error = stubError.getCall(0).args[0].error;
        assert.ok(error instanceof Error);
        assert.ok(error.socket instanceof FakeSocketIO);
        assert.strictEqual('reason', error.message);
        done();
      });
      transport.socket.emit('error', 'reason');
    });
  });

  it('should abort requests when disposed', function(done) {
    var transport = new WebSocketTransport('http://liferay.com');
    transport.open();
    transport.on('open', function() {
      transport.send();
      transport.dispose();
      transport.on('close', function() {
        done();
      });
    });
  });

  it('should listen to socket events', function() {
    var transport = new WebSocketTransport('http://liferay.com');
    transport.open();

    var listener = sinon.stub();
    transport.on('chat message', listener);
    transport.on('chat message', listener);

    var data = {};
    transport.socket.emit('chat message', data);
    assert.strictEqual(2, listener.callCount);
    assert.strictEqual(data, listener.args[0][0]);
    assert.strictEqual(data, listener.args[1][0]);
  });
});
