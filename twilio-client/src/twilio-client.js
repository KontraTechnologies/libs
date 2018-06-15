const twilio = require("twilio");

/**
 * Appsync operations
 */
const CreateMessage = require("../graphql/queries/createMessage");
const UpdateContact = require("../graphql/mutations/updateContact");
const QueryContactsByPropertyIdIndex = require("../graphql/queries/queryContactsByPropertyIdIndex");

class Twilio {
  constructor({ accountSid, authToken, appsync }) {
    this.authToken = authToken;
    this.client = twilio(accountSid, authToken);
    this.msgIsValid = false;
    this.incomingData = undefined;
    this.emptyResponse = "<Response></Response>";
    this.appsync = appsync;
    this.propertyId = "";
  }

  async validateMsg({ twilioSignature, requestedUrl, twilioData, propertyId, type }) {
    this.msgIsValid = twilio.validateRequest(
      this.authToken,
      twilioSignature,
      requestedUrl,
      twilioData
    );
    this.incomingData = twilioData;
    this.propertyId = propertyId;

    switch (type) {
      case "SMS":
        await this.recordMessage({
          to: this.incomingData.To,
          from: this.incomingData.From,
          message: this.incomingData.Body,
          propertyId,
          type
        });
        break;
      case "VOICE":
        switch (this.incomingData.CallStatus) {
          case "ringing":
            await this.recordMessage({
              to: this.incomingData.To,
              from: this.incomingData.From,
              message: "Incoming call.",
              propertyId,
              type
            });
            break;
          default:
            await this.recordMessage({
              to: this.incomingData.To,
              from: this.incomingData.From,
              message: this.incomingData.SpeechResult,
              propertyId,
              type
            });
        }
        break;
      default: 
        console.log("Unsupported type");
    }
    

    return this.msgIsValid;
  }

  async sendSms({ to, from, msg, propertyId = this.propertyId}) {

    const promiseArray = [];

    try {
      await this.client.messages.create({
        to: to,
        from: from,
        body: msg
      })
    } catch (error) {
      switch(error.code) {
        case 21610:
          /**
           * Phone number has opted-out
           */
          await this.appsync.request({
            request: UpdateContact,
            variables: {
              input: {
                propertyId,
                isVerified: false,
                phoneNumber: to 
              }
            }
          });
          break;
      }
    }

    promiseArray.push(
      this.recordMessage({
        to,
        from,
        propertyId,
        message: msg,
        type: "SMS"
      })
    );

    return Promise.all(promiseArray);
  }

  async recordMessage({ to, from, message, propertyId, type}) {
    return this.appsync.request({
      request: CreateMessage,
      variables: {
        toNumber: to,
        fromNumber: from,
        messageType: type,
        message,
        propertyId    
      }
    })
  }

  async sendSmsToContacts({from, propertyId, message, contactNumber}) {
  
    const contacts = await this.appsync.request({
      request: QueryContactsByPropertyIdIndex,
      variables: {
        propertyId
      }
    });
  
    if (contacts.items.length === 0)
      return
  
    const promiseArray = [];
  
    for(const contact of contacts.items) {
      if (contact.phoneNumber === contactNumber || contact.isVerified === false) continue;

      promiseArray.push(
        this.sendSms({
          to: contact.phoneNumber,
          from: from,
          msg: message
        })
      );
    }
  
    return Promise.all(promiseArray);
  }

  async createSmsReply(msg) {

    await this.recordMessage({
      to: this.incomingData.From,
      from: this.incomingData.To,
      propertyId: this.propertyId,
      message: msg,
      type: "SMS"
    });

    const twimlSkeleton = new twilio.twiml.MessagingResponse();

    twimlSkeleton.message(msg);

    return twimlSkeleton.toString();
  }

  createVoiceReply(msg) {
    const twimlSkeleton = new twilio.twiml.VoiceResponse();

    twimlSkeleton.say(msg);

    return twimlSkeleton.toString();
  }

  async gatherInput({ input = "speech", timeout = 5, numDigits = 4, speechTimeout = "auto", say, loop = 1 }) {
    
    await this.recordMessage({
      to: this.incomingData.From,
      from: this.incomingData.To,
      propertyId: this.propertyId,
      message: say,
      type: "VOICE"
    });
    
    const response = new twilio.twiml.VoiceResponse();

    const gather = response.gather({
      input: input,
      timeout: timeout,
      numDigits: numDigits,
      speechTimeout: speechTimeout
    });

    for (let i = 0; i < loop; i++) {
      gather.say(say);

      if (loop > 1) {
        gather.pause({ length: 6 });
      }
    }

    response.say("No speech input was detected. Please call again if needed.");

    return response;
  }

  hangup(say) {
    let response = new twilio.twiml.VoiceResponse();

    response.say(say);
    response.hangup();

    return response;
  }

  reject() {
    let response = new twilio.twiml.VoiceResponse();

    response.reject();

    return response;
  }

  async buyNumber({ phoneNumber, voiceUrl, smsUrl, voiceMethod = "POST", smsMethod = "POST" }) {

    let response;

    const params = {
      phoneNumber: phoneNumber,
      voiceUrl: voiceUrl,
      smsUrl: smsUrl,
      voiceMethod: voiceMethod,
      smsMethod: smsMethod
    };

    response = await this.client.incomingPhoneNumbers.create(params);

    return {
      phoneNumber: response.phoneNumber,
      formattedNumber: response.friendlyName,
      sid: response.sid
    };
  }

  async getNumber(numberType = "local") {

    let response;

    const params = {
      limit: 1,
      voiceEnabled: true,
      smsEnabled: true
    };

    response = await this.client.availablePhoneNumbers("US")[numberType].list(params);

    return response[0].phoneNumber;
  }

  async releaseNumber(sid) {

    await this.client.incomingPhoneNumbers(sid).remove();

  }

  formatAssistanceText({ displayName, text }) {
    return `"${text.charAt(0).toUpperCase() + text.slice(1)}" - ${displayName}`
  }
}

module.exports = Twilio;