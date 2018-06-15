module.exports = `
query QueryContactsByPropertyIdIndex($propertyId: String!) {
  queryContactsByPropertyIdIndex(propertyId: $propertyId) {
    items {
      phoneNumber
      isVerified
    }
  }
}
`