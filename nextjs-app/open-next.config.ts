// https://opennext.js.org/aws/config/full_example
const config = {
  default: { // This is the default server, similar to the server-function in open-next v2
    // You don't have to provide the below, by default it will generate an output
    // for normal lambda as in open-next v2
    override: {
      wrapper: "aws-lambda-streaming", // This is necessary to enable lambda streaming
      // You can override any part that is a `LazyLoadedOverride` this way
    },
    minify: false, // This will minify the output
  },

  dangerous: {
    // This will disable the tag cache
    // You can use it safely on page router, on app router it will break revalidateTag and revalidatePath
    disableTagCache: false,
    // This will disable the incremental cache
    // This is generally not recommended, as this is necessary for ISR AND SSG routes as well as the fetch cache
    disableIncrementalCache: false,
  },
}

export default config;
export type Config = typeof config
