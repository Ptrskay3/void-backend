import { Message } from "../entities/Message";
import {
  Arg,
  Ctx,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  Subscription,
  UseMiddleware,
  PubSub,
} from "type-graphql";
import { MyContext } from "../types";
import { isAuth } from "../middleware/isAuth";
import { PubSubEngine } from "graphql-subscriptions";

@Resolver(Message)
export class MessageResolver {
  @Subscription({ topics: "NOTIFICATIONS" })
  newMessage(@Root() msg: Message): Message {
    return msg;
  }

  @Mutation(() => Message)
  @UseMiddleware(isAuth)
  async createMessage(
    @PubSub() pubSub: PubSubEngine,
    @Arg("message") message: string,
    @Arg("postId", () => Int) postId: number,
    @Ctx() { req }: MyContext
  ): Promise<Message> {
    const msg = await Message.create({
      message,
      postId,
      creatorId: req.session.userId,
    }).save();

    await pubSub.publish("NOTIFICATIONS", msg);

    return msg;
  }
  @Query(() => [Message], { nullable: true })
  async findMessagesByPostId(
    @Arg("postId") postId: number
  ): Promise<Message[] | undefined> {
    return Message.find({ relations: ["creator", "post"], where: { postId } });
  }

  @Query(() => [Message], { nullable: true })
  async findMessagesByCreatorId(
    @Arg("creatorId") creatorId: number
  ): Promise<Message[] | undefined> {
    return Message.find({
      relations: ["creator", "post"],
      where: { creatorId },
    });
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deleteMessage(
    @Arg("messageId") messageId: number,
    @Ctx() { req }: MyContext
  ) {
    const message = await Message.findOne({ id: messageId });
    // there's no such message
    if (!message) {
      return false;
    }
    // permission error
    if (message.creatorId !== req.session.userId) {
      throw new Error("not authorized");
    }
    await Message.delete({ id: messageId });
    return true;
  }
}
