define(function(require) {

    'use strict';

    function returnPromisesInOrder() {
        var responses = Array.prototype.slice.call(arguments);
        var calls = 0;
        return function() {
            return responses[calls++].promise();
        };
    }

    var dataHeaderForJson = {
        'Content-Type' : 'application/json'
    };

    describe('utilities', function() {

        var utils = require('utilities');
        var mockAuth = require('mocks/auth');
        utils.setAuthFlow(mockAuth.mockImplicitGrantFlow());

        describe('requestWithFileFun', function() {

            var ajaxSpy;

            beforeEach(function() {
                ajaxSpy = spyOn($, 'ajax').and.returnValue($.Deferred().resolve());
            });

            it('should allow a custom content-type to be set against a request', function() {
                var file = {
                    name: 'fileName',
                    type: 'text/plain'
                };
                var requestFunction = utils.requestWithFileFun('POST', 'url', 'link', {
                    'Content-Type': 'text/html'
                });

                requestFunction(file);
                expect(ajaxSpy.calls.mostRecent().args[0].headers['Content-Type']).toBe('text/html');
            });

        });

        describe('requestWithDataAndPollFun', function() {
            var alwaysTrueFun = function(data) { return data ? true : true; };

            it('should return on the promise after making a request to the location returned in the response header', function() {
                var success = false,
                    initialCallDeferred = $.Deferred(),
                    statusCallDeferred = $.Deferred(),
                    ajaxSpy = spyOn($, 'ajax').and.callFake(returnPromisesInOrder(
                        initialCallDeferred,
                        statusCallDeferred
                    ));

                utils.requestWithDataAndPollFun('POST', '/some/path', false, dataHeaderForJson, 2000, alwaysTrueFun)()
                    .done(function() {
                    success = true;
                });

                initialCallDeferred.resolve({}, '', {
                    getResponseHeader: function (headerName) {
                        if (headerName) {
                            return '/location';
                        }
                    }
                });

                statusCallDeferred.resolve({
                    status: 'DONE'
                }, '', {});

                expect(success).toBe(true);
                expect(ajaxSpy.calls.count()).toBe(2);
                expect(ajaxSpy.calls.first().args[0].url).toBe('https://api.mendeley.com/some/path');
                expect(ajaxSpy.calls.mostRecent().args[0].url).toBe('https://api.mendeley.com/location');
            });

            it('should make no further requests if the initial import request fails', function() {
                var failed = false,
                    initialCallDeferred = $.Deferred(),
                    ajaxSpy = spyOn($, 'ajax').and.callFake(returnPromisesInOrder(
                        initialCallDeferred));

                utils.requestWithDataAndPollFun('POST', '/some/path', false, dataHeaderForJson, 2000, alwaysTrueFun)()
                    .fail(function() {
                    failed = true;
                });

                initialCallDeferred.reject({});

                expect(failed).toBe(true);
                expect(ajaxSpy.calls.count()).toBe(1);
            });

            it('should continue to poll for the import status until the status becomes done', function(done) {
                var importByAuthorDeferred = $.Deferred(),
                    importByAuthorStatusDeferred = $.Deferred(),
                    importByAuthorStatusInProgressDeferred = $.Deferred(),
                    ajaxSpy = spyOn($, 'ajax').and.callFake(returnPromisesInOrder(
                        importByAuthorDeferred,
                        importByAuthorStatusInProgressDeferred,
                        importByAuthorStatusDeferred
                    ));

                utils.requestWithDataAndPollFun('POST', '/some/path', false, dataHeaderForJson, 2000, function (data) {
                    return data.status === 'DONE';
                })().always(function() {
                    expect(ajaxSpy.calls.count()).toBe(3);
                    expect(ajaxSpy.calls.first().args[0].url).toBe('https://api.mendeley.com/some/path');
                    expect(ajaxSpy.calls.mostRecent().args[0].url).toBe('https://api.mendeley.com/some-path');
                    done();
                });

                importByAuthorDeferred.resolve({}, '', {
                    getResponseHeader: function (headerName) {
                        if (headerName) {
                            return '/some-path';
                        }
                    }
                });

                importByAuthorStatusInProgressDeferred.resolve({
                    status: 'IN_PROGRESS'
                }, '', {});

                importByAuthorStatusDeferred.resolve({
                    status: 'DONE'
                }, '', {});
            });

            it('should call fail callback if the status call fails', function() {
                var failed = false,
                    importByAuthorDeferred = $.Deferred(),
                    importByAuthorStatusDeferred = $.Deferred();

                spyOn($, 'ajax').and.callFake(returnPromisesInOrder(
                    importByAuthorDeferred,
                    importByAuthorStatusDeferred
                ));

                utils.requestWithDataAndPollFun('POST', '/some/path', false, dataHeaderForJson, 2000, alwaysTrueFun)()
                    .fail(function() {
                    failed = true;
                });

                importByAuthorDeferred.resolve({}, '', {
                    getResponseHeader: function (headerName) {
                        if (headerName) {
                            return '/some-path';
                        }
                    }
                });
                importByAuthorStatusDeferred.reject({});

                expect(failed).toBe(true);
            });
        });
    });
});

