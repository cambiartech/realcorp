import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      isPlatformAdmin: boolean;
    };
  }

  interface User {
    isPlatformAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isPlatformAdmin?: boolean;
    email?: string | null;
    name?: string | null;
  }
}
