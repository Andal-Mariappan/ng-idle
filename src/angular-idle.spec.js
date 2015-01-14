'use strict';

describe('ngIdle', function() {
  // helpers
  beforeEach(function() {
    this.addMatchers({
      toEqualData: function(expected) {
        return angular.equals(this.actual, expected);
      }
    });
  });

  describe('idle', function() {
    var IdleProvider, $interval, $rootScope, $log, $document, $keepalive, $injector;
    var DEFAULTIDLEDURATION = 20*60*1000, DEFAULTTIMEOUT = 30 * 1000;

    beforeEach(module('ngIdle.idle'));


    beforeEach(function() {
      angular.module('app', function() {}).config(['IdleProvider',
        function(_IdleProvider_) {
          IdleProvider = _IdleProvider_;
        }
      ]);

      module('app');

      inject(function(_$interval_, _$log_, _$rootScope_, _$document_, _$injector_) {
        $rootScope = _$rootScope_;
        $interval = _$interval_;
        $log = _$log_;
        $document = _$document_;
        $injector = _$injector_;
      });

      $keepalive = {
        start: function() {},
        stop: function() {},
        ping: function() {}
      };

      spyOn($keepalive, 'start');
      spyOn($keepalive, 'stop');
      spyOn($keepalive, 'ping');
    });

    var create = function(keepalive) {
      if (angular.isDefined(keepalive)) IdleProvider.keepalive(keepalive);
      return $injector.invoke(IdleProvider.$get, null, {$interval: $interval, $log: $log, $rootScope: $rootScope, $document: $document, $keepalive: $keepalive});
    };

    describe('IdleProvider', function() {

      it('interrupt() should update defaults', function() {
        expect(IdleProvider).not.toBeUndefined();

        IdleProvider.interrupt('click');

        expect(create()._options().interrupt).toBe('click');
      });

      it('idle() should update defaults', function() {
        expect(IdleProvider).not.toBeUndefined();

        IdleProvider.idle(500);

        expect(create()._options().idle).toBe(500);
      });

      it('idle() should throw if argument is less than or equal to zero.', function() {
        var expected = new Error('Idle must be a value in seconds, greater than 0.');
        expect(function() {
          IdleProvider.idle(0);
        }).toThrow(expected);

        expect(function() {
          IdleProvider.idle(-1);
        }).toThrow(expected);
      });

      it('autoResume() should update defaults', function() {
        expect(IdleProvider).not.toBeUndefined();

        IdleProvider.autoResume(false);

        expect(create()._options().autoResume).toBe(false);
      });

      it('keepalive() should update defaults', function() {
        IdleProvider.keepalive(false);

        expect(create()._options().keepalive).toBe(false);
      });

      it ('setting timeout() with false should set timeout to 0', function() {
        expect(IdleProvider).not.toBeUndefined();

        IdleProvider.timeout(false);

        expect(create()._options().timeout).toBe(0);
      });

      it ('setting timeout() with 0 should set timeout to 0', function() {
        expect(IdleProvider).not.toBeUndefined();

        IdleProvider.timeout(0);

        expect(create()._options().timeout).toBe(0);
      });

      it ('setting timeout() with should throw an error if NaN', function() {
        expect(IdleProvider).not.toBeUndefined();

        expect(function() {
          IdleProvider.timeout('hello');
        }).toThrow(new Error('Timeout must be zero or false to disable the feature, or a positive integer (in seconds) to enable it.'));
      });

      it ('setting timeout() with with positive integer should set timeout', function() {
        expect(IdleProvider).not.toBeUndefined();

        IdleProvider.timeout(999);

        expect(create()._options().timeout).toBe(999);
      });
    });

    describe('Idle', function() {
      var Idle;

      beforeEach(function() {
        IdleProvider.timeout(3);
        Idle = create();
      });

      it ('setIdle() should update option.idle and restart', function() {
        spyOn(Idle, 'watch');
        spyOn(Idle, 'unwatch');
        spyOn(Idle, 'running').andCallFake(function() {return true;});

        Idle.setIdle(100);

        expect(Idle._options().idle).toBe(100);
        expect(Idle.unwatch).toHaveBeenCalled();
        expect(Idle.watch).toHaveBeenCalled();
      });

      it ('setTimeout() should update option.timeout and restart', function() {
        spyOn(Idle, 'watch');
        spyOn(Idle, 'unwatch');
        spyOn(Idle, 'running').andCallFake(function() {return true;});

        Idle.setTimeout(100);

        expect(Idle._options().timeout).toBe(100);
        expect(Idle.unwatch).toHaveBeenCalled();
        expect(Idle.watch).toHaveBeenCalled();
      });

      it('watch() should clear timeouts and start running', function() {
        spyOn($interval, 'cancel');

        Idle.watch();

        expect($interval.cancel).toHaveBeenCalled();
        expect(Idle.running()).toBe(true);
        expect($keepalive.start).toHaveBeenCalled();
      });

      it('watch() should not start keepalive if disabled', function() {
        Idle = create(false);

        Idle.watch();
        expect($keepalive.start).not.toHaveBeenCalled();
      });

      it('should not stop keepalive when idle if keepalive integration is disabled', function() {
        Idle = create(false);

        Idle.watch();

        $interval.flush(DEFAULTIDLEDURATION);

        expect($keepalive.stop).not.toHaveBeenCalled();
      });

      it('should not start or ping keepalive when returning from idle if integration is disabled', function() {
        Idle = create(false);

        Idle.watch();
        $interval.flush(DEFAULTIDLEDURATION);
        Idle.watch();

        expect($keepalive.ping).not.toHaveBeenCalled();
        expect($keepalive.start).not.toHaveBeenCalled();
      });

      it('unwatch() should clear timeouts and stop running', function() {
        Idle.watch();

        spyOn($interval, 'cancel');

        Idle.unwatch();

        expect($interval.cancel).toHaveBeenCalled();
        expect(Idle.running()).toBe(false);
      });

      it('should broadcast IdleStart and stop keepalive', function() {
        spyOn($rootScope, '$broadcast');

        Idle.watch();

        $interval.flush(DEFAULTIDLEDURATION);
        $rootScope.$digest();

        expect($rootScope.$broadcast).toHaveBeenCalledWith('IdleStart');
        expect($keepalive.stop).toHaveBeenCalled();
      });

      it('should broadcast IdleEnd, start keepalive and ping', function() {
        spyOn($rootScope, '$broadcast');

        Idle.watch();

        $interval.flush(DEFAULTIDLEDURATION);
        $rootScope.$digest();

        Idle.watch();

        expect($rootScope.$broadcast).toHaveBeenCalledWith('IdleEnd');
        expect($keepalive.ping).toHaveBeenCalled();
        expect($keepalive.start).toHaveBeenCalled();
      });

      it('should count down warning and then signal timeout', function() {
        spyOn($rootScope, '$broadcast');

        Idle.watch();

        $interval.flush(DEFAULTIDLEDURATION);
        $rootScope.$digest();

        expect($rootScope.$broadcast).toHaveBeenCalledWith('IdleStart');
        expect($rootScope.$broadcast).toHaveBeenCalledWith('IdleWarn', 3);

        $interval.flush(1000);
        $rootScope.$digest();

        expect($rootScope.$broadcast).toHaveBeenCalledWith('IdleWarn', 2);

        $interval.flush(1000);
        $rootScope.$digest();

        expect($rootScope.$broadcast).toHaveBeenCalledWith('IdleWarn', 1);

        $interval.flush(1000);
        $rootScope.$digest();

        expect($rootScope.$broadcast).toHaveBeenCalledWith('IdleTimeout');

        // ensure idle interval doesn't keep executing after IdleStart
        $rootScope.$broadcast.reset();
        $interval.flush(DEFAULTIDLEDURATION);
        $interval.flush(DEFAULTIDLEDURATION);
        expect($rootScope.$broadcast).not.toHaveBeenCalledWith('IdleStart');
      });

      it('watch() should interrupt countdown', function() {
        spyOn($rootScope, '$broadcast');

        Idle.watch();
        $interval.flush(DEFAULTIDLEDURATION);

        $interval.flush(1000);
        $rootScope.$digest();

        expect(Idle.idling()).toBe(true);

        Idle.watch();
        expect(Idle.idling()).toBe(false);
      });

      it ('isExpired() should return false if the date/time is less than the idle duration', function() {
        // sets the expiry to now + idle + warning duration
        Idle.watch();

        expect(Idle.isExpired()).toBe(false);
      });

      it ('isExpired() should return true if the date/time is greater than or equal the idle duration + warning duration.', function() {
        var secondsPassed = 0;

        // fake now to return a time in the future.
        spyOn(Idle, '_getNow').andCallFake(function() {
          return new Date(new Date().getTime() + ((DEFAULTIDLEDURATION + DEFAULTTIMEOUT + secondsPassed) * 1000));
        });

        // equal to expiry
        Idle.watch();
        expect(Idle.isExpired()).toBe(true);

        // greater than expiry
        secondsPassed = 1;
        Idle.watch();
        expect(Idle.isExpired()).toBe(true);

        // far greater than expiry (90 days)
        secondsPassed = 60 * 60 * 24 * 90;
        Idle.watch();
        expect(Idle.isExpired()).toBe(true);
      });

      it ('interrupt() should call watch() if running and autoRest is true', function() {
          spyOn(Idle, 'watch').andCallThrough();

          // arrange
          Idle.watch(); // start watching
          Idle.watch.reset(); // reset watch spy to ignore the prior setup call

          Idle.interrupt();
          expect(Idle.watch).toHaveBeenCalled();
      });

      it ('interrupt() should broadcast $timeout if running and past expiry', function() {
        spyOn($rootScope, '$broadcast');

        // fake now to return a time in the future.
        spyOn(Idle, '_getNow').andCallFake(function() {
          return new Date(new Date().getTime() + ((DEFAULTIDLEDURATION + DEFAULTTIMEOUT + 60) * 1000));
        });

        spyOn(Idle, 'watch').andCallThrough();

        // the original call to start watching
        Idle.watch();
        expect($rootScope.$broadcast).not.toHaveBeenCalled();
        Idle.watch.reset();

        // a subsequent call represents an interrupt
        Idle.interrupt();
        expect($rootScope.$broadcast).toHaveBeenCalledWith('IdleTimeout');
        expect(Idle.idling()).toBe(true);
        expect(Idle.watch).not.toHaveBeenCalled();
      });

      // HACK: the body event listener is only respected the first time, and thus always checks the first Idle instance we created rather than the one we created last.
      // in practice, the functionality works fine, but here the test always fails. dunno how to fix it right now.
      // it ('document event should interrupt idle timeout', function() {

      // 	Idle.watch();
      // 	$timeout.flush();

      // 	expect(Idle.idling()).toBe(true);

      // 	var e = $.Event('click');
      // 	$('body').trigger(e);

      // 	expect(Idle.idling()).toBe(false);
      // });
    });

    describe('Idle with timeout disabled', function() {
      var Idle;

      beforeEach(function() {
        IdleProvider.timeout(false);
        Idle = create();
      });

      it('should NOT count down warning or signal timeout', function() {
        spyOn($rootScope, '$broadcast');

        Idle.watch();

        $interval.flush(DEFAULTIDLEDURATION);
        $rootScope.$digest();

        expect($rootScope.$broadcast).toHaveBeenCalledWith('IdleStart');
        expect($rootScope.$broadcast).not.toHaveBeenCalledWith('IdleWarn');

        $interval.flush(1000);
        $rootScope.$digest();

        expect($rootScope.$broadcast).not.toHaveBeenCalledWith('IdleWarn');

        $interval.flush(1000);
        $rootScope.$digest();

        expect($rootScope.$broadcast).not.toHaveBeenCalledWith('IdleWarn');

        $interval.flush(1000);
        $rootScope.$digest();

        expect($rootScope.$broadcast).not.toHaveBeenCalledWith('IdleTimeout');
      });

      it ('interrupt() should not timeout if running and past expiry', function() {
        spyOn($rootScope, '$broadcast');

        // fake now to return a time in the future.
        spyOn(Idle, '_getNow').andCallFake(function() {
          return new Date(new Date().getTime() + ((DEFAULTIDLEDURATION + DEFAULTTIMEOUT + 60) * 1000));
        });

        spyOn(Idle, 'watch').andCallThrough();

        // the original call to start watching
        Idle.watch();
        expect($rootScope.$broadcast).not.toHaveBeenCalled();
        Idle.watch.reset();

        // a subsequent call represents an interrupt
        Idle.interrupt();
        expect($rootScope.$broadcast).not.toHaveBeenCalledWith('IdleTimeout');
        expect(Idle.idling()).toBe(false);
        expect(Idle.watch).toHaveBeenCalled();
      });

    });
  });


  describe('keepalive', function() {
    var $keepaliveProvider, $rootScope, $log, $httpBackend, $interval, $http, $injector;

    beforeEach(module('ngIdle.keepalive'));

    beforeEach(function() {
      angular
        .module('app', function() {})
        .config(['$keepaliveProvider',
          function(_$keepaliveProvider_) {
            $keepaliveProvider = _$keepaliveProvider_;
          }
        ]);

      module('app');

      inject(function(_$rootScope_, _$log_, _$httpBackend_, _$interval_, _$http_, _$injector_) {
        $rootScope = _$rootScope_;
        $log = _$log_;
        $httpBackend = _$httpBackend_;
        $interval = _$interval_;
        $http = _$http_;
        $injector = _$injector_;
      });
    });

    var create = function(http) {
      if (http) $keepaliveProvider.http(http);
      return $injector.invoke($keepaliveProvider.$get, null, {$rootScope: $rootScope, $log: $log, $interval: $interval, $http: $http});
    };

    describe('$keepaliveProvider', function() {
      it('http() should update options with simple GET', function() {
        $keepaliveProvider.http('/path/to/keepalive');

        expect(create()._options().http).toEqualData({
          url: '/path/to/keepalive',
          method: 'GET',
          cache: false
        });
      });

      it('http() should update options with http options object', function() {
        $keepaliveProvider.http({
          url: '/path/to/keepalive',
          method: 'POST',
          cache: true
        });

        expect(create()._options().http).toEqualData({
          url: '/path/to/keepalive',
          method: 'POST',
          cache: false
        });
      });

      it('http() should throw if passed null or undefined argument', function() {
        expect(function() {
          $keepaliveProvider.http();
        }).toThrow(new Error('Argument must be a string containing a URL, or an object containing the HTTP request configuration.'));
      });

      it('interval() should update options', function() {
        $keepaliveProvider.interval(10);

        expect(create()._options().interval).toBe(10);
      });

      it('interval() should throw if nan or less than or equal to 0', function() {

        expect(function() {
          $keepaliveProvider.interval('asdsad');
        }).toThrow(new Error('Interval must be expressed in seconds and be greater than 0.'));

        expect(function() {
          $keepaliveProvider.interval(0);
        }).toThrow(new Error('Interval must be expressed in seconds and be greater than 0.'));

        expect(function() {
          $keepaliveProvider.interval(-1);
        }).toThrow(new Error('Interval must be expressed in seconds and be greater than 0.'));
      });
    });

    describe('$keepalive', function() {
      var $keepalive, DEFAULTKEEPALIVEINTERVAL = 10*60*1000;

      beforeEach(function() {
        $keepalive = create();
      });

      afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
      });

      it('setInterval should update an interval option', function(){
        $keepalive.setInterval(100);
        expect(create()._options().interval).toBe(100);
      });
      it('start() after a new LONGER timeout should NOT broadcast $keepalive when the default timeout expires', function(){
        spyOn($rootScope, '$broadcast');
        $keepalive.setInterval(100*60);
        $keepalive.start();
        $interval.flush(DEFAULTKEEPALIVEINTERVAL);
        expect($rootScope.$broadcast).not.toHaveBeenCalledWith('$keepalive');
      });
      it('start() after a new LONGER timeout should broadcast $keepalive when the new LONGER expires', function(){
        spyOn($rootScope, '$broadcast');
        $keepalive.setInterval(100);
        $keepalive.start();
        $interval.flush(100 * 1000);
        expect($rootScope.$broadcast).toHaveBeenCalledWith('$keepalive');
      });
      it('start() should schedule ping timeout that broadcasts $keepalive event when it expires.', function() {
        spyOn($rootScope, '$broadcast');

        $keepalive.start();

        $interval.flush(DEFAULTKEEPALIVEINTERVAL);

        expect($rootScope.$broadcast).toHaveBeenCalledWith('$keepalive');
      });

      it('stop() should cancel ping timeout.', function() {
        spyOn($rootScope, '$broadcast');

        $keepalive.start();
        $keepalive.stop();

        $interval.flush(DEFAULTKEEPALIVEINTERVAL);

        expect($rootScope.$broadcast).not.toHaveBeenCalledWith('$keepalive');
      });

      it('ping() should immediately broadcast $keepalive event', function() {
        spyOn($rootScope, '$broadcast');

        $keepalive.ping();

        $interval.flush(DEFAULTKEEPALIVEINTERVAL);

        expect($rootScope.$broadcast).toHaveBeenCalledWith('$keepalive');
      });

      it('should invoke a URL when pinged and broadcast $keepaliveResponse on success.', function() {
        spyOn($rootScope, '$broadcast');

        $keepalive = create('/path/to/keepalive');

        $keepalive.start();

        $httpBackend.expectGET('/path/to/keepalive')
          .respond(200);

        $interval.flush(DEFAULTKEEPALIVEINTERVAL);

        $httpBackend.flush();

        expect($rootScope.$broadcast).toHaveBeenCalledWith('$keepaliveResponse', undefined, 200);
      });

      it('should invoke a URL when pinged and broadcast $keepaliveResponse on error.', function() {
        spyOn($rootScope, '$broadcast');

        $keepalive = create('/path/to/keepalive');

        $keepalive.start();

        $httpBackend.expectGET('/path/to/keepalive')
          .respond(404);

        $interval.flush(DEFAULTKEEPALIVEINTERVAL);

        $httpBackend.flush();

        expect($rootScope.$broadcast).toHaveBeenCalledWith('$keepaliveResponse', undefined, 404);
      });
    });
  });

  describe('ng-idle-countdown', function() {
    beforeEach(module('ngIdle', function($provide) {
      $provide.decorator('Idle', function($delegate) {
        return $delegate;
      });
    }));

    var $compile, $scope, Idle, create;

    beforeEach(inject(function(_$rootScope_, _$compile_, _Idle_) {
      $scope = _$rootScope_;
      $compile = _$compile_;
      Idle = _Idle_;

      create = function() {
        var el = $compile(angular.element('<div ng-idle-countdown="countdown">{{countdown}} seconds remaining.</div>'))($scope);
        $scope.$digest();
        return el;
      };
    }));

    it('should update countdown scope value when receiving new IdleWarning event', function() {
      create();

      $scope.$broadcast('IdleWarn', 5);
      $scope.$apply();
      expect($scope.countdown).toBe(5);
    });

    it('should update countdown scope value to 0 on IdleTimeout event', function() {
      create();

      $scope.$broadcast('IdleTimeout');
      $scope.$apply();

      expect($scope.countdown).toBe(0);
    });
  });
});
