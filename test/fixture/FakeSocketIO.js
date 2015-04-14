'use strict';

import EventEmitter from 'metaljs/src/events/EventEmitter';

var createFakeSocketIO = function() {
  class FakeSocketIO extends EventEmitter {
    constructor() {
      super();
    }
  }

  FakeSocketIO.prototype.close = function() {
    var self = this;
    clearTimeout(self.timer);
    self.timer = setTimeout(function() {
      self.emit('disconnect');
    }, 0);
  };
  FakeSocketIO.prototype.open = function() {
    var self = this;
    self.timer = setTimeout(function() {
      self.emit('connect');
    }, 0);
  };
  FakeSocketIO.prototype.send = function(message, callback) {
    var self = this;
    self.timer = setTimeout(function() {
      self.emit('message', message);
      self.timer = setTimeout(function() {
        if (callback) {
          callback(message);
        }
      }, 10);
    }, 0);
  };
  return FakeSocketIO;
};

export default createFakeSocketIO;

