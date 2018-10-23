const Aws = require('aws-sdk');

class Sns {
  constructor() {
    Aws.config.update({ region: 'us-west-2' });
    this.sns = new Aws.SNS();
  }

  async publishToTopic({ topicName, title, body, id }) {
    const topic = await this.sns.createTopic({ Name: topicName }).promise();

    const msgStr = JSON.stringify({
      default: 'This is the default message. Your platform is not supported yet.',
      GCM: JSON.stringify({
        data: {
          title,
          body,
          id
        },
        priority: 'high'
      })
    });

    const params = {
      TopicArn: topic.TopicArn,
      MessageStructure: 'json',
      Message: msgStr,
    };

    return this.sns.publish(params).promise();
  }

}

module.exports = Sns;