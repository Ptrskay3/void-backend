import DataLoader from "dataloader";
import { User } from "../entities/juser";

// keys [1, 7, ..] -> [{id: 1, username: ..., ....}, ...]
export const createUserLoader = () =>
  new DataLoader<number, User>(async (userIds) => {
    const users = await User.findByIds(userIds as number[]);
    const userId2User: Record<number, User> = {};
    users.forEach((u) => {
      userId2User[u.id] = u;
    });
    return userIds.map((userId) => userId2User[userId]);
  });
