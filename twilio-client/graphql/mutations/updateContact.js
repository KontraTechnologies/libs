module.exports = `
mutation UpdateContact($input: UpdateContactInput!) {
  updateContact(input: $input) {
    name
    updatedAt
    phoneNumber
    propertyId
    isVerified
    contactType
    formattedNumber
    instantResponseNumber
  }
}
`