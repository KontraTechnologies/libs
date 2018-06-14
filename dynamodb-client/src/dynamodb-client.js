const AWS       = require('aws-sdk');

class DynamoDB {
    constructor(){
        AWS.config.update({region: 'us-west-2'});
        this.documentClient = new AWS.DynamoDB.DocumentClient({convertEmptyValues: true});
    }

    async getItem({tableName, key}) {
        const params = {
            TableName: tableName,
            Key: key
        };

        const results = await this.documentClient.get(params).promise();

        return results.Item;
    }

    async putItem({tableName, item, conditionExpression}) {
        const params = {
            TableName: tableName,
            Item: item,
            ReturnValues: 'ALL_OLD',
            ConditionExpression: conditionExpression
        };

        return this.documentClient.put(params).promise();
    }

    async queryItem(params) {

        const results = await this.documentClient.query(params).promise();

        return results;
    }

    async deleteItem({tableName, key}) {

        const params = {
            TableName: tableName,
            Key: key
        }
        
        return this.documentClient.delete(params).promise();

    }

    async updateItem({tableName, key, updateAttributes}) {

        let updateExpression = 'set ';
        let expressionAttributeValues = {};

        // Add updatedAt attribute
        updateAttributes.updatedAt = Date.now()

        let index = 0;

        for(const key of Object.keys(updateAttributes)) {
            updateExpression += `${key} = :${key}`;
            expressionAttributeValues[`:${key}`] = updateAttributes[key];

            // Put a comma between values unless it is the last one
            if(index < Object.keys(updateAttributes).length - 1){
                updateExpression += ', ';
            }
            
            index++;
        }

        const params = {
            TableName: tableName,
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues
        };

        return this.documentClient.update(params).promise();
    }

    async createLocationEvent({placeId, type, text, title, serviceProviderId, userId, propertyId, icon}) {     
        // Create new event
        return this.putItem({
            tableName: process.env.EVENTS_TABLE_NAME,
            item: {
                placeId,
                createdAt: Date.now(),
                title,
                type,
                text,
                serviceProviderId,
                icon,
                userId,
                propertyId
            }
        });
    }
}

module.exports = DynamoDB;