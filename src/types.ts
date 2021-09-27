import DataLoader from "dataloader";
import { Request, Response } from "express";
import { Session } from "express-session";
import { Redis } from "ioredis";
import { User } from "./entities/juser";
import { createVoteStatusLoader } from "./utils/createVoteLoader";

export type MyContext = {
  req: Request & { session?: Session & { userId?: number } };
  res: Response;
  redis: Redis;
  userLoader: DataLoader<number, User>;
  upvoteLoader: ReturnType<typeof createVoteStatusLoader>;
};
