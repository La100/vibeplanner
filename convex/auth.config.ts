const authConfig = {
  providers: [
    {
      // Clerk JWT issuer domain from environment variables
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
