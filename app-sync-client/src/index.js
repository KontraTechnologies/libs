const aws4 = require("aws4");
const https = require("https");

class AppSync {
  constructor({ accessKeyId, secretAccessKey, region, host }) {
    this.host = host;
    this.region = region;
    this.credentials = {
      accessKeyId,
      secretAccessKey
    }
  }

  async request({ request, variables }) {

    const body = {
      "query": request,
      "variables": JSON.stringify(variables)
    }

    const params = {
      region: this.region,
      host: this.host,
      path: "/graphql",
      service: "appsync",
      body: JSON.stringify(body)
    };

    aws4.sign(params, this.credentials);

    let response = {};
    
    try {
      response = await AppSync.sendRequest(params);
      return response;
    } catch (e) {
      console.log(e);
    }
  }

  static sendRequest(params) {
    return new Promise(function (resolve, reject) {
      const req = https.request(params, function (res) {
        // reject on bad status
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(res));
        }
        // cumulate data
        let body = [];
        res.on('data', function (chunk) {
          body.push(chunk);
        });
        // resolve on end
        
        res.on('end', function () {
          let operation = "";
          try {
            body = JSON.parse(Buffer.concat(body).toString());
            operation = Object.keys(body.data)[0];
          } catch (e) {
            reject(e);
          }
          resolve(body.data[operation]);
        });
      });
      // reject on request error
      req.on('error', function (err) {
        // This is not a "Second reject", just a different sort of failure
        reject(err);
      });

      // IMPORTANT
      req.end(params.body || "");
    });
  }
}

module.exports = AppSync;