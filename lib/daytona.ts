import { Daytona } from "@daytona/sdk"

// Passed explicitly: with .env.local in the working directory the SDK refuses
// to pick the endpoint up from the environment on its own.
export const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: process.env.DAYTONA_API_URL,
})
