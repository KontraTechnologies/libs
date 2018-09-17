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

        return this.documentClient.query(params).promise();

    }

    async batchGet(params) {
        return this.documentClient.batchGet(params).promise();
    }
    
    async deleteItem({tableName, key}) {

        const params = {
            TableName: tableName,
            Key: key
        }
        
        return this.documentClient.delete(params).promise();

    }

    async updateItem({tableName, key, updateAttributes, conditionExpression, returnValues = "ALL_NEW"}) {

        console.log("Update attributes: ", updateAttributes);

        let updateExpression = 'set ';
        let expressionAttributeValues = {};
        let expressionAttributeNames = {};

        let removeAttributes = [];

        let index = 0;

        for(const key of Object.keys(updateAttributes)) {
            if (updateAttributes[key] === null) {
                delete updateAttributes[key];
                removeAttributes[key] = updateAttributes[key];
            } else if (typeof updateAttributes[key] === "undefined") {
                delete updateAttributes[key];
            }
        }

        for(const key of Object.keys(updateAttributes)) {

            updateExpression += `#${key} = :${key}`;
            expressionAttributeNames[`#${key}`] = key;
            expressionAttributeValues[`:${key}`] = updateAttributes[key];

            // Put a comma between values unless it is the last one
            if(index < Object.keys(updateAttributes).length - 1){
                updateExpression += ', ';
            }
            
            index++;
        }

        if (Object.keys(removeAttributes).length > 0) {
            updateExpression += " remove ";

            index = 0;

            for(const key of Object.keys(removeAttributes)) {
    
                updateExpression += `#${key}`;
                expressionAttributeNames[`#${key}`] = key;
    
                // Put a comma between values unless it is the last one
                if(index < Object.keys(removeAttributes).length - 1){
                    updateExpression += ', ';
                }
                
                index++;
            }

        }

        const params = {
            TableName: tableName,
            Key: key,
            ReturnValues: returnValues,
            UpdateExpression: updateExpression,
            ConditionExpression: conditionExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        };

        console.log("Update params: ", params);

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