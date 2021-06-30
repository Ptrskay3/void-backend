import { User } from "../entities/juser";
import { MyContext } from "../types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import argon2 from "argon2";
import { COOKIE_NAME, FORGET_PW_PREFIX } from "../constant";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";
import { getConnection } from "typeorm";

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    // current users are allowed to see their own email
    if (req.session.userId === user.id) {
      return user.email;
    }
    // do not have permission to see it
    return "";
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 2) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "password length must be greater than 2",
          },
        ],
      };
    }
    const key = FORGET_PW_PREFIX + token;
    const userId = await redis.get(key);
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "token invalid or expired",
          },
        ],
      };
    }
    const userIdNum = parseInt(userId);
    const user = await User.findOne({ id: userIdNum });
    if (!user) {
      // should be unreachable
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists",
          },
        ],
      };
    }

    const password = await argon2.hash(newPassword);
    await User.update({ id: userIdNum }, { password });

    await redis.del(key);

    // login after change
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  async forgetPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // the email is not in db
      // don't let people fish emails based on that
      return true;
    }

    const TOKEN = v4();

    await redis.set(
      FORGET_PW_PREFIX + TOKEN,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 3
    ); // 3 days
    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${TOKEN}">reset password<a>` // this should not be hardcoded..
    );
    return true;
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { req }: MyContext): Promise<User | undefined> {
    // not logged in
    if (!req.session.userId) {
      return undefined;
    }
    return User.findOne(req.session.userId);
  }

  @Query(() => [User])
  users(): Promise<User[]> {
    return User.find();
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("username", () => String) username: string,
    @Arg("email", () => String) email: string,
    @Arg("password", () => String) password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(username, password, email);
    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(password);
    let user;
    try {
      // User.create({
      //   username: username,
      //   email: email,
      //   password: hashedPassword,
      // }).save();
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: username,
          email: email,
          password: hashedPassword,
        })
        .returning("*")
        .execute();
      user = result.raw[0];
    } catch (err) {
      if (err.code === "23505") {
        return {
          errors: [
            {
              field: "username",
              message: "username (or email) already taken",
            },
          ],
        };
      } else {
        return {
          errors: [
            {
              field: "username",
              message: err.message,
            },
          ],
        };
      }
    }

    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail", () => String) usernameOrEmail: string,
    @Arg("password", () => String) password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    if (usernameOrEmail) {
      const user = await User.findOne({
        where: usernameOrEmail.includes("@")
          ? { email: usernameOrEmail }
          : { username: usernameOrEmail },
      });
      if (!user) {
        return {
          errors: [
            {
              field: "usernameOrEmail",
              message: "username or email is not valid",
            },
          ],
        };
      }

      const valid = await argon2.verify(user.password, password);
      if (!valid) {
        return {
          errors: [
            {
              field: "password",
              message: "password is not valid",
            },
          ],
        };
      }
      req.session.userId = user.id;
      return {
        user: user,
      };
    }
    return {
      errors: [{ field: "usernameOrEmail", message: "not valid.." }],
    };
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: MyContext): Promise<Boolean> {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);

        if (err) {
          console.log("error happened during session destroy: ", err);
          resolve(false);
          return;
        }
        resolve(true);
      })
    );
  }
}
