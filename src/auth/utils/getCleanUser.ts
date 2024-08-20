import { User } from "@prisma/client";

/**
 * This function removes the password field from a user object.
 * It extracts the password field and returns the rest of the user object without the password.
 * 
 * @param user - The user object from which the password field is to be removed.
 * @returns The user object without the password field.
 */
export default function getCleanUser(user: User) {
    const { password, ...userWithoutPassword } = user; 
    return userWithoutPassword;
}