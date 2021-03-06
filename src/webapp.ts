import * as express from 'express';
import * as logger from 'morgan';
import * as bodyParser from 'body-parser';
import httpHandler from './routes/handler';
import {MqttHandler} from './mqtt-handler';
import {EnvConfig} from './repository/config';

const config = new EnvConfig(process.env.MHG_CONFIG);
const mqttHandler: MqttHandler = new MqttHandler();

const app: express.Express = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use('/handler', httpHandler(config, mqttHandler));
app.get('/health', (req, res) => res.send('😃'));

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err['status'] = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use((error: any, req, res, _) => {
        res.status(error['status'] || 500);
        res.json(500, {
            message: error.message,
            error
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use((error: any, req, res, _) => {
    res.status(error['status'] || 500);
    res.json(500, {
        message: error.message,
        error: {}
    });
    return null;
});


export default app;
