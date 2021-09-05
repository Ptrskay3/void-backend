import { Message } from "../entities/Message";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Int,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { MyContext } from "../types";
import { isAuth } from "../middleware/isAuth";

@InputType()
class MessageInput {
  @Field()
  text: string;

  @Field()
  postId: number;
}

@Resolver(Message)
export class MessageResolver {
  @Mutation(() => Message)
  @UseMiddleware(isAuth)
  async createMessage(
    @Arg("input") input: MessageInput,
    @Ctx() { req }: MyContext
  ): Promise<Message> {
    return Message.create({
      ...input,
      userId: req.session.userId,
    }).save();
  }
  @Query(() => [Message], { nullable: true })
  async findMessagesByPostId(
    @Arg("postId") postId: number
  ): Promise<Message[] | undefined> {
    return Message.find({ where: { postId } });
  }

  @Query(() => [Message], { nullable: true })
  async messages(): Promise<Message[] | undefined> {
    return Message.find({ relations: ["user", "post"] });
  }

  @Query(() => [Message], { nullable: true })
  async findMessagesByUserId(
    @Arg("userId") userId: number
  ): Promise<Message[] | undefined> {
    return Message.find({
      where: { userId },
    });
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deleteMessage(
    @Arg("messageId", () => Int) messageId: number,
    @Ctx() { req }: MyContext
  ) {
    const message = await Message.findOne({ id: messageId });
    // there's no such message
    if (!message) {
      return false;
    }
    // permission error
    if (message.userId !== req.session.userId) {
      throw new Error("not authorized");
    }
    await Message.delete({ id: messageId });
    return true;
  }
}
