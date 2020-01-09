import {Router} from 'express';
import {MqttHandler} from '../mqtt-handler';
import {EnvConfig} from '../repository/config';
import {HttpToMqtt} from '../repository';

const handler: Router = Router();
const mqttHandler: MqttHandler = new MqttHandler();
const config = new EnvConfig(process.env.MHG_CONFIG);

handler.post('/:id', (req, res) =>
  config.httpToMqt(req.params['id'])
    .then(result => executeWebhook(req, res, result))
    .catch(error => reportError(res, error)));


const executeWebhook = (req, res, webhook: HttpToMqtt) => mqttHandler.publish(
    {serverUrl: webhook.mqttServerUrl, options: webhook.mqttServerOptions},
    {topic: webhook.topic, message: extractMessage(req)})
    .subscribe(
        result => res.json({status: result}),
        error => reportError(res, error),
        () => res.json({status: 'ok'}));

const extractMessage = (req) => req.body !== undefined ? req.body['message'] : undefined;

const reportError = (res, error) => {
    console.error(error);
    res.status(500).json({error: error});
};

export default handler;
