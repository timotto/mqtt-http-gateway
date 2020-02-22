import createSpyObj = jasmine.createSpyObj;
import {EnvConfig} from '../repository/config';
import {HttpToMqtt} from '../repository';
import httpHandler from './handler';
import {MqttHandler, MqttMessage, MqttServerConnection} from '../mqtt-handler';
import * as request from 'supertest';
import {of} from 'rxjs';
import * as express from 'express';
import {Router} from 'express';
import * as bodyParser from 'body-parser';

describe('HttpHandler', () => {
  it('sends a message from a JSON body on the server and topic for the given id', async () => {
    const fakeMqttHandler = createSpyObj<MqttHandler>('MqttHandler', ['publish']);
    fakeMqttHandler.publish.and.returnValue(of());

    const serverFromConfig = 'mqtt://server-url';
    const topicFromConfig = 'expected-topic';
    const unitUnderTest = httpHandler(aConfig('test-id', {topic: topicFromConfig, mqttServerUrl: serverFromConfig, mqttServerOptions: undefined}), fakeMqttHandler);

    const givenMessage = '{ 😃 "given": "message"}}}}';

    const response = await request(testBed(unitUnderTest))
      .post("/test-id")
      .send({message: givenMessage})
      .set('Content-type', 'application/json')
      .set('Accept', 'application/json');

    const expectedServerConnection: MqttServerConnection = {
      serverUrl: serverFromConfig,
      options: undefined,
    };
    const expectedMessage: MqttMessage = {
      topic: topicFromConfig,
      message: givenMessage,
    };

    expect(fakeMqttHandler.publish).toHaveBeenCalledWith(expectedServerConnection, expectedMessage);
    expect(response.status).toEqual(200);
  });
  it('sends a message from a text body on the server and topic for the given id', async () => {
    const fakeMqttHandler = createSpyObj<MqttHandler>('MqttHandler', ['publish']);
    fakeMqttHandler.publish.and.returnValue(of());

    const serverFromConfig = 'mqtt://server-url';
    const topicFromConfig = 'expected-topic';
    const unitUnderTest = httpHandler(aConfig('test-id', {topic: topicFromConfig, mqttServerUrl: serverFromConfig, mqttServerOptions: undefined}), fakeMqttHandler);

    const givenMessage = '{"proper": "json", {"as": "plain text"}}';

    const response = await request(testBed(unitUnderTest))
      .post("/test-id")
      .send(givenMessage)
      .set('Content-type', 'text/plain')
      .set('Accept', 'application/json');

    const expectedServerConnection: MqttServerConnection = {
      serverUrl: serverFromConfig,
      options: undefined,
    };
    const expectedMessage: MqttMessage = {
      topic: topicFromConfig,
      message: givenMessage,
    };

    expect(fakeMqttHandler.publish).toHaveBeenCalledWith(expectedServerConnection, expectedMessage);
    expect(response.status).toEqual(200);
  });
});

const aConfig = (id: string, httpToMqtt: HttpToMqtt): EnvConfig => {
  const envValue = {
    httpToMqtt: {},
    mqttToHttp: [],
  };
  envValue.httpToMqtt[id] = httpToMqtt;

  return new EnvConfig(JSON.stringify(envValue));
};

const testBed = (route: Router) => {
  const app = express();
  app.use(bodyParser.json());
  app.use(bodyParser.text());
  app.use('/',  route);
  return app;
};
