# The backend for the VoidPhysics site.

## Building locally

The recommended way for building is Docker. Assuming you have PostgreSQL, Redis and Docker installed, setup a `.env.local` file in the root directory according to the `.env.example` file. It should look similar to this:

### `.env.local`:

```
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/your_database_name_here
REDIS_URL=redis://redis:6379
PORT=4000
REDIS_SECRET=THIS_IS_A_BIG_SECRET
CORS_ORIGIN=http://localhost:3000
```

Then run

```bash
docker-compose -f docker-compose-dev.yaml up
```

After a few seconds, the server will be up on `localhost:4000`, and you may start on `localhost:4000/graphql`, the GraphQL Playground to add some data.

To build the frontend, check out [the instructions there](https://github.com/Ptrskay3/void-frontend).
