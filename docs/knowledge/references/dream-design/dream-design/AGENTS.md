# Exported Project Instructions

- Keep application routes and page ownership in the exported source files; do not add Unison service-role credentials.
- Preserve ".unison/" metadata when updating or re-importing this project.
- Treat ".unison/site-bundle-snapshot.json" as the exported design snapshot; edit the site through its source and re-export from Unison to refresh metadata.
- Configure required environment variables locally from ".env.example"; never commit secret values.
- Run "npm run build" before deployment.
