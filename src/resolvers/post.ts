import { Post } from "../entities/Post";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { MyContext } from "../types";
import { isAuth } from "../middleware/isAuth";
import { getConnection } from "typeorm";
import { Updoot } from "../entities/Updoot";
import { User } from "../entities/juser";

@InputType()
class PostInput {
  @Field()
  title: string;

  @Field()
  text: string;
}

@ObjectType()
class PaginatedPost {
  @Field(() => [Post])
  posts: Post[];

  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
  }

  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId);
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value === 1;
    const realValue = isUpdoot ? 1 : -1;
    const { userId } = req.session;

    const updoot = await Updoot.findOne({ where: { userId, postId } });

    // can't vote on owned posts
    const post = await Post.findOne({ where: { id: postId } });
    if (post?.creatorId === userId) {
      return true;
    }

    // already voted, see if this vote matches their previos
    if (updoot && updoot.value !== realValue) {
      await getConnection().transaction(async (tm) => {
        tm.query(
          `
          update updoot
          set value = $3
          where "postId" = $2 and "userId" = $1
        `,
          [userId, postId, realValue]
        );

        tm.query(
          `
          update post
          set points = points + $1 
          where id = $2
        `,
          [updoot.value === 0 ? realValue : 2 * realValue, postId]
        );
      });
      return true;
      // they want to delete their vote
    } else if (updoot && updoot.value === realValue) {
      // TODO
      await getConnection().transaction(async (tm) => {
        tm.query(
          `
          update updoot
          set value = $3
          where "postId" = $2 and "userId" = $1
        `,
          [userId, postId, 0]
        );

        tm.query(
          `
          update post
          set points = points + $1
          where id = $2
        `,
          [updoot.value === 1 ? -1 : 1, postId]
        );
      });
      return true;
      // they never voted
    } else if (!updoot) {
      await getConnection().transaction(async (tm) => {
        tm.query(
          `
          insert into updoot ("userId", "postId", value)
          values ($1, $2, $3)
        `,
          [userId, postId, realValue]
        );
        await tm.query(
          `
          update post p
          set points = points + $1
          where id = $2
        `,
          [realValue, postId]
        );
      });
      return true;
    } else {
      return true;
    }
  }

  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { updootLoader, req }: MyContext
  ) {
    if (!req.session.userId) {
      return null;
    }

    const updoot = await updootLoader.load({
      postId: post.id,
      userId: req.session.userId,
    });

    return updoot ? updoot.value : null;
  }

  @Query(() => Int)
  async numberOfPosts(@Arg("userid", () => Int) userid: number) {
    const posts = await Post.find({ where: { creatorId: userid } });
    return posts.length || 0;
  }

  @Query(() => PaginatedPost)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPost> {
    const realLimit = Math.min(50, limit);
    // fetch one more, but only show `realLimit`
    const realLimitPlusOne = realLimit + 1;

    const replaces: any[] = [realLimitPlusOne];

    if (cursor) {
      replaces.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
      SELECT p.*
      FROM post p
      ${cursor ? `where p."createdAt" < $2` : ""}
      ORDER BY p."createdAt" DESC
      LIMIT $1

    `,
      replaces
    );

    // const qb = getConnection()
    //   .getRepository(Post)
    //   .createQueryBuilder("p")
    //   .innerJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
    //   .orderBy("p.createdAt", "DESC")
    //   .take(realLimitPlusOne);
    // if (cursor) {
    //   qb.where("p.createdAt < :cursor", { cursor: new Date(parseInt(cursor)) });
    // }

    // const posts = await qb.getMany();

    return {
      hasMore: posts.length === realLimitPlusOne,
      posts: posts.slice(0, realLimit),
      // if there's more (at least 1 more), we can continue fetching
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({ ...input, creatorId: req.session.userId }).save();
  }

  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();

    return result.raw[0];
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    // the cascade way:
    // Updoot table updated
    // await Post.delete({ id, creatorId: req.session.userId });

    const post = await Post.findOne(id);
    // there's no such post
    if (!post) {
      return false;
    }
    // permission error
    if (post.creatorId !== req.session.userId) {
      throw new Error("permission denied");
    }
    // we need to delete the votes connected to the post
    // before deleting the post itself
    await Updoot.delete({ postId: id });
    // only allowed to delete owned posts
    await Post.delete({ id });
    return true;
  }
}