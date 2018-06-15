const aws4 = require("aws4");
const https = require("https");
const util = require('util');


class AppSync {
  /**
   * AppSync constructor
   * @param {Object} param - The param object
   * @param {String} param.accessKeyId - The access key ID of the role for the caller to assume
   * @param {String} param.secretAccessKey - The secret access key of the role for the caller to assume
   * @param {String} param.region - The region that the appsync api is hosted in
   * @param {String} param.host - The appsync url
   */
  constructor({ accessKeyId, secretAccessKey, region, url }) {
    this.host = url.split("https://")[1].split("/graphql")[0];
    this.region = region;
    this.credentials = {
      accessKeyId,
      secretAccessKey
    };
  }

  /**
   * Make a request to appsync and return promise
   * @param {Object} param - The param object
   * @param {String} param.request - The graphql request
   * @param {String} param.variables - The graphql request variables
   */
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
    
    return AppSync.appsyncExp(params);

  }

  /**
   * Performs an async appsync operation, uses exponential backoff if
   * 429 or 5xx error occurs
   * @param {Object} appSyncParams - appsync siv4 signed params 
   */
  static async appsyncExp(appSyncParams) {

    const MAX_RETRIES = 5;
    const MAX_WAIT_INTERVAL_MS = 3000;
    let retry = false;
    let retries = 0;
    let waitTime = 0;
    let response = {};

    do {
      try {
        response = await AppSync.sendRequest(appSyncParams);
        retry = false;
      } catch (e) {
        if (e.statusCode === 429 || e.statusCode >= 500) {
          retry = true;

          if (retries === MAX_RETRIES) {
            throw ({...e, retries: retries});
          }

        } else {
          throw(e);
        }
      }
      waitTime = Math.min(AppSync.getWaitTime(retries), MAX_WAIT_INTERVAL_MS);
      await AppSync.sleep(waitTime);
    } while (retry && retries++ < MAX_RETRIES);
    
    return (response);
  }

  /**
   * Waits for a certain time
   * @param {Int} ms - The length of time in ms to wait. 
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Return the next wait interval, in millisecods, using an exponential
   * backoff algorithm.
   * @param {Int} retryCount - Current retries
   */
  static getWaitTime(retryCount) {
    const waitTime = Math.pow(2, retryCount) * 100;

    return waitTime;
  }

  /**
   * Make the network request and deal with the response
   * @param {Object} params - Appsync params 
   */
  static sendRequest(params) {
    return new Promise(function (resolve, reject) {
      const req = https.request(params, function (res) {
        // reject on bad status
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject({statusCode: res.statusCode, statusMessage: res.statusMessage});
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
            if (body.errors) {
              reject(body.errors);
            }
            operation = Object.keys(body.data)[0];
            resolve(body.data[operation]);
          } catch (e) {
            reject(e);
          }
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