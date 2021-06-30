export const validateRegister = (
  username: string,
  password: string,
  email: string
) => {
  if (username.length <= 2) {
    return [
      {
        field: "username",
        message: "username length must be greater than 2",
      },
    ];
  }

  if (username.includes("@")) {
    return [
      {
        field: "username",
        message: "username cannot include @",
      },
    ];
  }

  if (password.length <= 2) {
    return [
      {
        field: "password",
        message: "password length must be greater than 2",
      },
    ];
  }

  if (email.length <= 4 || !email.includes("@")) {
    return [
      {
        field: "email",
        message: "email is not valid",
      },
    ];
  }

  return null;
};
