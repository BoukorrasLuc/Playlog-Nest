import { User } from "@prisma/client";

export default function getCleanUser(user: User) {
    const { password, ...userWithoutPassword } = user; 
    return userWithoutPassword;
  }