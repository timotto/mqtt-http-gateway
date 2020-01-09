import {EnvConfig} from './config';

describe('EnvConfig', () => {
  it('parses the configuration from a JSON string', async () => {
    const given = JSON.stringify({
      httpToMqtt: {
        expectedId: {
          mqttServerUrl: 'expected-url',
          mqttServerOptions: {expected: 'option'},
          topic: 'expected-topic',
        }
      },
      mqttToHttp: [{
        mqttServerUrl: 'expected-url-2',
        mqttServerOptions: {expected: 'option-2'},
        topic: 'expected-topic-2',
        webhook: 'expected-webhook',
      }],
    });

    const unitUnderTest = new EnvConfig(given);

    const actualHttpToMqtt = await unitUnderTest.httpToMqt('expectedId');
    expect(actualHttpToMqtt).toEqual({
      mqttServerUrl: 'expected-url',
      mqttServerOptions: {expected: 'option'},
      topic: 'expected-topic',
    });

    const actualMqttToHttp = await unitUnderTest.mqttToHttp();
    expect(actualMqttToHttp).toEqual([{
      mqttServerUrl: 'expected-url-2',
      mqttServerOptions: {expected: 'option-2'},
      topic: 'expected-topic-2',
      webhook: 'expected-webhook',
    }]);
  });

  it('does not fail when the is no httpToMqtt', async () => {
    const given = JSON.stringify({
      mqttToHttp: [{
        mqttServerUrl: 'expected-url-2',
        mqttServerOptions: {expected: 'option-2'},
        topic: 'expected-topic-2',
        webhook: 'expected-webhook',
      }],
    });

    const unitUnderTest = new EnvConfig(given);

    const actualHttpToMqtt = await unitUnderTest.httpToMqt('expectedId');
    expect(actualHttpToMqtt).toEqual(undefined);

    const actualMqttToHttp = await unitUnderTest.mqttToHttp();
    expect(actualMqttToHttp).toEqual([{
      mqttServerUrl: 'expected-url-2',
      mqttServerOptions: {expected: 'option-2'},
      topic: 'expected-topic-2',
      webhook: 'expected-webhook',
    }]);
  });

  it('does not fail when the is no mqttToHttp', async () => {
    const given = JSON.stringify({
      httpToMqtt: {
        expectedId: {
          mqttServerUrl: 'expected-url',
          mqttServerOptions: {expected: 'option'},
          topic: 'expected-topic',
        }
      },
    });

    const unitUnderTest = new EnvConfig(given);

    const actualHttpToMqtt = await unitUnderTest.httpToMqt('expectedId');
    expect(actualHttpToMqtt).toEqual({
      mqttServerUrl: 'expected-url',
      mqttServerOptions: {expected: 'option'},
      topic: 'expected-topic',
    });

    const actualMqttToHttp = await unitUnderTest.mqttToHttp();
    expect(actualMqttToHttp).toEqual([]);
  });
});
