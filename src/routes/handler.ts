import {Router} from 'express';
import {MqttHandler} from '../mqtt-handler';
import * as PouchDB from 'pouchdb';

const handler: Router = Router();
const mqttHandler: MqttHandler = new MqttHandler();

const webhookConfigurationDb = new PouchDB(`${process.env.DBURL}/mhg-webhooks`);

handler.post('/:id', (req, res) => webhookConfigurationDb.get(req.params['id'])
    .then(result => executeWebhook(req, res, result))
    .catch(error => reportError(res, error)));


const executeWebhook = (req, res, webhook) => mqttHandler.publish(
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
