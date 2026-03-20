import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '385v6f7f',
    dataset: 'production'
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    appId: 'sc0p8kuv25b2zwdjyo2ij6ju',
    autoUpdates: true,
  }
})
