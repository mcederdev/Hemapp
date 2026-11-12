// Testerna körs med `npm test`. Egen konfig så att PWA-pluginet inte laddas.
// Svensk tidszon gör att datum- och kalendertester ger samma svar på alla datorer.
process.env.TZ = 'Europe/Stockholm'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node'
  }
})
