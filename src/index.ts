import "dotenv-safe/config";
import "reflect-metadata";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import { COOKIE_NAME, production } from "./constant";
import { MyContext } from "./types";
import cors from "cors";
import { createConnection } from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/juser";
import path from "path";
import { Updoot } from "./entities/Updoot";
import { Message } from "./entities/Message";
import { MessageResolver } from "./resolvers/message";
import { createUserLoader } from "./utils/createUserLoader";
import { createVoteStatusLoader } from "./utils/createVoteLoader";

const main = async () => {
  let retries = 5;
  while (retries) {
    try {
      const connection = await createConnection({
        type: "postgres",
        url: process.env.DATABASE_URL,
        logging: true,
        // synchronize: true,
        entities: [Post, User, Updoot, Message],
        migrations: [path.join(__dirname, "./migrations/*")],
      });
      connection.runMigrations();
      break;
    } catch (error) {
      console.log(error);
      retries -= 1;
      console.log("retries left ", retries);
      // wait a little
      await new Promise((res) => setTimeout(res, 10000));
    }
  }
  // await Message.delete({});

  const app = express();
  const RedisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);
  app.set("trust proxy", 1); // becuase we're behind nginx
  app.use(
    cors({
      // origin: true,
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true,
        sameSite: "lax", // csrf token protection
        secure: production, // only https
        domain: production ? ".voidphysics.com" : undefined,
      },
      secret: process.env.REDIS_SECRET,
      resave: false,
      saveUninitialized: false, // don't store empty session
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver, MessageResolver],
      validate: false,
    }),
    subscriptions: {},
    context: ({ req, res }): MyContext => ({
      req,
      res,
      redis,
      userLoader: createUserLoader(),
      updootLoader: createVoteStatusLoader(),
    }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  // const httpServer = http.createServer(app);
  // apolloServer.installSubscriptionHandlers(httpServer);

  app.listen(process.env.PORT, () => {
    console.log(`server up on port ${process.env.PORT}`);
  });
};

main().catch((e) => console.error(e));
