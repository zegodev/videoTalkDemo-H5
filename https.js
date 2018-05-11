var fs = require('fs');
var httpProxy = require('http-proxy');
var https = require('https');
var connect = require('connect');
var opn = require('opn');




setTimeout(()=>{
  // Create a connect app that can transform the response
  var app = connect();
  app.use(function (req, res, next) {
      if (req.url === '/') {
        //util.puts("Transforming response");

        var _write = res.write;

        // Rewrite the livereload port with our secure one
        res.write = function (data) {
          _write.call(res, data.toString().replace('35729', '35700'), 'utf8');
        }
      }

      proxy.web(req, res);
    }
  );

// Proxy fpr connect server to use
  var proxy = httpProxy.createServer({
    target: {
      host: 'localhost',
      port: 8100
    }
  });

// Live reload proxy server
  httpProxy.createServer({
    target: {
      host: 'localhost',
      port: 35729
    },
    ws: true,
    ssl: {
      // key: fs.readFileSync('server.key', 'utf8'),
      // cert: fs.readFileSync('server.crt', 'utf8')
      key: fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem')
    }
  }).listen(35700);

// Create the https server
  https.createServer({
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  }, app).listen(8101);
  // opens the url in the default browser
  opn('https://localhost:8101');

  console.log('http proxy server started on port 8101');
},12000);


