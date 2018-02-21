import {MqttHandler, MqttMessage, MqttServerConnection, TopicSubscription} from "./mqtt-handler";

import * as mqtt from "mqtt";
import createSpy = jasmine.createSpy;
import any = jasmine.any;
import {OnMessageCallback} from "mqtt";
import {Subscription} from "rxjs/Subscription";
import {Subscriber} from "rxjs/Subscriber";

describe('MqttHandler', () => {

    const testIdleTimeout = 1000;

    let unitUnderTest: MqttHandler;
    let mqttConnectSpy: jasmine.Spy;
    let mockMqttClient;

    const expectedServerUrl = 'expected server url';
    const expectedTopic = 'expected topic';
    let expectedOptions;
    let mqttServerConnection: MqttServerConnection;

    let actualOnMessageCallback: OnMessageCallback = undefined;

    beforeEach(() => {
        unitUnderTest = new MqttHandler(testIdleTimeout);

        actualOnMessageCallback = undefined;
        mockMqttClient = {
            connected: false,
            on: (event, cb) => {
                if (event === 'connect' && !mockMqttClient.connected) {
                    mockMqttClient.connected = true;
                    cb();
                    // setTimeout(() => {
                    //     mockMqttClient.connected = true;
                    //     cb();
                    // }, 0);
                }
                if (event === 'message') {
                    actualOnMessageCallback = cb;
                }
            },
            subscribe: () => mockMqttClient,
            unsubscribe: () => mockMqttClient,
            end: () => mockMqttClient,
            publish: () => mockMqttClient
        };
        mqttConnectSpy = spyOn(mqtt, 'connect').and.returnValue(mockMqttClient);

        expectedOptions = {clientId: 'expected client id'};

        mqttServerConnection = new MqttServerConnection();
        mqttServerConnection.serverUrl = expectedServerUrl;
        mqttServerConnection.options = expectedOptions;

    });

    describe('constructor', () => {
        it('has a default idle timeout value of 60 seconds', () => {
            // when
            const unitUnderTest = new MqttHandler();

            // then
            expect((unitUnderTest as any).idleTimeout).toEqual(60000);
        });
    });

    describe('subscribe(connection, topic)', () => {

        it('creates a new MqttClient using the configuration from the connection parameter', () => {
            unitUnderTest.subscribe(mqttServerConnection, expectedTopic).subscribe();
            expect(mqttConnectSpy).toHaveBeenCalledWith(expectedServerUrl, expectedOptions);
        });

        it('calls MqttClient.subscribe on the topic when connected', () => {
            const spy = spyOn(mockMqttClient, 'subscribe').and.returnValue(mockMqttClient);
            unitUnderTest.subscribe(mqttServerConnection, expectedTopic).subscribe();
            expect(spy).toHaveBeenCalledWith(expectedTopic, any(Function));
        });

        it('does not create another MqttClient if a subsequent call uses the same server url and options', () => {
            const expectedSecondTopic = 'second topic';
            const subscribeSpy = spyOn(mockMqttClient, 'subscribe').and.returnValue(mockMqttClient);

            unitUnderTest.subscribe(mqttServerConnection, expectedTopic).subscribe();
            unitUnderTest.subscribe(mqttServerConnection, expectedSecondTopic).subscribe();

            expect(subscribeSpy).toHaveBeenCalledTimes(2);
            expect(subscribeSpy).toHaveBeenCalledWith(expectedTopic, any(Function));
            expect(subscribeSpy).toHaveBeenCalledWith(expectedSecondTopic, any(Function));

            expect(mqttConnectSpy).toHaveBeenCalledTimes(1);
            expect(mqttConnectSpy).toHaveBeenCalledWith(mqttServerConnection.serverUrl, mqttServerConnection.options);
        });

        it('does not create another Subscription if a subsequent call uses the same topic, server url, and server options', () => {
            const subscribeSpy = spyOn(mockMqttClient, 'subscribe').and.returnValue(mockMqttClient);

            unitUnderTest.subscribe(mqttServerConnection, expectedTopic).subscribe();
            unitUnderTest.subscribe(mqttServerConnection, expectedTopic).subscribe();

            expect(subscribeSpy).toHaveBeenCalledTimes(1);
            expect(subscribeSpy).toHaveBeenCalledWith(expectedTopic, any(Function));

            expect(mqttConnectSpy).toHaveBeenCalledTimes(1);
            expect(mqttConnectSpy).toHaveBeenCalledWith(mqttServerConnection.serverUrl, mqttServerConnection.options);
        });

        describe('returned Observable', () => {

            it('calls the "error" callback if the subscription fails', () => {
                const expectedError = {error: 'reason'};
                spyOn(mockMqttClient, 'subscribe').and.callFake((topic, cb) => {
                    if (typeof cb === 'function') cb(expectedError);
                    return mockMqttClient;
                });
                const errorCallbackMock = createSpy('error callback');
                const observable = unitUnderTest.subscribe(mqttServerConnection, expectedTopic);
                observable.subscribe(undefined, errorCallbackMock);
                expect(errorCallbackMock).toHaveBeenCalledWith(expectedError);
            });

            it('calls the "next" callback for a message received on the topic', () => {
                const expectedMessageText = 'some message';
                const expectedMessage: MqttMessage = {message: expectedMessageText, topic: expectedTopic};

                spyOn(mockMqttClient, 'subscribe').and.callFake((topic, cb) => {
                    if (typeof cb === 'function') cb();
                    return mockMqttClient;
                });
                const nextCallbackMock = createSpy('next callback');
                const observable = unitUnderTest.subscribe(mqttServerConnection, expectedTopic);
                observable.subscribe(nextCallbackMock);

                actualOnMessageCallback(expectedTopic, Buffer.from(expectedMessageText), undefined);

                expect(nextCallbackMock).toHaveBeenCalledWith(expectedMessage);
            });

            describe('returned Subscription', () => {

                describe('unsubscribe()', () => {

                    it('unsubscribes from the topic on the MqttClient', () => {
                        spyOn(mockMqttClient, 'subscribe').and.callFake((topic, cb) => {
                            if (typeof cb === 'function') cb();
                            return mockMqttClient;
                        });
                        const spy = spyOn(mockMqttClient, 'unsubscribe').and.callThrough();
                        const observable = unitUnderTest.subscribe(mqttServerConnection, expectedTopic);
                        const subscription: Subscription = observable.subscribe();
                        subscription.unsubscribe();

                        expect(spy).toHaveBeenCalledWith(expectedTopic);
                    });

                    it('does not unsubscribe from the topic on the MqttClient until the last subscriber unsubscribed', () => {
                        const subscribeSpy = spyOn(mockMqttClient, 'subscribe').and.callFake((topic, cb) => {
                            if (typeof cb === 'function') cb();
                            return mockMqttClient;
                        });
                        const unsubscribeSpy = spyOn(mockMqttClient, 'unsubscribe').and.callThrough();
                        const observable = unitUnderTest.subscribe(mqttServerConnection, expectedTopic);
                        const observable2 = unitUnderTest.subscribe(mqttServerConnection, expectedTopic);
                        const subscription: Subscription = observable.subscribe();
                        const subscription2: Subscription = observable2.subscribe();

                        expect(subscribeSpy).toHaveBeenCalledWith(expectedTopic, any(Function));
                        expect(subscribeSpy).toHaveBeenCalledTimes(1);
                        subscription.unsubscribe();
                        expect(unsubscribeSpy).toHaveBeenCalledTimes(0);
                        subscription2.unsubscribe();
                        expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
                        expect(unsubscribeSpy).toHaveBeenCalledWith(expectedTopic);
                    });

                    it('calls MqttClient.end instantly if the last topic has been unsubscribed from a connection', () => {
                        const expectedTopic2 = 'another topic';
                        const subscribeSpy = spyOn(mockMqttClient, 'subscribe').and.callFake((topic, cb) => {
                            if (typeof cb === 'function') cb();
                            return mockMqttClient;
                        });
                        const unsubscribeSpy = spyOn(mockMqttClient, 'unsubscribe').and.callThrough();
                        const endSpy = spyOn(mockMqttClient, 'end').and.callThrough();
                        const observable = unitUnderTest.subscribe(mqttServerConnection, expectedTopic);
                        const observable2 = unitUnderTest.subscribe(mqttServerConnection, expectedTopic2);
                        const subscription: Subscription = observable.subscribe();
                        const subscription2: Subscription = observable2.subscribe();

                        expect(subscribeSpy).toHaveBeenCalledWith(expectedTopic, any(Function));
                        expect(subscribeSpy).toHaveBeenCalledWith(expectedTopic2, any(Function));
                        expect(subscribeSpy).toHaveBeenCalledTimes(2);

                        subscription.unsubscribe();
                        expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
                        expect(unsubscribeSpy).toHaveBeenCalledWith(expectedTopic);
                        expect(endSpy).toHaveBeenCalledTimes(0);

                        subscription2.unsubscribe();
                        expect(unsubscribeSpy).toHaveBeenCalledTimes(2);
                        expect(unsubscribeSpy).toHaveBeenCalledWith(expectedTopic2);

                        expect(endSpy).toHaveBeenCalledTimes(1);
                    });
                });

            });
        });

    });

    describe('publish(connection, message)', () => {

        const expectedTopic = 'expected topic';
        const expectedMessage = 'expected message';
        const mqttMessage: MqttMessage = {topic: expectedTopic, message: expectedMessage};

        it('creates a new MqttClient using the configuration from the connection parameter', () => {
            unitUnderTest.publish(mqttServerConnection, mqttMessage).subscribe();
            expect(mqttConnectSpy).toHaveBeenCalledWith(expectedServerUrl, expectedOptions);
        });

        it('calls MqttClient.publish on the topic when connected', () => {
            const spy = spyOn(mockMqttClient, 'publish').and.stub();
            unitUnderTest.publish(mqttServerConnection, mqttMessage).subscribe();
            expect(spy).toHaveBeenCalledWith(expectedTopic, expectedMessage, any(Function));
        });

        it('does not create another MqttClient if there already is a connection with the same server url and options', () => {
            const expectedSecondTopic = 'expected second topic';
            const expectedSecondMessage = 'expected second message';
            const secondMqttMessage: MqttMessage = {topic: expectedSecondTopic, message: expectedSecondMessage};
            const publishSpy = spyOn(mockMqttClient, 'publish').and.stub();

            unitUnderTest.subscribe(mqttServerConnection, expectedTopic).subscribe();
            unitUnderTest.publish(mqttServerConnection, mqttMessage).subscribe();
            unitUnderTest.publish(mqttServerConnection, secondMqttMessage).subscribe();

            expect(publishSpy).toHaveBeenCalledTimes(2);
            expect(publishSpy).toHaveBeenCalledWith(expectedTopic, expectedMessage, any(Function));
            expect(publishSpy).toHaveBeenCalledWith(expectedSecondTopic, expectedSecondMessage, any(Function));

            expect(mqttConnectSpy).toHaveBeenCalledTimes(1);
            expect(mqttConnectSpy).toHaveBeenCalledWith(mqttServerConnection.serverUrl, mqttServerConnection.options);
        });

        describe('returned Observable', () => {

            it('calls the "complete" callback if the message has been published successfully', () => {
                spyOn(mockMqttClient, 'publish').and.callFake((topic, message, cb) => {
                    if (typeof cb === 'function') cb();
                });
                const completeCallbackMock = createSpy('complete callback');
                const observable = unitUnderTest.publish(mqttServerConnection, mqttMessage);

                observable.subscribe(undefined, undefined, completeCallbackMock);
                expect(completeCallbackMock).toHaveBeenCalled();
            });

            it('calls the "error" callback if the message has not been published because of an error', () => {
                const expectedError = {error: 'reason'};
                spyOn(mockMqttClient, 'publish').and.callFake((topic, message, cb) => {
                    if (typeof cb === 'function') cb(expectedError);
                });
                const errorCallbackMock = createSpy('error callback');
                const observable = unitUnderTest.publish(mqttServerConnection, mqttMessage);

                observable.subscribe(undefined, errorCallbackMock);
                expect(errorCallbackMock).toHaveBeenCalledWith(expectedError);
            });

            it('calls MqttClient.end after the idleTimeout', (done) => {
                const endSpy = spyOn(mockMqttClient, 'end').and.callThrough();
                spyOn(mockMqttClient, 'publish').and.callFake((topic, message, cb) => {
                    if (typeof cb === 'function') cb();
                    return mockMqttClient;
                });
                unitUnderTest.publish(mqttServerConnection, mqttMessage).subscribe();

                expect(endSpy).toHaveBeenCalledTimes(0);
                setTimeout(() => {
                    expect(endSpy).toHaveBeenCalledTimes(1);
                    done();
                }, testIdleTimeout + 1000);
            });

            it('does not call MqttClient.end if the connection is used otherwise', (done) => {
                const endSpy = spyOn(mockMqttClient, 'end').and.callThrough();
                spyOn(mockMqttClient, 'publish').and.callFake((topic, message, cb) => {
                    if (typeof cb === 'function') cb();
                    return mockMqttClient;
                });
                spyOn(mockMqttClient, 'subscribe').and.callFake((topic, cb) => {
                    if (typeof cb === 'function') cb();
                    return mockMqttClient;
                });

                unitUnderTest.subscribe(mqttServerConnection, expectedTopic).subscribe();
                unitUnderTest.publish(mqttServerConnection, mqttMessage).subscribe();

                expect(endSpy).toHaveBeenCalledTimes(0);
                setTimeout(() => {
                    expect(endSpy).toHaveBeenCalledTimes(0);
                    done();
                }, testIdleTimeout + 1000);
            });
        });
    });
});

describe('TopicSubscription', () => {
    let unitUnderTest: TopicSubscription;
    let mockSubscriber1: Subscriber<MqttMessage>;
    let mockSubscriber2: Subscriber<MqttMessage>;
    beforeEach(() => {
        unitUnderTest = new TopicSubscription();
        mockSubscriber1 = jasmine.createSpyObj<Subscriber<MqttMessage>>('Subscriber', ['error', 'next']);
        mockSubscriber2 = jasmine.createSpyObj<Subscriber<MqttMessage>>('Subscriber', ['error', 'next']);
    });
    describe('error(arg)', () => {
        it('calls error(arg) on each subscriber', () => {
            // given
            unitUnderTest.subscribe(mockSubscriber1);
            unitUnderTest.subscribe(mockSubscriber2);

            // when
            const expectedError = 'expected error';
            unitUnderTest.error(expectedError);

            // then
            expect(mockSubscriber1.error).toHaveBeenCalledWith(expectedError);
            expect(mockSubscriber2.error).toHaveBeenCalledWith(expectedError);
        });
    });
    describe('unsubscribe(arg)', () => {
        it('it does nothing if the subscriber is not subscribed at all', () => {
            // when
            unitUnderTest.unsubscribe(mockSubscriber2);
        });
    });
});