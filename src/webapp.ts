import * as express from 'express';
import * as logger from 'morgan';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import handler from './routes/handler';
import cookieParser = require('cookie-parser'); // this module doesn't use the ES6 default export yet

const app: express.Express = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/handler', handler);

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
    app.use((error: any, req, res, next) => {
        res.status(error['status'] || 500);
        res.json(500, {
            message: error.message,
            error
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use((error: any, req, res, next) => {
    res.status(error['status'] || 500);
    res.json(500, {
        message: error.message,
        error: {}
    });
    return null;
});


export default app;
