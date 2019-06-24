const { GraphQLClient } = require('graphql-request');

class WolApi {
  constructor(endpoint, token) {
    this.client = new GraphQLClient(endpoint, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
  }

  async fetchVehicles() {
    const result = await this.client.request(`
      {
        vehicles {
          callsign
          away
          with
          info
        }
      }
    `);

    return result.vehicles;
  }

  async setVehicleAway(callsign, wth, info) {
    const query = `
      mutation ($callsign: String!, $with: String, $info: String) {
        setVehicleAway(callsign: $callsign, with: $with, info: $info)
      }
    `;

    await this.client.request(query, { callsign, with: wth, info });
  }

  async returnVehicle(callsign) {
    const query = `
      mutation ($callsign: String!) {
        returnVehicle(callsign: $callsign)
      }
    `;

    await this.client.request(query, { callsign });
  }
}

module.exports = WolApi;
