import DataLoader from "dataloader";
import { Updoot } from "../entities/Updoot";

export const createVoteStatusLoader = () =>
  new DataLoader<{ postId: number; userId: number }, Updoot | null>(
    async (keys) => {
      const updoots = await Updoot.findByIds(keys as any);
      const updootIds2Updoot: Record<string, Updoot> = {};
      updoots.forEach((updoot) => {
        updootIds2Updoot[`${updoot.userId}|${updoot.postId}`] = updoot;
      });
      return keys.map((key) => updootIds2Updoot[`${key.userId}|${key.postId}`]);
    }
  );
