import DataLoader from "dataloader";
import { Upvote } from "../entities/Upvote";

export const createVoteStatusLoader = () =>
  new DataLoader<{ postId: number; userId: number }, Upvote | null>(
    async (keys) => {
      const upvotes = await Upvote.findByIds(keys as any);
      const upvoteIds2Upvotes: Record<string, Upvote> = {};
      upvotes.forEach((upvote) => {
        upvoteIds2Upvotes[`${upvote.userId}|${upvote.postId}`] = upvote;
      });
      return keys.map(
        (key) => upvoteIds2Upvotes[`${key.userId}|${key.postId}`]
      );
    }
  );
