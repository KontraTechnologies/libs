const Aws = require('aws-sdk');

class Sns {
  constructor() {
    Aws.config.update({ region: 'us-west-2' });
    this.sns = new Aws.SNS();
  }

  async publishToTopic({ topicName, payload }) {
    const topic = await this.sns.createTopic({ Name: topicName }).promise();

    const params = {
      TopicArn: topic.TopicArn,
      MessageStructure: 'json',
      Message: {
        default: 'This is the default message. Your platform is not supported yet.',
        GCM: {
          data: payload,
          priority: 'high'
        }
      },
    };

    return this.sns.publish(params).promise();
  }

}

module.exports = Sns;